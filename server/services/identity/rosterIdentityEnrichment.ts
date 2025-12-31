/**
 * Roster Identity Enrichment Service v1
 * Auto-populates missing player_identity_map.sleeper_id for players in synced league rosters
 */

import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';

interface SleeperPlayerData {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  gsis_id?: string;
  sportradar_id?: string;
  fantasy_data_id?: number;
  rotowire_id?: number;
  status: string;
  age?: number;
  college?: string;
  years_exp?: number;
}

interface EnrichmentResult {
  success: boolean;
  leagueId: string | null;
  attempted: number;
  matched: number;
  ambiguous: number;
  unmapped: number;
  updatedRows: number;
  newRosterBridgeCoverage: number;
  error?: string;
}

// In-memory cache for Sleeper players (24h TTL)
let sleeperPlayersCache: { data: Record<string, SleeperPlayerData>; timestamp: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function fetchSleeperPlayers(): Promise<Record<string, SleeperPlayerData>> {
  // Check cache first
  if (sleeperPlayersCache && Date.now() - sleeperPlayersCache.timestamp < CACHE_TTL_MS) {
    console.log(`[EnrichmentService] Using cached Sleeper players (${Object.keys(sleeperPlayersCache.data).length} players)`);
    return sleeperPlayersCache.data;
  }
  
  console.log('[EnrichmentService] Fetching fresh Sleeper player database...');
  
  try {
    const response = await fetch('https://api.sleeper.app/v1/players/nfl', {
      headers: {
        'User-Agent': 'Tiber-Fantasy/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Sleeper API error: ${response.status}`);
    }
    
    const players = await response.json() as Record<string, SleeperPlayerData>;
    
    // Update cache
    sleeperPlayersCache = {
      data: players,
      timestamp: Date.now()
    };
    
    console.log(`[EnrichmentService] Cached ${Object.keys(players).length} Sleeper players`);
    return players;
    
  } catch (error: any) {
    console.error('[EnrichmentService] Failed to fetch Sleeper players:', error);
    throw error;
  }
}

function normalizeNameForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // Remove non-letters except spaces
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim();
}

async function findCanonicalMatch(
  sleeperPlayer: SleeperPlayerData
): Promise<{ canonicalId: string; confidence: 'exact' | 'high' | 'medium' } | null> {
  const { full_name, position, team, gsis_id, sportradar_id, fantasy_data_id } = sleeperPlayer;
  
  // Strategy 1: Match by GSIS ID (most reliable)
  if (gsis_id) {
    const gsisResult = await db.execute(sql`
      SELECT canonical_id FROM player_identity_map
      WHERE canonical_id LIKE '%' || ${gsis_id} || '%'
        OR nfl_data_py_id = ${gsis_id}
      LIMIT 1
    `);
    
    if ((gsisResult.rows as any[]).length > 0) {
      return { canonicalId: (gsisResult.rows[0] as any).canonical_id, confidence: 'exact' };
    }
  }
  
  // Strategy 2: Match by FantasyData ID
  if (fantasy_data_id) {
    const fdResult = await db.execute(sql`
      SELECT canonical_id FROM player_identity_map
      WHERE fantasy_data_id = ${String(fantasy_data_id)}
      LIMIT 1
    `);
    
    if ((fdResult.rows as any[]).length > 0) {
      return { canonicalId: (fdResult.rows[0] as any).canonical_id, confidence: 'exact' };
    }
  }
  
  // Strategy 3: Match by exact name + position + team
  if (full_name && position && team) {
    const namePositionTeamResult = await db.execute(sql`
      SELECT canonical_id FROM player_identity_map
      WHERE LOWER(full_name) = LOWER(${full_name})
        AND position = ${position}
        AND nfl_team = ${team}
        AND sleeper_id IS NULL
      LIMIT 2
    `);
    
    const rows = namePositionTeamResult.rows as any[];
    if (rows.length === 1) {
      return { canonicalId: rows[0].canonical_id, confidence: 'high' };
    }
    // If more than 1, it's ambiguous - skip
  }
  
  // Strategy 4: Match by exact name + position (if team is null/different)
  if (full_name && position) {
    const normalizedName = normalizeNameForMatching(full_name);
    
    const namePositionResult = await db.execute(sql`
      SELECT canonical_id FROM player_identity_map
      WHERE (
        LOWER(full_name) = LOWER(${full_name})
        OR name_fingerprint = ${normalizedName}
      )
        AND position = ${position}
        AND sleeper_id IS NULL
      LIMIT 2
    `);
    
    const rows = namePositionResult.rows as any[];
    if (rows.length === 1) {
      return { canonicalId: rows[0].canonical_id, confidence: 'medium' };
    }
  }
  
  return null;
}

export async function enrichRosterIdentities(userId: string = 'default_user'): Promise<EnrichmentResult> {
  try {
    console.log(`[EnrichmentService] Starting enrichment for user: ${userId}`);
    
    // 1. Get active league
    const prefResult = await db.execute(sql`
      SELECT ulp.active_league_id, l.league_id_external, l.league_name
      FROM user_league_preferences ulp
      JOIN leagues l ON l.id = ulp.active_league_id
      WHERE ulp.user_id = ${userId}
      LIMIT 1
    `);
    
    const pref = (prefResult.rows as any[])[0];
    if (!pref?.active_league_id) {
      return {
        success: false,
        leagueId: null,
        attempted: 0,
        matched: 0,
        ambiguous: 0,
        unmapped: 0,
        updatedRows: 0,
        newRosterBridgeCoverage: 0,
        error: 'No active league found'
      };
    }
    
    const leagueId = pref.active_league_id;
    
    // 2. Get unmapped Sleeper IDs from rosters
    const unmappedResult = await db.execute(sql`
      WITH roster_ids AS (
        SELECT DISTINCT jsonb_array_elements_text(players) as sleeper_id
        FROM league_teams
        WHERE league_id = ${leagueId}
          AND players IS NOT NULL
      )
      SELECT r.sleeper_id
      FROM roster_ids r
      LEFT JOIN player_identity_map p ON p.sleeper_id = r.sleeper_id
      WHERE p.sleeper_id IS NULL
    `);
    
    const unmappedSleeperIds = (unmappedResult.rows as any[]).map(r => r.sleeper_id);
    console.log(`[EnrichmentService] Found ${unmappedSleeperIds.length} unmapped Sleeper IDs`);
    
    if (unmappedSleeperIds.length === 0) {
      // Calculate current coverage
      const coverageResult = await db.execute(sql`
        WITH roster_ids AS (
          SELECT DISTINCT jsonb_array_elements_text(players) as sleeper_id
          FROM league_teams WHERE league_id = ${leagueId}
        )
        SELECT 
          COUNT(*) as total,
          COUNT(p.canonical_id) as mapped
        FROM roster_ids r
        LEFT JOIN player_identity_map p ON p.sleeper_id = r.sleeper_id
      `);
      
      const cr = (coverageResult.rows as any[])[0];
      const coverage = cr.total > 0 ? cr.mapped / cr.total : 1;
      
      return {
        success: true,
        leagueId,
        attempted: 0,
        matched: 0,
        ambiguous: 0,
        unmapped: 0,
        updatedRows: 0,
        newRosterBridgeCoverage: Math.round(coverage * 100) / 100
      };
    }
    
    // 3. Fetch Sleeper player database (cached)
    const sleeperPlayers = await fetchSleeperPlayers();
    
    let attempted = 0;
    let matched = 0;
    let ambiguous = 0;
    let unmapped = 0;
    let updatedRows = 0;
    
    // 4. Process each unmapped Sleeper ID
    for (const sleeperId of unmappedSleeperIds) {
      attempted++;
      
      const sleeperPlayer = sleeperPlayers[sleeperId];
      if (!sleeperPlayer) {
        // Player not in Sleeper database (may be retired/removed)
        await upsertUnmapped(sleeperId, {
          fullName: `Unknown (${sleeperId})`,
          position: null,
          team: null,
          statusReason: 'not_in_sleeper_db',
          rawJson: null
        });
        unmapped++;
        continue;
      }
      
      // Try to match to canonical
      const match = await findCanonicalMatch(sleeperPlayer);
      
      if (match) {
        // Update player_identity_map with sleeper_id
        await db.execute(sql`
          UPDATE player_identity_map
          SET sleeper_id = ${sleeperId},
              updated_at = NOW()
          WHERE canonical_id = ${match.canonicalId}
            AND sleeper_id IS NULL
        `);
        
        matched++;
        updatedRows++;
        console.log(`[EnrichmentService] Matched ${sleeperPlayer.full_name} -> ${match.canonicalId} (${match.confidence})`);
      } else {
        // Store as unmapped
        await upsertUnmapped(sleeperId, {
          fullName: sleeperPlayer.full_name || `Unknown (${sleeperId})`,
          position: sleeperPlayer.position || null,
          team: sleeperPlayer.team || null,
          statusReason: 'no_match',
          rawJson: sleeperPlayer
        });
        unmapped++;
      }
    }
    
    // 5. Calculate new coverage
    const coverageResult = await db.execute(sql`
      WITH roster_ids AS (
        SELECT DISTINCT jsonb_array_elements_text(players) as sleeper_id
        FROM league_teams WHERE league_id = ${leagueId}
      )
      SELECT 
        COUNT(*) as total,
        COUNT(p.canonical_id) as mapped
      FROM roster_ids r
      LEFT JOIN player_identity_map p ON p.sleeper_id = r.sleeper_id
    `);
    
    const cr = (coverageResult.rows as any[])[0];
    const newCoverage = cr.total > 0 ? cr.mapped / cr.total : 0;
    
    console.log(`[EnrichmentService] Complete: ${matched} matched, ${ambiguous} ambiguous, ${unmapped} unmapped`);
    console.log(`[EnrichmentService] New coverage: ${Math.round(newCoverage * 100)}%`);
    
    return {
      success: true,
      leagueId,
      attempted,
      matched,
      ambiguous,
      unmapped,
      updatedRows,
      newRosterBridgeCoverage: Math.round(newCoverage * 100) / 100
    };
    
  } catch (error: any) {
    console.error('[EnrichmentService] Error:', error);
    return {
      success: false,
      leagueId: null,
      attempted: 0,
      matched: 0,
      ambiguous: 0,
      unmapped: 0,
      updatedRows: 0,
      newRosterBridgeCoverage: 0,
      error: error.message || 'Enrichment failed'
    };
  }
}

async function upsertUnmapped(sleeperId: string, data: {
  fullName: string;
  position: string | null;
  team: string | null;
  statusReason: string;
  rawJson: any;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO unmapped_sleeper_players (sleeper_id, full_name, position, team, status_reason, raw_json, first_seen_at, last_seen_at)
    VALUES (
      ${sleeperId},
      ${data.fullName},
      ${data.position},
      ${data.team},
      ${data.statusReason},
      ${data.rawJson ? JSON.stringify(data.rawJson) : null}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (sleeper_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      position = EXCLUDED.position,
      team = EXCLUDED.team,
      status_reason = EXCLUDED.status_reason,
      raw_json = EXCLUDED.raw_json,
      last_seen_at = NOW()
  `);
}
