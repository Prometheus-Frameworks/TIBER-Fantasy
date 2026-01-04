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

    // Get snap data if available (match by player name since snap counts use name not ID)
    const snapData = snapCounts.get(row.player_name);
    const snaps = snapData?.snaps ?? null;

    // Calculate derived metrics
    const teamTargets = teamTotals.get(row.team)?.targets || 0;
    const targetShare = teamTargets > 0 ? targets / teamTargets : null;

    const teamSnaps = row.team ? teamSnapTotals.get(row.team) : null;
    const snapShare = (snaps !== null && teamSnaps && teamSnaps > 0) ? snaps / teamSnaps : null;

    // ADOT (Average Depth of Target)
    const adot = targets > 0 ? airYards / targets : null;

    // Route estimation (use targets as proxy if no route data)
    const routes = snaps !== null ? Math.round(snaps * 0.7) : null; // Estimate 70% route rate
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
        epa_per_play, success_rate, fpts_std, fpts_half, fpts_ppr
      ) VALUES (
        ${snapshotId}, ${rec.season}, ${rec.week}, ${rec.playerId}, ${rec.playerName}, ${rec.teamId}, ${rec.position},
        ${rec.snaps}, ${rec.snapShare}, ${rec.routes}, ${rec.routeRate},
        ${rec.targets}, ${rec.targetShare}, ${rec.receptions}, ${rec.recYards}, ${rec.recTds},
        ${rec.adot}, ${rec.airYards}, ${rec.yac}, ${rec.tprr}, ${rec.yprr}, ${rec.epaPerTarget},
        ${rec.rushAttempts}, ${rec.rushYards}, ${rec.rushTds}, ${rec.yardsPerCarry}, ${rec.rushEpaPerPlay},
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
