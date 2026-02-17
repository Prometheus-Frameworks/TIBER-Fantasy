/**
 * xFPTS v2 Configuration
 * Context-aware expected fantasy points configuration
 * 
 * v1: Usage-only baselines (targets/carries + positional buckets)
 * v2: v1 × small, capped multipliers from nflfastR metrics
 */

export const xFptsConfig = {
  // v1 coefficients (from existing implementation)
  v1Coefficients: {
    WR: { ppt: 1.85, ppr: 0.0 },
    TE: { ppt: 1.65, ppr: 0.0 },
    RB: { ppt: 1.50, ppr: 0.85 },
    QB: { ppt: 0.0, ppr: 0.0 },
  },

  // Performance tag thresholds
  tagThresholds: {
    minGames: 3,
    riserThreshold: 3.0,
    fallerThreshold: -3.0,
    neutralBand: 1.0,
  },
};

/**
 * Context configuration for v2 multipliers
 * 
 * IMPORTANT: Final multipliers are hard-capped to documented ranges:
 * - Receiving context: 1.0 to 1.3 (no penalty below baseline)
 * - Rush context: 0.8 to 1.2 (can penalize poor rushing)
 * 
 * Individual component caps are set so combined values stay within final bounds.
 */
export const contextConfig = {
  // Baseline averages
  yacLeagueAvg: 4.5,      // baseline YAC per reception
  rzNeutralShare: 0.15,   // ~15% of targets in RZ treated as "normal"

  // FINAL MULTIPLIER BOUNDS (hard caps on combined multiplier)
  recMultiplierMin: 1.0,   // Receiving context cannot penalize
  recMultiplierMax: 1.3,   // +30% max for receiving context
  rushMultiplierMin: 0.8,  // -20% max penalty for rush context
  rushMultiplierMax: 1.2,  // +20% max boost for rush context

  // Component-level caps (individual contributions before combining)
  // Red Zone: main driver of receiving boost
  rzScalingFactor: 1.0,    // Scaling factor for RZ share deviation
  rzMaxContribution: 0.20, // Max +20% from RZ alone

  // YAC: secondary receiving boost
  yacScalingFactor: 0.3,   // Scaling factor for YAC ratio deviation
  yacMaxContribution: 0.10, // Max +10% from YAC alone

  // Rush EPA: primary rush context driver
  epaScalingFactor: 0.3,   // Scaling factor for EPA
  epaMaxContribution: 0.15, // Max ±15% from EPA

  // Rush success rate: secondary rush context
  successScalingFactor: 0.2, // Scaling factor for success rate deviation
  successMaxContribution: 0.08, // Max ±8% from success rate
};

/**
 * v3 per-opportunity xFP coefficients for FORGE volume pillar
 *
 * These represent league-average expected PPR fantasy points per opportunity type.
 * Used to price opportunity quality — not all touches are created equal.
 *
 * Sources: Derived from league-wide PPR averages (nflverse play-by-play).
 * A target is worth ~2.5-3x a carry in PPR due to the reception bonus.
 */
export const xfpV3Coefficients = {
  RB: {
    carryNonRZ: 0.45,     // Standard carry between the 20s
    carryRZ: 0.85,        // Red zone carry (inside 20)
    target: 1.50,         // RB target (reception bonus + yards)
  },
  WR: {
    targetNonDeep: 1.60,  // Standard target (short/intermediate)
    targetDeep: 2.25,     // Deep target (air yards > 15)
  },
  TE: {
    targetNonRZ: 1.45,    // Standard TE target
    targetRZ: 2.50,       // Red zone TE target (high TD value)
  },
  QB: {
    dropback: 0.50,       // Per dropback value
    rushAttempt: 0.65,    // QB rush attempt (higher value due to scramble upside)
  },
} as const;

/**
 * Position-specific normalization ranges for xFP per game → 0-100 pillar score
 * Based on expected distributions: min is ~replacement level, max is ~elite
 */
export const xfpNormalizationRanges: Record<string, { min: number; max: number }> = {
  RB: { min: 3.0, max: 18.0 },   // ~3 xFP/G for low-usage to ~18 for bellcow
  WR: { min: 4.0, max: 20.0 },   // ~4 xFP/G for depth to ~20 for alpha WR
  TE: { min: 2.0, max: 14.0 },   // ~2 xFP/G for blocking TE to ~14 for elite
  QB: { min: 8.0, max: 25.0 },   // ~8 xFP/G for game manager to ~25 for elite
};

/**
 * Clamp a value between min and max bounds
 * Used to keep v2 multipliers sane and prevent explosions
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate v1 expected PPR fantasy points based on opportunity volume
 * xPPR = (targets × ppt) + (rush_attempts × ppr)
 */
