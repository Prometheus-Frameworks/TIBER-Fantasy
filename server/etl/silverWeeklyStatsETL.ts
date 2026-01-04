/**
 * Silver Layer ETL: bronze_nflfastr_plays → silver_player_weekly_stats
 *
 * Aggregates play-by-play data from the Bronze layer into weekly player stats.
 *
 * Metrics aggregated:
 * - Passing: attempts, completions, yards, TDs, INTs, EPA
 * - Receiving: targets, receptions, yards, TDs, air_yards, YAC, EPA
 * - Rushing: attempts, yards, TDs, EPA
 *
 * Usage:
 *   npx tsx server/etl/silverWeeklyStatsETL.ts [season] [startWeek] [endWeek]
 *   npx tsx server/etl/silverWeeklyStatsETL.ts 2025           # All available weeks
 *   npx tsx server/etl/silverWeeklyStatsETL.ts 2025 1 17      # Weeks 1-17
 */

import { db } from '../infra/db';
import { sql, eq, and } from 'drizzle-orm';
import { silverPlayerWeeklyStats, bronzeNflfastrPlays } from '@shared/schema';

interface PlayerWeekStats {
  playerId: string;
  playerName: string;
  position: string | null;
  team: string | null;
  season: number;
  week: number;

  // Passing
  passAttempts: number;
  completions: number;
  passingYards: number;
  passingTds: number;
  interceptions: number;
  passingEpa: number;

  // Receiving
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  receivingEpa: number;
  airYards: number;
  yac: number;

  // Rushing
  rushAttempts: number;
  rushingYards: number;
  rushingTds: number;
  rushingEpa: number;
}

