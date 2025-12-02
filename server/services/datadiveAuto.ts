/**
 * Datadive Auto Snapshot v1.0
 * 
 * Auto-snapshot functionality for Tuesday morning runs.
 * Looks at what weeks are already snapped, compares to weekly_stats,
 * and creates a new snapshot for any newer week.
 */

import { db } from '../infra/db';
import { sql } from 'drizzle-orm';
import { datadiveSnapshotService } from './datadiveSnapshot';

export interface AutoSnapshotResult {
  season: number;
  week: number;
  snapshotId: number;
}

const MIN_ROWS_FOR_SNAPSHOT = 200;
const MIN_TEAMS_FOR_SNAPSHOT = 28;

export interface DatasetValidation {
  rowCount: number;
  teamCount: number;
  nullIdCount: number;
  isValid: boolean;
  reason?: string;
}

/**
 * Validate that a week has enough data to be snapshotted.
 * Checks: min 200 rows, at least 28 teams, no null player IDs.
 */
async function validateWeekData(season: number, week: number): Promise<DatasetValidation> {
  const validationRes = await db.execute(sql`
    SELECT 
      COUNT(*) AS row_count,
      COUNT(DISTINCT team) AS team_count,
      COUNT(*) FILTER (WHERE player_id IS NULL) AS null_id_count
    FROM weekly_stats
    WHERE season = ${season} AND week = ${week};
  `);
  
  const row = (validationRes as any).rows[0];
  const rowCount = Number(row?.row_count) || 0;
  const teamCount = Number(row?.team_count) || 0;
  const nullIdCount = Number(row?.null_id_count) || 0;
  
  if (rowCount < MIN_ROWS_FOR_SNAPSHOT) {
    return { rowCount, teamCount, nullIdCount, isValid: false, reason: `Row count ${rowCount} < ${MIN_ROWS_FOR_SNAPSHOT}` };
  }
  if (teamCount < MIN_TEAMS_FOR_SNAPSHOT) {
    return { rowCount, teamCount, nullIdCount, isValid: false, reason: `Team count ${teamCount} < ${MIN_TEAMS_FOR_SNAPSHOT}` };
  }
  if (nullIdCount > 0) {
    return { rowCount, teamCount, nullIdCount, isValid: false, reason: `Found ${nullIdCount} rows with null player_id` };
  }
  
  return { rowCount, teamCount, nullIdCount, isValid: true };
}

/**
 * Run auto weekly snapshot for a given season.
 * Looks at the latest snapped week and the latest week in weekly_stats.
 * If there's a newer week in weekly_stats AND it passes validation, creates a snapshot for it.
 * 
 * @param season The NFL season year (e.g., 2025)
 * @returns The snapshot result if a new snapshot was created, null if no new week found
 */
export async function runAutoWeeklySnapshotForSeason(season: number): Promise<AutoSnapshotResult | null> {
  console.log(`[DATADIVE/AUTO] Checking for new weeks to snapshot for season ${season}...`);
  
  const snapRes = await db.execute(sql`
    SELECT COALESCE(MAX(week), 0) AS last_snapped_week
    FROM datadive_snapshot_meta
    WHERE season = ${season} AND is_official = TRUE;
  `);
  const lastSnappedWeek = Number((snapRes as any).rows[0]?.last_snapped_week) || 0;
  
  const statsRes = await db.execute(sql`
    SELECT COALESCE(MAX(week), 0) AS latest_stats_week
    FROM weekly_stats
    WHERE season = ${season};
  `);
  const latestStatsWeek = Number((statsRes as any).rows[0]?.latest_stats_week) || 0;
  
  console.log(`[DATADIVE/AUTO] Season ${season}: lastSnappedWeek=${lastSnappedWeek}, latestStatsWeek=${latestStatsWeek}`);
  
  if (latestStatsWeek === 0) {
    throw new Error(`[DATADIVE/AUTO] No weekly_stats rows found for season ${season}`);
  }
  
  if (latestStatsWeek <= lastSnappedWeek) {
    console.log(`[DATADIVE/AUTO] No new weeks to snapshot. last_snapped_week=${lastSnappedWeek}, latest_stats_week=${latestStatsWeek}`);
    return null;
  }
  
  const targetWeek = latestStatsWeek;
  
  // Validate dataset completeness before snapshotting
  const validation = await validateWeekData(season, targetWeek);
  console.log(`[DATADIVE/AUTO] Week ${targetWeek} validation: rows=${validation.rowCount}, teams=${validation.teamCount}, nullIds=${validation.nullIdCount}`);
  
  if (!validation.isValid) {
    throw new Error(`[DATADIVE/AUTO] Week ${targetWeek} failed validation: ${validation.reason}`);
  }
  
  console.log(`[DATADIVE/AUTO] Creating snapshot for season ${season}, week ${targetWeek}`);
  const result = await datadiveSnapshotService.runWeeklySnapshot(
    season,
    targetWeek,
    'v1',
    'auto'
  );
  
  console.log(`[DATADIVE/AUTO] Snapshot complete (id=${result.snapshotId})`);
  
  return {
    season,
    week: targetWeek,
    snapshotId: result.snapshotId,
  };
}

/**
 * Get the current auto-snapshot status for a season.
 * Returns info about what's snapped and what's available to snap.
 */
export async function getAutoSnapshotStatus(season: number): Promise<{
  season: number;
  lastSnappedWeek: number;
  latestStatsWeek: number;
  newWeekAvailable: boolean;
}> {
  const snapRes = await db.execute(sql`
    SELECT COALESCE(MAX(week), 0) AS last_snapped_week
    FROM datadive_snapshot_meta
    WHERE season = ${season} AND is_official = TRUE;
  `);
  const lastSnappedWeek = Number((snapRes as any).rows[0]?.last_snapped_week) || 0;
  
  const statsRes = await db.execute(sql`
    SELECT COALESCE(MAX(week), 0) AS latest_stats_week
    FROM weekly_stats
    WHERE season = ${season};
  `);
  const latestStatsWeek = Number((statsRes as any).rows[0]?.latest_stats_week) || 0;
  
  return {
    season,
    lastSnappedWeek,
    latestStatsWeek,
    newWeekAvailable: latestStatsWeek > lastSnappedWeek,
  };
}

export default {
  runAutoWeeklySnapshotForSeason,
  getAutoSnapshotStatus,
};
