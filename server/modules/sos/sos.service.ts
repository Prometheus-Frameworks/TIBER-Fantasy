import { db } from '../../db';
import { defenseVP, schedule } from '@shared/schema';
import { eq, and, lte, between, gte } from 'drizzle-orm';

export type Position = 'RB'|'WR'|'QB'|'TE';

export interface DVPRow {
  season: number;
  week: number;
  defTeam: string;
  position: Position;
  fpAllowed: number;
  last4Avg?: number | null;
}

export interface ScheduleRow {
  season: number;
  week: number;
  home: string;
  away: string;
}

export interface WeeklySOS {
  team: string;
  position: Position;
  week: number;
  opponent: string;
  sos_score: number; // 0-100 higher = easier
  tier: 'green'|'yellow'|'red';
}

export interface ROSItem {
  team: string;
  position: Position;
  weeks: number[];
  avg_score: number;
  tier: 'green'|'yellow'|'red';
}

/** Opinionated v1 weights */
const RECENCY_WEIGHT = 0.6;  // last4
const SEASON_WEIGHT  = 0.4;  // season avg
const DEFAULT_SEASON = 2024; // until 2025 games exist

function tier(score: number): 'green'|'yellow'|'red' {
  if (score >= 67) return 'green';
  if (score >= 33) return 'yellow';
  return 'red';
}

/** Percentile scaling 0..100 */
function percentileScale(values: number[], v: number): number {
  if (!values.length) return 50;
  const sorted = [...values].sort((a,b)=>a-b);
  // Position of v (inclusive rank)
  let rank = 0;
  for (let i=0;i<sorted.length;i++) {
    if (v >= sorted[i]) rank = i + 1;
    else break;
  }
  return Math.round((rank / sorted.length) * 100);
}

/** Season avg per defense/position up to given week (inclusive) */
async function getSeasonAvg(season: number, position: Position, week: number) {
  const rows = await db
    .select({
      defTeam: defenseVP.defTeam,
      avgFpAllowed: defenseVP.fpAllowed
    })
    .from(defenseVP)
    .where(
      and(
        eq(defenseVP.season, season),
        eq(defenseVP.position, position),
        lte(defenseVP.week, week)
      )
    );

  // Group by defense and calculate average
  const defenseStats = new Map<string, number[]>();
  rows.forEach(row => {
    if (!defenseStats.has(row.defTeam)) {
      defenseStats.set(row.defTeam, []);
    }
    defenseStats.get(row.defTeam)!.push(row.avgFpAllowed);
  });

  const map = new Map<string, number>();
  defenseStats.forEach((values, defTeam) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    map.set(defTeam, avg);
  });

  return map;
}

/** Last4 average per defense/position at given week (prefer precomputed column) */
async function getLast4(season: number, position: Position, week: number) {
  // First try to get precomputed last4_avg for current week
  const currentWeekRows = await db
    .select({
      defTeam: defenseVP.defTeam,
      last4Avg: defenseVP.last4Avg
    })
    .from(defenseVP)
    .where(
      and(
        eq(defenseVP.season, season),
        eq(defenseVP.position, position),
        eq(defenseVP.week, week)
      )
    );

  const map = new Map<string, number>();
  
  // If we have precomputed values, use those
  if (currentWeekRows.some(r => r.last4Avg !== null)) {
    currentWeekRows.forEach(row => {
      if (row.last4Avg !== null) {
        map.set(row.defTeam, row.last4Avg);
      }
    });
    return map;
  }

  // Fallback: compute trailing prev 4 weeks
  const fallbackRows = await db
    .select({
      defTeam: defenseVP.defTeam,
      fpAllowed: defenseVP.fpAllowed
    })
    .from(defenseVP)
    .where(
      and(
        eq(defenseVP.season, season),
        eq(defenseVP.position, position),
        between(defenseVP.week, week - 4, week - 1)
      )
    );

  // Group by defense and calculate last 4 average
  const defenseStats = new Map<string, number[]>();
  fallbackRows.forEach(row => {
    if (!defenseStats.has(row.defTeam)) {
      defenseStats.set(row.defTeam, []);
    }
    defenseStats.get(row.defTeam)!.push(row.fpAllowed);
  });

  defenseStats.forEach((values, defTeam) => {
    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      map.set(defTeam, avg);
    }
  });

  return map;
}

