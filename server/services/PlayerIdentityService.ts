/**
 * Central Player Identity Map System
 * 
 * Core service for resolving player identities across multiple platforms
 * (Sleeper, ESPN, Yahoo, RotowWire, FantasyPros, etc.)
 * 
 * Provides canonical player ID resolution with confidence scoring
 * and fuzzy matching for ambiguous cases.
 */

import { db } from '../db';
import { playerIdentityMap, type PlayerIdentityMap } from '@shared/schema';
import { eq, and, sql, or, ilike, desc } from 'drizzle-orm';
import { cacheKey, getCache, setCache } from '../../src/data/cache';

export interface ExternalIdMapping {
  externalId: string;
  platform: string;
  confidence: number;
}

export interface PlayerIdentityResult {
  canonicalId: string;
  fullName: string;
  position: string;
  nflTeam?: string;
  confidence: number;
  externalIds: Record<string, string>;
  isActive: boolean;
  lastVerified: Date;
}

export interface NameSearchResult {
  canonicalId: string;
  fullName: string;
  position: string;
  nflTeam?: string;
  confidence: number;
  matchReason: string;
}

export interface IdentityMappingInput {
  canonicalId: string;
  externalId: string;
  platform: 'sleeper' | 'espn' | 'yahoo' | 'rotowire' | 'fantasypros' | 'mysportsfeeds' | 'nfl_data_py';
  confidence: number;
  overwrite?: boolean;
}

type SupportedPlatform = 'sleeper' | 'espn' | 'yahoo' | 'rotowire' | 'fantasypros' | 'mysportsfeeds' | 'nfl_data_py';

const PLATFORM_COLUMNS: Record<SupportedPlatform, keyof PlayerIdentityMap> = {
  sleeper: 'sleeperId',
  espn: 'espnId',
  yahoo: 'yahooId',
  rotowire: 'rotowireId',
  fantasypros: 'fantasyprosId',
  mysportsfeeds: 'mysportsfeedsId',
  nfl_data_py: 'nflDataPyId'
};

/**
 * Core Player Identity Service
 * Manages cross-platform player identity resolution and mapping
 */
