import { db } from "../infra/db";
import { schedule, defenseContext, defenseVP } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

interface DefenseMetrics {
  baseAlpha: number;
  sackRate: number;
  pressureRate: number;
  intRate: number;
  turnoverRate: number;
  pointsAllowedPerDrive: number;
}

interface OpponentMetrics {
  turnoverWorthyRate: number;
  sackRateAllowed: number;
  pressureRateAllowed: number;
  pointsPerDrive: number;
  playsPerGame: number;
  qbIsRookie: boolean;
  olInjured: boolean;
}

interface MatchupBreakdown {
  turnoverBoost: number;
  sackBoost: number;
  pressureBoost: number;
  scoringBoost: number;
  rookieBonus: number;
  olInjuryBonus: number;
  totalBoost: number;
}

interface DSTRanking {
  rank: number;
  team: string;
  opponent: string;
  projectedPoints: number;
  alpha: number;
  boost: number;
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  rosteredPct?: number;
  turnoverRate?: number;
  sackRate?: number;
  pointsAllowed?: number;
  defenseMetrics?: DefenseMetrics;
  opponentMetrics?: OpponentMetrics;
  matchupBreakdown?: MatchupBreakdown;
}

interface DSTStreamerResponse {
  success: boolean;
  week: number;
  season: number;
  tiers: {
    T1: DSTRanking[];
    T2: DSTRanking[];
    T3: DSTRanking[];
    T4: DSTRanking[];
  };
  hiddenGem?: DSTRanking;
  rankings: DSTRanking[];
}

