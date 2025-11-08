/**
 * Injury Sync Service
 * Syncs current NFL injury data to database for ranking filters
 * Data source: Sleeper API (injury_status field)
 */

import { db } from '../infra/db';
import { injuries, playerIdentityMap } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

interface SleeperPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  injury_status: string | null;
}

export class InjurySyncService {
  private readonly SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

  /**
   * Sync current injury data from Sleeper API
   * Only tracks IR and OUT statuses
   */
  async syncCurrentInjuries(season: number = 2025): Promise<{ 
    synced: number; 
    skipped: number; 
    errors: string[] 
  }> {
    console.log(`🏥 [InjurySync] Starting Sleeper injury sync for ${season} season...`);
    
    try {
      // Fetch all NFL players from Sleeper API
      const response = await fetch(`${this.SLEEPER_API_BASE}/players/nfl`);
      if (!response.ok) {
        throw new Error(`Sleeper API error: ${response.status}`);
      }

      const playersData: Record<string, SleeperPlayer> = await response.json();
      const players = Object.values(playersData);

      console.log(`📊 [InjurySync] Received ${players.length} total players from Sleeper`);

      let synced = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const player of players) {
        try {
          // Skip if no injury status
          if (!player.injury_status) {
            skipped++;
            continue;
          }

          // Only track IR and OUT statuses (ignore Q, D, etc.)
          const status = player.injury_status.toUpperCase();
          if (status !== 'IR' && status !== 'OUT') {
            skipped++;
            continue;
          }

          // Only track skill positions (QB, RB, WR, TE)
          if (!['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
            skipped++;
            continue;
          }

          // Find player in our system by Sleeper ID
          const playerIdentity = await db
            .select({ 
              canonicalId: playerIdentityMap.canonicalId,
              position: playerIdentityMap.position 
            })
            .from(playerIdentityMap)
            .where(eq(playerIdentityMap.sleeperId, player.player_id))
            .limit(1);

          if (!playerIdentity || playerIdentity.length === 0) {
            // Try matching by full name as fallback
            const nameMatch = await db
              .select({ 
                canonicalId: playerIdentityMap.canonicalId,
                position: playerIdentityMap.position 
              })
              .from(playerIdentityMap)
              .where(eq(playerIdentityMap.fullName, player.full_name))
              .limit(1);

            if (!nameMatch || nameMatch.length === 0) {
              skipped++;
              continue;
            }

            const canonicalPlayerId = nameMatch[0].canonicalId;
            await this.upsertInjury(canonicalPlayerId, status, season, player);
            synced++;
            console.log(`✅ [InjurySync] Synced ${player.full_name} (${player.position}) - Status: ${status.toLowerCase()}`);
            continue;
          }

          const canonicalPlayerId = playerIdentity[0].canonicalId;
          await this.upsertInjury(canonicalPlayerId, status, season, player);
          synced++;
          console.log(`✅ [InjurySync] Synced ${player.full_name} (${player.position}) - Status: ${status.toLowerCase()}`);

        } catch (error) {
          const errorMsg = `Failed to sync ${player.full_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.warn(`⚠️  [InjurySync] ${errorMsg}`);
        }
      }

      console.log(`✅ [InjurySync] Sync complete - Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors.length}`);
      
      return { synced, skipped, errors };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [InjurySync] Failed to fetch from Sleeper API:', errorMsg);
      return { 
        synced: 0, 
        skipped: 0, 
        errors: [errorMsg] 
      };
    }
  }

  /**
   * Insert or update injury record
   */
  private async upsertInjury(
    canonicalPlayerId: string,
    status: string,
    season: number,
    player: SleeperPlayer
  ): Promise<void> {
    const mappedStatus = status === 'IR' ? 'ir' : 'out';
    const severity = status === 'IR' ? 'season_ending' : 'major';

    // Check if record exists
    const existing = await db
      .select()
      .from(injuries)
      .where(and(
        eq(injuries.canonicalPlayerId, canonicalPlayerId),
        eq(injuries.season, season)
      ))
      .limit(1);

    const injuryData = {
      injuryType: 'Unknown',
      bodyPart: null,
      severity,
      status: mappedStatus,
      practiceStatus: null,
      injuryDate: new Date(),
      expectedReturn: null,
      actualReturn: null,
      source: 'manual' as const,
      reportedBy: 'Sleeper API',
      reportedAt: new Date(),
      description: `${player.full_name} is on ${status === 'IR' ? 'Injured Reserve' : 'OUT'}`,
      isResolved: false,
    };

    if (existing && existing.length > 0) {
      // Update existing record
      await db
        .update(injuries)
        .set({
          ...injuryData,
          updatedAt: new Date(),
        })
        .where(and(
          eq(injuries.canonicalPlayerId, canonicalPlayerId),
          eq(injuries.season, season)
        ));
    } else {
      // Insert new record
      await db.insert(injuries).values({
        canonicalPlayerId,
        season,
        week: null,
        gameDate: null,
        ...injuryData,
      });
    }
  }

  /**
   * Clear all current season injuries (useful before full sync)
   */
  async clearSeasonInjuries(season: number): Promise<number> {
    console.log(`🧹 [InjurySync] Clearing injury records for ${season} season...`);
    
    const deleted = await db
      .delete(injuries)
      .where(and(
        eq(injuries.season, season),
        eq(injuries.isResolved, false)
      ));

    console.log(`✅ [InjurySync] Cleared ${deleted.rowCount || 0} injury records`);
    return deleted.rowCount || 0;
  }
}

export const injurySyncService = new InjurySyncService();