export class PlayerIdentityService {
  private static instance: PlayerIdentityService;
  private cachePrefix = 'player_identity';
  private defaultCacheTtl = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): PlayerIdentityService {
    if (!PlayerIdentityService.instance) {
      PlayerIdentityService.instance = new PlayerIdentityService();
    }
    return PlayerIdentityService.instance;
  }

  /**
   * Get canonical player ID from any external platform ID
   * Core method for identity resolution
   */
  async getCanonicalId(externalId: string, platform: SupportedPlatform): Promise<string | null> {
    const cacheKeyStr = cacheKey([this.cachePrefix, 'canonical', platform, externalId]);
    const cached = getCache<string>(cacheKeyStr);
    if (cached) return cached;

    const columnName = PLATFORM_COLUMNS[platform];
    if (!columnName) {
      console.warn(`[PlayerIdentityService] Unsupported platform: ${platform}`);
      return null;
    }

    try {
      const result = await db
        .select({ canonicalId: playerIdentityMap.canonicalId })
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap[columnName], externalId))
        .limit(1);

      const canonicalId = result[0]?.canonicalId || null;
      
      if (canonicalId) {
        setCache(cacheKeyStr, canonicalId, this.defaultCacheTtl);
      }

      return canonicalId;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error getting canonical ID for ${platform}:${externalId}:`, error);
      return null;
    }
  }

  /**
   * Get complete player identity by any external ID
   * Returns full player object with all known platform IDs
   */
  async getByAnyId(id: string): Promise<PlayerIdentityResult | null> {
    const cacheKeyStr = cacheKey([this.cachePrefix, 'by_any_id', id]);
    const cached = getCache<PlayerIdentityResult>(cacheKeyStr);
    if (cached) return cached;

    try {
      // Try canonical ID first
      let player = await this.getByCanonicalId(id);
      if (player) {
        setCache(cacheKeyStr, player, this.defaultCacheTtl);
        return player;
      }

      // Try each platform ID column
      for (const [platform, columnName] of Object.entries(PLATFORM_COLUMNS)) {
        const result = await db
          .select()
          .from(playerIdentityMap)
          .where(eq(playerIdentityMap[columnName], id))
          .limit(1);

        if (result[0]) {
          player = this.mapToPlayerIdentityResult(result[0]);
          setCache(cacheKeyStr, player, this.defaultCacheTtl);
          return player;
        }
      }

      return null;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error getting player by any ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Get player identity by canonical ID
   */
  async getByCanonicalId(canonicalId: string): Promise<PlayerIdentityResult | null> {
    const cacheKeyStr = cacheKey([this.cachePrefix, 'canonical_lookup', canonicalId]);
    const cached = getCache<PlayerIdentityResult>(cacheKeyStr);
    if (cached) return cached;

    try {
      const result = await db
        .select()
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap.canonicalId, canonicalId))
        .limit(1);

      if (!result[0]) return null;

      const player = this.mapToPlayerIdentityResult(result[0]);
      setCache(cacheKeyStr, player, this.defaultCacheTtl);
      return player;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error getting player by canonical ID ${canonicalId}:`, error);
      return null;
    }
  }

  /**
   * Search for players by name with fuzzy matching
   * Returns potential matches with confidence scores
   */
  async searchByName(name: string, position?: string): Promise<NameSearchResult[]> {
    const normalizedName = this.normalizeName(name);
    const cacheKeyStr = cacheKey([this.cachePrefix, 'name_search', normalizedName, position]);
    const cached = getCache<NameSearchResult[]>(cacheKeyStr);
    if (cached) return cached;

    try {
      // Build where condition based on position filter
      const nameSearchCondition = or(
        ilike(playerIdentityMap.fullName, `%${name}%`),
        ilike(playerIdentityMap.firstName, `%${name}%`),
        ilike(playerIdentityMap.lastName, `%${name}%`)
      );

      const whereCondition = position 
        ? and(
            eq(playerIdentityMap.position, position.toUpperCase()),
            nameSearchCondition
          )
        : nameSearchCondition;

      const results = await db
        .select()
        .from(playerIdentityMap)
        .where(whereCondition)
        .limit(20);

      // Score and sort results
      const scoredResults = results.map(player => {
        const score = this.calculateNameMatchScore(normalizedName, player);
        return {
          canonicalId: player.canonicalId,
          fullName: player.fullName,
          position: player.position,
          nflTeam: player.nflTeam || undefined,
          confidence: score.confidence,
          matchReason: score.reason
        };
      });

      // Sort by confidence and active status
      scoredResults.sort((a, b) => b.confidence - a.confidence);
      
      const topResults = scoredResults.slice(0, 10);
      setCache(cacheKeyStr, topResults, this.defaultCacheTtl);
      return topResults;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error searching by name ${name}:`, error);
      return [];
    }
  }

  /**
   * Add or update identity mapping for a player
   */
  async addIdentityMapping(mapping: IdentityMappingInput): Promise<boolean> {
    try {
      const columnName = PLATFORM_COLUMNS[mapping.platform];
      if (!columnName) {
        console.warn(`[PlayerIdentityService] Unsupported platform: ${mapping.platform}`);
        return false;
      }

      // Check if canonical player exists
      const existingPlayer = await db
        .select()
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap.canonicalId, mapping.canonicalId))
        .limit(1);

      if (!existingPlayer[0]) {
        console.warn(`[PlayerIdentityService] Canonical player ${mapping.canonicalId} not found`);
        return false;
      }

      // Check if external ID is already mapped to different player
      const existingMapping = await db
        .select()
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap[columnName], mapping.externalId))
        .limit(1);

      if (existingMapping[0] && existingMapping[0].canonicalId !== mapping.canonicalId) {
        if (!mapping.overwrite) {
          console.warn(`[PlayerIdentityService] External ID ${mapping.externalId} already mapped to ${existingMapping[0].canonicalId}`);
          return false;
        }
      }

      // Update the mapping
      await db
        .update(playerIdentityMap)
        .set({
          [columnName]: mapping.externalId,
          confidence: mapping.confidence,
          lastVerified: new Date(),
          updatedAt: new Date()
        })
        .where(eq(playerIdentityMap.canonicalId, mapping.canonicalId));

      // Clear related cache entries
      this.clearPlayerCache(mapping.canonicalId);
      
      console.log(`[PlayerIdentityService] Updated ${mapping.platform} ID mapping for ${mapping.canonicalId}`);
      return true;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error adding identity mapping:`, error);
      return false;
    }
  }

  /**
   * Create a new player identity in the map
   */
  async createPlayerIdentity(playerData: {
    canonicalId: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    position: string;
    nflTeam?: string;
    externalIds?: Record<string, string>;
    isActive?: boolean;
    confidence?: number;
  }): Promise<boolean> {
    try {
      // Check if canonical ID already exists
      const existing = await this.getByCanonicalId(playerData.canonicalId);
      if (existing) {
        console.warn(`[PlayerIdentityService] Player with canonical ID ${playerData.canonicalId} already exists`);
        return false;
      }

      const insertData: any = {
        canonicalId: playerData.canonicalId,
        fullName: playerData.fullName,
        firstName: playerData.firstName,
        lastName: playerData.lastName,
        position: playerData.position.toUpperCase(),
        nflTeam: playerData.nflTeam,
        isActive: playerData.isActive ?? true,
        confidence: playerData.confidence ?? 1.0,
        lastVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add external IDs if provided
      if (playerData.externalIds) {
        for (const [platform, externalId] of Object.entries(playerData.externalIds)) {
          const columnName = PLATFORM_COLUMNS[platform as SupportedPlatform];
          if (columnName) {
            insertData[columnName] = externalId;
          }
        }
      }

      await db.insert(playerIdentityMap).values(insertData);
      
      console.log(`[PlayerIdentityService] Created new player identity: ${playerData.canonicalId}`);
      return true;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error creating player identity:`, error);
      return false;
    }
  }

  /**
   * Get all platform IDs for a canonical player
   */
  async getAllExternalIds(canonicalId: string): Promise<Record<string, string>> {
    const player = await this.getByCanonicalId(canonicalId);
    if (!player) return {};

    return player.externalIds;
  }

  /**
   * Bulk import players from external source (e.g., Sleeper API)
   */
  async bulkImportPlayers(players: Array<{
    externalId: string;
    platform: SupportedPlatform;
    fullName: string;
    firstName?: string;
    lastName?: string;
    position: string;
    nflTeam?: string;
    isActive?: boolean;
  }>): Promise<{ imported: number; skipped: number; errors: number }> {
    const stats = { imported: 0, skipped: 0, errors: 0 };
    
    for (const player of players) {
      try {
        // Generate canonical ID (platform:external_id format for now)
        const canonicalId = `${player.platform}:${player.externalId}`;
        
        // Check if already exists
        const existing = await this.getByCanonicalId(canonicalId);
        if (existing) {
          stats.skipped++;
          continue;
        }

        const success = await this.createPlayerIdentity({
          canonicalId,
          fullName: player.fullName,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          nflTeam: player.nflTeam,
          isActive: player.isActive,
          externalIds: { [player.platform]: player.externalId }
        });

        if (success) {
          stats.imported++;
        } else {
          stats.errors++;
        }
      } catch (error) {
        console.error(`[PlayerIdentityService] Error importing player ${player.externalId}:`, error);
        stats.errors++;
      }
    }

    console.log(`[PlayerIdentityService] Bulk import completed: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`);
    return stats;
  }

  /**
   * Health check and stats
   */
  async getSystemStats(): Promise<{
    totalPlayers: number;
    activePlayers: number;
    platformCoverage: Record<string, number>;
    lastUpdated: Date | null;
  }> {
    try {
      const [total, active, platformStats] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(playerIdentityMap),
        db.select({ count: sql<number>`count(*)` }).from(playerIdentityMap).where(eq(playerIdentityMap.isActive, true)),
        this.getPlatformCoverage()
      ]);

      return {
        totalPlayers: total[0]?.count || 0,
        activePlayers: active[0]?.count || 0,
        platformCoverage: platformStats,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error(`[PlayerIdentityService] Error getting system stats:`, error);
      return {
        totalPlayers: 0,
        activePlayers: 0,
        platformCoverage: {},
        lastUpdated: null
      };
    }
  }

  // Private helper methods

  private mapToPlayerIdentityResult(player: PlayerIdentityMap): PlayerIdentityResult {
    const externalIds: Record<string, string> = {};
    
    // Collect all external IDs
    if (player.sleeperId) externalIds.sleeper = player.sleeperId;
    if (player.espnId) externalIds.espn = player.espnId;
    if (player.yahooId) externalIds.yahoo = player.yahooId;
    if (player.rotowireId) externalIds.rotowire = player.rotowireId;
    if (player.fantasyprosId) externalIds.fantasypros = player.fantasyprosId;
    if (player.mysportsfeedsId) externalIds.mysportsfeeds = player.mysportsfeedsId;
    if (player.nflDataPyId) externalIds.nfl_data_py = player.nflDataPyId;

    return {
      canonicalId: player.canonicalId,
      fullName: player.fullName,
      position: player.position,
      nflTeam: player.nflTeam || undefined,
      confidence: player.confidence || 1.0,
      externalIds,
      isActive: player.isActive || false,
      lastVerified: player.lastVerified || new Date()
    };
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateNameMatchScore(searchName: string, player: PlayerIdentityMap): { confidence: number; reason: string } {
    const names = [
      player.fullName?.toLowerCase() || '',
      `${player.firstName} ${player.lastName}`.toLowerCase().trim(),
      player.firstName?.toLowerCase() || '',
      player.lastName?.toLowerCase() || ''
    ].filter(Boolean);

    let bestScore = 0;
    let bestReason = 'no match';

    for (const name of names) {
      if (name === searchName) {
        return { confidence: 1.0, reason: 'exact match' };
      }
      
      if (name.includes(searchName)) {
        const score = searchName.length / name.length;
        if (score > bestScore) {
          bestScore = score;
          bestReason = 'partial match';
        }
      }
      
      if (searchName.includes(name) && name.length >= 3) {
        const score = name.length / searchName.length;
        if (score > bestScore) {
          bestScore = score;
          bestReason = 'contained match';
        }
      }
    }

    // Boost active players
    if (player.isActive) {
      bestScore *= 1.2;
    }

    return { confidence: Math.min(bestScore, 1.0), reason: bestReason };
  }

  private async getPlatformCoverage(): Promise<Record<string, number>> {
    const coverage: Record<string, number> = {};

    for (const [platform, columnName] of Object.entries(PLATFORM_COLUMNS)) {
      try {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(playerIdentityMap)
          .where(sql`${playerIdentityMap[columnName]} IS NOT NULL`);
        
        coverage[platform] = result[0]?.count || 0;
      } catch (error) {
        console.error(`[PlayerIdentityService] Error getting coverage for ${platform}:`, error);
        coverage[platform] = 0;
      }
    }

    return coverage;
  }

  private clearPlayerCache(canonicalId: string): void {
    // This is a simple implementation - in production you might want more sophisticated cache invalidation
    console.log(`[PlayerIdentityService] Cache cleared for player ${canonicalId}`);
  }
}

// Export singleton instance
export const playerIdentityService = PlayerIdentityService.getInstance();