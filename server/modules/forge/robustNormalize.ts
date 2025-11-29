/**
 * FORGE v0.2 Robust Normalization Utilities
 * 
 * Replaces brittle min-max normalization with:
 * 1. Robust scaling using median and IQR (interquartile range)
 * 2. Sigmoid transformation to 0-100 scale
 * 
 * This approach:
 * - Is less sensitive to outliers than min-max
 * - Produces smoother, more stable scores
 * - Centers around 50 for league average
 * - Uses k=0.8 steepness for readable spread
 */

export interface RobustStats {
  median: number;
  p25: number;
  p75: number;
  iqr: number;
}

const DEFAULT_SIGMOID_K = 0.8;

/**
 * Calculate robust statistics (median, IQR) for a dataset
 */
export function calculateRobustStats(values: number[]): RobustStats {
  if (values.length === 0) {
    return { median: 0, p25: 0, p75: 0, iqr: 1 };
  }

  const sorted = [...values].filter(v => v !== null && !isNaN(v)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { median: 0, p25: 0, p75: 0, iqr: 1 };
  }

  const median = percentile(sorted, 0.5);
  const p25 = percentile(sorted, 0.25);
  const p75 = percentile(sorted, 0.75);
  const iqr = Math.max(p75 - p25, 0.0001); // Prevent divide by zero

  return { median, p25, p75, iqr };
}

/**
 * Compute percentile value from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Robust normalize a single value to 0-100 using IQR scaling + sigmoid
 * 
 * Formula:
 *   x_robust = (x - median) / IQR
 *   score = 100 / (1 + exp(-k * x_robust))
 * 
 * @param value - Raw metric value
 * @param stats - Pre-computed robust stats for the metric
 * @param k - Sigmoid steepness (default 0.8)
 * @param invert - If true, lower raw values = higher scores
 */
export function robustNormalize(
  value: number | null,
  stats: RobustStats,
  k: number = DEFAULT_SIGMOID_K,
  invert: boolean = false
): number {
  if (value === null || isNaN(value)) {
    return 50; // League average fallback
  }

  // Robust standardization
  let xRobust = (value - stats.median) / stats.iqr;
  
  // Invert if needed (e.g., pressure rate where lower is better)
  if (invert) {
    xRobust = -xRobust;
  }

  // Sigmoid transformation to 0-100
  const score = 100.0 / (1.0 + Math.exp(-k * xRobust));

  // Clamp just in case
  return Math.max(0, Math.min(100, score));
}

/**
 * Batch compute robust stats for multiple metrics
 */
export function computeMetricStats(
  rows: any[],
  metricName: string
): RobustStats {
  const values = rows
    .map(r => r[metricName])
    .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  
  return calculateRobustStats(values);
}

/**
 * Helper to create a score component with raw value and normalized score
 */
export interface ScoreComponent {
  raw: number | null;
  score: number;
}

export function createComponent(
  raw: number | null,
  stats: RobustStats,
  k: number = DEFAULT_SIGMOID_K,
  invert: boolean = false
): ScoreComponent {
  return {
    raw,
    score: robustNormalize(raw, stats, k, invert),
  };
}

/**
 * v0.2 Robust Stats for common metrics
 * Used when we can't compute real stats from data
 */
export const TYPICAL_NFL_STATS: Record<string, RobustStats> = {
  // Offensive metrics
  qb_epa_per_play: { median: 0.05, p25: -0.05, p75: 0.15, iqr: 0.20 },
  pass_epa: { median: 0.08, p25: -0.02, p75: 0.18, iqr: 0.20 },
  cpoe: { median: 0.02, p25: -0.02, p75: 0.06, iqr: 0.08 },
  pressure_rate_allowed: { median: 0.30, p25: 0.25, p75: 0.35, iqr: 0.10 },
  run_success_rate: { median: 0.42, p25: 0.38, p75: 0.46, iqr: 0.08 },
  
  // Defensive metrics
  pass_epa_allowed: { median: 0.05, p25: -0.05, p75: 0.15, iqr: 0.20 },
  rush_epa_allowed: { median: -0.05, p25: -0.12, p75: 0.02, iqr: 0.14 },
  pressure_rate_generated: { median: 0.28, p25: 0.22, p75: 0.34, iqr: 0.12 },
  explosive_rate: { median: 4, p25: 2, p75: 6, iqr: 4 },
  ypa_allowed: { median: 7.2, p25: 6.5, p75: 7.9, iqr: 1.4 },
};

export default {
  calculateRobustStats,
  robustNormalize,
  computeMetricStats,
  createComponent,
  TYPICAL_NFL_STATS,
};
