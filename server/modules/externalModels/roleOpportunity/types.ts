import { z } from 'zod';

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
    snap_share: z.number().finite().min(0).max(100),
    route_share: z.number().finite().min(0).max(100),
    target_share: z.number().finite().min(0).max(100),
    usage_rate: z.number().finite().min(0).max(100),
    weighted_opportunity_index: z.number().finite().min(0),
  }),
  insights: z.array(z.string().min(1)).default([]),
  model_version: z.string().min(1),
  generated_at: z.string().datetime(),
});

export type CanonicalRoleOpportunityResponse = z.infer<typeof roleOpportunityResponseSchema>;

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
  enabled?: boolean;
}
