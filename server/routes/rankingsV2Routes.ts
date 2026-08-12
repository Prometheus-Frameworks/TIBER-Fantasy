import { Router, Request, Response } from 'express';
import {
  RANKINGS_V2_CONTRACT_VERSION,
  rankingsV2ResponseSchema,
  RankingsV2ExplanationPillar,
  RankingsV2Item,
  RankingsV2PillarNote,
  RankingsV2RiskSignal,
} from '../contracts/rankingsV2';
import { CACHE_VERSION, getGradesFromCache } from '../modules/forge/forgeGradeCache';
import { scoringService } from '../modules/externalModels/scoring/scoringService';
import { buildRankingsScoringInputs, hasMeaningfulScoringInputs, toLeagueContextInput } from '../modules/externalModels/scoring/scoringRequestMappers';
import {
  COMPLETION_NOT_VERIFIED_COPY,
  resolveSeasonPhase,
  SeasonPhaseInfo,
  type TargetProvenance,
} from '@shared/weekDetection';
import { elapsedRegularSeasonWeeks } from '@shared/nflSeasonCalendar';
import {
  RankingIdentity,
  RankingIdentityCoverage,
  resolveRankingIdentities,
} from '../services/identity/rankingIdentityResolver';

type SupportedPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'ALL';
const CACHE_EMPTY_STATUS = 'forge_cache_empty_uncomputed';
export const SEASON_CONFIG_STALE_STATUS = 'season_calendar_config_stale';
/** Serving rows from a season other than the one the league is currently in. */
export const ARCHIVE_SEASON_STATUS = 'archive_season_not_current';
/**
 * An explicitly requested week has no evidence from any admitted source.
 *
 * Distinct from `forge_cache_empty_uncomputed`, which says the grades for the
 * *current* board have not been computed yet and will be shortly. This says the
 * exact week the caller asked about cannot be answered, and that no other
 * week's rows were substituted for it.
 */
export const EXACT_WEEK_UNAVAILABLE_STATUS = 'exact_week_evidence_unavailable';

/**
 * Phase/freshness envelope attached to every weekly rankings response.
 *
 * `generatedAt` is when the score was computed; `evidenceSeason`/`evidenceWeek`
 * describe the football evidence behind it. Keeping them apart is the point of
 * Fantasy #307 — a 2026 computation timestamp over 2025 Week 18 evidence must
 * not read as current-season evidence.
 */
/**
 * Why the evidence extent is (or is not) known. Every value names a SOURCE
 * relationship, never a calendar or clock derivation:
 *
 *   source_declared_as_of        — the serving cache declared its own asOfWeek
 *   source_max_represented_week  — measured from the admitted stats rows
 *   source_extent_unknown        — the source cannot state its extent; the
 *                                  week is null and must not render as
 *                                  "full season"
 *   no_rankable_source           — nothing was admitted at all
 */
export type EvidenceProvenance =
  | 'source_declared_as_of'
  | 'source_max_represented_week'
  | 'source_extent_unknown'
  | 'no_rankable_source';

/**
 * Where the returned board's target week came from.
 *
 * Deliberately a SEPARATE field from `decisionTargetProvenance` rather than a
 * new member of that enum. `TargetProvenance` answers "how trustworthy is the
 * schedule behind this week" and is a closed set an existing client may already
 * switch on exhaustively; adding a value to it would break those clients
 * mid-rolling-deployment without a contract-version change. Origin is a
 * different question — "who chose this week" — so it gets its own optional
 * field and the existing enum keeps its meaning and its membership.
 */
export type DecisionTargetOrigin = 'explicit_request' | 'phase_default';

