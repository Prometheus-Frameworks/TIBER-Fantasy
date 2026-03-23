import { z } from 'zod';

export const canonicalAgeCurveLabRowSchema = z.object({
  player_id: z.string().min(1).nullable().optional(),
  player_name: z.string().min(1),
  team: z.string().min(1).nullable().optional(),
  position: z.string().min(1).nullable().optional(),
  season: z.number().int().min(2000).max(2100).nullable().optional(),
  age: z.number().finite().min(18).max(50).nullable().optional(),
  career_year: z.number().int().min(0).max(30).nullable().optional(),
  peer_bucket: z.string().min(1).nullable().optional(),
  expected_ppg: z.number().finite().nullable().optional(),
  actual_ppg: z.number().finite().nullable().optional(),
  ppg_delta: z.number().finite().nullable().optional(),
  trajectory_label: z.string().min(1).nullable().optional(),
  age_curve_score: z.number().finite().nullable().optional(),
  provenance: z
    .object({
      provider: z.string().min(1).nullable().optional(),
      source_name: z.string().min(1).nullable().optional(),
      source_type: z.string().min(1).nullable().optional(),
      model_version: z.string().min(1).nullable().optional(),
      generated_at: z.string().nullable().optional(),
      notes: z.array(z.string().min(1)).default([]),
    })
    .default({ notes: [] }),
  raw_fields: z.record(z.unknown()).default({}),
});

export const canonicalAgeCurveLabResponseSchema = z.object({
  season: z.number().int().min(2000).max(2100).nullable().optional(),
  available_seasons: z.array(z.number().int().min(2000).max(2100)).default([]),
  rows: z.array(canonicalAgeCurveLabRowSchema),
  source: z.object({
    provider: z.string().min(1),
    location: z.string().min(1).nullable().optional(),
    mode: z.enum(['api', 'artifact']),
  }),
});

export type CanonicalAgeCurveLabRow = z.infer<typeof canonicalAgeCurveLabRowSchema>;
export type CanonicalAgeCurveLabResponse = z.infer<typeof canonicalAgeCurveLabResponseSchema>;

export interface TiberAgeCurveLabRow {
  playerId: string | null;
  playerName: string;
  team: string | null;
  position: string | null;
  season: number | null;
  age: number | null;
  careerYear: number | null;
  peerBucket: string | null;
  expectedPpg: number | null;
  actualPpg: number | null;
  ppgDelta: number | null;
  trajectoryLabel: string | null;
  ageCurveScore: number | null;
  provenance: {
    provider: string | null;
    sourceName: string | null;
    sourceType: string | null;
    modelVersion: string | null;
    generatedAt: string | null;
    notes: string[];
  };
  rawFields: Record<string, unknown>;
  rawCanonical?: CanonicalAgeCurveLabRow;
}

export interface TiberAgeCurveLab {
  season: number | null;
  availableSeasons: number[];
  rows: TiberAgeCurveLabRow[];
  source: {
    provider: string;
    location: string | null;
    mode: 'api' | 'artifact';
  };
}

export type AgeCurveErrorCode =
  | 'config_error'
  | 'upstream_unavailable'
  | 'upstream_timeout'
  | 'invalid_payload'
  | 'not_found';

export class AgeCurveIntegrationError extends Error {
  readonly code: AgeCurveErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: AgeCurveErrorCode, message: string, status: number, cause?: unknown) {
    super(message);
    this.name = 'AgeCurveIntegrationError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface AgeCurveClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  labEndpointPath?: string;
  exportsPath?: string;
  enabled?: boolean;
}
