/**
 * FORGE Rebuild Service
 * 
 * Orchestrates the full FORGE data pipeline:
 * 1. Aggregates PBP data → team_offensive_context / team_defensive_context
 * 2. Refreshes forge_team_environment and forge_team_matchup_context
 * 
 * Can be triggered via admin API or scheduled job (Tuesday morning).
 */

import { db } from '../infra/db';
import { sql } from 'drizzle-orm';
import { getForgeSeason } from '../config/forgeSeason';
import { refreshForgeContext } from '../modules/forge/envMatchupRefresh';

export interface ForgeRebuildOptions {
  season?: number;
  week?: number;
}

export interface ForgeRebuildResult {
  season: number;
  week: number;
  offensiveTeams: number;
  defensiveTeams: number;
  environments: number;
  matchups: number;
  durationMs: number;
}

/**
 * Aggregate PBP data into team_offensive_context table
 */
async function aggregateOffensiveContext(season: number, week: number): Promise<number> {
  console.log(`[FORGE Rebuild] Aggregating offensive context for ${season} week ${week}...`);

  await db.execute(sql`
    DELETE FROM team_offensive_context WHERE season = ${season} AND week = ${week}
  `);

  const result = await db.execute(sql`
    WITH base_plays AS (
      SELECT * FROM bronze_nflfastr_plays
      WHERE season = ${season} AND week <= ${week}
    ),
    pass_plays AS (
      SELECT 
        posteam as team,
        COUNT(*) as pass_attempts,
        AVG(epa) as pass_epa,
        SUM(CASE WHEN yards_gained >= 20 THEN 1 ELSE 0 END) as explosive_pass,
        AVG(air_yards) as avg_air_yards,
        AVG(yards_gained) as avg_yards_gained,
        SUM(CASE WHEN complete_pass THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) as completion_rate,
        SUM(CASE WHEN complete_pass THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) - 0.63 as cpoe_estimate
      FROM base_plays
      WHERE play_type = 'pass'
        AND posteam IS NOT NULL
        AND epa IS NOT NULL
      GROUP BY posteam
    ),
    rush_plays AS (
      SELECT 
        posteam as team,
        COUNT(*) as rush_attempts,
        AVG(epa) as rush_epa,
        SUM(CASE WHEN yards_gained >= 20 THEN 1 ELSE 0 END) as explosive_rush,
        SUM(CASE WHEN yards_gained >= 4 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) as run_success_rate
      FROM base_plays
      WHERE play_type = 'run'
        AND posteam IS NOT NULL
        AND epa IS NOT NULL
      GROUP BY posteam
    ),
    sacks AS (
      SELECT 
        posteam as team,
        SUM(CASE WHEN (raw_data->>'sack')::text = '1' OR (raw_data->>'sack')::text = 'true' THEN 1 ELSE 0 END) as sacks_taken,
        COUNT(*) as dropbacks
      FROM base_plays
      WHERE play_type = 'pass'
        AND posteam IS NOT NULL
      GROUP BY posteam
    )
    INSERT INTO team_offensive_context 
      (season, week, team, pass_epa, rush_epa, explosive_20_plus, ypa, cpoe, run_success_rate, pressure_rate_allowed)
    SELECT 
      ${season},
      ${week},
      p.team,
      p.pass_epa,
      r.rush_epa,
      COALESCE(p.explosive_pass, 0) + COALESCE(r.explosive_rush, 0),
      p.avg_yards_gained,
      p.cpoe_estimate,
      r.run_success_rate,
      s.sacks_taken::float / NULLIF(s.dropbacks, 0)
    FROM pass_plays p
    LEFT JOIN rush_plays r ON p.team = r.team
    LEFT JOIN sacks s ON p.team = s.team
    WHERE p.team IS NOT NULL
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM team_offensive_context 
    WHERE season = ${season} AND week = ${week}
  `);
  const count = Number((countResult.rows[0] as any)?.count || 0);

  console.log(`[FORGE Rebuild] Inserted ${count} offensive context records`);
  return count;
}

/**
 * Aggregate PBP data into team_defensive_context table
 */
