/**
 * FORGE v0.2 - RB Feature Builder
 * 
 * Builds position-specific features for Running Backs
 * per the FORGE scoring specification.
 * 
 * RB Alpha Weights: 47.5% volume, 31% efficiency, 15% stability, 6.5% contextFit
 * (v0.2: roleLeverage removed, weights redistributed)
 */

import { ForgeContext, ForgeFeatureBundle, MISSING_DATA_CAPS, EFFICIENCY_CAPS } from '../types';
import { 
  calculatePercentile, 
  clamp,
  calculateWeeklyStdDev,
  calculateFloorBoomRates 
} from '../utils/scoring';

const RB_THRESHOLDS = {
  TOUCHES_PER_GAME_GOOD: 18,
  OPPORTUNITY_SHARE_GOOD: 0.70,
  RZ_TOUCHES_PER_GAME_GOOD: 3,
  GOAL_LINE_CARRIES_PER_GAME_GOOD: 1.5,
  YPC_GOOD: 4.5,
  YAC_PER_ATT_GOOD: 3.0,
  MTF_PER_TOUCH_GOOD: 0.15,
  EPA_PER_RUSH_GOOD: 0.10,
  SUCCESS_RATE_GOOD: 0.45,
  BACKFIELD_SHARE_GOOD: 0.75,
  RECEIVING_WORK_RATE_GOOD: 0.60,
  THIRD_DOWN_SNAP_PCT_GOOD: 0.50,
  FLOOR_WEEK_THRESHOLD: 10,   // 10 PPR pts = floor week for RB
  BOOM_WEEK_THRESHOLD: 20,    // 20 PPR pts = boom week for RB
};

export function buildRBFeatures(context: ForgeContext): ForgeFeatureBundle {
  const gamesPlayed = context.seasonStats.gamesPlayed || 0;
  const hasAdvancedStats = !!context.advancedMetrics?.epaPerRush || 
                           !!context.advancedMetrics?.yardsAfterContact;
  const hasSnapData = context.seasonStats.snapShare > 0 || !!context.roleMetrics?.backfieldTouchShare;
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
    position: 'RB',
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
  
  const rushAttempts = context.seasonStats.rushAttempts ?? 0;
  const targets = context.seasonStats.targets ?? 0;
  const touches = rushAttempts + targets;
  const touchesPerGame = touches / gpSafe;
  
  // v1.2: Use exact opportunityShare from context if available (stored in snapShare), otherwise estimate
  const TEAM_RB_TOUCHES_PER_GAME = 28;
  let opportunityShare = context.seasonStats.snapShare ?? 0;
  const hasExactOpportunityShare = opportunityShare > 0;
  if (!hasExactOpportunityShare && touchesPerGame > 0) {
    opportunityShare = touchesPerGame / TEAM_RB_TOUCHES_PER_GAME;
  }
  
  // v1.2: Use exact RZ touches if available, otherwise estimate (~15% of touches are in RZ)
  const rzCarries = context.seasonStats.redZoneCarries ?? 0;
  const rzTargets = context.seasonStats.redZoneTargets ?? 0;
  let rzTouchesPerGame = (rzCarries + rzTargets) / gpSafe;
  if (rzTouchesPerGame === 0 && touches > 0) {
    rzTouchesPerGame = touchesPerGame * 0.15;
  }
  
  // v1.2: Estimate goal line carries from RZ touches (~30% of RZ touches are goal line)
  let goalLineCarriesPerGame = (rzCarries * 0.3) / gpSafe;
  if (goalLineCarriesPerGame === 0 && rzTouchesPerGame > 0) {
    goalLineCarriesPerGame = rzTouchesPerGame * 0.3;
  }
  
  const raw = {
    touchesPerGame,
    opportunityShare,
    rzTouchesPerGame,
    goalLineCarriesPerGame,
  };
  
  const normalized = {
    touchesPerGame: calculatePercentile(touchesPerGame, 0, RB_THRESHOLDS.TOUCHES_PER_GAME_GOOD * 1.3),
    opportunityShare: calculatePercentile(opportunityShare, 0, RB_THRESHOLDS.OPPORTUNITY_SHARE_GOOD),
    rzTouchesPerGame: calculatePercentile(rzTouchesPerGame, 0, RB_THRESHOLDS.RZ_TOUCHES_PER_GAME_GOOD * 1.5),
    goalLineCarriesPerGame: calculatePercentile(goalLineCarriesPerGame, 0, RB_THRESHOLDS.GOAL_LINE_CARRIES_PER_GAME_GOOD * 1.5),
  };
  
  const score = clamp(
    normalized.touchesPerGame * 0.45 +
    normalized.opportunityShare * 0.30 +
    normalized.rzTouchesPerGame * 0.15 +
    normalized.goalLineCarriesPerGame * 0.10,
    0, 100
  );
  
  return { raw, normalized, score };
}

