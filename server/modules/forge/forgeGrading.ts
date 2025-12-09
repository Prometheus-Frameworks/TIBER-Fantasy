/**
 * FORGE Grading (G) - Takes pillar scores and outputs alpha + tier
 * 
 * Handles:
 * - Position-specific weighting of pillars
 * - Orientation modes (redraft, dynasty, bestball)
 * - Recursion bias (prior alpha, momentum)
 * - Tier mapping (T1-T5)
 */

import { ForgeEngineOutput, ForgePillarScores, Position } from './forgeEngine';
import { applyFootballLens, FootballLensIssue } from './forgeFootballLens';

export type ViewMode = 'redraft' | 'dynasty' | 'bestball';

export type ForgeWeights = {
  volume: number;
  efficiency: number;
  teamContext: number;
  stability: number;
};

export type ForgeGradeResult = {
  alpha: number;
  tier: string;
  tierPosition: number;
  pillars: ForgePillarScores;
  issues?: FootballLensIssue[];
  debug?: {
    baseAlpha: number;
    recursionAdjustment: number;
    footballLensAdjusted: boolean;
  };
};

export type GradeForgeOptions = {
  mode?: ViewMode;
  skipFootballLens?: boolean;
};

// Base weights used for REDRAFT mode
const POSITION_WEIGHTS: Record<Position, ForgeWeights> = {
  WR: { volume: 0.45, efficiency: 0.30, teamContext: 0.15, stability: 0.10 },
  RB: { volume: 0.475, efficiency: 0.31, teamContext: 0.065, stability: 0.15 },
  TE: { volume: 0.40, efficiency: 0.37, teamContext: 0.10, stability: 0.13 },
  QB: { volume: 0.29, efficiency: 0.41, teamContext: 0.18, stability: 0.12 },
};

// Dynasty mode weights - different weighting philosophy
const DYNASTY_WEIGHTS: Record<Position, ForgeWeights> = {
  WR: { volume: 0.20, efficiency: 0.35, teamContext: 0.20, stability: 0.25 },
  RB: { volume: 0.25, efficiency: 0.30, teamContext: 0.15, stability: 0.30 },
  TE: { volume: 0.25, efficiency: 0.35, teamContext: 0.15, stability: 0.25 },
  QB: { volume: 0.20, efficiency: 0.35, teamContext: 0.20, stability: 0.25 },
};

const POSITION_TIER_THRESHOLDS: Record<Position, number[]> = {
  WR: [82, 72, 58, 45],
  RB: [78, 68, 55, 42],
  TE: [82, 70, 55, 42],
  QB: [70, 55, 42, 32],
};

function normalizeWeights(weights: ForgeWeights): ForgeWeights {
  const total = weights.volume + weights.efficiency + weights.teamContext + weights.stability;
  if (total === 0) return weights;
  return {
    volume: weights.volume / total,
    efficiency: weights.efficiency / total,
    teamContext: weights.teamContext / total,
    stability: weights.stability / total,
  };
}

export function getPositionForgeWeights(
  position: Position,
  mode: ViewMode = 'redraft'
): ForgeWeights {
  switch (mode) {
    case 'dynasty':
      // Use dedicated dynasty weights (already sum to 1.0)
      return DYNASTY_WEIGHTS[position];

    case 'bestball': {
      // Bestball: boost efficiency, reduce stability (upside > floor)
      const base = POSITION_WEIGHTS[position];
      const adjusted = {
        volume: base.volume * 0.9,
        efficiency: base.efficiency * 1.2,
        teamContext: base.teamContext * 1.0,
        stability: base.stability * 0.8,
      };
      return normalizeWeights(adjusted);
    }

    case 'redraft':
    default:
      // Redraft uses base weights directly
      return POSITION_WEIGHTS[position];
  }
}

function computeBaseAlpha(
  pillars: ForgePillarScores,
  weights: ForgeWeights
): number {
  const { volume, efficiency, teamContext, stability } = pillars;
  const { volume: wV, efficiency: wE, teamContext: wT, stability: wS } = weights;

  const totalWeight = wV + wE + wT + wS || 1;

  const alpha =
    (volume * wV +
      efficiency * wE +
      teamContext * wT +
      stability * wS) /
    totalWeight;

  return Math.max(0, Math.min(100, alpha));
}

type RecursionOpts = {
  priorAlpha?: number;
  alphaMomentum?: number;
};