async function aggregateDefensiveContext(season: number, week: number): Promise<number> {
  console.log(`[FORGE Rebuild] Aggregating defensive context for ${season} week ${week}...`);

  await db.execute(sql`
    DELETE FROM team_defensive_context WHERE season = ${season} AND week = ${week}
  `);

  const result = await db.execute(sql`
    WITH base_plays AS (
      SELECT * FROM bronze_nflfastr_plays
      WHERE season = ${season} AND week <= ${week}
    ),
    pass_plays AS (
      SELECT 
        defteam as team,
        COUNT(*) as pass_attempts,
        AVG(epa) as pass_epa_allowed,
        SUM(CASE WHEN yards_gained >= 20 THEN 1 ELSE 0 END) as explosive_pass_allowed,
        AVG(yards_gained) as ypa_allowed,
        SUM(CASE WHEN complete_pass THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) - 0.63 as cpoe_allowed
      FROM base_plays
      WHERE play_type = 'pass'
        AND defteam IS NOT NULL
        AND epa IS NOT NULL
      GROUP BY defteam
    ),
    rush_plays AS (
      SELECT 
        defteam as team,
        COUNT(*) as rush_attempts,
        AVG(epa) as rush_epa_allowed,
        SUM(CASE WHEN yards_gained >= 20 THEN 1 ELSE 0 END) as explosive_rush_allowed,
        SUM(CASE WHEN yards_gained >= 4 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) as run_success_allowed
      FROM base_plays
      WHERE play_type = 'run'
        AND defteam IS NOT NULL
        AND epa IS NOT NULL
      GROUP BY defteam
    ),
    sacks AS (
      SELECT 
        defteam as team,
        SUM(CASE WHEN (raw_data->>'sack')::text = '1' OR (raw_data->>'sack')::text = 'true' THEN 1 ELSE 0 END) as sacks_generated,
        COUNT(*) as dropbacks_faced
      FROM base_plays
      WHERE play_type = 'pass'
        AND defteam IS NOT NULL
      GROUP BY defteam
    )
    INSERT INTO team_defensive_context 
      (season, week, team, pass_epa_allowed, rush_epa_allowed, explosive_20_plus_allowed, ypa_allowed, cpoe_allowed, gap_run_success_rate, zone_run_success_rate, pressure_rate_generated)
    SELECT 
      ${season},
      ${week},
      p.team,
      p.pass_epa_allowed,
      r.rush_epa_allowed,
      COALESCE(p.explosive_pass_allowed, 0) + COALESCE(r.explosive_rush_allowed, 0),
      p.ypa_allowed,
      p.cpoe_allowed,
      r.run_success_allowed,
      r.run_success_allowed,
      s.sacks_generated::float / NULLIF(s.dropbacks_faced, 0)
    FROM pass_plays p
    LEFT JOIN rush_plays r ON p.team = r.team
    LEFT JOIN sacks s ON p.team = s.team
    WHERE p.team IS NOT NULL
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM team_defensive_context 
    WHERE season = ${season} AND week = ${week}
  `);
  const count = Number((countResult.rows[0] as any)?.count || 0);

  console.log(`[FORGE Rebuild] Inserted ${count} defensive context records`);
  return count;
}

/**
 * Full FORGE rebuild pipeline
 * 
 * 1. Aggregates PBP → offensive/defensive context
 * 2. Refreshes environment and matchup scores
 */
export async function rebuildForgeContext(opts: ForgeRebuildOptions = {}): Promise<ForgeRebuildResult> {
  const startTime = Date.now();
  const season = opts.season ?? getForgeSeason(true);
  const week = opts.week ?? await getLatestPBPWeek(season);

  console.log(`[FORGE Rebuild] Starting full rebuild for ${season} week ${week}...`);

  const offensiveTeams = await aggregateOffensiveContext(season, week);
  const defensiveTeams = await aggregateDefensiveContext(season, week);
  const { environments, matchups } = await refreshForgeContext(season, week);

  const durationMs = Date.now() - startTime;

  console.log(`[FORGE Rebuild] Completed in ${durationMs}ms`);
  console.log(`  - Offensive context: ${offensiveTeams} teams`);
  console.log(`  - Defensive context: ${defensiveTeams} teams`);
  console.log(`  - Environments: ${environments}`);
  console.log(`  - Matchups: ${matchups}`);

  return {
    season,
    week,
    offensiveTeams,
    defensiveTeams,
    environments,
    matchups,
    durationMs,
  };
}

/**
 * Get the latest week with PBP data for a season
 */
async function getLatestPBPWeek(season: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT MAX(week) as max_week 
    FROM bronze_nflfastr_plays 
    WHERE season = ${season}
  `);
  return Number((result.rows[0] as any)?.max_week || 12);
}

export default {
  rebuildForgeContext,
};
