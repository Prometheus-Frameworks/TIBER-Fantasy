import { z } from 'zod';

export type Position = 'QB' | 'RB' | 'WR' | 'TE';

/** Client-negotiated revision of the canonical Rankings v2 response. */
export const RANKINGS_V2_EXPECTED_CONTRACT_VERSION = 'v2-canonical-identity-2026-08-09' as const;

export interface TiersApiPlayer {
  /** Canonical key, or null when unresolved. Never a raw source id. */
  playerId: string | null;
  identity: RankingsV2ItemIdentity;
  playerName: string;
  position: Position;
  nflTeam?: string | null;
  rank: number;
  alpha: number;
  rawAlpha?: number | null;
  tier: 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  tierNumeric: number;
  subscores: {
    volume?: number | null;
    efficiency?: number | null;
    teamContext?: number | null;
    stability?: number | null;
    dynastyContext?: number | null;
  };
  trajectory?: 'rising' | 'flat' | 'declining' | null;
  confidence?: number | null;
  gamesPlayed?: number | null;
  footballLensIssues?: string[] | null;
  lensAdjustment?: number | null;
  productionStats?: {
    targets?: number | null;
    touches?: number | null;
  };
}

export type RankingsV2ItemIdentity =
  | {
      status: 'canonical';
      canonicalId: string;
      sourceId: string;
      sourceType: 'canonical';
      reason: null;
      linkable: true;
    }
  | {
      status: 'resolved';
      canonicalId: string;
      sourceId: string;
      sourceType: 'gsis';
      reason: null;
      linkable: true;
    }
  | {
      status: 'unresolved';
      canonicalId: null;
      sourceId: string;
      sourceType: 'canonical' | 'gsis' | 'unknown';
      reason: string;
      /** False → render the row but do not build a player deep link from it. */
      linkable: false;
    };

export interface RankingsV2Item {
  rank: number;
  /** Canonical key, or null when unresolved. Never a raw source id. */
  playerId: string | null;
  identity: RankingsV2ItemIdentity;
  playerName: string;
  position?: string | null;
  team?: string | null;
  tier?: string | null;
  score?: number | null;
  value?: number | null;
  explanation?: {
    pillarNotes?: Array<{ pillar: string; note?: string | null }> | null;
  } | null;
  trust?: {
    confidence?: number | null;
    sampleNote?: string | null;
    stabilityNote?: string | null;
  } | null;
  uiMeta?: {
    subscores?: {
      volume?: number | null;
      efficiency?: number | null;
      teamContext?: number | null;
      stability?: number | null;
    } | null;
    confidence?: number | null;
    gamesPlayed?: number | null;
    trajectory?: 'rising' | 'flat' | 'declining' | null;
    footballLensIssues?: string[] | null;
    lensAdjustment?: number | null;
  } | null;
}

function asTier(tier?: string | null): 'T1' | 'T2' | 'T3' | 'T4' | 'T5' {
  if (tier === 'T1' || tier === 'T2' || tier === 'T3' || tier === 'T4' || tier === 'T5') return tier;
  return 'T5';
}

export interface RankingsSourceStackItem {
  layer?: string | null;
}

export interface RankingsSourceView {
  layer: 'promoted_artifact' | 'forge' | 'unknown';
  expectedLabel: string;
  valueLabel: string;
  sourceNote: string;
}

// The API's `score`/`value` fields mean different things depending on which layer produced
// them: scoring-service rankings put Expected Points/VORP there, but the FORGE-cache fallback
// puts FORGE alpha/rawAlpha there instead. Rendering both under fixed "Expected"/"VORP" labels
// silently misrepresents a 0-100 alpha score as a points projection, so the column labels (and
// a visible source note) must track which layer actually produced the current items.
export function resolveRankingsSourceView(sourceStack: RankingsSourceStackItem[] | null | undefined): RankingsSourceView {
  const layers = new Set((sourceStack ?? []).map((item) => item.layer));

  if (layers.has('promoted_artifact')) {
    return {
      layer: 'promoted_artifact',
      expectedLabel: 'Expected',
      valueLabel: 'VORP',
      sourceNote: 'Weekly Forecast scoring',
    };
  }

  if (layers.has('forge')) {
    return {
      layer: 'forge',
      expectedLabel: 'FORGE Alpha',
      valueLabel: 'Raw Alpha',
      sourceNote: 'FORGE Alpha (weekly Forecast scoring unavailable)',
    };
  }

  return {
    layer: 'unknown',
    expectedLabel: 'Score',
    valueLabel: 'Value',
    sourceNote: 'Unknown source',
  };
}

