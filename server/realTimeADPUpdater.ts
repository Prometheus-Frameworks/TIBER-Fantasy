/**
 * Real-time ADP Updater with Position Ranking Calculator
 * Implements the core functionality requested by the user
 */

import { db } from './db';
import { players } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';

export class RealTimeADPUpdater {
  
  /**
   * Update a single player's ADP and recalculate all positional rankings
   */
  async updatePlayerADP(playerId: string, newADP: number, source: string = 'manual'): Promise<void> {
    try {
      // Update the specific player
      await db.update(players)
        .set({
          adp: newADP,
          adpLastUpdated: new Date(),
          adpSource: source
        })
        .where(eq(players.sleeperId, playerId));

      // Recalculate positional rankings for all players
      await this.recalculatePositionalRankings();
      
      console.log(`✅ Updated ADP for player ${playerId}: ${newADP}`);
      
    } catch (error) {
      console.error('Failed to update player ADP:', error);
      throw error;
    }
  }

  /**
   * Batch update multiple players and recalculate rankings once
   */
  async batchUpdateADP(updates: Array<{playerId: string, adp: number}>): Promise<void> {
    try {
      // Update all players in batch
      for (const update of updates) {
        await db.update(players)
          .set({
            adp: update.adp,
            adpLastUpdated: new Date(),
            adpSource: 'batch_update'
          })
          .where(eq(players.sleeperId, update.playerId));
      }

      // Single positional ranking recalculation
      await this.recalculatePositionalRankings();
      
      console.log(`✅ Batch updated ${updates.length} players`);
      
    } catch (error) {
      console.error('Failed to batch update ADP:', error);
      throw error;
    }
  }

  /**
   * Core function: Recalculate positional ADP for all players
   * This implements the user's requirement for automatic positional ranking
   */
  async recalculatePositionalRankings(): Promise<void> {
    try {
      const positions = ['QB', 'RB', 'WR', 'TE'];
      
      for (const position of positions) {
        // Get all players of this position with ADP, sorted by ADP
        const positionPlayers = await db.select({
          id: players.id,
          name: players.name,
          adp: players.adp
        })
        .from(players)
        .where(sql`position = ${position} AND adp IS NOT NULL AND adp < 500`)
        .orderBy(sql`CAST(adp AS DECIMAL) ASC`);

        // Update each player with their positional ranking
        for (let i = 0; i < positionPlayers.length; i++) {
          const positionalRank = `${position}${i + 1}`;
          
          await db.update(players)
            .set({ positionalADP: positionalRank })
            .where(eq(players.id, positionPlayers[i].id));
        }
        
        console.log(`✅ Updated ${positionPlayers.length} ${position} positional rankings`);
      }
      
    } catch (error) {
      console.error('Failed to recalculate positional rankings:', error);
      throw error;
    }
  }

  /**
   * Get current ADP statistics for monitoring
   */
  async getADPStats(): Promise<{
    totalPlayersWithADP: number;
    positionBreakdown: Array<{position: string, count: number, avgADP: number}>;
    lastUpdated: Date | null;
  }> {
    try {
      // Total count
      const [totalResult] = await db.select({
        count: sql`COUNT(*)`
      })
      .from(players)
      .where(sql`adp IS NOT NULL AND adp < 500`);

      // Position breakdown
      const positionStats = await db.select({
        position: players.position,
        count: sql`COUNT(*)`,
        avgADP: sql`AVG(CAST(adp AS DECIMAL))`
      })
      .from(players)
      .where(sql`adp IS NOT NULL AND adp < 500 AND position IN ('QB', 'RB', 'WR', 'TE')`)
      .groupBy(players.position);

      // Last updated
      const [lastUpdatedResult] = await db.select({
        lastUpdated: sql`MAX(adp_last_updated)`
      })
      .from(players)
      .where(sql`adp_last_updated IS NOT NULL`);

      return {
        totalPlayersWithADP: parseInt(totalResult.count as string),
        positionBreakdown: positionStats.map(stat => ({
          position: stat.position as string,
          count: parseInt(stat.count as string),
          avgADP: parseFloat(stat.avgADP as string)
        })),
        lastUpdated: lastUpdatedResult.lastUpdated as Date | null
      };
      
    } catch (error) {
      console.error('Failed to get ADP stats:', error);
      throw error;
    }
  }

  /**
   * Validate ADP data integrity
   */
  async validateADPData(): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for missing positional rankings
      const [missingPositional] = await db.select({
        count: sql`COUNT(*)`
      })
      .from(players)
      .where(sql`adp IS NOT NULL AND positional_adp IS NULL`);

      if (parseInt(missingPositional.count as string) > 0) {
        issues.push(`${missingPositional.count} players have ADP but missing positional rankings`);
        recommendations.push('Run recalculatePositionalRankings()');
      }

      // Check for unrealistic ADP values
      const [unrealisticADP] = await db.select({
        count: sql`COUNT(*)`
      })
      .from(players)
      .where(sql`adp > 500 OR adp < 1`);

      if (parseInt(unrealisticADP.count as string) > 0) {
        issues.push(`${unrealisticADP.count} players have unrealistic ADP values`);
        recommendations.push('Filter ADP values between 1-500');
      }

      return {
        valid: issues.length === 0,
        issues,
        recommendations
      };

    } catch (error) {
      console.error('Failed to validate ADP data:', error);
      return {
        valid: false,
        issues: ['Database validation failed'],
        recommendations: ['Check database connection']
      };
    }
  }

  /**
   * Initialize positional rankings for existing data
   */
  async initializePositionalRankings(): Promise<void> {
    console.log('🔧 Initializing positional rankings for existing players...');
    await this.recalculatePositionalRankings();
    console.log('✅ Positional rankings initialization complete');
  }
}

// Export singleton instance
export const realTimeADPUpdater = new RealTimeADPUpdater();