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

const rankingsV2WeeklyResponseSchema = z
  .object({
    asOf: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: 'asOf must be a valid timestamp',
    }),
    sourceStack: z.array(rankingsSourceStackItemSchema),
    trust: z
      .object({
        sampleNote: z.string().nullable().optional(),
        stabilityNote: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    items: z.array(rankingsItemSchema),
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

export function resolveTiersHeadline(layer: RankingsSourceView['layer']): string {
  if (layer === 'promoted_artifact') return 'Weekly Forecast Rankings';
  if (layer === 'forge') return 'Canonical FORGE Alpha ranks';
  return 'Weekly Rankings';
}

export type TiersViewState = 'loading' | 'error' | 'unavailable' | 'empty' | 'data';

// Single source of truth for which panel the page renders, so "truthful state" logic is
// unit-testable independent of JSX. Priority: a failed/loading request always wins over
// what would otherwise look like an empty result.
export function resolveTiersViewState(input: {
  isLoading: boolean;
  isError: boolean;
  isCacheUncomputed: boolean;
  playersCount: number;
}): TiersViewState {
  if (input.isLoading) return 'loading';
  if (input.isError) return 'error';
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
