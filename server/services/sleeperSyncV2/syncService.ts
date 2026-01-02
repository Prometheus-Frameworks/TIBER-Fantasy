/**
 * Sleeper Sync V2 Service
 * Main orchestrator for roster synchronization with idempotent event tracking
 * 
 * Flow:
 * 1. Update sync state to 'running'
 * 2. Fetch Sleeper rosters
 * 3. Build next roster map using identity resolver
 * 4. Load previous state from sleeper_roster_current
 * 5. Compute diff events
 * 6. Hash-based short-circuit if no changes
 * 7. Single transaction: insert events + replace roster state
 * 8. Update sync state to 'ok' or 'error'
 */

import { db } from '../../infra/db';
import { sleeperSyncState, sleeperRosterCurrent, ownershipEvents } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import axios from 'axios';
import { 
  computeRosterDiff, 
  canonicalRosterString,
  type RosterEvent 
} from './rosterDiff';
import { 
  batchResolveSleeperPlayerKeys, 
  resetResolverStats, 
  getResolverStats,
  clearResolverCache
} from './identityResolver';

// Sleeper API client
const sleeperApi = axios.create({
  baseURL: 'https://api.sleeper.app/v1',
  timeout: 10000
});

export interface SyncOptions {
  force?: boolean;
  week?: number;
  season?: number;
}

export interface SyncResult {
  success: boolean;
  leagueId: string;
  eventsInserted: number;
  shortCircuited: boolean;
  durationMs: number;
  hash: string;
  resolverStats: {
    total: number;
    resolvedByGsisId: number;
    resolvedBySleeperId: number;
    unresolved: number;
  };
  error?: string;
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[] | null;
  starters: string[] | null;
}

/**
 * Get current NFL week (simplified)
 */
function getCurrentNflWeek(): number {
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 8, 5); // Approx Sept 5
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / weekMs) + 1;
  return Math.max(1, Math.min(18, weeksSinceStart));
}

/**
 * Get current NFL season
 */
