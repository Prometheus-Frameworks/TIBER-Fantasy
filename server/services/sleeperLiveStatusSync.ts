/**
 * Sleeper Live Status Sync Service
 * 
 * Syncs current team and injury status from Sleeper API
 * to the player_live_status table for FORGE eligibility filtering.
 * 
 * This ensures FORGE movers shows:
 * - Correct current teams (not stale data)
 * - No IR/inactive players appearing as movers
 */

import { db } from '../infra/db';
import { playerIdentityMap, playerLiveStatus } from '@shared/schema';
import { eq, sql, inArray } from 'drizzle-orm';

interface SleeperPlayerRaw {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  status: string;
  injury_status: string | null;
  injury_body_part: string | null;
  active: boolean;
}

const SLEEPER_PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl';

const INELIGIBLE_STATUSES = ['Injured Reserve', 'IR', 'PUP', 'Suspended', 'Inactive', 'Reserve/Retired'];
const INELIGIBLE_INJURY_STATUSES = ['IR', 'Out', 'PUP'];

function isEligibleForForge(player: SleeperPlayerRaw): boolean {
  if (!player.active) return false;
  if (!player.team) return false;
  if (INELIGIBLE_STATUSES.some(s => player.status?.includes(s))) return false;
  if (INELIGIBLE_INJURY_STATUSES.includes(player.injury_status || '')) return false;
  return true;
}

export interface SyncResult {
  success: boolean;
  playersProcessed: number;
  playersUpdated: number;
  playersSkipped: number;
  examples: {
    updated: string[];
    irPlayers: string[];
  };
  error?: string;
}

export class SleeperLiveStatusSyncService {
  async fetchSleeperPlayers(): Promise<Map<string, SleeperPlayerRaw>> {
    console.log('[SleeperLiveSync] Fetching players from Sleeper API...');
    
    const response = await fetch(SLEEPER_PLAYERS_URL, { 
      signal: AbortSignal.timeout(60000) 
    });
    
    if (!response.ok) {
      throw new Error(`Sleeper API error: ${response.status}`);
    }
    
    const playersObj = await response.json();
    const players = new Map<string, SleeperPlayerRaw>();
    
    for (const [playerId, data] of Object.entries(playersObj)) {
      const player = data as any;
      if (player.position && ['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
        players.set(playerId, {
          player_id: playerId,
          full_name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
          first_name: player.first_name,
          last_name: player.last_name,
          position: player.position,
          team: player.team || null,
          status: player.status || 'Active',
          injury_status: player.injury_status || null,
          injury_body_part: player.injury_body_part || null,
          active: player.active !== false,
        });
      }
    }
    
    console.log(`[SleeperLiveSync] Fetched ${players.size} skill position players`);
    return players;
  }

  async syncLiveStatus(): Promise<SyncResult> {
    const startTime = Date.now();
    let playersUpdated = 0;
    let playersSkipped = 0;
    const updatedExamples: string[] = [];
    const irPlayers: string[] = [];

    try {
      const sleeperPlayers = await this.fetchSleeperPlayers();
      
      const identityPlayers = await db
        .select({
          canonicalId: playerIdentityMap.canonicalId,
          sleeperId: playerIdentityMap.sleeperId,
          fullName: playerIdentityMap.fullName,
          position: playerIdentityMap.position,
          currentTeam: playerIdentityMap.nflTeam,
        })
        .from(playerIdentityMap)
        .where(
          sql`${playerIdentityMap.position} IN ('QB', 'RB', 'WR', 'TE') AND ${playerIdentityMap.sleeperId} IS NOT NULL`
        );

      console.log(`[SleeperLiveSync] Found ${identityPlayers.length} players with Sleeper IDs`);

      for (const identity of identityPlayers) {
        const sleeperId = identity.sleeperId;
        if (!sleeperId) continue;

        const sleeperPlayer = sleeperPlayers.get(sleeperId);
        if (!sleeperPlayer) {
          playersSkipped++;
          continue;
        }

        const isEligible = isEligibleForForge(sleeperPlayer);
        const newTeam = sleeperPlayer.team;

        await db
          .insert(playerLiveStatus)
          .values({
            canonicalId: identity.canonicalId,
            sleeperId: sleeperId,
            currentTeam: newTeam,
            status: sleeperPlayer.status,
            injuryStatus: sleeperPlayer.injury_status,
            injuryBodyPart: sleeperPlayer.injury_body_part,
            isEligibleForForge: isEligible,
            lastSyncedAt: new Date(),
            syncSource: 'sleeper',
          })
          .onConflictDoUpdate({
            target: playerLiveStatus.canonicalId,
            set: {
              sleeperId: sleeperId,
              currentTeam: newTeam,
              status: sleeperPlayer.status,
              injuryStatus: sleeperPlayer.injury_status,
              injuryBodyPart: sleeperPlayer.injury_body_part,
              isEligibleForForge: isEligible,
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            },
          });

        playersUpdated++;

        if (updatedExamples.length < 5 && newTeam !== identity.currentTeam) {
          updatedExamples.push(`${identity.fullName}: ${identity.currentTeam || 'FA'} → ${newTeam || 'FA'}`);
        }

        if (!isEligible && irPlayers.length < 10) {
          irPlayers.push(`${identity.fullName} (${sleeperPlayer.status}${sleeperPlayer.injury_status ? ` - ${sleeperPlayer.injury_status}` : ''})`);
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`[SleeperLiveSync] Sync completed in ${elapsed}ms: ${playersUpdated} updated, ${playersSkipped} skipped`);

      return {
        success: true,
        playersProcessed: identityPlayers.length,
        playersUpdated,
        playersSkipped,
        examples: {
          updated: updatedExamples,
          irPlayers,
        },
      };
    } catch (error) {
      console.error('[SleeperLiveSync] Error during sync:', error);
      return {
        success: false,
        playersProcessed: 0,
        playersUpdated: 0,
        playersSkipped: 0,
        examples: { updated: [], irPlayers: [] },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getPlayerLiveStatus(canonicalId: string) {
    const result = await db
      .select()
      .from(playerLiveStatus)
      .where(eq(playerLiveStatus.canonicalId, canonicalId))
      .limit(1);
    
    return result[0] || null;
  }

  async getIneligiblePlayers() {
    return db
      .select({
        canonicalId: playerLiveStatus.canonicalId,
        currentTeam: playerLiveStatus.currentTeam,
        status: playerLiveStatus.status,
        injuryStatus: playerLiveStatus.injuryStatus,
      })
      .from(playerLiveStatus)
      .where(eq(playerLiveStatus.isEligibleForForge, false));
  }
}

export const sleeperLiveStatusSync = new SleeperLiveStatusSyncService();
