import { ForgeService, forgeService } from './forgeService';
import {
  ForgeIntegrationError,
  TiberForgeComparisonRequest,
  TiberForgeEvaluation,
  TiberForgeMode,
  TiberForgePosition,
  TiberForgeWeek,
} from './types';

export interface ExternalForgeInsightData {
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

export interface ExternalForgeInsightStatus {
  available: boolean;
  fetchedAt: string;
  data?: ExternalForgeInsightData;
  error?: {
    category: ForgeIntegrationError['code'] | 'unexpected_error' | 'ambiguous';
    message: string;
  };
}

function toInsightData(evaluation: TiberForgeEvaluation): ExternalForgeInsightData {
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
      data: toInsightData(evaluation),
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
