/**
 * Gold Layer ETL: silver_player_weekly_stats → datadive_snapshot_player_week
 *
 * Transforms Silver layer weekly stats into analytics-ready Gold layer snapshots
 * for consumption by FORGE engine and UI components.
 *
 * Metrics computed:
 * - Efficiency: ADOT, TPRR, YPRR, EPA per play/target, success rate
 * - Volume: snap share, target share, route rate
 * - Fantasy: PPR, Half-PPR, Standard scoring
 * - RB Rushing: stuff rate, first down rate, red zone attempts
 * - RB Receiving: YAC/rec, first downs/route, FP/route
 *
 * Usage:
 *   npx tsx server/etl/goldDatadiveETL.ts [season] [startWeek] [endWeek]
 *   npx tsx server/etl/goldDatadiveETL.ts 2025           # All available weeks
 *   npx tsx server/etl/goldDatadiveETL.ts 2025 14 17     # Weeks 14-17 only
 */

import { db } from '../infra/db';
import { sql } from 'drizzle-orm';

interface GoldPlayerWeek {
  season: number;
  week: number;
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string | null;

  // Snap/Route data (from bronze_nflfastr_snap_counts if available)
  snaps: number | null;
  snapShare: number | null;
  routes: number | null;
  routeRate: number | null;

  // Receiving
  targets: number;
  targetShare: number | null;
  receptions: number;
  recYards: number;
  recTds: number;
  adot: number | null;
  airYards: number;
  yac: number;
  tprr: number | null;  // Targets per route run
  yprr: number | null;  // Yards per route run
  epaPerTarget: number | null;

  // Rushing
  rushAttempts: number;
  rushYards: number;
  rushTds: number;
  yardsPerCarry: number | null;
  rushEpaPerPlay: number | null;

  // RB Rushing efficiency (from play-by-play)
  stuffed: number;
  stuffRate: number | null;
  rushFirstDowns: number;
  rushFirstDownRate: number | null;
  rzRushAttempts: number;

  // RB Run Gap Distribution
  insideRunRate: number | null;         // % runs through guard/tackle (not end)
  outsideRunRate: number | null;        // % runs to the end/outside
  insideSuccessRate: number | null;     // Success rate on inside runs
  outsideSuccessRate: number | null;    // Success rate on outside runs

  // RB Run Location Distribution
  leftRunRate: number | null;           // % runs to the left
  middleRunRate: number | null;         // % runs up the middle
  rightRunRate: number | null;          // % runs to the right

  // RB Receiving efficiency
  yacPerRec: number | null;
  recFirstDowns: number;
  firstDownsPerRoute: number | null;
  fptsPerRoute: number | null;

  // WR/TE Efficiency
  catchRate: number | null;
  yardsPerTarget: number | null;
  racr: number | null;
  wopr: number | null;
  slotRate: number | null;
  inlineRate: number | null;
  avgAirEpa: number | null;          // Avg EPA of targets before catch (target quality)
  avgCompAirEpa: number | null;      // Avg air EPA on completions only

  // WR/TE Target Depth Distribution
  deepTargetRate: number | null;          // % targets with air_yards >= 20
  intermediateTargetRate: number | null;  // % targets with air_yards 10-19
  shortTargetRate: number | null;         // % targets with air_yards < 10

  // WR/TE Target Location Distribution
  leftTargetRate: number | null;          // % targets to the left
  middleTargetRate: number | null;        // % targets to the middle
  rightTargetRate: number | null;         // % targets to the right

  // QB Efficiency (from play-by-play)
  cpoe: number | null;
  sacks: number;
  sackRate: number | null;
  sackYards: number;                    // Yards lost due to sacks (negative)
  qbHits: number;
  qbHitRate: number | null;
  scrambles: number;
  scrambleYards: number;                // Yards gained on scrambles
  scrambleTds: number;                  // TDs on scrambles
  passFirstDowns: number;
  passFirstDownRate: number | null;
  deepPassAttempts: number;
  deepPassRate: number | null;
  passAdot: number | null;
  shotgunRate: number | null;           // % of plays from shotgun
  noHuddleRate: number | null;          // % of plays in no-huddle
  shotgunSuccessRate: number | null;    // Success rate from shotgun
  underCenterSuccessRate: number | null; // Success rate from under center
  
  // QB Advanced Metrics (Data Lab v2)
  dropbacks: number;                    // Total dropbacks (pass attempts + sacks)
  anyA: number | null;                  // Adjusted Net Yards/Attempt
  fpPerDropback: number | null;         // Fantasy points per dropback

  // Combined
  epaPerPlay: number | null;
  successRate: number | null;

  // Expected YAC metrics (WR/TE/RB receiving)
  xYac: number | null;
  yacOverExpected: number | null;
  xYacSuccessRate: number | null;

  // ===== PHASE 2A: RED ZONE EFFICIENCY =====
  // All Skill Positions
  rzSnaps: number;
  rzSnapRate: number | null;
  rzSuccessRate: number | null;

  // QB Red Zone
  rzPassAttempts: number;
  rzPassTds: number;
  rzTdRate: number | null;
  rzInterceptions: number;

  // RB Red Zone
  rzRushTds: number;
  rzRushTdRate: number | null;
  rzTargets: number;
  rzReceptions: number;
  rzRecTds: number;

  // WR/TE Red Zone
  rzTargetShare: number | null;
  rzCatchRate: number | null;

  // ===== PHASE 2A: DOWN & DISTANCE CONTEXT =====
  // All Skill Positions
  thirdDownSnaps: number;
  thirdDownConversions: number;
  thirdDownConversionRate: number | null;
  earlyDownSuccessRate: number | null;
  lateDownSuccessRate: number | null;

  // RB Short Yardage
  shortYardageAttempts: number;
  shortYardageConversions: number;
  shortYardageRate: number | null;

  // WR/TE Third Down
  thirdDownTargets: number;
  thirdDownReceptions: number;
  thirdDownRecConversions: number;

  // ===== PHASE 2C: TWO-MINUTE DRILL & HURRY-UP =====
  // All Skill Positions
  twoMinuteSnaps: number;
  twoMinuteSuccessful: number;
  twoMinuteSuccessRate: number | null;
  hurryUpSnaps: number;
  hurryUpSuccessful: number;
  hurryUpSuccessRate: number | null;

  // WR/TE Two-Minute
  twoMinuteTargets: number;
  twoMinuteReceptions: number;

  // Fantasy
  fptsStd: number;
  fptsHalf: number;
  fptsPpr: number;
}

// Fantasy point calculations
function calculateFantasyPoints(stats: {
  passingYards: number;
  passingTds: number;
  interceptions: number;
  rushYards: number;
  rushTds: number;
  receptions: number;
  recYards: number;
  recTds: number;
}): { std: number; half: number; ppr: number } {
  const passing = (stats.passingYards * 0.04) + (stats.passingTds * 4) - (stats.interceptions * 2);
  const rushing = (stats.rushYards * 0.1) + (stats.rushTds * 6);
  const receiving = (stats.recYards * 0.1) + (stats.recTds * 6);

  const std = passing + rushing + receiving;
  const half = std + (stats.receptions * 0.5);
  const ppr = std + stats.receptions;

  return { std, half, ppr };
}