const rankingsSourceStackItemSchema = z
  .object({
    layer: z.string().nullable().optional(),
  })
  .passthrough();

const rankingsPillarNoteSchema = z.object({
  pillar: z.string(),
  note: z.string().nullable().optional(),
});

// `getPillarNote` in TiberTiers.tsx dereferences `item.explanation.pillarNotes` without an
// optional-chain guard, so both must be validated as present (not merely typed as optional)
// or a malformed item crashes the render instead of failing at the boundary.
const rankingsItemExplanationSchema = z
  .object({
    placementSummary: z.string().nullable().optional(),
    pillarNotes: z.array(rankingsPillarNoteSchema),
  })
  .passthrough();

// `uiMeta` fields are only ever read through optional chaining in the page, so this stays
// nullable/optional — but its shape is still constrained when present.
const rankingsItemUiMetaSchema = z
  .object({
    subscores: z
      .object({
        volume: z.number().nullable().optional(),
        efficiency: z.number().nullable().optional(),
        teamContext: z.number().nullable().optional(),
        stability: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    confidence: z.number().nullable().optional(),
    gamesPlayed: z.number().nullable().optional(),
    trajectory: z.enum(['rising', 'flat', 'declining']).nullable().optional(),
    footballLensIssues: z.array(z.string()).nullable().optional(),
    lensAdjustment: z.number().nullable().optional(),
  })
  .nullable()
  .optional();

const rankingsItemIdentitySchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('canonical'),
    canonicalId: z.string().trim().min(1),
    sourceId: z.string().trim().min(1),
    sourceType: z.literal('canonical'),
    reason: z.null(),
    linkable: z.literal(true),
  }),
  z.object({
    status: z.literal('resolved'),
    canonicalId: z.string().trim().min(1),
    sourceId: z.string().trim().min(1),
    sourceType: z.literal('gsis'),
    reason: z.null(),
    linkable: z.literal(true),
  }),
  z.object({
    status: z.literal('unresolved'),
    canonicalId: z.null(),
    sourceId: z.string(),
    sourceType: z.enum(['canonical', 'gsis', 'unknown']),
    reason: z.string().min(1),
    linkable: z.literal(false),
  }),
]);

const rankingsItemSchema = z.object({
  rank: z.number(),
  playerId: z.string().nullable(),
  // The page decides whether to render a deep link from this, so a response
  // missing it must fail validation rather than let the UI guess (#308).
  identity: rankingsItemIdentitySchema,
  playerName: z.string(),
  position: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  tier: z.string().nullable().optional(),
  // `.toFixed(1)` is called on these through optional chaining, which only guards against
  // null/undefined — a wrong-typed truthy value (e.g. a string) would still throw.
  score: z.number().nullable().optional(),
  value: z.number().nullable().optional(),
  explanation: rankingsItemExplanationSchema,
  trust: z
    .object({
      confidence: z.number().nullable().optional(),
      sampleNote: z.string().nullable().optional(),
      stabilityNote: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  uiMeta: rankingsItemUiMetaSchema,
}).superRefine((item, ctx) => {
  if (item.identity.status === 'canonical' && item.identity.sourceId !== item.identity.canonicalId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['identity', 'sourceId'],
      message: 'Canonical identity requires sourceId to equal canonicalId.',
    });
  }

  if (item.identity.linkable) {
    if (item.playerId !== item.identity.canonicalId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['playerId'],
        message: 'Linkable ranking identity requires playerId to equal identity.canonicalId.',
      });
    }
    return;
  }

  if (item.playerId !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['playerId'],
      message: 'Unresolved ranking identity requires a null playerId.',
    });
  }
});