export function applyRecursionBias(
  baseAlpha: number,
  opts: RecursionOpts
): { alpha: number; adjustment: number } {
  const { priorAlpha, alphaMomentum } = opts;
  let result = baseAlpha;
  let totalAdjustment = 0;

  if (priorAlpha != null && priorAlpha > 0) {
    const priorBlend = 0.8 * result + 0.2 * priorAlpha;
    totalAdjustment += priorBlend - result;
    result = priorBlend;
  }

  if (alphaMomentum != null) {
    const delta = Math.max(-3, Math.min(3, alphaMomentum));
    totalAdjustment += delta;
    result += delta;
  }

  return {
    alpha: Math.max(0, Math.min(100, result)),
    adjustment: totalAdjustment,
  };
}

export function mapAlphaToTier(alpha: number, position: Position): { tier: string; tierPosition: number } {
  const thresholds = POSITION_TIER_THRESHOLDS[position];
  
  if (alpha >= thresholds[0]) return { tier: 'T1', tierPosition: 1 };
  if (alpha >= thresholds[1]) return { tier: 'T2', tierPosition: 2 };
  if (alpha >= thresholds[2]) return { tier: 'T3', tierPosition: 3 };
  if (alpha >= thresholds[3]) return { tier: 'T4', tierPosition: 4 };
  return { tier: 'T5', tierPosition: 5 };
}

export function gradeForge(
  engineOutput: ForgeEngineOutput,
  options: GradeForgeOptions = {}
): ForgeGradeResult {
  const mode = options.mode ?? 'redraft';
  const skipLens = options.skipFootballLens ?? false;

  let pillars = { ...engineOutput.pillars };
  let issues: FootballLensIssue[] = [];
  let lensApplied = false;

  if (!skipLens) {
    const lensResult = applyFootballLens(engineOutput);
    pillars = { ...lensResult.pillars };
    issues = lensResult.issues;
    lensApplied = JSON.stringify(pillars) !== JSON.stringify(engineOutput.pillars);
  }

  // Dynasty mode: Blend teamContext with dynastyContext (40% short-term + 60% dynasty)
  if (mode === 'dynasty' && pillars.dynastyContext !== undefined) {
    const shortTermContext = pillars.teamContext;
    const dynastyContext = pillars.dynastyContext;
    const blendedContext = (0.40 * shortTermContext) + (0.60 * dynastyContext);
    pillars.teamContext = blendedContext;
    console.log(`[ForgeGrading] Dynasty blend for ${engineOutput.playerName}: short=${shortTermContext.toFixed(1)} + dynasty=${dynastyContext.toFixed(1)} → blended=${blendedContext.toFixed(1)}`);
  }

  const weights = getPositionForgeWeights(engineOutput.position, mode);

  const baseAlpha = computeBaseAlpha(pillars, weights);

  const { alpha: alphaWithRecursion, adjustment } = applyRecursionBias(baseAlpha, {
    priorAlpha: engineOutput.priorAlpha,
    alphaMomentum: engineOutput.alphaMomentum,
  });

  const { tier, tierPosition } = mapAlphaToTier(alphaWithRecursion, engineOutput.position);

  console.log(`[ForgeGrading] ${engineOutput.playerName}: mode=${mode} base=${baseAlpha.toFixed(1)} → final=${alphaWithRecursion.toFixed(1)} (${tier})${issues.length ? ` [${issues.length} issues]` : ''}`);

  return {
    alpha: Math.round(alphaWithRecursion * 10) / 10,
    tier,
    tierPosition,
    pillars,
    issues: issues.length > 0 ? issues : undefined,
    debug: {
      baseAlpha: Math.round(baseAlpha * 10) / 10,
      recursionAdjustment: Math.round(adjustment * 10) / 10,
      footballLensAdjusted: lensApplied,
    },
  };
}

export type ForgeFullResult = ForgeGradeResult & {
  playerId: string;
  playerName: string;
  position: Position;
  nflTeam?: string;
  season: number;
  week: number | 'season';
  gamesPlayed: number;
  rawMetrics?: Record<string, number | null>;
};

export function gradeForgeWithMeta(
  engineOutput: ForgeEngineOutput,
  options: GradeForgeOptions = {}
): ForgeFullResult {
  const grade = gradeForge(engineOutput, options);
  
  return {
    ...grade,
    playerId: engineOutput.playerId,
    playerName: engineOutput.playerName,
    position: engineOutput.position,
    nflTeam: engineOutput.nflTeam,
    season: engineOutput.season,
    week: engineOutput.week,
    gamesPlayed: engineOutput.gamesPlayed,
    rawMetrics: engineOutput.rawMetrics,
  };
}
