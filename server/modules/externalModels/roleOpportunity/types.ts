import { z } from 'zod';

const canonicalShareSchema = z.number().finite().min(0).max(100);
const canonicalNullableShareSchema = canonicalShareSchema.nullable().optional();

export const roleOpportunityResponseSchema = z.object({
  player_id: z.string().min(1),
  season: z.number().int().min(2000).max(2100),
  week: z.number().int().min(1).max(25),
  position: z.string().min(1),
  team: z.string().min(1),
  primary_role: z.string().min(1),
  role_tags: z.array(z.string().min(1)).default([]),
  opportunity_tier: z.string().min(1),
  confidence_score: z.number().min(0).max(1),
  metrics: z.object({
    snap_share: canonicalShareSchema,
    route_share: canonicalShareSchema,
    target_share: canonicalShareSchema,
    usage_rate: canonicalShareSchema,
    weighted_opportunity_index: z.number().finite().min(0),
  }),
  insights: z.array(z.string().min(1)).default([]),
  model_version: z.string().min(1),
  generated_at: z.string().datetime(),
});

export const canonicalRoleOpportunityLabRowSchema = z.object({
  player_id: z.string().min(1),
  player_name: z.string().min(1),
  team: z.string().min(1),
  position: z.string().min(1),
  season: z.number().int().min(2000).max(2100),
  week: z.number().int().min(1).max(25).nullable().optional(),
  season_scope_marker: z.string().min(1).nullable().optional(),
  primary_role: z.string().min(1),
  role_tags: z.array(z.string().min(1)).default([]),
  route_participation: canonicalNullableShareSchema,
  target_share: canonicalNullableShareSchema,
  air_yard_share: canonicalNullableShareSchema,
  snap_share: canonicalNullableShareSchema,
  usage_rate: canonicalNullableShareSchema,
  confidence_score: z.number().min(0).max(1).nullable().optional(),
  confidence_tier: z.string().min(1).nullable().optional(),
  source_name: z.string().min(1).nullable().optional(),
  source_type: z.string().min(1).nullable().optional(),
  model_version: z.string().min(1).nullable().optional(),
  generated_at: z.string().datetime().nullable().optional(),
  insights: z.array(z.string().min(1)).default([]),
  raw_fields: z.record(z.unknown()).default({}),
});

export const canonicalRoleOpportunityLabResponseSchema = z.object({
  season: z.number().int().min(2000).max(2100).nullable().optional(),
  week: z.number().int().min(1).max(25).nullable().optional(),
  season_scope_marker: z.string().min(1).nullable().optional(),
  available_seasons: z.array(z.number().int().min(2000).max(2100)).default([]),
  rows: z.array(canonicalRoleOpportunityLabRowSchema),
  source: z.object({
    provider: z.string().min(1),
    location: z.string().min(1).nullable().optional(),
    mode: z.enum(['api', 'artifact']),
  }),
});

export type CanonicalRoleOpportunityResponse = z.infer<typeof roleOpportunityResponseSchema>;
export type CanonicalRoleOpportunityLabRow = z.infer<typeof canonicalRoleOpportunityLabRowSchema>;
export type CanonicalRoleOpportunityLabResponse = z.infer<typeof canonicalRoleOpportunityLabResponseSchema>;

export interface TiberRoleOpportunityInsight {
  playerId: string;
  season: number;
  week: number;
  position: string;
  team: string;
  primaryRole: string;
  roleTags: string[];
  usage: {
    snapShare: number;
    routeShare: number;
    targetShare: number;
    usageRate: number;
  };
  opportunity: {
    tier: string;
    weightedOpportunityIndex: number;
    insights: string[];
  };
  confidence: number;
  source: {
    provider: 'role-and-opportunity-model';
    modelVersion: string;
    generatedAt: string;
  };
  rawCanonical?: CanonicalRoleOpportunityResponse;
}

export interface TiberRoleOpportunityLabRow {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  season: number;
  week: number | null;
  seasonScopeMarker: string | null;
  primaryRole: string;
  roleTags: string[];
  usage: {
    routeParticipation: number | null;
    targetShare: number | null;
    airYardShare: number | null;
    snapShare: number | null;
    usageRate: number | null;
  };
  confidence: {
    score: number | null;
    tier: string | null;
  };
  source: {
    sourceName: string | null;
    sourceType: string | null;
    modelVersion: string | null;
    generatedAt: string | null;
  };
  insights: string[];
  rawFields: Record<string, unknown>;
  rawCanonical?: CanonicalRoleOpportunityLabRow;
}

export interface TiberRoleOpportunityLab {
  season: number | null;
  week: number | null;
  seasonScopeMarker: string | null;
  availableSeasons: number[];
  rows: TiberRoleOpportunityLabRow[];
  source: {
    provider: string;
    location: string | null;
    mode: 'api' | 'artifact';
  };
}

export type RoleOpportunityErrorCode =
  | 'config_error'
  | 'upstream_unavailable'
  | 'upstream_timeout'
  | 'invalid_payload'
  | 'not_found'
  | 'ambiguous';

export class RoleOpportunityIntegrationError extends Error {
  readonly code: RoleOpportunityErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: RoleOpportunityErrorCode, message: string, status: number, cause?: unknown) {
    super(message);
    this.name = 'RoleOpportunityIntegrationError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface RoleOpportunityClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  endpointPath?: string;
  labEndpointPath?: string;
  exportsPath?: string;
  enabled?: boolean;
}
