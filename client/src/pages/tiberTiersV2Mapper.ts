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

export interface RankingsV2WeeklyResponseShape {
  asOf: string;
  sourceStack: RankingsSourceStackItem[];
  items: unknown[];
  [key: string]: unknown;
}

// A 2xx HTTP response is not the same thing as a well-formed one. Without this check,
// `data?.items ?? []` at the call site would quietly turn a malformed body (`{}`, `null`,
// `{ items: null }`, etc.) into "0 players" — indistinguishable from a genuine empty
// ranking. Throwing here routes malformed successful responses into the query's error
// state instead. Only an explicit, well-formed `items: []` is a genuine empty result.
export function validateRankingsV2WeeklyResponse(payload: unknown): RankingsV2WeeklyResponseShape {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Rankings response was not a JSON object.');
  }

  const record = payload as Record<string, unknown>;

  if (!Array.isArray(record.items)) {
    throw new Error('Rankings response is missing a valid items array.');
  }

  if (!Array.isArray(record.sourceStack)) {
    throw new Error('Rankings response is missing a valid sourceStack array.');
  }

  if (typeof record.asOf !== 'string' || Number.isNaN(new Date(record.asOf).getTime())) {
    throw new Error('Rankings response is missing a valid asOf timestamp.');
  }

  return record as RankingsV2WeeklyResponseShape;
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
