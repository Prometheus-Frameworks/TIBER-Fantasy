/**
 * FORGE v0.1 - Scoring Utilities
 * 
 * Helper functions for percentile-based scoring, statistical calculations,
 * and value normalization.
 */

/**
 * Calculate percentile score (0-100) for a value within a range
 * @param value - The raw value to score
 * @param min - The minimum value (maps to 0)
 * @param max - The maximum value (maps to 100)
 * @returns Score from 0-100
 */
export function calculatePercentile(
  value: number | undefined | null,
  min: number,
  max: number
): number {
  if (value === undefined || value === null || isNaN(value)) {
    return 50; // Default to neutral
  }
  
  const range = max - min;
  if (range <= 0) return 50;
  
  const normalized = (value - min) / range;
  return clamp(normalized * 100, 0, 100);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate the average of an array of numbers
 */
export function safeAverage(values: (number | undefined | null)[]): number | undefined {
  const validValues = values.filter((v): v is number => v !== undefined && v !== null && !isNaN(v));
  if (validValues.length === 0) return undefined;
  return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
}

/**
 * Calculate standard deviation of weekly fantasy points
 */
export function calculateWeeklyStdDev(weeklyPts: number[]): number | undefined {
  if (weeklyPts.length < 2) return undefined;
  
  const mean = weeklyPts.reduce((sum, v) => sum + v, 0) / weeklyPts.length;
  const squaredDiffs = weeklyPts.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / weeklyPts.length;
  
  return Math.sqrt(variance);
}

/**
 * Calculate floor and boom week rates
 * @param weeklyPts - Array of weekly fantasy points
 * @param floorThreshold - Minimum points for a "floor" week (e.g., 8 for WR)
 * @param boomThreshold - Minimum points for a "boom" week (e.g., 20 for WR)
 * @returns Object with floorRate and boomRate (0-1)
 */
export function calculateFloorBoomRates(
  weeklyPts: number[],
  floorThreshold: number,
  boomThreshold: number
): { floorRate: number; boomRate: number } {
  if (weeklyPts.length === 0) {
    return { floorRate: 0.5, boomRate: 0.1 };
  }
  
  const floorWeeks = weeklyPts.filter(pts => pts >= floorThreshold).length;
  const boomWeeks = weeklyPts.filter(pts => pts >= boomThreshold).length;
  
  return {
    floorRate: floorWeeks / weeklyPts.length,
    boomRate: boomWeeks / weeklyPts.length,
  };
}

/**
 * Calculate rolling weighted average for trajectory analysis
 * Per spec: 50% last 3 games, 30% games 4-6, 20% rest of season
 */
export function calculateRollingWeightedAlpha(
  weeklyAlphas: number[]
): number | undefined {
  if (weeklyAlphas.length === 0) return undefined;
  
  // Sort most recent first
  const sorted = [...weeklyAlphas].reverse();
  
  // Split into buckets
  const last3 = sorted.slice(0, 3);
  const games4to6 = sorted.slice(3, 6);
  const restOfSeason = sorted.slice(6);
  
  const avg = (arr: number[]) => 
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  
  const last3Avg = avg(last3);
  const games4to6Avg = games4to6.length > 0 ? avg(games4to6) : last3Avg;
  const restAvg = restOfSeason.length > 0 ? avg(restOfSeason) : games4to6Avg;
  
  // Weighted average: 50% last 3, 30% games 4-6, 20% rest
  return last3Avg * 0.50 + games4to6Avg * 0.30 + restAvg * 0.20;
}

/**
 * Calculate season-to-date alpha average
 */
export function calculateSeasonAlpha(weeklyAlphas: number[]): number | undefined {
  if (weeklyAlphas.length === 0) return undefined;
  return weeklyAlphas.reduce((s, v) => s + v, 0) / weeklyAlphas.length;
}

/**
 * Round to specified decimal places
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
