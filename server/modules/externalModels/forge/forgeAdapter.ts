import { ZodError } from 'zod';
import {
  CanonicalForgeEvaluationResponse,
  CanonicalForgeEvaluationResult,
  ForgeIntegrationError,
  TiberForgeEvaluation,
  canonicalForgeEvaluationResponseSchema,
} from './types';

function normalizeMode(mode: CanonicalForgeEvaluationResult['mode']): TiberForgeEvaluation['mode'] {
  return mode === 'best_ball' ? 'bestball' : mode;
}

function roundNumber(value: number, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function parseCanonicalForgeEvaluationResponse(payload: unknown): CanonicalForgeEvaluationResponse {
  try {
    return canonicalForgeEvaluationResponseSchema.parse(payload);
  } catch (error) {
    throw new ForgeIntegrationError(
      'invalid_payload',
      'External FORGE returned a payload that does not match the canonical contract.',
      502,
      error instanceof ZodError ? error.flatten() : error,
    );
  }
}

export function adaptForgeEvaluation(
  payload: unknown,
  options: { includeRawCanonical?: boolean } = {},
): TiberForgeEvaluation {
  const canonical = parseCanonicalForgeEvaluationResponse(payload);
  const result = canonical.results[0];

  if (!result) {
    throw new ForgeIntegrationError(
      'invalid_payload',
      'External FORGE returned no evaluation results for the requested player.',
      502,
    );
  }

  return {
    playerId: result.player_id,
    playerName: result.player_name,
    position: result.position,
    team: result.team ?? null,
    season: result.season,
    week: result.week,
    mode: normalizeMode(result.mode),
    score: {
      alpha: roundNumber(result.score.alpha),
      tier: result.score.tier,
      tierRank: result.score.tier_rank ?? null,
      confidence: roundNumber(result.score.confidence, 3),
    },
    components: {
      volume: roundNumber(result.components.volume),
      efficiency: roundNumber(result.components.efficiency),
      teamContext: roundNumber(result.components.team_context),
      stability: roundNumber(result.components.stability),
    },
    metadata: {
      gamesSampled: result.metadata.games_sampled,
      positionRank: result.metadata.position_rank ?? null,
      status: result.metadata.status,
      issues: result.metadata.issues,
    },
    source: {
      provider: 'external-forge',
      contractVersion: canonical.service_meta.contract_version,
      modelVersion: canonical.service_meta.model_version,
      calibrationVersion: canonical.service_meta.calibration_version,
      generatedAt: canonical.service_meta.generated_at,
      dataWindow: result.source_meta
        ? {
            season: result.source_meta.data_window.season,
            throughWeek: result.source_meta.data_window.through_week,
          }
        : undefined,
      coverage: result.source_meta
        ? {
            advancedMetrics: result.source_meta.coverage.advanced_metrics,
            snapData: result.source_meta.coverage.snap_data,
            teamContext: result.source_meta.coverage.team_context,
            matchupContext: result.source_meta.coverage.matchup_context,
          }
        : undefined,
      inputsUsed: result.source_meta
        ? {
            profile: result.source_meta.inputs_used.profile,
            sourceCount: result.source_meta.inputs_used.source_count,
          }
        : undefined,
    },
    ...(options.includeRawCanonical ? { rawCanonical: result } : {}),
  };
}
