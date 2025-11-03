/**
 * Real-time ADP Sync Service
 * Automatically fetches and updates ADP data from multiple sources
 */

import { db } from './infra/db';
import { players } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

export interface ADPUpdate {
  playerId: string;
  playerName: string;
  overallADP: number;
  positionalADP: string; // e.g., "WR1", "RB6", "QB3"
  position: string;
  ownership?: number;
  lastUpdated: Date;
  source: 'sleeper' | 'espn' | 'fantasypros';
}

export interface ADPSyncConfig {
  source: 'sleeper' | 'espn' | 'fantasypros';
  syncInterval: number; // hours
  rateLimit: number; // requests per minute
  enabled: boolean;
}

export class ADPSyncService {
  private config: ADPSyncConfig;
  private syncTimer?: NodeJS.Timeout;
  private lastSync: Date | null = null;

  constructor(config: ADPSyncConfig) {
    this.config = config;
  }

  /**
   * Start automatic syncing based on configured interval
   */
  startAutoSync(): void {
    if (!this.config.enabled) {
      console.log('ADP auto-sync disabled');
      return;
    }

    console.log(`🔄 Starting ADP auto-sync: ${this.config.source} every ${this.config.syncInterval}h`);
    
    // Initial sync
    this.performSync();
    
    // Schedule recurring syncs
    const intervalMs = this.config.syncInterval * 60 * 60 * 1000;
    this.syncTimer = setInterval(() => {
      this.performSync();
    }, intervalMs);
  }

