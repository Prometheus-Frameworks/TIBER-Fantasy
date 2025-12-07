/**
 * FORGE v0.1 - Alpha Engine
 * 
 * Core scoring engine that calculates:
 * - Sub-scores (volume, efficiency, roleLeverage, stability, contextFit)
 * - Overall Alpha (0-100)
 * - Trajectory (rising, flat, declining)
 * - Confidence (0-100)
 */

import { 
  ForgeScore, 
  ForgeContext, 
  ForgeFeatureBundle, 
  ForgeSubScores,
  Trajectory,
  PlayerPosition,
  FPRData,
  FantasyStats,
  TeamEnvironment,
  MatchupContext,
  ALPHA_WEIGHTS,
  ALPHA_CALIBRATION,
  TRAJECTORY_THRESHOLDS,
  CONFIDENCE_CONFIG,
  MISSING_DATA_CAPS,
} from './types';
import { clamp, roundTo } from './utils/scoring';
import { computeFPR, FPROutput } from './fibonacciPatternResonance';
import { applyForgeModifiers } from './forgeAlphaModifiers';

/**
 * Optional modifiers for alpha calculation
 */
export interface AlphaModifierContext {
  env?: TeamEnvironment | null;
  matchup?: MatchupContext | null;
}

/**
 * Calculate the complete FORGE score for a player
 * 
 * The scoring pipeline is:
 *   rawAlpha → envAdjustedAlpha → matchupAdjustedAlpha → calibratedAlpha
 * 
 * @param context - Player context data
 * @param features - Computed feature bundle
 * @param modifiers - Optional environment/matchup modifiers
 */
export function calculateAlphaScore(
  context: ForgeContext,
  features: ForgeFeatureBundle,
  modifiers?: AlphaModifierContext
): ForgeScore {
  console.log(`[FORGE/AlphaEngine] Calculating alpha for ${context.playerName} (${context.position})`);
  
  const subScores = calculateSubScores(features);
  const rawAlpha = calculateWeightedAlpha(subScores, context.position);
  
  // Apply environment and matchup modifiers (v0.1)
  // If modifiers are provided, adjust rawAlpha before calibration
  let modifiedAlpha = rawAlpha;
  if (modifiers) {
    try {
      modifiedAlpha = applyForgeModifiers(
        rawAlpha,
        modifiers.env ?? null,
        modifiers.matchup ?? null
      );
      if (modifiers.env || modifiers.matchup) {
        console.log(`[FORGE/AlphaEngine] Applied modifiers: raw=${rawAlpha.toFixed(1)} → modified=${modifiedAlpha.toFixed(1)}`);
      }
    } catch (err) {
      console.error(`[FORGE/AlphaEngine] Modifier application failed, using rawAlpha:`, err);
      modifiedAlpha = rawAlpha;
    }
  }
  
  const calibratedAlpha = calibrateAlpha(context.position, modifiedAlpha);
  
  const trajectory = calculateTrajectory(context);
  const confidence = calculateConfidence(context, features);
  
  const fpr = calculateFPR(context);
  
  const cappedDueToMissingData = 
    features.efficiencyFeatures.capped ||
    features.contextFitFeatures.isNeutral ||
    features.gamesPlayed < 3;
  
  // v1.2: Calculate fantasy stats from context
  const fantasyStats = calculateFantasyStats(context, features.gamesPlayed);
  
  return {
    playerId: context.playerId,
    playerName: context.playerName,
    position: context.position,
    nflTeam: context.nflTeam,
    season: context.season,
    asOfWeek: context.asOfWeek,
    
    alpha: roundTo(calibratedAlpha, 1),
    rawAlpha: roundTo(rawAlpha, 1),
    subScores: {
      volume: roundTo(subScores.volume, 1),
      efficiency: roundTo(subScores.efficiency, 1),
      stability: roundTo(subScores.stability, 1),
      contextFit: roundTo(subScores.contextFit, 1),
    },
    trajectory,
    confidence: roundTo(confidence, 0),
    
    gamesPlayed: features.gamesPlayed,
    
    fpr,
    
    fantasyStats,
    
    dataQuality: {
      hasAdvancedStats: features.dataQuality.hasAdvancedStats,
      hasSnapData: features.dataQuality.hasSnapData,
      hasDvPData: features.dataQuality.hasDvPData,
      hasEnvironmentData: features.dataQuality.hasEnvironmentData,
      cappedDueToMissingData,
    },
    
    scoredAt: new Date(),
  };
}

