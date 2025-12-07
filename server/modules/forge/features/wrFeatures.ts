/**
 * FORGE v0.2 - WR Feature Builder
 * 
 * Builds position-specific features for Wide Receivers
 * per the FORGE scoring specification.
 * 
 * WR Alpha Weights: 43% volume, 37% efficiency, 15% stability, 5% contextFit
 * (v0.2: roleLeverage removed, weights redistributed)
 */

import { ForgeContext, ForgeFeatureBundle, MISSING_DATA_CAPS, EFFICIENCY_CAPS } from '../types';
import { 
  calculatePercentile, 
  safeAverage, 
  clamp,
  calculateWeeklyStdDev,
  calculateFloorBoomRates 
} from '../utils/scoring';

const WR_THRESHOLDS = {
  TARGETS_PER_GAME_GOOD: 8,
  TARGET_SHARE_GOOD: 0.25,
  AIR_YARDS_SHARE_GOOD: 0.30,
  RZ_TARGETS_PER_GAME_GOOD: 1.5,
  YPRR_GOOD: 2.0,
  YARDS_PER_TARGET_GOOD: 9.5,
  CATCH_RATE_OE_GOOD: 0.05,
  EPA_PER_TARGET_GOOD: 0.25,
  ROUTE_RATE_GOOD: 0.90,
  SLOT_RATE_GOOD: 0.55,
  RZ_ROUTE_SHARE_GOOD: 0.30,
  FLOOR_WEEK_THRESHOLD: 8,   // 8 PPR pts = floor week
  BOOM_WEEK_THRESHOLD: 20,   // 20 PPR pts = boom week
};

