/**
 * Feature Builders - Turn Raw Data into Analytics
 * 
 * Phase C: Advanced Analytics
 * EWMA smoothing, scaling, and guardrails live here. These return 0–100 scaled where needed.
 */

import { ewma01, clamp01, minMaxScale, leagueStats, percentileRank } from './math';

/**
 * Form FPG: EWMA-smoothed fantasy points per game
 * @param fpgSeries Array of FPG values (most recent first)
 * @param alpha EWMA learning rate (default 0.5 for ~1.5 week half-life)
 * @returns EWMA-smoothed FPG value
 */
export function formFPG(fpgSeries: number[], alpha: number = 0.5): number {
  return ewma01(fpgSeries, alpha);
}

/**
 * Expected FPG: EWMA-smoothed expected fantasy points
 * @param xfpgSeries Array of xFPG values (most recent first)
 * @param alpha EWMA learning rate (default 0.5)
 * @returns EWMA-smoothed expected FPG
 */
export function expectedFPG(xfpgSeries: number[], alpha: number = 0.5): number {
  return ewma01(xfpgSeries, alpha);
}

/**
 * Beat Projection: How much player outperforms projections (0-100 scale)
 * @param fpg Actual fantasy points per game
 * @param proj Projected fantasy points per game
 * @param leagueMin League minimum outperformance (default -10)
 * @param leagueMax League maximum outperformance (default +15)
 * @returns Scaled 0-100 value
 */
export function beatProjection(
  fpg: number, 
  proj: number, 
  leagueMin: number = -10, 
  leagueMax: number = +15
): number {
  const diff = fpg - proj;
  return clamp01(minMaxScale(diff, leagueMin, leagueMax)) * 100;
}

/**
 * QB Upside Index: Position-specific upside calculation based on rushing profile
 * @param params QB rushing metrics
 * @param leagueRanges League-wide ranges for normalization
 * @returns Upside index (0-100)
 */
export function qbUpsideIndex(
  params: {
    designedRunRate: number;
    scrambleYdsG: number;
    rzRushShare: number;
    explosiveRate?: number;
  },
  leagueRanges: {
    designedRunRate: [number, number];
    scrambleYdsG: [number, number];
    rzRushShare: [number, number];
    explosiveRate?: [number, number];
  }
): number {
  const n = (v: number, [lo, hi]: [number, number]) => clamp01(minMaxScale(v, lo, hi));
  
  const score = 
    0.50 * n(params.designedRunRate, leagueRanges.designedRunRate) +
    0.25 * n(params.scrambleYdsG, leagueRanges.scrambleYdsG) +
    0.20 * n(params.rzRushShare, leagueRanges.rzRushShare) +
    0.05 * n(params.explosiveRate ?? 0, leagueRanges.explosiveRate || [0, 0]);
  
  return Math.round(100 * score);
}

/**
 * RB Upside Index: Goal-line and snap share focus
 * @param params RB usage metrics
 * @param leagueRanges League-wide ranges for normalization
 * @returns Upside index (0-100)
 */
export function rbUpsideIndex(
  params: {
    inside10Share: number;
    snapShare: number;
    targetShare: number;
    goalLineCarries?: number;
  },
  leagueRanges: {
    inside10Share: [number, number];
    snapShare: [number, number];
    targetShare: [number, number];
    goalLineCarries?: [number, number];
  }
): number {
  const n = (v: number, [lo, hi]: [number, number]) => clamp01(minMaxScale(v, lo, hi));
  
  const score = 
    0.40 * n(params.inside10Share, leagueRanges.inside10Share) +
    0.30 * n(params.snapShare, leagueRanges.snapShare) +
    0.25 * n(params.targetShare, leagueRanges.targetShare) +
    0.05 * n(params.goalLineCarries ?? 0, leagueRanges.goalLineCarries || [0, 0]);
  
  return Math.round(100 * score);
}

/**
 * WR Upside Index: Target earning and air yards focus
 * @param params WR metrics
 * @param leagueRanges League-wide ranges for normalization
 * @returns Upside index (0-100)
 */
export function wrUpsideIndex(
  params: {
    targetsPerRoute: number;
    airYardsShare: number;
    slotRate: number;
    redZoneTargets?: number;
  },
  leagueRanges: {
    targetsPerRoute: [number, number];
    airYardsShare: [number, number];
    slotRate: [number, number];
    redZoneTargets?: [number, number];
  }
): number {
  const n = (v: number, [lo, hi]: [number, number]) => clamp01(minMaxScale(v, lo, hi));
  
  const score = 
    0.40 * n(params.targetsPerRoute, leagueRanges.targetsPerRoute) +
    0.30 * n(params.airYardsShare, leagueRanges.airYardsShare) +
    0.20 * n(params.slotRate, leagueRanges.slotRate) +
    0.10 * n(params.redZoneTargets ?? 0, leagueRanges.redZoneTargets || [0, 0]);
  
  return Math.round(100 * score);
}

