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
  const roleScore =
    0.58 * volumeScore +
    0.18 * consistencyScore +
    0.18 * highValueUsageScore +
    0.06 * momentumScore;

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

    roleScore: Math.round(roleScore),

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
