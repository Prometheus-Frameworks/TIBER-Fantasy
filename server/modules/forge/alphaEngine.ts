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
  ALPHA_WEIGHTS,
  ALPHA_CALIBRATION,
  TRAJECTORY_THRESHOLDS,
  CONFIDENCE_CONFIG,
  MISSING_DATA_CAPS,
} from './types';
import { clamp, roundTo } from './utils/scoring';

/**
 * Calculate the complete FORGE score for a player
 */
export function calculateAlphaScore(
  context: ForgeContext,
  features: ForgeFeatureBundle
): ForgeScore {
  console.log(`[FORGE/AlphaEngine] Calculating alpha for ${context.playerName} (${context.position})`);
  
  const subScores = calculateSubScores(features);
  const rawAlpha = calculateWeightedAlpha(subScores, context.position);
  
  const calibratedAlpha = calibrateAlpha(context.position, rawAlpha);
  
  const trajectory = calculateTrajectory(context);
  const confidence = calculateConfidence(context, features);
  
  const cappedDueToMissingData = 
    features.efficiencyFeatures.capped ||
    features.roleLeverageFeatures.capped ||
    features.contextFitFeatures.isNeutral ||
    features.gamesPlayed < 3;
  
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
      roleLeverage: roundTo(subScores.roleLeverage, 1),
      stability: roundTo(subScores.stability, 1),
      contextFit: roundTo(subScores.contextFit, 1),
    },
    trajectory,
    confidence: roundTo(confidence, 0),
    
    gamesPlayed: features.gamesPlayed,
    
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
 */
function calculateSubScores(features: ForgeFeatureBundle): ForgeSubScores {
  return {
    volume: features.volumeFeatures.score,
    efficiency: features.efficiencyFeatures.score,
    roleLeverage: features.roleLeverageFeatures.score,
    stability: features.stabilityFeatures.score,
    contextFit: features.contextFitFeatures.score,
  };
}

/**
 * Calculate weighted alpha using position-specific weights
 */
function calculateWeightedAlpha(
  subScores: ForgeSubScores,
  position: ForgeContext['position']
): number {
  const weights = ALPHA_WEIGHTS[position];
  
  const alpha = 
    subScores.volume * weights.volume +
    subScores.efficiency * weights.efficiency +
    subScores.roleLeverage * weights.roleLeverage +
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
 * Formula: calibrated = floor + ((raw - rawFloor) / (rawCeiling - rawFloor)) * (ceiling - floor)
 * Then clamped to [clampMin, clampMax]
 */
function calibrateAlpha(position: PlayerPosition, rawAlpha: number): number {
  const config = ALPHA_CALIBRATION[position];
  
  if (!config) {
    return rawAlpha;
  }
  
  const { rawFloor, rawCeiling, calibratedFloor, calibratedCeiling, clampMin, clampMax } = config;
  
  const rawSpan = rawCeiling - rawFloor;
  if (rawSpan <= 0) {
    return rawAlpha;
  }
  
  const normalized = (rawAlpha - rawFloor) / rawSpan;
  
  const calibratedSpan = calibratedCeiling - calibratedFloor;
  const scaled = calibratedFloor + normalized * calibratedSpan;
  
  return clamp(scaled, clampMin, clampMax);
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

export default calculateAlphaScore;
