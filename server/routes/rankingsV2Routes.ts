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
import { resolveSeasonPhase, SeasonPhaseInfo } from '@shared/weekDetection';

type SupportedPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'ALL';
const CACHE_EMPTY_STATUS = 'forge_cache_empty_uncomputed';
export const SEASON_CONFIG_STALE_STATUS = 'season_calendar_config_stale';
/** Serving rows from a season other than the one the league is currently in. */
export const ARCHIVE_SEASON_STATUS = 'archive_season_not_current';

/**
 * Phase/freshness envelope attached to every weekly rankings response.
 *
 * `generatedAt` is when the score was computed; `evidenceSeason`/`evidenceWeek`
 * describe the football evidence behind it. Keeping them apart is the point of
 * Fantasy #307 — a 2026 computation timestamp over 2025 Week 18 evidence must
 * not read as current-season evidence.
 */
function buildSeasonMeta(input: {
  phase: SeasonPhaseInfo;
  evidenceSeason: number | null;
  evidenceWeek: number | null;
  generatedAt: string | null;
  status: string | null;
  statusDetail: string | null;
}) {
  // The season the league is *in* and the season the forward board is *about*
  // are different facts. During the 2025 postseason the phase season is 2025
  // while the forward board targets 2026, so archive status must be computed
  // against the board's target season — otherwise a valid 2026 Week 1 board
  // would be mislabelled as a 2025 archive.
  const forwardRankingSeason = input.phase.targetSeason ?? input.phase.season;
  const isArchive =
    input.evidenceSeason !== null &&
    input.phase.configStatus === 'ok' &&
    input.evidenceSeason !== forwardRankingSeason;

  return {
    currentSeason: input.phase.season,
    forwardRankingSeason,
    currentPhase: input.phase.phase,
    currentPhaseLabel: input.phase.seasonPhaseLabel,
    currentRegularSeasonWeek: input.phase.regularSeasonWeek,
    targetSeason: input.phase.targetSeason,
    targetWeek: input.phase.targetWeek,
    targetLabel: input.phase.targetLabel,
    scheduleSource: input.phase.scheduleSource,
    configStatus: input.phase.configStatus,
    configNote: input.phase.configNote,

    // Evidence vs computation — deliberately separate fields.
    evidenceSeason: input.evidenceSeason,
    evidenceWeek: input.evidenceWeek,
    generatedAt: input.generatedAt,
    isArchiveView: isArchive,
    status: input.status ?? (isArchive ? ARCHIVE_SEASON_STATUS : null),
    statusDetail:
      input.statusDetail ??
      (isArchive
        ? `Showing ${input.evidenceSeason} evidence while the forward board targets ${forwardRankingSeason} (${input.phase.seasonPhaseLabel}).`
        : null),
  };
}

/** Fail-closed payload used when no rankable state can be resolved. */
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
      evidenceSeason: input.season,
      evidenceWeek: null,
      generatedAt: null,
      status: input.status,
      statusDetail: input.detail,
    }),
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