function buildSeasonMeta(input: {
  phase: SeasonPhaseInfo;
  /**
   * The board this response actually describes — the *effective request*
   * target, not the live phase target.
   *
   * These are different facts whenever the caller asks for anything other than
   * the current forward board, and publishing the phase target for both meant a
   * 2025 Week 7 request came back advertising 2026 Week 1: correct rows under a
   * label describing a different board entirely. The live phase target is still
   * published, under `phaseTarget*`, where it cannot be mistaken for a
   * description of the returned rows.
   */
  boardSeason: number | null;
  boardWeek: number | null;
  /** True when the caller named the week, rather than it being defaulted. */
  boardWeekIsExplicit: boolean;
  evidenceSeason: number | null;
  evidenceWeek: number | null;
  evidenceProvenance: EvidenceProvenance;
  generatedAt: string | null;
  status: string | null;
  statusDetail: string | null;
}) {
  // The season the league is *in* and the season the forward board is *about*
  // are different facts. During the 2025 postseason the phase season is 2025
  // while the forward board targets 2026, so archive status must be computed
  // against the board's target season — otherwise a valid 2026 Week 1 board
  // would be mislabelled as a 2025 archive.
  // `resolveSeasonPhase()` preserves numeric legacy accessors after the last
  // configured calendar by carrying `newest + 1` internally. That sentinel is
  // useful only to keep old callers from crashing; it is not observed league
  // state and must never cross this public boundary. When the calendar is
  // stale, every live season/phase/target fact is unavailable instead.
  const livePhaseAvailable = input.phase.configStatus === 'ok';
  const currentSeason = livePhaseAvailable ? input.phase.season : null;
  const forwardRankingSeason = livePhaseAvailable ? input.phase.targetSeason : null;
  const currentPhase = livePhaseAvailable ? input.phase.phase : null;
  const currentPhaseLabel = livePhaseAvailable ? input.phase.seasonPhaseLabel : null;
  const currentRegularSeasonWeek = livePhaseAvailable ? input.phase.regularSeasonWeek : null;
  const phaseTargetSeason = livePhaseAvailable ? input.phase.targetSeason : null;
  const phaseTargetWeek = livePhaseAvailable ? input.phase.targetWeek : null;
  const phaseTargetProvenance = livePhaseAvailable ? input.phase.targetProvenance : null;
  const phaseTargetIsProvisional = livePhaseAvailable ? input.phase.targetIsProvisional : false;
  const archiveComparisonSeason = forwardRankingSeason ?? currentSeason;

  // Provenance keeps its existing meaning and its existing membership: it
  // describes the SCHEDULE the week rests on. An explicitly requested week
  // rests on no calendar arithmetic at all, so it has no schedule provenance —
  // null, an already-valid value in the closed enum — and is not provisional.
  // Who chose the week is a different question, answered by `origin` below.
  const boardProvenance: TargetProvenance | null =
    input.boardWeek === null || input.boardWeekIsExplicit || !livePhaseAvailable
      ? null
      : input.phase.targetProvenance;
  const boardIsProvisional =
    input.boardWeek !== null &&
    !input.boardWeekIsExplicit &&
    livePhaseAvailable &&
    input.phase.targetIsProvisional;
  const boardOrigin: DecisionTargetOrigin | null =
    input.boardWeek === null
      ? null
      : input.boardWeekIsExplicit
        ? 'explicit_request'
        : 'phase_default';

  // Archive status has two independent sources, and they must not be
  // conflated (Fantasy #307 correction round 5):
  //
  // - A live calendar (`configStatus: 'ok'`) makes it a comparison: archive
  //   iff the admitted evidence season differs from the live forward target.
  // - A stale calendar makes it a PROOF, not a comparison. The route's own
  //   stale-calendar gate (see the `/weekly` handler) already refused every
  //   request except an explicitly named, configured historical season
  //   before any cache/scoring read — so reaching here at all, with a
  //   non-null evidence season (i.e., NOT `no_rankable_source`), means this
  //   response can only be that configured archive. There is no live
  //   forward target to compare against (`phase.season`/`targetSeason` are
  //   themselves synthetic/unresolved here), so none is claimed — see the
  //   stale-specific detail text below, which names neither.
  const isArchive =
    input.evidenceSeason === null
      ? false
      : input.phase.configStatus === 'ok'
        ? archiveComparisonSeason !== null && input.evidenceSeason !== archiveComparisonSeason
        : true;

  return {
    currentSeason,
    forwardRankingSeason,
    currentPhase,
    currentPhaseLabel,
    currentRegularSeasonWeek,
    targetSeason: phaseTargetSeason,
    targetWeek: phaseTargetWeek,
    targetLabel: livePhaseAvailable ? input.phase.targetLabel : null,
    scheduleSource: livePhaseAvailable && phaseTargetSeason !== null && phaseTargetWeek !== null
      ? input.phase.scheduleSource
      : null,
    configStatus: input.phase.configStatus,
    configNote: input.phase.configNote,

    // The decision-target / evidence split, published so a consumer never has
    // to infer which job a week number is doing. The whole `seasonMeta`
    // envelope is additive relative to deployed main; unpublished intermediate
    // shapes on this branch do not constrain these truthful nulls.
    //
    // `decisionTarget*` describes **the board in this response**. It is the
    // effective request target, so an explicit `season=2025&asOfWeek=7` request
    // is labelled 2025 Week 7 — not the live 2026 Week 1 phase target, which
    // describes a board this response did not return.
    decisionTargetSeason: input.boardSeason,
    decisionTargetWeek: input.boardWeek,
    decisionTargetProvenance: boardProvenance,
    decisionTargetIsProvisional: boardIsProvisional,
    // Who chose the week, as its own field rather than a new member of the
    // closed provenance enum above — widening that enum would break an
    // existing client switching on it exhaustively, mid-rolling-deployment,
    // without a contract-version change.
    decisionTargetOrigin: boardOrigin,
    // The live phase target, preserved separately because it is still useful —
    // a client showing "you are deciding Week 12" needs it — but it is now
    // named for what it is and cannot be read as a description of these rows.
    phaseTargetSeason,
    phaseTargetWeek,
    phaseTargetProvenance,
    phaseTargetIsProvisional,
    // `evidenceThroughWeek` restates `evidenceWeek` under a name that cannot
    // be mistaken for a target, with the source relationship that produced it.
    evidenceThroughSeason: input.evidenceWeek === null ? null : input.evidenceSeason,
    evidenceThroughWeek: input.evidenceWeek,
    evidenceProvenance: input.evidenceProvenance,
    // Completion is a separate fact from evidence extent, and this build has
    // no per-game finalization source at all — deriving one from the calendar
    // is exactly the defect this split removes. So completion is never
    // asserted: a source containing evidence through Week N does not prove
    // every game in Week N is final. A separately sourced
    // `finalizedThroughWeek` may exist one day; until then it is null.
    completionVerified: false,
    finalizedThroughWeek: null,
    completionCopy: COMPLETION_NOT_VERIFIED_COPY,

    // Evidence vs computation — deliberately separate fields.
    evidenceSeason: input.evidenceSeason,
    evidenceWeek: input.evidenceWeek,
    generatedAt: input.generatedAt,
    isArchiveView: isArchive,
    status: input.status ?? (isArchive ? ARCHIVE_SEASON_STATUS : null),
    statusDetail:
      input.statusDetail ??
      (isArchive
        ? input.phase.configStatus === 'ok' && currentPhaseLabel !== null
          ? forwardRankingSeason !== null
            ? `Showing ${input.evidenceSeason} evidence while the forward board targets ${forwardRankingSeason} (${currentPhaseLabel}).`
            : `Showing historical ${input.evidenceSeason} evidence while the league is in ${currentSeason} with no forward ranking target (${currentPhaseLabel}).`
          // Stale calendar: no live forward target/season is claimed, since
          // none is known — `phase.season`/`forwardRankingSeason` here are
          // themselves the synthetic value the stale calendar produced, not
          // a real board to compare against.
          : `Showing configured historical ${input.evidenceSeason} evidence while live season state is unavailable.`
        : null),
  };
}

