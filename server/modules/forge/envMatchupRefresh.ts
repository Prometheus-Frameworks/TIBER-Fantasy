/**
 * FORGE Environment + Matchup Refresh Service v0.1
 * 
 * Populates forge_team_environment and forge_team_matchup_context tables
 * by aggregating data from:
 * - team_offensive_context
 * - team_defensive_context
 * - bronze_nflfastr_plays
 * 
 * Run manually via /api/forge/admin/refresh or on a schedule.
 */

import { db } from '../../infra/db';
import { eq, and, sql } from 'drizzle-orm';
import { 
  forgeTeamEnvironment, 
  forgeTeamMatchupContext,
  teamOffensiveContext,
  teamDefensiveContext,
} from '@shared/schema';
import type { PlayerPosition } from './types';

const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
];

const POSITIONS: PlayerPosition[] = ['WR', 'RB', 'TE'];

interface LeagueStats {
  minCpoe: number; maxCpoe: number;
  minEpa: number; maxEpa: number;
  minPressure: number; maxPressure: number;
  minPassRate: number; maxPassRate: number;
}

/**
 * Refresh all environment scores for a given week
 */
export async function refreshTeamEnvironments(season: number, week: number): Promise<number> {
  console.log(`[FORGE/Refresh] Refreshing team environments for ${season} week ${week}`);
  
  try {
    // Get all offensive context data for this week
    const offCtxRows = await db
      .select()
      .from(teamOffensiveContext)
      .where(
        and(
          eq(teamOffensiveContext.season, season),
          eq(teamOffensiveContext.week, week)
        )
      );

    if (offCtxRows.length === 0) {
      console.log(`[FORGE/Refresh] No offensive context data for ${season} week ${week}`);
      return 0;
    }

    // Calculate league min/max for normalization
    const stats = calculateLeagueStats(offCtxRows);
    
    let inserted = 0;
    for (const ctx of offCtxRows) {
      const envScore = computeEnvironmentScore(ctx, stats);
      
      await db
        .insert(forgeTeamEnvironment)
        .values({
          season,
          week,
          team: ctx.team,
          qbCpoe: ctx.cpoe,
          qbEpaPerDropback: ctx.passEpa,
          pressureRateAllowed: ctx.pressureRateAllowed,
          envScoreRaw: envScore / 100,
          envScore100: Math.round(envScore),
        })
        .onConflictDoUpdate({
          target: [forgeTeamEnvironment.season, forgeTeamEnvironment.week, forgeTeamEnvironment.team],
          set: {
            qbCpoe: ctx.cpoe,
            qbEpaPerDropback: ctx.passEpa,
            pressureRateAllowed: ctx.pressureRateAllowed,
            envScoreRaw: envScore / 100,
            envScore100: Math.round(envScore),
            lastUpdated: new Date(),
          },
        });
      
      inserted++;
    }
    
    console.log(`[FORGE/Refresh] Inserted/updated ${inserted} team environments`);
    return inserted;
  } catch (err) {
    console.error('[FORGE/Refresh] Error refreshing team environments:', err);
    throw err;
  }
}

/**
 * Refresh all matchup context scores for a given week
 */
export async function refreshMatchupContexts(season: number, week: number): Promise<number> {
  console.log(`[FORGE/Refresh] Refreshing matchup contexts for ${season} week ${week}`);
  
  try {
    // Get all defensive context data for this week
    const defCtxRows = await db
      .select()
      .from(teamDefensiveContext)
      .where(
        and(
          eq(teamDefensiveContext.season, season),
          eq(teamDefensiveContext.week, week)
        )
      );

    if (defCtxRows.length === 0) {
      console.log(`[FORGE/Refresh] No defensive context data for ${season} week ${week}`);
      return 0;
    }

    // Calculate league defensive stats for normalization
    const defStats = calculateDefensiveLeagueStats(defCtxRows);
    
    let inserted = 0;
    for (const ctx of defCtxRows) {
      for (const position of POSITIONS) {
        const matchupScore = computeMatchupScore(ctx, position, defStats);
        
        await db
          .insert(forgeTeamMatchupContext)
          .values({
            season,
            week,
            defenseTeam: ctx.team,
            position,
            defPassEpaPerAttempt: ctx.passEpaAllowed,
            defRushEpaPerRush: ctx.rushEpaAllowed,
            defPressureRate: ctx.pressureRateGenerated,
            defExplosivePassRateAllowed: ctx.explosive20PlusAllowed,
            matchupScoreRaw: matchupScore / 100,
            matchupScore100: Math.round(matchupScore),
            sampleSize: week,
          })
          .onConflictDoUpdate({
            target: [forgeTeamMatchupContext.season, forgeTeamMatchupContext.week, forgeTeamMatchupContext.defenseTeam, forgeTeamMatchupContext.position],
            set: {
              defPassEpaPerAttempt: ctx.passEpaAllowed,
              defRushEpaPerRush: ctx.rushEpaAllowed,
              defPressureRate: ctx.pressureRateGenerated,
              defExplosivePassRateAllowed: ctx.explosive20PlusAllowed,
              matchupScoreRaw: matchupScore / 100,
              matchupScore100: Math.round(matchupScore),
              sampleSize: week,
              lastUpdated: new Date(),
            },
          });
        
        inserted++;
      }
    }
    
    console.log(`[FORGE/Refresh] Inserted/updated ${inserted} matchup contexts`);
    return inserted;
  } catch (err) {
    console.error('[FORGE/Refresh] Error refreshing matchup contexts:', err);
    throw err;
  }
}