/** All games for week */
async function getWeekGames(season: number, week: number): Promise<ScheduleRow[]> {
  const games = await db
    .select()
    .from(schedule)
    .where(
      and(
        eq(schedule.season, season),
        eq(schedule.week, week)
      )
    );

  return games;
}

/** Build weekly SOS for a position */
export async function computeWeeklySOS(position: Position, week: number, season = DEFAULT_SEASON): Promise<WeeklySOS[]> {
  const games = await getWeekGames(season, week);
  if (!games.length) return [];

  const seasonAvg = await getSeasonAvg(season, position, week);
  const last4 = await getLast4(season, position, week);

  // pool of "easiness candidates" for percentile scaling
  const easinessPool: number[] = [];

  // Map opponent defense -> blended ease proxy
  const defEase = new Map<string, number>();
  const defenses = new Set<string>();
  games.forEach(g => { 
    defenses.add(g.home); 
    defenses.add(g.away); 
  });

  // Build a table of defense -> blended FP allowed proxy
  defenses.forEach(team => {
    const sAvg = seasonAvg.get(team);
    const l4 = last4.get(team);
    const blended =
      (l4 != null && !isNaN(l4) ? RECENCY_WEIGHT * l4 : 0) +
      (sAvg != null && !isNaN(sAvg) ? SEASON_WEIGHT * sAvg : 0);

    if (!isNaN(blended) && blended > 0) {
      defEase.set(team, blended);
      easinessPool.push(blended);
    }
  });

  // If pool is empty (early season, missing data), bail gracefully
  if (!easinessPool.length) return [];

  const rows: WeeklySOS[] = [];
  for (const g of games) {
    // Home offense vs away defense
    const awayDef = g.away;
    const homeEaseRaw = defEase.get(awayDef);
    if (homeEaseRaw != null) {
      const score = percentileScale(easinessPool, homeEaseRaw);
      rows.push({
        team: g.home,
        position,
        week,
        opponent: awayDef,
        sos_score: score,
        tier: tier(score)
      });
    }

    // Away offense vs home defense
    const homeDef = g.home;
    const awayEaseRaw = defEase.get(homeDef);
    if (awayEaseRaw != null) {
      const score = percentileScale(easinessPool, awayEaseRaw);
      rows.push({
        team: g.away,
        position,
        week,
        opponent: homeDef,
        sos_score: score,
        tier: tier(score)
      });
    }
  }

  return rows;
}

/** Simple ROS: average of next N weeks */
export async function computeROSSOS(position: Position, startWeek = 1, window = 5, season = DEFAULT_SEASON): Promise<ROSItem[]> {
  const weeks = Array.from({length: window}, (_,i) => startWeek + i);
  const all: WeeklySOS[] = [];
  
  for (const w of weeks) {
    const wk = await computeWeeklySOS(position, w, season);
    all.push(...wk);
  }
  
  const byTeam = new Map<string, WeeklySOS[]>();
  all.forEach(r => {
    const k = `${r.team}:${position}`;
    if (!byTeam.has(k)) byTeam.set(k, []);
    byTeam.get(k)!.push(r);
  });

  return Array.from(byTeam.entries()).map(([k, arr]) => {
    const [team] = k.split(':');
    const avg = Math.round(arr.reduce((a,b)=>a+b.sos_score, 0) / arr.length);
    return { team, position, weeks, avg_score: avg, tier: tier(avg) };
  }).sort((a,b)=>b.avg_score - a.avg_score);
}