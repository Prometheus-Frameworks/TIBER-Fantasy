/**
 * Player Identity Migration Service
 * 
 * Handles population of the Player Identity Map with data from external sources
 * Includes migration from existing playerResolver Sleeper data
 */

import { playerIdentityService, PlayerIdentityService } from './PlayerIdentityService';
import { resolvePlayer, getAllPlayers } from '../../src/data/resolvers/playerResolver';

interface SleeperPlayerData {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string;
  position?: string;
  active?: boolean;
  status?: string;
  years_exp?: number;
}

interface MigrationStats {
  totalProcessed: number;
  imported: number;
  skipped: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export class PlayerIdentityMigration {
  private static instance: PlayerIdentityMigration;

  public static getInstance(): PlayerIdentityMigration {
    if (!PlayerIdentityMigration.instance) {
      PlayerIdentityMigration.instance = new PlayerIdentityMigration();
    }
    return PlayerIdentityMigration.instance;
  }

  /**
   * Main migration method - migrates all Sleeper players from existing system
   */
  async migrateSleeperPlayersFromAPI(): Promise<MigrationStats> {
    const stats: MigrationStats = {
      totalProcessed: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      startTime: new Date()
    };

    console.log('🔄 [PlayerIdentityMigration] Starting Sleeper player migration...');

    try {
      // Fetch all players from Sleeper API (same source as playerResolver)
      const sleeperApiUrl = "https://api.sleeper.app/v1/players/nfl";
      console.log('📡 [Migration] Fetching Sleeper players from API...');
      
      const response = await fetch(sleeperApiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Sleeper players: ${response.status}`);
      }

      const sleeperData = (await response.json()) as Record<string, SleeperPlayerData>;
      const playerIds = Object.keys(sleeperData);
      
      console.log(`📊 [Migration] Found ${playerIds.length} players in Sleeper API`);
      stats.totalProcessed = playerIds.length;

      // Process in batches to avoid overwhelming the database
      const batchSize = 100;
      const batches = Math.ceil(playerIds.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const startIdx = i * batchSize;
        const endIdx = Math.min((i + 1) * batchSize, playerIds.length);
        const batchIds = playerIds.slice(startIdx, endIdx);
        
        console.log(`🔄 [Migration] Processing batch ${i + 1}/${batches} (${batchIds.length} players)`);
        
        const batchPlayers = batchIds
          .map(id => ({ id, data: sleeperData[id] }))
          .filter(({ data }) => data && this.isValidPlayer(data));

        const batchStats = await this.processBatch(batchPlayers);
        stats.imported += batchStats.imported;
        stats.skipped += batchStats.skipped;
        stats.errors += batchStats.errors;

        // Small delay between batches to avoid overwhelming the database
        if (i < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

      console.log('✅ [PlayerIdentityMigration] Migration completed successfully');
      console.log(`📊 Migration Stats: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`);
      console.log(`⏱️ Duration: ${stats.duration}ms`);

      return stats;
    } catch (error) {
      console.error('❌ [PlayerIdentityMigration] Migration failed:', error);
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();
      throw error;
    }
  }

  /**
   * Process a single batch of players
   */
  private async processBatch(batch: Array<{ id: string; data: SleeperPlayerData }>): Promise<{
    imported: number;
    skipped: number;
    errors: number;
  }> {
    const stats = { imported: 0, skipped: 0, errors: 0 };

    for (const { id, data } of batch) {
      try {
        // Check if player already exists in Identity Map
        const existing = await playerIdentityService.getCanonicalId(id, 'sleeper');
        if (existing) {
          stats.skipped++;
          continue;
        }

        // Create canonical ID for Sleeper players
        const canonicalId = `sleeper:${id}`;

        // Prepare player data
        const playerData = {
          canonicalId,
          fullName: data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
          firstName: data.first_name,
          lastName: data.last_name,
          position: this.normalizePosition(data.position),
          nflTeam: this.normalizeTeam(data.team),
          isActive: this.determineActiveStatus(data),
          confidence: this.calculateConfidence(data),
          externalIds: { sleeper: id }
        };

        // Validate required fields
        if (!playerData.fullName || !playerData.position) {
          console.warn(`[Migration] Skipping player ${id}: missing name or position`);
          stats.skipped++;
          continue;
        }

        const success = await playerIdentityService.createPlayerIdentity(playerData);
        if (success) {
          stats.imported++;
        } else {
          stats.errors++;
        }
      } catch (error) {
        console.error(`[Migration] Error processing player ${id}:`, error);
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Validate if a Sleeper player record is valid for import
   */
  private isValidPlayer(player: SleeperPlayerData): boolean {
    // Must have an ID and some identifying information
    if (!player.player_id) return false;
    
    // Must have either full name or first/last name
    const hasName = player.full_name || (player.first_name && player.last_name);
    if (!hasName) return false;

    // Must have a position
    if (!player.position) return false;

    // Skip obviously invalid positions
    const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];
    if (!validPositions.includes(player.position)) return false;

    return true;
  }

  /**
   * Normalize position values to standard format
   */
  private normalizePosition(position?: string): string {
    if (!position) return 'WR';
    
    const normalized = position.toUpperCase().trim();
    
    // Map common variations
    const positionMap: Record<string, string> = {
      'QUARTERBACK': 'QB',
      'RUNNING BACK': 'RB',
      'RUNNINGBACK': 'RB',
      'WIDE RECEIVER': 'WR',
      'WIDERECEIVER': 'WR',
      'TIGHT END': 'TE',
      'TIGHTEND': 'TE',
      'KICKER': 'K',
      'DEFENSE': 'DEF',
      'DEFENCE': 'DEF',
      'DST': 'DEF',
      'D/ST': 'DEF'
    };

    return positionMap[normalized] || normalized;
  }

  /**
   * Normalize team codes to standard format
   */
  private normalizeTeam(team?: string): string | undefined {
    if (!team) return undefined;
    
    const normalized = team.toUpperCase().trim();
    
    // Handle common variations
    const teamMap: Record<string, string> = {
      'JAX': 'JAC',
      'JAC': 'JAC'
    };

    return teamMap[normalized] || normalized;
  }

  /**
   * Determine if player should be marked as active
   */
  private determineActiveStatus(player: SleeperPlayerData): boolean {
    // Explicitly active
    if (player.active === true) return true;
    
    // Has active status
    if (player.status?.toLowerCase() === 'active') return true;
    
    // Has NFL team (usually indicates active)
    if (player.team && player.team.trim() !== '') return true;
    
    // Not explicitly inactive
    if (player.status?.toLowerCase() === 'inactive') return false;
    
    // Default to false for safety
    return false;
  }

  /**
   * Calculate confidence score for the player data quality
   */
  private calculateConfidence(player: SleeperPlayerData): number {
    let confidence = 0.5; // Base confidence
    
    // Full name available
    if (player.full_name && player.full_name.trim()) {
      confidence += 0.2;
    }
    
    // Both first and last name
    if (player.first_name && player.last_name) {
      confidence += 0.1;
    }
    
    // Has team
    if (player.team && player.team.trim()) {
      confidence += 0.1;
    }
    
    // Active status
    if (player.active === true || player.status?.toLowerCase() === 'active') {
      confidence += 0.1;
    }
    
    // Position is core fantasy position
    if (['QB', 'RB', 'WR', 'TE'].includes(player.position || '')) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Check migration status and provide stats
   */
  async getMigrationStatus(): Promise<{
    isComplete: boolean;
    playerCount: number;
    sleeperCount: number;
    lastMigration?: Date;
  }> {
    try {
      const stats = await playerIdentityService.getSystemStats();
      
      return {
        isComplete: stats.platformCoverage.sleeper > 10000, // Expect 11,000+ Sleeper players
        playerCount: stats.totalPlayers,
        sleeperCount: stats.platformCoverage.sleeper || 0,
        lastMigration: stats.lastUpdated || undefined
      };
    } catch (error) {
      console.error('[Migration] Error getting migration status:', error);
      return {
        isComplete: false,
        playerCount: 0,
        sleeperCount: 0
      };
    }
  }

  /**
   * Manual migration trigger with options
   */
  async runMigration(options: {
    force?: boolean;
    dryRun?: boolean;
    batchSize?: number;
  } = {}): Promise<MigrationStats> {
    console.log('🚀 [PlayerIdentityMigration] Starting manual migration...');
    console.log('Options:', options);

    if (options.dryRun) {
      console.log('🔍 [Migration] DRY RUN MODE - No changes will be made');
      // In dry run, just fetch and count players
      const sleeperApiUrl = "https://api.sleeper.app/v1/players/nfl";
      const response = await fetch(sleeperApiUrl);
      const data = await response.json();
      const validPlayers = Object.values(data).filter(p => this.isValidPlayer(p as SleeperPlayerData));
      
      return {
        totalProcessed: Object.keys(data).length,
        imported: 0,
        skipped: 0,
        errors: 0,
        startTime: new Date(),
        endTime: new Date(),
        duration: 0
      };
    }

    // Check if migration is needed
    if (!options.force) {
      const status = await this.getMigrationStatus();
      if (status.isComplete) {
        console.log('ℹ️ [Migration] Migration already complete. Use force=true to re-run');
        return {
          totalProcessed: 0,
          imported: 0,
          skipped: status.sleeperCount,
          errors: 0,
          startTime: new Date(),
          endTime: new Date(),
          duration: 0
        };
      }
    }

    return await this.migrateSleeperPlayersFromAPI();
  }
}

// Export singleton instance
export const playerIdentityMigration = PlayerIdentityMigration.getInstance();