async function getAvailableWeeks(season: number): Promise<number[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT week
    FROM silver_player_weekly_stats
    WHERE season = ${season}
    ORDER BY week
  `);
  return (result.rows as any[]).map(r => r.week);
}

async function getTeamTotals(season: number, week: number): Promise<Map<string, { targets: number; snaps: number }>> {
  // Get team target totals for target share calculation
  const result = await db.execute(sql`
    SELECT team, SUM(targets) as total_targets
    FROM silver_player_weekly_stats
    WHERE season = ${season} AND week = ${week} AND team IS NOT NULL
    GROUP BY team
  `);

  const teamTotals = new Map<string, { targets: number; snaps: number }>();
  for (const row of result.rows as any[]) {
    teamTotals.set(row.team, {
      targets: Number(row.total_targets) || 0,
      snaps: 0 // Will be enriched from snap counts if available
    });
  }

  return teamTotals;
}

async function getSnapCounts(season: number, week: number): Promise<Map<string, { snaps: number; team: string }>> {
  const snapMap = new Map<string, { snaps: number; team: string }>();

  try {
    const result = await db.execute(sql`
      SELECT player, team, offense_snaps
      FROM bronze_nflfastr_snap_counts
      WHERE season = ${season} AND week = ${week}
    `);

    for (const row of result.rows as any[]) {
      snapMap.set(row.player, {
        snaps: Number(row.offense_snaps) || 0,
        team: row.team
      });
    }
  } catch (e) {
    // Snap counts may not exist for this week
  }

  return snapMap;
}

/**
 * Get snaps and routes from weekly_stats table (has accurate snap count data from ingestion)
 * Uses GSIS ID for reliable matching
 */
async function getWeeklyStatsSnapRoutes(season: number, week: number): Promise<Map<string, { snaps: number; routes: number }>> {
  const snapRouteMap = new Map<string, { snaps: number; routes: number }>();

  try {
    // Use player_id (contains GSIS ID) since gsis_id column is often NULL
    const result = await db.execute(sql`
      SELECT player_id, snaps, routes
      FROM weekly_stats
      WHERE season = ${season} AND week = ${week}
        AND player_id IS NOT NULL
        AND snaps > 0
    `);

    for (const row of result.rows as any[]) {
      snapRouteMap.set(row.player_id, {
        snaps: Number(row.snaps) || 0,
        routes: Number(row.routes) || 0,
      });
    }
  } catch (e) {
    console.warn(`  Warning: Could not fetch weekly_stats snap/routes for week ${week}`);
  }

  return snapRouteMap;
}

interface PlayByPlayStats {
  stuffed: number;
  rushFirstDowns: number;
  rzRushAttempts: number;
  recFirstDowns: number;
  successfulPlays: number;
  totalPlays: number;
}

/**
 * Get advanced rushing/receiving metrics from play-by-play data
 * Aggregates per rusher_player_id and receiver_player_id for the week
 */
async function getPlayByPlayStats(season: number, week: number): Promise<{
  rushStats: Map<string, { stuffed: number; firstDowns: number; rzAttempts: number; successfulPlays: number; totalPlays: number; insideRuns: number; outsideRuns: number; insideSuccessful: number; outsideSuccessful: number; leftRuns: number; middleRuns: number; rightRuns: number }>;
  recStats: Map<string, { firstDowns: number; xYac: number; yacOverExpected: number; xYacSuccesses: number; totalReceptions: number; totalAirEpa: number; totalCompAirEpa: number; totalTargets: number; totalCompletions: number; deepTargets: number; intermediateTargets: number; shortTargets: number; leftTargets: number; middleTargets: number; rightTargets: number }>;
}> {
  const rushStats = new Map<string, { stuffed: number; firstDowns: number; rzAttempts: number; successfulPlays: number; totalPlays: number; insideRuns: number; outsideRuns: number; insideSuccessful: number; outsideSuccessful: number; leftRuns: number; middleRuns: number; rightRuns: number }>();
  const recStats = new Map<string, { firstDowns: number; xYac: number; yacOverExpected: number; xYacSuccesses: number; totalReceptions: number; totalAirEpa: number; totalCompAirEpa: number; totalTargets: number; totalCompletions: number; deepTargets: number; intermediateTargets: number; shortTargets: number; leftTargets: number; middleTargets: number; rightTargets: number }>();

  try {
    // Get rushing stats from play-by-play (including success rate and gap/location)
    const rushResult = await db.execute(sql`
      SELECT
        rusher_player_id,
        SUM(CASE WHEN (raw_data->>'tackled_for_loss')::float > 0 THEN 1 ELSE 0 END) as stuffed,
        SUM(CASE WHEN first_down_rush THEN 1 ELSE 0 END) as first_downs,
        SUM(CASE WHEN yardline_100 <= 20 THEN 1 ELSE 0 END) as rz_attempts,
        SUM(CASE WHEN (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as successful_plays,
        COUNT(*) as total_plays,
        SUM(CASE WHEN raw_data->>'run_gap' IN ('guard', 'tackle') THEN 1 ELSE 0 END) as inside_runs,
        SUM(CASE WHEN raw_data->>'run_gap' = 'end' THEN 1 ELSE 0 END) as outside_runs,
        SUM(CASE WHEN raw_data->>'run_gap' IN ('guard', 'tackle') AND (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as inside_successful,
        SUM(CASE WHEN raw_data->>'run_gap' = 'end' AND (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as outside_successful,
        SUM(CASE WHEN raw_data->>'run_location' = 'left' THEN 1 ELSE 0 END) as left_runs,
        SUM(CASE WHEN raw_data->>'run_location' = 'middle' THEN 1 ELSE 0 END) as middle_runs,
        SUM(CASE WHEN raw_data->>'run_location' = 'right' THEN 1 ELSE 0 END) as right_runs
      FROM bronze_nflfastr_plays
      WHERE season = ${season}
        AND week = ${week}
        AND play_type = 'run'
        AND rusher_player_id IS NOT NULL
      GROUP BY rusher_player_id
    `);

    for (const row of rushResult.rows as any[]) {
      rushStats.set(row.rusher_player_id, {
        stuffed: Number(row.stuffed) || 0,
        firstDowns: Number(row.first_downs) || 0,
        rzAttempts: Number(row.rz_attempts) || 0,
        successfulPlays: Number(row.successful_plays) || 0,
        totalPlays: Number(row.total_plays) || 0,
        insideRuns: Number(row.inside_runs) || 0,
        outsideRuns: Number(row.outside_runs) || 0,
        insideSuccessful: Number(row.inside_successful) || 0,
        outsideSuccessful: Number(row.outside_successful) || 0,
        leftRuns: Number(row.left_runs) || 0,
        middleRuns: Number(row.middle_runs) || 0,
        rightRuns: Number(row.right_runs) || 0,
      });
    }

    // Get receiving metrics including xYAC, air EPA, and location/depth from play-by-play
    const recResult = await db.execute(sql`
      SELECT
        receiver_player_id,
        SUM(CASE WHEN first_down_pass AND complete_pass THEN 1 ELSE 0 END) as first_downs,
        SUM(CASE WHEN complete_pass THEN COALESCE((raw_data->>'xyac_mean_yardage')::float, 0) ELSE 0 END) as total_xyac,
        SUM(CASE WHEN complete_pass THEN yards_after_catch - COALESCE((raw_data->>'xyac_mean_yardage')::float, 0) ELSE 0 END) as total_yac_over_expected,
        SUM(CASE WHEN complete_pass AND (raw_data->>'xyac_success')::float > 0.5 THEN 1 ELSE 0 END) as xyac_successes,
        SUM(CASE WHEN complete_pass THEN 1 ELSE 0 END) as total_receptions,
        SUM(COALESCE((raw_data->>'air_epa')::float, 0)) as total_air_epa,
        SUM(CASE WHEN complete_pass THEN COALESCE((raw_data->>'comp_air_epa')::float, 0) ELSE 0 END) as total_comp_air_epa,
        COUNT(*) as total_targets,
        SUM(CASE WHEN complete_pass THEN 1 ELSE 0 END) as total_completions,
        SUM(CASE WHEN COALESCE((raw_data->>'air_yards')::float, 0) >= 20 THEN 1 ELSE 0 END) as deep_targets,
        SUM(CASE WHEN COALESCE((raw_data->>'air_yards')::float, 0) >= 10 AND COALESCE((raw_data->>'air_yards')::float, 0) < 20 THEN 1 ELSE 0 END) as intermediate_targets,
        SUM(CASE WHEN COALESCE((raw_data->>'air_yards')::float, 0) < 10 THEN 1 ELSE 0 END) as short_targets,
        SUM(CASE WHEN raw_data->>'pass_location' = 'left' THEN 1 ELSE 0 END) as left_targets,
        SUM(CASE WHEN raw_data->>'pass_location' = 'middle' THEN 1 ELSE 0 END) as middle_targets,
        SUM(CASE WHEN raw_data->>'pass_location' = 'right' THEN 1 ELSE 0 END) as right_targets
      FROM bronze_nflfastr_plays
      WHERE season = ${season}
        AND week = ${week}
        AND play_type = 'pass'
        AND receiver_player_id IS NOT NULL
      GROUP BY receiver_player_id
    `);

    for (const row of recResult.rows as any[]) {
      recStats.set(row.receiver_player_id, {
        firstDowns: Number(row.first_downs) || 0,
        xYac: Number(row.total_xyac) || 0,
        yacOverExpected: Number(row.total_yac_over_expected) || 0,
        xYacSuccesses: Number(row.xyac_successes) || 0,
        totalReceptions: Number(row.total_receptions) || 0,
        totalAirEpa: Number(row.total_air_epa) || 0,
        totalCompAirEpa: Number(row.total_comp_air_epa) || 0,
        totalTargets: Number(row.total_targets) || 0,
        totalCompletions: Number(row.total_completions) || 0,
        deepTargets: Number(row.deep_targets) || 0,
        intermediateTargets: Number(row.intermediate_targets) || 0,
        shortTargets: Number(row.short_targets) || 0,
        leftTargets: Number(row.left_targets) || 0,
        middleTargets: Number(row.middle_targets) || 0,
        rightTargets: Number(row.right_targets) || 0,
      });
    }
  } catch (e) {
    console.warn(`  Warning: Could not fetch play-by-play stats for week ${week}:`, e);
  }

  return { rushStats, recStats };
}

interface QbPlayByPlayStats {
  dropbacks: number;
  cpoe: number | null;
  sacks: number;
  sackYards: number;           // Yards lost due to sacks (negative)
  qbHits: number;
  scrambles: number;
  scrambleYards: number;       // Yards gained on scrambles
  scrambleTds: number;         // TDs on scrambles
  passFirstDowns: number;
  deepPassAttempts: number;
  totalAirYards: number;
  successfulPlays: number;
  totalPlays: number;
  shotgunPlays: number;
  noHuddlePlays: number;
  shotgunSuccessful: number;
  underCenterPlays: number;
  underCenterSuccessful: number;
}

/**
 * Get QB-specific metrics from play-by-play data
 */
async function getQbPlayByPlayStats(season: number, week: number): Promise<Map<string, QbPlayByPlayStats>> {
  const qbStats = new Map<string, QbPlayByPlayStats>();

  try {
    const result = await db.execute(sql`
      SELECT
        passer_player_id,
        COUNT(*) as dropbacks,
        AVG(CASE WHEN raw_data->>'cpoe' != '' THEN (raw_data->>'cpoe')::numeric ELSE NULL END) as avg_cpoe,
        SUM(CASE WHEN (raw_data->>'sack')::numeric > 0 THEN 1 ELSE 0 END) as sacks,
        -- Sack yards: yards_gained on sack plays (typically negative)
        SUM(CASE WHEN (raw_data->>'sack')::numeric > 0 THEN COALESCE((raw_data->>'yards_gained')::numeric, 0) ELSE 0 END) as sack_yards,
        SUM(CASE WHEN (raw_data->>'qb_hit')::numeric > 0 THEN 1 ELSE 0 END) as qb_hits,
        SUM(CASE WHEN (raw_data->>'qb_scramble')::numeric > 0 THEN 1 ELSE 0 END) as scrambles,
        -- Scramble yards and TDs
        SUM(CASE WHEN (raw_data->>'qb_scramble')::numeric > 0 THEN COALESCE((raw_data->>'yards_gained')::numeric, 0) ELSE 0 END) as scramble_yards,
        SUM(CASE WHEN (raw_data->>'qb_scramble')::numeric > 0 AND touchdown = true THEN 1 ELSE 0 END) as scramble_tds,
        SUM(CASE WHEN first_down_pass THEN 1 ELSE 0 END) as pass_first_downs,
        SUM(CASE WHEN air_yards > 20 THEN 1 ELSE 0 END) as deep_pass_attempts,
        SUM(COALESCE(air_yards, 0)) as total_air_yards,
        SUM(CASE WHEN (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as successful_plays,
        COUNT(*) as total_plays,
        SUM(CASE WHEN (raw_data->>'shotgun')::numeric = 1 THEN 1 ELSE 0 END) as shotgun_plays,
        SUM(CASE WHEN (raw_data->>'no_huddle')::numeric = 1 THEN 1 ELSE 0 END) as no_huddle_plays,
        SUM(CASE WHEN (raw_data->>'shotgun')::numeric = 1 AND (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as shotgun_successful,
        SUM(CASE WHEN (raw_data->>'shotgun')::numeric = 0 THEN 1 ELSE 0 END) as under_center_plays,
        SUM(CASE WHEN (raw_data->>'shotgun')::numeric = 0 AND (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as under_center_successful
      FROM bronze_nflfastr_plays
      WHERE season = ${season}
        AND week = ${week}
        AND play_type = 'pass'
        AND passer_player_id IS NOT NULL
      GROUP BY passer_player_id
    `);

    for (const row of result.rows as any[]) {
      qbStats.set(row.passer_player_id, {
        dropbacks: Number(row.dropbacks) || 0,
        cpoe: row.avg_cpoe !== null ? Number(row.avg_cpoe) : null,
        sacks: Number(row.sacks) || 0,
        sackYards: Number(row.sack_yards) || 0,
        qbHits: Number(row.qb_hits) || 0,
        scrambles: Number(row.scrambles) || 0,
        scrambleYards: Number(row.scramble_yards) || 0,
        scrambleTds: Number(row.scramble_tds) || 0,
        passFirstDowns: Number(row.pass_first_downs) || 0,
        deepPassAttempts: Number(row.deep_pass_attempts) || 0,
        totalAirYards: Number(row.total_air_yards) || 0,
        successfulPlays: Number(row.successful_plays) || 0,
        totalPlays: Number(row.total_plays) || 0,
        shotgunPlays: Number(row.shotgun_plays) || 0,
        noHuddlePlays: Number(row.no_huddle_plays) || 0,
        shotgunSuccessful: Number(row.shotgun_successful) || 0,
        underCenterPlays: Number(row.under_center_plays) || 0,
        underCenterSuccessful: Number(row.under_center_successful) || 0,
      });
    }
  } catch (e) {
    console.warn(`  Warning: Could not fetch QB play-by-play stats for week ${week}:`, e);
  }

  return qbStats;
}

/**
 * Get red zone efficiency stats from play-by-play data
 * Red zone = yardline_100 <= 20
 */
interface RedZoneStats {
  // All positions
  rzSnaps: number;
  rzSuccessful: number;
  rzTotalPlays: number;

  // QB
  rzPassAttempts: number;
  rzPassTds: number;
  rzInterceptions: number;

  // RB
  rzRushAttempts: number;
  rzRushTds: number;
  rzTargets: number;
  rzReceptions: number;
  rzRecTds: number;

  // Team context (for share calculations)
  teamRzTargets?: number;
}

async function getRedZoneStats(season: number, week: number): Promise<{
  playerRzStats: Map<string, RedZoneStats>;
  teamRzTargets: Map<string, number>;
}> {
  const playerRzStats = new Map<string, RedZoneStats>();
  const teamRzTargets = new Map<string, number>();

  try {
    // Get all player RZ stats (combines pass, rush, receiving)
    const result = await db.execute(sql`
      WITH rz_plays AS (
        SELECT * FROM bronze_nflfastr_plays
        WHERE season = ${season} AND week = ${week}
          AND yardline_100 <= 20
      )
      SELECT
        player_id,
        SUM(1) as rz_snaps,
        SUM(CASE WHEN (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as rz_successful,
        COUNT(*) as rz_total_plays,

        -- QB stats
        SUM(CASE WHEN play_type = 'pass' AND passer_player_id = player_id THEN 1 ELSE 0 END) as rz_pass_attempts,
        SUM(CASE WHEN play_type = 'pass' AND passer_player_id = player_id AND touchdown = true THEN 1 ELSE 0 END) as rz_pass_tds,
        SUM(CASE WHEN play_type = 'pass' AND passer_player_id = player_id AND interception = true THEN 1 ELSE 0 END) as rz_interceptions,

        -- RB rush stats
        SUM(CASE WHEN play_type = 'run' AND rusher_player_id = player_id THEN 1 ELSE 0 END) as rz_rush_attempts,
        SUM(CASE WHEN play_type = 'run' AND rusher_player_id = player_id AND touchdown = true THEN 1 ELSE 0 END) as rz_rush_tds,

        -- Receiving stats (RB/WR/TE)
        SUM(CASE WHEN play_type = 'pass' AND receiver_player_id = player_id THEN 1 ELSE 0 END) as rz_targets,
        SUM(CASE WHEN play_type = 'pass' AND receiver_player_id = player_id AND complete_pass = true THEN 1 ELSE 0 END) as rz_receptions,
        SUM(CASE WHEN play_type = 'pass' AND receiver_player_id = player_id AND touchdown = true THEN 1 ELSE 0 END) as rz_rec_tds
      FROM rz_plays, unnest(ARRAY[passer_player_id, rusher_player_id, receiver_player_id]) AS player_id
      WHERE player_id IS NOT NULL
      GROUP BY player_id
    `);

    for (const row of result.rows as any[]) {
      playerRzStats.set(row.player_id, {
        rzSnaps: Number(row.rz_snaps) || 0,
        rzSuccessful: Number(row.rz_successful) || 0,
        rzTotalPlays: Number(row.rz_total_plays) || 0,
        rzPassAttempts: Number(row.rz_pass_attempts) || 0,
        rzPassTds: Number(row.rz_pass_tds) || 0,
        rzInterceptions: Number(row.rz_interceptions) || 0,
        rzRushAttempts: Number(row.rz_rush_attempts) || 0,
        rzRushTds: Number(row.rz_rush_tds) || 0,
        rzTargets: Number(row.rz_targets) || 0,
        rzReceptions: Number(row.rz_receptions) || 0,
        rzRecTds: Number(row.rz_rec_tds) || 0,
      });
    }

    // Get team RZ target totals for target share calculation
    const teamTargetResult = await db.execute(sql`
      SELECT
        posteam as team,
        COUNT(*) as team_rz_targets
      FROM bronze_nflfastr_plays
      WHERE season = ${season} AND week = ${week}
        AND yardline_100 <= 20
        AND play_type = 'pass'
        AND receiver_player_id IS NOT NULL
      GROUP BY posteam
    `);

    for (const row of teamTargetResult.rows as any[]) {
      teamRzTargets.set(row.team, Number(row.team_rz_targets) || 0);
    }
  } catch (e) {
    console.warn(`  Warning: Could not fetch red zone stats for week ${week}:`, e);
  }

  return { playerRzStats, teamRzTargets };
}

/**
 * Get down & distance context stats from play-by-play data
 */
interface DownDistanceStats {
  // All positions - Third down
  thirdDownSnaps: number;
  thirdDownConversions: number;
  thirdDownPlays: number;

  // All positions - Early/late down success
  earlyDownSuccessful: number;
  earlyDownPlays: number;
  lateDownSuccessful: number;
  lateDownPlays: number;

  // RB - Short yardage
  shortYardageAttempts: number;
  shortYardageConversions: number;

  // WR/TE - Third down receiving
  thirdDownTargets: number;
  thirdDownReceptions: number;
  thirdDownRecConversions: number;
}

async function getDownDistanceStats(season: number, week: number): Promise<Map<string, DownDistanceStats>> {
  const stats = new Map<string, DownDistanceStats>();

  try {
    const result = await db.execute(sql`
      SELECT
        player_id,

        -- Third down snaps/conversions (all positions)
        SUM(CASE WHEN down = 3 THEN 1 ELSE 0 END) as third_down_snaps,
        SUM(CASE WHEN down = 3
          AND (first_down_pass = true OR first_down_rush = true OR touchdown = true) THEN 1 ELSE 0 END) as third_down_conversions,
        SUM(CASE WHEN down = 3 THEN 1 ELSE 0 END) as third_down_plays,

        -- Early down (1st/2nd) success rate
        SUM(CASE WHEN down IN (1, 2) AND (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as early_down_successful,
        SUM(CASE WHEN down IN (1, 2) THEN 1 ELSE 0 END) as early_down_plays,

        -- Late down (3rd/4th) success rate
        SUM(CASE WHEN down IN (3, 4) AND (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as late_down_successful,
        SUM(CASE WHEN down IN (3, 4) THEN 1 ELSE 0 END) as late_down_plays,

        -- RB short yardage (3rd/4th & <= 2 yards)
        SUM(CASE WHEN play_type = 'run' AND rusher_player_id = player_id
          AND down IN (3, 4)
          AND ydstogo <= 2 THEN 1 ELSE 0 END) as short_yardage_attempts,
        SUM(CASE WHEN play_type = 'run' AND rusher_player_id = player_id
          AND down IN (3, 4)
          AND ydstogo <= 2
          AND (first_down_rush = true OR touchdown = true) THEN 1 ELSE 0 END) as short_yardage_conversions,

        -- WR/TE third down receiving
        SUM(CASE WHEN play_type = 'pass' AND receiver_player_id = player_id
          AND down = 3 THEN 1 ELSE 0 END) as third_down_targets,
        SUM(CASE WHEN play_type = 'pass' AND receiver_player_id = player_id
          AND down = 3 AND complete_pass = true THEN 1 ELSE 0 END) as third_down_receptions,
        SUM(CASE WHEN play_type = 'pass' AND receiver_player_id = player_id
          AND down = 3
          AND (first_down_pass = true OR touchdown = true) THEN 1 ELSE 0 END) as third_down_rec_conversions

      FROM bronze_nflfastr_plays, unnest(ARRAY[passer_player_id, rusher_player_id, receiver_player_id]) AS player_id
      WHERE season = ${season} AND week = ${week}
        AND player_id IS NOT NULL
        AND down IS NOT NULL
      GROUP BY player_id
    `);

    for (const row of result.rows as any[]) {
      stats.set(row.player_id, {
        thirdDownSnaps: Number(row.third_down_snaps) || 0,
        thirdDownConversions: Number(row.third_down_conversions) || 0,
        thirdDownPlays: Number(row.third_down_plays) || 0,
        earlyDownSuccessful: Number(row.early_down_successful) || 0,
        earlyDownPlays: Number(row.early_down_plays) || 0,
        lateDownSuccessful: Number(row.late_down_successful) || 0,
        lateDownPlays: Number(row.late_down_plays) || 0,
        shortYardageAttempts: Number(row.short_yardage_attempts) || 0,
        shortYardageConversions: Number(row.short_yardage_conversions) || 0,
        thirdDownTargets: Number(row.third_down_targets) || 0,
        thirdDownReceptions: Number(row.third_down_receptions) || 0,
        thirdDownRecConversions: Number(row.third_down_rec_conversions) || 0,
      });
    }
  } catch (e) {
    console.warn(`  Warning: Could not fetch down/distance stats for week ${week}:`, e);
  }

  return stats;
}

/**
 * Get two-minute drill and hurry-up stats from play-by-play data
 */
interface TwoMinuteStats {
  twoMinuteSnaps: number;
  twoMinuteSuccessful: number;
  hurryUpSnaps: number;
  hurryUpSuccessful: number;
  twoMinuteTargets: number;
  twoMinuteReceptions: number;
}

async function getTwoMinuteStats(season: number, week: number): Promise<Map<string, TwoMinuteStats>> {
  const stats = new Map<string, TwoMinuteStats>();

  try {
    const result = await db.execute(sql`
      SELECT
        player_id,

        -- Two-minute drill (final 2 minutes of each half)
        SUM(CASE WHEN (raw_data->>'half_seconds_remaining')::float <= 120 THEN 1 ELSE 0 END) as two_minute_snaps,
        SUM(CASE WHEN (raw_data->>'half_seconds_remaining')::float <= 120
          AND (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as two_minute_successful,

        -- Hurry-up / no-huddle offense
        SUM(CASE WHEN (raw_data->>'no_huddle')::float = 1 THEN 1 ELSE 0 END) as hurry_up_snaps,
        SUM(CASE WHEN (raw_data->>'no_huddle')::float = 1
          AND (raw_data->>'success')::float = 1 THEN 1 ELSE 0 END) as hurry_up_successful,

        -- WR/TE two-minute targets/receptions
        SUM(CASE WHEN play_type = 'pass' AND receiver_player_id = player_id
          AND (raw_data->>'half_seconds_remaining')::float <= 120 THEN 1 ELSE 0 END) as two_minute_targets,
        SUM(CASE WHEN play_type = 'pass' AND receiver_player_id = player_id
          AND (raw_data->>'half_seconds_remaining')::float <= 120
          AND complete_pass = true THEN 1 ELSE 0 END) as two_minute_receptions

      FROM bronze_nflfastr_plays, unnest(ARRAY[passer_player_id, rusher_player_id, receiver_player_id]) AS player_id
      WHERE season = ${season} AND week = ${week}
        AND player_id IS NOT NULL
      GROUP BY player_id
    `);

    for (const row of result.rows as any[]) {
      stats.set(row.player_id, {
        twoMinuteSnaps: Number(row.two_minute_snaps) || 0,
        twoMinuteSuccessful: Number(row.two_minute_successful) || 0,
        hurryUpSnaps: Number(row.hurry_up_snaps) || 0,
        hurryUpSuccessful: Number(row.hurry_up_successful) || 0,
        twoMinuteTargets: Number(row.two_minute_targets) || 0,
        twoMinuteReceptions: Number(row.two_minute_receptions) || 0,
      });
    }
  } catch (e) {
    console.warn(`  Warning: Could not fetch two-minute stats for week ${week}:`, e);
  }

  return stats;
}

/**
 * Get route alignment data from player_usage table
 */
async function getPlayerUsageStats(season: number, week: number): Promise<Map<string, { slotRate: number | null; inlineRate: number | null }>> {
  const usageStats = new Map<string, { slotRate: number | null; inlineRate: number | null }>();

  try {
    const result = await db.execute(sql`
      SELECT
        player_id,
        alignment_slot_pct as slot_rate,
        CASE
          WHEN routes_total > 0 THEN (routes_inline::float / routes_total) * 100
          ELSE NULL
        END as inline_rate
      FROM player_usage
      WHERE season = ${season} AND week = ${week}
    `);

    for (const row of result.rows as any[]) {
      usageStats.set(row.player_id, {
        slotRate: row.slot_rate !== null ? Number(row.slot_rate) : null,
        inlineRate: row.inline_rate !== null ? Number(row.inline_rate) : null,
      });
    }
  } catch (e) {
    console.warn(`  Warning: Could not fetch player_usage stats for week ${week}`);
  }

  return usageStats;
}

/**
 * Get team air yards totals for WOPR calculation
 */
async function getTeamAirYards(season: number, week: number): Promise<Map<string, number>> {
  const teamAirYards = new Map<string, number>();

  try {
    const result = await db.execute(sql`
      SELECT team, SUM(air_yards) as total_air_yards
      FROM silver_player_weekly_stats
      WHERE season = ${season} AND week = ${week} AND team IS NOT NULL
      GROUP BY team
    `);

    for (const row of result.rows as any[]) {
      teamAirYards.set(row.team, Number(row.total_air_yards) || 0);
    }
  } catch (e) {
    console.warn(`  Warning: Could not fetch team air yards for week ${week}`);
  }

  return teamAirYards;
}

async function transformWeek(season: number, week: number): Promise<GoldPlayerWeek[]> {
  console.log(`  Transforming week ${week}...`);

  // Get silver stats
  const silverStats = await db.execute(sql`
    SELECT *
    FROM silver_player_weekly_stats
    WHERE season = ${season} AND week = ${week}
  `);

  const teamTotals = await getTeamTotals(season, week);
  const snapCounts = await getSnapCounts(season, week);
  const weeklySnapRoutes = await getWeeklyStatsSnapRoutes(season, week);
  const { rushStats, recStats } = await getPlayByPlayStats(season, week);
  const qbStats = await getQbPlayByPlayStats(season, week);
  const playerUsageStats = await getPlayerUsageStats(season, week);
  const teamAirYards = await getTeamAirYards(season, week);
  
  // Phase 2A: Red Zone and Down/Distance stats
  const { playerRzStats, teamRzTargets } = await getRedZoneStats(season, week);
  const downDistanceStats = await getDownDistanceStats(season, week);
  
  // Phase 2C: Two-minute drill and hurry-up stats
  const twoMinuteStats = await getTwoMinuteStats(season, week);

  // Calculate team snap totals
  const teamSnapTotals = new Map<string, number>();
  for (const [_, data] of snapCounts) {
    const current = teamSnapTotals.get(data.team) || 0;
    teamSnapTotals.set(data.team, current + data.snaps);
  }

  const goldRecords: GoldPlayerWeek[] = [];

  for (const row of silverStats.rows as any[]) {
    const targets = Number(row.targets) || 0;
    const receptions = Number(row.receptions) || 0;
    const recYards = Number(row.receiving_yards) || 0;
    const recTds = Number(row.receiving_tds) || 0;
    const airYards = Number(row.air_yards) || 0;
    const yac = Number(row.yac) || 0;
    const recEpa = Number(row.receiving_epa) || 0;

    const rushAttempts = Number(row.rush_attempts) || 0;
    const rushYards = Number(row.rushing_yards) || 0;
    const rushTds = Number(row.rushing_tds) || 0;
    const rushEpa = Number(row.rushing_epa) || 0;

    const passingYards = Number(row.passing_yards) || 0;
    const passingTds = Number(row.passing_tds) || 0;
    const interceptions = Number(row.interceptions) || 0;

    // Get snap/route data - prefer weekly_stats (has accurate data) over Silver layer
    const weeklyData = weeklySnapRoutes.get(row.player_id);
    const snaps = weeklyData?.snaps ?? (row.snaps !== null ? Number(row.snaps) : null);
    const silverRoutes = weeklyData?.routes ?? (row.routes !== null ? Number(row.routes) : null);

    // Calculate derived metrics
    const teamTargets = teamTotals.get(row.team)?.targets || 0;
    const targetShare = teamTargets > 0 ? targets / teamTargets : null;

    const teamSnaps = row.team ? teamSnapTotals.get(row.team) : null;
    const snapShare = (snaps !== null && teamSnaps && teamSnaps > 0) ? snaps / teamSnaps : null;

    // ADOT (Average Depth of Target)
    const adot = targets > 0 ? airYards / targets : null;

    // Use routes from Silver layer (precomputed with position-specific rates)
    const routes = silverRoutes;
    const routeRate = snaps !== null && snaps > 0 && routes !== null ? routes / snaps : null;

    // TPRR & YPRR
    const tprr = routes !== null && routes > 0 ? targets / routes : null;
    const yprr = routes !== null && routes > 0 ? recYards / routes : null;

    // EPA metrics
    const totalPlays = targets + rushAttempts;
    const totalEpa = recEpa + rushEpa;
    const epaPerPlay = totalPlays > 0 ? totalEpa / totalPlays : null;
    const epaPerTarget = targets > 0 ? recEpa / targets : null;
    const rushEpaPerPlay = rushAttempts > 0 ? rushEpa / rushAttempts : null;

    // YPC
    const yardsPerCarry = rushAttempts > 0 ? rushYards / rushAttempts : null;

    // Fantasy points
    const fpts = calculateFantasyPoints({
      passingYards,
      passingTds,
      interceptions,
      rushYards,
      rushTds,
      receptions,
      recYards,
      recTds,
    });

    // RB Rushing efficiency from play-by-play
    const playerRushStats = rushStats.get(row.player_id);
    const stuffed = playerRushStats?.stuffed || 0;
    const rushFirstDowns = playerRushStats?.firstDowns || 0;
    const rzRushAttempts = playerRushStats?.rzAttempts || 0;
    const stuffRate = rushAttempts > 0 ? stuffed / rushAttempts : null;
    const rushFirstDownRate = rushAttempts > 0 ? rushFirstDowns / rushAttempts : null;

    // RB Run Gap Distribution
    const insideRuns = playerRushStats?.insideRuns || 0;
    const outsideRuns = playerRushStats?.outsideRuns || 0;
    const insideSuccessful = playerRushStats?.insideSuccessful || 0;
    const outsideSuccessful = playerRushStats?.outsideSuccessful || 0;
    const totalGapRuns = insideRuns + outsideRuns;
    const insideRunRate = totalGapRuns > 0 ? insideRuns / totalGapRuns : null;
    const outsideRunRate = totalGapRuns > 0 ? outsideRuns / totalGapRuns : null;
    const insideSuccessRate = insideRuns > 0 ? insideSuccessful / insideRuns : null;
    const outsideSuccessRate = outsideRuns > 0 ? outsideSuccessful / outsideRuns : null;

    // RB Run Location Distribution
    const leftRuns = playerRushStats?.leftRuns || 0;
    const middleRuns = playerRushStats?.middleRuns || 0;
    const rightRuns = playerRushStats?.rightRuns || 0;
    const totalLocationRuns = leftRuns + middleRuns + rightRuns;
    const leftRunRate = totalLocationRuns > 0 ? leftRuns / totalLocationRuns : null;
    const middleRunRate = totalLocationRuns > 0 ? middleRuns / totalLocationRuns : null;
    const rightRunRate = totalLocationRuns > 0 ? rightRuns / totalLocationRuns : null;

    // RB Receiving efficiency
    const playerRecStats = recStats.get(row.player_id);
    const recFirstDowns = playerRecStats?.firstDowns || 0;
    const yacPerRec = receptions > 0 ? yac / receptions : null;
    const firstDownsPerRoute = routes !== null && routes > 0 ? recFirstDowns / routes : null;
    const fptsPerRoute = routes !== null && routes > 0 ? fpts.ppr / routes : null;

    // QB Efficiency from play-by-play
    const playerQbStats = qbStats.get(row.player_id);
    const passAttempts = Number(row.pass_attempts) || 0;
    const passYards = Number(row.pass_yards) || 0;
    const passTds = Number(row.pass_tds) || 0;
    const passInterceptions = Number(row.interceptions) || 0;
    const dropbacks = playerQbStats?.dropbacks || passAttempts;
    const cpoe = playerQbStats?.cpoe ?? null;
    const sacks = playerQbStats?.sacks || 0;
    const sackYards = playerQbStats?.sackYards || 0;  // Yards lost from sacks (negative)
    const sackRate = dropbacks > 0 ? sacks / dropbacks : null;
    const qbHits = playerQbStats?.qbHits || 0;
    const qbHitRate = dropbacks > 0 ? qbHits / dropbacks : null;
    const scrambles = playerQbStats?.scrambles || 0;
    const scrambleYards = playerQbStats?.scrambleYards || 0;  // Yards gained on scrambles
    const scrambleTds = playerQbStats?.scrambleTds || 0;      // TDs on scrambles
    const passFirstDowns = playerQbStats?.passFirstDowns || 0;
    const passFirstDownRate = passAttempts > 0 ? passFirstDowns / passAttempts : null;
    const deepPassAttempts = playerQbStats?.deepPassAttempts || 0;
    const deepPassRate = passAttempts > 0 ? deepPassAttempts / passAttempts : null;
    const passAdot = passAttempts > 0 && playerQbStats?.totalAirYards
      ? playerQbStats.totalAirYards / passAttempts
      : null;
    
    // QB Advanced Metrics (Data Lab v2)
    // ANY/A = (pass_yards + 20*TDs - 45*INTs - sack_yards) / (attempts + sacks)
    // sackYards is typically negative, so we add it (which subtracts)
    const anyADenom = passAttempts + sacks;
    const anyA = anyADenom > 0 
      ? (passYards + (20 * passTds) - (45 * passInterceptions) + sackYards) / anyADenom 
      : null;
    // Fantasy points per dropback
    const fpPerDropback = dropbacks > 0 ? fpts.ppr / dropbacks : null;

    // QB Shotgun/No-Huddle metrics
    const shotgunPlays = playerQbStats?.shotgunPlays || 0;
    const noHuddlePlays = playerQbStats?.noHuddlePlays || 0;
    const shotgunSuccessful = playerQbStats?.shotgunSuccessful || 0;
    const underCenterPlays = playerQbStats?.underCenterPlays || 0;
    const underCenterSuccessful = playerQbStats?.underCenterSuccessful || 0;
    const totalQbPlays = shotgunPlays + underCenterPlays;
    const shotgunRate = totalQbPlays > 0 ? shotgunPlays / totalQbPlays : null;
    const noHuddleRate = totalQbPlays > 0 ? noHuddlePlays / totalQbPlays : null;
    const shotgunSuccessRate = shotgunPlays > 0 ? shotgunSuccessful / shotgunPlays : null;
    const underCenterSuccessRate = underCenterPlays > 0 ? underCenterSuccessful / underCenterPlays : null;

    // WR/TE Efficiency
    const catchRate = targets > 0 ? receptions / targets : null;
    const yardsPerTarget = targets > 0 ? recYards / targets : null;
    const racr = airYards > 0 ? recYards / airYards : null; // Receiver Air Conversion Ratio

    // WOPR = (target share × 1.5) + (air yards share × 0.7)
    const teamTotalAirYards = row.team ? teamAirYards.get(row.team) : null;
    const airYardsShare = teamTotalAirYards && teamTotalAirYards > 0 ? airYards / teamTotalAirYards : null;
    const wopr = targetShare !== null && airYardsShare !== null
      ? (targetShare * 1.5) + (airYardsShare * 0.7)
      : null;

    // Route alignment from player_usage
    const usageData = playerUsageStats.get(row.player_id);
    const slotRate = usageData?.slotRate ?? null;
    const inlineRate = usageData?.inlineRate ?? null;

    // Target Quality (air EPA metrics for WR/TE/RB)
    const totalAirEpa = playerRecStats?.totalAirEpa || 0;
    const totalCompAirEpa = playerRecStats?.totalCompAirEpa || 0;
    const recTargets = playerRecStats?.totalTargets || targets; // Fallback to Silver layer targets
    const recCompletions = playerRecStats?.totalCompletions || receptions; // Fallback to Silver layer receptions
    const avgAirEpa = recTargets > 0 ? totalAirEpa / recTargets : null;
    const avgCompAirEpa = recCompletions > 0 ? totalCompAirEpa / recCompletions : null;

    // WR/TE Target Depth Distribution
    const deepTargets = playerRecStats?.deepTargets || 0;
    const intermediateTargets = playerRecStats?.intermediateTargets || 0;
    const shortTargets = playerRecStats?.shortTargets || 0;
    const totalDepthTargets = deepTargets + intermediateTargets + shortTargets;
    const deepTargetRate = totalDepthTargets > 0 ? deepTargets / totalDepthTargets : null;
    const intermediateTargetRate = totalDepthTargets > 0 ? intermediateTargets / totalDepthTargets : null;
    const shortTargetRate = totalDepthTargets > 0 ? shortTargets / totalDepthTargets : null;

    // WR/TE Target Location Distribution
    const leftTargets = playerRecStats?.leftTargets || 0;
    const middleTargets = playerRecStats?.middleTargets || 0;
    const rightTargets = playerRecStats?.rightTargets || 0;
    const totalLocationTargets = leftTargets + middleTargets + rightTargets;
    const leftTargetRate = totalLocationTargets > 0 ? leftTargets / totalLocationTargets : null;
    const middleTargetRate = totalLocationTargets > 0 ? middleTargets / totalLocationTargets : null;
    const rightTargetRate = totalLocationTargets > 0 ? rightTargets / totalLocationTargets : null;

    // Success rate (combining pass and rush plays)
    const rushSuccessful = playerRushStats?.successfulPlays || 0;
    const rushTotalPlays = playerRushStats?.totalPlays || 0;
    const passSuccessful = playerQbStats?.successfulPlays || 0;
    const passTotalPlays = playerQbStats?.totalPlays || 0;
    const totalSuccessfulPlays = rushSuccessful + passSuccessful;
    const totalCombinedPlays = rushTotalPlays + passTotalPlays;
    const successRate = totalCombinedPlays > 0 ? totalSuccessfulPlays / totalCombinedPlays : null;

    // Expected YAC metrics (WR/TE/RB receiving)
    const totalXYac = playerRecStats?.xYac || 0;
    const totalYacOverExpected = playerRecStats?.yacOverExpected || 0;
    const xYacSuccesses = playerRecStats?.xYacSuccesses || 0;
    const totalReceptions = playerRecStats?.totalReceptions || 0;
    const xYac = totalReceptions > 0 ? totalXYac / totalReceptions : null;
    const yacOverExpected = totalReceptions > 0 ? totalYacOverExpected / totalReceptions : null;
    const xYacSuccessRate = totalReceptions > 0 ? xYacSuccesses / totalReceptions : null;

    // ===== PHASE 2A: RED ZONE EFFICIENCY =====
    const playerRz = playerRzStats.get(row.player_id);
    const rzSnaps = playerRz?.rzSnaps || 0;
    const rzSuccessful = playerRz?.rzSuccessful || 0;
    const rzTotalPlays = playerRz?.rzTotalPlays || 0;
    const teamRzTargetTotal = row.team ? teamRzTargets.get(row.team) || 0 : 0;
    
    // All positions
    const rzSnapRate = teamSnaps && teamSnaps > 0 ? rzSnaps / teamSnaps : null;
    const rzSuccessRate = rzTotalPlays > 0 ? rzSuccessful / rzTotalPlays : null;
    
    // QB Red Zone
    const rzPassAttempts = playerRz?.rzPassAttempts || 0;
    const rzPassTds = playerRz?.rzPassTds || 0;
    const rzTdRate = rzPassAttempts > 0 ? rzPassTds / rzPassAttempts : null;
    const rzInterceptions = playerRz?.rzInterceptions || 0;
    
    // RB Red Zone
    const rzRushTds = playerRz?.rzRushTds || 0;
    const rzRushTdRate = rzRushAttempts > 0 ? rzRushTds / rzRushAttempts : null;
    const rzTargets = playerRz?.rzTargets || 0;
    const rzReceptions = playerRz?.rzReceptions || 0;
    const rzRecTds = playerRz?.rzRecTds || 0;
    
    // WR/TE Red Zone
    const rzTargetShare = teamRzTargetTotal > 0 ? rzTargets / teamRzTargetTotal : null;
    const rzCatchRate = rzTargets > 0 ? rzReceptions / rzTargets : null;

    // ===== PHASE 2A: DOWN & DISTANCE CONTEXT =====
    const playerDD = downDistanceStats.get(row.player_id);
    
    // All positions - Third down
    const thirdDownSnaps = playerDD?.thirdDownSnaps || 0;
    const thirdDownConversions = playerDD?.thirdDownConversions || 0;
    const thirdDownPlays = playerDD?.thirdDownPlays || 0;
    const thirdDownConversionRate = thirdDownPlays > 0 ? thirdDownConversions / thirdDownPlays : null;
    
    // Early/late down success
    const earlyDownSuccessful = playerDD?.earlyDownSuccessful || 0;
    const earlyDownPlays = playerDD?.earlyDownPlays || 0;
    const lateDownSuccessful = playerDD?.lateDownSuccessful || 0;
    const lateDownPlays = playerDD?.lateDownPlays || 0;
    const earlyDownSuccessRate = earlyDownPlays > 0 ? earlyDownSuccessful / earlyDownPlays : null;
    const lateDownSuccessRate = lateDownPlays > 0 ? lateDownSuccessful / lateDownPlays : null;
    
    // RB Short Yardage
    const shortYardageAttempts = playerDD?.shortYardageAttempts || 0;
    const shortYardageConversions = playerDD?.shortYardageConversions || 0;
    const shortYardageRate = shortYardageAttempts > 0 ? shortYardageConversions / shortYardageAttempts : null;
    
    // WR/TE Third Down
    const thirdDownTargets = playerDD?.thirdDownTargets || 0;
    const thirdDownReceptions = playerDD?.thirdDownReceptions || 0;
    const thirdDownRecConversions = playerDD?.thirdDownRecConversions || 0;

    // ===== PHASE 2C: TWO-MINUTE DRILL & HURRY-UP =====
    const player2M = twoMinuteStats.get(row.player_id);
    const twoMinuteSnaps = player2M?.twoMinuteSnaps || 0;
    const twoMinuteSuccessful = player2M?.twoMinuteSuccessful || 0;
    const twoMinuteSuccessRate = twoMinuteSnaps > 0 ? twoMinuteSuccessful / twoMinuteSnaps : null;
    const hurryUpSnaps = player2M?.hurryUpSnaps || 0;
    const hurryUpSuccessful = player2M?.hurryUpSuccessful || 0;
    const hurryUpSuccessRate = hurryUpSnaps > 0 ? hurryUpSuccessful / hurryUpSnaps : null;
    const twoMinuteTargets = player2M?.twoMinuteTargets || 0;
    const twoMinuteReceptions = player2M?.twoMinuteReceptions || 0;

    goldRecords.push({
      season,
      week,
      playerId: row.player_id,
      playerName: row.player_name,
      teamId: row.team,
      position: row.position,
      snaps,
      snapShare,
      routes,
      routeRate,
      targets,
      targetShare,
      receptions,
      recYards,
      recTds,
      adot,
      airYards,
      yac,
      tprr,
      yprr,
      epaPerTarget,
      rushAttempts,
      rushYards,
      rushTds,
      yardsPerCarry,
      rushEpaPerPlay,
      // RB Rushing efficiency
      stuffed,
      stuffRate,
      rushFirstDowns,
      rushFirstDownRate,
      rzRushAttempts,
      // RB Run Gap Distribution
      insideRunRate,
      outsideRunRate,
      insideSuccessRate,
      outsideSuccessRate,
      // RB Run Location Distribution
      leftRunRate,
      middleRunRate,
      rightRunRate,
      // RB Receiving efficiency
      yacPerRec,
      recFirstDowns,
      firstDownsPerRoute,
      fptsPerRoute,
      // WR/TE Efficiency
      catchRate,
      yardsPerTarget,
      racr,
      wopr,
      slotRate,
      inlineRate,
      avgAirEpa,
      avgCompAirEpa,
      // WR/TE Target Depth Distribution
      deepTargetRate,
      intermediateTargetRate,
      shortTargetRate,
      // WR/TE Target Location Distribution
      leftTargetRate,
      middleTargetRate,
      rightTargetRate,
      // QB Efficiency
      cpoe,
      sacks,
      sackRate,
      sackYards,
      qbHits,
      qbHitRate,
      scrambles,
      scrambleYards,
      scrambleTds,
      passFirstDowns,
      passFirstDownRate,
      deepPassAttempts,
      deepPassRate,
      passAdot,
      shotgunRate,
      noHuddleRate,
      shotgunSuccessRate,
      underCenterSuccessRate,
      // QB Advanced Metrics (Data Lab v2)
      dropbacks,
      anyA,
      fpPerDropback,
      // Combined
      epaPerPlay,
      successRate,
      // Expected YAC metrics
      xYac,
      yacOverExpected,
      xYacSuccessRate,
      // ===== PHASE 2A: RED ZONE EFFICIENCY =====
      rzSnaps,
      rzSnapRate,
      rzSuccessRate,
      rzPassAttempts,
      rzPassTds,
      rzTdRate,
      rzInterceptions,
      rzRushTds,
      rzRushTdRate,
      rzTargets,
      rzReceptions,
      rzRecTds,
      rzTargetShare,
      rzCatchRate,
      // ===== PHASE 2A: DOWN & DISTANCE CONTEXT =====
      thirdDownSnaps,
      thirdDownConversions,
      thirdDownConversionRate,
      earlyDownSuccessRate,
      lateDownSuccessRate,
      shortYardageAttempts,
      shortYardageConversions,
      shortYardageRate,
      thirdDownTargets,
      thirdDownReceptions,
      thirdDownRecConversions,
      // ===== PHASE 2C: TWO-MINUTE DRILL & HURRY-UP =====
      twoMinuteSnaps,
      twoMinuteSuccessful,
      twoMinuteSuccessRate,
      hurryUpSnaps,
      hurryUpSuccessful,
      hurryUpSuccessRate,
      twoMinuteTargets,
      twoMinuteReceptions,
      // Fantasy
      fptsStd: Math.round(fpts.std * 10) / 10,
      fptsHalf: Math.round(fpts.half * 10) / 10,
      fptsPpr: Math.round(fpts.ppr * 10) / 10,
    });
  }

  return goldRecords;
}

async function createSnapshotMeta(season: number, week: number, rowCount: number, teamCount: number): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO datadive_snapshot_meta (
      season, week, data_version, is_official, row_count, team_count,
      validation_passed, snapshot_at, triggered_by
    ) VALUES (
      ${season}, ${week}, 'v1', true, ${rowCount}, ${teamCount},
      true, NOW(), 'etl'
    )
    RETURNING id
  `);
  return (result.rows as any[])[0].id;
}

async function insertGoldRecords(records: GoldPlayerWeek[], snapshotId: number): Promise<number> {
  if (records.length === 0) return 0;

  let inserted = 0;

  for (const rec of records) {
    await db.execute(sql`
      INSERT INTO datadive_snapshot_player_week (
        snapshot_id, season, week, player_id, player_name, team_id, position,
        snaps, snap_share, routes, route_rate,
        targets, target_share, receptions, rec_yards, rec_tds,
        adot, air_yards, yac, tprr, yprr, epa_per_target,
        rush_attempts, rush_yards, rush_tds, yards_per_carry, rush_epa_per_play,
        stuffed, stuff_rate, rush_first_downs, rush_first_down_rate, rz_rush_attempts,
        inside_run_rate, outside_run_rate, inside_success_rate, outside_success_rate,
        left_run_rate, middle_run_rate, right_run_rate,
        yac_per_rec, rec_first_downs, first_downs_per_route, fpts_per_route,
        catch_rate, yards_per_target, racr, wopr, slot_rate, inline_rate,
        avg_air_epa, avg_comp_air_epa,
        deep_target_rate, intermediate_target_rate, short_target_rate,
        left_target_rate, middle_target_rate, right_target_rate,
        cpoe, sacks, sack_rate, sack_yards, qb_hits, qb_hit_rate, scrambles, scramble_yards, scramble_tds,
        pass_first_downs, pass_first_down_rate, deep_pass_attempts, deep_pass_rate, pass_adot,
        shotgun_rate, no_huddle_rate, shotgun_success_rate, under_center_success_rate,
        dropbacks, any_a, fp_per_dropback,
        epa_per_play, success_rate, x_yac, yac_over_expected, x_yac_success_rate,
        rz_snaps, rz_snap_rate, rz_success_rate,
        rz_pass_attempts, rz_pass_tds, rz_td_rate, rz_interceptions,
        rz_rush_tds, rz_rush_td_rate, rz_targets, rz_receptions, rz_rec_tds,
        rz_target_share, rz_catch_rate,
        third_down_snaps, third_down_conversions, third_down_conversion_rate,
        early_down_success_rate, late_down_success_rate,
        short_yardage_attempts, short_yardage_conversions, short_yardage_rate,
        third_down_targets, third_down_receptions, third_down_rec_conversions,
        two_minute_snaps, two_minute_successful, two_minute_success_rate,
        hurry_up_snaps, hurry_up_successful, hurry_up_success_rate,
        two_minute_targets, two_minute_receptions,
        fpts_std, fpts_half, fpts_ppr
      ) VALUES (
        ${snapshotId}, ${rec.season}, ${rec.week}, ${rec.playerId}, ${rec.playerName}, ${rec.teamId}, ${rec.position},
        ${rec.snaps}, ${rec.snapShare}, ${rec.routes}, ${rec.routeRate},
        ${rec.targets}, ${rec.targetShare}, ${rec.receptions}, ${rec.recYards}, ${rec.recTds},
        ${rec.adot}, ${rec.airYards}, ${rec.yac}, ${rec.tprr}, ${rec.yprr}, ${rec.epaPerTarget},
        ${rec.rushAttempts}, ${rec.rushYards}, ${rec.rushTds}, ${rec.yardsPerCarry}, ${rec.rushEpaPerPlay},
        ${rec.stuffed}, ${rec.stuffRate}, ${rec.rushFirstDowns}, ${rec.rushFirstDownRate}, ${rec.rzRushAttempts},
        ${rec.insideRunRate}, ${rec.outsideRunRate}, ${rec.insideSuccessRate}, ${rec.outsideSuccessRate},
        ${rec.leftRunRate}, ${rec.middleRunRate}, ${rec.rightRunRate},
        ${rec.yacPerRec}, ${rec.recFirstDowns}, ${rec.firstDownsPerRoute}, ${rec.fptsPerRoute},
        ${rec.catchRate}, ${rec.yardsPerTarget}, ${rec.racr}, ${rec.wopr}, ${rec.slotRate}, ${rec.inlineRate},
        ${rec.avgAirEpa}, ${rec.avgCompAirEpa},
        ${rec.deepTargetRate}, ${rec.intermediateTargetRate}, ${rec.shortTargetRate},
        ${rec.leftTargetRate}, ${rec.middleTargetRate}, ${rec.rightTargetRate},
        ${rec.cpoe}, ${rec.sacks}, ${rec.sackRate}, ${rec.sackYards}, ${rec.qbHits}, ${rec.qbHitRate}, ${rec.scrambles}, ${rec.scrambleYards}, ${rec.scrambleTds},
        ${rec.passFirstDowns}, ${rec.passFirstDownRate}, ${rec.deepPassAttempts}, ${rec.deepPassRate}, ${rec.passAdot},
        ${rec.shotgunRate}, ${rec.noHuddleRate}, ${rec.shotgunSuccessRate}, ${rec.underCenterSuccessRate},
        ${rec.dropbacks}, ${rec.anyA}, ${rec.fpPerDropback},
        ${rec.epaPerPlay}, ${rec.successRate}, ${rec.xYac}, ${rec.yacOverExpected}, ${rec.xYacSuccessRate},
        ${rec.rzSnaps}, ${rec.rzSnapRate}, ${rec.rzSuccessRate},
        ${rec.rzPassAttempts}, ${rec.rzPassTds}, ${rec.rzTdRate}, ${rec.rzInterceptions},
        ${rec.rzRushTds}, ${rec.rzRushTdRate}, ${rec.rzTargets}, ${rec.rzReceptions}, ${rec.rzRecTds},
        ${rec.rzTargetShare}, ${rec.rzCatchRate},
        ${rec.thirdDownSnaps}, ${rec.thirdDownConversions}, ${rec.thirdDownConversionRate},
        ${rec.earlyDownSuccessRate}, ${rec.lateDownSuccessRate},
        ${rec.shortYardageAttempts}, ${rec.shortYardageConversions}, ${rec.shortYardageRate},
        ${rec.thirdDownTargets}, ${rec.thirdDownReceptions}, ${rec.thirdDownRecConversions},
        ${rec.twoMinuteSnaps}, ${rec.twoMinuteSuccessful}, ${rec.twoMinuteSuccessRate},
        ${rec.hurryUpSnaps}, ${rec.hurryUpSuccessful}, ${rec.hurryUpSuccessRate},
        ${rec.twoMinuteTargets}, ${rec.twoMinuteReceptions},
        ${rec.fptsStd}, ${rec.fptsHalf}, ${rec.fptsPpr}
      )
    `);
    inserted++;
  }

  return inserted;
}

/**
 * Run Gold ETL for a single week.
 * Can be called programmatically from other services.
 *
 * @returns The snapshot ID and record count for the created snapshot
 */
export async function runGoldETLForWeek(
  season: number,
  week: number
): Promise<{ snapshotId: number; recordCount: number }> {
  console.log(`🔶 [Gold ETL] Processing ${season} Week ${week}...`);

  const records = await transformWeek(season, week);

  if (records.length === 0) {
    console.warn(`⚠️ [Gold ETL] No records for ${season} Week ${week}`);
    return { snapshotId: 0, recordCount: 0 };
  }

  // Count unique teams
  const teams = new Set(records.map(r => r.teamId).filter(Boolean));

  // Upsert guard: remove existing rows for this season/week to prevent duplicates
  const deleteResult = await db.execute(sql`
    DELETE FROM datadive_snapshot_player_week
    WHERE season = ${season} AND week = ${week}
  `);
  const deletedCount = (deleteResult as any).rowCount ?? 0;
  if (deletedCount > 0) {
    console.log(`🧹 [Gold ETL] Upsert guard: deleted ${deletedCount} existing rows for ${season} Week ${week}`);
  }

  // Create snapshot meta first (FK requirement)
  const snapshotId = await createSnapshotMeta(season, week, records.length, teams.size);

  const inserted = await insertGoldRecords(records, snapshotId);
  console.log(`✅ [Gold ETL] Week ${week}: ${inserted} records (snapshot_id: ${snapshotId})`);

  return { snapshotId, recordCount: inserted };
}

async function runGoldETL(season: number, startWeek?: number, endWeek?: number): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`GOLD LAYER ETL: silver_player_weekly_stats → datadive_snapshot_player_week`);
  console.log(`Season: ${season}`);
  console.log(`${'='.repeat(60)}\n`);

  const availableWeeks = await getAvailableWeeks(season);
  console.log(`Available weeks in silver: ${availableWeeks.join(', ')}`);

  let weeksToProcess = availableWeeks;
  if (startWeek !== undefined) {
    weeksToProcess = weeksToProcess.filter(w => w >= startWeek);
  }
  if (endWeek !== undefined) {
    weeksToProcess = weeksToProcess.filter(w => w <= endWeek);
  }

  console.log(`Weeks to process: ${weeksToProcess.join(', ')}\n`);

  let totalRecords = 0;
  const weekSummary: { week: number; records: number; snapshotId: number }[] = [];

  for (const week of weeksToProcess) {
    const records = await transformWeek(season, week);

    // Count unique teams
    const teams = new Set(records.map(r => r.teamId).filter(Boolean));

    // Upsert guard: remove existing rows for this season/week to prevent duplicates
    const deleteResult = await db.execute(sql`
      DELETE FROM datadive_snapshot_player_week
      WHERE season = ${season} AND week = ${week}
    `);
    const deletedCount = (deleteResult as any).rowCount ?? 0;
    if (deletedCount > 0) {
      console.log(`🧹 [Gold ETL] Upsert guard: deleted ${deletedCount} existing rows for ${season} Week ${week}`);
    }

    // Create snapshot meta first (FK requirement)
    const snapshotId = await createSnapshotMeta(season, week, records.length, teams.size);

    const inserted = await insertGoldRecords(records, snapshotId);
    totalRecords += inserted;
    weekSummary.push({ week, records: inserted, snapshotId });
    console.log(`  Week ${week}: ${inserted} records inserted (snapshot_id: ${snapshotId})`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`GOLD ETL COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total weeks processed: ${weeksToProcess.length}`);
  console.log(`Total records upserted: ${totalRecords}`);

  // Verify final state
  const finalCount = await db.execute(sql`
    SELECT COUNT(*) as total, COUNT(DISTINCT player_id) as players, MIN(week) as min_week, MAX(week) as max_week
    FROM datadive_snapshot_player_week
    WHERE season = ${season}
  `);
  const row = (finalCount.rows as any[])[0];
  console.log(`\nFinal datadive_snapshot_player_week state for ${season}:`);
  console.log(`  Total rows: ${row.total}`);
  console.log(`  Unique players: ${row.players}`);
  console.log(`  Week range: ${row.min_week} - ${row.max_week}`);
}

// CLI entry point - only run when executed directly (not when imported)
import { fileURLToPath } from 'url';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const args = process.argv.slice(2);
  const season = parseInt(args[0]) || 2025;
  const startWeek = args[1] ? parseInt(args[1]) : undefined;
  const endWeek = args[2] ? parseInt(args[2]) : undefined;

  runGoldETL(season, startWeek, endWeek)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Gold ETL failed:', err);
      process.exit(1);
    });
}
