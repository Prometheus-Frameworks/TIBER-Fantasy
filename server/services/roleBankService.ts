// server/services/roleBankService.ts

// ---- Types ----

export interface WeeklyWRUsageRow {
  playerId: string;
  season: number;
  week: number;
  team: string;

  targets: number | null;
  targetSharePct: number | null;        // 0–1 (if present)
  routes: number | null;               // can be estimated from ingestion
  fantasyPointsPpr: number | null;
  deepTargets20Plus?: number | null;    // v1.1: deep targets (20+ air yards) from play-by-play

  routesSlot?: number | null;          // estimated slot routes
  routesOutside?: number | null;       // estimated outside routes
  routesInline?: number | null;        // optional, rarely used for WRs
}

export type WRRoleTier =
  | 'ALPHA'
  | 'CO_ALPHA'
  | 'PRIMARY_SLOT'
  | 'SECONDARY'
  | 'ROTATIONAL'
  | 'UNKNOWN';

export interface WRRoleBankSeasonRow {
  playerId: string;
  season: number;

  gamesPlayed: number;

  // Volume
  targetsPerGame: number;
  targetShareAvg: number | null;       // 0–1
  routesPerGame: number | null;        // estimated
  routeShareEst: number | null;        // placeholder for future snap/dropback data

  // Consistency
  targetStdDev: number | null;
  fantasyStdDev: number | null;

  // High-value usage (v1.1: deep target rate)
  pprPerTarget: number | null;
  deepTargetsPerGame: number | null;   // v1.1: 20+ air yards targets per game
  deepTargetRate: number | null;       // v1.1: deepTargets / totalTargets

  // Alignment flavor (estimates)
  slotRouteShareEst: number | null;    // 0–1
  outsideRouteShareEst: number | null; // 0–1

  // Sub-scores
  volumeScore: number;         // 0–100
  consistencyScore: number;    // 0–100
  highValueUsageScore: number; // 0–100
  momentumScore: number;       // 0–100

  // Final composite
  roleScore: number;           // 0–100
  
  // v2.0 Fantasy Efficiency Blend - Debug Scores
  pureRoleScore?: number;      // v1.2 original score
  efficiencyScore?: number;    // Fantasy efficiency component

  // Labels / flags
  roleTier: WRRoleTier;
  cardioWrFlag: boolean;
  breakoutWatchFlag: boolean;
  fakeSpikeFlag: boolean;
}

// ---- Utility helpers ----