/**
 * Extract sub-scores from the feature bundle
 * v0.2: roleLeverage removed
 */
function calculateSubScores(features: ForgeFeatureBundle): ForgeSubScores {
  return {
    volume: features.volumeFeatures.score,
    efficiency: features.efficiencyFeatures.score,
    stability: features.stabilityFeatures.score,
    contextFit: features.contextFitFeatures.score,
  };
}

/**
 * Calculate weighted alpha using position-specific weights
 * v0.2: roleLeverage removed from calculation
 */
function calculateWeightedAlpha(
  subScores: ForgeSubScores,
  position: ForgeContext['position']
): number {
  const weights = ALPHA_WEIGHTS[position];
  
  const alpha = 
    subScores.volume * weights.volume +
    subScores.efficiency * weights.efficiency +
    subScores.stability * weights.stability +
    subScores.contextFit * weights.contextFit;
  
  return clamp(alpha, 0, 100);
}

/**
 * Calibrate raw alpha score to a more intuitive 0-100 scale
 * 
 * Uses position-specific linear remapping based on observed distribution.
 * The calibration is monotonic: higher raw scores always produce higher calibrated scores.
 * 
 * Formula: calibrated = outMin + ((raw - p10) / (p90 - p10)) * (outMax - outMin)
 * 
 * v1.2 FIX: No longer clamps rawAlpha before mapping. This allows elite players
 * with raw scores above p90 to exceed the outMax calibrated value (up to 100).
 * Only the final output is clamped to [0, 100].
 */
function calibrateAlpha(position: PlayerPosition, rawAlpha: number): number {
  const config = ALPHA_CALIBRATION[position];
  
  if (!config) {
    return rawAlpha;
  }
  
  const { p10, p90, outMin, outMax } = config;
  
  if (p90 === p10) {
    return rawAlpha;
  }
  
  // v1.2: Use raw alpha directly without pre-clamping
  // This allows scores above p90 to map above outMax (capped at 100)
  const t = (rawAlpha - p10) / (p90 - p10);
  const mapped = outMin + t * (outMax - outMin);
  
  // Only clamp final output to valid 0-100 range
  return clamp(mapped, 0, 100);
}

/**
 * Calculate trajectory based on rolling vs season alpha
 * 
 * Per spec:
 * - Compute rolling weighted Alpha: 50% last 3 games, 30% games 4-6, 20% rest
 * - delta = current_rolling_alpha - season_alpha_to_date
 * - rising: delta >= +6
 * - flat: -6 < delta < +6
 * - declining: delta <= -6
 */
function calculateTrajectory(context: ForgeContext): Trajectory {
  const gamesPlayed = context.seasonStats.gamesPlayed;
  
  if (gamesPlayed < 3) {
    return 'flat';
  }
  
  const weeklyPts = context.weeklyStats.map(w => w.fantasyPointsPpr);
  if (weeklyPts.length < 3) {
    return 'flat';
  }
  
  const sorted = [...weeklyPts].sort((a, b) => {
    const weekA = context.weeklyStats.find(w => w.fantasyPointsPpr === a)?.week ?? 0;
    const weekB = context.weeklyStats.find(w => w.fantasyPointsPpr === b)?.week ?? 0;
    return weekB - weekA;
  });
  
  const last3 = sorted.slice(0, 3);
  const games4to6 = sorted.slice(3, 6);
  const restOfSeason = sorted.slice(6);
  
  const avg = (arr: number[]) => 
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  
  const last3Avg = avg(last3);
  const games4to6Avg = games4to6.length > 0 ? avg(games4to6) : last3Avg;
  const restAvg = restOfSeason.length > 0 ? avg(restOfSeason) : games4to6Avg;
  
  const rollingAlpha = last3Avg * 0.50 + games4to6Avg * 0.30 + restAvg * 0.20;
  const seasonAlpha = avg(weeklyPts);
  
  const delta = rollingAlpha - seasonAlpha;
  
  if (delta >= TRAJECTORY_THRESHOLDS.RISING) {
    return 'rising';
  } else if (delta <= TRAJECTORY_THRESHOLDS.DECLINING) {
    return 'declining';
  }
  
  return 'flat';
}