// Mirrors `rankingsV2SeasonMetaSchema` in server/contracts/rankingsV2.ts. The page
// dereferences these fields to decide what season/phase it is allowed to claim, so
// a response missing them must reach the error state rather than let the UI fall
// back to a guess — that guess is the #307 defect.
export const seasonMetaSchema = z.object({
  currentSeason: z.number(),
  forwardRankingSeason: z.number(),
  currentPhase: z.enum(['offseason', 'preseason', 'regular_season', 'postseason']),
  currentPhaseLabel: z.string(),
  currentRegularSeasonWeek: z.number().nullable(),
  targetSeason: z.number().nullable(),
  targetWeek: z.number().nullable(),
  targetLabel: z.string().nullable(),
  scheduleSource: z.enum(['explicit_schedule', 'anchor_derived']).nullable(),
  configStatus: z.enum(['ok', 'stale_calendar_config']),
  configNote: z.string().nullable(),
  evidenceSeason: z.number().nullable(),
  evidenceWeek: z.number().nullable(),

  // The decision-target / evidence split. Required, not optional: a response
  // that omits these must reach the error state rather than let the page infer
  // an evidence extent from the target — the conflation #307 exists to remove.
  //
  // `decisionTarget*` describes THE BOARD IN THIS RESPONSE. `phaseTarget*` is
  // the live league target, which is a different fact whenever the request
  // asked for anything but the current forward board.
  //
  // Provenance keeps its existing closed membership — it describes the schedule
  // behind the week, and an explicitly requested week rests on none, so it is
  // null there. Who chose the week is the separate optional
  // `decisionTargetOrigin`, optional precisely so a client written against the
  // pre-change schema still validates a response carrying it.
  decisionTargetSeason: z.number().nullable(),
  decisionTargetWeek: z.number().nullable(),
  decisionTargetProvenance: z.enum(['verified_schedule', 'anchor_derived']).nullable(),
  decisionTargetIsProvisional: z.boolean(),
  decisionTargetOrigin: z.enum(['explicit_request', 'phase_default']).nullable().optional(),
  phaseTargetSeason: z.number().nullable(),
  phaseTargetWeek: z.number().nullable(),
  phaseTargetProvenance: z.enum(['verified_schedule', 'anchor_derived']).nullable(),
  phaseTargetIsProvisional: z.boolean(),
  evidenceThroughSeason: z.number().nullable(),
  evidenceThroughWeek: z.number().nullable(),
  evidenceProvenance: z.enum([
    'source_declared_as_of',
    'source_max_represented_week',
    'source_extent_unknown',
    'no_rankable_source',
  ]),
  completionVerified: z.boolean(),
  finalizedThroughWeek: z.number().nullable(),
  completionCopy: z.string().nullable(),

  generatedAt: z.string().datetime().nullable(),
  isArchiveView: z.boolean(),
  status: z.string().nullable(),
  statusDetail: z.string().nullable(),
}).superRefine((meta, ctx) => {
  // Mirrors the invariant enforced in `rankingsV2SeasonMetaSchema` in
  // server/contracts/rankingsV2.ts. `no_rankable_source` means nothing was
  // admitted, so a response contradicting that (an evidence season/week/
  // timestamp, or an archive flag, alongside it) fails HERE rather than being
  // silently trusted and rendered as "2025 evidence" or an archive banner
  // for a board this response never returned. `source_extent_unknown` is a
  // different, nonempty-source claim and is deliberately not covered.
  if (meta.evidenceProvenance !== 'no_rankable_source') return;

  const mustBeNull: Array<[string, unknown]> = [
    ['evidenceSeason', meta.evidenceSeason],
    ['evidenceWeek', meta.evidenceWeek],
    ['evidenceThroughSeason', meta.evidenceThroughSeason],
    ['evidenceThroughWeek', meta.evidenceThroughWeek],
    ['generatedAt', meta.generatedAt],
  ];
  for (const [field, value] of mustBeNull) {
    if (value !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `evidenceProvenance "no_rankable_source" requires ${field} to be null — nothing was admitted, so there is no evidence to describe.`,
      });
    }
  }

  if (meta.isArchiveView !== false) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['isArchiveView'],
      message: 'evidenceProvenance "no_rankable_source" requires isArchiveView to be false — with no evidence season there is no season to compare against the forward board.',
    });
  }
});
export type RankingsSeasonMeta = z.infer<typeof seasonMetaSchema>;

/**
 * Header line describing *where the league is*, independent of what evidence the
 * rows carry. On 2026-08-09 this reads "2026 · Preseason — Target: Week 1".
 */
export function resolveSeasonPhaseHeadline(meta: RankingsSeasonMeta): string {
  if (meta.configStatus === 'stale_calendar_config') return 'Season state unavailable';
  return meta.targetLabel ? `${meta.currentPhaseLabel} — ${meta.targetLabel}` : meta.currentPhaseLabel;
}

/**
 * Description of *what evidence the rows are*, kept separate from the phase line
 * and from the computation timestamp.
 */
export function resolveEvidenceLine(meta: RankingsSeasonMeta): string {
  if (meta.evidenceSeason === null) return 'No ranking evidence available.';
  // A null week means the source could not state its extent — the fail-to-null
  // case the provenance fields exist for. Rendering it as "full season" turned
  // an explicit unknown into the strongest possible completeness claim.
  const week = meta.evidenceWeek === null ? 'extent not stated' : `through week ${meta.evidenceWeek}`;
  const scope = `${meta.evidenceSeason} evidence, ${week}`;
  return meta.isArchiveView ? `Archive: ${scope}` : scope;
}

