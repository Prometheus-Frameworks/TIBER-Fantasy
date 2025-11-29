/**
 * FORGE Environment + Matchup Refresh Service v0.2
 * 
 * v0.2 Upgrades:
 * - Robust scaling + sigmoid normalization (replaces min-max)
 * - Process-based envScore formula (5 pillars)
 * - Improved WR matchupScore with pressure_rate_delta
 * - Component-level debug data
 * 
 * Populates forge_team_environment and forge_team_matchup_context tables
 * by aggregating data from team_offensive_context and team_defensive_context.
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
import { 
  calculateRobustStats, 
  robustNormalize, 
  RobustStats,
  TYPICAL_NFL_STATS 
} from './robustNormalize';

const POSITIONS: PlayerPosition[] = ['WR', 'RB', 'TE'];

/**
 * Environment component scores for debug endpoint
 */
export interface EnvComponentDebug {
  qb_epa_raw: number | null;
  qb_epa_score: number;
  ol_pass_block_raw: number | null;
  ol_pass_block_score: number;
  tempo_raw: number | null;
  tempo_score: number;
  rz_eff_raw: number | null;
  rz_eff_score: number;
  proe_raw: number | null;
  proe_score: number;
  run_eff_raw: number | null;
  run_eff_score: number;
}

/**
 * Matchup component scores for debug endpoint (WR position)
 */
export interface MatchupComponentDebug {
  pass_epa_allowed_raw: number | null;
  pass_epa_allowed_score: number;
  explosive_pass_raw: number | null;
  explosive_pass_score: number;
  coverage_softness_raw: number | null;
  coverage_softness_score: number;
  pressure_delta_raw: number | null;
  pressure_delta_score: number;
}

/**
 * v0.2 League Stats with robust scaling
 */
interface LeagueRobustStats {
  passEpa: RobustStats;
  cpoe: RobustStats;
  pressureRateAllowed: RobustStats;
  runSuccessRate: RobustStats;
  rushEpa: RobustStats;
}

interface DefenseRobustStats {
  passEpaAllowed: RobustStats;
  rushEpaAllowed: RobustStats;
  pressureRateGenerated: RobustStats;
  explosiveAllowed: RobustStats;
  ypaAllowed: RobustStats;
}

/**
 * Refresh all environment scores for a given week using v0.2 formula
 */
