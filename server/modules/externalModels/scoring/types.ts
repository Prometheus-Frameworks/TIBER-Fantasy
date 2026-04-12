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
  verdict: nullableString,
  playerA: nullableString,
  playerB: nullableString,
  expectedPointsDelta: nullableNumber,
  vorpDelta: nullableNumber,
  recommendation: nullableString,
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
  | 'invalid_payload';

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
}

export interface ScoringPlayerInput {
  player_id: string;
  player_name?: string;
  team?: string | null;
  position?: string | null;
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

export type ScoringResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ScoringServiceErrorCode; message: string };
