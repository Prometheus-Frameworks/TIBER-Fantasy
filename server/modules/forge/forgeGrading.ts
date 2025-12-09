/**
 * FORGE Grading (G) - Takes pillar scores and outputs alpha + tier
 * 
 * Handles:
 * - Position-specific weighting of pillars
 * - Recursion bias (prior alpha, momentum)
 * - Tier mapping (S/A/B/C/D)
 */

import { ForgeEngineOutput, ForgePillarScores, Position } from './forgeEngine';

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
  debug?: {
    baseAlpha: number;
    recursionAdjustment: number;
  };
};

const POSITION_WEIGHTS: Record<Position, ForgeWeights> = {
  WR: { volume: 0.43, efficiency: 0.37, teamContext: 0.05, stability: 0.15 },
  RB: { volume: 0.475, efficiency: 0.31, teamContext: 0.065, stability: 0.15 },
  TE: { volume: 0.40, efficiency: 0.37, teamContext: 0.10, stability: 0.13 },
  QB: { volume: 0.29, efficiency: 0.41, teamContext: 0.18, stability: 0.12 },
};

const POSITION_TIER_THRESHOLDS: Record<Position, number[]> = {
  WR: [82, 72, 58, 45],
  RB: [78, 68, 55, 42],
  TE: [82, 70, 55, 42],
  QB: [70, 55, 42, 32],
};

export function getPositionForgeWeights(position: Position): ForgeWeights {
  return POSITION_WEIGHTS[position];
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

export function gradeForge(engineOutput: ForgeEngineOutput): ForgeGradeResult {
  const weights = getPositionForgeWeights(engineOutput.position);

  const baseAlpha = computeBaseAlpha(engineOutput.pillars, weights);

  const { alpha: alphaWithRecursion, adjustment } = applyRecursionBias(baseAlpha, {
    priorAlpha: engineOutput.priorAlpha,
    alphaMomentum: engineOutput.alphaMomentum,
  });

  const { tier, tierPosition } = mapAlphaToTier(alphaWithRecursion, engineOutput.position);

  console.log(`[ForgeGrading] ${engineOutput.playerName}: base=${baseAlpha.toFixed(1)} → final=${alphaWithRecursion.toFixed(1)} (${tier})`);

  return {
    alpha: Math.round(alphaWithRecursion * 10) / 10,
    tier,
    tierPosition,
    pillars: engineOutput.pillars,
    debug: {
      baseAlpha: Math.round(baseAlpha * 10) / 10,
      recursionAdjustment: Math.round(adjustment * 10) / 10,
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

export function gradeForgeWithMeta(engineOutput: ForgeEngineOutput): ForgeFullResult {
  const grade = gradeForge(engineOutput);
  
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