function buildEfficiencyFeatures(
  context: ForgeContext,
  hasAdvancedStats: boolean
): ForgeFeatureBundle['efficiencyFeatures'] {
  const ypc = context.advancedMetrics?.yardsPerCarry ?? 
    ((context.seasonStats.rushYards ?? 0) / Math.max(context.seasonStats.rushAttempts ?? 1, 1));
  const yacPerAtt = context.advancedMetrics?.yardsAfterContact;
  const mtfPerTouch = context.advancedMetrics?.missedTacklesForced;
  const epaPerRush = context.advancedMetrics?.epaPerRush;
  const successRate = context.advancedMetrics?.successRate;
  
  const raw = {
    ypc,
    yacPerAtt,
    mtfPerTouch,
    epaPerRush,
    successRate,
  };
  
  const yacMtfBlend = (yacPerAtt !== undefined && mtfPerTouch !== undefined)
    ? (calculatePercentile(yacPerAtt, 1, RB_THRESHOLDS.YAC_PER_ATT_GOOD * 1.5) * 0.6 +
       calculatePercentile(mtfPerTouch, 0, RB_THRESHOLDS.MTF_PER_TOUCH_GOOD * 1.5) * 0.4)
    : ypc !== undefined 
      ? calculatePercentile(ypc, 2, RB_THRESHOLDS.YPC_GOOD * 1.3) 
      : 50;
  
  const normalized = {
    yacMtfBlend,
    epaWeighted: epaPerRush !== undefined
      ? calculatePercentile(epaPerRush, -0.15, RB_THRESHOLDS.EPA_PER_RUSH_GOOD * 2)
      : 50,
    successRate: successRate !== undefined
      ? calculatePercentile(successRate, 0.30, RB_THRESHOLDS.SUCCESS_RATE_GOOD * 1.3)
      : 50,
    ypc: calculatePercentile(ypc, 2, RB_THRESHOLDS.YPC_GOOD * 1.3),
  };
  
  let score = clamp(
    normalized.yacMtfBlend * 0.40 +
    normalized.epaWeighted * 0.30 +
    normalized.successRate * 0.20 +
    normalized.ypc * 0.10,
    0, 100
  );
  
  const capped = !hasAdvancedStats;
  if (capped) {
    score = Math.min(score, MISSING_DATA_CAPS.NO_ADVANCED_STATS_EFFICIENCY);
  }
  
  // Position-specific efficiency cap (WR/RB/TE capped at 85)
  score = Math.min(score, EFFICIENCY_CAPS.RB);
  
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
    RB_THRESHOLDS.FLOOR_WEEK_THRESHOLD,
    RB_THRESHOLDS.BOOM_WEEK_THRESHOLD
  );
  
  const stdDevScore = weeklyPpgStdDev !== undefined
    ? 100 - calculatePercentile(weeklyPpgStdDev, 0, 12)
    : 50;
  
  const floorScore = calculatePercentile(floorRate, 0, 1);
  const boomScore = calculatePercentile(boomRate, 0, 0.4);
  
  const injuryPenalty = context.injuryStatus?.gamesMissedLast2Years 
    ? Math.min(20, context.injuryStatus.gamesMissedLast2Years * 2)
    : 0;
  
  const score = clamp(
    stdDevScore * 0.50 +
    floorScore * 0.30 +
    boomScore * 0.20 -
    injuryPenalty,
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
  const rushVolumePct = context.teamEnvironment?.proePct 
    ? 100 - context.teamEnvironment.proePct 
    : undefined;
  const olGradePct = context.teamEnvironment?.olGradePct;
  const dvpRank = context.dvpData?.rank;
  
  const raw = {
    rushVolumePct,
    olGradePct,
    dvpRank,
  };
  
  const isNeutral = !hasDvPData && !hasEnvironmentData;
  
  if (isNeutral) {
    return {
      raw,
      normalized: { rushVolumePct: 50, olGradePct: 50, dvpRank: 50 },
      score: 50,
      isNeutral: true,
    };
  }
  
  const normalized = {
    rushVolumePct: rushVolumePct ?? 50,
    olGradePct: olGradePct ?? 50,
    dvpRank: dvpRank !== undefined
      ? calculatePercentile(33 - dvpRank, 0, 32)
      : 50,
  };
  
  const score = clamp(
    normalized.rushVolumePct * 0.35 +
    normalized.olGradePct * 0.35 +
    normalized.dvpRank * 0.30,
    0, 100
  );
  
  return { raw, normalized, score, isNeutral: false };
}
