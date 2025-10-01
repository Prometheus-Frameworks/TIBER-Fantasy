import { db } from '../../db';
import { defenseVP, schedule, defenseContext, teamOffensiveContext, teamDefensiveContext, teamReceiverAlignmentMatchups, teamCoverageMatchups } from '@shared/schema';
import { eq, and, lte, between, gte } from 'drizzle-orm';
import { oasisSosService } from './oasisSosService';

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

export interface PlayerSample {
  name: string;
  team: string;
  fpts: number;
}

export interface WeeklySOS {
  team: string;
  position: Position;
  week: number;
  opponent: string;
  sos_score: number; // 0-100 higher = easier
  tier: 'green'|'yellow'|'red';
  samples?: {
    total: number;
    players: PlayerSample[];
  };
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

/** Get position-specific sample count */
function getSampleCount(position: Position): number {
  switch (position) {
    case 'RB': return 2;
    case 'WR': return 3;
    case 'TE': return 1;
    case 'QB': return 1;
    default: return 2;
  }
}

/** Batch fetch top N players and totals for all defenses (avoids N+1) */
async function getPlayerSamplesBatch(season: number, week: number, position: Position, sampleCount: number): Promise<{
  playersByDef: Map<string, PlayerSample[]>;
  totalsByDef: Map<string, number>;
}> {
  try {
    // 1) Fetch all top-N players per defense using window function
    const topPlayersQuery = `
      SELECT def_team, player_name, player_team, fpts
      FROM (
        SELECT def_team, player_name, player_team, fpts,
               ROW_NUMBER() OVER (PARTITION BY def_team ORDER BY fpts DESC) AS rn
        FROM player_vs_defense
        WHERE season = ${season} AND week = ${week} AND position = '${position}'
      ) t
      WHERE rn <= ${sampleCount}
    `;
    
    const topPlayersResult = await db.execute(topPlayersQuery);

    // 2) Fetch totals per defense  
    const totalsQuery = `
      SELECT def_team, SUM(fpts) AS total_fpts
      FROM player_vs_defense
      WHERE season = ${season} AND week = ${week} AND position = '${position}'
      GROUP BY def_team
    `;
    
    const totalsResult = await db.execute(totalsQuery);

    // 3) Index for quick attachment
    const playersByDef = new Map<string, PlayerSample[]>();
    topPlayersResult.rows.forEach((row: any) => {
      const defTeam = row.def_team;
      if (!playersByDef.has(defTeam)) {
        playersByDef.set(defTeam, []);
      }
      playersByDef.get(defTeam)!.push({
        name: row.player_name,
        team: row.player_team,
        fpts: Number(row.fpts)
      });
    });

    const totalsByDef = new Map<string, number>();
    totalsResult.rows.forEach((row: any) => {
      totalsByDef.set(row.def_team, Number(row.total_fpts));
    });

    return { playersByDef, totalsByDef };
  } catch (error) {
    console.error('Error fetching player samples batch:', error);
    return { playersByDef: new Map(), totalsByDef: new Map() };
  }
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
  // For 2025 early season, use OASIS projections when historical data isn't available
  if (season === 2025 && week <= 3) {
    console.info(`[SOS] Using OASIS projections for ${season} Week ${week}`);
    return await oasisSosService.generateOasisWeeklySOS(position, week, season);
  }

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
  // For 2025 early season, use OASIS projections
  if (season === 2025 && startWeek <= 3) {
    console.info(`[SOS] Using OASIS ROS projections for ${season} starting Week ${startWeek}`);
    return await oasisSosService.generateOasisROSSOS(position, startWeek, window, season);
  }

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

// ==== SOSv2: Contextual mode ====
export type Mode = 'fpa'|'ctx';
export type Weights = { w_fpa:number; w_epa:number; w_pace:number; w_rz:number };

interface CtxRow {
  defTeam: string;
  epaPerPlayAllowed: number | null;
  playsAllowedPerGame: number | null;
  rzTdRateAllowed: number | null;
  homeDefAdj: number | null;
  awayDefAdj: number | null;
}

export function normalizeWeights(w:{w_fpa:number;w_epa:number;w_pace:number;w_rz:number}) {
  const sum = w.w_fpa + w.w_epa + w.w_pace + w.w_rz;
  if (!Number.isFinite(sum) || sum <= 0) return { w_fpa:0.55, w_epa:0.20, w_pace:0.15, w_rz:0.10 };
  return {
    w_fpa: w.w_fpa / sum,
    w_epa: w.w_epa / sum,
    w_pace: w.w_pace / sum,
    w_rz:  w.w_rz  / sum,
  };
}

export function parseWeights(s?: string): Weights {
  if (!s) return { w_fpa:0.55, w_epa:0.20, w_pace:0.15, w_rz:0.10 };
  const parts = s.split(',').map(Number);
  return {
    w_fpa: Number.isFinite(parts[0]) ? parts[0] : 0.55,
    w_epa: Number.isFinite(parts[1]) ? parts[1] : 0.20,
    w_pace: Number.isFinite(parts[2]) ? parts[2] : 0.15,
    w_rz:  Number.isFinite(parts[3]) ? parts[3] : 0.10,
  };
}

async function getContext(season:number, week:number): Promise<Map<string, CtxRow>> {
  try {
    const rows = await db
      .select({
        defTeam: defenseContext.defTeam,
        epaPerPlayAllowed: defenseContext.epaPerPlayAllowed,
        playsAllowedPerGame: defenseContext.playsAllowedPerGame,
        rzTdRateAllowed: defenseContext.rzTdRateAllowed,
        homeDefAdj: defenseContext.homeDefAdj,
        awayDefAdj: defenseContext.awayDefAdj
      })
      .from(defenseContext)
      .where(
        and(
          eq(defenseContext.season, season),
          eq(defenseContext.week, week)
        )
      );

    const m = new Map<string, CtxRow>();
    rows.forEach(r => m.set(r.defTeam, r as CtxRow));
    return m;
  } catch (error) {
    // If defense_context table doesn't exist yet, return empty map
    console.warn('defense_context table not available, falling back to FPA mode');
    return new Map();
  }
}

// ==== Team Analytics Data Fetchers ====

interface AlignmentMatchupData {
  team: string;
  offOutsideWrFpg: number | null;
  offSlotFpg: number | null;
  offTeFpg: number | null;
  defOutsideWrFpgAllowed: number | null;
  defSlotFpgAllowed: number | null;
  defTeFpgAllowed: number | null;
}

interface CoverageMatchupData {
  team: string;
  offZoneFpdb: number | null;
  offManFpdb: number | null;
  offTwoHighFpdb: number | null;
  offOneHighFpdb: number | null;
  defZonePct: number | null;
  defManPct: number | null;
  defTwoHighPct: number | null;
  defOneHighPct: number | null;
  defZoneFpdbAllowed: number | null;
  defManFpdbAllowed: number | null;
  defTwoHighFpdbAllowed: number | null;
  defOneHighFpdbAllowed: number | null;
}

interface OffensiveContextData {
  team: string;
  passEpa: number | null;
  rushEpa: number | null;
  ybcPerAtt: number | null;
  pressureRateAllowed: number | null;
}

interface DefensiveContextData {
  team: string;
  passEpaAllowed: number | null;
  rushEpaAllowed: number | null;
  ybcPerAttAllowed: number | null;
  pressureRateGenerated: number | null;
}

async function getAlignmentMatchups(season: number, week: number): Promise<Map<string, AlignmentMatchupData>> {
  try {
    const rows = await db
      .select()
      .from(teamReceiverAlignmentMatchups)
      .where(
        and(
          eq(teamReceiverAlignmentMatchups.season, season),
          eq(teamReceiverAlignmentMatchups.week, week)
        )
      );

    const m = new Map<string, AlignmentMatchupData>();
    rows.forEach(r => m.set(r.team, r as AlignmentMatchupData));
    return m;
  } catch (error) {
    console.warn('team_receiver_alignment_matchups table not available');
    return new Map();
  }
}

async function getCoverageMatchups(season: number, week: number): Promise<Map<string, CoverageMatchupData>> {
  try {
    const rows = await db
      .select()
      .from(teamCoverageMatchups)
      .where(
        and(
          eq(teamCoverageMatchups.season, season),
          eq(teamCoverageMatchups.week, week)
        )
      );

    const m = new Map<string, CoverageMatchupData>();
    rows.forEach(r => m.set(r.team, r as CoverageMatchupData));
    return m;
  } catch (error) {
    console.warn('team_coverage_matchups table not available');
    return new Map();
  }
}

async function getTeamOffensiveContext(season: number, week: number): Promise<Map<string, OffensiveContextData>> {
  try {
    const rows = await db
      .select({
        team: teamOffensiveContext.team,
        passEpa: teamOffensiveContext.passEpa,
        rushEpa: teamOffensiveContext.rushEpa,
        ybcPerAtt: teamOffensiveContext.ybcPerAtt,
        pressureRateAllowed: teamOffensiveContext.pressureRateAllowed
      })
      .from(teamOffensiveContext)
      .where(
        and(
          eq(teamOffensiveContext.season, season),
          eq(teamOffensiveContext.week, week)
        )
      );

    const m = new Map<string, OffensiveContextData>();
    rows.forEach(r => m.set(r.team, r as OffensiveContextData));
    return m;
  } catch (error) {
    console.warn('team_offensive_context table not available');
    return new Map();
  }
}

async function getTeamDefensiveContext(season: number, week: number): Promise<Map<string, DefensiveContextData>> {
  try {
    const rows = await db
      .select({
        team: teamDefensiveContext.team,
        passEpaAllowed: teamDefensiveContext.passEpaAllowed,
        rushEpaAllowed: teamDefensiveContext.rushEpaAllowed,
        ybcPerAttAllowed: teamDefensiveContext.ybcPerAttAllowed,
        pressureRateGenerated: teamDefensiveContext.pressureRateGenerated
      })
      .from(teamDefensiveContext)
      .where(
        and(
          eq(teamDefensiveContext.season, season),
          eq(teamDefensiveContext.week, week)
        )
      );

    const m = new Map<string, DefensiveContextData>();
    rows.forEach(r => m.set(r.team, r as DefensiveContextData));
    return m;
  } catch (error) {
    console.warn('team_defensive_context table not available');
    return new Map();
  }
}

export async function computeWeeklySOSv2(
  position: Position,
  week: number,
  season = DEFAULT_SEASON,
  mode: Mode = 'fpa',
  weights: Weights = { w_fpa:0.55, w_epa:0.20, w_pace:0.15, w_rz:0.10 },
  debug = false,
  samples = 0
) {
  // For 2025 early season, use OASIS projections when historical data isn't available
  if (season === 2025 && week <= 3) {
    console.info(`[SOS] Using OASIS projections for ${season} Week ${week} (v2)`);
    return await oasisSosService.generateOasisWeeklySOS(position, week, season);
  }

  // Normalize weights to ensure they sum to 1.0
  weights = normalizeWeights(weights);
  const games = await getWeekGames(season, week);
  if (!games.length) return [];

  // v1 components
  const seasonAvg = await getSeasonAvg(season, position, week);
  const last4 = await getLast4(season, position, week);

  // Build defense set for the slate
  const defenses = new Set<string>(); 
  games.forEach(g=>{
    defenses.add(g.home); 
    defenses.add(g.away);
  });

  // FPA blended raw + pool for percentile
  const fpaRawMap = new Map<string, number>();
  const fpaVals:number[] = [];
  defenses.forEach(team=>{
    const s = seasonAvg.get(team);
    const l4 = last4.get(team);
    const blended = (l4 ?? 0)*RECENCY_WEIGHT + (s ?? 0)*SEASON_WEIGHT;
    if (Number.isFinite(blended) && blended > 0) {
      fpaRawMap.set(team, blended);
      fpaVals.push(blended);
    }
  });
  if (!fpaVals.length) return []; // nothing to score

  // Validate mode and fallback to FPA if invalid
  if (mode !== 'fpa' && mode !== 'ctx') mode = 'fpa';
  
  // Context fetch (optional)
  let ctxMap = new Map<string, CtxRow>();
  let epaVals:number[] = [], paceVals:number[] = [], rzVals:number[] = [];
  if (mode === 'ctx') {
    ctxMap = await getContext(season, week);
    ctxMap.forEach(v=>{
      if (v.epaPerPlayAllowed!=null) epaVals.push(Number(v.epaPerPlayAllowed));
      if (v.playsAllowedPerGame!=null) paceVals.push(Number(v.playsAllowedPerGame));
      if (v.rzTdRateAllowed!=null) rzVals.push(Number(v.rzTdRateAllowed));
    });
    // If context empty, silently fall back to FPA mode
    if (!epaVals.length && !paceVals.length && !rzVals.length) mode = 'fpa';
  }

  // Batch fetch samples data once if requested (avoids N+1)
  let playersByDef = new Map<string, PlayerSample[]>();
  let totalsByDef = new Map<string, number>();
  if (samples > 0) {
    const batchData = await getPlayerSamplesBatch(season, week, position, samples);
    playersByDef = batchData.playersByDef;
    totalsByDef = batchData.totalsByDef;
  }

  const out:any[] = [];
  for (const g of games) {
    const pairs = [
      { team: g.home, opp: g.away, venue: 'home' as const },
      { team: g.away, opp: g.home, venue: 'away' as const },
    ];
    for (const p of pairs) {
      const fpaRaw = fpaRawMap.get(p.opp);
      if (fpaRaw == null) continue;
      const fpaScore = percentileScale(fpaVals, fpaRaw);

      if (mode === 'fpa') {
        const score = fpaScore;
        const row: WeeklySOS = { 
          team: p.team, 
          opponent: p.opp, 
          position, 
          week, 
          sos_score: score, 
          tier: tier(score)
        };
        
        // Attach samples if available (opponent = defense)
        if (samples > 0) {
          const players = playersByDef.get(p.opp) ?? [];
          const total = totalsByDef.get(p.opp);
          if (players.length > 0 || total != null) {
            row.samples = {
              total: Number.isFinite(total as number) ? (total as number) : 0,
              players
            };
          }
        }
        
        out.push(row);
        continue;
      }

      // mode === 'ctx'
      const ctx = ctxMap.get(p.opp);
      const epaScore  = (ctx?.epaPerPlayAllowed!=null)   ? percentileScale(epaVals,  Number(ctx.epaPerPlayAllowed))   : 50;
      const paceScore = (ctx?.playsAllowedPerGame!=null) ? percentileScale(paceVals, Number(ctx.playsAllowedPerGame)) : 50;
      const rzScore   = (ctx?.rzTdRateAllowed!=null)     ? percentileScale(rzVals,   Number(ctx.rzTdRateAllowed))     : 50;

      let score = weights.w_fpa*fpaScore + weights.w_epa*epaScore + weights.w_pace*paceScore + weights.w_rz*rzScore;
      // Tiny venue nudge (scale small so it never dominates)
      const vAdj = p.venue === 'home' ? (ctx?.homeDefAdj ?? 0) : (ctx?.awayDefAdj ?? 0);
      if (Number.isFinite(Number(vAdj))) score += Number(vAdj) * 2;
      score = Math.round(Math.max(0, Math.min(100, score)));

      const row: WeeklySOS = { 
        team: p.team, 
        opponent: p.opp, 
        position, 
        week, 
        sos_score: score, 
        tier: tier(score) 
      };
      
      if (debug) {
        (row as any).components = {
          FPA: fpaScore,
          EPA: epaScore,
          Pace: paceScore,
          RZ: rzScore,
          Venue: Number(((Number(vAdj)||0) * 2).toFixed(2))
        };
      }
      
      // Attach samples if available (opponent = defense)
      if (samples > 0) {
        const players = playersByDef.get(p.opp) ?? [];
        const total = totalsByDef.get(p.opp);
        if (players.length > 0 || total != null) {
          row.samples = {
            total: Number.isFinite(total as number) ? (total as number) : 0,
            players
          };
        }
      }
      
      out.push(row);
    }
  }
  return out;
}

// ==== SOSv3: Team Analytics Enhanced ====

export interface TeamAnalyticsBreakdown {
  alignmentMatchups?: {
    outsideWr?: { score: number; fpgAllowed: number | null };
    slot?: { score: number; fpgAllowed: number | null };
    te?: { score: number; fpgAllowed: number | null };
  };
  coverageMatchups?: {
    vsZone?: { score: number; fpdbAllowed: number | null; defUsageRate: number | null };
    vsMan?: { score: number; fpdbAllowed: number | null; defUsageRate: number | null };
    vs2High?: { score: number; fpdbAllowed: number | null; defUsageRate: number | null };
    vs1High?: { score: number; fpdbAllowed: number | null; defUsageRate: number | null };
  };
  blockingContext?: {
    runBlocking?: { score: number; ybcPerAtt: number | null };
    passProtection?: { score: number; pressureRate: number | null };
  };
}

export interface WeeklySOSv3 extends WeeklySOS {
  analytics?: TeamAnalyticsBreakdown;
}

/**
 * Compute weekly SOS with enhanced team analytics breakdowns
 * Includes alignment matchups (WR/TE), coverage matchups (QB/WR/TE), and blocking context (RB/QB)
 */
export async function computeWeeklySOSv3(
  position: Position,
  week: number,
  season = DEFAULT_SEASON,
  mode: Mode = 'fpa',
  weights: Weights = { w_fpa:0.55, w_epa:0.20, w_pace:0.15, w_rz:0.10 },
  includeAnalytics = true
): Promise<WeeklySOSv3[]> {
  // Get base SOS scores from v2
  const baseSOS = await computeWeeklySOSv2(position, week, season, mode, weights, false, 0);
  
  if (!includeAnalytics) {
    return baseSOS as WeeklySOSv3[];
  }
  
  // Fetch team analytics data
  const [alignmentData, coverageData, offensiveContext, defensiveContext] = await Promise.all([
    getAlignmentMatchups(season, week),
    getCoverageMatchups(season, week),
    getTeamOffensiveContext(season, week),
    getTeamDefensiveContext(season, week)
  ]);
  
  // If no analytics data available, return base SOS
  if (alignmentData.size === 0 && coverageData.size === 0 && 
      offensiveContext.size === 0 && defensiveContext.size === 0) {
    return baseSOS as WeeklySOSv3[];
  }
  
  // Collect values for percentile scaling
  const alignmentVals = {
    outsideWr: [] as number[],
    slot: [] as number[],
    te: [] as number[]
  };
  const coverageVals = {
    zone: [] as number[],
    man: [] as number[],
    twoHigh: [] as number[],
    oneHigh: [] as number[]
  };
  const blockingVals = {
    ybc: [] as number[],
    pressure: [] as number[]
  };
  
  // Populate value pools for percentile scaling
  alignmentData.forEach(data => {
    if (data.defOutsideWrFpgAllowed != null) alignmentVals.outsideWr.push(data.defOutsideWrFpgAllowed);
    if (data.defSlotFpgAllowed != null) alignmentVals.slot.push(data.defSlotFpgAllowed);
    if (data.defTeFpgAllowed != null) alignmentVals.te.push(data.defTeFpgAllowed);
  });
  
  coverageData.forEach(data => {
    if (data.defZoneFpdbAllowed != null) coverageVals.zone.push(data.defZoneFpdbAllowed);
    if (data.defManFpdbAllowed != null) coverageVals.man.push(data.defManFpdbAllowed);
    if (data.defTwoHighFpdbAllowed != null) coverageVals.twoHigh.push(data.defTwoHighFpdbAllowed);
    if (data.defOneHighFpdbAllowed != null) coverageVals.oneHigh.push(data.defOneHighFpdbAllowed);
  });
  
  defensiveContext.forEach(data => {
    if (data.ybcPerAttAllowed != null) blockingVals.ybc.push(data.ybcPerAttAllowed);
    if (data.pressureRateGenerated != null) blockingVals.pressure.push(data.pressureRateGenerated);
  });
  
  // Enhance each SOS entry with analytics
  const enhanced = baseSOS.map(sos => {
    const enhanced: WeeklySOSv3 = { ...sos };
    const oppAlignment = alignmentData.get(sos.opponent);
    const oppCoverage = coverageData.get(sos.opponent);
    const oppDefense = defensiveContext.get(sos.opponent);
    
    const analytics: TeamAnalyticsBreakdown = {};
    
    // Add alignment matchups for WR/TE
    if ((position === 'WR' || position === 'TE') && oppAlignment) {
      analytics.alignmentMatchups = {};
      
      if (oppAlignment.defOutsideWrFpgAllowed != null && alignmentVals.outsideWr.length > 0) {
        analytics.alignmentMatchups.outsideWr = {
          score: percentileScale(alignmentVals.outsideWr, oppAlignment.defOutsideWrFpgAllowed),
          fpgAllowed: oppAlignment.defOutsideWrFpgAllowed
        };
      }
      
      if (oppAlignment.defSlotFpgAllowed != null && alignmentVals.slot.length > 0) {
        analytics.alignmentMatchups.slot = {
          score: percentileScale(alignmentVals.slot, oppAlignment.defSlotFpgAllowed),
          fpgAllowed: oppAlignment.defSlotFpgAllowed
        };
      }
      
      if (oppAlignment.defTeFpgAllowed != null && alignmentVals.te.length > 0) {
        analytics.alignmentMatchups.te = {
          score: percentileScale(alignmentVals.te, oppAlignment.defTeFpgAllowed),
          fpgAllowed: oppAlignment.defTeFpgAllowed
        };
      }
    }
    
    // Add coverage matchups for QB/WR/TE
    if ((position === 'QB' || position === 'WR' || position === 'TE') && oppCoverage) {
      analytics.coverageMatchups = {};
      
      if (oppCoverage.defZoneFpdbAllowed != null && coverageVals.zone.length > 0) {
        analytics.coverageMatchups.vsZone = {
          score: percentileScale(coverageVals.zone, oppCoverage.defZoneFpdbAllowed),
          fpdbAllowed: oppCoverage.defZoneFpdbAllowed,
          defUsageRate: oppCoverage.defZonePct
        };
      }
      
      if (oppCoverage.defManFpdbAllowed != null && coverageVals.man.length > 0) {
        analytics.coverageMatchups.vsMan = {
          score: percentileScale(coverageVals.man, oppCoverage.defManFpdbAllowed),
          fpdbAllowed: oppCoverage.defManFpdbAllowed,
          defUsageRate: oppCoverage.defManPct
        };
      }
      
      if (oppCoverage.defTwoHighFpdbAllowed != null && coverageVals.twoHigh.length > 0) {
        analytics.coverageMatchups.vs2High = {
          score: percentileScale(coverageVals.twoHigh, oppCoverage.defTwoHighFpdbAllowed),
          fpdbAllowed: oppCoverage.defTwoHighFpdbAllowed,
          defUsageRate: oppCoverage.defTwoHighPct
        };
      }
      
      if (oppCoverage.defOneHighFpdbAllowed != null && coverageVals.oneHigh.length > 0) {
        analytics.coverageMatchups.vs1High = {
          score: percentileScale(coverageVals.oneHigh, oppCoverage.defOneHighFpdbAllowed),
          fpdbAllowed: oppCoverage.defOneHighFpdbAllowed,
          defUsageRate: oppCoverage.defOneHighPct
        };
      }
    }
    
    // Add blocking context for RB/QB
    if ((position === 'RB' || position === 'QB') && oppDefense) {
      analytics.blockingContext = {};
      
      if (oppDefense.ybcPerAttAllowed != null && blockingVals.ybc.length > 0) {
        analytics.blockingContext.runBlocking = {
          score: percentileScale(blockingVals.ybc, oppDefense.ybcPerAttAllowed),
          ybcPerAtt: oppDefense.ybcPerAttAllowed
        };
      }
      
      if (oppDefense.pressureRateGenerated != null && blockingVals.pressure.length > 0) {
        // For pressure rate, LOWER is better, so invert the percentile
        const rawScore = percentileScale(blockingVals.pressure, oppDefense.pressureRateGenerated);
        analytics.blockingContext.passProtection = {
          score: 100 - rawScore, // Invert so lower pressure = higher score
          pressureRate: oppDefense.pressureRateGenerated
        };
      }
    }
    
    // Only add analytics if we have at least one category
    if (Object.keys(analytics).length > 0) {
      enhanced.analytics = analytics;
    }
    
    return enhanced;
  });
  
  return enhanced;
}