/**
 * Calculate confidence score (0-100)
 * 
 * Per spec:
 * base = min(100, games_played × 8)
 * 
 * Adjustments:
 * - <4 games played → -30
 * - <6 games → -15
 * - injury flag last 30 days → -20
 * - std_dev of last 5 weeks > 1.8× position avg → -15
 * - missing snap counts → -10
 * - missing DvP data → -5
 * 
 * Clamp: 20-100
 */
function calculateConfidence(
  context: ForgeContext,
  features: ForgeFeatureBundle
): number {
  const { gamesPlayed } = features;
  
  let base = Math.min(
    CONFIDENCE_CONFIG.MAX_BASE,
    gamesPlayed * CONFIDENCE_CONFIG.BASE_PER_GAME
  );
  
  if (gamesPlayed < 4) {
    base += CONFIDENCE_CONFIG.ADJUSTMENTS.LESS_THAN_4_GAMES;
  } else if (gamesPlayed < 6) {
    base += CONFIDENCE_CONFIG.ADJUSTMENTS.LESS_THAN_6_GAMES;
  }
  
  if (context.injuryStatus?.hasRecentInjury) {
    base += CONFIDENCE_CONFIG.ADJUSTMENTS.RECENT_INJURY;
  }
  
  const weeklyPts = context.weeklyStats.slice(0, 5).map(w => w.fantasyPointsPpr);
  if (weeklyPts.length >= 3) {
    const mean = weeklyPts.reduce((s, v) => s + v, 0) / weeklyPts.length;
    const variance = weeklyPts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / weeklyPts.length;
    const stdDev = Math.sqrt(variance);
    
    const positionAvgStdDev = getPositionAvgStdDev(context.position);
    if (stdDev > positionAvgStdDev * 1.8) {
      base += CONFIDENCE_CONFIG.ADJUSTMENTS.HIGH_VOLATILITY;
    }
  }
  
  if (!features.dataQuality.hasSnapData) {
    base += CONFIDENCE_CONFIG.ADJUSTMENTS.MISSING_SNAPS;
  }
  
  if (!features.dataQuality.hasDvPData) {
    base += CONFIDENCE_CONFIG.ADJUSTMENTS.MISSING_DVP;
  }
  
  if (gamesPlayed < 3) {
    base = Math.min(base, MISSING_DATA_CAPS.LESS_THAN_3_GAMES_CONFIDENCE);
  }
  
  return clamp(base, CONFIDENCE_CONFIG.MIN_FINAL, CONFIDENCE_CONFIG.MAX_FINAL);
}

/**
 * Get position-specific average standard deviation for volatility comparison
 * These are reasonable defaults based on typical fantasy scoring patterns
 */
function getPositionAvgStdDev(position: ForgeContext['position']): number {
  const avgStdDevs: Record<string, number> = {
    WR: 6.0,
    RB: 7.0,
    TE: 5.5,
    QB: 5.0,
  };
  
  return avgStdDevs[position] ?? 6.0;
}

/**
 * Calculate Fibonacci Pattern Resonance from weekly usage data
 * 
 * Uses context.weeklyStats to extract position-appropriate usage metric:
 * - WR/TE: targets
 * - RB: rushAttempts + targets
 * - QB: based on fantasy points (proxy for pass attempts)
 * 
 * Returns undefined only if there's not enough data points.
 * Even low-score or NOISE patterns are returned as they contain valuable
 * volatility and confidence information.
 */