export function calculateXFptsV1(
  targets: number,
  rushAttempts: number,
  position: string
): { recPpr: number; rushPpr: number; totalPpr: number } {
  const coeffs = xFptsConfig.v1Coefficients[position as keyof typeof xFptsConfig.v1Coefficients];
  if (!coeffs) {
    return { recPpr: 0, rushPpr: 0, totalPpr: 0 };
  }
  
  const recPpr = targets * coeffs.ppt;
  const rushPpr = rushAttempts * coeffs.ppr;
  return {
    recPpr,
    rushPpr,
    totalPpr: recPpr + rushPpr,
  };
}

export type PerformanceTag = "RISER" | "FALLER" | "NEUTRAL" | null;

/**
 * Determine performance tag based on xFPGoe
 * Returns null if insufficient games for stable classification
 */
export function getPerformanceTag(
  xfpgoe: number,
  gamesPlayed: number
): PerformanceTag {
  const { minGames, riserThreshold, fallerThreshold, neutralBand } = xFptsConfig.tagThresholds;
  
  if (gamesPlayed < minGames) return null;

  if (xfpgoe >= riserThreshold) return "RISER";
  if (xfpgoe <= fallerThreshold) return "FALLER";
  if (Math.abs(xfpgoe) < neutralBand) return "NEUTRAL";

  return "NEUTRAL";
}

/**
 * Calculate receiving context multiplier for v2
 * Based on RZ share and YAC ratio
 * 
 * FINAL MULTIPLIER IS HARD-CAPPED TO [1.0, 1.3]
 * Receiving context can only boost, never penalize
 */
export function calculateRecMultiplier(
  rzTargets: number,
  targets: number,
  yacPerRec: number | null
): { multiplier: number; rzShare: number; yacRatio: number; rzBoost: number; yacBoost: number } {
  let rzShare = 0;
  let yacRatio = 1;

  if (targets > 0) {
    rzShare = rzTargets / targets;
  }

  if (yacPerRec !== null && yacPerRec > 0) {
    yacRatio = yacPerRec / contextConfig.yacLeagueAvg;
  }

  // Calculate individual component boosts (can be negative internally)
  const rzDeviation = rzShare - contextConfig.rzNeutralShare;
  const rzRawBoost = rzDeviation * contextConfig.rzScalingFactor;
  const rzBoost = clamp(rzRawBoost, 0, contextConfig.rzMaxContribution);

  const yacDeviation = yacRatio - 1;
  const yacRawBoost = yacDeviation * contextConfig.yacScalingFactor;
  const yacBoost = clamp(yacRawBoost, 0, contextConfig.yacMaxContribution);

  // Combine and apply FINAL HARD CLAMP to documented range [1.0, 1.3]
  const rawMultiplier = 1 + rzBoost + yacBoost;
  const multiplier = clamp(
    rawMultiplier,
    contextConfig.recMultiplierMin,
    contextConfig.recMultiplierMax
  );

  return { multiplier, rzShare, yacRatio, rzBoost, yacBoost };
}

/**
 * Calculate rushing context multiplier for v2
 * Based on EPA per rush and success rate
 * 
 * FINAL MULTIPLIER IS HARD-CAPPED TO [0.8, 1.2]
 * Rush context CAN penalize poor efficiency
 */
export function calculateRushMultiplier(
  rushEpa: number | null,
  rushSuccess: number | null,
  rushAttempts: number
): { multiplier: number; epaCtx: number; successCtx: number } {
  if (rushAttempts === 0) {
    return { multiplier: 1, epaCtx: 0, successCtx: 0 };
  }

  const epa = rushEpa ?? 0;
  const success = rushSuccess ?? 0.5; // neutral default (50% success rate)

  // EPA contribution: positive EPA = boost, negative EPA = penalty
  const epaRawContribution = epa * contextConfig.epaScalingFactor;
  const epaCtx = clamp(
    epaRawContribution,
    -contextConfig.epaMaxContribution,
    contextConfig.epaMaxContribution
  );

  // Success rate contribution: 50% is neutral, above = boost, below = penalty
  const successDeviation = success - 0.5;
  const successRawContribution = successDeviation * contextConfig.successScalingFactor;
  const successCtx = clamp(
    successRawContribution,
    -contextConfig.successMaxContribution,
    contextConfig.successMaxContribution
  );

  // Combine and apply FINAL HARD CLAMP to documented range [0.8, 1.2]
  const rawMultiplier = 1 + epaCtx + successCtx;
  const multiplier = clamp(
    rawMultiplier,
    contextConfig.rushMultiplierMin,
    contextConfig.rushMultiplierMax
  );

  return { multiplier, epaCtx, successCtx };
}
