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
 * All adjustments are capped to prevent wild swings
 */
export const contextConfig = {
  // Baseline averages
  yacLeagueAvg: 4.5,      // baseline YAC per reception
  rzNeutralShare: 0.15,   // ~15% of targets in RZ treated as "normal"

  // Red Zone context caps (percent multipliers)
  rzMaxBoost: 0.20,       // +20% max from RZ context
  rzMaxPenalty: -0.10,    // -10% if completely RZ-starved

  // YAC context caps
  yacMaxBoost: 0.15,      // +15% max for elite YAC
  yacMaxPenalty: -0.05,   // -5% for low YAC

  // Rush EPA context caps
  epaMaxBoost: 0.15,      // +15% from rush EPA
  epaMaxPenalty: -0.15,   // -15% penalty from bad EPA

  // Rush success rate context caps
  successMaxBoost: 0.10,  // +10% if very high success
  successMaxPenalty: -0.05,
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

  // Map rzShare to a small boost/penalty around neutral RZ usage
  const rzBoost = clamp(
    (rzShare - contextConfig.rzNeutralShare) * 0.8,
    contextConfig.rzMaxPenalty,
    contextConfig.rzMaxBoost
  );

  const yacBoost = clamp(
    (yacRatio - 1) * 0.5,
    contextConfig.yacMaxPenalty,
    contextConfig.yacMaxBoost
  );

  const multiplier = 1 + rzBoost + yacBoost;

  return { multiplier, rzShare, yacRatio, rzBoost, yacBoost };
}

/**
 * Calculate rushing context multiplier for v2
 * Based on EPA per rush and success rate
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
  const success = rushSuccess ?? 0.5; // neutral default

  const epaBoost = clamp(
    epa * 0.4, // scaling factor
    contextConfig.epaMaxPenalty,
    contextConfig.epaMaxBoost
  );

  const successBoost = clamp(
    (success - 0.5) * 0.3, // 50% success ~ neutral
    contextConfig.successMaxPenalty,
    contextConfig.successMaxBoost
  );

  const multiplier = 1 + epaBoost + successBoost;

  return { multiplier, epaCtx: epaBoost, successCtx: successBoost };
}
