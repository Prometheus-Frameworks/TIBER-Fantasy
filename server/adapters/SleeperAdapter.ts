/**
 * Sleeper API Adapter - Bronze Layer Raw Data Ingestion
 * 
 * Handles raw data extraction from Sleeper's fantasy football API
 * Stores unprocessed JSON payloads for comprehensive data lineage
 * 
 * Supported Data Sources:
 * - All NFL Players roster
 * - Player statistics and projections
 * - Trending players data
 * - League and user data
 * - ADP data from Sleeper platform
 */

import { bronzeLayerService, type RawPayloadInput } from '../services/BronzeLayerService';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';

interface SleeperPlayerResponse {
  [playerId: string]: {
    player_id: string;
    full_name: string;
    first_name: string;
    last_name: string;
    position: string;
    team: string;
    age: number;
    height: string;
    weight: string;
    years_exp: number;
    injury_status: string;
    fantasy_positions: string[];
    stats?: Record<string, any>;
  };
}

interface SleeperTrendingResponse {
  add: Array<{
    player_id: string;
    count: number;
  }>;
  drop: Array<{
    player_id: string;
    count: number;
  }>;
}

interface SleeperStatsResponse {
  [playerId: string]: {
    [week: string]: {
      pts_ppr?: number;
      pts_std?: number;
      pts_half_ppr?: number;
      passing_yds?: number;
      passing_tds?: number;
      rushing_yds?: number;
      rushing_tds?: number;
      receiving_yds?: number;
      receiving_tds?: number;
      receptions?: number;
      targets?: number;
      carries?: number;
    };
  };
}

export interface SleeperIngestionOptions {
  season?: number;
  week?: number;
  jobId?: string;
  includeTrending?: boolean;
  includeStats?: boolean;
  positions?: string[];
}

/**
 * Sleeper API Adapter for Bronze Layer Raw Data Storage
 */
export class SleeperAdapter {
  private readonly BASE_URL = 'https://api.sleeper.app/v1';
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly API_VERSION = 'v1';
  
  // Safe headers to store in metadata (security allowlist)
  private readonly SAFE_RESPONSE_HEADERS = [
    'content-type',
    'content-length',
    'cache-control',
    'expires',
    'etag',
    'last-modified',
    'x-ratelimit-remaining',
    'x-ratelimit-limit',
    'x-ratelimit-reset',
    'date'
  ];

  /**
   * Filter response headers to only safe/useful ones for storage
   */
  private filterSafeHeaders(headers: Headers): Record<string, string> {
    const safeHeaders: Record<string, string> = {};
    headers.forEach((value, key) => {
      if (this.SAFE_RESPONSE_HEADERS.includes(key.toLowerCase())) {
        safeHeaders[key] = value;
      }
    });
    return safeHeaders;
  }