/**
 * Refresh both environment and matchup data for a week
 */
export async function refreshForgeContext(season: number, week: number): Promise<{
  environments: number;
  matchups: number;
}> {
  const environments = await refreshTeamEnvironments(season, week);
  const matchups = await refreshMatchupContexts(season, week);
  return { environments, matchups };
}

/**
 * Calculate league-wide stats for normalization
 */
function calculateLeagueStats(rows: any[]): LeagueStats {
  const cpoes = rows.map(r => r.cpoe).filter((v): v is number => v !== null);
  const epas = rows.map(r => r.passEpa).filter((v): v is number => v !== null);
  const pressures = rows.map(r => r.pressureRateAllowed).filter((v): v is number => v !== null);
  
  return {
    minCpoe: Math.min(...cpoes, -5),
    maxCpoe: Math.max(...cpoes, 5),
    minEpa: Math.min(...epas, -0.2),
    maxEpa: Math.max(...epas, 0.3),
    minPressure: Math.min(...pressures, 0.15),
    maxPressure: Math.max(...pressures, 0.45),
    minPassRate: 0.40,
    maxPassRate: 0.65,
  };
}

/**
 * Calculate defensive league-wide stats
 */
function calculateDefensiveLeagueStats(rows: any[]): {
  minPassEpa: number; maxPassEpa: number;
  minRushEpa: number; maxRushEpa: number;
  minPressure: number; maxPressure: number;
} {
  const passEpas = rows.map(r => r.passEpaAllowed).filter((v): v is number => v !== null);
  const rushEpas = rows.map(r => r.rushEpaAllowed).filter((v): v is number => v !== null);
  const pressures = rows.map(r => r.pressureRateGenerated).filter((v): v is number => v !== null);
  
  return {
    minPassEpa: Math.min(...passEpas, -0.2),
    maxPassEpa: Math.max(...passEpas, 0.2),
    minRushEpa: Math.min(...rushEpas, -0.15),
    maxRushEpa: Math.max(...rushEpas, 0.1),
    minPressure: Math.min(...pressures, 0.15),
    maxPressure: Math.max(...pressures, 0.45),
  };
}

/**
 * Compute environment score (0-100)
 * Higher = better offensive environment for fantasy
 */
function computeEnvironmentScore(ctx: any, stats: LeagueStats): number {
  let score = 50; // Start at league average
  
  // CPOE contribution (25%)
  if (ctx.cpoe !== null) {
    const cpoeNorm = normalize(ctx.cpoe, stats.minCpoe, stats.maxCpoe);
    score += (cpoeNorm - 0.5) * 25;
  }
  
  // EPA per dropback (25%)
  if (ctx.passEpa !== null) {
    const epaNorm = normalize(ctx.passEpa, stats.minEpa, stats.maxEpa);
    score += (epaNorm - 0.5) * 25;
  }
  
  // Pressure rate (20%) - lower is better
  if (ctx.pressureRateAllowed !== null) {
    const pressNorm = 1 - normalize(ctx.pressureRateAllowed, stats.minPressure, stats.maxPressure);
    score += (pressNorm - 0.5) * 20;
  }
  
  // Clamp to valid range
  return Math.max(0, Math.min(100, score));
}

/**
 * Compute matchup score by position (0-100)
 * Higher = easier matchup for that position
 */
function computeMatchupScore(ctx: any, position: PlayerPosition, stats: any): number {
  let score = 50;
  
  switch (position) {
    case 'WR':
      // Pass EPA allowed (30%) - higher means worse defense, better matchup
      if (ctx.passEpaAllowed !== null) {
        const epaNorm = normalize(ctx.passEpaAllowed, stats.minPassEpa, stats.maxPassEpa);
        score += (epaNorm - 0.5) * 30;
      }
      // Pressure rate (15%) - lower pressure = better for WRs (less rushed throws)
      if (ctx.pressureRateGenerated !== null) {
        const pressNorm = 1 - normalize(ctx.pressureRateGenerated, stats.minPressure, stats.maxPressure);
        score += (pressNorm - 0.5) * 15;
      }
      break;
      
    case 'RB':
      // Rush EPA allowed (40%) - higher means worse run defense
      if (ctx.rushEpaAllowed !== null) {
        const epaNorm = normalize(ctx.rushEpaAllowed, stats.minRushEpa, stats.maxRushEpa);
        score += (epaNorm - 0.5) * 40;
      }
      // Pressure rate (20%) - proxy for front 7 strength
      if (ctx.pressureRateGenerated !== null) {
        const pressNorm = 1 - normalize(ctx.pressureRateGenerated, stats.minPressure, stats.maxPressure);
        score += (pressNorm - 0.5) * 20;
      }
      break;
      
    case 'TE':
      // Pass EPA allowed (35%)
      if (ctx.passEpaAllowed !== null) {
        const epaNorm = normalize(ctx.passEpaAllowed, stats.minPassEpa, stats.maxPassEpa);
        score += (epaNorm - 0.5) * 35;
      }
      // Pressure rate (15%)
      if (ctx.pressureRateGenerated !== null) {
        const pressNorm = 1 - normalize(ctx.pressureRateGenerated, stats.minPressure, stats.maxPressure);
        score += (pressNorm - 0.5) * 15;
      }
      break;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Min-max normalization
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export default {
  refreshTeamEnvironments,
  refreshMatchupContexts,
  refreshForgeContext,
};