/** Banner copy when the rows are not from the season the league is currently in. */
export function resolveArchiveNotice(meta: RankingsSeasonMeta): string | null {
  if (meta.configStatus === 'stale_calendar_config') {
    return meta.configNote ?? 'The NFL season calendar is out of date; season state cannot be determined.';
  }
  if (!meta.isArchiveView) return null;
  return (
    meta.statusDetail ??
    `Showing ${meta.evidenceSeason} evidence while the league is in ${meta.currentPhaseLabel}.`
  );
}

const rankingsV2WeeklyResponseSchema = z
  .object({
    contractVersion: z.literal(RANKINGS_V2_EXPECTED_CONTRACT_VERSION),
    // Matches the canonical Rankings v2 contract's `z.string().datetime()` (see
    // server/contracts/rankingsV2.ts) exactly — same method, same zod version — so the
    // client rejects anything the server contract would: date-only strings, non-ISO
    // values, and calendar-invalid dates (e.g. "2026-02-30"), not just whatever
    // `new Date(...)` happens to coerce.
    asOf: z.string().datetime(),
    sourceStack: z.array(rankingsSourceStackItemSchema),
    trust: z
      .object({
        sampleNote: z.string().nullable().optional(),
        stabilityNote: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    items: z.array(rankingsItemSchema),
    seasonMeta: seasonMetaSchema,
  })
  .passthrough()
  .superRefine((response, ctx) => {
    const seenRanks = new Map<number, number>();
    response.items.forEach((item, index) => {
      const firstIndex = seenRanks.get(item.rank);
      if (firstIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'rank'],
          message: `Duplicate ranking rank (first seen at items[${firstIndex}]).`,
        });
        return;
      }
      seenRanks.set(item.rank, index);
    });

    // Mirrors the server's response-level check: `no_rankable_source` means no
    // layer produced admitted rows, so a nonempty sourceStack alongside it is
    // contradictory and must not be trusted into a "Canonical FORGE Alpha
    // ranks" headline for a response that answered nothing.
    if (response.seasonMeta.evidenceProvenance === 'no_rankable_source' && response.sourceStack.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceStack'],
        message: 'evidenceProvenance "no_rankable_source" requires an empty sourceStack — no layer produced admitted rows.',
      });
    }
  });

export type RankingsV2WeeklyResponseShape = z.infer<typeof rankingsV2WeeklyResponseSchema>;

/**
 * Independent render-time link guard. Even if a future caller bypasses the
 * response validator, contradictory identity fields cannot produce
 * `/player/null` or a link to a mismatched canonical key.
 */
export function getLinkablePlayerId(item: Pick<RankingsV2Item, 'playerId' | 'identity'>): string | null {
  const { identity, playerId } = item;
  if (!identity.linkable) return null;
  if (identity.status !== 'canonical' && identity.status !== 'resolved') return null;
  if (!playerId || playerId !== identity.canonicalId) return null;
  return playerId;
}

/** Deterministic composite key; the response validator enforces unique ranks. */
export function buildRankingRowKey(item: Pick<RankingsV2Item, 'rank' | 'position' | 'identity'>): string {
  return [
    item.identity.sourceType,
    item.identity.sourceId,
    String(item.rank),
    item.position ?? 'unknown-position',
  ].join('|');
}

