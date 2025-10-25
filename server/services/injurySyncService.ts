/**
 * Injury Sync Service
 * Syncs current NFL injury data to database for ranking filters
 */

import { db } from '../db';
import { injuries, playerIdentityMap } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { injuryClient } from '../data/injuryClient';

export class InjurySyncService {
  /**
   * Sync current injury data from SportsDataIO
   * Maps player names to canonical IDs and updates injury table
   */
  async syncCurrentInjuries(season: number = 2025): Promise<{ 
    synced: number; 
    skipped: number; 
    errors: string[] 
  }> {
    console.log(`🏥 [InjurySync] Starting injury sync for ${season} season...`);
    
    try {
      // Fetch current injuries from SportsDataIO
      const injuryData = await injuryClient.sportsDataIO.getInjuries();
      
      if (!injuryData || injuryData.length === 0) {
        console.log('⚠️  [InjurySync] No injury data returned from API');
        return { synced: 0, skipped: 0, errors: ['No injury data available'] };
      }

      console.log(`📊 [InjurySync] Received ${injuryData.length} injury reports`);

      let synced = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const injury of injuryData) {
        try {
          // Skip healthy players
          if (injury.status === 'Healthy') {
            skipped++;
            continue;
          }

          // Find player in our system by name matching
          const player = await db
            .select({ 
              canonicalId: playerIdentityMap.canonicalId,
              position: playerIdentityMap.position 
            })
            .from(playerIdentityMap)
            .where(eq(playerIdentityMap.fullName, injury.playerName))
            .limit(1);

          if (!player || player.length === 0) {
            // Skip players not in our system (likely not fantasy-relevant)
            skipped++;
            continue;
          }

          const canonicalPlayerId = player[0].canonicalId;
          const position = player[0].position;
          
          // Only track skill positions (QB, RB, WR, TE)
          if (!['QB', 'RB', 'WR', 'TE'].includes(position)) {
            skipped++;
            continue;
          }

          // Map status to our schema
          const status = this.mapInjuryStatus(injury.status);
          const severity = this.mapSeverity(status);

          // Insert or update injury record
          const injuryRecord = {
            canonicalPlayerId,
            injuryType: injury.description || 'Unknown',
            bodyPart: this.extractBodyPart(injury.description),
            severity,
            status,
            practiceStatus: null,
            injuryDate: injury.lastUpdated,
            expectedReturn: injury.expectedReturn ? new Date(injury.expectedReturn) : null,
            actualReturn: null,
            season,
            week: null, // Current injuries not tied to specific week
            gameDate: null,
            source: 'manual' as const, // SportsDataIO
            reportedBy: 'SportsDataIO',
            reportedAt: injury.lastUpdated,
            description: injury.description || null,
            isResolved: false,
          };

          await db.insert(injuries).values(injuryRecord).onConflictDoUpdate({
            target: [injuries.canonicalPlayerId, injuries.season],
            set: {
              status,
              severity,
              bodyPart: this.extractBodyPart(injury.description),
              description: injury.description || null,
              expectedReturn: injury.expectedReturn ? new Date(injury.expectedReturn) : null,
              reportedAt: injury.lastUpdated,
              updatedAt: new Date(),
            }
          });

          synced++;
          console.log(`✅ [InjurySync] Synced ${injury.playerName} (${position}) - Status: ${status}`);

        } catch (error) {
          const errorMsg = `Failed to sync ${injury.playerName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.warn(`⚠️  [InjurySync] ${errorMsg}`);
        }
      }

      console.log(`✅ [InjurySync] Sync complete - Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors.length}`);
      
      return { synced, skipped, errors };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [InjurySync] Failed to fetch injuries:', errorMsg);
      return { 
        synced: 0, 
        skipped: 0, 
        errors: [errorMsg] 
      };
    }
  }

  /**
   * Map injury status codes to our schema
   */
  private mapInjuryStatus(status: 'Q' | 'D' | 'O' | 'IR' | 'Healthy'): string {
    switch (status) {
      case 'IR': return 'ir';
      case 'O': return 'out';
      case 'D': return 'doubtful';
      case 'Q': return 'questionable';
      default: return 'healthy';
    }
  }

  /**
   * Map status to severity for context
   */
  private mapSeverity(status: string): string {
    if (status === 'ir') return 'season_ending';
    if (status === 'out') return 'major';
    if (status === 'doubtful') return 'moderate';
    if (status === 'questionable') return 'minor';
    return 'minor';
  }

  /**
   * Extract body part from injury description
   */
  private extractBodyPart(description: string | undefined): string | null {
    if (!description) return null;

    const bodyParts = [
      'knee', 'ankle', 'shoulder', 'hamstring', 'groin', 'quadriceps',
      'calf', 'hip', 'back', 'neck', 'concussion', 'head', 'hand',
      'wrist', 'elbow', 'foot', 'toe', 'finger', 'thumb', 'ribs', 'chest'
    ];

    const lowerDesc = description.toLowerCase();
    for (const part of bodyParts) {
      if (lowerDesc.includes(part)) {
        return part;
      }
    }

    return null;
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