export function buildWRFeatures(context: ForgeContext): ForgeFeatureBundle {
  const gamesPlayed = context.seasonStats.gamesPlayed || 0;
  const hasAdvancedStats = !!context.advancedMetrics?.yprr || !!context.advancedMetrics?.epaPerTarget;
  const hasSnapData = context.seasonStats.snapShare > 0 || !!context.roleMetrics?.routeRate;
  const hasDvPData = !!context.dvpData;
  const hasEnvironmentData = !!context.teamEnvironment;
  
  const volumeFeatures = buildVolumeFeatures(context, gamesPlayed);
  const efficiencyFeatures = buildEfficiencyFeatures(context, hasAdvancedStats);
  const stabilityFeatures = buildStabilityFeatures(context, gamesPlayed);
  const contextFitFeatures = buildContextFitFeatures(context, hasDvPData, hasEnvironmentData);
  
  if (gamesPlayed < 3) {
    volumeFeatures.score = Math.min(volumeFeatures.score, MISSING_DATA_CAPS.LESS_THAN_3_GAMES);
    efficiencyFeatures.score = Math.min(efficiencyFeatures.score, MISSING_DATA_CAPS.LESS_THAN_3_GAMES);
    stabilityFeatures.score = Math.min(stabilityFeatures.score, MISSING_DATA_CAPS.LESS_THAN_3_GAMES);
  }
  
  return {
    position: 'WR',
    gamesPlayed,
    volumeFeatures,
    efficiencyFeatures,
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
  
  const targets = context.seasonStats.targets ?? 0;
  const targetsPerGame = targets / gpSafe;
  
  // v1.2: Use exact targetShare from context if available, otherwise estimate
  const TEAM_TARGETS_PER_GAME = 32;
  let targetShare = context.seasonStats.targetShare ?? 0;
  const hasExactTargetShare = targetShare > 0;
  if (!hasExactTargetShare && targetsPerGame > 0) {
    targetShare = targetsPerGame / TEAM_TARGETS_PER_GAME;
  }
  
  const airYardsShare = context.seasonStats.airYards 
    ? context.seasonStats.airYards / (context.seasonStats.receivingYards || 1) * 0.3
    : undefined;
  
  // v1.2: Use exact RZ targets if available, otherwise estimate (~12% of targets are RZ)
  const rzTargets = context.seasonStats.redZoneTargets ?? 0;
  let rzTargetsPerGame = rzTargets / gpSafe;
  if (rzTargetsPerGame === 0 && targets > 0) {
    rzTargetsPerGame = targetsPerGame * 0.12;
  }
  
  const raw = {
    targetsPerGame,
    targetShare,
    airYardsShare,
    rzTargetsPerGame,
  };
  
  const normalized = {
    targetsPerGame: calculatePercentile(targetsPerGame, 0, WR_THRESHOLDS.TARGETS_PER_GAME_GOOD * 1.5),
    targetShare: calculatePercentile(targetShare, 0, WR_THRESHOLDS.TARGET_SHARE_GOOD * 1.5),
    airYardsShare: airYardsShare !== undefined 
      ? calculatePercentile(airYardsShare, 0, WR_THRESHOLDS.AIR_YARDS_SHARE_GOOD * 1.5)
      : 50,
    rzTargetsPerGame: calculatePercentile(rzTargetsPerGame, 0, WR_THRESHOLDS.RZ_TARGETS_PER_GAME_GOOD * 1.5),
  };
  
  const score = clamp(
    normalized.targetsPerGame * 0.40 +
    normalized.targetShare * 0.30 +
    normalized.airYardsShare * 0.20 +
    normalized.rzTargetsPerGame * 0.10,
    0, 100
  );
  
  return { raw, normalized, score };
}

function buildEfficiencyFeatures(
  context: ForgeContext,
  hasAdvancedStats: boolean
): ForgeFeatureBundle['efficiencyFeatures'] {
  const yprr = context.advancedMetrics?.yprr;
  const epaPerTarget = context.advancedMetrics?.epaPerTarget;
  
  const targets = context.seasonStats.targets ?? 1;
  const yards = context.seasonStats.receivingYards ?? 0;
  const yardsPerTarget = targets > 0 ? yards / targets : 0;
  
  const receptions = context.seasonStats.receptions ?? 0;
  const catchRate = targets > 0 ? receptions / targets : 0;
  const catchRateOE = catchRate - 0.65;
  
  const raw = {
    yprr,
    epaPerTarget,
    yardsPerTarget,
    catchRateOE,
  };
  
  const normalized = {
    yprr: yprr !== undefined 
      ? calculatePercentile(yprr, 0.5, WR_THRESHOLDS.YPRR_GOOD * 1.5)
      : 50,
    epaPerTarget: epaPerTarget !== undefined
      ? calculatePercentile(epaPerTarget, -0.2, WR_THRESHOLDS.EPA_PER_TARGET_GOOD * 2)
      : 50,
    yardsPerTarget: calculatePercentile(yardsPerTarget, 4, WR_THRESHOLDS.YARDS_PER_TARGET_GOOD * 1.3),
    catchRateOE: calculatePercentile(catchRateOE, -0.15, WR_THRESHOLDS.CATCH_RATE_OE_GOOD * 2),
  };
  
  let score = clamp(
    normalized.yprr * 0.40 +
    normalized.epaPerTarget * 0.25 +
    normalized.yardsPerTarget * 0.20 +
    normalized.catchRateOE * 0.15,
    0, 100
  );
  
  const capped = !hasAdvancedStats;
  if (capped) {
    score = Math.min(score, MISSING_DATA_CAPS.NO_ADVANCED_STATS_EFFICIENCY);
  }
  
  // Position-specific efficiency cap (WR/RB/TE capped at 85)
  score = Math.min(score, EFFICIENCY_CAPS.WR);
  
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
    WR_THRESHOLDS.FLOOR_WEEK_THRESHOLD,
    WR_THRESHOLDS.BOOM_WEEK_THRESHOLD
  );
  
  const stdDevScore = weeklyPpgStdDev !== undefined
    ? 100 - calculatePercentile(weeklyPpgStdDev, 0, 10)
    : 50;
  
  const floorScore = calculatePercentile(floorRate, 0, 1);
  const boomScore = calculatePercentile(boomRate, 0, 0.5);
  
  const score = clamp(
    stdDevScore * 0.50 +
    floorScore * 0.30 +
    boomScore * 0.20,
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
  const passVolumePct = context.teamEnvironment?.proePct;
  const pacePct = context.teamEnvironment?.pacePct;
  const dvpRank = context.dvpData?.rank;
  
  const raw = {
    passVolumePct,
    pacePct,
    dvpRank,
  };
  
  const isNeutral = !hasDvPData && !hasEnvironmentData;
  
  if (isNeutral) {
    return {
      raw,
      normalized: { passVolumePct: 50, pacePct: 50, dvpRank: 50 },
      score: 50,
      isNeutral: true,
    };
  }
  
  const normalized = {
    passVolumePct: passVolumePct ?? 50,
    pacePct: pacePct ?? 50,
    dvpRank: dvpRank !== undefined
      ? calculatePercentile(33 - dvpRank, 0, 32)
      : 50,
  };
  
  const score = clamp(
    normalized.passVolumePct * 0.40 +
    normalized.pacePct * 0.30 +
    normalized.dvpRank * 0.30,
    0, 100
  );
  
  return { raw, normalized, score, isNeutral: false };
}
