import { z } from 'zod';

export const wrBestRecipeSummarySchema = z
  .object({
    best_recipe_name: z.string().min(1).optional(),
    recipe_name: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    season: z.number().int().min(2000).max(2100).optional(),
    generated_at: z.string().optional(),
    model_version: z.string().optional(),
    validation_score: z.number().finite().optional(),
    win_rate: z.number().finite().optional(),
    hit_rate: z.number().finite().optional(),
    candidate_count: z.number().int().nonnegative().optional(),
    summary: z.string().optional(),
    notes: z.array(z.string()).optional(),
  })
  .passthrough();

export type CanonicalWrBestRecipeSummary = z.infer<typeof wrBestRecipeSummarySchema>;

export interface CanonicalSignalValidationExports {
  season: number;
  availableSeasons: number[];
  playerSignalCardsCsv: string;
  bestRecipeSummary: unknown;
}

export interface SignalValidationComponentSignals {
  usage: number | null;
  efficiency: number | null;
  development: number | null;
  stability: number | null;
  cohort: number | null;
  role: number | null;
  penalty: number | null;
}

export interface TiberWrBreakoutSignalRow {
  candidateRank: number | null;
  finalSignalScore: number | null;
  playerName: string;
  playerId: string | null;
  team: string | null;
  season: number | null;
  bestRecipeName: string | null;
  breakoutLabelDefault: string | null;
  breakoutContext: string | null;
  components: SignalValidationComponentSignals;
  rawFields: Record<string, string | null>;
}

export interface TiberWrBestRecipeSummary {
  bestRecipeName: string;
  season: number | null;
  validationScore: number | null;
  winRate: number | null;
  hitRate: number | null;
  candidateCount: number | null;
  summary: string | null;
  generatedAt: string | null;
  modelVersion: string | null;
  rawCanonical?: CanonicalWrBestRecipeSummary;
}

export interface TiberWrBreakoutLab {
  season: number;
  availableSeasons: number[];
  rows: TiberWrBreakoutSignalRow[];
  bestRecipeSummary: TiberWrBestRecipeSummary;
  source: {
    provider: 'signal-validation-model';
    exportDirectory: string;
  };
}

export type SignalValidationErrorCode =
  | 'config_error'
  | 'not_found'
  | 'invalid_payload'
  | 'malformed_export'
  | 'upstream_unavailable';

export class SignalValidationIntegrationError extends Error {
  readonly code: SignalValidationErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: SignalValidationErrorCode, message: string, status: number, cause?: unknown) {
    super(message);
    this.name = 'SignalValidationIntegrationError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface SignalValidationClientConfig {
  exportsDir?: string;
  enabled?: boolean;
}