async function getAvailableWeeks(season: number): Promise<number[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT week
    FROM bronze_nflfastr_plays
    WHERE season = ${season}
    ORDER BY week
  `);
  return (result.rows as any[]).map(r => r.week);
}

async function aggregateWeek(season: number, week: number): Promise<PlayerWeekStats[]> {
  console.log(`  Aggregating week ${week}...`);

  // Aggregate passing stats
  const passingResult = await db.execute(sql`
    SELECT
      passer_player_id as player_id,
      passer_player_name as player_name,
      posteam as team,
      COUNT(*) FILTER (WHERE play_type = 'pass') as pass_attempts,
      COUNT(*) FILTER (WHERE complete_pass = true) as completions,
      COALESCE(SUM(yards_gained) FILTER (WHERE play_type = 'pass'), 0) as passing_yards,
      COUNT(*) FILTER (WHERE touchdown = true AND play_type = 'pass') as passing_tds,
      COUNT(*) FILTER (WHERE interception = true) as interceptions,
      COALESCE(SUM(epa) FILTER (WHERE play_type = 'pass'), 0) as passing_epa
    FROM bronze_nflfastr_plays
    WHERE season = ${season}
      AND week = ${week}
      AND passer_player_id IS NOT NULL
      AND passer_player_id != ''
    GROUP BY passer_player_id, passer_player_name, posteam
  `);

  // Aggregate receiving stats
  const receivingResult = await db.execute(sql`
    SELECT
      receiver_player_id as player_id,
      receiver_player_name as player_name,
      posteam as team,
      COUNT(*) as targets,
      COUNT(*) FILTER (WHERE complete_pass = true) as receptions,
      COALESCE(SUM(yards_gained) FILTER (WHERE complete_pass = true), 0) as receiving_yards,
      COUNT(*) FILTER (WHERE touchdown = true AND complete_pass = true) as receiving_tds,
      COALESCE(SUM(epa), 0) as receiving_epa,
      COALESCE(SUM(air_yards), 0) as air_yards,
      COALESCE(SUM(yards_after_catch), 0) as yac
    FROM bronze_nflfastr_plays
    WHERE season = ${season}
      AND week = ${week}
      AND receiver_player_id IS NOT NULL
      AND receiver_player_id != ''
    GROUP BY receiver_player_id, receiver_player_name, posteam
  `);

  // Aggregate rushing stats
  const rushingResult = await db.execute(sql`
    SELECT
      rusher_player_id as player_id,
      rusher_player_name as player_name,
      posteam as team,
      COUNT(*) as rush_attempts,
      COALESCE(SUM(yards_gained), 0) as rushing_yards,
      COUNT(*) FILTER (WHERE touchdown = true) as rushing_tds,
      COALESCE(SUM(epa), 0) as rushing_epa
    FROM bronze_nflfastr_plays
    WHERE season = ${season}
      AND week = ${week}
      AND rusher_player_id IS NOT NULL
      AND rusher_player_id != ''
      AND play_type = 'run'
    GROUP BY rusher_player_id, rusher_player_name, posteam
  `);

  // Merge all stats by player
  const playerMap = new Map<string, PlayerWeekStats>();

  const initPlayer = (playerId: string, playerName: string, team: string | null): PlayerWeekStats => ({
    playerId,
    playerName,
    position: null, // Will be enriched later from identity map
    team,
    season,
    week,
    passAttempts: 0,
    completions: 0,
    passingYards: 0,
    passingTds: 0,
    interceptions: 0,
    passingEpa: 0,
    targets: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTds: 0,
    receivingEpa: 0,
    airYards: 0,
    yac: 0,
    rushAttempts: 0,
    rushingYards: 0,
    rushingTds: 0,
    rushingEpa: 0,
  });

  // Add passing stats
  for (const row of passingResult.rows as any[]) {
    const player = playerMap.get(row.player_id) || initPlayer(row.player_id, row.player_name, row.team);
    player.passAttempts = Number(row.pass_attempts) || 0;
    player.completions = Number(row.completions) || 0;
    player.passingYards = Number(row.passing_yards) || 0;
    player.passingTds = Number(row.passing_tds) || 0;
    player.interceptions = Number(row.interceptions) || 0;
    player.passingEpa = Number(row.passing_epa) || 0;
    playerMap.set(row.player_id, player);
  }

  // Add receiving stats
  for (const row of receivingResult.rows as any[]) {
    const player = playerMap.get(row.player_id) || initPlayer(row.player_id, row.player_name, row.team);
    player.targets = Number(row.targets) || 0;
    player.receptions = Number(row.receptions) || 0;
    player.receivingYards = Number(row.receiving_yards) || 0;
    player.receivingTds = Number(row.receiving_tds) || 0;
    player.receivingEpa = Number(row.receiving_epa) || 0;
    player.airYards = Number(row.air_yards) || 0;
    player.yac = Number(row.yac) || 0;
    if (!player.team) player.team = row.team;
    playerMap.set(row.player_id, player);
  }

  // Add rushing stats
  for (const row of rushingResult.rows as any[]) {
    const player = playerMap.get(row.player_id) || initPlayer(row.player_id, row.player_name, row.team);
    player.rushAttempts = Number(row.rush_attempts) || 0;
    player.rushingYards = Number(row.rushing_yards) || 0;
    player.rushingTds = Number(row.rushing_tds) || 0;
    player.rushingEpa = Number(row.rushing_epa) || 0;
    if (!player.team) player.team = row.team;
    playerMap.set(row.player_id, player);
  }

  // Enrich with positions from identity map
  const playerIds = Array.from(playerMap.keys());
  if (playerIds.length > 0) {
    // Build IN clause with escaped strings
    const escaped = playerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ');
    const positions = await db.execute(
      sql.raw(`SELECT gsis_id, position FROM player_identity_map WHERE gsis_id IN (${escaped})`)
    );

    for (const row of positions.rows as any[]) {
      const player = playerMap.get(row.gsis_id);
      if (player) {
        player.position = row.position;
      }
    }
  }

  return Array.from(playerMap.values());
}

async function upsertWeekStats(stats: PlayerWeekStats[]): Promise<number> {
  if (stats.length === 0) return 0;

  let upserted = 0;
  const chunkSize = 50;

  for (let i = 0; i < stats.length; i += chunkSize) {
    const chunk = stats.slice(i, i + chunkSize);

    for (const stat of chunk) {
      await db
        .insert(silverPlayerWeeklyStats)
        .values({
          playerId: stat.playerId,
          playerName: stat.playerName,
          position: stat.position,
          team: stat.team,
          season: stat.season,
          week: stat.week,
          passAttempts: stat.passAttempts,
          completions: stat.completions,
          passingYards: stat.passingYards,
          passingTds: stat.passingTds,
          interceptions: stat.interceptions,
          passingEpa: stat.passingEpa,
          targets: stat.targets,
          receptions: stat.receptions,
          receivingYards: stat.receivingYards,
          receivingTds: stat.receivingTds,
          receivingEpa: stat.receivingEpa,
          airYards: stat.airYards,
          yac: stat.yac,
          rushAttempts: stat.rushAttempts,
          rushingYards: stat.rushingYards,
          rushingTds: stat.rushingTds,
          rushingEpa: stat.rushingEpa,
        })
        .onConflictDoUpdate({
          target: [
            silverPlayerWeeklyStats.playerId,
            silverPlayerWeeklyStats.season,
            silverPlayerWeeklyStats.week,
          ],
          set: {
            playerName: stat.playerName,
            position: stat.position,
            team: stat.team,
            passAttempts: stat.passAttempts,
            completions: stat.completions,
            passingYards: stat.passingYards,
            passingTds: stat.passingTds,
            interceptions: stat.interceptions,
            passingEpa: stat.passingEpa,
            targets: stat.targets,
            receptions: stat.receptions,
            receivingYards: stat.receivingYards,
            receivingTds: stat.receivingTds,
            receivingEpa: stat.receivingEpa,
            airYards: stat.airYards,
            yac: stat.yac,
            rushAttempts: stat.rushAttempts,
            rushingYards: stat.rushingYards,
            rushingTds: stat.rushingTds,
            rushingEpa: stat.rushingEpa,
            updatedAt: new Date(),
          },
        });
      upserted++;
    }
  }

  return upserted;
}

async function runSilverETL(season: number, startWeek?: number, endWeek?: number): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SILVER LAYER ETL: bronze_nflfastr_plays → silver_player_weekly_stats`);
  console.log(`Season: ${season}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get available weeks from bronze
  const availableWeeks = await getAvailableWeeks(season);
  console.log(`Available weeks in bronze: ${availableWeeks.join(', ')}`);

  // Filter to requested range
  let weeksToProcess = availableWeeks;
  if (startWeek !== undefined) {
    weeksToProcess = weeksToProcess.filter(w => w >= startWeek);
  }
  if (endWeek !== undefined) {
    weeksToProcess = weeksToProcess.filter(w => w <= endWeek);
  }

  console.log(`Weeks to process: ${weeksToProcess.join(', ')}\n`);

  let totalPlayers = 0;
  const weekSummary: { week: number; players: number }[] = [];

  for (const week of weeksToProcess) {
    const stats = await aggregateWeek(season, week);
    const upserted = await upsertWeekStats(stats);
    totalPlayers += upserted;
    weekSummary.push({ week, players: upserted });
    console.log(`  Week ${week}: ${upserted} players processed`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SILVER ETL COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total weeks processed: ${weeksToProcess.length}`);
  console.log(`Total player-weeks upserted: ${totalPlayers}`);
  console.log(`\nWeek summary:`);
  for (const { week, players } of weekSummary) {
    console.log(`  Week ${week}: ${players} players`);
  }

  // Verify final counts
  const finalCount = await db.execute(sql`
    SELECT COUNT(*) as total, COUNT(DISTINCT player_id) as players, MIN(week) as min_week, MAX(week) as max_week
    FROM silver_player_weekly_stats
    WHERE season = ${season}
  `);
  const row = (finalCount.rows as any[])[0];
  console.log(`\nFinal silver_player_weekly_stats state for ${season}:`);
  console.log(`  Total rows: ${row.total}`);
  console.log(`  Unique players: ${row.players}`);
  console.log(`  Week range: ${row.min_week} - ${row.max_week}`);
}

// CLI entry point
const args = process.argv.slice(2);
const season = parseInt(args[0]) || 2025;
const startWeek = args[1] ? parseInt(args[1]) : undefined;
const endWeek = args[2] ? parseInt(args[2]) : undefined;

runSilverETL(season, startWeek, endWeek)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Silver ETL failed:', err);
    process.exit(1);
  });
