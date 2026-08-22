import { z } from 'zod';

const nullableNumber = z.number().finite().nullable().optional();
const nullableString = z.string().nullable().optional();

export const scoringWeeklyPlayerCardSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  team: nullableString,
  position: nullableString,
  expectedPoints: nullableNumber,
  vorp: nullableNumber,
  floor: nullableNumber,
  median: nullableNumber,
  ceiling: nullableNumber,
  confidence: nullableString,
  volatility: nullableString,
  fragility: nullableString,
  weeklyOutlook: nullableString,
  roleSummary: nullableString,
  valueSummary: nullableString,
  roleNotes: z.array(z.string()).default([]),
});

export const scoringWeeklyRankingItemSchema = z.object({
  rank: z.number().int().positive(),
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  team: nullableString,
  position: nullableString,
  expectedPoints: nullableNumber,
  vorp: nullableNumber,
  floor: nullableNumber,
  ceiling: nullableNumber,
  confidenceBand: nullableString,
  weeklyOutlook: nullableString,
});

export const scoringWeeklyRankingsSchema = z.object({
  asOf: z.string().datetime().nullable().optional(),
  items: z.array(scoringWeeklyRankingItemSchema),
});

export const scoringRosPlayerCardSchema = scoringWeeklyPlayerCardSchema.extend({
  horizon: z.literal('ros').optional(),
});

export const scoringWeeklyCompareSchema = z.object({
  asOf: z.string().datetime().nullable().optional(),
  view: z.object({
    verdict: nullableString,
    playerA: nullableString,
    playerB: nullableString,
    deltas: z.object({
      expectedPoints: nullableNumber,
      vorp: nullableNumber,
    }),
    recommendation: nullableString,
  }),
});

export type ScoringWeeklyPlayerCard = z.infer<typeof scoringWeeklyPlayerCardSchema>;
export type ScoringWeeklyRankings = z.infer<typeof scoringWeeklyRankingsSchema>;
export type ScoringRosPlayerCard = z.infer<typeof scoringRosPlayerCardSchema>;
export type ScoringWeeklyCompare = z.infer<typeof scoringWeeklyCompareSchema>;

export type ScoringServiceErrorCode =
  | 'config_error'
  | 'upstream_unavailable'
  | 'upstream_timeout'
  | 'upstream_error'
  | 'invalid_payload'
  // FFI-3 v1 seam states — deliberately distinct so callers can tell
  // "we could not build an honest contract request" (invalid_request),
  // "Forecast rejected the request" (upstream_rejected_request), and
  // "Forecast answered: no card exists" (weekly_card_unavailable) apart
  // from transport failures and malformed payloads.
  | 'invalid_request'
  | 'upstream_rejected_request'
  | 'weekly_card_unavailable';

export class ScoringServiceIntegrationError extends Error {
  readonly code: ScoringServiceErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: ScoringServiceErrorCode, message: string, status: number, cause?: unknown) {
    super(message);
    this.name = 'ScoringServiceIntegrationError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface ScoringServiceClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ScoringLeagueContextInput {
  season?: number;
  week?: number;
  scoringFormat?: string;
  teams?: number;
  /**
   * Starter slots for the v1 weekly contract's replacement context. The
   * adapter never fabricates this (AGENTS.md: explicit failure over implicit
   * defaults) — v1 weekly player-card calls fail closed with invalid_request
   * until the caller passes resolved teams and starters.
   */
  starters?: { QB: number; RB: number; WR: number; TE: number; FLEX?: number };
}

export interface ScoringPlayerInput {
  player_id: string;
  player_name?: string;
  team?: string | null;
  position?: string | null;
  games_sampled?: number | null;
  snap_share?: number | null;
  routes_pg?: number | null;
  targets_pg?: number | null;
  carries_pg?: number | null;
  target_share?: number | null;
  fantasy_points_ppr_pg?: number | null;
  volatility_index?: number | null;
}

export interface ScoringWeeklyPlayerCardRequest {
  leagueContext: ScoringLeagueContextInput & Record<string, unknown>;
  player: ScoringPlayerInput;
  remainingWeeks?: number;
}

export interface ScoringWeeklyRankingsRequest {
  leagueContext: ScoringLeagueContextInput & Record<string, unknown>;
  players: ScoringPlayerInput[];
}

export interface ScoringWeeklyCompareRequest {
  leagueContext: ScoringLeagueContextInput & Record<string, unknown>;
  playerA: ScoringPlayerInput;
  playerB: ScoringPlayerInput;
}

/** v1 envelope entry (warning or error) preserved with its structured details, when present. */
export interface ScoringContractIssue {
  code: string;
  message: string;
  details?: unknown;
}

/** Contract warning preserved with its structured details, when present. */
export type ScoringContractWarning = ScoringContractIssue;

export type ScoringResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ScoringServiceErrorCode;
      message: string;
      /**
       * v1 contract envelope warnings (e.g. STALE_SOURCE_WINDOW with its
       * source-window details) that accompanied a failure — preserved through
       * the service wrapper so API consumers see degraded-evidence context,
       * not just an error code.
       */
      warnings?: ScoringContractWarning[];
      /**
       * Structured v1 envelope errors (with their details) that accompanied a
       * contract-level failure — the machine-readable rejection/unavailability
       * context, preserved alongside the flattened code/message.
       */
      errors?: ScoringContractIssue[];
    };