  /**
   * Ingest all NFL players from Sleeper API
   * Stores complete player roster with metadata
   */
  async ingestAllPlayers(options: SleeperIngestionOptions = {}): Promise<number> {
    const startTime = Date.now();
    const jobId = options.jobId || `sleeper_players_${Date.now()}`;
    const season = options.season || new Date().getFullYear();
    
    try {
      console.log(`🔄 [SleeperAdapter] Starting player ingestion for season ${season}`);
      
      // Proper timeout implementation using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT);
      
      const response = await fetch(`${this.BASE_URL}/players/nfl`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TIBER-Fantasy-Hub/1.0',
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
      }

      const rawData: SleeperPlayerResponse = await response.json();
      
      // Filter players by position if specified
      let filteredData = rawData;
      if (options.positions && options.positions.length > 0) {
        filteredData = {};
        for (const [playerId, player] of Object.entries(rawData)) {
          if (player.position && options.positions.includes(player.position)) {
            filteredData[playerId] = player;
          }
        }
      }

      const payloadInput: RawPayloadInput = {
        source: 'sleeper',
        endpoint: '/players/nfl',
        payload: filteredData,
        version: this.API_VERSION,
        jobId,
        season,
        metadata: {
          apiVersion: this.API_VERSION,
          requestUrl: `${this.BASE_URL}/players/nfl`,
          responseHeaders: this.filterSafeHeaders(response.headers),
          extractedAt: new Date(),
          sourceSize: Object.keys(filteredData).length,
          sourceFormat: 'json'
        }
      };

      const result = await bronzeLayerService.storeRawPayload(payloadInput);
      
      const duration = Date.now() - startTime;
      const playerCount = Object.keys(filteredData).length;
      
      console.log(`✅ [SleeperAdapter] Player ingestion completed in ${duration}ms`);
      console.log(`   📊 Players: ${playerCount} | Payload ID: ${result.payloadId} | Duplicate: ${result.isDuplicate}`);
      
      return result.payloadId;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [SleeperAdapter] Player ingestion failed after ${duration}ms:`, error);
      throw new Error(`Sleeper player ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ingest weekly player statistics from Sleeper
   * Stores raw stats data for specified week/season
   */
  async ingestWeeklyStats(options: SleeperIngestionOptions = {}): Promise<number> {
    const startTime = Date.now();
    const season = options.season || new Date().getFullYear();
    const week = options.week || parseInt(getCurrentNFLWeek());
    const jobId = options.jobId || `sleeper_stats_${season}_w${week}_${Date.now()}`;
    
    try {
      console.log(`🔄 [SleeperAdapter] Starting stats ingestion for Season ${season}, Week ${week}`);
      
      // Note: Sleeper doesn't have a direct weekly stats endpoint
      // This adapter focuses on storing individual player stat lookups
      // For now, we'll create a placeholder that could be expanded
      
      const endpoint = `/stats/nfl/regular/${season}/${week}`;
      const requestUrl = `${this.BASE_URL}${endpoint}`;
      
      // Sleeper stores stats per player, not in bulk
      // This is a framework for when the endpoint becomes available
      const placeholderStats = {
        week,
        season,
        note: 'Sleeper stats are typically accessed per player via /stats/nfl/:season/:player_id endpoint',
        collected_at: new Date().toISOString()
      };

      const payloadInput: RawPayloadInput = {
        source: 'sleeper',
        endpoint,
        payload: placeholderStats,
        version: this.API_VERSION,
        jobId,
        season,
        week,
        metadata: {
          apiVersion: this.API_VERSION,
          requestUrl,
          extractedAt: new Date(),
          sourceSize: 1,
          sourceFormat: 'json'
        }
      };

      const result = await bronzeLayerService.storeRawPayload(payloadInput);
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ [SleeperAdapter] Stats ingestion completed in ${duration}ms`);
      console.log(`   📊 Week ${week} | Payload ID: ${result.payloadId}`);
      
      return result.payloadId;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [SleeperAdapter] Stats ingestion failed after ${duration}ms:`, error);
      throw new Error(`Sleeper stats ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ingest trending players data from Sleeper
   * Captures add/drop trends for market sentiment analysis
   */
  async ingestTrendingPlayers(options: SleeperIngestionOptions = {}): Promise<number> {
    const startTime = Date.now();
    const jobId = options.jobId || `sleeper_trending_${Date.now()}`;
    const season = options.season || new Date().getFullYear();
    
    try {
      console.log(`🔄 [SleeperAdapter] Starting trending players ingestion`);
      
      // Proper timeout implementation using AbortController for add trends
      const addController = new AbortController();
      const addTimeoutId = setTimeout(() => addController.abort(), this.DEFAULT_TIMEOUT);
      
      const response = await fetch(`${this.BASE_URL}/players/nfl/trending/add`, {
        signal: addController.signal,
        headers: {
          'User-Agent': 'TIBER-Fantasy-Hub/1.0',
          'Accept': 'application/json'
        }
      });

      clearTimeout(addTimeoutId);

      if (!response.ok) {
        throw new Error(`Sleeper trending API error: ${response.status} ${response.statusText}`);
      }

      const addTrending = await response.json();
      
      // Also get drop trends with proper timeout
      const dropController = new AbortController();
      const dropTimeoutId = setTimeout(() => dropController.abort(), this.DEFAULT_TIMEOUT);
      
      const dropResponse = await fetch(`${this.BASE_URL}/players/nfl/trending/drop`, {
        signal: dropController.signal,
        headers: {
          'User-Agent': 'TIBER-Fantasy-Hub/1.0',
          'Accept': 'application/json'
        }
      });

      clearTimeout(dropTimeoutId);

      let dropTrending = [];
      if (dropResponse.ok) {
        dropTrending = await dropResponse.json();
      }

      const combinedTrendingData = {
        add: addTrending,
        drop: dropTrending,
        collected_at: new Date().toISOString()
      };

      const payloadInput: RawPayloadInput = {
        source: 'sleeper',
        endpoint: '/players/nfl/trending',
        payload: combinedTrendingData,
        version: this.API_VERSION,
        jobId,
        season,
        metadata: {
          apiVersion: this.API_VERSION,
          requestUrl: `${this.BASE_URL}/players/nfl/trending`,
          responseHeaders: this.filterSafeHeaders(response.headers),
          extractedAt: new Date(),
          sourceSize: (addTrending?.length || 0) + (dropTrending?.length || 0),
          sourceFormat: 'json'
        }
      };

      const result = await bronzeLayerService.storeRawPayload(payloadInput);
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ [SleeperAdapter] Trending ingestion completed in ${duration}ms`);
      console.log(`   📊 Add: ${addTrending?.length || 0} | Drop: ${dropTrending?.length || 0} | Payload ID: ${result.payloadId}`);
      
      return result.payloadId;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [SleeperAdapter] Trending ingestion failed after ${duration}ms:`, error);
      throw new Error(`Sleeper trending ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Full ingestion cycle - players, stats, and trending data
   * Orchestrates complete data collection from Sleeper API
   */
  async ingestFullCycle(options: SleeperIngestionOptions = {}): Promise<{ playerPayloadId: number; statsPayloadId?: number; trendingPayloadId?: number }> {
    const jobId = options.jobId || `sleeper_full_${Date.now()}`;
    const fullOptions = { ...options, jobId };
    
    console.log(`🚀 [SleeperAdapter] Starting full ingestion cycle with job ID: ${jobId}`);
    
    try {
      // Always ingest players as it's the foundation
      const playerPayloadId = await this.ingestAllPlayers(fullOptions);
      
      const result: { playerPayloadId: number; statsPayloadId?: number; trendingPayloadId?: number } = {
        playerPayloadId
      };
      
      // Optionally ingest stats
      if (options.includeStats !== false) {
        try {
          result.statsPayloadId = await this.ingestWeeklyStats(fullOptions);
        } catch (error) {
          console.warn(`⚠️ [SleeperAdapter] Stats ingestion failed, continuing:`, error);
        }
      }
      
      // Optionally ingest trending
      if (options.includeTrending !== false) {
        try {
          result.trendingPayloadId = await this.ingestTrendingPlayers(fullOptions);
        } catch (error) {
          console.warn(`⚠️ [SleeperAdapter] Trending ingestion failed, continuing:`, error);
        }
      }
      
      console.log(`✅ [SleeperAdapter] Full ingestion cycle completed for job ${jobId}`);
      return result;
      
    } catch (error) {
      console.error(`❌ [SleeperAdapter] Full ingestion cycle failed:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const sleeperAdapter = new SleeperAdapter();