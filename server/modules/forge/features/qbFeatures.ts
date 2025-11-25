/**
 * FORGE v0.1 - QB Feature Builder
 * 
 * Builds position-specific features for Quarterbacks
 * per the FORGE scoring specification.
 * 
 * QB Alpha Weights: 25% volume, 35% efficiency, 15% roleLeverage, 10% stability, 15% contextFit
 */

import { ForgeContext, ForgeFeatureBundle, MISSING_DATA_CAPS } from '../types';
import { 
  calculatePercentile, 
  clamp,
  calculateWeeklyStdDev,
  calculateFloorBoomRates 
} from '../utils/scoring';

const QB_THRESHOLDS = {
  PASS_ATTEMPTS_PER_GAME_GOOD: 35,
  RUSH_ATTEMPTS_PER_GAME_GOOD: 5,
  RZ_PASS_ATTEMPTS_PER_GAME_GOOD: 5,
  EPA_PER_PLAY_GOOD: 0.20,
  CPOE_GOOD: 0.04,
  AYPA_GOOD: 8.0,
  TD_INT_DIFF_GOOD: 0.04,
  SACK_RATE_BAD: 0.08,
  DESIGNED_RUSH_SHARE_GOOD: 0.15,
  GOAL_LINE_RUSH_SHARE_GOOD: 0.30,
  FLOOR_WEEK_THRESHOLD: 15,    // 15 PPR pts = floor week for QB
  BOOM_WEEK_THRESHOLD: 25,     // 25 PPR pts = boom week for QB
};

export function buildQBFeatures(context: ForgeContext): ForgeFeatureBundle {
  const gamesPlayed = context.seasonStats.gamesPlayed || 0;
  const hasAdvancedStats = !!context.advancedMetrics?.epaPerPlay || !!context.advancedMetrics?.cpoe;
  const hasSnapData = context.seasonStats.snapShare > 0;
  const hasDvPData = !!context.dvpData;
  const hasEnvironmentData = !!context.teamEnvironment;
  
  const volumeFeatures = buildVolumeFeatures(context, gamesPlayed);
  const efficiencyFeatures = buildEfficiencyFeatures(context, hasAdvancedStats);
  const roleLeverageFeatures = buildRoleLeverageFeatures(context, hasSnapData);
  const stabilityFeatures = buildStabilityFeatures(context, gamesPlayed);
  const contextFitFeatures = buildContextFitFeatures(context, hasDvPData, hasEnvironmentData);
  
  if (gamesPlayed < 3) {
    volumeFeatures.score = Math.min(volumeFeatures.score, MISSING_DATA_CAPS.LESS_THAN_3_GAMES);
    efficiencyFeatures.score = Math.min(efficiencyFeatures.score, MISSING_DATA_CAPS.LESS_THAN_3_GAMES);
    roleLeverageFeatures.score = Math.min(roleLeverageFeatures.score, MISSING_DATA_CAPS.LESS_THAN_3_GAMES);
    stabilityFeatures.score = Math.min(stabilityFeatures.score, MISSING_DATA_CAPS.LESS_THAN_3_GAMES);
  }
  
  return {
    position: 'QB',
    gamesPlayed,
    volumeFeatures,
    efficiencyFeatures,
    roleLeverageFeatures,
    stabilityFeatures,
    contextFitFeatures,
    dataQuality: {
      hasAdvancedStats,
      hasSnapData,
      hasDvPData,
      hasEnvironmentData,
    },
  };
}

