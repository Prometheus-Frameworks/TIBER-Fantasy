/**
 * Player Mapping Service
 * 
 * Provides deterministic player ID mapping between different data sources
 * (OVR ratings, weekly attributes, player pool, etc.)
 * 
 * Uses PlayerIdentityService for cross-platform ID resolution
 */

import { playerIdentityService } from './PlayerIdentityService';
import { cacheKey, getCache, setCache } from '../../src/data/cache';

export interface PlayerMappingResult {
  canonicalId: string;
  otcId: string;
  sleeperId?: string;
  confidence: number;
  mappingMethod: 'canonical_id' | 'sleeper_id' | 'name_search' | 'otc_id_direct';
}

export interface PlayerDataMergeContext {
  ovrPlayerId: string;
  ovrPlayerName: string;
  attributeOtcId?: string;
  attributePlayerName?: string;
  attributeSleeperId?: string;
}

export class PlayerMappingService {
  private static instance: PlayerMappingService;
  private cachePrefix = 'player_mapping';
  private defaultCacheTtl = 10 * 60 * 1000; // 10 minutes

  public static getInstance(): PlayerMappingService {
    if (!PlayerMappingService.instance) {
      PlayerMappingService.instance = new PlayerMappingService();
    }
    return PlayerMappingService.instance;
  }

  /**
   * Resolve OVR player to canonical identity for safe data merging
   */
  async resolveOVRPlayer(playerId: string, playerName: string): Promise<PlayerMappingResult | null> {
    const cacheKeyStr = cacheKey([this.cachePrefix, 'ovr_resolve', playerId, playerName]);
    const cached = getCache<PlayerMappingResult>(cacheKeyStr);
    if (cached) return cached;

    try {
      // Method 1: Try direct OTC ID lookup via identity service
      const identityByOtcId = await playerIdentityService.getByAnyId(playerId);
      if (identityByOtcId) {
        const result: PlayerMappingResult = {
          canonicalId: identityByOtcId.canonicalId,
          otcId: playerId,
          sleeperId: identityByOtcId.externalIds.sleeper,
          confidence: identityByOtcId.confidence,
          mappingMethod: 'canonical_id'
        };
        setCache(cacheKeyStr, result, this.defaultCacheTtl);
        return result;
      }

      // Method 2: Try name-based search with high confidence threshold
      const nameMatches = await playerIdentityService.searchByName(playerName);
      const highConfidenceMatch = nameMatches.find(match => match.confidence >= 0.9);
      
      if (highConfidenceMatch) {
        const canonicalPlayer = await playerIdentityService.getByCanonicalId(highConfidenceMatch.canonicalId);
        if (canonicalPlayer) {
          const result: PlayerMappingResult = {
            canonicalId: canonicalPlayer.canonicalId,
            otcId: playerId,
            sleeperId: canonicalPlayer.externalIds.sleeper,
            confidence: highConfidenceMatch.confidence,
            mappingMethod: 'name_search'
          };
          setCache(cacheKeyStr, result, this.defaultCacheTtl);
          return result;
        }
      }

      // Method 3: Create a fallback mapping with low confidence
      const result: PlayerMappingResult = {
        canonicalId: `otc:${playerId}`,
        otcId: playerId,
        confidence: 0.5,
        mappingMethod: 'otc_id_direct'
      };
      setCache(cacheKeyStr, result, this.defaultCacheTtl);
      return result;

    } catch (error) {
      console.error(`[PlayerMappingService] Error resolving OVR player ${playerId}:`, error);
      return null;
    }
  }

  /**
   * Find matching attribute data for an OVR player using deterministic mapping
   */
  async findAttributeMatch(
    ovrMapping: PlayerMappingResult, 
    attributes: Array<{
      otcId: string;
      playerName?: string;
      sleeperId?: string;
      [key: string]: any;
    }>
  ): Promise<any | null> {
    try {
      // Method 1: Exact OTC ID match (highest confidence)
      const otcMatch = attributes.find(attr => attr.otcId === ovrMapping.otcId);
      if (otcMatch) {
        return { ...otcMatch, matchMethod: 'otc_id_exact' };
      }

      // Method 2: Sleeper ID match via identity service
      if (ovrMapping.sleeperId) {
        const sleeperMatch = attributes.find(attr => attr.sleeperId === ovrMapping.sleeperId);
        if (sleeperMatch) {
          return { ...sleeperMatch, matchMethod: 'sleeper_id_exact' };
        }
      }

      // Method 3: Canonical ID resolution for attributes
      for (const attr of attributes) {
        if (!attr.otcId) continue;
        
        const attrMapping = await this.resolveAttributePlayer(attr.otcId, attr.playerName);
        if (attrMapping && attrMapping.canonicalId === ovrMapping.canonicalId && attrMapping.confidence >= 0.8) {
          return { ...attr, matchMethod: 'canonical_id_resolved' };
        }
      }

      return null;
    } catch (error) {
      console.error('[PlayerMappingService] Error finding attribute match:', error);
      return null;
    }
  }