function mean(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function stdDev(values: number[]): number | null {
  if (values.length <= 1) return null;
  const avg = mean(values);
  if (avg === null) return null;
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---- Scaling functions (0–100) ----

// Targets per game → 0–100
function scaleTargetsPerGame(tpg: number): number {
  if (tpg >= 12) return 100;
  if (tpg >= 10) return 90;
  if (tpg >= 8) return 75;
  if (tpg >= 6) return 55;
  if (tpg >= 4) return 35;
  if (tpg >= 2) return 20;
  return 10;
}

// Target share average (0–1) → 0–100
function scaleTargetShare(share: number): number {
  if (share >= 0.30) return 100;
  if (share >= 0.27) return 90;
  if (share >= 0.24) return 80;
  if (share >= 0.20) return 65;
  if (share >= 0.15) return 45;
  if (share >= 0.10) return 30;
  return 15;
}

// Routes per game → 0–100 (v1.2: 2025-realistic breakpoints)
function scaleRoutesPerGame2025(rpg: number): number {
  if (rpg >= 33) return 100;
  if (rpg >= 30) return 90;
  if (rpg >= 27) return 80;
  if (rpg >= 24) return 65;
  if (rpg >= 20) return 50;
  if (rpg >= 15) return 30;
  return 15;
}

// Consistency: use std dev of targets; lower std dev = higher score (v1.2: softer)
function scaleConsistencyFromStdDev(std: number | null): number {
  if (std === null) return 60;
  const capped = Math.min(std, 7);
  const score = 100 - (capped / 7) * 55; // v1.2: max penalty 55 instead of 60
  return Math.max(45, Math.round(score)); // v1.2: floor 45 instead of 40
}

// Efficiency via PPR per target → 0–100
function scalePprPerTarget(pprPerTarget: number | null): number {
  if (pprPerTarget === null) return 50;
  if (pprPerTarget >= 2.3) return 100;
  if (pprPerTarget >= 2.0) return 85;
  if (pprPerTarget >= 1.7) return 70;
  if (pprPerTarget >= 1.4) return 55;
  if (pprPerTarget >= 1.1) return 40;
  return 30;
}

// v1.1: Deep target rate (20+ air yards) → 0–100
// This measures high-value usage objectively without needing RZ/EZ data
function scaleDeepTargetRate(deepTargetRate: number | null, totalTargets: number): number {
  if (deepTargetRate === null || totalTargets < 30) return 50; // Insufficient sample
  
  // Deep target rate thresholds (league-typical for WR1s)
  if (deepTargetRate >= 0.30) return 100; // Elite deep threat (30%+ deep targets)
  if (deepTargetRate >= 0.25) return 90;  // Strong deep role
  if (deepTargetRate >= 0.20) return 75;  // Moderate deep role
  if (deepTargetRate >= 0.15) return 60;  // Some deep usage
  if (deepTargetRate >= 0.10) return 45;  // Limited deep role
  if (deepTargetRate >= 0.05) return 30;  // Minimal deep usage
  return 20; // Pure underneath/screen WR
}

// v1.2: Slot efficiency - rewards heavy slot usage (ARSB, Puka, Wan'Dale)
function scaleSlotEfficiency(slotShare: number): number {
  if (slotShare >= 0.65) return 100;
  if (slotShare >= 0.55) return 85;
  if (slotShare >= 0.45) return 70;
  if (slotShare >= 0.35) return 50;
  return 30;
}

// Momentum based on delta in targets per game (last 3 vs season) - v1.2: refined thresholds
function computeMomentumScore(
  seasonTargetsPerGame: number | null,
  recentTargetsPerGame: number | null
): number {
  if (
    seasonTargetsPerGame === null ||
    recentTargetsPerGame === null
  ) {
    return 60;
  }
  const delta = recentTargetsPerGame - seasonTargetsPerGame;

  if (delta >= 3) return 100;
  if (delta >= 1.5) return 85;
  if (delta >= 0) return 65;
  if (delta >= -1.5) return 50;
  if (delta >= -3) return 35;
  return 20;
}

// v2.0: Fantasy Efficiency Score - Pure PPR efficiency metric
function getFantasyEfficiencyScore(
  pprPerTarget: number | null,
  gamesPlayed: number
): number {
  if (!pprPerTarget || gamesPlayed < 4) return 50;

  if (pprPerTarget >= 2.40) return 100;
  if (pprPerTarget >= 2.20) return 92;
  if (pprPerTarget >= 2.00) return 84;
  if (pprPerTarget >= 1.85) return 76;
  if (pprPerTarget >= 1.70) return 68;
  if (pprPerTarget >= 1.55) return 60;
  return 50;
}

// ---- Main computation ----

export function computeWRRoleBankSeasonRow(
  weeklyRows: WeeklyWRUsageRow[]
): WRRoleBankSeasonRow | null {
  if (!weeklyRows.length) return null;

  const { playerId, season } = weeklyRows[0];

  const sorted = [...weeklyRows].sort((a, b) => a.week - b.week);

  const validTargets = sorted
    .map(r => r.targets ?? 0)
    .filter(v => v > 0);
  const validFantasy = sorted
    .map(r => r.fantasyPointsPpr ?? 0)
    .filter(v => v > 0);

  const gamesPlayed = sorted.filter(
    r => (r.targets ?? 0) > 0 || (r.fantasyPointsPpr ?? 0) > 0
  ).length;

  if (gamesPlayed === 0) {
    return null;
  }

  const totalTargets = validTargets.reduce((acc, v) => acc + v, 0);
  const totalFantasy = validFantasy.reduce((acc, v) => acc + v, 0);

  const targetsPerGame =
    gamesPlayed > 0 ? totalTargets / gamesPlayed : 0;

  const targetShareValues = sorted
    .map(r => r.targetSharePct ?? null)
    .filter((v): v is number => v !== null);
  const targetShareAvg = mean(targetShareValues);

  const routesValues = sorted
    .map(r => r.routes ?? null)
    .filter((v): v is number => v !== null);
  const routesPerGame =
    routesValues.length > 0 && gamesPlayed > 0
      ? routesValues.reduce((acc, v) => acc + v, 0) / gamesPlayed
      : null;

  const routeShareEst: number | null = null;

  const targetStdDev = stdDev(validTargets);
  const fantasyStdDev = stdDev(validFantasy);

  const pprPerTarget =
    totalTargets > 0 ? totalFantasy / totalTargets : null;

  // v1.1: Calculate deep target metrics
  // CRITICAL: Only include weeks that have play-by-play data (deepTargets20Plus exists)
  // to avoid denominator mismatch when play-by-play data lags behind weekly stats
  const weeksWithPlayByPlay = sorted.filter(r => 
    r.deepTargets20Plus !== undefined && r.deepTargets20Plus !== null
  );
  
  const totalDeepTargets = weeksWithPlayByPlay.reduce(
    (acc, r) => acc + (r.deepTargets20Plus ?? 0), 0
  );
  const totalTargetsWithPlayByPlay = weeksWithPlayByPlay.reduce(
    (acc, r) => acc + (r.targets ?? 0), 0
  );
  
  const deepTargetsPerGame = gamesPlayed > 0 ? totalDeepTargets / gamesPlayed : null;
  const deepTargetRate = totalTargetsWithPlayByPlay > 0 
    ? totalDeepTargets / totalTargetsWithPlayByPlay 
    : null;

  const totalRoutesAll =
    sorted.reduce((acc, r) => acc + (r.routes ?? 0), 0) || 0;
  const totalSlotRoutes =
    sorted.reduce((acc, r) => acc + (r.routesSlot ?? 0), 0) || 0;
  const totalOutsideRoutes =
    sorted.reduce((acc, r) => acc + (r.routesOutside ?? 0), 0) || 0;

  const slotRouteShareEst =
    totalRoutesAll > 0 ? totalSlotRoutes / totalRoutesAll : null;
  const outsideRouteShareEst =
    totalRoutesAll > 0 ? totalOutsideRoutes / totalRoutesAll : null;

  // ---- Sub-scores ----

  const targetsScore = scaleTargetsPerGame(targetsPerGame);
  const shareScore =
    targetShareAvg != null
      ? scaleTargetShare(targetShareAvg)
      : targetsScore;
  const routesScore =
    routesPerGame != null
      ? scaleRoutesPerGame2025(routesPerGame)  // v1.2: Updated routes scaling
      : targetsScore;

  const volumeScore =
    0.5 * targetsScore + 0.3 * shareScore + 0.2 * routesScore;

  const consistencyScore = scaleConsistencyFromStdDev(targetStdDev);

  // v1.2: High-value usage now blends deep targets (67%) + slot efficiency (33%)
  const deepScore = scaleDeepTargetRate(deepTargetRate, totalTargetsWithPlayByPlay);
  const slotBonus = scaleSlotEfficiency(slotRouteShareEst ?? 0);
  const highValueUsageScore = Math.round(0.67 * deepScore + 0.33 * slotBonus);

  const last3 = sorted.slice(-3);
  const last3Targets = last3
    .map(r => r.targets ?? 0)
    .filter(v => v > 0);
  const recentTargetsPerGame =
    last3Targets.length > 0
      ? last3Targets.reduce((acc, v) => acc + v, 0) /
        last3Targets.length
      : null;

  const momentumScore = computeMomentumScore(
    targetsPerGame || null,
    recentTargetsPerGame
  );

  // v1.2: Updated weights - Volume 58%, Consistency 18%, High-Value 18% (12% deep + 6% slot), Momentum 6%
  const v12RoleScore =
    0.58 * volumeScore +
    0.18 * consistencyScore +
    0.18 * highValueUsageScore +
    0.06 * momentumScore;

  // Save the original v1.2 score
  const pureRoleScore = v12RoleScore;

  // NEW v2.0: Fantasy efficiency component
  const efficiencyScore = getFantasyEfficiencyScore(
    pprPerTarget,
    gamesPlayed
  );

  // FINAL v2.0 blended score (70% v1.2 + 30% efficiency)
  const finalRoleScore = Math.round(
    0.70 * pureRoleScore +
    0.30 * efficiencyScore
  );

  const roleScore = finalRoleScore;

  // ---- Role tier + flags ----

  let roleTier: WRRoleTier = 'UNKNOWN';

  const shareForTier = targetShareAvg ?? 0;
  const volForTier = volumeScore;

  if (volForTier >= 90 && shareForTier >= 0.27) {
    roleTier = 'ALPHA';
  } else if (volForTier >= 80 && shareForTier >= 0.22) {
    roleTier = 'CO_ALPHA';
  } else if (
    slotRouteShareEst != null &&
    slotRouteShareEst >= 0.60 &&
    volForTier >= 70
  ) {
    roleTier = 'PRIMARY_SLOT';
  } else if (volForTier >= 60) {
    roleTier = 'SECONDARY';
  } else if (volForTier >= 40) {
    roleTier = 'ROTATIONAL';
  }

  const cardioWrFlag =
    routesPerGame != null &&
    routesPerGame >= 30 &&
    targetsPerGame <= 5;

  const breakoutWatchFlag =
    roleTier !== 'ALPHA' &&
    volumeScore < 85 &&
    momentumScore >= 80;

  let fakeSpikeFlag = false;
  if (sorted.length >= 3) {
    const lastWeek = sorted[sorted.length - 1];
    const prev = sorted.slice(0, -1);
    const prevFantasy = prev
      .map(r => r.fantasyPointsPpr ?? 0)
      .filter(v => v > 0);
    const prevTargets = prev
      .map(r => r.targets ?? 0)
      .filter(v => v > 0);

    const avgPrevFantasy = mean(prevFantasy);
    const avgPrevTargets = mean(prevTargets);

    if (
      avgPrevFantasy !== null &&
      avgPrevFantasy > 0 &&
      avgPrevTargets !== null &&
      lastWeek.fantasyPointsPpr != null &&
      lastWeek.targets != null
    ) {
      const spike =
        lastWeek.fantasyPointsPpr >= 2 * avgPrevFantasy;
      const volumeSame =
        Math.abs(lastWeek.targets - avgPrevTargets) <= 1;

      fakeSpikeFlag = spike && volumeSame;
    }
  }

  return {
    playerId,
    season,
    gamesPlayed,

    targetsPerGame,
    targetShareAvg,
    routesPerGame,
    routeShareEst,

    targetStdDev,
    fantasyStdDev,

    pprPerTarget,
    deepTargetsPerGame,     // v1.1
    deepTargetRate,         // v1.1

    slotRouteShareEst,
    outsideRouteShareEst,

    volumeScore: Math.round(volumeScore),
    consistencyScore: Math.round(consistencyScore),
    highValueUsageScore: Math.round(highValueUsageScore),
    momentumScore: Math.round(momentumScore),

    roleScore: roleScore,  // Already rounded in finalRoleScore
    
    // v2.0 debug scores
    pureRoleScore: Math.round(pureRoleScore),  // v1.2 score (rounded for DB storage)
    efficiencyScore: efficiencyScore,  // Already returns integer from helper

    roleTier,
    cardioWrFlag,
    breakoutWatchFlag,
    fakeSpikeFlag
  };
}

// ========== RB ROLE BANK ==========

export interface WeeklyRBUsageRow {
  playerId: string;
  season: number;
  week: number;
  team: string;

  carries: number | null;
  targets: number | null;
  targetSharePct: number | null;       // 0–1 if available
  routes: number | null;               // estimated ok
  fantasyPointsPpr: number | null;

  redZoneCarries?: number | null;      // optional, if present
  redZoneTargets?: number | null;      // optional
}

export type RBRoleTier =
  | 'ELITE_WORKHORSE'
  | 'HIGH_END_RB1'
  | 'MID_RB1'
  | 'STRONG_RB2'
  | 'ROTATIONAL_RB'
  | 'LIMITED_USAGE'
  | 'UNKNOWN';

export interface RBRoleBankSeasonRow {
  playerId: string;
  season: number;

  gamesPlayed: number;

  // Volume
  carriesPerGame: number;
  targetsPerGame: number;
  opportunitiesPerGame: number;         // carries + targets
  targetShareAvg: number | null;        // 0–1
  routesPerGame: number | null;

  // Consistency
  oppStdDev: number | null;
  fantasyStdDev: number | null;

  // High-value usage proxies
  pprPerOpportunity: number | null;
  redZoneTouchesPerGame: number | null; // rz carries + rz targets if present

  // Sub-scores
  volumeScore: number;
  consistencyScore: number;
  highValueUsageScore: number;
  momentumScore: number;

  // Final
  roleScore: number;
  roleTier: RBRoleTier;

  // Flags
  pureRusherFlag: boolean;      // low targets, high carries
  passingDownBackFlag: boolean; // low carries, good targets
  breakoutWatchFlag: boolean;
}

function scaleRBOpportunitiesPerGame(opp: number): number {
  if (opp >= 22) return 100; // true workhorse
  if (opp >= 18) return 90;
  if (opp >= 15) return 80;
  if (opp >= 12) return 70;
  if (opp >= 9)  return 55;
  if (opp >= 6)  return 40;
  if (opp >= 3)  return 25;
  return 15;
}

function scaleRBTargetShare(share: number): number {
  if (share >= 0.18) return 100; // elite passing involvement
  if (share >= 0.15) return 85;
  if (share >= 0.12) return 70;
  if (share >= 0.09) return 55;
  if (share >= 0.06) return 40;
  return 25;
}

function scaleRBRoutesPerGame(rpg: number): number {
  if (rpg >= 30) return 100;
  if (rpg >= 24) return 85;
  if (rpg >= 18) return 70;
  if (rpg >= 12) return 55;
  if (rpg >= 8)  return 40;
  if (rpg >= 4)  return 25;
  return 15;
}

function scaleRBPprPerOpp(pprPerOpp: number | null): number {
  if (pprPerOpp === null) return 50;
  if (pprPerOpp >= 1.2) return 100;
  if (pprPerOpp >= 1.0) return 85;
  if (pprPerOpp >= 0.8) return 70;
  if (pprPerOpp >= 0.6) return 55;
  if (pprPerOpp >= 0.4) return 40;
  return 30;
}

export function computeRBRoleBankSeasonRow(
  weeklyRows: WeeklyRBUsageRow[]
): RBRoleBankSeasonRow | null {
  if (!weeklyRows.length) return null;

  const { playerId, season } = weeklyRows[0];

  const sorted = [...weeklyRows].sort((a, b) => a.week - b.week);

  const gamesPlayed = sorted.filter(
    r =>
      (r.carries ?? 0) > 0 ||
      (r.targets ?? 0) > 0 ||
      (r.fantasyPointsPpr ?? 0) > 0
  ).length;

  if (gamesPlayed === 0) return null;

  const carriesList = sorted.map(r => r.carries ?? 0);
  const targetsList = sorted.map(r => r.targets ?? 0);
  const oppList = carriesList.map((c, idx) => c + (targetsList[idx] ?? 0));
  const fantasyList = sorted.map(r => r.fantasyPointsPpr ?? 0);

  const totalCarries = carriesList.reduce((a, v) => a + v, 0);
  const totalTargets = targetsList.reduce((a, v) => a + v, 0);
  const totalOpps    = oppList.reduce((a, v) => a + v, 0);
  const totalFantasy = fantasyList.reduce((a, v) => a + v, 0);

  const carriesPerGame     = totalCarries / gamesPlayed;
  const targetsPerGame     = totalTargets / gamesPlayed;
  const opportunitiesPerGame = totalOpps / gamesPlayed;

  const targetShareValues = sorted
    .map(r => r.targetSharePct ?? null)
    .filter((v): v is number => v !== null);
  const targetShareAvg = mean(targetShareValues);

  const routesValues = sorted
    .map(r => r.routes ?? null)
    .filter((v): v is number => v !== null);
  const routesPerGame =
    routesValues.length > 0
      ? routesValues.reduce((a, v) => a + v, 0) / gamesPlayed
      : null;

  const oppStdDev = stdDev(oppList);
  const fantasyStdDev = stdDev(
    fantasyList.filter(v => v > 0)
  );

  const pprPerOpportunity =
    totalOpps > 0 ? totalFantasy / totalOpps : null;

  const redZoneTouchesList = sorted.map(r => {
    const rc = r.redZoneCarries ?? 0;
    const rt = r.redZoneTargets ?? 0;
    return rc + rt;
  });
  const totalRzTouches = redZoneTouchesList.reduce((a, v) => a + v, 0);
  const redZoneTouchesPerGame =
    gamesPlayed > 0 ? totalRzTouches / gamesPlayed : null;

  // ---- Sub-scores ----
  const oppScore = scaleRBOpportunitiesPerGame(opportunitiesPerGame);
  const shareScore =
    targetShareAvg != null
      ? scaleRBTargetShare(targetShareAvg)
      : 50; // neutral
  const routesScore =
    routesPerGame != null
      ? scaleRBRoutesPerGame(routesPerGame)
      : 50;

  const volumeScore =
    0.6 * oppScore + 0.25 * shareScore + 0.15 * routesScore;

  const consistencyScore = scaleConsistencyFromStdDev(oppStdDev);
  const highValueUsageScore = scaleRBPprPerOpp(pprPerOpportunity);

  // Momentum: last 3 weeks opps/g vs season opps/g
  const last3 = sorted.slice(-3);
  const last3OppList = last3.map(r => (r.carries ?? 0) + (r.targets ?? 0));
  const recentOppPerGame =
    last3OppList.length > 0
      ? last3OppList.reduce((a, v) => a + v, 0) / last3OppList.length
      : null;

  const momentumScore = computeMomentumScore(
    opportunitiesPerGame || null,
    recentOppPerGame
  );

  const roleScore =
    0.45 * volumeScore +
    0.25 * consistencyScore +
    0.20 * highValueUsageScore +
    0.10 * momentumScore;

  // ---- Tiering ----
  let roleTier: RBRoleTier = 'UNKNOWN';

  if (roleScore >= 85) roleTier = 'ELITE_WORKHORSE';
  else if (roleScore >= 75) roleTier = 'HIGH_END_RB1';
  else if (roleScore >= 65) roleTier = 'MID_RB1';
  else if (roleScore >= 55) roleTier = 'STRONG_RB2';
  else if (roleScore >= 40) roleTier = 'ROTATIONAL_RB';
  else roleTier = 'LIMITED_USAGE';

  // Flags
  const pureRusherFlag =
    carriesPerGame >= 12 && targetsPerGame <= 2;

  const passingDownBackFlag =
    targetsPerGame >= 4 && carriesPerGame <= 6;

  const breakoutWatchFlag =
    roleTier !== 'ELITE_WORKHORSE' &&
    roleTier !== 'HIGH_END_RB1' &&
    momentumScore >= 80 &&
    volumeScore >= 50;

  return {
    playerId,
    season,

    gamesPlayed,

    carriesPerGame,
    targetsPerGame,
    opportunitiesPerGame,
    targetShareAvg,
    routesPerGame,

    oppStdDev,
    fantasyStdDev,

    pprPerOpportunity,
    redZoneTouchesPerGame,

    volumeScore: Math.round(volumeScore),
    consistencyScore: Math.round(consistencyScore),
    highValueUsageScore: Math.round(highValueUsageScore),
    momentumScore: Math.round(momentumScore),

    roleScore: Math.round(roleScore),
    roleTier,

    pureRusherFlag,
    passingDownBackFlag,
    breakoutWatchFlag
  };
}

// ========== TE ROLE BANK ==========

export interface WeeklyTEUsageRow {
  playerId: string;
  season: number;
  week: number;
  team: string;

  targets: number | null;
  targetSharePct: number | null;      // 0–1
  routes: number | null;              // estimated ok
  fantasyPointsPpr: number | null;

  redZoneTargets?: number | null;     // optional
}

export type TERoleTier =
  | 'ELITE_TE1'
  | 'STRONG_TE1'
  | 'MID_TE1'
  | 'HIGH_TE2'
  | 'STREAMER'
  | 'BLOCKING_TE'
  | 'UNKNOWN';

export interface TERoleBankSeasonRow {
  playerId: string;
  season: number;

  gamesPlayed: number;

  targetsPerGame: number;
  targetShareAvg: number | null;
  routesPerGame: number | null;

  targetStdDev: number | null;
  fantasyStdDev: number | null;

  pprPerTarget: number | null;
  redZoneTargetsPerGame: number | null;

  volumeScore: number;
  consistencyScore: number;
  highValueUsageScore: number;
  momentumScore: number;

  roleScore: number;
  roleTier: TERoleTier;

  redZoneWeaponFlag: boolean;
  cardioTEFlag: boolean;
  breakoutWatchFlag: boolean;
}

function scaleTETargetsPerGame(tpg: number): number {
  if (tpg >= 9) return 100;
  if (tpg >= 7) return 90;
  if (tpg >= 6) return 80;
  if (tpg >= 5) return 70;
  if (tpg >= 4) return 60;
  if (tpg >= 3) return 45;
  if (tpg >= 2) return 30;
  return 15;
}

function scaleTETargetShare(share: number): number {
  if (share >= 0.24) return 100;
  if (share >= 0.21) return 90;
  if (share >= 0.18) return 80;
  if (share >= 0.15) return 70;
  if (share >= 0.12) return 55;
  if (share >= 0.09) return 40;
  return 25;
}

function scaleTERoutesPerGame(rpg: number): number {
  if (rpg >= 35) return 100;
  if (rpg >= 30) return 90;
  if (rpg >= 25) return 80;
  if (rpg >= 20) return 65;
  if (rpg >= 15) return 50;
  if (rpg >= 10) return 35;
  return 20;
}

export function computeTERoleBankSeasonRow(
  weeklyRows: WeeklyTEUsageRow[]
): TERoleBankSeasonRow | null {
  if (!weeklyRows.length) return null;

  const { playerId, season } = weeklyRows[0];
  const sorted = [...weeklyRows].sort((a, b) => a.week - b.week);

  const gamesPlayed = sorted.filter(
    r =>
      (r.targets ?? 0) > 0 ||
      (r.fantasyPointsPpr ?? 0) > 0
  ).length;

  if (gamesPlayed === 0) return null;

  const targetsList = sorted.map(r => r.targets ?? 0);
  const fantasyList = sorted.map(r => r.fantasyPointsPpr ?? 0);

  const totalTargets = targetsList.reduce((a, v) => a + v, 0);
  const totalFantasy = fantasyList.reduce((a, v) => a + v, 0);

  const targetsPerGame = totalTargets / gamesPlayed;

  const targetShareValues = sorted
    .map(r => r.targetSharePct ?? null)
    .filter((v): v is number => v !== null);
  const targetShareAvg = mean(targetShareValues);

  const routesValues = sorted
    .map(r => r.routes ?? null)
    .filter((v): v is number => v !== null);
  const routesPerGame =
    routesValues.length > 0
      ? routesValues.reduce((a, v) => a + v, 0) / gamesPlayed
      : null;

  const targetStdDev = stdDev(targetsList);
  const fantasyStdDev = stdDev(
    fantasyList.filter(v => v > 0)
  );

  const pprPerTarget =
    totalTargets > 0 ? totalFantasy / totalTargets : null;

  const rzList = sorted.map(r => r.redZoneTargets ?? 0);
  const totalRz = rzList.reduce((a, v) => a + v, 0);
  const redZoneTargetsPerGame =
    gamesPlayed > 0 ? totalRz / gamesPlayed : null;

  // ---- Sub-scores ----
  const targetsScore = scaleTETargetsPerGame(targetsPerGame);
  const shareScore =
    targetShareAvg != null
      ? scaleTETargetShare(targetShareAvg)
      : targetsScore;
  const routesScore =
    routesPerGame != null
      ? scaleTERoutesPerGame(routesPerGame)
      : targetsScore;

  const volumeScore =
    0.5 * targetsScore + 0.3 * shareScore + 0.2 * routesScore;

  const consistencyScore = scaleConsistencyFromStdDev(targetStdDev);
  const highValueUsageScore = scalePprPerTarget(pprPerTarget);

  const last3 = sorted.slice(-3);
  const last3Targets = last3.map(r => r.targets ?? 0);
  const recentTargetsPerGame =
    last3Targets.length > 0
      ? last3Targets.reduce((a, v) => a + v, 0) /
        last3Targets.length
      : null;

  const momentumScore = computeMomentumScore(
    targetsPerGame || null,
    recentTargetsPerGame
  );

  const roleScore =
    0.45 * volumeScore +
    0.25 * consistencyScore +
    0.20 * highValueUsageScore +
    0.10 * momentumScore;

  // ---- Tiering ----
  let roleTier: TERoleTier = 'UNKNOWN';

  if (roleScore >= 85) roleTier = 'ELITE_TE1';
  else if (roleScore >= 70) roleTier = 'STRONG_TE1';
  else if (roleScore >= 60) roleTier = 'MID_TE1';
  else if (roleScore >= 50) roleTier = 'HIGH_TE2';
  else if (roleScore >= 40) roleTier = 'STREAMER';
  else roleTier = 'BLOCKING_TE';

  // Flags
  const redZoneWeaponFlag =
    redZoneTargetsPerGame != null &&
    redZoneTargetsPerGame >= 1.2; // 1+ RZ tgt/g is a lot for TE

  const cardioTEFlag =
    routesPerGame != null &&
    routesPerGame >= 30 &&
    targetsPerGame <= 4;

  const breakoutWatchFlag =
    roleTier !== 'ELITE_TE1' &&
    roleTier !== 'STRONG_TE1' &&
    momentumScore >= 80 &&
    volumeScore >= 55;

  return {
    playerId,
    season,
    gamesPlayed,

    targetsPerGame,
    targetShareAvg,
    routesPerGame,

    targetStdDev,
    fantasyStdDev,

    pprPerTarget,
    redZoneTargetsPerGame,

    volumeScore: Math.round(volumeScore),
    consistencyScore: Math.round(consistencyScore),
    highValueUsageScore: Math.round(highValueUsageScore),
    momentumScore: Math.round(momentumScore),

    roleScore: Math.round(roleScore),
    roleTier,

    redZoneWeaponFlag,
    cardioTEFlag,
    breakoutWatchFlag
  };
}

// ========== QB ROLE BANK (Alpha Context Bank) ==========

export interface WeeklyQBUsageRow {
  playerId: string;
  season: number;
  week: number;
  team: string;

  dropbacks: number | null;              // pass attempts + sacks
  redZoneDropbacks: number | null;       // dropbacks in red zone
  rushAttempts: number | null;
  redZoneRushes: number | null;
  
  epaPerPlay: number | null;
  cpoe: number | null;                   // Completion % over expected
  sacks: number | null;
  
  passingAttempts: number | null;
  completions: number | null;
  passingYards: number | null;
  passingTouchdowns: number | null;
  interceptions: number | null;
  rushingYards: number | null;
  rushingTouchdowns: number | null;
  fantasyPointsPpr: number | null;
}

export type QBAlphaTier =
  | 'ELITE_QB1'
  | 'STRONG_QB1'
  | 'MID_QB1'
  | 'HIGH_QB2'
  | 'STREAMING_QB'
  | 'BENCH_QB'
  | 'UNKNOWN';

export interface QBRoleBankSeasonRow {
  playerId: string;
  season: number;

  gamesPlayed: number;

  // Volume
  dropbacksPerGame: number;
  redZoneDropbacksPerGame: number | null;
  passingAttempts: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptions: number;

  // Rushing
  rushAttemptsPerGame: number;
  redZoneRushesPerGame: number | null;
  rushingYards: number;
  rushingTouchdowns: number;

  // Efficiency
  epaPerPlay: number | null;
  cpoe: number | null;
  sackRate: number | null;
  completionPercentage: number | null;
  yardsPerAttempt: number | null;

  // Sub-scores
  volumeScore: number;
  rushingScore: number;
  efficiencyScore: number;
  momentumScore: number;

  // Final
  alphaContextScore: number;
  alphaTier: QBAlphaTier;

  // Flags
  konamiCodeFlag: boolean;      // elite dual-threat (rush + pass)
  systemQBFlag: boolean;         // high efficiency, low volume
  garbageTimeKingFlag: boolean;  // momentum significantly below season avg
}

// ---- QB Scaling functions (0–100) ----

function scaleDropbacksPerGame(dpg: number): number {
  if (dpg >= 42) return 100;  // Josh Allen/Mahomes territory
  if (dpg >= 38) return 90;
  if (dpg >= 34) return 75;
  if (dpg >= 30) return 55;
  if (dpg >= 25) return 35;
  return 20;
}

function scaleRedZoneDropbacks(rzdpg: number | null): number {
  if (rzdpg === null) return 50;
  if (rzdpg >= 2.5) return 100;
  if (rzdpg >= 2.0) return 85;
  if (rzdpg >= 1.5) return 70;
  if (rzdpg >= 1.0) return 55;
  if (rzdpg >= 0.5) return 40;
  return 25;
}

function scaleQBRushAttemptsPerGame(rapg: number): number {
  if (rapg >= 8) return 100;   // Lamar/Hurts elite rushing
  if (rapg >= 6) return 85;
  if (rapg >= 4) return 65;
  if (rapg >= 2) return 40;
  if (rapg >= 1) return 25;
  return 10;
}

function scaleQBRedZoneRushes(rzrpg: number | null): number {
  if (rzrpg === null) return 50;
  if (rzrpg >= 1.5) return 100;
  if (rzrpg >= 1.0) return 85;
  if (rzrpg >= 0.7) return 70;
  if (rzrpg >= 0.4) return 55;
  return 35;
}

function scaleEPA(epa: number | null): number {
  if (epa === null) return 50;
  if (epa >= 0.25) return 100;  // Elite
  if (epa >= 0.18) return 85;
  if (epa >= 0.12) return 70;
  if (epa >= 0.06) return 55;
  if (epa >= 0.0) return 40;
  return 25;
}

function scaleCPOE(cpoe: number | null): number {
  if (cpoe === null) return 50;
  if (cpoe >= 4.0) return 100;
  if (cpoe >= 2.5) return 85;
  if (cpoe >= 1.0) return 70;
  if (cpoe >= -1.0) return 55;
  if (cpoe >= -3.0) return 35;
  return 20;
}

function scaleSackRate(sackRate: number | null): number {
  if (sackRate === null) return 50;
  // Lower is better for sack rate
  if (sackRate <= 4.0) return 100;
  if (sackRate <= 5.5) return 85;
  if (sackRate <= 7.0) return 70;
  if (sackRate <= 8.5) return 55;
  if (sackRate <= 10.0) return 40;
  return 25;
}

export function computeQBAlphaContextRow(
  weeklyRows: WeeklyQBUsageRow[]
): QBRoleBankSeasonRow | null {
  if (!weeklyRows.length) return null;

  const playerId = weeklyRows[0].playerId;
  const season = weeklyRows[0].season;
  const gamesPlayed = weeklyRows.length;

  // Aggregate totals
  let totalDropbacks = 0;
  let totalRedZoneDropbacks = 0;
  let totalRushAttempts = 0;
  let totalRedZoneRushes = 0;
  let totalPassingAttempts = 0;
  let totalCompletions = 0;
  let totalPassingYards = 0;
  let totalPassingTDs = 0;
  let totalInterceptions = 0;
  let totalRushingYards = 0;
  let totalRushingTDs = 0;
  let totalSacks = 0;
  let totalFantasy = 0;

  const epaValues: number[] = [];
  const cpoeValues: number[] = [];
  const fantasyValues: number[] = [];

  for (const w of weeklyRows) {
    totalDropbacks += w.dropbacks ?? 0;
    totalRedZoneDropbacks += w.redZoneDropbacks ?? 0;
    totalRushAttempts += w.rushAttempts ?? 0;
    totalRedZoneRushes += w.redZoneRushes ?? 0;
    totalPassingAttempts += w.passingAttempts ?? 0;
    totalCompletions += w.completions ?? 0;
    totalPassingYards += w.passingYards ?? 0;
    totalPassingTDs += w.passingTouchdowns ?? 0;
    totalInterceptions += w.interceptions ?? 0;
    totalRushingYards += w.rushingYards ?? 0;
    totalRushingTDs += w.rushingTouchdowns ?? 0;
    totalSacks += w.sacks ?? 0;
    totalFantasy += w.fantasyPointsPpr ?? 0;

    if (w.epaPerPlay !== null) epaValues.push(w.epaPerPlay);
    if (w.cpoe !== null) cpoeValues.push(w.cpoe);
    if (w.fantasyPointsPpr !== null) fantasyValues.push(w.fantasyPointsPpr);
  }

  // Per-game metrics
  const dropbacksPerGame = totalDropbacks / gamesPlayed;
  const redZoneDropbacksPerGame = totalRedZoneDropbacks / gamesPlayed;
  const rushAttemptsPerGame = totalRushAttempts / gamesPlayed;
  const redZoneRushesPerGame = totalRedZoneRushes / gamesPlayed;

  // Efficiency metrics
  const epaPerPlay = epaValues.length > 0 ? mean(epaValues) : null;
  const cpoe = cpoeValues.length > 0 ? mean(cpoeValues) : null;
  const sackRate = totalPassingAttempts > 0 
    ? (totalSacks / (totalPassingAttempts + totalSacks)) * 100 
    : null;
  const completionPercentage = totalPassingAttempts > 0
    ? (totalCompletions / totalPassingAttempts) * 100
    : null;
  const yardsPerAttempt = totalPassingAttempts > 0
    ? totalPassingYards / totalPassingAttempts
    : null;

  // ========== VOLUME SCORE (40%) ==========
  // Components: dropbacks per game (70%) + red zone dropbacks (30%)
  const dropbackScore = scaleDropbacksPerGame(dropbacksPerGame);
  const rzDropbackScore = scaleRedZoneDropbacks(redZoneDropbacksPerGame);
  const volumeScore = 0.70 * dropbackScore + 0.30 * rzDropbackScore;

  // ========== RUSHING SCORE (25%) ==========
  // Components: rush attempts per game (70%) + red zone rushes (30%)
  const rushAttemptsScore = scaleQBRushAttemptsPerGame(rushAttemptsPerGame);
  const rzRushScore = scaleQBRedZoneRushes(redZoneRushesPerGame);
  const rushingScore = 0.70 * rushAttemptsScore + 0.30 * rzRushScore;

  // ========== EFFICIENCY SCORE (25%) ==========
  // Components: EPA (40%) + CPOE (30%) + Sack Rate (30%)
  const epaScore = scaleEPA(epaPerPlay);
  const cpoeScore = scaleCPOE(cpoe);
  const sackRateScore = scaleSackRate(sackRate);
  const efficiencyScore = 0.40 * epaScore + 0.30 * cpoeScore + 0.30 * sackRateScore;

  // ========== MOMENTUM SCORE (10%) ==========
  // Last 3 games vs season average fantasy points
  let momentumScore = 50;
  if (gamesPlayed >= 4 && fantasyValues.length >= 4) {
    const last3Games = fantasyValues.slice(-3);
    const avgLast3 = mean(last3Games) ?? 0;
    const avgSeason = mean(fantasyValues) ?? 0;

    if (avgSeason > 0) {
      const momentumRatio = avgLast3 / avgSeason;
      if (momentumRatio >= 1.20) momentumScore = 100;
      else if (momentumRatio >= 1.10) momentumScore = 85;
      else if (momentumRatio >= 1.00) momentumScore = 70;
      else if (momentumRatio >= 0.90) momentumScore = 55;
      else if (momentumRatio >= 0.80) momentumScore = 40;
      else momentumScore = 25;
    }
  }

  // ========== FINAL ALPHA CONTEXT SCORE ==========
  const alphaContextScore =
    0.40 * volumeScore +
    0.25 * rushingScore +
    0.25 * efficiencyScore +
    0.10 * momentumScore;

  // ========== TIER ASSIGNMENT ==========
  let alphaTier: QBAlphaTier;
  if (alphaContextScore >= 82) alphaTier = 'ELITE_QB1';
  else if (alphaContextScore >= 74) alphaTier = 'STRONG_QB1';
  else if (alphaContextScore >= 66) alphaTier = 'MID_QB1';
  else if (alphaContextScore >= 58) alphaTier = 'HIGH_QB2';
  else if (alphaContextScore >= 50) alphaTier = 'STREAMING_QB';
  else alphaTier = 'BENCH_QB';

  // ========== FLAGS ==========
  // Konami Code: elite dual-threat (rush score >= 80 AND volume score >= 75)
  const konamiCodeFlag = rushingScore >= 80 && volumeScore >= 75;

  // System QB: high efficiency but low volume (efficiency >= 75 AND volume < 65)
  const systemQBFlag = efficiencyScore >= 75 && volumeScore < 65;

  // Garbage Time King: momentum significantly below season avg (momentum < 40)
  const garbageTimeKingFlag = momentumScore < 40;

  return {
    playerId,
    season,
    gamesPlayed,

    dropbacksPerGame,
    redZoneDropbacksPerGame,
    passingAttempts: totalPassingAttempts,
    passingYards: totalPassingYards,
    passingTouchdowns: totalPassingTDs,
    interceptions: totalInterceptions,

    rushAttemptsPerGame,
    redZoneRushesPerGame,
    rushingYards: totalRushingYards,
    rushingTouchdowns: totalRushingTDs,

    epaPerPlay,
    cpoe,
    sackRate,
    completionPercentage,
    yardsPerAttempt,

    volumeScore: Math.round(volumeScore),
    rushingScore: Math.round(rushingScore),
    efficiencyScore: Math.round(efficiencyScore),
    momentumScore: Math.round(momentumScore),

    alphaContextScore: Math.round(alphaContextScore),

    alphaTier,
    konamiCodeFlag,
    systemQBFlag,
    garbageTimeKingFlag
  };
}
