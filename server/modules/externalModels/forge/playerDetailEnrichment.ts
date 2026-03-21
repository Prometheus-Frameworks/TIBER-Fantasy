import { ForgeService, forgeService } from './forgeService';
import {
  ForgeIntegrationError,
  TiberForgeComparisonRequest,
  TiberForgeComparisonResult,
  TiberForgeComparisonSide,
  TiberForgeEvaluation,
  TiberForgeMode,
  TiberForgePosition,
  TiberForgeWeek,
} from './types';
import { ForgeCompareService, forgeCompareService } from './forgeCompareService';
import {
  ForgeSourceSelectionMode,
  ForgeSourceSelector,
  ForgeSourceSelectionResult,
  forgeSourceSelector,
} from './forgeSourceSelector';

export interface PlayerDetailForgeInsightData {
  playerId: string;
  playerName: string;
  position: TiberForgePosition;
  team: string | null;
  season: number;
  week: TiberForgeWeek;
  mode: TiberForgeMode;
  score: {
    alpha: number;
    tier: string;
    tierRank: number | null;
  };
  components: TiberForgeEvaluation['components'];
  confidence: number | null;
  metadata: TiberForgeEvaluation['metadata'];
  source: TiberForgeEvaluation['source'];
}

export interface PlayerDetailForgeInsightStatus {
  available: boolean;
  data?: PlayerDetailForgeInsightData;
  error?: {
    category: ForgeIntegrationError['code'] | 'unexpected_error' | 'ambiguous' | 'legacy_error';
    message: string;
  };
}

export interface ExternalForgeInsightStatus {
  available: boolean;
  fetchedAt: string;
  data?: PlayerDetailForgeInsightData;
  error?: {
    category: ForgeIntegrationError['code'] | 'unexpected_error' | 'ambiguous';
    message: string;
  };
}

export interface SelectedForgeInsightStatus {
  available: boolean;
  fetchedAt: string;
  selection: {
    requestedMode: ForgeSourceSelectionMode;
    selectedSource: 'legacy' | 'external_preview';
    fallbackOccurred: boolean;
    fallbackReason?: string;
  };
  data?: PlayerDetailForgeInsightData;
  error?: {
    category: ForgeIntegrationError['code'] | 'unexpected_error' | 'ambiguous' | 'legacy_error';
    message: string;
  };
}

export interface ForgeComparisonInsightStatus {
  available: boolean;
  fetchedAt: string;
  legacy: PlayerDetailForgeInsightStatus;
  external: PlayerDetailForgeInsightStatus;
  comparison?: TiberForgeComparisonResult['comparison'];
  error?: {
    category: 'unexpected_error' | 'ambiguous';
    message: string;
  };
}

export function toPlayerDetailForgeInsightData(evaluation: TiberForgeEvaluation): PlayerDetailForgeInsightData {
  return {
    playerId: evaluation.playerId,
    playerName: evaluation.playerName,
    position: evaluation.position,
    team: evaluation.team,
    season: evaluation.season,
    week: evaluation.week,
    mode: evaluation.mode,
    score: {
      alpha: evaluation.score.alpha,
      tier: evaluation.score.tier,
      tierRank: evaluation.score.tierRank,
    },
    components: evaluation.components,
    confidence: evaluation.score.confidence,
    metadata: evaluation.metadata,
    source: evaluation.source,
  };
}

function toPlayerDetailForgeInsightStatus(side: TiberForgeComparisonSide): PlayerDetailForgeInsightStatus {
  if (side.available && side.data) {
    return {
      available: true,
      data: toPlayerDetailForgeInsightData(side.data),
    };
  }

  return {
    available: false,
    error: side.error ?? {
      category: 'unexpected_error',
      message: 'FORGE insight failed unexpectedly.',
    },
  };
}

function toSelectedForgeInsightStatus(
  fetchedAt: string,
  selectionResult: ForgeSourceSelectionResult,
): SelectedForgeInsightStatus {
  if (selectionResult.available) {
    return {
      available: true,
      fetchedAt,
      selection: {
        requestedMode: selectionResult.requestedMode,
        selectedSource: selectionResult.selectedSource,
        fallbackOccurred: selectionResult.fallbackOccurred,
        fallbackReason: selectionResult.fallbackReason,
      },
      data: toPlayerDetailForgeInsightData(selectionResult.data),
    };
  }

  const selectionFailure = selectionResult as Extract<ForgeSourceSelectionResult, { available: false }>;

  return {
    available: false,
    fetchedAt,
    selection: {
      requestedMode: selectionFailure.requestedMode,
      selectedSource: selectionFailure.selectedSource,
      fallbackOccurred: selectionFailure.fallbackOccurred,
      fallbackReason: selectionFailure.fallbackReason,
    },
    error: selectionFailure.error,
  };
}

export async function buildExternalForgeInsightStatus(
  request: TiberForgeComparisonRequest,
  service: Pick<ForgeService, 'evaluatePlayer'> = forgeService,
): Promise<ExternalForgeInsightStatus> {
  const fetchedAt = new Date().toISOString();

  try {
    const evaluation = await service.evaluatePlayer(request, {
      includeRawCanonical: request.includeRawCanonical,
    });

    return {
      available: true,
      fetchedAt,
      data: toPlayerDetailForgeInsightData(evaluation),
    };
  } catch (error) {
    if (error instanceof ForgeIntegrationError) {
      return {
        available: false,
        fetchedAt,
        error: {
          category: error.code,
          message: error.message,
        },
      };
    }

    return {
      available: false,
      fetchedAt,
      error: {
        category: 'unexpected_error',
        message: 'External FORGE insight failed unexpectedly.',
      },
    };
  }
}

export async function buildSelectedForgeInsightStatus(
  request: TiberForgeComparisonRequest,
  selectionMode: ForgeSourceSelectionMode,
  selector: Pick<ForgeSourceSelector, 'select'> = forgeSourceSelector,
): Promise<SelectedForgeInsightStatus> {
  const fetchedAt = new Date().toISOString();

  try {
    const selection = await selector.select(request, selectionMode);
    return toSelectedForgeInsightStatus(fetchedAt, selection);
  } catch {
    return {
      available: false,
      fetchedAt,
      selection: {
        requestedMode: selectionMode,
        selectedSource: selectionMode === 'legacy' ? 'legacy' : 'external_preview',
        fallbackOccurred: false,
      },
      error: {
        category: 'unexpected_error',
        message: 'Selected FORGE insight failed unexpectedly.',
      },
    };
  }
}

export async function buildForgeComparisonInsightStatus(
  request: TiberForgeComparisonRequest,
  service: Pick<ForgeCompareService, 'compare'> = forgeCompareService,
): Promise<ForgeComparisonInsightStatus> {
  const fetchedAt = new Date().toISOString();

  try {
    const comparisonResult = await service.compare(request);

    return {
      available: comparisonResult.legacy.available || comparisonResult.external.available,
      fetchedAt,
      legacy: toPlayerDetailForgeInsightStatus(comparisonResult.legacy),
      external: toPlayerDetailForgeInsightStatus(comparisonResult.external),
      comparison: comparisonResult.comparison,
    };
  } catch {
    return {
      available: false,
      fetchedAt,
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
