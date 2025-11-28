/**
 * FORGE v0.2 - Fibonacci Pattern Resonance (FPR) Module
 * 
 * Analyzes usage patterns to detect Fibonacci-like growth, decay, or stability.
 * Provides confidence and volatility modifiers for FORGE alpha scoring.
 * 
 * Usage patterns mapped to Fibonacci ratios:
 * - Growth: ~1.618 (phi)
 * - Decay: ~0.618 (1/phi)
 * - Stable: ~1.0
 */

import { db } from '../../infra/db';
import { gameLogs } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { PlayerPosition } from './types';

export type PatternType = 'FIB_GROWTH' | 'FIB_DECAY' | 'FIB_STABLE' | 'UNDEFINED';
export type ResonanceBand = 'HIGH_RESONANCE' | 'MEDIUM' | 'LOW' | 'NOISE';

export interface FPROutput {
  score: number;
  pattern: PatternType;
  band: ResonanceBand;
  bestTargetRatio: number;
  medianDeviation: number;
  inputRatios: number[];
  forgeConfidenceModifier: number;
  forgeVolatilityIndex: number;
}

export interface FPRResult {
  playerId: string;
  position: string;
  season: number;
  inputData: number[];
  fpr: FPROutput;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;
const STABLE = 1.0;

const TARGETS: Record<Exclude<PatternType, 'UNDEFINED'>, number> = {
  FIB_GROWTH: PHI,
  FIB_DECAY: INV_PHI,
  FIB_STABLE: STABLE,
};

const MAX_DEV_FOR_SCORE = 1.0;
const SCORE_DECAY_COEFF = -4;

export function computeFPR(usageHistory: number[]): FPROutput {
  if (!usageHistory || usageHistory.length < 2) {
    return generateNoiseOutput();
  }

  const ratios: number[] = [];

  for (let i = 1; i < usageHistory.length; i++) {
    const prev = usageHistory[i - 1];
    const curr = usageHistory[i];

    if (prev === 0) {
      if (curr === 0) {
        ratios.push(1.0);
      } else {
        ratios.push(2.0);
      }
    } else {
      ratios.push(curr / prev);
    }
  }

  if (ratios.length === 0) {
    return generateNoiseOutput();
  }

  let bestPattern: PatternType = 'UNDEFINED';
  let bestTarget = 0;
  let lowestDeviation = Number.POSITIVE_INFINITY;

  (Object.entries(TARGETS) as [Exclude<PatternType, 'UNDEFINED'>, number][]).forEach(
    ([pattern, target]) => {
      const deviations = ratios.map((r) => Math.abs((r - target) / target));
      const medianDev = median(deviations);

      if (medianDev < lowestDeviation) {
        lowestDeviation = medianDev;
        bestPattern = pattern;
        bestTarget = target;
      }
    },
  );

  if (bestPattern === 'UNDEFINED') {
    return generateNoiseOutput();
  }

  const clippedDev = Math.max(0, Math.min(MAX_DEV_FOR_SCORE, lowestDeviation));
  const scoreRaw = 100 * Math.exp(SCORE_DECAY_COEFF * clippedDev);
  const score = Math.round(Math.max(0, Math.min(100, scoreRaw)) * 100) / 100;

  const band = bucketScore(score);

  const forgeConfidenceModifier = parseFloat((score / 100).toFixed(3));

  let forgeVolatilityIndex: number;

  if (bestPattern === 'FIB_STABLE') {
    forgeVolatilityIndex = parseFloat((0.1 * (1 - forgeConfidenceModifier)).toFixed(3));
  } else {
    forgeVolatilityIndex = parseFloat((0.8 * forgeConfidenceModifier).toFixed(3));
  }

  return {
    score,
    pattern: bestPattern,
    band,
    bestTargetRatio: bestTarget,
    medianDeviation: parseFloat(lowestDeviation.toFixed(4)),
    inputRatios: ratios.map((r) => parseFloat(r.toFixed(3))),
    forgeConfidenceModifier,
    forgeVolatilityIndex,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function bucketScore(score: number): ResonanceBand {
  if (score >= 85) return 'HIGH_RESONANCE';
  if (score >= 60) return 'MEDIUM';
  if (score >= 30) return 'LOW';
  return 'NOISE';
}

function generateNoiseOutput(): FPROutput {
  return {
    score: 0,
    pattern: 'UNDEFINED',
    band: 'NOISE',
    bestTargetRatio: 0,
    medianDeviation: 0,
    inputRatios: [],
    forgeConfidenceModifier: 0,
    forgeVolatilityIndex: 0,
  };
}

/**
 * Fetch real usage history for a player from gameLogs.
 * Position-aware metric selection:
 * - WR/TE: targets
 * - RB: rushAttempts + targets
 * - QB: passAttempts
 */
export async function getUsageHistoryForPlayer(
  sleeperId: string,
  position: PlayerPosition,
  season: number
): Promise<number[]> {
  try {
    const logs = await db
      .select({
        week: gameLogs.week,
        targets: gameLogs.targets,
        receptions: gameLogs.receptions,
        rushAttempts: gameLogs.rushAttempts,
        passAttempts: gameLogs.passAttempts,
      })
      .from(gameLogs)
      .where(
        and(
          eq(gameLogs.sleeperId, sleeperId),
          eq(gameLogs.season, season),
          eq(gameLogs.seasonType, 'REG')
        )
      )
      .orderBy(gameLogs.week);

    if (!logs || logs.length === 0) {
      return [];
    }

    const usageByWeek: number[] = logs.map(log => {
      switch (position) {
        case 'WR':
        case 'TE':
          return log.targets ?? 0;
        case 'RB':
          return (log.rushAttempts ?? 0) + (log.targets ?? 0);
        case 'QB':
          return log.passAttempts ?? 0;
        default:
          return log.targets ?? 0;
      }
    });

    return usageByWeek;
  } catch (error) {
    console.error(`[FPR] Error fetching usage for ${sleeperId}:`, error);
    return [];
  }
}

/**
 * Compute FPR for a player with real data.
 * Resolves sleeperId from canonical ID if needed.
 */
export async function computeFPRForPlayer(
  sleeperId: string,
  position: PlayerPosition,
  season: number
): Promise<FPRResult> {
  const usageHistory = await getUsageHistoryForPlayer(sleeperId, position, season);
  
  const fpr = computeFPR(usageHistory);

  return {
    playerId: sleeperId,
    position,
    season,
    inputData: usageHistory,
    fpr,
  };
}