function buildVolumeFeatures(
  context: ForgeContext, 
  gamesPlayed: number
): ForgeFeatureBundle['volumeFeatures'] {
  const gpSafe = Math.max(gamesPlayed, 1);
  
  const passAttempts = context.seasonStats.passingAttempts ?? 0;
  const passAttemptsPerGame = passAttempts / gpSafe;
  
  const rushAttempts = context.seasonStats.rushAttempts ?? 0;
  const rushAttemptsPerGame = rushAttempts / gpSafe;
  
  const rzPassAttemptsPerGame = (context.seasonStats.redZoneTargets ?? 0) / gpSafe * 2;
  
  const raw = {
    passAttemptsPerGame,
    rushAttemptsPerGame,
    rzPassAttemptsPerGame,
  };
  
  const normalized = {
    passAttemptsPerGame: calculatePercentile(passAttemptsPerGame, 20, QB_THRESHOLDS.PASS_ATTEMPTS_PER_GAME_GOOD * 1.2),
    rushAttemptsPerGame: calculatePercentile(rushAttemptsPerGame, 0, QB_THRESHOLDS.RUSH_ATTEMPTS_PER_GAME_GOOD * 2),
    rzPassAttemptsPerGame: calculatePercentile(rzPassAttemptsPerGame, 0, QB_THRESHOLDS.RZ_PASS_ATTEMPTS_PER_GAME_GOOD * 1.5),
  };
  
  const score = clamp(
    normalized.passAttemptsPerGame * 0.50 +
    normalized.rushAttemptsPerGame * 0.30 +
    normalized.rzPassAttemptsPerGame * 0.20,
    0, 100
  );
  
  return { raw, normalized, score };
}

function buildEfficiencyFeatures(
  context: ForgeContext,
  hasAdvancedStats: boolean
): ForgeFeatureBundle['efficiencyFeatures'] {
  const epaPerPlay = context.advancedMetrics?.epaPerPlay;
  const cpoe = context.advancedMetrics?.cpoe;
  const aypa = context.advancedMetrics?.aypa;
  
  const passAttempts = context.seasonStats.passingAttempts ?? 1;
  const passTds = context.seasonStats.passingTds ?? 0;
  const ints = context.seasonStats.interceptions ?? 0;
  const tdRate = passTds / Math.max(passAttempts, 1);
  const intRate = ints / Math.max(passAttempts, 1);
  const tdIntDiff = tdRate - intRate;
  
  const sackRate = 0.06;
  
  const raw = {
    epaPerPlay,
    cpoe,
    aypa,
    tdIntDiff,
    sackRate,
  };
  
  const normalized = {
    epaPerPlay: epaPerPlay !== undefined 
      ? calculatePercentile(epaPerPlay, -0.1, QB_THRESHOLDS.EPA_PER_PLAY_GOOD * 1.5)
      : 50,
    cpoe: cpoe !== undefined
      ? calculatePercentile(cpoe, -0.05, QB_THRESHOLDS.CPOE_GOOD * 2)
      : 50,
    aypa: aypa !== undefined
      ? calculatePercentile(aypa, 5, QB_THRESHOLDS.AYPA_GOOD * 1.3)
      : 50,
    tdIntDiff: calculatePercentile(tdIntDiff, -0.02, QB_THRESHOLDS.TD_INT_DIFF_GOOD * 1.5),
    sackRatePenalty: 100 - calculatePercentile(sackRate, 0.03, QB_THRESHOLDS.SACK_RATE_BAD * 1.5),
  };
  
  let score = clamp(
    normalized.epaPerPlay * 0.45 +
    normalized.cpoe * 0.25 +
    normalized.aypa * 0.20 +
    normalized.tdIntDiff * 0.10,
    0, 100
  );
  
  const capped = !hasAdvancedStats;
  if (capped) {
    score = Math.min(score, MISSING_DATA_CAPS.NO_ADVANCED_STATS_EFFICIENCY);
  }
  
  return { raw, normalized, score, capped };
}

