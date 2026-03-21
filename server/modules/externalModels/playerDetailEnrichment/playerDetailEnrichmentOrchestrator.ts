import {
  buildExternalForgeInsightStatus,
  buildSelectedForgeInsightStatus,
  ExternalForgeInsightStatus,
  ForgeComparisonInsightStatus,
  SelectedForgeInsightStatus,
  buildForgeComparisonInsightStatus,
} from '../forge/playerDetailEnrichment';
import { ForgeSourceSelectionMode } from '../forge/forgeSourceSelector';
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
  buildSelectedForgeInsightStatus: typeof buildSelectedForgeInsightStatus;
  buildForgeComparisonInsightStatus: typeof buildForgeComparisonInsightStatus;
}

const defaultDependencies: PlayerDetailEnrichmentDependencies = {
  buildRoleOpportunityInsightStatus,
  buildExternalForgeInsightStatus,
  buildSelectedForgeInsightStatus,
  buildForgeComparisonInsightStatus,
};

const supportedForgePositions = new Set(['QB', 'RB', 'WR', 'TE']);
const supportedForgeModes = new Set(['redraft', 'dynasty', 'bestball']);
const supportedForgeSourceModes = new Set<ForgeSourceSelectionMode>([
  'legacy',
  'external_preview',
  'auto_with_legacy_fallback',
]);

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

function buildSelectedForgeUnavailable(
  message: string,
  requestedMode: ForgeSourceSelectionMode = 'auto_with_legacy_fallback',
): SelectedForgeInsightStatus {
  return {
    available: false,
    fetchedAt: new Date().toISOString(),
    selection: {
      requestedMode,
      selectedSource: requestedMode === 'legacy' ? 'legacy' : 'external_preview',
      fallbackOccurred: false,
    },
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

function parseForgeSourceMode(
  request: PlayerDetailEnrichmentRequest,
): ForgeSourceSelectionMode | SelectedForgeInsightStatus {
  const mode = request.forgeSourceMode ?? 'auto_with_legacy_fallback';

  if (supportedForgeSourceModes.has(mode as ForgeSourceSelectionMode)) {
    return mode as ForgeSourceSelectionMode;
  }

  return buildSelectedForgeUnavailable(
    'forgeSourceMode must be one of legacy, external_preview, or auto_with_legacy_fallback when requesting selected FORGE preview',
  );
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
          week: request.week as number,
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

  if (request.includeSelectedForge) {
    const forgeRequest = parseExternalForgeRequest(request);
    const forgeSourceMode = parseForgeSourceMode(request);

    if ('available' in forgeRequest) {
      result.selectedForgeInsight = buildSelectedForgeUnavailable(
        forgeRequest.error?.message ?? 'Selected FORGE preview request is ambiguous.',
      );
    } else if (typeof forgeSourceMode !== 'string') {
      result.selectedForgeInsight = forgeSourceMode;
    } else {
      try {
        result.selectedForgeInsight = await dependencies.buildSelectedForgeInsightStatus(
          {
            ...forgeRequest,
            includeSourceMeta: true,
            includeRawCanonical: false,
          },
          forgeSourceMode,
        );
      } catch {
        result.selectedForgeInsight = {
          available: false,
          fetchedAt: new Date().toISOString(),
          selection: {
            requestedMode: forgeSourceMode,
            selectedSource: forgeSourceMode === 'legacy' ? 'legacy' : 'external_preview',
            fallbackOccurred: false,
          },
          error: {
            category: 'unexpected_error',
            message: 'Selected FORGE insight failed unexpectedly.',
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