const OFFENSE_VULNERABILITIES: Record<string, {
  turnoverWorthyRate: number;
  sackRateAllowed: number;
  pressureRateAllowed: number;
  pointsPerDrive: number;
  playsPerGame: number;
  qbIsRookie: boolean;
  olInjured: boolean;
}> = {
  NYG: { turnoverWorthyRate: 0.058, sackRateAllowed: 0.092, pressureRateAllowed: 0.42, pointsPerDrive: 1.52, playsPerGame: 58, qbIsRookie: false, olInjured: true },
  CAR: { turnoverWorthyRate: 0.052, sackRateAllowed: 0.088, pressureRateAllowed: 0.40, pointsPerDrive: 1.61, playsPerGame: 60, qbIsRookie: true, olInjured: false },
  NE: { turnoverWorthyRate: 0.048, sackRateAllowed: 0.085, pressureRateAllowed: 0.38, pointsPerDrive: 1.72, playsPerGame: 59, qbIsRookie: true, olInjured: false },
  TEN: { turnoverWorthyRate: 0.045, sackRateAllowed: 0.078, pressureRateAllowed: 0.36, pointsPerDrive: 1.68, playsPerGame: 61, qbIsRookie: false, olInjured: true },
  LV: { turnoverWorthyRate: 0.042, sackRateAllowed: 0.076, pressureRateAllowed: 0.35, pointsPerDrive: 1.75, playsPerGame: 62, qbIsRookie: false, olInjured: false },
  CLE: { turnoverWorthyRate: 0.044, sackRateAllowed: 0.082, pressureRateAllowed: 0.37, pointsPerDrive: 1.58, playsPerGame: 58, qbIsRookie: false, olInjured: true },
  CHI: { turnoverWorthyRate: 0.040, sackRateAllowed: 0.074, pressureRateAllowed: 0.34, pointsPerDrive: 1.82, playsPerGame: 63, qbIsRookie: true, olInjured: false },
  JAX: { turnoverWorthyRate: 0.038, sackRateAllowed: 0.070, pressureRateAllowed: 0.33, pointsPerDrive: 1.78, playsPerGame: 64, qbIsRookie: false, olInjured: false },
  NYJ: { turnoverWorthyRate: 0.035, sackRateAllowed: 0.068, pressureRateAllowed: 0.32, pointsPerDrive: 1.85, playsPerGame: 62, qbIsRookie: false, olInjured: true },
  IND: { turnoverWorthyRate: 0.034, sackRateAllowed: 0.065, pressureRateAllowed: 0.30, pointsPerDrive: 1.92, playsPerGame: 65, qbIsRookie: false, olInjured: false },
  DEN: { turnoverWorthyRate: 0.032, sackRateAllowed: 0.062, pressureRateAllowed: 0.29, pointsPerDrive: 1.95, playsPerGame: 64, qbIsRookie: true, olInjured: false },
  MIA: { turnoverWorthyRate: 0.030, sackRateAllowed: 0.060, pressureRateAllowed: 0.28, pointsPerDrive: 2.05, playsPerGame: 66, qbIsRookie: false, olInjured: false },
  NO: { turnoverWorthyRate: 0.032, sackRateAllowed: 0.058, pressureRateAllowed: 0.27, pointsPerDrive: 1.98, playsPerGame: 63, qbIsRookie: false, olInjured: true },
  SEA: { turnoverWorthyRate: 0.028, sackRateAllowed: 0.072, pressureRateAllowed: 0.34, pointsPerDrive: 2.12, playsPerGame: 67, qbIsRookie: false, olInjured: false },
  ATL: { turnoverWorthyRate: 0.028, sackRateAllowed: 0.055, pressureRateAllowed: 0.26, pointsPerDrive: 2.08, playsPerGame: 65, qbIsRookie: false, olInjured: false },
  ARI: { turnoverWorthyRate: 0.030, sackRateAllowed: 0.064, pressureRateAllowed: 0.30, pointsPerDrive: 2.02, playsPerGame: 66, qbIsRookie: false, olInjured: false },
  HOU: { turnoverWorthyRate: 0.026, sackRateAllowed: 0.052, pressureRateAllowed: 0.25, pointsPerDrive: 2.18, playsPerGame: 68, qbIsRookie: false, olInjured: false },
  TB: { turnoverWorthyRate: 0.025, sackRateAllowed: 0.050, pressureRateAllowed: 0.24, pointsPerDrive: 2.22, playsPerGame: 67, qbIsRookie: false, olInjured: false },
  CIN: { turnoverWorthyRate: 0.024, sackRateAllowed: 0.048, pressureRateAllowed: 0.23, pointsPerDrive: 2.25, playsPerGame: 68, qbIsRookie: false, olInjured: true },
  LAC: { turnoverWorthyRate: 0.022, sackRateAllowed: 0.045, pressureRateAllowed: 0.22, pointsPerDrive: 2.28, playsPerGame: 66, qbIsRookie: false, olInjured: false },
  PIT: { turnoverWorthyRate: 0.024, sackRateAllowed: 0.055, pressureRateAllowed: 0.26, pointsPerDrive: 2.15, playsPerGame: 64, qbIsRookie: false, olInjured: false },
  GB: { turnoverWorthyRate: 0.020, sackRateAllowed: 0.042, pressureRateAllowed: 0.20, pointsPerDrive: 2.35, playsPerGame: 68, qbIsRookie: false, olInjured: false },
  DAL: { turnoverWorthyRate: 0.022, sackRateAllowed: 0.058, pressureRateAllowed: 0.28, pointsPerDrive: 2.18, playsPerGame: 65, qbIsRookie: false, olInjured: true },
  MIN: { turnoverWorthyRate: 0.020, sackRateAllowed: 0.040, pressureRateAllowed: 0.19, pointsPerDrive: 2.38, playsPerGame: 67, qbIsRookie: false, olInjured: false },
  WAS: { turnoverWorthyRate: 0.022, sackRateAllowed: 0.048, pressureRateAllowed: 0.24, pointsPerDrive: 2.28, playsPerGame: 68, qbIsRookie: true, olInjured: false },
  SF: { turnoverWorthyRate: 0.018, sackRateAllowed: 0.038, pressureRateAllowed: 0.18, pointsPerDrive: 2.42, playsPerGame: 69, qbIsRookie: false, olInjured: true },
  PHI: { turnoverWorthyRate: 0.016, sackRateAllowed: 0.035, pressureRateAllowed: 0.17, pointsPerDrive: 2.48, playsPerGame: 70, qbIsRookie: false, olInjured: false },
  BUF: { turnoverWorthyRate: 0.015, sackRateAllowed: 0.032, pressureRateAllowed: 0.16, pointsPerDrive: 2.55, playsPerGame: 71, qbIsRookie: false, olInjured: false },
  KC: { turnoverWorthyRate: 0.014, sackRateAllowed: 0.030, pressureRateAllowed: 0.15, pointsPerDrive: 2.58, playsPerGame: 68, qbIsRookie: false, olInjured: false },
  DET: { turnoverWorthyRate: 0.016, sackRateAllowed: 0.034, pressureRateAllowed: 0.17, pointsPerDrive: 2.62, playsPerGame: 72, qbIsRookie: false, olInjured: false },
  BAL: { turnoverWorthyRate: 0.014, sackRateAllowed: 0.028, pressureRateAllowed: 0.14, pointsPerDrive: 2.65, playsPerGame: 70, qbIsRookie: false, olInjured: false },
  LAR: { turnoverWorthyRate: 0.020, sackRateAllowed: 0.044, pressureRateAllowed: 0.22, pointsPerDrive: 2.32, playsPerGame: 67, qbIsRookie: false, olInjured: false },
};

