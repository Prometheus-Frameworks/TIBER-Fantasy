/**
 * Backfill GSIS IDs into player_identity_map
 * 
 * Strategy:
 * 1. Match weekly_stats.player_id (GSIS format 00-XXXXXXX) to nfl_data_py_id (if it starts with 00-)
 * 2. For records where nfl_data_py_id is not a GSIS ID, try joining on position + team to narrow matches
 * 3. Only update if exact 1 match found (no ambiguous matches)
 */

import { db } from '../infra/db';
import { sql } from 'drizzle-orm';

interface BackfillResult {
  success: boolean;
  totalWeeklyStatsPlayers: number;
  matchedViaNflDataPyId: number;
  alreadyHadGsisId: number;
  updated: number;
  errors: string[];
}

export async function backfillGsisIds(): Promise<BackfillResult> {
  const result: BackfillResult = {
    success: false,
    totalWeeklyStatsPlayers: 0,
    matchedViaNflDataPyId: 0,
    alreadyHadGsisId: 0,
    updated: 0,
    errors: []
  };

  try {
    // Strategy: The nfl_data_py_id in player_identity_map IS the GSIS ID for most players
    // We just need to copy it to the gsis_id column for skill position players
    
    // First, count how many already have gsis_id set
    const alreadySetResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM player_identity_map 
      WHERE gsis_id IS NOT NULL 
        AND position IN ('QB', 'RB', 'WR', 'TE')
        AND is_active = true
    `);
    result.alreadyHadGsisId = parseInt((alreadySetResult.rows[0] as any).count) || 0;

    // Copy nfl_data_py_id to gsis_id where nfl_data_py_id looks like a GSIS ID (format: 00-XXXXXXX)
    const updateResult = await db.execute(sql`
      UPDATE player_identity_map
      SET gsis_id = nfl_data_py_id
      WHERE nfl_data_py_id IS NOT NULL
        AND nfl_data_py_id LIKE '00-%'
        AND gsis_id IS NULL
        AND position IN ('QB', 'RB', 'WR', 'TE')
        AND is_active = true
    `);

    result.matchedViaNflDataPyId = (updateResult as any).rowCount || 0;
    result.updated = result.matchedViaNflDataPyId;

    // Get total weekly_stats distinct players for context
    const weeklyCountResult = await db.execute(sql`
      SELECT COUNT(DISTINCT player_id) as count
      FROM weekly_stats
      WHERE season = 2024
        AND player_id IS NOT NULL
        AND position IN ('QB', 'RB', 'WR', 'TE')
    `);
    result.totalWeeklyStatsPlayers = parseInt((weeklyCountResult.rows[0] as any).count) || 0;

    result.success = true;
    console.log(`[BackfillGSIS] Complete:`, result);
    return result;

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('[BackfillGSIS] Error:', error);
    return result;
  }
}

// Report current GSIS coverage
export async function reportGsisCoverage(): Promise<{
  activeSkillPlayers: number;
  withGsisId: number;
  gsisSkillCoveragePct: number;
  totalIdentityMapRows: number;
  totalWithAnyExternalId: number;
  sampleWithGsis: Array<{ canonical_id: string; full_name: string; gsis_id: string }>;
  sampleWithoutGsis: Array<{ canonical_id: string; full_name: string; position: string }>;
}> {
  // Active skill position players (QB, RB, WR, TE)
  const skillCountResult = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(gsis_id) as with_gsis
    FROM player_identity_map
    WHERE is_active = true
      AND position IN ('QB', 'RB', 'WR', 'TE')
  `);

  const skillRow = (skillCountResult.rows as any[])[0];
  const activeSkillPlayers = parseInt(skillRow.total) || 0;
  const withGsis = parseInt(skillRow.with_gsis) || 0;

  // Total identity map rows (all positions, all active/inactive)
  const totalResult = await db.execute(sql`
    SELECT 
      COUNT(*) as total_rows,
      COUNT(CASE WHEN sleeper_id IS NOT NULL OR gsis_id IS NOT NULL OR espn_id IS NOT NULL OR fantasy_data_id IS NOT NULL THEN 1 END) as with_any_external
    FROM player_identity_map
  `);

  const totalRow = (totalResult.rows as any[])[0];
  const totalIdentityMapRows = parseInt(totalRow.total_rows) || 0;
  const totalWithAnyExternalId = parseInt(totalRow.with_any_external) || 0;

  const sampleWithResult = await db.execute(sql`
    SELECT canonical_id, full_name, gsis_id
    FROM player_identity_map
    WHERE gsis_id IS NOT NULL
      AND is_active = true
    LIMIT 5
  `);

  const sampleWithoutResult = await db.execute(sql`
    SELECT canonical_id, full_name, position
    FROM player_identity_map
    WHERE gsis_id IS NULL
      AND is_active = true
      AND position IN ('QB', 'RB', 'WR', 'TE')
    LIMIT 10
  `);

  return {
    activeSkillPlayers,
    withGsisId: withGsis,
    gsisSkillCoveragePct: activeSkillPlayers > 0 ? Math.round((withGsis / activeSkillPlayers) * 10000) / 100 : 0,
    totalIdentityMapRows,
    totalWithAnyExternalId,
    sampleWithGsis: sampleWithResult.rows as any[],
    sampleWithoutGsis: sampleWithoutResult.rows as any[]
  };
}