function calculateFPR(context: ForgeContext): FPRData | undefined {
  const weeklyStats = context.weeklyStats;
  
  if (!weeklyStats || weeklyStats.length < 2) {
    return undefined;
  }
  
  const sortedByWeek = [...weeklyStats].sort((a, b) => a.week - b.week);
  
  const usageHistory: number[] = sortedByWeek.map(week => {
    switch (context.position) {
      case 'WR':
      case 'TE':
        return week.targets ?? 0;
      case 'RB':
        return (week.rushAttempts ?? 0) + (week.targets ?? 0);
      case 'QB':
        return week.fantasyPointsPpr;
      default:
        return week.targets ?? 0;
    }
  });
  
  if (usageHistory.length < 2) {
    return undefined;
  }
  
  const fprOutput: FPROutput = computeFPR(usageHistory);
  
  return {
    score: fprOutput.score,
    pattern: fprOutput.pattern as FPRData['pattern'],
    band: fprOutput.band as FPRData['band'],
    forgeConfidenceModifier: fprOutput.forgeConfidenceModifier,
    forgeVolatilityIndex: fprOutput.forgeVolatilityIndex,
  };
}

/**
 * Calculate fantasy stats for Tiber Tiers display
 * v1.2: Extracts fantasy-relevant metrics from context
 * 
 * Computes:
 * - Season totals and PPG (PPR and Half-PPR)
 * - Last 3 games average
 * - Volume metrics (targets, touches, snap%)
 * - Red zone opportunities
 */
function calculateFantasyStats(context: ForgeContext, gamesPlayed: number): FantasyStats {
  const { seasonStats, weeklyStats } = context;
  
  // Season totals from seasonStats
  const seasonFptsPpr = seasonStats?.fantasyPointsPpr ?? 0;
  const receptions = seasonStats?.receptions ?? 0;
  
  // Half-PPR = PPR - (0.5 * receptions)
  const seasonFptsHalf = seasonFptsPpr - (0.5 * receptions);
  
  // PPG calculations
  const games = gamesPlayed > 0 ? gamesPlayed : 1;
  const ppgPpr = seasonFptsPpr / games;
  const ppgHalf = seasonFptsHalf / games;
  
  // Last 3 games average
  const sortedWeeks = [...(weeklyStats || [])].sort((a, b) => b.week - a.week);
  const last3Weeks = sortedWeeks.slice(0, 3);
  
  let last3AvgPpr = 0;
  let last3AvgHalf = 0;
  
  if (last3Weeks.length > 0) {
    const last3SumPpr = last3Weeks.reduce((sum, w) => sum + (w.fantasyPointsPpr || 0), 0);
    const last3Receptions = last3Weeks.reduce((sum, w) => sum + (w.receptions || 0), 0);
    last3AvgPpr = last3SumPpr / last3Weeks.length;
    const last3SumHalf = last3SumPpr - (0.5 * last3Receptions);
    last3AvgHalf = last3SumHalf / last3Weeks.length;
  }
  
  // Volume metrics
  const targets = seasonStats?.targets ?? undefined;
  const rushAttempts = seasonStats?.rushAttempts ?? 0;
  const touches = context.position === 'RB' 
    ? rushAttempts + (targets ?? 0) 
    : undefined;
  
  // Snap percentage (average from weekly data)
  let snapPct: number | undefined;
  if (weeklyStats && weeklyStats.length > 0) {
    const snapsWithData = weeklyStats.filter(w => w.snapShare != null && w.snapShare > 0);
    if (snapsWithData.length > 0) {
      const avgSnap = snapsWithData.reduce((sum, w) => sum + (w.snapShare || 0), 0) / snapsWithData.length;
      snapPct = Math.round(avgSnap);
    }
  }
  
  // Red zone opportunities from advanced metrics
  const rzOpps = (seasonStats?.redZoneTargets ?? 0) + (seasonStats?.redZoneCarries ?? 0) || undefined;
  
  return {
    seasonFptsPpr: roundTo(seasonFptsPpr, 1),
    seasonFptsHalf: roundTo(seasonFptsHalf, 1),
    ppgPpr: roundTo(ppgPpr, 1),
    ppgHalf: roundTo(ppgHalf, 1),
    last3AvgPpr: roundTo(last3AvgPpr, 1),
    last3AvgHalf: roundTo(last3AvgHalf, 1),
    targets,
    touches,
    receptions,
    snapPct,
    rzOpps,
  };
}

export default calculateAlphaScore;
