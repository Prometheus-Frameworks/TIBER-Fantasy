import { ZodError } from 'zod';
import {
  CanonicalRoleOpportunityResponse,
  RoleOpportunityIntegrationError,
  TiberRoleOpportunityInsight,
  roleOpportunityResponseSchema,
} from './types';

function normalizeShare(value: number): number {
  return value > 1 ? value / 100 : value;
}

export function parseCanonicalRoleOpportunityResponse(payload: unknown): CanonicalRoleOpportunityResponse {
  try {
    return roleOpportunityResponseSchema.parse(payload);
  } catch (error) {
    throw new RoleOpportunityIntegrationError(
      'invalid_payload',
      'Role-and-opportunity-model returned a payload that does not match the canonical contract.',
      502,
      error instanceof ZodError ? error.flatten() : error,
    );
  }
}

export function adaptRoleOpportunityInsight(
  payload: unknown,
  options: { includeRawCanonical?: boolean } = {},
): TiberRoleOpportunityInsight {
  const canonical = parseCanonicalRoleOpportunityResponse(payload);

  return {
    playerId: canonical.player_id,
    season: canonical.season,
    week: canonical.week,
    position: canonical.position,
    team: canonical.team,
    primaryRole: canonical.primary_role,
    roleTags: canonical.role_tags,
    usage: {
      snapShare: normalizeShare(canonical.metrics.snap_share),
      routeShare: normalizeShare(canonical.metrics.route_share),
      targetShare: normalizeShare(canonical.metrics.target_share),
      usageRate: normalizeShare(canonical.metrics.usage_rate),
    },
    opportunity: {
      tier: canonical.opportunity_tier,
      weightedOpportunityIndex: canonical.metrics.weighted_opportunity_index,
      insights: canonical.insights,
    },
    confidence: canonical.confidence_score,
    source: {
      provider: 'role-and-opportunity-model',
      modelVersion: canonical.model_version,
      generatedAt: canonical.generated_at,
    },
    ...(options.includeRawCanonical ? { rawCanonical: canonical } : {}),
  };
}