/**
 * TE Upside Index: Route participation and receiving focus
 * @param params TE metrics
 * @param leagueRanges League-wide ranges for normalization
 * @returns Upside index (0-100)
 */
export function teUpsideIndex(
  params: {
    routeParticipation: number;
    blockingRate: number;
    redZoneTargets: number;
    snapShare?: number;
  },
  leagueRanges: {
    routeParticipation: [number, number];
    blockingRate: [number, number];
    redZoneTargets: [number, number];
    snapShare?: [number, number];
  }
): number {
  const n = (v: number, [lo, hi]: [number, number]) => clamp01(minMaxScale(v, lo, hi));
  
  // Note: Lower blocking rate = higher receiving upside
  const blockingPenalty = 1 - n(params.blockingRate, leagueRanges.blockingRate);
  
  const score = 
    0.40 * n(params.routeParticipation, leagueRanges.routeParticipation) +
    0.30 * blockingPenalty +
    0.20 * n(params.redZoneTargets, leagueRanges.redZoneTargets) +
    0.10 * n(params.snapShare ?? 0, leagueRanges.snapShare || [0, 0]);
  
  return Math.round(100 * score);
}

/**
 * Scale to league week: Normalize player values against league for the week
 * @param playerValue Individual player value
 * @param allPlayerValues All league values for the same metric/week
 * @returns 0-100 scaled value
 */
export function scaleLeagueWeek(playerValue: number, allPlayerValues: number[]): number {
  if (!allPlayerValues.length) return 50;
  
  const stats = leagueStats(allPlayerValues);
  const percentile = percentileRank(playerValue, allPlayerValues);
  
  // Apply gentle sigmoid curve to prevent extreme outliers
  const normalized = clamp01(percentile / 100);
  return Math.round(100 * normalized);
}

/**
 * Confidence multiplier for gating rookie/unproven players
 * @param confidence Base confidence (0-1)
 * @param isRookie Whether player is a rookie
 * @param gamesPlayed Number of games played this season
 * @returns Adjusted confidence multiplier
 */
export function confidenceGating(
  confidence: number, 
  isRookie: boolean = false, 
  gamesPlayed: number = 0
): number {
  let baseConfidence = clamp01(confidence);
  
  // Rookie penalty
  if (isRookie) {
    baseConfidence *= 0.85;
  }
  
  // Games played bonus (gradual confidence building)
  const gameBonus = Math.min(0.15, gamesPlayed * 0.02);
  baseConfidence += gameBonus;
  
  // Ensure minimum confidence of 0.85 + 0.15 * confidence
  return Math.max(0.85, Math.min(1.0, 0.85 + 0.15 * baseConfidence));
}

/**
 * Variance calculation for floor/ceiling analysis
 * @param series Array of values
 * @returns Variance value
 */
export function variance(series: number[]): number {
  if (series.length < 2) return 0;
  
  const mean = series.reduce((sum, val) => sum + val, 0) / series.length;
  const squaredDiffs = series.map(val => Math.pow(val - mean, 2));
  
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / series.length;
}

/**
 * League ranges for normalization (typical ranges for each metric)
 */
export const LEAGUE_RANGES = {
  QB: {
    designedRunRate: [0, 0.25] as [number, number],
    scrambleYdsG: [0, 40] as [number, number],
    rzRushShare: [0, 0.35] as [number, number],
    explosiveRate: [0, 0.15] as [number, number]
  },
  RB: {
    inside10Share: [0, 0.60] as [number, number],
    snapShare: [0, 1.0] as [number, number],
    targetShare: [0, 0.25] as [number, number],
    goalLineCarries: [0, 15] as [number, number]
  },
  WR: {
    targetsPerRoute: [0, 0.35] as [number, number],
    airYardsShare: [0, 0.40] as [number, number],
    slotRate: [0, 1.0] as [number, number],
    redZoneTargets: [0, 25] as [number, number]
  },
  TE: {
    routeParticipation: [0, 0.85] as [number, number],
    blockingRate: [0, 0.60] as [number, number],
    redZoneTargets: [0, 20] as [number, number],
    snapShare: [0, 1.0] as [number, number]
  }
} as const;