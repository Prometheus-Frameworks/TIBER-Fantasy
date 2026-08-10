import { z } from 'zod';

export type Position = 'QB' | 'RB' | 'WR' | 'TE';

export interface TiersApiPlayer {
  playerId: string;
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

export interface RankingsV2Item {
  rank: number;
  playerId: string;
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

const rankingsItemSchema = z.object({
  rank: z.number(),
  playerId: z.string(),
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

  // The decision-target / evidence-cutoff split. Required, not optional: a
  // response that omits them must reach the error state rather than let the
  // page infer a cutoff from the target, which is the conflation #307 exists
  // to remove.
  decisionTargetSeason: z.number().nullable(),
  decisionTargetWeek: z.number().nullable(),
  decisionTargetProvenance: z.enum(['verified_schedule', 'anchor_derived']).nullable(),
  decisionTargetIsProvisional: z.boolean(),
  evidenceThroughSeason: z.number().nullable(),
  evidenceThroughWeek: z.number().nullable(),
  evidenceProvenance: z.enum([
    'verified_completed_week',
    'no_completed_week',
    'completion_unverified',
    'anchor_derived_cannot_verify_completion',
    'stale_calendar_config',
  ]),
  completionVerified: z.boolean(),
  completionCopy: z.string().nullable(),

  generatedAt: z.string().datetime().nullable(),
  isArchiveView: z.boolean(),
  status: z.string().nullable(),
  statusDetail: z.string().nullable(),
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
  const week = meta.evidenceWeek === null ? 'full season' : `through week ${meta.evidenceWeek}`;
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
  .passthrough();

export type RankingsV2WeeklyResponseShape = z.infer<typeof rankingsV2WeeklyResponseSchema>;

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

export function resolveTiersHeadline(layer: RankingsSourceView['layer']): string {
  if (layer === 'promoted_artifact') return 'Weekly Forecast Rankings';
  if (layer === 'forge') return 'Canonical FORGE Alpha ranks';
  return 'Weekly Rankings';
}

export type TiersViewState = 'loading' | 'error' | 'calendar_unavailable' | 'unavailable' | 'empty' | 'data';

// Single source of truth for which panel the page renders, so "truthful state" logic is
// unit-testable independent of JSX. Priority: a failed/loading request always wins over
// what would otherwise look like an empty result.
export function resolveTiersViewState(input: {
  isLoading: boolean;
  isError: boolean;
  isCalendarStale: boolean;
  isCacheUncomputed: boolean;
  playersCount: number;
}): TiersViewState {
  if (input.isLoading) return 'loading';
  if (input.isError) return 'error';
  if (input.isCalendarStale) return 'calendar_unavailable';
  if (input.isCacheUncomputed) return 'unavailable';
  if (input.playersCount === 0) return 'empty';
  return 'data';
}

export function mapRankingsV2ItemsToTiersPlayers(items: RankingsV2Item[]): TiersApiPlayer[] {
  return items.map((item, idx) => {
    const tier = asTier(item.tier);
    return {
      playerId: item.playerId,
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