const DEFENSE_STRENGTHS: Record<string, {
  baseAlpha: number;
  sackRate: number;
  pressureRate: number;
  intRate: number;
  turnoverRate: number;
  pointsAllowedPerDrive: number;
}> = {
  BAL: { baseAlpha: 88, sackRate: 0.092, pressureRate: 0.38, intRate: 0.042, turnoverRate: 0.068, pointsAllowedPerDrive: 1.44 },
  CLE: { baseAlpha: 82, sackRate: 0.088, pressureRate: 0.36, intRate: 0.038, turnoverRate: 0.065, pointsAllowedPerDrive: 1.51 },
  PHI: { baseAlpha: 85, sackRate: 0.095, pressureRate: 0.40, intRate: 0.040, turnoverRate: 0.070, pointsAllowedPerDrive: 1.48 },
  DEN: { baseAlpha: 84, sackRate: 0.086, pressureRate: 0.37, intRate: 0.036, turnoverRate: 0.062, pointsAllowedPerDrive: 1.55 },
  DAL: { baseAlpha: 78, sackRate: 0.082, pressureRate: 0.35, intRate: 0.034, turnoverRate: 0.058, pointsAllowedPerDrive: 1.72 },
  SF: { baseAlpha: 80, sackRate: 0.078, pressureRate: 0.34, intRate: 0.032, turnoverRate: 0.056, pointsAllowedPerDrive: 1.68 },
  KC: { baseAlpha: 79, sackRate: 0.075, pressureRate: 0.33, intRate: 0.035, turnoverRate: 0.060, pointsAllowedPerDrive: 1.65 },
  BUF: { baseAlpha: 81, sackRate: 0.080, pressureRate: 0.35, intRate: 0.038, turnoverRate: 0.064, pointsAllowedPerDrive: 1.58 },
  PIT: { baseAlpha: 80, sackRate: 0.084, pressureRate: 0.36, intRate: 0.033, turnoverRate: 0.057, pointsAllowedPerDrive: 1.62 },
  MIN: { baseAlpha: 78, sackRate: 0.076, pressureRate: 0.34, intRate: 0.036, turnoverRate: 0.059, pointsAllowedPerDrive: 1.70 },
  NYJ: { baseAlpha: 76, sackRate: 0.074, pressureRate: 0.33, intRate: 0.030, turnoverRate: 0.052, pointsAllowedPerDrive: 1.78 },
  DET: { baseAlpha: 77, sackRate: 0.072, pressureRate: 0.32, intRate: 0.034, turnoverRate: 0.056, pointsAllowedPerDrive: 1.75 },
  GB: { baseAlpha: 74, sackRate: 0.068, pressureRate: 0.30, intRate: 0.028, turnoverRate: 0.048, pointsAllowedPerDrive: 1.88 },
  MIA: { baseAlpha: 72, sackRate: 0.065, pressureRate: 0.29, intRate: 0.026, turnoverRate: 0.045, pointsAllowedPerDrive: 1.92 },
  CHI: { baseAlpha: 73, sackRate: 0.070, pressureRate: 0.31, intRate: 0.028, turnoverRate: 0.050, pointsAllowedPerDrive: 1.85 },
  LAC: { baseAlpha: 75, sackRate: 0.073, pressureRate: 0.32, intRate: 0.030, turnoverRate: 0.053, pointsAllowedPerDrive: 1.80 },
  SEA: { baseAlpha: 71, sackRate: 0.064, pressureRate: 0.28, intRate: 0.024, turnoverRate: 0.042, pointsAllowedPerDrive: 1.95 },
  IND: { baseAlpha: 70, sackRate: 0.062, pressureRate: 0.27, intRate: 0.022, turnoverRate: 0.040, pointsAllowedPerDrive: 2.00 },
  NO: { baseAlpha: 69, sackRate: 0.060, pressureRate: 0.26, intRate: 0.024, turnoverRate: 0.042, pointsAllowedPerDrive: 1.98 },
  WAS: { baseAlpha: 74, sackRate: 0.068, pressureRate: 0.30, intRate: 0.028, turnoverRate: 0.050, pointsAllowedPerDrive: 1.82 },
  NYG: { baseAlpha: 65, sackRate: 0.055, pressureRate: 0.24, intRate: 0.018, turnoverRate: 0.035, pointsAllowedPerDrive: 2.15 },
  CAR: { baseAlpha: 62, sackRate: 0.050, pressureRate: 0.22, intRate: 0.016, turnoverRate: 0.032, pointsAllowedPerDrive: 2.25 },
  NE: { baseAlpha: 68, sackRate: 0.058, pressureRate: 0.25, intRate: 0.020, turnoverRate: 0.038, pointsAllowedPerDrive: 2.05 },
  TEN: { baseAlpha: 66, sackRate: 0.054, pressureRate: 0.23, intRate: 0.018, turnoverRate: 0.034, pointsAllowedPerDrive: 2.12 },
  LV: { baseAlpha: 64, sackRate: 0.052, pressureRate: 0.22, intRate: 0.016, turnoverRate: 0.030, pointsAllowedPerDrive: 2.20 },
  JAX: { baseAlpha: 67, sackRate: 0.056, pressureRate: 0.24, intRate: 0.020, turnoverRate: 0.036, pointsAllowedPerDrive: 2.08 },
  HOU: { baseAlpha: 73, sackRate: 0.066, pressureRate: 0.29, intRate: 0.026, turnoverRate: 0.046, pointsAllowedPerDrive: 1.90 },
  TB: { baseAlpha: 71, sackRate: 0.063, pressureRate: 0.28, intRate: 0.024, turnoverRate: 0.044, pointsAllowedPerDrive: 1.95 },
  CIN: { baseAlpha: 68, sackRate: 0.058, pressureRate: 0.25, intRate: 0.022, turnoverRate: 0.040, pointsAllowedPerDrive: 2.02 },
  ARI: { baseAlpha: 66, sackRate: 0.054, pressureRate: 0.23, intRate: 0.018, turnoverRate: 0.034, pointsAllowedPerDrive: 2.10 },
  ATL: { baseAlpha: 67, sackRate: 0.056, pressureRate: 0.24, intRate: 0.020, turnoverRate: 0.036, pointsAllowedPerDrive: 2.08 },
  LAR: { baseAlpha: 70, sackRate: 0.060, pressureRate: 0.26, intRate: 0.022, turnoverRate: 0.042, pointsAllowedPerDrive: 2.00 },
};

