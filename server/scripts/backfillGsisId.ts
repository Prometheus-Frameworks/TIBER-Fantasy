/**
 * Backfill GSIS IDs into player_identity_map
 * 
 * Strategy:
 * 1. Get distinct player_id from weekly_stats (these are GSIS IDs)
 * 2. Match to player_identity_map via nameFingerprint + position + team
 * 3. Secondary: nameFingerprint + position only (for FA/traded players)
 * 4. Only update if exact 1 match found (no ambiguous matches)
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

interface WeeklyStatsPlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
}

interface BackfillResult {
  success: boolean;
  totalWeeklyStatsPlayers: number;
  matchedViaNamePosTeam: number;
  matchedViaNamePos: number;
  ambiguousSkipped: number;
  noMatchFound: number;
  alreadyHadGsisId: number;
  updated: number;
  errors: string[];
}

function normalizeNameFingerprint(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function backfillGsisIds(): Promise<BackfillResult> {
  const result: BackfillResult = {
    success: false,
    totalWeeklyStatsPlayers: 0,
    matchedViaNamePosTeam: 0,
    matchedViaNamePos: 0,
    ambiguousSkipped: 0,
    noMatchFound: 0,
    alreadyHadGsisId: 0,
    updated: 0,
    errors: []
  };

  try {
    // Get distinct players from weekly_stats (2024 season for most recent data)
    const weeklyPlayers = await db.execute<WeeklyStatsPlayer>(sql`
      SELECT DISTINCT ON (player_id)
        player_id,
        player_name,
        position,
        team
      FROM weekly_stats
      WHERE season = 2024
        AND player_id IS NOT NULL
        AND player_name IS NOT NULL
        AND position IN ('QB', 'RB', 'WR', 'TE')
      ORDER BY player_id, week DESC
    `);

    result.totalWeeklyStatsPlayers = weeklyPlayers.rows.length;
    console.log(`[BackfillGSIS] Found ${result.totalWeeklyStatsPlayers} distinct players in weekly_stats`);

    for (const player of weeklyPlayers.rows as WeeklyStatsPlayer[]) {
      const nameFingerprint = normalizeNameFingerprint(player.player_name);
      
      // Strategy 1: Match via nameFingerprint + position + team
      const exactMatch = await db.execute(sql`
        SELECT canonical_id, full_name, gsis_id
        FROM player_identity_map
        WHERE name_fingerprint = ${nameFingerprint}
          AND position = ${player.position}
          AND nfl_team = ${player.team}
          AND is_active = true
      `);

      if (exactMatch.rows.length === 1) {
        const row = exactMatch.rows[0] as any;
        if (row.gsis_id) {
          result.alreadyHadGsisId++;
          continue;
        }
        
        // Update with GSIS ID
        await db.execute(sql`
          UPDATE player_identity_map
          SET gsis_id = ${player.player_id}
          WHERE canonical_id = ${row.canonical_id}
        `);
        result.matchedViaNamePosTeam++;
        result.updated++;
        continue;
      }

      if (exactMatch.rows.length > 1) {
        result.ambiguousSkipped++;
        result.errors.push(`Ambiguous: ${player.player_name} (${player.position}/${player.team}) matched ${exactMatch.rows.length} rows`);
        continue;
      }

      // Strategy 2: Match via nameFingerprint + position only (fallback for FA/traded)
      const posMatch = await db.execute(sql`
        SELECT canonical_id, full_name, nfl_team, gsis_id
        FROM player_identity_map
        WHERE name_fingerprint = ${nameFingerprint}
          AND position = ${player.position}
          AND is_active = true
      `);

      if (posMatch.rows.length === 1) {
        const row = posMatch.rows[0] as any;
        if (row.gsis_id) {
          result.alreadyHadGsisId++;
          continue;
        }
        
        // Update with GSIS ID
        await db.execute(sql`
          UPDATE player_identity_map
          SET gsis_id = ${player.player_id}
          WHERE canonical_id = ${row.canonical_id}
        `);
        result.matchedViaNamePos++;
        result.updated++;
        continue;
      }

      if (posMatch.rows.length > 1) {
        result.ambiguousSkipped++;
        result.errors.push(`Ambiguous (pos-only): ${player.player_name} (${player.position}) matched ${posMatch.rows.length} rows`);
        continue;
      }

      // No match found
      result.noMatchFound++;
    }

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
  totalActive: number;
  withGsisId: number;
  coveragePct: number;
  sampleWithGsis: Array<{ canonical_id: string; full_name: string; gsis_id: string }>;
  sampleWithoutGsis: Array<{ canonical_id: string; full_name: string; position: string }>;
}> {
  const countResult = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(gsis_id) as with_gsis
    FROM player_identity_map
    WHERE is_active = true
      AND position IN ('QB', 'RB', 'WR', 'TE')
  `);

  const row = (countResult.rows as any[])[0];
  const total = parseInt(row.total) || 0;
  const withGsis = parseInt(row.with_gsis) || 0;

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
    totalActive: total,
    withGsisId: withGsis,
    coveragePct: total > 0 ? Math.round((withGsis / total) * 10000) / 100 : 0,
    sampleWithGsis: sampleWithResult.rows as any[],
    sampleWithoutGsis: sampleWithoutResult.rows as any[]
  };
}

// CLI runner
if (require.main === module) {
  (async () => {
    console.log('[BackfillGSIS] Starting backfill...');
    const result = await backfillGsisIds();
    console.log('[BackfillGSIS] Result:', JSON.stringify(result, null, 2));
    
    console.log('\n[BackfillGSIS] Coverage report:');
    const coverage = await reportGsisCoverage();
    console.log(JSON.stringify(coverage, null, 2));
    
    process.exit(result.success ? 0 : 1);
  })();
}
