import {
  buildExternalForgeInsightStatus,
  ExternalForgeInsightStatus,
  ForgeComparisonInsightStatus,
  buildForgeComparisonInsightStatus,
} from '../forge/playerDetailEnrichment';
import {
  buildRoleOpportunityInsightStatus,
  RoleOpportunityInsightStatus,
} from '../roleOpportunity/playerDetailEnrichment';
import {
  ParsedExternalForgeRequest,
  PlayerDetailEnrichmentRequest,
  PlayerDetailEnrichmentResult,
} from './types';

interface PlayerDetailEnrichmentDependencies {
  buildRoleOpportunityInsightStatus: typeof buildRoleOpportunityInsightStatus;
  buildExternalForgeInsightStatus: typeof buildExternalForgeInsightStatus;
  buildForgeComparisonInsightStatus: typeof buildForgeComparisonInsightStatus;
}

const defaultDependencies: PlayerDetailEnrichmentDependencies = {
  buildRoleOpportunityInsightStatus,
  buildExternalForgeInsightStatus,
  buildForgeComparisonInsightStatus,
};

const supportedForgePositions = new Set(['QB', 'RB', 'WR', 'TE']);
const supportedForgeModes = new Set(['redraft', 'dynasty', 'bestball']);

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

function buildExternalForgeUnavailable(message: string): ExternalForgeInsightStatus {
  return {
    available: false,
    fetchedAt: new Date().toISOString(),
    error: {
      category: 'ambiguous',
      message,
    },
  };
}

function buildForgeComparisonUnavailable(message: string): ForgeComparisonInsightStatus {
  return {
    available: false,
    fetchedAt: new Date().toISOString(),
    legacy: {
      available: false,
      error: {
        category: 'ambiguous',
        message,
      },
    },
    external: {
      available: false,
      error: {
        category: 'ambiguous',
        message,
      },
    },
    error: {
      category: 'ambiguous',
      message,
    },
  };
}

function parseExternalForgeRequest(
  request: PlayerDetailEnrichmentRequest,
): ParsedExternalForgeRequest | ExternalForgeInsightStatus {
  if (!Number.isInteger(request.season)) {
    return buildExternalForgeUnavailable('season is required when requesting external FORGE preview or comparison');
  }

  if (!request.playerPosition || !supportedForgePositions.has(request.playerPosition)) {
    return buildExternalForgeUnavailable(
      `External FORGE preview/comparison only supports QB/RB/WR/TE player detail right now (received ${request.playerPosition ?? 'unknown'}).`,
    );
  }

  const mode = request.externalForgeMode ?? 'redraft';
  if (!supportedForgeModes.has(mode)) {
    return buildExternalForgeUnavailable(
      'externalForgeMode must be one of redraft, dynasty, or bestball when requesting external FORGE preview or comparison',
    );
  }

  const parsedWeek = request.week === 'season'
    ? 'season'
    : request.week == null
      ? 'season'
      : request.week;

  if (parsedWeek !== 'season' && !Number.isInteger(parsedWeek)) {
    return buildExternalForgeUnavailable(
      'week must be an integer or the string "season" when requesting external FORGE preview or comparison',
    );
  }

  return {
    playerId: request.playerId,
    position: request.playerPosition as ParsedExternalForgeRequest['position'],
    season: request.season,
    week: parsedWeek,
    mode: mode as ParsedExternalForgeRequest['mode'],
  };
}

export async function orchestratePlayerDetailEnrichment(
  request: PlayerDetailEnrichmentRequest,
  dependencies: PlayerDetailEnrichmentDependencies = defaultDependencies,
): Promise<PlayerDetailEnrichmentResult> {
  const result: PlayerDetailEnrichmentResult = {};

  if (request.includeRoleOpportunity) {
    if (!Number.isInteger(request.season) || !Number.isInteger(request.week)) {
      result.roleOpportunityInsight = buildMissingRoleOpportunityParamsStatus();
    } else {
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
    }
  }

  if (request.includeExternalForge) {
    const forgeRequest = parseExternalForgeRequest(request);

    if ('available' in forgeRequest) {
      result.externalForgeInsight = forgeRequest;
    } else {
      try {
        result.externalForgeInsight = await dependencies.buildExternalForgeInsightStatus({
          ...forgeRequest,
          includeSourceMeta: true,
          includeRawCanonical: false,
        });
      } catch {
        result.externalForgeInsight = {
          available: false,
          fetchedAt: new Date().toISOString(),
          error: {
            category: 'unexpected_error',
            message: 'External FORGE insight failed unexpectedly.',
          },
        };
      }
    }
  }

  if (request.includeForgeComparison) {
    const forgeRequest = parseExternalForgeRequest(request);

    if ('available' in forgeRequest) {
      result.forgeComparison = buildForgeComparisonUnavailable(
        forgeRequest.error?.message ?? 'FORGE comparison preview request is ambiguous.',
      );
    } else {
      try {
        result.forgeComparison = await dependencies.buildForgeComparisonInsightStatus({
          ...forgeRequest,
          includeSourceMeta: true,
          includeRawCanonical: false,
        });
      } catch {
        result.forgeComparison = {
          available: false,
          fetchedAt: new Date().toISOString(),
          legacy: {
            available: false,
            error: {
              category: 'unexpected_error',
              message: 'Legacy FORGE comparison preview failed unexpectedly.',
            },
          },
          external: {
            available: false,
            error: {
              category: 'unexpected_error',
              message: 'External FORGE comparison preview failed unexpectedly.',
            },
          },
          error: {
            category: 'unexpected_error',
            message: 'FORGE comparison preview failed unexpectedly.',
          },
        };
      }
    }
  }

  return result;
}
