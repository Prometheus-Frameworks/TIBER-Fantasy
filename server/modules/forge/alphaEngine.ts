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
  ForgeScoreOptions,
  ALPHA_WEIGHTS,
  ALPHA_CALIBRATION,
  TRAJECTORY_THRESHOLDS,
  CONFIDENCE_CONFIG,
  MISSING_DATA_CAPS,
  DEFAULT_SCORE_OPTIONS,
  DYNASTY_AGE_CONFIG,
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
 *   rawAlpha → envAdjustedAlpha → matchupAdjustedAlpha → calibratedAlpha → dynastyAdjusted
 * 
 * v1.4: Added PPR/Dynasty scoring options
 * - PPR: Scales efficiency subscore based on reception weight (0.5 or 1.0)
 * - Dynasty: Applies age multiplier after calibration
 * 
 * @param context - Player context data
 * @param features - Computed feature bundle
 * @param modifiers - Optional environment/matchup modifiers
 * @param scoreOptions - Optional PPR/Dynasty scoring options
 */
export function calculateAlphaScore(
  context: ForgeContext,
  features: ForgeFeatureBundle,
  modifiers?: AlphaModifierContext,
  scoreOptions?: ForgeScoreOptions
): ForgeScore {
  const options = scoreOptions ?? DEFAULT_SCORE_OPTIONS;
  console.log(`[FORGE/AlphaEngine] Calculating alpha for ${context.playerName} (${context.position}) [${options.leagueType}/${options.pprType}PPR]`);
  
  // v1.4: Apply PPR adjustment to efficiency subscore
  const subScores = calculateSubScoresWithPPR(features, context, options);
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
  
  let calibratedAlpha = calibrateAlpha(context.position, modifiedAlpha);
  
  // v1.4: Apply dynasty age multiplier if dynasty league
  if (options.leagueType === 'dynasty') {
    const dynastyMultiplier = getDynastyAgeMultiplier(context.age);
    const dynastyAdjusted = calibratedAlpha * dynastyMultiplier;
    if (dynastyMultiplier !== 1.0) {
      console.log(`[FORGE/AlphaEngine] Dynasty age adj: age=${context.age ?? 'unknown'}, mult=${dynastyMultiplier.toFixed(3)}, alpha=${calibratedAlpha.toFixed(1)}→${dynastyAdjusted.toFixed(1)}`);
    }
    calibratedAlpha = clamp(dynastyAdjusted, 0, 100);
  }
  
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
    age: context.age,
    
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
 * v1.4: Calculate sub-scores with PPR adjustment to efficiency
 * 
 * For full PPR (pprType='1'): Reception-heavy players get a boost to efficiency
 * For half PPR (pprType='0.5'): Smaller boost
 * 
 * The boost is based on receptions per game relative to position average:
 * - WR average: ~5 rec/game, elite ~8+
 * - RB average: ~3 rec/game, pass-catching ~5+
 * - TE average: ~4 rec/game, elite ~6+
 * 
 * Formula: efficiencyBoost = (recPerGame - posAvg) * pprWeight * 2
 * This gives roughly +5-10 points for rec-heavy players in full PPR
 */
function calculateSubScoresWithPPR(
  features: ForgeFeatureBundle, 
  context: ForgeContext, 
  options: ForgeScoreOptions
): ForgeSubScores {
  const baseScores = calculateSubScores(features);
  
  // Only apply PPR adjustment for WR, RB, TE (not QB)
  if (context.position === 'QB') {
    return baseScores;
  }
  
  const pprWeight = options.pprType === '1' ? 1.0 : 0.5;
  
  // Get receptions per game from context
  const receptions = context.seasonStats?.receptions ?? 0;
  const gamesPlayed = context.seasonStats?.gamesPlayed ?? 1;
  const recPerGame = receptions / Math.max(gamesPlayed, 1);
  
  // Position-specific reception averages (approximate league averages for starters)
  const posAvgRec: Record<string, number> = {
    WR: 4.5,
    RB: 2.5,
    TE: 3.5,
  };
  
  const avgRec = posAvgRec[context.position] ?? 3.5;
  const recDiff = recPerGame - avgRec;
  
  // Calculate efficiency boost: +2 points per reception above average in full PPR
  const efficiencyBoost = recDiff * pprWeight * 2;
  
  // Clamp the boost to reasonable range (-5 to +10)
  const clampedBoost = clamp(efficiencyBoost, -5, 10);
  
  if (Math.abs(clampedBoost) > 0.5) {
    console.log(`[FORGE/AlphaEngine] PPR adj for ${context.playerName}: rec/g=${recPerGame.toFixed(1)} (avg=${avgRec}), boost=${clampedBoost.toFixed(1)} to efficiency`);
  }
  
  return {
    ...baseScores,
    efficiency: clamp(baseScores.efficiency + clampedBoost, 0, 100),
  };
}

/**
 * v1.4: Calculate dynasty age multiplier
 * 
 * Under 27: 1.1 (10% boost for youth)
 * Exactly 27: 1.0 (no adjustment)
 * Over 27: 0.95^(age-27) (compounding 5% penalty per year)
 * 
 * Example outputs:
 * - Age 23: 1.1 (10% boost)
 * - Age 27: 1.0 (neutral)
 * - Age 28: 0.95 (5% penalty)
 * - Age 30: 0.857 (14.3% penalty)
 * - Age 32: 0.774 (22.6% penalty)
 */
function getDynastyAgeMultiplier(age?: number): number {
  if (age === undefined || age === null) {
    // Unknown age - log warning and use neutral multiplier
    console.warn(`[FORGE/AlphaEngine] ⚠️ Dynasty mode: Age unknown, using default age ${DYNASTY_AGE_CONFIG.DEFAULT_AGE}`);
    return 1.0; // Neutral for unknown ages
  }
  
  const { YOUTH_THRESHOLD, YOUTH_MULTIPLIER, DECAY_BASE } = DYNASTY_AGE_CONFIG;
  
  if (age < YOUTH_THRESHOLD) {
    return YOUTH_MULTIPLIER; // 1.1 for young players
  } else if (age === YOUTH_THRESHOLD) {
    return 1.0; // Neutral at threshold
  } else {
    // Compounding decay: 0.95^(years over 27)
    const yearsOver = age - YOUTH_THRESHOLD;
    return Math.pow(DECAY_BASE, yearsOver);
  }
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
 * Validate and convert z-score inputs to calibrated alpha (0-100).
 * 
 * v1.3: Added z-score detection with asymmetric scaling to match tier expectations:
 *   - Positive z-scores: calibrated = 50 + z * 23 (z=1.2 → ~78 for T2)
 *   - Negative z-scores: calibrated = 50 + z * 100 (z=-0.3 → ~20 for T5)
 * 
 * This asymmetry reflects fantasy football reality: being slightly below average
 * hurts more than being slightly above average helps.
 * 
 * @param rawValue - The raw input value (could be 0-100 or z-score)
 * @param position - Player position for logging
 * @returns Normalized value in 0-100 range
 */
function normalizeZScoreInput(rawValue: number, position: PlayerPosition): number {
  // Detect z-score-like inputs: values between -5 and 5 that aren't valid percentages
  // A z-score of ±4 is extremely rare (99.997%), so we use -5 to 5 as our detection range
  const isLikelyZScore = rawValue >= -5 && rawValue <= 5 && (rawValue < 0 || rawValue < 10);
  
  if (isLikelyZScore && rawValue < 10) {
    // Asymmetric z-score to calibrated alpha conversion
    // Positive: z=1.2 → 78 (T2-ish), z=2.2 → 100 (elite)
    // Negative: z=-0.3 → 20 (T5), z=-0.5 → 0 (replacement level)
    let converted: number;
    if (rawValue >= 0) {
      // Positive z: multiplier ~23 (z=1.2 → 78, z=2.2 → 100)
      converted = 50 + (rawValue * 23);
    } else {
      // Negative z: multiplier ~100 (z=-0.3 → 20, z=-0.5 → 0)
      converted = 50 + (rawValue * 100);
    }
    const clamped = clamp(converted, 0, 100);
    
    console.warn(`[FORGE/AlphaEngine] ⚠️ Z-score detected for ${position}: z=${rawValue.toFixed(3)} → alpha=${clamped.toFixed(1)} (converted)`);
    return clamped;
  }
  
  // Handle out-of-bounds values (not z-scores but still bad)
  if (rawValue < 0) {
    console.warn(`[FORGE/AlphaEngine] ⚠️ Negative raw alpha for ${position}: ${rawValue.toFixed(1)} → clamped to 0`);
    return 0;
  }
  
  if (rawValue > 100) {
    console.warn(`[FORGE/AlphaEngine] ⚠️ Raw alpha exceeds 100 for ${position}: ${rawValue.toFixed(1)} → clamped to 100`);
    return 100;
  }
  
  return rawValue;
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
 * 
 * v1.3: Added z-score validation with warning logs for out-of-bounds inputs.
 * Z-score inputs are converted directly to calibrated alpha and skip secondary calibration.
 */
function calibrateAlpha(position: PlayerPosition, rawAlpha: number): number {
  // v1.3: Detect z-scores first - they get converted directly to calibrated alpha
  const isZScore = rawAlpha >= -5 && rawAlpha <= 5 && (rawAlpha < 0 || rawAlpha < 10);
  if (isZScore && rawAlpha < 10) {
    // Z-scores bypass secondary calibration - normalizeZScoreInput returns final calibrated value
    return normalizeZScoreInput(rawAlpha, position);
  }
  
  // Normal path: validate and then apply calibration
  const normalizedRaw = normalizeZScoreInput(rawAlpha, position);
  
  const config = ALPHA_CALIBRATION[position];
  
  if (!config) {
    return normalizedRaw;
  }
  
  const { p10, p90, outMin, outMax } = config;
  
  if (p90 === p10) {
    return normalizedRaw;
  }
  
  // v1.2: Use raw alpha directly without pre-clamping
  // This allows scores above p90 to map above outMax (capped at 100)
  const t = (normalizedRaw - p10) / (p90 - p10);
  const mapped = outMin + t * (outMax - outMin);
  
  // Log warning if mapping produces extreme values
  if (normalizedRaw < p10 - 10) {
    console.warn(`[FORGE/AlphaEngine] ⚠️ Very low alpha for ${position}: raw=${normalizedRaw.toFixed(1)} < p10=${p10}, calibrated=${Math.max(0, mapped).toFixed(1)}`);
  } else if (normalizedRaw > p90 + 10) {
    console.warn(`[FORGE/AlphaEngine] ⚠️ Very high alpha for ${position}: raw=${normalizedRaw.toFixed(1)} > p90=${p90}, calibrated=${Math.min(100, mapped).toFixed(1)}`);
  }
  
  // Only clamp final output to valid 0-100 range
  return clamp(mapped, 0, 100);
}

/**
 * Export calibrateAlpha for testing purposes
 * v1.3: Exposes the calibration function for unit testing
 */
export { calibrateAlpha, normalizeZScoreInput };

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
  
  // v1.5: Receiving TDs
  const recTds = seasonStats?.receivingTds ?? undefined;
  
  // v1.5: xFPTS and FPOE from context
  const xFpts = context.xFptsData?.totalXFpts;
  const fpoe = context.xFptsData?.totalFpoe;
  
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
    recTds,
    snapPct,
    rzOpps,
    xFpts,
    fpoe,
  };
}

export default calculateAlphaScore;
