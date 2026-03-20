import {
  buildRoleOpportunityInsightStatus,
  RoleOpportunityInsightStatus,
} from '../roleOpportunity/playerDetailEnrichment';
import { PlayerDetailEnrichmentRequest, PlayerDetailEnrichmentResult } from './types';

interface PlayerDetailEnrichmentDependencies {
  buildRoleOpportunityInsightStatus: typeof buildRoleOpportunityInsightStatus;
}

const defaultDependencies: PlayerDetailEnrichmentDependencies = {
  buildRoleOpportunityInsightStatus,
};

function buildMissingRoleOpportunityParamsStatus(): RoleOpportunityInsightStatus {
  return {
    available: false,
    fetchedAt: new Date().toISOString(),
    error: {
      category: 'ambiguous',
      message: 'season and week are required when includeRoleOpportunity=true',
    },
  };
}

export async function orchestratePlayerDetailEnrichment(
  request: PlayerDetailEnrichmentRequest,
  dependencies: PlayerDetailEnrichmentDependencies = defaultDependencies,
): Promise<PlayerDetailEnrichmentResult> {
  const result: PlayerDetailEnrichmentResult = {};

  if (!request.includeRoleOpportunity) {
    return result;
  }

  if (!Number.isInteger(request.season) || !Number.isInteger(request.week)) {
    result.roleOpportunityInsight = buildMissingRoleOpportunityParamsStatus();
    return result;
  }

  try {
    result.roleOpportunityInsight = await dependencies.buildRoleOpportunityInsightStatus({
      playerId: request.playerId,
      season: request.season,
      week: request.week,
    });
  } catch {
    result.roleOpportunityInsight = {
      available: false,
      fetchedAt: new Date().toISOString(),
      error: {
        category: 'unexpected_error',
        message: 'Role opportunity insight failed unexpectedly.',
      },
    };
  }

  return result;
}
