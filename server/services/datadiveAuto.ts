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

/**
 * Run auto weekly snapshot for a given season.
 * Looks at the latest snapped week and the latest week in weekly_stats.
 * If there's a newer week in weekly_stats, creates a snapshot for it.
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