export async function refreshTeamEnvironments(season: number, week: number): Promise<number> {
  console.log(`[FORGE/Refresh v0.2] Refreshing team environments for ${season} week ${week}`);
  
  try {
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

    // Calculate robust stats for all metrics
    const leagueStats = calculateLeagueRobustStats(offCtxRows);
    
    let inserted = 0;
    for (const ctx of offCtxRows) {
      const { envScore, components } = computeEnvironmentScoreV2(ctx, leagueStats);
      
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
    
    console.log(`[FORGE/Refresh v0.2] Inserted/updated ${inserted} team environments`);
    return inserted;
  } catch (err) {
    console.error('[FORGE/Refresh] Error refreshing team environments:', err);
    throw err;
  }
}

/**
 * Refresh all matchup context scores for a given week using v0.2 formula
 */
export async function refreshMatchupContexts(season: number, week: number): Promise<number> {
  console.log(`[FORGE/Refresh v0.2] Refreshing matchup contexts for ${season} week ${week}`);
  
  try {
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

    // Calculate robust stats for defensive metrics
    const defStats = calculateDefenseRobustStats(defCtxRows);
    
    let inserted = 0;
    for (const ctx of defCtxRows) {
      for (const position of POSITIONS) {
        const matchupScore = computeMatchupScoreV2(ctx, position, defStats);
        
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
    
    console.log(`[FORGE/Refresh v0.2] Inserted/updated ${inserted} matchup contexts`);
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
 * Calculate robust stats for all offensive metrics
 */
function calculateLeagueRobustStats(rows: any[]): LeagueRobustStats {
  const passEpas = rows.map(r => r.passEpa).filter((v): v is number => v !== null);
  const cpoes = rows.map(r => r.cpoe).filter((v): v is number => v !== null);
  const pressures = rows.map(r => r.pressureRateAllowed).filter((v): v is number => v !== null);
  const runSuccess = rows.map(r => r.runSuccessRate).filter((v): v is number => v !== null);
  const rushEpas = rows.map(r => r.rushEpa).filter((v): v is number => v !== null);

  return {
    passEpa: passEpas.length >= 3 ? calculateRobustStats(passEpas) : TYPICAL_NFL_STATS.pass_epa,
    cpoe: cpoes.length >= 3 ? calculateRobustStats(cpoes) : TYPICAL_NFL_STATS.cpoe,
    pressureRateAllowed: pressures.length >= 3 ? calculateRobustStats(pressures) : TYPICAL_NFL_STATS.pressure_rate_allowed,
    runSuccessRate: runSuccess.length >= 3 ? calculateRobustStats(runSuccess) : TYPICAL_NFL_STATS.run_success_rate,
    rushEpa: rushEpas.length >= 3 ? calculateRobustStats(rushEpas) : { median: 0, p25: -0.1, p75: 0.1, iqr: 0.2 },
  };
}

/**
 * Calculate robust stats for all defensive metrics
 */
function calculateDefenseRobustStats(rows: any[]): DefenseRobustStats {
  const passEpas = rows.map(r => r.passEpaAllowed).filter((v): v is number => v !== null);
  const rushEpas = rows.map(r => r.rushEpaAllowed).filter((v): v is number => v !== null);
  const pressures = rows.map(r => r.pressureRateGenerated).filter((v): v is number => v !== null);
  const explosives = rows.map(r => r.explosive20PlusAllowed).filter((v): v is number => v !== null);
  const ypas = rows.map(r => r.ypaAllowed).filter((v): v is number => v !== null);

  return {
    passEpaAllowed: passEpas.length >= 3 ? calculateRobustStats(passEpas) : TYPICAL_NFL_STATS.pass_epa_allowed,
    rushEpaAllowed: rushEpas.length >= 3 ? calculateRobustStats(rushEpas) : TYPICAL_NFL_STATS.rush_epa_allowed,
    pressureRateGenerated: pressures.length >= 3 ? calculateRobustStats(pressures) : TYPICAL_NFL_STATS.pressure_rate_generated,
    explosiveAllowed: explosives.length >= 3 ? calculateRobustStats(explosives) : TYPICAL_NFL_STATS.explosive_rate,
    ypaAllowed: ypas.length >= 3 ? calculateRobustStats(ypas) : TYPICAL_NFL_STATS.ypa_allowed,
  };
}

/**
 * v0.2 Environment Score Formula (process-based)
 * 
 * 5 Pillars (with fallbacks for missing data):
 * - QB efficiency (EPA/play): 25%
 * - OL pass protection (1 - pressure_rate): 25%
 * - Tempo: Not available - skip
 * - RZ efficiency: Not available - skip
 * - PROE: Not available - skip
 * 
 * With available data, we redistribute weights:
 * - QB EPA: 35%
 * - OL Pass Block: 35%
 * - Run Success Rate: 30% (proxy for overall efficiency)
 */
function computeEnvironmentScoreV2(
  ctx: any, 
  stats: LeagueRobustStats
): { envScore: number; components: EnvComponentDebug } {
  // QB EPA component (35%)
  const qbEpaScore = robustNormalize(ctx.passEpa, stats.passEpa, 0.8);
  
  // OL Pass Block component (35%) - invert pressure rate (lower = better)
  const olBlockScore = robustNormalize(ctx.pressureRateAllowed, stats.pressureRateAllowed, 0.8, true);
  
  // Run efficiency component (30%)
  const runEffScore = robustNormalize(ctx.runSuccessRate, stats.runSuccessRate, 0.8);
  
  // Placeholder scores for missing metrics
  const tempoScore = 50; // League avg placeholder
  const rzEffScore = 50; // League avg placeholder
  const proeScore = 50;  // League avg placeholder

  // Weighted combination with available metrics
  const envScore = 
      0.35 * qbEpaScore
    + 0.35 * olBlockScore
    + 0.30 * runEffScore;

  const components: EnvComponentDebug = {
    qb_epa_raw: ctx.passEpa,
    qb_epa_score: qbEpaScore,
    ol_pass_block_raw: ctx.pressureRateAllowed,
    ol_pass_block_score: olBlockScore,
    tempo_raw: null,
    tempo_score: tempoScore,
    rz_eff_raw: null,
    rz_eff_score: rzEffScore,
    proe_raw: null,
    proe_score: proeScore,
    run_eff_raw: ctx.runSuccessRate,
    run_eff_score: runEffScore,
  };

  return { envScore, components };
}

/**
 * v0.2 Matchup Score by Position
 * 
 * WR Formula (per spec):
 * - 30% pass_epa_allowed (higher = worse defense = better matchup)
 * - 25% explosive_pass (higher = more big plays allowed = better)
 * - 25% coverage_softness (using YPA allowed as proxy)
 * - 20% pressure_delta (more pressure = worse for WR)
 * 
 * RB/TE keep v0.1 formulas with robust normalization
 */
function computeMatchupScoreV2(ctx: any, position: PlayerPosition, stats: DefenseRobustStats): number {
  switch (position) {
    case 'WR':
      return computeWRMatchupV2(ctx, stats);
    case 'RB':
      return computeRBMatchupV2(ctx, stats);
    case 'TE':
      return computeTEMatchupV2(ctx, stats);
    default:
      return 50;
  }
}

/**
 * WR Matchup v0.2 with process metrics
 */
function computeWRMatchupV2(ctx: any, stats: DefenseRobustStats): number {
  // Pass EPA allowed - higher = worse defense = better matchup
  const passEpaScore = robustNormalize(ctx.passEpaAllowed, stats.passEpaAllowed, 0.8);
  
  // Explosive pass rate - higher = more big plays allowed
  const explosiveScore = robustNormalize(ctx.explosive20PlusAllowed, stats.explosiveAllowed, 0.8);
  
  // Coverage softness proxy (YPA allowed) - higher = softer coverage
  const coverageScore = robustNormalize(ctx.ypaAllowed, stats.ypaAllowed, 0.8);
  
  // Pressure delta - invert: more pressure = worse matchup for WR
  // Note: In v0.2, this is just def pressure. Future: def_pressure - off_ol_block
  const pressureDeltaScore = robustNormalize(ctx.pressureRateGenerated, stats.pressureRateGenerated, 0.8, true);

  // Weighted combination per spec
  const matchupScore = 
      0.30 * passEpaScore
    + 0.25 * explosiveScore
    + 0.25 * coverageScore
    + 0.20 * pressureDeltaScore;

  return Math.max(0, Math.min(100, matchupScore));
}

/**
 * RB Matchup v0.2 with robust normalization
 */
function computeRBMatchupV2(ctx: any, stats: DefenseRobustStats): number {
  // Rush EPA allowed - higher = worse run defense
  const rushEpaScore = robustNormalize(ctx.rushEpaAllowed, stats.rushEpaAllowed, 0.8);
  
  // Pressure rate - proxy for front 7 strength (invert)
  const pressureScore = robustNormalize(ctx.pressureRateGenerated, stats.pressureRateGenerated, 0.8, true);

  // 60% rush EPA, 40% pressure
  return 0.60 * rushEpaScore + 0.40 * pressureScore;
}

/**
 * TE Matchup v0.2 with robust normalization
 */
function computeTEMatchupV2(ctx: any, stats: DefenseRobustStats): number {
  // Pass EPA allowed
  const passEpaScore = robustNormalize(ctx.passEpaAllowed, stats.passEpaAllowed, 0.8);
  
  // Pressure rate
  const pressureScore = robustNormalize(ctx.pressureRateGenerated, stats.pressureRateGenerated, 0.8, true);
  
  // YPA allowed for coverage
  const coverageScore = robustNormalize(ctx.ypaAllowed, stats.ypaAllowed, 0.8);

  // 45% pass EPA, 30% coverage, 25% pressure
  return 0.45 * passEpaScore + 0.30 * coverageScore + 0.25 * pressureScore;
}

/**
 * Debug helper: Get environment component breakdown for a team
 */
export async function getEnvDebug(
  season: number, 
  week: number, 
  team: string
): Promise<{ components: EnvComponentDebug; env_score_100: number } | null> {
  try {
    const offCtxRows = await db
      .select()
      .from(teamOffensiveContext)
      .where(
        and(
          eq(teamOffensiveContext.season, season),
          eq(teamOffensiveContext.week, week)
        )
      );

    const ctx = offCtxRows.find(r => r.team === team);
    if (!ctx) return null;

    const stats = calculateLeagueRobustStats(offCtxRows);
    const { envScore, components } = computeEnvironmentScoreV2(ctx, stats);

    return {
      components,
      env_score_100: Math.round(envScore),
    };
  } catch (err) {
    console.error('[FORGE/EnvDebug] Error:', err);
    return null;
  }
}

/**
 * Debug helper: Get matchup component breakdown for a defense + position
 */
export async function getMatchupDebug(
  season: number,
  week: number,
  defense: string,
  position: PlayerPosition
): Promise<{ components: MatchupComponentDebug; matchup_score_100: number } | null> {
  if (position !== 'WR') {
    // Only WR has v0.2 debug components for now
    return null;
  }

  try {
    const defCtxRows = await db
      .select()
      .from(teamDefensiveContext)
      .where(
        and(
          eq(teamDefensiveContext.season, season),
          eq(teamDefensiveContext.week, week)
        )
      );

    const ctx = defCtxRows.find(r => r.team === defense);
    if (!ctx) return null;

    const stats = calculateDefenseRobustStats(defCtxRows);
    
    // Compute component scores
    const passEpaScore = robustNormalize(ctx.passEpaAllowed, stats.passEpaAllowed, 0.8);
    const explosiveScore = robustNormalize(ctx.explosive20PlusAllowed, stats.explosiveAllowed, 0.8);
    const coverageScore = robustNormalize(ctx.ypaAllowed, stats.ypaAllowed, 0.8);
    const pressureDeltaScore = robustNormalize(ctx.pressureRateGenerated, stats.pressureRateGenerated, 0.8, true);

    const matchupScore = 
        0.30 * passEpaScore
      + 0.25 * explosiveScore
      + 0.25 * coverageScore
      + 0.20 * pressureDeltaScore;

    const components: MatchupComponentDebug = {
      pass_epa_allowed_raw: ctx.passEpaAllowed,
      pass_epa_allowed_score: passEpaScore,
      explosive_pass_raw: ctx.explosive20PlusAllowed,
      explosive_pass_score: explosiveScore,
      coverage_softness_raw: ctx.ypaAllowed,
      coverage_softness_score: coverageScore,
      pressure_delta_raw: ctx.pressureRateGenerated,
      pressure_delta_score: pressureDeltaScore,
    };

    return {
      components,
      matchup_score_100: Math.round(matchupScore),
    };
  } catch (err) {
    console.error('[FORGE/MatchupDebug] Error:', err);
    return null;
  }
}

export default {
  refreshTeamEnvironments,
  refreshMatchupContexts,
  refreshForgeContext,
  getEnvDebug,
  getMatchupDebug,
};