export function mapForgeCacheRowToRankingsV2Item(row: any, rank: number, asOfIso: string): RankingsV2Item {
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
    playerId: String(row.playerId ?? ''),
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

function mapScoringRankingToRankingsV2Item(row: any, asOfIso: string): RankingsV2Item {
  const confidenceBand = typeof row.confidenceBand === 'string' ? row.confidenceBand : null;
  const weeklyOutlook = typeof row.weeklyOutlook === 'string' ? row.weeklyOutlook : null;
  const floor = toNumberOrNull(row.floor);
  const ceiling = toNumberOrNull(row.ceiling);

  return {
    rank: Number(row.rank),
    playerId: String(row.playerId ?? ''),
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
      const requestedSeason = parseInt(req.query.season as string, 10);
      const hasExplicitSeason = Number.isFinite(requestedSeason);
      // Outside the regular season the live weekly board is about the forward
      // target, not necessarily the phase-owning season. During the 2025
      // postseason this correctly defaults a parameterless request to 2026.
      const season = hasExplicitSeason ? requestedSeason : phase.targetSeason ?? phase.season;

      const asOfWeekParam = req.query.asOfWeek as string | undefined;
      const requestedWeek = asOfWeekParam ? parseInt(asOfWeekParam, 10) : NaN;
      const asOfWeek = Number.isFinite(requestedWeek)
        ? requestedWeek
        : season === phase.season
          ? phase.regularSeasonWeek ?? undefined
          : undefined;

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
          return res.json(
            buildUnavailablePayload({
              season: null,
              status: SEASON_CONFIG_STALE_STATUS,
              detail,
              phase,
              position,
            }),
          );
        }
      }

      const cache = await getGradesFromCache(season, asOfWeek, position, limit, CACHE_VERSION);
      const scoringInputs = await buildRankingsScoringInputs({
        season,
        // No week filter means "everything recorded for this season so far",
        // which is correct pre-Week-1 (nothing) and mid-season (weeks to date).
        throughWeek: asOfWeek ?? phase.regularSeasonWeek ?? 0,
        position,
        limit,
      });
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
            week: asOfWeek,
            scoringFormat: 'ppr',
            teams: 12,
          }),
          players: scoringInputs,
        });

        if (scoringRankings.ok) {
          const scoringAsOf = scoringRankings.data.asOf ?? new Date().toISOString();
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
                notes: `season=${season}, asOfWeek=${asOfWeek ?? 'unknown'}, position=${position}, meaningfulInputs=${meaningfulInputCount}/${scoringInputs.length}`,
              },
            ],
            items: scoringRankings.data.items.map((row) => mapScoringRankingToRankingsV2Item(row, scoringAsOf)),
            trust: {
              confidence: null,
              asOf: scoringAsOf,
              freshnessNote: 'Weekly rankings served from the scoring service.',
              sampleNote: null,
              stabilityNote: null,
            },
            seasonMeta: buildSeasonMeta({
              phase,
              evidenceSeason: season,
              evidenceWeek: asOfWeek ?? null,
              generatedAt: scoringAsOf,
              status: null,
              statusDetail: null,
            }),
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

      const derivedAsOf = toIso(cache.computedAt) ?? new Date().toISOString();
      const isCacheEmpty = cache.players.length === 0;

      const items = cache.players.map((row: any, idx: number) => mapForgeCacheRowToRankingsV2Item(row, idx + 1, derivedAsOf));

      const payload = {
        contractVersion: RANKINGS_V2_CONTRACT_VERSION,
        mode: 'weekly' as const,
        lens: 'lineup_decision' as const,
        horizon: 'week' as const,
        asOf: derivedAsOf,
        sourceStack: [
          {
            layer: 'forge' as const,
            source: 'api/forge/tiers cache (forge_grade_cache)',
            asOf: toIso(cache.computedAt),
            // score/value below are FORGE alpha/rawAlpha, NOT scoring-service Expected Points/VORP.
            // scoringFallbackReason records why this layer is serving instead of the scoring service,
            // so a real upstream failure is never indistinguishable from a genuinely empty ranking.
            notes: isCacheEmpty
              ? `status=${CACHE_EMPTY_STATUS}; scoringFallbackReason=${scoringFallbackReason ?? 'none'}; season=${season}, asOfWeek=${cache.asOfWeek ?? asOfWeek ?? 'unknown'}, position=${position}`
              : `scoringFallbackReason=${scoringFallbackReason ?? 'none'}; season=${season}, asOfWeek=${cache.asOfWeek ?? asOfWeek ?? 'unknown'}, position=${position}`,
          },
          {
            layer: 'confidence_stability' as const,
            source: 'forge cache confidence + trajectory metadata',
            asOf: toIso(cache.computedAt),
            notes: isCacheEmpty
              ? 'FORGE grades not yet computed for this filter.'
              : cache.computedAt
                ? 'Freshness derived from cache computedAt.'
                : 'No cache timestamp; using current server time as asOf fallback.',
          },
        ],
        items,
        trust: {
          confidence: null,
          asOf: toIso(cache.computedAt),
          freshnessNote: isCacheEmpty
            ? 'FORGE grades are not computed yet for this week/filter.'
            : cache.computedAt
              ? 'Freshness based on forge cache computedAt.'
              : 'Cache computedAt unavailable; top-level asOf reflects server fallback time.',
          // Public, read-only copy only — operator mutation instructions (e.g. which
          // endpoint recomputes grades) belong in operator/admin diagnostics, not here.
          sampleNote: isCacheEmpty ? 'FORGE grades for this filter have not been computed yet. Please check back shortly.' : null,
          stabilityNote: isCacheEmpty ? CACHE_EMPTY_STATUS : null,
        },
        // `generatedAt` is the cache computation time; `evidenceSeason`/
        // `evidenceWeek` describe the football the scores are about. A 2026
        // computedAt over 2025 Week 18 rows surfaces as an archive view here
        // rather than as current-season evidence.
        seasonMeta: buildSeasonMeta({
          phase,
          evidenceSeason: season,
          evidenceWeek: cache.asOfWeek ?? asOfWeek ?? null,
          generatedAt: toIso(cache.computedAt),
          status: isCacheEmpty ? CACHE_EMPTY_STATUS : null,
          statusDetail: isCacheEmpty
            ? 'FORGE grades for this filter have not been computed yet.'
            : null,
        }),
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