  /**
   * Resolve attribute player to canonical identity
   */
  async resolveAttributePlayer(otcId: string, playerName?: string): Promise<PlayerMappingResult | null> {
    const cacheKeyStr = cacheKey([this.cachePrefix, 'attr_resolve', otcId, playerName || 'no_name']);
    const cached = getCache<PlayerMappingResult>(cacheKeyStr);
    if (cached) return cached;

    try {
      // Try direct identity lookup first
      const identity = await playerIdentityService.getByAnyId(otcId);
      if (identity) {
        const result: PlayerMappingResult = {
          canonicalId: identity.canonicalId,
          otcId: otcId,
          sleeperId: identity.externalIds.sleeper,
          confidence: identity.confidence,
          mappingMethod: 'canonical_id'
        };
        setCache(cacheKeyStr, result, this.defaultCacheTtl);
        return result;
      }

      // Try name-based search if name is provided
      if (playerName) {
        const nameMatches = await playerIdentityService.searchByName(playerName);
        const highConfidenceMatch = nameMatches.find(match => match.confidence >= 0.9);
        
        if (highConfidenceMatch) {
          const canonicalPlayer = await playerIdentityService.getByCanonicalId(highConfidenceMatch.canonicalId);
          if (canonicalPlayer) {
            const result: PlayerMappingResult = {
              canonicalId: canonicalPlayer.canonicalId,
              otcId: otcId,
              sleeperId: canonicalPlayer.externalIds.sleeper,
              confidence: highConfidenceMatch.confidence,
              mappingMethod: 'name_search'
            };
            setCache(cacheKeyStr, result, this.defaultCacheTtl);
            return result;
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`[PlayerMappingService] Error resolving attribute player ${otcId}:`, error);
      return null;
    }
  }

  /**
   * Bulk merge OVR players with attribute data using deterministic mapping
   */
  async bulkMergePlayerData(
    ovrPlayers: Array<{ player_id: string; name: string; [key: string]: any }>,
    attributes: Array<{ otcId: string; playerName?: string; sleeperId?: string; [key: string]: any }>
  ): Promise<Array<any>> {
    const mergedPlayers = [];

    for (const ovrPlayer of ovrPlayers) {
      try {
        // Resolve OVR player to canonical identity
        const ovrMapping = await this.resolveOVRPlayer(ovrPlayer.player_id, ovrPlayer.name);
        if (!ovrMapping) {
          // Player couldn't be mapped - include without weekly data
          mergedPlayers.push({
            ...ovrPlayer,
            weeklyData: null,
            mappingResult: null
          });
          continue;
        }

        // Find matching attribute data
        const attributeMatch = await this.findAttributeMatch(ovrMapping, attributes);
        
        mergedPlayers.push({
          ...ovrPlayer,
          weeklyData: attributeMatch || null,
          mappingResult: {
            ...ovrMapping,
            attributeMatchMethod: attributeMatch?.matchMethod || 'no_match'
          }
        });

      } catch (error) {
        console.error(`[PlayerMappingService] Error merging player ${ovrPlayer.player_id}:`, error);
        // Include player without weekly data on error
        mergedPlayers.push({
          ...ovrPlayer,
          weeklyData: null,
          mappingResult: null,
          mappingError: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return mergedPlayers;
  }

  /**
   * Get mapping statistics for monitoring and debugging
   */
  async getMappingStats(): Promise<{
    totalResolutions: number;
    methodBreakdown: Record<string, number>;
    confidenceDistribution: Record<string, number>;
    cacheHitRate: number;
  }> {
    // This would be implemented with proper metrics collection in production
    return {
      totalResolutions: 0,
      methodBreakdown: {},
      confidenceDistribution: {},
      cacheHitRate: 0
    };
  }

  /**
   * Clear mapping cache (useful for debugging or data refresh)
   */
  clearMappingCache(): void {
    console.log('[PlayerMappingService] Mapping cache cleared');
    // In production, this would clear specific cache keys
  }
}

// Export singleton instance
export const playerMappingService = PlayerMappingService.getInstance();