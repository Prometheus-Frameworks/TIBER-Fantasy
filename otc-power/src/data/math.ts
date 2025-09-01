/**
 * Mathematical Utilities for Advanced Analytics
 * 
 * Phase B/C: Core mathematical functions for EWMA smoothing, scaling, and normalization
 * These functions provide the mathematical foundation for feature computation
 */

/**
 * Exponentially Weighted Moving Average (EWMA)
 * @param series Array of values (most recent first)
 * @param alpha Learning rate (0-1, higher = more weight on recent values)
 * @returns EWMA-smoothed value
 */
export function ewma01(series: number[], alpha: number): number {
  if (!series.length) return 0;
  
  let acc = series[0] ?? 0;
  for (const x of series) {
    acc = alpha * x + (1 - alpha) * acc;
  }
  return acc;
}

/**
 * Min-Max scaling to normalize values between 0 and 1
 * @param x Value to scale
 * @param min Minimum value in range
 * @param max Maximum value in range
 * @returns Scaled value between 0 and 1
 */
export function minMaxScale(x: number, min: number, max: number): number {
  if (max <= min) return 0.5; // Handle edge case
  return (x - min) / (max - min);
}

/**
 * Clamp value between 0 and 1
 * @param x Value to clamp
 * @returns Value clamped between 0 and 1
 */
export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * League-wide percentile calculation
 * @param value Player's value
 * @param allValues Array of all league values for comparison
 * @returns Percentile rank (0-100)
 */
export function percentileRank(value: number, allValues: number[]): number {
  if (!allValues.length) return 50;
  
  const sorted = [...allValues].sort((a, b) => a - b);
  const rank = sorted.findIndex(v => v >= value);
  
  if (rank === -1) return 100; // Value is higher than all others
  
  return (rank / sorted.length) * 100;
}

/**
 * Z-score normalization
 * @param value Value to normalize
 * @param mean League mean
 * @param stdDev League standard deviation
 * @returns Z-score
 */
export function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Sigmoid curve for confidence gating
 * @param x Input value
 * @param midpoint Midpoint of sigmoid curve
 * @param steepness Steepness factor (higher = steeper)
 * @returns Value between 0 and 1
 */
export function sigmoid(x: number, midpoint: number = 0, steepness: number = 1): number {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

/**
 * Calculate league-wide statistics for normalization
 * @param values Array of values
 * @returns Object with mean, median, std, min, max, and percentiles
 */
export function leagueStats(values: number[]): {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  p90: number;
} {
  if (!values.length) {
    return { mean: 0, median: 0, std: 0, min: 0, max: 0, p25: 0, p75: 0, p90: 0 };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / n;
  const median = n % 2 === 0 
    ? (sorted[n/2 - 1] + sorted[n/2]) / 2 
    : sorted[Math.floor(n/2)];
    
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const std = Math.sqrt(variance);
  
  return {
    mean,
    median,
    std,
    min: sorted[0],
    max: sorted[n - 1],
    p25: sorted[Math.floor(n * 0.25)],
    p75: sorted[Math.floor(n * 0.75)],
    p90: sorted[Math.floor(n * 0.90)]
  };
}

/**
 * Weighted average calculation
 * @param values Array of {value, weight} objects
 * @returns Weighted average
 */
export function weightedAverage(values: Array<{value: number, weight: number}>): number {
  if (!values.length) return 0;
  
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;
  
  const weightedSum = values.reduce((sum, item) => sum + (item.value * item.weight), 0);
  return weightedSum / totalWeight;
}

/**
 * Rolling window calculation (last N periods)
 * @param series Time series data (newest first)
 * @param windowSize Number of periods to include
 * @returns Array of values in the rolling window
 */
export function rollingWindow(series: number[], windowSize: number): number[] {
  return series.slice(0, windowSize);
}

/**
 * Composite score calculation with position-specific weights
 * @param components Object with component scores
 * @param weights Object with component weights (should sum to 1.0)
 * @returns Weighted composite score
 */
export function compositeScore(
  components: Record<string, number>, 
  weights: Record<string, number>
): number {
  let score = 0;
  let totalWeight = 0;
  
  for (const [component, value] of Object.entries(components)) {
    const weight = weights[component] ?? 0;
    score += value * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? score / totalWeight : 0;
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