function getTier(alpha: number): 'T1' | 'T2' | 'T3' | 'T4' {
  if (alpha >= 85) return 'T1';
  if (alpha >= 75) return 'T2';
  if (alpha >= 65) return 'T3';
  return 'T4';
}

export async function getDSTStreamer(week: number = 14, season: number = 2025): Promise<DSTStreamerResponse> {
  console.log(`[DST Streamer] Generating rankings for Week ${week}, Season ${season}`);
  
  const scheduleData = await db
    .select()
    .from(schedule)
    .where(and(eq(schedule.season, season), eq(schedule.week, week)));

  if (scheduleData.length === 0) {
    console.warn(`[DST Streamer] No schedule data for Week ${week}`);
  }

  const rankings: DSTRanking[] = [];

  for (const game of scheduleData) {
    for (const [defTeam, offTeam] of [[game.home, game.away], [game.away, game.home]]) {
      const defStrength = DEFENSE_STRENGTHS[defTeam] ?? { 
        baseAlpha: 65, 
        sackRate: 0.055, 
        pressureRate: 0.25, 
        intRate: 0.020, 
        turnoverRate: 0.038, 
        pointsAllowedPerDrive: 2.00 
      };
      
      const offVuln = OFFENSE_VULNERABILITIES[offTeam] ?? { 
        turnoverWorthyRate: 0.030, 
        sackRateAllowed: 0.060, 
        pressureRateAllowed: 0.28, 
        pointsPerDrive: 2.10, 
        playsPerGame: 64, 
        qbIsRookie: false, 
        olInjured: false 
      };

      const turnoverBoost = Number(((offVuln.turnoverWorthyRate - 0.025) * 200).toFixed(1));
      const sackBoost = Number(((offVuln.sackRateAllowed - 0.050) * 150).toFixed(1));
      const pressureBoost = Number(((offVuln.pressureRateAllowed - 0.25) * 30).toFixed(1));
      const scoringBoost = Number(((2.2 - offVuln.pointsPerDrive) * 5).toFixed(1));
      const rookieBonus = offVuln.qbIsRookie ? 3 : 0;
      const olInjuryBonus = offVuln.olInjured ? 2 : 0;

      const matchupBoost = turnoverBoost + sackBoost + pressureBoost + scoringBoost + rookieBonus + olInjuryBonus;

      const score = defStrength.baseAlpha + matchupBoost;
      const projectedPoints = Number((score / 9.0).toFixed(1));
      const alpha = Math.round(Math.min(100, Math.max(45, score)));
      const boost = Math.round(matchupBoost);

      const matchupBreakdown: MatchupBreakdown = {
        turnoverBoost,
        sackBoost,
        pressureBoost,
        scoringBoost,
        rookieBonus,
        olInjuryBonus,
        totalBoost: boost,
      };

      rankings.push({
        rank: 0,
        team: defTeam,
        opponent: offTeam,
        projectedPoints,
        alpha,
        boost,
        tier: getTier(alpha),
        turnoverRate: defStrength.turnoverRate,
        sackRate: defStrength.sackRate,
        pointsAllowed: defStrength.pointsAllowedPerDrive,
        defenseMetrics: defStrength,
        opponentMetrics: offVuln,
        matchupBreakdown,
      });
    }
  }

  rankings.sort((a, b) => b.alpha - a.alpha);
  rankings.forEach((r, i) => r.rank = i + 1);

  const tiers = {
    T1: rankings.filter(r => r.tier === 'T1'),
    T2: rankings.filter(r => r.tier === 'T2'),
    T3: rankings.filter(r => r.tier === 'T3'),
    T4: rankings.filter(r => r.tier === 'T4'),
  };

  const hiddenGem = rankings.find(r => 
    (r.rosteredPct === undefined || r.rosteredPct < 40) && 
    r.projectedPoints >= 10 && 
    r.rank > 8
  );

  return {
    success: true,
    week,
    season,
    tiers,
    hiddenGem,
    rankings,
  };
}
