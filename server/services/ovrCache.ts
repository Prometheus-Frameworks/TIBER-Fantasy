interface CachedOVR {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  ovrRating: number;
  tier: string;
  powerScore: number;
  confidence: number;
  calculatedAt: Date;
}

class OVRCache {
  private cache: Map<string, CachedOVR[]> = new Map();
  private lastCalculation: Date | null = null;
  private readonly TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (matches ETL schedule)

  /**
   * Get cached OVR ratings, or null if expired/missing
   */
  get(cacheKey: string): CachedOVR[] | null {
    if (!this.cache.has(cacheKey)) {
      return null;
    }

    // Check if cache is stale
    if (this.lastCalculation) {
      const age = Date.now() - this.lastCalculation.getTime();
      if (age > this.TTL_MS) {
        console.log('⚠️ [OVRCache] Cache expired, will recalculate');
        this.cache.clear();
        return null;
      }
    }

    console.log(`✅ [OVRCache] Serving from cache: ${cacheKey}`);
    return this.cache.get(cacheKey) || null;
  }

  /**
   * Store OVR ratings in cache
   */
  set(cacheKey: string, data: CachedOVR[]): void {
    this.cache.set(cacheKey, data);
    this.lastCalculation = new Date();
    console.log(`💾 [OVRCache] Cached ${data.length} players for key: ${cacheKey}`);
  }

  /**
   * Invalidate cache (call after ETL runs)
   */
  invalidate(): void {
    this.cache.clear();
    this.lastCalculation = null;
    console.log('🗑️ [OVRCache] Cache invalidated');
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      lastCalculation: this.lastCalculation,
      ttlHours: this.TTL_MS / (60 * 60 * 1000),
      isExpired: this.lastCalculation 
        ? (Date.now() - this.lastCalculation.getTime()) > this.TTL_MS
        : true
    };
  }
}

// Export singleton instance
export const ovrCache = new OVRCache();
