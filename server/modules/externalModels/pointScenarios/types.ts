import { z } from 'zod';

const nullableFinite = z.number().finite().nullable().optional();
const nullableString = z.string().min(1).nullable().optional();

export const canonicalPointScenarioLabRowSchema = z.object({
  scenario_id: nullableString,
  scenario_name: z.string().min(1),
  player_id: nullableString,
  player_name: z.string().min(1),
  team: nullableString,
  position: nullableString,
  season: z.number().int().min(2000).max(2100).nullable().optional(),
  week: z.number().int().min(1).max(25).nullable().optional(),
  baseline_projection: nullableFinite,
  adjusted_projection: nullableFinite,
  delta: nullableFinite,
  confidence_band: nullableString,
  confidence_label: nullableString,
  scenario_type: nullableString,
  event_type: nullableString,
  notes: z.array(z.string().min(1)).default([]),
  explanation: nullableString,
  provenance: z.object({
    provider: nullableString,
    source_name: nullableString,
    source_type: nullableString,
    model_version: nullableString,
    generated_at: z.string().nullable().optional(),
    source_metadata: z.record(z.unknown()).default({}),
  }).default({ source_metadata: {} }),
  raw_fields: z.record(z.unknown()).default({}),
});

export const canonicalPointScenarioLabResponseSchema = z.object({
  season: z.number().int().min(2000).max(2100).nullable().optional(),
  available_seasons: z.array(z.number().int().min(2000).max(2100)).default([]),
  rows: z.array(canonicalPointScenarioLabRowSchema),
  source: z.object({
    provider: z.string().min(1),
    location: z.string().min(1).nullable().optional(),
    mode: z.enum(['api', 'artifact']),
  }),
});

export type CanonicalPointScenarioLabRow = z.infer<typeof canonicalPointScenarioLabRowSchema>;
export type CanonicalPointScenarioLabResponse = z.infer<typeof canonicalPointScenarioLabResponseSchema>;

export interface TiberPointScenarioLabRow {
  scenarioId: string | null;
  scenarioName: string;
  playerId: string | null;
  playerName: string;
  team: string | null;
  position: string | null;
  season: number | null;
  week: number | null;
  baselineProjection: number | null;
  adjustedProjection: number | null;
  delta: number | null;
  confidence: {
    band: string | null;
    label: string | null;
  };
  scenarioType: string | null;
  eventType: string | null;
  notes: string[];
  explanation: string | null;
  provenance: {
    provider: string | null;
    sourceName: string | null;
    sourceType: string | null;
    modelVersion: string | null;
    generatedAt: string | null;
    sourceMetadata: Record<string, unknown>;
  };
  rawFields: Record<string, unknown>;
  rawCanonical?: CanonicalPointScenarioLabRow;
}

export interface TiberPointScenarioLab {
  season: number | null;
  availableSeasons: number[];
  rows: TiberPointScenarioLabRow[];
  source: {
    provider: string;
    location: string | null;
    mode: 'api' | 'artifact';
  };
}

export type PointScenarioErrorCode =
  | 'config_error'
  | 'upstream_unavailable'
  | 'upstream_timeout'
  | 'invalid_payload'
  | 'not_found';

export class PointScenarioIntegrationError extends Error {
  readonly code: PointScenarioErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: PointScenarioErrorCode, message: string, status: number, cause?: unknown) {
    super(message);
    this.name = 'PointScenarioIntegrationError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface PointScenarioClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  labEndpointPath?: string;
  exportsPath?: string;
  enabled?: boolean;
}