/** Fail-closed payload used when no rankable state can be resolved. */
/** A true zero envelope: no rows were admitted, so nothing was resolved. */
const EMPTY_IDENTITY_COVERAGE: RankingIdentityCoverage = {
  total: 0,
  canonical: 0,
  resolved: 0,
  unresolved: 0,
  ambiguous: 0,
  coverageRatio: 0,
  byReason: {},
};

/**
 * Send a fail-closed payload through the SAME contract validation as a
 * successful one.
 *
 * The unavailable path previously returned straight from `res.json()`, so it
 * was the one response never checked against `rankingsV2ResponseSchema` — and
 * therefore the one that could silently drift out of contract, which is
 * exactly what happened when #313 added `identityCoverage`. Validating here
 * means a future required field breaks this path loudly instead of shipping a
 * response that consumers of the advertised contract reject.
 */
function sendUnavailable(res: Response, payload: unknown) {
  const parsed = rankingsV2ResponseSchema.safeParse(payload);
  if (!parsed.success) {
    console.error(
      `[RankingsV2/Routes] fail-closed payload violates the response contract: ${JSON.stringify(parsed.error.flatten())}`,
    );
    return res.status(500).json({
      error: 'Failed to build Rankings v2 unavailable payload',
      details: parsed.error.flatten(),
    });
  }
  return res.json(parsed.data);
}

function buildUnavailablePayload(input: {
  season: number | null;
  status: string;
  detail: string;
  phase: SeasonPhaseInfo;
  position: SupportedPosition;
}) {
  const nowIso = new Date().toISOString();
  return {
    contractVersion: RANKINGS_V2_CONTRACT_VERSION,
    mode: 'weekly' as const,
    lens: 'lineup_decision' as const,
    horizon: 'week' as const,
    asOf: nowIso,
    sourceStack: [],
    items: [],
    trust: {
      confidence: null,
      asOf: null,
      freshnessNote: null,
      sampleNote: input.detail,
      stabilityNote: input.status,
    },
    seasonMeta: buildSeasonMeta({
      phase: input.phase,
      // No board was returned, so there is no board to describe. The requested
      // season is recorded; the week is null rather than borrowed from the
      // phase, which would label an empty response with a board it did not
      // serve.
      boardSeason: input.season,
      boardWeek: null,
      boardWeekIsExplicit: false,
      // `no_rankable_source`: nothing was admitted, so there is no evidence
      // season either — not the requested season, not a guess. Publishing
      // `input.season` here read as "2025 evidence" for a request this path
      // never answered. `input.season` is still preserved above, as
      // `boardSeason` / `decisionTargetSeason` — the requested/decision
      // target, a different fact from what football was actually admitted.
      evidenceSeason: null,
      evidenceWeek: null,
      evidenceProvenance: 'no_rankable_source',
      generatedAt: null,
      status: input.status,
      statusDetail: input.detail,
    }),
    // Required by `rankingsV2ResponseSchema` since #313. Omitting it made the
    // fail-closed response the ONE payload a consumer validating the advertised
    // contract would reject — the surface that exists to be trusted when
    // everything else is unavailable. There are no rows here, so the envelope
    // is a true zero: nothing was resolved because nothing was admitted.
    identityCoverage: EMPTY_IDENTITY_COVERAGE,
  };
}

/**
 * Identity for a producer row, falling back to a typed unresolved record.
 *
 * The resolver returns an entry for every distinct non-empty source ID it was
 * given; this guards the case where a producer row carries an id the resolver
 * never saw, so a missing entry becomes a visible non-linkable row rather than
 * an exception or a silently linked raw ID.
 */
function identityFor(identities: Map<string, RankingIdentity>, sourceId: string): RankingIdentity {
  return (
    identities.get(sourceId.trim()) ?? {
      status: 'unresolved',
      canonicalId: null,
      sourceId,
      sourceType: 'unknown',
      reason: 'identifier_not_resolved',
    }
  );
}

/**
 * Normalize an internal resolution into one of the public contract's coherent
 * discriminated states. Any contradictory internal state fails closed to an
 * unresolved, non-linkable row instead of relying on contract parsing to catch
 * it after a linkable playerId has already been constructed.
 */
