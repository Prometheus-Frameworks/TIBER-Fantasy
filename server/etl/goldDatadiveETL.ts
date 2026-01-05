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

  // QB Efficiency (from play-by-play)
  cpoe: number | null;
  sacks: number;
  sackRate: number | null;
  qbHits: number;
  qbHitRate: number | null;
  scrambles: number;
  passFirstDowns: number;
  passFirstDownRate: number | null;
  deepPassAttempts: number;
  deepPassRate: number | null;
  passAdot: number | null;

  // Combined
  epaPerPlay: number | null;
  successRate: number | null;

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
    const result = await db.execute(sql`
      SELECT gsis_id, snaps, routes
      FROM weekly_stats
      WHERE season = ${season} AND week = ${week}
        AND gsis_id IS NOT NULL
        AND snaps > 0
    `);

    for (const row of result.rows as any[]) {
      snapRouteMap.set(row.gsis_id, {
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
}

/**
 * Get advanced rushing/receiving metrics from play-by-play data
 * Aggregates per rusher_player_id and receiver_player_id for the week
 */
async function getPlayByPlayStats(season: number, week: number): Promise<{
  rushStats: Map<string, { stuffed: number; firstDowns: number; rzAttempts: number }>;
  recStats: Map<string, { firstDowns: number }>;
}> {
  const rushStats = new Map<string, { stuffed: number; firstDowns: number; rzAttempts: number }>();
  const recStats = new Map<string, { firstDowns: number }>();

  try {
    // Get rushing stats from play-by-play
    const rushResult = await db.execute(sql`
      SELECT
        rusher_player_id,
        SUM(CASE WHEN (raw_data->>'tackled_for_loss')::float > 0 THEN 1 ELSE 0 END) as stuffed,
        SUM(CASE WHEN first_down_rush THEN 1 ELSE 0 END) as first_downs,
        SUM(CASE WHEN (raw_data->>'yardline_100')::float <= 20 THEN 1 ELSE 0 END) as rz_attempts
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
      });
    }

    // Get receiving first downs from play-by-play
    const recResult = await db.execute(sql`
      SELECT
        receiver_player_id,
        SUM(CASE WHEN first_down_pass AND complete_pass THEN 1 ELSE 0 END) as first_downs
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
  qbHits: number;
  scrambles: number;
  passFirstDowns: number;
  deepPassAttempts: number;
  totalAirYards: number;
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
        SUM(CASE WHEN (raw_data->>'qb_hit')::numeric > 0 THEN 1 ELSE 0 END) as qb_hits,
        SUM(CASE WHEN (raw_data->>'qb_scramble')::numeric > 0 THEN 1 ELSE 0 END) as scrambles,
        SUM(CASE WHEN first_down_pass THEN 1 ELSE 0 END) as pass_first_downs,
        SUM(CASE WHEN air_yards > 20 THEN 1 ELSE 0 END) as deep_pass_attempts,
        SUM(COALESCE(air_yards, 0)) as total_air_yards
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
        qbHits: Number(row.qb_hits) || 0,
        scrambles: Number(row.scrambles) || 0,
        passFirstDowns: Number(row.pass_first_downs) || 0,
        deepPassAttempts: Number(row.deep_pass_attempts) || 0,
        totalAirYards: Number(row.total_air_yards) || 0,
      });
    }
  } catch (e) {
    console.warn(`  Warning: Could not fetch QB play-by-play stats for week ${week}:`, e);
  }

  return qbStats;
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

    // RB Receiving efficiency
    const playerRecStats = recStats.get(row.player_id);
    const recFirstDowns = playerRecStats?.firstDowns || 0;
    const yacPerRec = receptions > 0 ? yac / receptions : null;
    const firstDownsPerRoute = routes !== null && routes > 0 ? recFirstDowns / routes : null;
    const fptsPerRoute = routes !== null && routes > 0 ? fpts.ppr / routes : null;

    // QB Efficiency from play-by-play
    const playerQbStats = qbStats.get(row.player_id);
    const passAttempts = Number(row.pass_attempts) || 0;
    const dropbacks = playerQbStats?.dropbacks || passAttempts;
    const cpoe = playerQbStats?.cpoe ?? null;
    const sacks = playerQbStats?.sacks || 0;
    const sackRate = dropbacks > 0 ? sacks / dropbacks : null;
    const qbHits = playerQbStats?.qbHits || 0;
    const qbHitRate = dropbacks > 0 ? qbHits / dropbacks : null;
    const scrambles = playerQbStats?.scrambles || 0;
    const passFirstDowns = playerQbStats?.passFirstDowns || 0;
    const passFirstDownRate = passAttempts > 0 ? passFirstDowns / passAttempts : null;
    const deepPassAttempts = playerQbStats?.deepPassAttempts || 0;
    const deepPassRate = passAttempts > 0 ? deepPassAttempts / passAttempts : null;
    const passAdot = passAttempts > 0 && playerQbStats?.totalAirYards
      ? playerQbStats.totalAirYards / passAttempts
      : null;

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
      // QB Efficiency
      cpoe,
      sacks,
      sackRate,
      qbHits,
      qbHitRate,
      scrambles,
      passFirstDowns,
      passFirstDownRate,
      deepPassAttempts,
      deepPassRate,
      passAdot,
      // Combined
      epaPerPlay,
      successRate: null, // Would need play-level data
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
        yac_per_rec, rec_first_downs, first_downs_per_route, fpts_per_route,
        catch_rate, yards_per_target, racr, wopr, slot_rate, inline_rate,
        cpoe, sacks, sack_rate, qb_hits, qb_hit_rate, scrambles,
        pass_first_downs, pass_first_down_rate, deep_pass_attempts, deep_pass_rate, pass_adot,
        epa_per_play, success_rate, fpts_std, fpts_half, fpts_ppr
      ) VALUES (
        ${snapshotId}, ${rec.season}, ${rec.week}, ${rec.playerId}, ${rec.playerName}, ${rec.teamId}, ${rec.position},
        ${rec.snaps}, ${rec.snapShare}, ${rec.routes}, ${rec.routeRate},
        ${rec.targets}, ${rec.targetShare}, ${rec.receptions}, ${rec.recYards}, ${rec.recTds},
        ${rec.adot}, ${rec.airYards}, ${rec.yac}, ${rec.tprr}, ${rec.yprr}, ${rec.epaPerTarget},
        ${rec.rushAttempts}, ${rec.rushYards}, ${rec.rushTds}, ${rec.yardsPerCarry}, ${rec.rushEpaPerPlay},
        ${rec.stuffed}, ${rec.stuffRate}, ${rec.rushFirstDowns}, ${rec.rushFirstDownRate}, ${rec.rzRushAttempts},
        ${rec.yacPerRec}, ${rec.recFirstDowns}, ${rec.firstDownsPerRoute}, ${rec.fptsPerRoute},
        ${rec.catchRate}, ${rec.yardsPerTarget}, ${rec.racr}, ${rec.wopr}, ${rec.slotRate}, ${rec.inlineRate},
        ${rec.cpoe}, ${rec.sacks}, ${rec.sackRate}, ${rec.qbHits}, ${rec.qbHitRate}, ${rec.scrambles},
        ${rec.passFirstDowns}, ${rec.passFirstDownRate}, ${rec.deepPassAttempts}, ${rec.deepPassRate}, ${rec.passAdot},
        ${rec.epaPerPlay}, ${rec.successRate}, ${rec.fptsStd}, ${rec.fptsHalf}, ${rec.fptsPpr}
      )
    `);
    inserted++;
  }

  return inserted;
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

// CLI entry point
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
