/**
 * Identity Resolver for Sleeper Sync V2
 * Resolves Sleeper player IDs to our canonical player_key format
 * 
 * Priority:
 * 1. If identity map resolves to gsis_id -> return gsis_id
 * 2. Try sleeper_id column in identity map
 * 3. Fall back to `sleeper:<id>` and log unresolved count
 * 
 * NEVER throws for unknown players - returns fallback key
 */

import { db } from '../../infra/db';
import { playerIdentityMap } from '@shared/schema';
import { eq, or } from 'drizzle-orm';

export interface ResolverStats {
  total: number;
  resolvedByGsisId: number;
  resolvedBySleeperId: number;
  unresolved: number;
}

let resolverStats: ResolverStats = {
  total: 0,
  resolvedByGsisId: 0,
  resolvedBySleeperId: 0,
  unresolved: 0
};

/**
 * Reset resolver stats (call at start of sync)
 */
export function resetResolverStats(): void {
  resolverStats = {
    total: 0,
    resolvedByGsisId: 0,
    resolvedBySleeperId: 0,
    unresolved: 0
  };
}

/**
 * Get current resolver stats
 */
export function getResolverStats(): ResolverStats {
  return { ...resolverStats };
}

// In-memory cache for batch resolving (reset per sync)
const resolverCache = new Map<string, string>();

/**
 * Clear resolver cache (call at start of sync)
 */
export function clearResolverCache(): void {
  resolverCache.clear();
}

/**
 * Resolve a Sleeper player ID to our canonical player_key
 * 
 * @param sleeperPlayerId - The Sleeper player ID (string)
 * @returns player_key (gsis_id preferred, else `sleeper:<id>`)
 */
export async function resolveSleeperPlayerKey(sleeperPlayerId: string): Promise<string> {
  resolverStats.total++;
  
  // Check cache first
  const cached = resolverCache.get(sleeperPlayerId);
  if (cached) {
    return cached;
  }
  
  try {
    // Query identity map - look for sleeper_id match
    const result = await db
      .select({
        gsisId: playerIdentityMap.gsisId,
        sleeperId: playerIdentityMap.sleeperId,
        canonicalId: playerIdentityMap.canonicalId
      })
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.sleeperId, sleeperPlayerId))
      .limit(1);
    
    if (result.length > 0) {
      const record = result[0];
      
      // Prefer gsis_id if available
      if (record.gsisId) {
        resolverStats.resolvedByGsisId++;
        resolverCache.set(sleeperPlayerId, record.gsisId);
        return record.gsisId;
      }
      
      // Fall back to canonical_id if no gsis_id
      if (record.canonicalId) {
        resolverStats.resolvedBySleeperId++;
        resolverCache.set(sleeperPlayerId, record.canonicalId);
        return record.canonicalId;
      }
    }
    
    // Unresolved - return fallback key
    resolverStats.unresolved++;
    const fallbackKey = `sleeper:${sleeperPlayerId}`;
    resolverCache.set(sleeperPlayerId, fallbackKey);
    
    return fallbackKey;
  } catch (error) {
    // Never throw - return fallback key on error
    console.error(`[IdentityResolver] Error resolving sleeper player ${sleeperPlayerId}:`, error);
    resolverStats.unresolved++;
    const fallbackKey = `sleeper:${sleeperPlayerId}`;
    resolverCache.set(sleeperPlayerId, fallbackKey);
    return fallbackKey;
  }
}

/**
 * Batch resolve multiple Sleeper player IDs (more efficient)
 * 
 * @param sleeperPlayerIds - Array of Sleeper player IDs
 * @returns Map of sleeperPlayerId -> player_key
 */
export async function batchResolveSleeperPlayerKeys(
  sleeperPlayerIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  // Filter out already cached IDs
  const uncached = sleeperPlayerIds.filter(id => !resolverCache.has(id));
  
  // Return cached results for those we have
  for (const id of sleeperPlayerIds) {
    const cached = resolverCache.get(id);
    if (cached) {
      result.set(id, cached);
    }
  }
  
  if (uncached.length === 0) {
    return result;
  }
  
  try {
    // Batch query for all uncached IDs
    const rows = await db
      .select({
        gsisId: playerIdentityMap.gsisId,
        sleeperId: playerIdentityMap.sleeperId,
        canonicalId: playerIdentityMap.canonicalId
      })
      .from(playerIdentityMap)
      .where(
        or(...uncached.map(id => eq(playerIdentityMap.sleeperId, id)))
      );
    
    // Build lookup map from results
    const sleeperToRecord = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      if (row.sleeperId) {
        sleeperToRecord.set(row.sleeperId, row);
      }
    }
    
    // Process each uncached ID
    for (const sleeperPlayerId of uncached) {
      resolverStats.total++;
      const record = sleeperToRecord.get(sleeperPlayerId);
      
      if (record) {
        if (record.gsisId) {
          resolverStats.resolvedByGsisId++;
          resolverCache.set(sleeperPlayerId, record.gsisId);
          result.set(sleeperPlayerId, record.gsisId);
        } else if (record.canonicalId) {
          resolverStats.resolvedBySleeperId++;
          resolverCache.set(sleeperPlayerId, record.canonicalId);
          result.set(sleeperPlayerId, record.canonicalId);
        } else {
          // Record exists but no usable ID
          resolverStats.unresolved++;
          const fallbackKey = `sleeper:${sleeperPlayerId}`;
          resolverCache.set(sleeperPlayerId, fallbackKey);
          result.set(sleeperPlayerId, fallbackKey);
        }
      } else {
        // No match found
        resolverStats.unresolved++;
        const fallbackKey = `sleeper:${sleeperPlayerId}`;
        resolverCache.set(sleeperPlayerId, fallbackKey);
        result.set(sleeperPlayerId, fallbackKey);
      }
    }
  } catch (error) {
    console.error('[IdentityResolver] Batch resolve error:', error);
    // On error, use fallback keys for all uncached
    for (const sleeperPlayerId of uncached) {
      resolverStats.total++;
      resolverStats.unresolved++;
      const fallbackKey = `sleeper:${sleeperPlayerId}`;
      resolverCache.set(sleeperPlayerId, fallbackKey);
      result.set(sleeperPlayerId, fallbackKey);
    }
  }
  
  return result;
}