function toPublicIdentity(identity: RankingIdentity): RankingsV2Item['identity'] {
  const canonicalId = identity.canonicalId?.trim() ?? '';
  const sourceId = identity.sourceId.trim();

  if (
    identity.status === 'canonical' &&
    canonicalId &&
    sourceId === canonicalId &&
    identity.sourceType === 'canonical' &&
    identity.reason === null
  ) {
    return {
      status: 'canonical',
      canonicalId,
      sourceId,
      sourceType: 'canonical',
      reason: null,
      linkable: true,
    };
  }

  if (
    identity.status === 'resolved' &&
    canonicalId &&
    sourceId &&
    identity.sourceType === 'gsis' &&
    identity.reason === null
  ) {
    return {
      status: 'resolved',
      canonicalId,
      sourceId,
      sourceType: 'gsis',
      reason: null,
      linkable: true,
    };
  }

  return {
    status: 'unresolved',
    canonicalId: null,
    sourceId: identity.sourceId,
    sourceType: identity.sourceType,
    reason: identity.reason ?? 'identity_state_incoherent',
    linkable: false,
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function buildPillarNotes(row: any): RankingsV2PillarNote[] {
  const pillars: Array<{ pillar: string; value: unknown }> = [
    { pillar: 'volume', value: row.volumeScore },
    { pillar: 'efficiency', value: row.efficiencyScore },
    { pillar: 'team_context', value: row.teamContextScore },
    { pillar: 'stability', value: row.stabilityScore },
  ];

  return pillars
    .map(({ pillar, value }) => {
      const numericValue = toNumberOrNull(value);
      if (numericValue === null) return null;
      return { pillar, note: numericValue.toFixed(1), impact: 'neutral' as const };
    })
    .filter((note): note is RankingsV2PillarNote => note !== null);
}

function buildExplanationPillars(row: any): RankingsV2ExplanationPillar[] {
  const pillars: Array<{ id: RankingsV2ExplanationPillar['id']; value: unknown }> = [
    { id: 'volume', value: row.volumeScore },
    { id: 'efficiency', value: row.efficiencyScore },
    { id: 'teamContext', value: row.teamContextScore },
    { id: 'stability', value: row.stabilityScore },
  ];

  return pillars.map(({ id, value }) => ({
    id,
    value: toNumberOrNull(value),
    impact: 'neutral',
  }));
}

function buildRiskSignals(row: any): RankingsV2RiskSignal[] {
  if (!Array.isArray(row.footballLensIssues)) return [];
  return row.footballLensIssues
    .filter((issue: unknown): issue is string => typeof issue === 'string' && issue.trim().length > 0)
    .map((message) => ({
      type: 'football_lens_issue',
      message,
    }));
}

export function mapForgeCacheRowToRankingsV2Item(
  row: any,
  rank: number,
  asOfIso: string,
  identity: RankingIdentity,
): RankingsV2Item {
  const publicIdentity = toPublicIdentity(identity);
  const confidence = toNumberOrNull(row.confidence);
  const gamesPlayed = toNumberOrNull(row.gamesPlayed);
  const trajectory =
    row.trajectory === 'rising' || row.trajectory === 'flat' || row.trajectory === 'declining' ? row.trajectory : null;
  const footballLensIssues = Array.isArray(row.footballLensIssues)
    ? row.footballLensIssues.filter((issue: unknown): issue is string => typeof issue === 'string')
    : null;
  const lensAdjustment = toNumberOrNull(row.lensAdjustment);

  return {
    rank,
    // Canonical public key only — null when unresolved. The producer key stays
    // visible via `identity.sourceId`, so a raw source ID can never be mistaken
    // for a resolvable public key (#308).
    playerId: publicIdentity.canonicalId,
    identity: publicIdentity,
    playerName: String(row.playerName ?? 'Unknown Player'),
    position: typeof row.position === 'string' ? row.position : null,
    team: typeof row.nflTeam === 'string' ? row.nflTeam : null,
    tier: typeof row.tier === 'string' ? row.tier : null,
    score: toNumberOrNull(row.alpha),
    value: toNumberOrNull(row.rawAlpha),
    explanation: {
      placementSummary:
        typeof row.tier === 'string' && typeof row.alpha === 'number'
          ? `Tier ${row.tier} based on current FORGE alpha (${row.alpha.toFixed(1)}).`
          : null,
      pillars: buildExplanationPillars(row),
      riskSignals: buildRiskSignals(row),
      pillarNotes: buildPillarNotes(row),
      contextAdjustments: [],
      fragilityNotes: [],
      sustainabilityNotes: [],
    },
    trust: {
      confidence,
      asOf: asOfIso,
      freshnessNote: 'Backed by FORGE grade cache.',
      sampleNote: gamesPlayed === null ? null : `Games played: ${gamesPlayed}.`,
      stabilityNote: trajectory ? `Trajectory: ${trajectory}.` : null,
    },
    // Transitional /tiers consumer support (phase-1): explicit typed fields while v2 explanation surface matures.
    uiMeta: {
      subscores: {
        volume: toNumberOrNull(row.volumeScore),
        efficiency: toNumberOrNull(row.efficiencyScore),
        teamContext: toNumberOrNull(row.teamContextScore),
        stability: toNumberOrNull(row.stabilityScore),
      },
      confidence,
      gamesPlayed,
      trajectory,
      footballLensIssues,
      lensAdjustment,
    },
  };
}

function mapScoringRankingToRankingsV2Item(row: any, asOfIso: string, identity: RankingIdentity): RankingsV2Item {
  const publicIdentity = toPublicIdentity(identity);
  const confidenceBand = typeof row.confidenceBand === 'string' ? row.confidenceBand : null;
  const weeklyOutlook = typeof row.weeklyOutlook === 'string' ? row.weeklyOutlook : null;
  const floor = toNumberOrNull(row.floor);
  const ceiling = toNumberOrNull(row.ceiling);

  return {
    rank: Number(row.rank),
    playerId: publicIdentity.canonicalId,
    identity: publicIdentity,
    playerName: String(row.playerName ?? 'Unknown Player'),
    position: typeof row.position === 'string' ? row.position : null,
    team: typeof row.team === 'string' ? row.team : null,
    tier: confidenceBand,
    score: toNumberOrNull(row.expectedPoints),
    value: toNumberOrNull(row.vorp),
    explanation: {
      placementSummary: weeklyOutlook,
      pillars: [],
      riskSignals: [],
      pillarNotes: [
        floor != null ? { pillar: 'floor', note: floor.toFixed(1), impact: 'neutral' as const } : null,
        ceiling != null ? { pillar: 'ceiling', note: ceiling.toFixed(1), impact: 'neutral' as const } : null,
        confidenceBand ? { pillar: 'confidence_band', note: confidenceBand, impact: 'neutral' as const } : null,
      ].filter((note): note is RankingsV2PillarNote => note !== null),
      contextAdjustments: [],
      fragilityNotes: [],
      sustainabilityNotes: [],
    },
    trust: {
      confidence: null,
      asOf: asOfIso,
      freshnessNote: 'Backed by Point-prediction-Model weekly rankings.',
      sampleNote: null,
      stabilityNote: null,
    },
    uiMeta: {
      subscores: {},
      confidence: null,
      gamesPlayed: null,
      trajectory: null,
      footballLensIssues: null,
      lensAdjustment: null,
    },
  };
}

export function createRankingsV2Router(): Router {
  const router = Router();

  // CANONICAL public weekly Rankings v2 surface for /tiers and future public consumers.
  // Explanation evolution guardrail: docs/architecture/TIBER_RANKINGS_V2_EXPLANATION_SURFACE.md
  router.get('/weekly', async (req: Request, res: Response) => {
    try {
      // Season/week are no longer pinned to 2025/18. When the caller does not
      // supply them we resolve the live phase; if the calendar cannot produce a
      // target week we fail closed with a typed state rather than inventing one
      // (Fantasy #307 Phase A).
      const phase = resolveSeasonPhase();
      const seasonParam = req.query.season as string | undefined;
      const requestedSeason = parseInt(seasonParam as string, 10);
      const hasExplicitSeason = Number.isFinite(requestedSeason);
      // Outside the regular season the live weekly board is about the forward
      // target, not necessarily the phase-owning season. During the 2025
      // postseason this correctly defaults a parameterless request to 2026.
      const season = hasExplicitSeason ? requestedSeason : phase.targetSeason ?? phase.season;

      // Three different values, three different jobs — conflating any two of
      // them is the defect #307 exists to remove:
      //
      //   decisionTargetWeek — which week's board to build. Forward-looking; a
      //     provisional anchor-derived target may legitimately drive it.
      //   statsQueryCeiling — an upper bound on the stats QUERY. It filters
      //     recorded rows and cannot fabricate one, so it may come from the
      //     queried season's own calendar. It is never published.
      //   evidenceWeek (below, per payload) — the extent the admitted SOURCE
      //     actually declares. Never derived from a calendar, a clock, or the
      //     query ceiling; null when the source cannot state it.
      const asOfWeekParam = req.query.asOfWeek as string | undefined;
      const requestedWeek = asOfWeekParam ? parseInt(asOfWeekParam, 10) : NaN;
      // An omitted week defaults to the PHASE TARGET whenever the requested
      // season is the target season — so the board, the request, and the
      // published metadata agree. Defaulting to `regularSeasonWeek` here left
      // two disagreements: during the preseason it sent no week while the
      // response advertised Target Week 1, and after the Monday rollover it
      // requested the expired week while publishing the next one. A requested
      // season that is neither the target season nor the phase season is an
      // archive and has no forward target.
      const decisionTargetWeek = Number.isFinite(requestedWeek)
        ? requestedWeek
        : season === phase.targetSeason
          ? phase.targetWeek ?? undefined
          : undefined;

      // The Tiers client serializes its automatically resolved target as
      // `asOfWeek`, so query-parameter presence alone cannot distinguish user
      // choice from phase default. The narrow hint is trusted only when both
      // season and week exactly match this server's own current phase target;
      // an absent, malformed, or forged hint remains an explicit request.
      const requestedTargetOrigin = req.query.targetOrigin;
      const requestClaimsPhaseDefault = requestedTargetOrigin === 'phase_default';
      const hasCanonicalSeasonParam =
        hasExplicitSeason && seasonParam === String(requestedSeason);
      const hasCanonicalWeekParam =
        Number.isFinite(requestedWeek) && asOfWeekParam === String(requestedWeek);
      const phaseDefaultHintMatches =
        requestClaimsPhaseDefault &&
        hasCanonicalSeasonParam &&
        hasCanonicalWeekParam &&
        season === phase.targetSeason &&
        requestedWeek === phase.targetWeek;
      const weekIsExplicit = Number.isFinite(requestedWeek) && !phaseDefaultHintMatches;

      // The query ceiling belongs to the season being queried, not to the
      // live clock. `throughWeek` is a hard `lte` filter, so falling back to
      // the live phase week silently truncated every other season: a 2024
      // archive requested during 2026 Week 3 returned weeks 1-3 and presented
      // them as the season, and in the offseason the `?? 0` fallback matched
      // nothing at all while still rendering as a populated archive view. The
      // same fallback also emptied the 2025 archive during the 2025
      // postseason, when `regularSeasonWeek` is null but all 18 weeks exist.
      //
      // Deriving the ceiling from the queried season's own calendar answers
      // all of these with one rule. What the ceiling is NOT is evidence: it
      // says what the query was allowed to admit, not what the source
      // contained, and it is never published as an evidence claim.
      const statsQueryCeiling = Number.isFinite(requestedWeek)
        ? requestedWeek
        : elapsedRegularSeasonWeeks(season);

      const position = ((req.query.position as string) || 'ALL').toUpperCase() as SupportedPosition;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 300);

      if (!['QB', 'RB', 'WR', 'TE', 'ALL'].includes(position)) {
        return res.status(400).json({ error: 'Invalid position. Use QB, RB, WR, TE, or ALL.' });
      }

      if (phase.configStatus === 'stale_calendar_config') {
        // A stale clock may still serve an explicitly requested, configured
        // historical archive. Any absent or unconfigured season (including the
        // invented next year carried by legacy numeric accessors) fails closed
        // before a cache/scoring read.
        const isConfiguredHistoricalSeason =
          hasExplicitSeason && phase.configuredSeasons.includes(requestedSeason);
        if (!isConfiguredHistoricalSeason) {
          const detail = hasExplicitSeason
            ? `Season ${requestedSeason} is not present in the configured NFL season calendar; current rankings are unavailable.`
            : phase.configNote ?? 'NFL season calendar is out of date.';
          return sendUnavailable(res, buildUnavailablePayload({
            season: hasExplicitSeason ? requestedSeason : null,
            status: SEASON_CONFIG_STALE_STATUS,
            detail,
            phase,
            position,
          }));
        }
      }

      if (statsQueryCeiling === null) {
        // No ceiling can be derived for this season without borrowing one from
        // a different season, which is the defect above. Say so rather than
        // serving evidence whose extent we cannot state.
        return sendUnavailable(res, buildUnavailablePayload({
          season: hasExplicitSeason ? season : null,
          status: SEASON_CONFIG_STALE_STATUS,
          detail:
            `Season ${season} is not present in the configured NFL season calendar, so the ` +
            'extent of its evidence cannot be established; rankings are unavailable.',
          phase,
            position,
          }),
        );
      }

      // The cache is keyed by the DECISION TARGET — which board is being built.
      //
      // Exactness follows the BOARD TARGET, not the query-string syntax. A
      // parameterless preseason, in-season, or postseason-forward request still
      // resolves to one specific decisionTargetWeek. Substituting a different
      // cached week there is the same wrong answer as substituting for an
      // explicit `asOfWeek`. Only a genuinely weekless historical request asks
      // for "whatever is newest" and may use the cache's latest-week behavior.
      const decisionTargetWeekIsExact = decisionTargetWeek !== undefined;
      const cache = await getGradesFromCache(
        season,
        decisionTargetWeek,
        position,
        limit,
        CACHE_VERSION,
        { exactWeek: decisionTargetWeekIsExact },
      );
      const scoringBuild = await buildRankingsScoringInputs({
        season,
        throughWeek: statsQueryCeiling,
        position,
        limit,
      });
      const scoringInputs = scoringBuild.players;
      const meaningfulInputCount = scoringInputs.filter(hasMeaningfulScoringInputs).length;
      const hasMeaningfulCoverage = meaningfulInputCount >= Math.max(10, Math.floor(scoringInputs.length * 0.6));
      // Populated whenever the FORGE-cache path below is reached instead of scoring rankings,
      // so the response can say *why* it is serving FORGE alpha instead of Expected/VORP —
      // rather than silently presenting one as the other.
      let scoringFallbackReason: string | null = null;

      if (hasMeaningfulCoverage) {
        const scoringRankings = await scoringService.getWeeklyRankings({
          leagueContext: toLeagueContextInput({
            season,
            week: decisionTargetWeek,
            scoringFormat: 'ppr',
            teams: 12,
          }),
          players: scoringInputs,
        });

        if (scoringRankings.ok) {
          const scoringAsOf = scoringRankings.data.asOf ?? new Date().toISOString();
          // Resolve producer identifiers to canonical public keys before any row
          // is emitted, for the scoring path as well as the FORGE path (#308).
          const scoringResolution = await resolveRankingIdentities(
            scoringRankings.data.items.map((row: any) => String(row.playerId ?? '')),
            'gsis',
          );
          const payload = {
            contractVersion: RANKINGS_V2_CONTRACT_VERSION,
            mode: 'weekly' as const,
            lens: 'lineup_decision' as const,
            horizon: 'week' as const,
            asOf: scoringAsOf,
            sourceStack: [
              {
                layer: 'promoted_artifact' as const,
                source: 'point-prediction-model /api/tiber/weekly/rankings',
                asOf: scoringAsOf,
                notes:
                  `season=${season}, decisionTargetWeek=${decisionTargetWeek ?? 'unknown'}, ` +
                  `statsQueryCeiling=${statsQueryCeiling}, ` +
                  `maxRepresentedWeek=${scoringBuild.maxRepresentedWeek ?? 'none'}, ` +
                  `position=${position}, meaningfulInputs=${meaningfulInputCount}/${scoringInputs.length}`,
              },
            ],
            items: scoringRankings.data.items.map((row: any) =>
              mapScoringRankingToRankingsV2Item(
                row,
                scoringAsOf,
                identityFor(scoringResolution.identities, String(row.playerId ?? '')),
              ),
            ),
            trust: {
              confidence: null,
              asOf: scoringAsOf,
              freshnessNote: 'Weekly rankings served from the scoring service.',
              sampleNote: null,
              stabilityNote: null,
            },
            seasonMeta: buildSeasonMeta({
              phase,
              boardSeason: season,
              boardWeek: decisionTargetWeek ?? null,
              boardWeekIsExplicit: weekIsExplicit,
              evidenceSeason: season,
              // The extent the SOURCE declares: the greatest weekly-stats week
              // actually aggregated into the admitted inputs, measured from
              // the rows themselves. Not the query ceiling — a filter says
              // what was asked for, not what the source contained — and not
              // the caller's target. Null when the source held nothing.
              evidenceWeek: scoringBuild.maxRepresentedWeek,
              evidenceProvenance: scoringBuild.maxRepresentedWeek === null
                ? 'source_extent_unknown'
                : 'source_max_represented_week',
              generatedAt: scoringAsOf,
              status: null,
              statusDetail: null,
            }),
            identityCoverage: scoringResolution.coverage,
          };

          const parsed = rankingsV2ResponseSchema.safeParse(payload);
          if (parsed.success) {
            return res.json(parsed.data);
          }

          // The scoring service replied ok:true but the payload it produced does not
          // satisfy our own response contract (e.g. a malformed asOf/score). This is
          // malformed upstream data, not a genuine empty result — it must be logged as
          // an error and must not be silently re-presented as FORGE alpha with no trace.
          scoringFallbackReason = 'invalid_scoring_payload';
          console.error(
            `[RankingsV2/Routes] scoring payload failed contract validation, falling back to FORGE cache: ${JSON.stringify(parsed.error.flatten())}`,
          );
        } else {
          scoringFallbackReason = scoringRankings.code;
          console.warn(`[RankingsV2/Routes] scoring fallback engaged (${scoringRankings.code}): ${scoringRankings.message}`);
        }
      } else {
        scoringFallbackReason = 'insufficient_coverage';
        console.info(
          `[RankingsV2/Routes] skipping scoring preference due to limited scoring inputs (${meaningfulInputCount}/${scoringInputs.length}).`,
        );
      }

      // Defense in depth: even an exact cache implementation can regress, and
      // a mock/adapter can return internally contradictory metadata. Rows for a
      // resolved target are admitted only when the cache both says it did not
      // substitute and declares that exact week. A weekless historical request
      // has no target to compare and is intentionally exempt.
      const cacheTargetMismatch =
        decisionTargetWeekIsExact &&
        cache.players.length > 0 &&
        (cache.weekSubstituted === true || cache.asOfWeek !== decisionTargetWeek);
      if (cacheTargetMismatch) {
        console.error(
          `[RankingsV2/Routes] refusing cache rows for resolved target ${decisionTargetWeek}: ` +
          `declaredAsOfWeek=${cache.asOfWeek ?? 'none'}, ` +
          `requestedAsOfWeek=${cache.requestedAsOfWeek ?? 'none'}, ` +
          `weekSubstituted=${cache.weekSubstituted === true}`,
        );
      }

      const admittedCachePlayers = cacheTargetMismatch ? [] : cache.players;
      const isCacheEmpty = admittedCachePlayers.length === 0;
      // A computation timestamp belongs to an admitted cohort. Even an
      // ordinary empty adapter result may carry the cache table's most recent
      // timestamp; without rows, that timestamp is not evidence for this
      // response and must not leak into trust/season metadata.
      const admittedComputedAt = isCacheEmpty ? null : cache.computedAt;
      const derivedAsOf = toIso(admittedComputedAt) ?? new Date().toISOString();
      const cacheMismatchDiagnostics = cacheTargetMismatch
        ? `FORGE cache rows were rejected for resolved target ${decisionTargetWeek}: ` +
          `declaredAsOfWeek=${cache.asOfWeek ?? 'none'}, ` +
          `requestedAsOfWeek=${cache.requestedAsOfWeek ?? 'none'}, ` +
          `weekSubstituted=${cache.weekSubstituted === true}`
        : null;

      // Reaching here on an explicit week means the scoring service did not
      // serve the exact week either — it was skipped, it failed, or its payload
      // did not satisfy the contract. With no exact-week evidence from either
      // source, the honest response is the typed unavailable one. Falling
      // through would render an empty board under the requested week's label,
      // which reads as "we looked and there is nothing" rather than "we could
      // not answer the question you asked".
      if (weekIsExplicit && isCacheEmpty) {
        return sendUnavailable(res, buildUnavailablePayload({
          season,
          status: EXACT_WEEK_UNAVAILABLE_STATUS,
          detail: cacheMismatchDiagnostics
            ? `No admissible evidence is available for ${season} week ${decisionTargetWeek}. ` +
              `${cacheMismatchDiagnostics}. ` +
              (scoringFallbackReason
                ? `The scoring service did not serve the target (${scoringFallbackReason}). `
                : '') +
              'A different week\'s rows are not substituted.'
            : `No evidence is available for ${season} week ${decisionTargetWeek}. ` +
              'FORGE grades are not computed for that exact week' +
              (scoringFallbackReason ? `, and the scoring service did not serve it (${scoringFallbackReason})` : '') +
              '. A different week\'s rows are not substituted.',
          phase,
          position,
        }));
      }

      // A substitution must never be labelled as the requested board. The exact
      // read above prevents it on the explicit path; this is the backstop for
      // any future caller that reaches here with substituted rows.
      // Identity resolution happens once for the whole cohort (two batched
      // queries) before any row is emitted.
      const resolution = await resolveRankingIdentities(
        admittedCachePlayers.map((row: any) => String(row.playerId ?? '')),
        'gsis',
      );
      // The production resolver treats an empty input as vacuously covered
      // (`coverageRatio: 1`). That is sensible for its internal API but not
      // for this public no-source envelope: no rows were admitted, so coverage
      // must be the explicit zero fact rather than a perfect-resolution claim.
      const identityCoverage = isCacheEmpty ? EMPTY_IDENTITY_COVERAGE : resolution.coverage;
      const items = admittedCachePlayers.map((row: any, idx: number) =>
        mapForgeCacheRowToRankingsV2Item(
          row,
          idx + 1,
          derivedAsOf,
          identityFor(resolution.identities, String(row.playerId ?? '')),
        ),
      );

      if (resolution.coverage.unresolved > 0) {
        console.warn(
          `[RankingsV2/Routes] identity coverage ${(resolution.coverage.coverageRatio * 100).toFixed(1)}% ` +
            `(${resolution.coverage.unresolved}/${resolution.coverage.total} unresolved): ` +
            `${JSON.stringify(resolution.coverage.byReason)}`,
        );
      }

      // `sourceStack` names the layers that PRODUCED admitted rows. An empty
      // cache produced none — the two entries below used to describe the
      // attempt anyway, which is exactly what `no_rankable_source` must not
      // do: the attempted-source diagnostics (scoringFallbackReason, the
      // decision target, the cache's declared week) still matter, but they
      // belong in `statusDetail`/`trust`, not in a source stack that claims a
      // layer answered.
      const emptyCacheDiagnostics =
        `scoringFallbackReason=${scoringFallbackReason ?? 'none'}; season=${season}, ` +
        `decisionTargetWeek=${decisionTargetWeek ?? 'unknown'}, position=${position}; ` +
        `cacheDeclaredAsOfWeek=${cache.asOfWeek ?? 'none'}, ` +
        `cacheRequestedAsOfWeek=${cache.requestedAsOfWeek ?? 'none'}, ` +
        `weekSubstituted=${cache.weekSubstituted === true}`;

      const payload = {
        contractVersion: RANKINGS_V2_CONTRACT_VERSION,
        mode: 'weekly' as const,
        lens: 'lineup_decision' as const,
        horizon: 'week' as const,
        asOf: derivedAsOf,
        sourceStack: isCacheEmpty
          ? []
          : [
              {
                layer: 'forge' as const,
                source: 'api/forge/tiers cache (forge_grade_cache)',
                asOf: toIso(admittedComputedAt),
                // score/value below are FORGE alpha/rawAlpha, NOT scoring-service Expected Points/VORP.
                // scoringFallbackReason records why this layer is serving instead of the scoring service,
                // so a real upstream failure is never indistinguishable from a genuinely empty ranking.
                notes: `scoringFallbackReason=${scoringFallbackReason ?? 'none'}; season=${season}, decisionTargetWeek=${decisionTargetWeek ?? 'unknown'}, cacheDeclaredAsOfWeek=${cache.asOfWeek ?? 'none'}, position=${position}`,
              },
              {
                layer: 'confidence_stability' as const,
                source: 'forge cache confidence + trajectory metadata',
                asOf: toIso(admittedComputedAt),
                notes: admittedComputedAt
                  ? 'Freshness derived from cache computedAt.'
                  : 'No cache timestamp; using current server time as asOf fallback.',
              },
            ],
        items,
        trust: {
          confidence: null,
          asOf: toIso(admittedComputedAt),
          freshnessNote: isCacheEmpty
            ? cacheMismatchDiagnostics
              ? 'FORGE cache rows were rejected because their week metadata did not match the resolved target.'
              : 'FORGE grades are not computed yet for this week/filter.'
            : admittedComputedAt
              ? 'Freshness based on forge cache computedAt.'
              : 'Cache computedAt unavailable; top-level asOf reflects server fallback time.',
          // Public, read-only copy only — operator mutation instructions (e.g. which
          // endpoint recomputes grades) belong in operator/admin diagnostics, not here.
          sampleNote: isCacheEmpty
            ? cacheMismatchDiagnostics ?? 'FORGE grades for this filter have not been computed yet. Please check back shortly.'
            : null,
          stabilityNote: isCacheEmpty ? CACHE_EMPTY_STATUS : null,
        },
        // `generatedAt` is the cache computation time; `evidenceSeason`/
        // `evidenceWeek` describe the football the scores are about. A 2026
        // computedAt over 2025 Week 18 rows surfaces as an archive view here
        // rather than as current-season evidence.
        seasonMeta: buildSeasonMeta({
          phase,
          boardSeason: season,
          boardWeek: decisionTargetWeek ?? null,
          boardWeekIsExplicit: weekIsExplicit,
          // `no_rankable_source` describes NOTHING about the football: an
          // empty cache is not a source that happens to omit its extent, it
          // is no source at all. Publishing the requested season alongside it
          // let a preseason request read as "2025 evidence" (or "Archive:
          // 2025") when zero rows were actually admitted. Explicit here, not
          // derived — the response schema below rejects a mismatch rather
          // than this function silently reconciling one.
          evidenceSeason: isCacheEmpty ? null : season,
          // The cache's OWN declared as-of week — the one value the serving
          // source states about its evidence extent. The caller's target must
          // not stand in for it: `?? asOfWeek` here previously let a requested
          // week be published as evidence the cache never declared.
          //
          // A declaration requires an ADMITTED result. `getGradesFromCache()`
          // echoes the requested week in `asOfWeek` even when it holds no rows,
          // so an empty cache would otherwise "declare" whatever week the
          // caller asked for — preseason Week 1 evidence, published alongside
          // `forge_cache_empty_uncomputed`. An empty cache is no source at
          // all: the extent is null with `no_rankable_source`. A non-empty
          // cache that still declares nothing is `source_extent_unknown`, and
          // null must never be rendered as "full season".
          evidenceWeek: isCacheEmpty ? null : cache.asOfWeek ?? null,
          evidenceProvenance: isCacheEmpty
            ? 'no_rankable_source'
            : cache.asOfWeek != null ? 'source_declared_as_of' : 'source_extent_unknown',
          generatedAt: isCacheEmpty ? null : toIso(admittedComputedAt),
          status: isCacheEmpty ? CACHE_EMPTY_STATUS : null,
          statusDetail: isCacheEmpty
            ? cacheMismatchDiagnostics
              ? `${cacheMismatchDiagnostics}. ${emptyCacheDiagnostics}.`
              : `FORGE grades for this filter have not been computed yet. ${emptyCacheDiagnostics}.`
            : null,
        }),
        identityCoverage,
      };

      const parsed = rankingsV2ResponseSchema.safeParse(payload);
      if (!parsed.success) {
        return res.status(500).json({
          error: 'Failed to build Rankings v2 weekly payload',
          details: parsed.error.flatten(),
        });
      }

      return res.json(parsed.data);
    } catch (error) {
      console.error('[RankingsV2/Routes] weekly endpoint error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

export default createRankingsV2Router;