  /**
   * Stop automatic syncing
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
      console.log('ADP auto-sync stopped');
    }
  }

  /**
   * Perform a manual sync operation
   */
  async performSync(): Promise<{ success: boolean; updated: number; errors: string[] }> {
    const startTime = Date.now();
    console.log(`🔄 Starting ADP sync from ${this.config.source}...`);
    
    try {
      let updates: ADPUpdate[] = [];
      
      switch (this.config.source) {
        case 'sleeper':
          updates = await this.fetchSleeperADP();
          break;
        case 'espn':
          updates = await this.fetchESPNADP();
          break;
        case 'fantasypros':
          updates = await this.fetchFantasyProsADP();
          break;
      }

      // Calculate positional rankings
      updates = this.calculatePositionalADP(updates);

      // Update database
      const updateCount = await this.updatePlayerADP(updates);
      
      this.lastSync = new Date();
      const duration = Date.now() - startTime;
      
      console.log(`✅ ADP sync completed: ${updateCount} players updated in ${duration}ms`);
      
      return {
        success: true,
        updated: updateCount,
        errors: []
      };
      
    } catch (error) {
      console.error('❌ ADP sync failed:', error);
      return {
        success: false,
        updated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Fetch ADP data from Sleeper API
   */
  private async fetchSleeperADP(): Promise<ADPUpdate[]> {
    const response = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!response.ok) {
      throw new Error(`Sleeper API error: ${response.status}`);
    }

    const players = await response.json();
    const updates: ADPUpdate[] = [];

    // Get trending data for ADP
    const trendingResponse = await fetch('https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=1000');
    const trendingData = trendingResponse.ok ? await trendingResponse.json() : [];

    for (const [playerId, player] of Object.entries(players as any)) {
      if (!player.position || !['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
        continue;
      }

      // Find trending data for this player
      const trending = trendingData.find((t: any) => t.player_id === playerId);
      const adp = trending?.adp || player.adp || null;

      if (adp && adp < 500) { // Only include realistic ADP values
        updates.push({
          playerId: playerId,
          playerName: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
          overallADP: adp,
          positionalADP: '', // Will be calculated later
          position: player.position,
          ownership: trending?.ownership || null,
          lastUpdated: new Date(),
          source: 'sleeper'
        });
      }
    }

    return updates;
  }

  /**
   * Fetch ADP data from ESPN (unofficial API)
   */
  private async fetchESPNADP(): Promise<ADPUpdate[]> {
    // ESPN's fantasy API for ADP data
    const response = await fetch('https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/segments/0/leagues/0?view=kona_player_info');
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();
    const updates: ADPUpdate[] = [];

    // Process ESPN player data
    // Note: ESPN API structure may vary, this is a basic implementation
    if (data.players) {
      data.players.forEach((player: any, index: number) => {
        if (player.player && player.player.eligibleSlots) {
          const position = this.mapESPNPosition(player.player.defaultPositionId);
          if (['QB', 'RB', 'WR', 'TE'].includes(position)) {
            updates.push({
              playerId: player.player.id.toString(),
              playerName: player.player.fullName,
              overallADP: index + 1, // ESPN rank as ADP approximation
              positionalADP: '',
              position: position,
              ownership: player.player.ownership || null,
              lastUpdated: new Date(),
              source: 'espn'
            });
          }
        }
      });
    }

    return updates;
  }

  /**
   * Fetch ADP data from FantasyPros (if available)
   */
  private async fetchFantasyProsADP(): Promise<ADPUpdate[]> {
    // FantasyPros doesn't have a public API, but we can simulate structure
    // In production, this would require API access or web scraping
    console.log('FantasyPros ADP sync not implemented (requires API access)');
    return [];
  }

  /**
   * Calculate positional rankings (WR1, RB2, etc.)
   */
  private calculatePositionalADP(updates: ADPUpdate[]): ADPUpdate[] {
    // Group by position and sort by overall ADP
    const positionGroups: { [key: string]: ADPUpdate[] } = {};
    
    updates.forEach(update => {
      if (!positionGroups[update.position]) {
        positionGroups[update.position] = [];
      }
      positionGroups[update.position].push(update);
    });

    // Sort each position group by overall ADP and assign positional rank
    Object.keys(positionGroups).forEach(position => {
      const sorted = positionGroups[position].sort((a, b) => a.overallADP - b.overallADP);
      sorted.forEach((update, index) => {
        update.positionalADP = `${position}${index + 1}`;
      });
    });

    return updates;
  }

  /**
   * Update player ADP data in database
   */
  private async updatePlayerADP(updates: ADPUpdate[]): Promise<number> {
    let updateCount = 0;

    for (const update of updates) {
      try {
        // Try to find player by Sleeper ID first, then by name
        const existing = await db.select()
          .from(players)
          .where(sql`sleeper_id = ${update.playerId} OR LOWER(name) = LOWER(${update.playerName})`)
          .limit(1);

        if (existing.length > 0) {
          await db.update(players)
            .set({
              adp: update.overallADP,
              positionalADP: update.positionalADP,
              ownership: update.ownership,
              adpLastUpdated: update.lastUpdated,
              adpSource: update.source
            })
            .where(eq(players.id, existing[0].id));
          
          updateCount++;
        }
      } catch (error) {
        console.error(`Failed to update ${update.playerName}:`, error);
      }
    }

    return updateCount;
  }

  /**
   * Map ESPN position ID to standard position
   */
  private mapESPNPosition(positionId: number): string {
    const positionMap: { [key: number]: string } = {
      1: 'QB',
      2: 'RB',
      3: 'WR',
      4: 'TE',
      5: 'K',
      16: 'DST'
    };
    return positionMap[positionId] || 'UNKNOWN';
  }

  /**
   * Get sync status information
   */
  getSyncStatus(): { lastSync: Date | null; source: string; enabled: boolean } {
    return {
      lastSync: this.lastSync,
      source: this.config.source,
      enabled: this.config.enabled
    };
  }

  /**
   * Update sync configuration
   */
  updateConfig(newConfig: Partial<ADPSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.enabled !== undefined) {
      if (newConfig.enabled) {
        this.startAutoSync();
      } else {
        this.stopAutoSync();
      }
    }
  }
}

// Export singleton instance
const defaultConfig: ADPSyncConfig = {
  source: (process.env.ADP_SOURCE as any) || 'sleeper',
  syncInterval: parseInt(process.env.ADP_SYNC_INTERVAL || '6'), // 6 hours default
  rateLimit: 100, // 100 requests per minute
  enabled: process.env.ADP_SYNC_ENABLED !== 'false'
};

export const adpSyncService = new ADPSyncService(defaultConfig);