function getCurrentNflSeason(): number {
  const now = new Date();
  // NFL season starts in September
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Fetch rosters from Sleeper API
 */
async function fetchSleeperRosters(leagueId: string): Promise<SleeperRoster[]> {
  const response = await sleeperApi.get<SleeperRoster[]>(`/league/${leagueId}/rosters`);
  return response.data;
}

/**
 * Build roster map from Sleeper rosters
 * Map<teamId, Set<playerKey>>
 */
async function buildRosterMap(rosters: SleeperRoster[]): Promise<Map<string, Set<string>>> {
  const rosterMap = new Map<string, Set<string>>();
  
  // Collect all unique Sleeper player IDs
  const allSleeperIds: string[] = [];
  for (const roster of rosters) {
    if (roster.players) {
      allSleeperIds.push(...roster.players);
    }
  }
  
  // Batch resolve all player IDs
  const resolvedKeys = await batchResolveSleeperPlayerKeys(allSleeperIds);
  
  // Build the roster map using resolved keys
  for (const roster of rosters) {
    const teamId = String(roster.roster_id);
    const playerKeys = new Set<string>();
    
    if (roster.players) {
      for (const sleeperId of roster.players) {
        const playerKey = resolvedKeys.get(sleeperId) ?? `sleeper:${sleeperId}`;
        playerKeys.add(playerKey);
      }
    }
    
    rosterMap.set(teamId, playerKeys);
  }
  
  return rosterMap;
}

/**
 * Load previous roster state from database
 */
async function loadPreviousRosterState(leagueId: string): Promise<Map<string, Set<string>>> {
  const rows = await db
    .select({
      teamId: sleeperRosterCurrent.teamId,
      playerKey: sleeperRosterCurrent.playerKey
    })
    .from(sleeperRosterCurrent)
    .where(eq(sleeperRosterCurrent.leagueId, leagueId));
  
  const rosterMap = new Map<string, Set<string>>();
  
  for (const row of rows) {
    if (!rosterMap.has(row.teamId)) {
      rosterMap.set(row.teamId, new Set());
    }
    rosterMap.get(row.teamId)!.add(row.playerKey);
  }
  
  return rosterMap;
}

/**
 * Generate dedupe key for an event (content-based hash)
 */
function generateDedupeKey(
  leagueId: string,
  event: RosterEvent,
  rosterHash: string
): string {
  const content = [
    leagueId,
    event.playerKey,
    event.fromTeamId ?? '',
    event.toTeamId ?? '',
    event.eventType,
    rosterHash
  ].join(':');
  
  return createHash('sha256').update(content).digest('hex').substring(0, 32);
}

/**
 * Update sync state
 */
async function updateSyncState(
  leagueId: string,
  status: 'running' | 'ok' | 'error',
  options?: {
    durationMs?: number;
    lastHash?: string;
    lastError?: string;
  }
): Promise<void> {
  await db
    .insert(sleeperSyncState)
    .values({
      leagueId,
      status,
      lastSyncedAt: status !== 'running' ? new Date() : undefined,
      lastDurationMs: options?.durationMs,
      lastHash: options?.lastHash,
      lastError: options?.lastError,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: sleeperSyncState.leagueId,
      set: {
        status,
        lastSyncedAt: status !== 'running' ? new Date() : sql`${sleeperSyncState.lastSyncedAt}`,
        lastDurationMs: options?.durationMs ?? sql`${sleeperSyncState.lastDurationMs}`,
        lastHash: options?.lastHash ?? sql`${sleeperSyncState.lastHash}`,
        lastError: options?.lastError ?? null,
        updatedAt: new Date()
      }
    });
}

/**
 * Main sync function
 */
export async function syncLeague(
  leagueId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const { force = false, week = getCurrentNflWeek(), season = getCurrentNflSeason() } = options;
  
  // Reset resolver stats and cache for this sync
  resetResolverStats();
  clearResolverCache();
  
  try {
    console.log(`[SleeperSyncV2] Starting sync for league ${leagueId} (force=${force})`);
    
    // 1. Update sync state to running
    await updateSyncState(leagueId, 'running');
    
    // 2. Fetch Sleeper rosters
    const rosters = await fetchSleeperRosters(leagueId);
    console.log(`[SleeperSyncV2] Fetched ${rosters.length} rosters from Sleeper`);
    
    // 3. Build next roster map
    const nextRosterMap = await buildRosterMap(rosters);
    
    // 4. Load previous state
    const prevRosterMap = await loadPreviousRosterState(leagueId);
    
    // 5. Compute hash
    const canonicalStr = canonicalRosterString(nextRosterMap);
    const newHash = createHash('sha256').update(canonicalStr).digest('hex');
    
    // 6. Compute diff events
    const events = computeRosterDiff(prevRosterMap, nextRosterMap);
    console.log(`[SleeperSyncV2] Detected ${events.length} roster changes`);
    
    // 7. Execute transaction with hash check inside for concurrency safety
    let shortCircuited = false;
    let eventsInserted = 0;
    
    await db.transaction(async (tx) => {
      // 7a. Lock and check hash WITH FOR UPDATE to prevent concurrent race conditions
      if (!force) {
        const existingStateResult = await tx.execute(sql`
          SELECT last_hash FROM sleeper_sync_state 
          WHERE league_id = ${leagueId}
          FOR UPDATE
        `);
        
        const existingHash = (existingStateResult.rows as any[])[0]?.last_hash;
        
        if (existingHash === newHash) {
          console.log(`[SleeperSyncV2] No changes detected (hash match), short-circuiting`);
          shortCircuited = true;
          return; // Exit transaction early - nothing to do
        }
      }
      
      // 7b. Insert ownership events with dedupe keys (ON CONFLICT for extra safety)
      if (events.length > 0) {
        const eventValues = events.map(event => ({
          leagueId,
          playerKey: event.playerKey,
          fromTeamId: event.fromTeamId,
          toTeamId: event.toTeamId,
          eventType: event.eventType,
          week,
          season,
          source: 'sleeper',
          dedupeKey: generateDedupeKey(leagueId, event, newHash)
        }));
        
        // Insert with ON CONFLICT DO NOTHING for idempotency
        const insertResult = await tx.execute(sql`
          INSERT INTO ownership_events 
            (league_id, player_key, from_team_id, to_team_id, event_type, week, season, source, dedupe_key)
          SELECT 
            league_id, player_key, from_team_id, to_team_id, event_type, week, season, source, dedupe_key
          FROM jsonb_to_recordset(${JSON.stringify(eventValues)}::jsonb) AS x(
            league_id text, player_key text, from_team_id text, to_team_id text, 
            event_type text, week int, season int, source text, dedupe_key text
          )
          ON CONFLICT (dedupe_key) DO NOTHING
        `);
        eventsInserted = (insertResult as any).rowCount || events.length;
      }
      
      // 7c. Replace roster state (delete old, insert new)
      await tx.delete(sleeperRosterCurrent)
        .where(eq(sleeperRosterCurrent.leagueId, leagueId));
      
      // Build flat roster entries
      const rosterEntries: { leagueId: string; teamId: string; playerKey: string }[] = [];
      for (const [teamId, players] of Array.from(nextRosterMap.entries())) {
        for (const playerKey of Array.from(players)) {
          rosterEntries.push({ leagueId, teamId, playerKey });
        }
      }
      
      if (rosterEntries.length > 0) {
        await tx.insert(sleeperRosterCurrent).values(rosterEntries);
      }
    });
    
    // Handle short-circuit response
    if (shortCircuited) {
      const durationMs = Date.now() - startTime;
      await updateSyncState(leagueId, 'ok', { durationMs, lastHash: newHash });
      
      return {
        success: true,
        leagueId,
        eventsInserted: 0,
        shortCircuited: true,
        durationMs,
        hash: newHash,
        resolverStats: getResolverStats()
      };
    }
    
    // 9. Update sync state to ok
    const durationMs = Date.now() - startTime;
    await updateSyncState(leagueId, 'ok', { durationMs, lastHash: newHash });
    
    console.log(`[SleeperSyncV2] Sync complete: ${eventsInserted} events in ${durationMs}ms`);
    
    return {
      success: true,
      leagueId,
      eventsInserted,
      shortCircuited: false,
      durationMs,
      hash: newHash,
      resolverStats: getResolverStats()
    };
    
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error?.message || String(error);
    
    console.error(`[SleeperSyncV2] Sync failed for league ${leagueId}:`, error);
    
    await updateSyncState(leagueId, 'error', { 
      durationMs, 
      lastError: errorMessage 
    });
    
    return {
      success: false,
      leagueId,
      eventsInserted: 0,
      shortCircuited: false,
      durationMs,
      hash: '',
      resolverStats: getResolverStats(),
      error: errorMessage
    };
  }
}

/**
 * Get sync status for a league
 */
export async function getSyncStatus(leagueId: string): Promise<{
  status: string;
  lastSyncedAt: Date | null;
  lastDurationMs: number | null;
  lastError: string | null;
  lastHash: string | null;
} | null> {
  const result = await db
    .select()
    .from(sleeperSyncState)
    .where(eq(sleeperSyncState.leagueId, leagueId))
    .limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  const state = result[0];
  return {
    status: state.status,
    lastSyncedAt: state.lastSyncedAt,
    lastDurationMs: state.lastDurationMs,
    lastError: state.lastError,
    lastHash: state.lastHash
  };
}

/**
 * Get unresolved player count for a league
 */
export async function getUnresolvedPlayerCount(leagueId: string): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count
    FROM sleeper_roster_current
    WHERE league_id = ${leagueId}
      AND player_key LIKE 'sleeper:%'
  `);
  
  return parseInt(result.rows[0]?.count || '0', 10);
}
