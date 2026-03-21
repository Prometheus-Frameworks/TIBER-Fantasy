import {
  ForgeIntegrationError,
  TiberForgeComparisonRequest,
  TiberForgeComparisonResult,
  TiberForgeComparisonSide,
  TiberForgeEvaluation,
} from './types';
import { ForgeService, forgeService } from './forgeService';

export type LegacyForgeEvaluator = (request: TiberForgeComparisonRequest) => Promise<TiberForgeEvaluation>;

function roundDelta(value: number, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export async function evaluateLegacyForge(request: TiberForgeComparisonRequest): Promise<TiberForgeEvaluation> {
  const [{ runForgeEngine }, { gradeForgeWithMeta }] = await Promise.all([
    import('../../forge/forgeEngine'),
    import('../../forge/forgeGrading'),
  ]);
  const engineOutput = await runForgeEngine(request.playerId, request.position, request.season, request.week);
  const graded = gradeForgeWithMeta(engineOutput, { mode: request.mode });

  return {
    playerId: graded.playerId,
    playerName: graded.playerName,
    position: graded.position as TiberForgeEvaluation['position'],
    team: graded.nflTeam ?? null,
    season: request.season,
    week: request.week,
    mode: request.mode,
    score: {
      alpha: graded.alpha,
      tier: graded.tier,
      tierRank: graded.tierPosition ?? null,
      confidence: graded.debug?.rawAlpha != null ? roundDelta(Math.max(0, Math.min(1, graded.alpha / 100)), 3) : roundDelta(Math.max(0, Math.min(1, graded.alpha / 100)), 3),
    },
    components: {
      volume: roundDelta(graded.pillars.volume),
      efficiency: roundDelta(graded.pillars.efficiency),
      teamContext: roundDelta(graded.pillars.teamContext),
      stability: roundDelta(graded.pillars.stability),
    },
    metadata: {
      gamesSampled: graded.gamesPlayed,
      positionRank: graded.tierPosition ?? null,
      status: 'ok',
      issues: (graded.issues ?? []).map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
      })),
    },
    source: {
      provider: 'legacy-forge',
      modelVersion: 'legacy-eg-v2',
      generatedAt: new Date().toISOString(),
    },
  };
}

function toLegacyFailure(error: unknown): TiberForgeComparisonSide {
  return {
    available: false,
    error: {
      category: 'legacy_error',
      message: error instanceof Error ? error.message : 'Legacy FORGE failed unexpectedly.',
    },
  };
}

function toExternalFailure(error: unknown): TiberForgeComparisonSide {
  if (error instanceof ForgeIntegrationError) {
    return {
      available: false,
      error: {
        category: error.code,
        message: error.message,
      },
    };
  }

  return {
    available: false,
    error: {
      category: 'upstream_unavailable',
      message: error instanceof Error ? error.message : 'External FORGE failed unexpectedly.',
    },
  };
}

export function buildComparisonMetadata(
  legacy?: TiberForgeEvaluation,
  external?: TiberForgeEvaluation,
): TiberForgeComparisonResult['comparison'] {
  if (!legacy && !external) {
    return {
      notes: ['Neither legacy nor external FORGE returned a comparable evaluation.'],
      parityStatus: 'unavailable',
    };
  }

  if (!legacy || !external) {
    return {
      notes: ['Only one FORGE implementation returned data for this request.'],
      parityStatus: 'unavailable',
    };
  }

  if (legacy.position !== external.position) {
    return {
      notes: ['Legacy and external FORGE returned different positions, so parity is not comparable.'],
      parityStatus: 'not_comparable',
    };
  }

  const scoreDelta = roundDelta(external.score.alpha - legacy.score.alpha);
  const componentDeltas = {
    volume: roundDelta(external.components.volume - legacy.components.volume),
    efficiency: roundDelta(external.components.efficiency - legacy.components.efficiency),
    teamContext: roundDelta(external.components.teamContext - legacy.components.teamContext),
    stability: roundDelta(external.components.stability - legacy.components.stability),
  };
  const confidenceDelta =
    legacy.score.confidence == null || external.score.confidence == null
      ? null
      : roundDelta(external.score.confidence - legacy.score.confidence, 3);

  const notes: string[] = [];
  const maxComponentDrift = Math.max(...Object.values(componentDeltas).map((value) => Math.abs(value)));

  if (legacy.score.tier !== external.score.tier) {
    notes.push(`Tier changed from ${legacy.score.tier} to ${external.score.tier}.`);
  }

  if (Math.abs(scoreDelta) >= 5) {
    notes.push(`Alpha drift is ${scoreDelta} points.`);
  } else {
    notes.push(`Alpha delta stayed within migration tolerance at ${scoreDelta} points.`);
  }

  if (maxComponentDrift >= 7) {
    notes.push(`At least one pillar drifted by ${maxComponentDrift} points.`);
  }

  if (confidenceDelta != null) {
    notes.push(`Confidence delta is ${confidenceDelta}.`);
  }

  if (legacy.metadata.issues.length !== external.metadata.issues.length) {
    notes.push(`Issue count changed from ${legacy.metadata.issues.length} to ${external.metadata.issues.length}.`);
  }

  const parityStatus =
    Math.abs(scoreDelta) <= 3 && maxComponentDrift <= 5 && legacy.score.tier === external.score.tier
      ? 'close'
      : 'drift';

  return {
    scoreDelta,
    componentDeltas,
    confidenceDelta,
    notes,
    parityStatus,
  };
}

export class ForgeCompareService {
  constructor(
    private readonly externalForge: Pick<ForgeService, 'evaluatePlayer'> = forgeService,
    private readonly legacyEvaluator: LegacyForgeEvaluator = evaluateLegacyForge,
  ) {}

  async compare(request: TiberForgeComparisonRequest): Promise<TiberForgeComparisonResult> {
    const [legacyResult, externalResult] = await Promise.allSettled([
      this.legacyEvaluator(request),
      this.externalForge.evaluatePlayer(request, { includeRawCanonical: request.includeRawCanonical }),
    ]);

    const legacy =
      legacyResult.status === 'fulfilled'
        ? ({ available: true, data: legacyResult.value } satisfies TiberForgeComparisonSide)
        : toLegacyFailure(legacyResult.reason);

    const external =
      externalResult.status === 'fulfilled'
        ? ({ available: true, data: externalResult.value } satisfies TiberForgeComparisonSide)
        : toExternalFailure(externalResult.reason);

    return {
      request,
      legacy,
      external,
      comparison: buildComparisonMetadata(legacy.data, external.data),
    };
  }
}

export const forgeCompareService = new ForgeCompareService();