// A 2xx HTTP response is not the same thing as a well-formed one. Without this check,
// `data?.items ?? []` at the call site would quietly turn a malformed body (`{}`, `null`,
// `{ items: null }`, a `sourceStack` entry of `null`, an item missing `explanation`, etc.)
// into "0 players" — indistinguishable from a genuine empty ranking, or worse, a runtime
// crash further down the render tree. This validates every field the page actually
// dereferences or formats, not just the top-level array shape, and throws for anything
// unsafe. Only an explicit, well-formed `items: []` is a genuine empty result.
export function validateRankingsV2WeeklyResponse(payload: unknown): RankingsV2WeeklyResponseShape {
  const result = rankingsV2WeeklyResponseSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Rankings response failed validation: ${result.error.message}`);
  }
  return result.data;
}

// Neutral until a response actually tells us which layer produced the rows — the page
// must not assert "FORGE Alpha" while data is still loading or a request has failed.
export const TIERS_LOADING_LABEL = 'Loading rankings...';

// Never render a raw backend/fetch exception message to the user — it may contain
// internal details, and a generic error state must not be confused with a genuine
// empty result. The technical detail still belongs in the console for debugging.
export const TIERS_GENERIC_ERROR_MESSAGE =
  'Unable to load rankings right now. This is an error, not an empty result — please retry or check back shortly.';

export const TIERS_STALE_CALENDAR_MESSAGE =
  'The NFL season calendar is out of date, so TIBER cannot determine which season or week these rankings should represent. No rankings were loaded.';

/**
 * The server's status for "you asked for a specific week and no admitted source
 * can answer for it".
 *
 * Kept as a named constant on this side of the wire because the string is a
 * protocol value, not display copy: the server publishes it as
 * `seasonMeta.status`, and a typo here would silently reopen the defect it
 * exists to close. `server/routes/rankingsV2Routes.ts` exports the same literal
 * as `EXACT_WEEK_UNAVAILABLE_STATUS`, and the suite pins the two together.
 */
export const EXACT_WEEK_UNAVAILABLE_STATUS = 'exact_week_evidence_unavailable';

/**
 * Distinct from both the uncomputed-cache copy and the empty-filter copy.
 *
 * "No players match this filter yet" says the question was answered and the
 * answer was none. "Not computed yet, check back shortly" says it will be
 * answered soon. Neither is true here: the requested week has no governed
 * evidence, and the server deliberately refused to substitute another week's
 * rows for it, so the honest statement is that this board could not be produced.
 */
export const TIERS_EXACT_WEEK_UNAVAILABLE_MESSAGE =
  'Governed evidence for the requested week is unavailable, so this board could not be produced. ' +
  'TIBER does not substitute another week\'s rankings in its place. Try a different week, or check back once that week has been graded.';

export function resolveTiersHeadline(layer: RankingsSourceView['layer']): string {
  if (layer === 'promoted_artifact') return 'Weekly Forecast Rankings';
  if (layer === 'forge') return 'Canonical FORGE Alpha ranks';
  return 'Weekly Rankings';
}

export type TiersViewState =
  | 'loading'
  | 'error'
  | 'calendar_unavailable'
  | 'exact_week_unavailable'
  | 'unavailable'
  | 'empty'
  | 'data';

// Single source of truth for which panel the page renders, so "truthful state" logic is
// unit-testable independent of JSX. Priority: a failed/loading request always wins over
// what would otherwise look like an empty result.
export function resolveTiersViewState(input: {
  isLoading: boolean;
  isError: boolean;
  isCalendarStale: boolean;
  isExactWeekUnavailable?: boolean;
  isCacheUncomputed: boolean;
  playersCount: number;
}): TiersViewState {
  if (input.isLoading) return 'loading';
  if (input.isError) return 'error';
  if (input.isCalendarStale) return 'calendar_unavailable';
  // Before the cache/empty signals. The server returns zero items with this
  // status, so falling through to `empty` told the user "no players match this
  // filter" when the truth is that the board could not be produced at all —
  // the fail-closed response reading, to a user, as a successful empty one.
  if (input.isExactWeekUnavailable) return 'exact_week_unavailable';
  if (input.isCacheUncomputed) return 'unavailable';
  if (input.playersCount === 0) return 'empty';
  return 'data';
}

/**
 * Read the exact-week-unavailable signal off a response's seasonMeta.
 *
 * A helper rather than an inline comparison at the call site, so the container
 * cannot drift from the protocol value or forget the check the way it did.
 */
export function isExactWeekUnavailable(
  seasonMeta: { status?: string | null } | null | undefined,
): boolean {
  return seasonMeta?.status === EXACT_WEEK_UNAVAILABLE_STATUS;
}

export function mapRankingsV2ItemsToTiersPlayers(items: RankingsV2Item[]): TiersApiPlayer[] {
  return items.map((item, idx) => {
    const tier = asTier(item.tier);
    return {
      playerId: item.playerId,
      identity: item.identity,
      playerName: item.playerName,
      position: (item.position as Position) || 'WR',
      nflTeam: item.team ?? null,
      rank: item.rank ?? idx + 1,
      alpha: item.score ?? 0,
      rawAlpha: item.value ?? null,
      tier,
      tierNumeric: Number(tier.slice(1)),
      subscores: {
        volume: item.uiMeta?.subscores?.volume ?? null,
        efficiency: item.uiMeta?.subscores?.efficiency ?? null,
        teamContext: item.uiMeta?.subscores?.teamContext ?? null,
        stability: item.uiMeta?.subscores?.stability ?? null,
      },
      trajectory: item.uiMeta?.trajectory ?? null,
      confidence: item.uiMeta?.confidence ?? item.trust?.confidence ?? null,
      gamesPlayed: item.uiMeta?.gamesPlayed ?? null,
      footballLensIssues: item.uiMeta?.footballLensIssues ?? [],
      lensAdjustment: item.uiMeta?.lensAdjustment ?? null,
      productionStats: {},
    };
  });
}