function buildRoleLeverageFeatures(
  context: ForgeContext,
  hasSnapData: boolean
): ForgeFeatureBundle['roleLeverageFeatures'] {
  const rushAttempts = context.seasonStats.rushAttempts ?? 0;
  const passAttempts = context.seasonStats.passingAttempts ?? 1;
  
  const designedRushShare = rushAttempts / Math.max(rushAttempts + passAttempts, 1);
  const goalLineRushShare = context.roleMetrics?.goalLineRushShare;
  
  const raw = {
    designedRushShare,
    goalLineRushShare,
  };
  
  const normalized = {
    designedRushShare: calculatePercentile(designedRushShare, 0, QB_THRESHOLDS.DESIGNED_RUSH_SHARE_GOOD * 1.5),
    goalLineRushShare: goalLineRushShare !== undefined
      ? calculatePercentile(goalLineRushShare, 0, QB_THRESHOLDS.GOAL_LINE_RUSH_SHARE_GOOD * 1.5)
      : 50,
  };
  
  let score = clamp(
    normalized.designedRushShare * 0.60 +
    normalized.goalLineRushShare * 0.40,
    0, 100
  );
  
  const capped = !hasSnapData && goalLineRushShare === undefined;
  if (capped) {
    score = Math.min(score, MISSING_DATA_CAPS.NO_SNAP_DATA_ROLE);
  }
  
  return { raw, normalized, score, capped };
}

function buildStabilityFeatures(
  context: ForgeContext,
  gamesPlayed: number
): ForgeFeatureBundle['stabilityFeatures'] {
  const weeklyPts = context.weeklyStats.map(w => w.fantasyPointsPpr);
  
  const weeklyPpgStdDev = calculateWeeklyStdDev(weeklyPts);
  const { floorRate, boomRate } = calculateFloorBoomRates(
    weeklyPts,
    QB_THRESHOLDS.FLOOR_WEEK_THRESHOLD,
    QB_THRESHOLDS.BOOM_WEEK_THRESHOLD
  );
  
  const stdDevScore = weeklyPpgStdDev !== undefined
    ? 100 - calculatePercentile(weeklyPpgStdDev, 0, 10)
    : 50;
  
  const floorScore = calculatePercentile(floorRate, 0, 1);
  const boomScore = calculatePercentile(boomRate, 0, 0.50);
  
  const ints = context.seasonStats.interceptions ?? 0;
  const passAttempts = context.seasonStats.passingAttempts ?? 1;
  const intRate = ints / passAttempts;
  const turnoverPenalty = Math.min(15, intRate * 100);
  
  const score = clamp(
    stdDevScore * 0.50 +
    floorScore * 0.30 +
    boomScore * 0.20 -
    turnoverPenalty,
    0, 100
  );
  
  return {
    weeklyPpgStdDev,
    floorWeekRate: floorRate,
    boomWeekRate: boomRate,
    score,
  };
}

function buildContextFitFeatures(
  context: ForgeContext,
  hasDvPData: boolean,
  hasEnvironmentData: boolean
): ForgeFeatureBundle['contextFitFeatures'] {
  const olGradePct = context.teamEnvironment?.olGradePct;
  const scoringEnvironment = context.teamEnvironment?.scoringEnvironment;
  const proePct = context.teamEnvironment?.proePct;
  const dvpRank = context.dvpData?.rank;
  
  const raw = {
    olGradePct,
    scoringEnvironment,
    proePct,
    dvpRank,
  };
  
  const isNeutral = !hasDvPData && !hasEnvironmentData;
  
  if (isNeutral) {
    return {
      raw,
      normalized: { olGradePct: 50, scoringEnvironment: 50, proePct: 50, dvpRank: 50 },
      score: 50,
      isNeutral: true,
    };
  }
  
  const normalized = {
    olGradePct: olGradePct ?? 50,
    scoringEnvironment: scoringEnvironment !== undefined
      ? calculatePercentile(scoringEnvironment, 0, 100)
      : 50,
    proePct: proePct ?? 50,
    dvpRank: dvpRank !== undefined
      ? calculatePercentile(33 - dvpRank, 0, 32)
      : 50,
  };
  
  const score = clamp(
    normalized.olGradePct * 0.35 +
    normalized.scoringEnvironment * 0.25 +
    normalized.proePct * 0.20 +
    normalized.dvpRank * 0.20,
    0, 100
  );
  
  return { raw, normalized, score, isNeutral: false };
}
