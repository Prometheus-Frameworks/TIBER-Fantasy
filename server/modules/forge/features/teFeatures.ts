/**
 * FORGE v0.1 - TE Feature Builder
 * 
 * Builds position-specific features for Tight Ends
 * per the FORGE scoring specification.
 * 
 * TE Alpha Weights: 30% volume, 28% efficiency, 25% roleLeverage, 10% stability, 7% contextFit
 */

import { ForgeContext, ForgeFeatureBundle, MISSING_DATA_CAPS } from '../types';
import { 
  calculatePercentile, 
  clamp,
  calculateWeeklyStdDev,
  calculateFloorBoomRates 
} from '../utils/scoring';

const TE_THRESHOLDS = {
  TARGETS_PER_GAME_GOOD: 6,
  TARGET_SHARE_GOOD: 0.18,
  RZ_TARGETS_PER_GAME_GOOD: 1.0,
  EZ_TARGETS_PER_GAME_GOOD: 0.5,
  YPRR_GOOD: 1.8,
  YARDS_PER_TARGET_GOOD: 8.5,
  CATCH_RATE_OE_GOOD: 0.05,
  EPA_PER_TARGET_GOOD: 0.20,
  ROUTE_RATE_GOOD: 0.75,
  RZ_ROUTE_SHARE_GOOD: 0.35,
  FLOOR_WEEK_THRESHOLD: 6,    // 6 PPR pts = floor week for TE
  BOOM_WEEK_THRESHOLD: 15,    // 15 PPR pts = boom week for TE
};

export function buildTEFeatures(context: ForgeContext): ForgeFeatureBundle {
  const gamesPlayed = context.seasonStats.gamesPlayed || 0;
  const hasAdvancedStats = !!context.advancedMetrics?.yprr || !!context.advancedMetrics?.epaPerTarget;
  const hasSnapData = context.seasonStats.snapShare > 0 || !!context.roleMetrics?.routeRate;
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
    position: 'TE',
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
  
  const targets = context.seasonStats.targets ?? 0;
  const targetsPerGame = targets / gpSafe;
  const targetShare = context.seasonStats.targetShare ?? 0;
  const rzTargetsPerGame = (context.seasonStats.redZoneTargets ?? 0) / gpSafe;
  const ezTargetsPerGame = rzTargetsPerGame * 0.3;
  
  const raw = {
    targetsPerGame,
    targetShare,
    rzTargetsPerGame,
    ezTargetsPerGame,
  };
  
  const normalized = {
    targetsPerGame: calculatePercentile(targetsPerGame, 0, TE_THRESHOLDS.TARGETS_PER_GAME_GOOD * 1.5),
    targetShare: calculatePercentile(targetShare, 0, TE_THRESHOLDS.TARGET_SHARE_GOOD * 1.5),
    rzTargetsPerGame: calculatePercentile(rzTargetsPerGame, 0, TE_THRESHOLDS.RZ_TARGETS_PER_GAME_GOOD * 1.5),
    ezTargetsPerGame: calculatePercentile(ezTargetsPerGame, 0, TE_THRESHOLDS.EZ_TARGETS_PER_GAME_GOOD * 1.5),
  };
  
  const score = clamp(
    normalized.targetsPerGame * 0.35 +
    normalized.targetShare * 0.30 +
    normalized.rzTargetsPerGame * 0.25 +
    normalized.ezTargetsPerGame * 0.10,
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
  const catchRateOE = catchRate - 0.70;
  
  const raw = {
    yprr,
    epaPerTarget,
    yardsPerTarget,
    catchRateOE,
  };
  
  const normalized = {
    yprr: yprr !== undefined 
      ? calculatePercentile(yprr, 0.5, TE_THRESHOLDS.YPRR_GOOD * 1.5)
      : 50,
    epaPerTarget: epaPerTarget !== undefined
      ? calculatePercentile(epaPerTarget, -0.15, TE_THRESHOLDS.EPA_PER_TARGET_GOOD * 2)
      : 50,
    yardsPerTarget: calculatePercentile(yardsPerTarget, 4, TE_THRESHOLDS.YARDS_PER_TARGET_GOOD * 1.3),
    catchRateOE: calculatePercentile(catchRateOE, -0.15, TE_THRESHOLDS.CATCH_RATE_OE_GOOD * 2),
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
  
  return { raw, normalized, score, capped };
}

function buildRoleLeverageFeatures(
  context: ForgeContext,
  hasSnapData: boolean
): ForgeFeatureBundle['roleLeverageFeatures'] {
  const routeRate = context.roleMetrics?.routeRate;
  const slotRate = context.roleMetrics?.slotRate;
  const rzRouteShare = context.roleMetrics?.redZoneRouteShare;
  
  const raw = {
    routeRate,
    slotRate,
    rzRouteShare,
  };
  
  const normalized = {
    routeRate: routeRate !== undefined
      ? calculatePercentile(routeRate, 0.4, TE_THRESHOLDS.ROUTE_RATE_GOOD)
      : 50,
    slotRate: slotRate !== undefined
      ? calculatePercentile(slotRate, 0, 0.50)
      : 50,
    rzRouteShare: rzRouteShare !== undefined
      ? calculatePercentile(rzRouteShare, 0, TE_THRESHOLDS.RZ_ROUTE_SHARE_GOOD * 1.5)
      : 50,
  };
  
  let score = clamp(
    normalized.routeRate * 0.45 +
    normalized.slotRate * 0.25 +
    normalized.rzRouteShare * 0.30,
    0, 100
  );
  
  const capped = !hasSnapData;
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
    TE_THRESHOLDS.FLOOR_WEEK_THRESHOLD,
    TE_THRESHOLDS.BOOM_WEEK_THRESHOLD
  );
  
  const stdDevScore = weeklyPpgStdDev !== undefined
    ? 100 - calculatePercentile(weeklyPpgStdDev, 0, 8)
    : 50;
  
  const floorScore = calculatePercentile(floorRate, 0, 1);
  const boomScore = calculatePercentile(boomRate, 0, 0.35);
  
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
  const qbStability = context.teamEnvironment?.qbStability;
  const dvpRank = context.dvpData?.rank;
  
  const raw = {
    passVolumePct,
    qbStability,
    dvpRank,
  };
  
  const isNeutral = !hasDvPData && !hasEnvironmentData;
  
  if (isNeutral) {
    return {
      raw,
      normalized: { passVolumePct: 50, qbStability: 50, dvpRank: 50 },
      score: 50,
      isNeutral: true,
    };
  }
  
  const normalized = {
    passVolumePct: passVolumePct ?? 50,
    qbStability: qbStability !== undefined
      ? calculatePercentile(qbStability, 0, 100)
      : 50,
    dvpRank: dvpRank !== undefined
      ? calculatePercentile(33 - dvpRank, 0, 32)
      : 50,
  };
  
  const score = clamp(
    normalized.passVolumePct * 0.35 +
    normalized.qbStability * 0.30 +
    normalized.dvpRank * 0.35,
    0, 100
  );
  
  return { raw, normalized, score, isNeutral: false };
}
