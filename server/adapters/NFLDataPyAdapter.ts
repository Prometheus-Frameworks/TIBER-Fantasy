/**
 * NFL-Data-Py Adapter - Bronze Layer Raw Data Ingestion
 * 
 * Handles raw data extraction from NFL-Data-Py statistical data
 * Note: NFL-Data-Py integration is currently deprecated but adapter maintained for future use
 * 
 * Supported Data Sources:
 * - Advanced player statistics
 * - Player roster data
 * - Weekly performance metrics
 * - Tracking data (when available)
 */

import { bronzeLayerService, type RawPayloadInput } from '../services/BronzeLayerService';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';

export interface NFLDataPyPlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  season: number;
  week?: number;
  
  // Receiving Advanced Metrics
  yards_per_route_run?: number;
  target_share?: number;
  air_yards_share?: number;
  wopr?: number; // Weighted Opportunity Rating
  racr?: number; // Receiver Air Conversion Ratio
  targets?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  
  // Rushing Advanced Metrics
  yards_after_contact?: number;
  yards_before_contact?: number;
  breakaway_yards?: number;
  rushing_yards_over_expected?: number;
  
  // QB Advanced Metrics  
  epa_per_play?: number;
  completion_percentage_over_expected?: number;
  air_yards_per_attempt?: number;
  time_to_throw?: number;
  
  // Fantasy Points
  fantasy_points?: number;
  fantasy_points_ppr?: number;
}

export interface NFLDataPyIngestionOptions {
  season?: number;
  week?: number;
  jobId?: string;
  positions?: string[];
  includeAdvanced?: boolean;
  mockData?: boolean; // For testing when service is deprecated
}

/**
 * NFL-Data-Py Adapter for Bronze Layer Raw Data Storage
 * Currently in deprecated state but maintains structure for future reactivation
 */
export class NFLDataPyAdapter {
  private readonly SERVICE_DEPRECATED = true;
  private readonly API_VERSION = 'deprecated';

  /**
   * Ingest NFL advanced statistics
   * Currently returns mock data due to service deprecation
   */
  async ingestAdvancedStats(options: NFLDataPyIngestionOptions = {}): Promise<number> {
    const startTime = Date.now();
    const season = options.season || new Date().getFullYear();
    const week = options.week || parseInt(getCurrentNFLWeek());
    const jobId = options.jobId || `nfl_data_py_advanced_${season}_w${week}_${Date.now()}`;
    
    try {
      console.log(`🔄 [NFLDataPyAdapter] Starting advanced stats ingestion for Season ${season}, Week ${week}`);
      
      if (this.SERVICE_DEPRECATED && !options.mockData) {
        console.warn(`⚠️ [NFLDataPyAdapter] Service deprecated, storing deprecation notice`);
        
        const deprecationNotice = {
          status: 'DEPRECATED',
          message: 'NFL-Data-Py service disabled by TIBER directive',
          season,
          week,
          requested_at: new Date().toISOString(),
          alternative_sources: ['sleeper', 'fantasypros', 'mysportsfeeds']
        };

        const payloadInput: RawPayloadInput = {
          source: 'nfl_data_py',
          endpoint: '/advanced_stats',
          payload: deprecationNotice,
          version: this.API_VERSION,
          jobId,
          season,
          week,
          metadata: {
            apiVersion: this.API_VERSION,
            extractedAt: new Date(),
            sourceSize: 1,
            sourceFormat: 'json',
            deprecationNotice: true
          }
        };

        const result = await bronzeLayerService.storeRawPayload(payloadInput);
        
        // Mark as failed due to deprecation
        await bronzeLayerService.updatePayloadStatus(
          result.payloadId, 
          'FAILED', 
          'Service deprecated by TIBER directive'
        );
        
        const duration = Date.now() - startTime;
        console.log(`⚠️ [NFLDataPyAdapter] Deprecation notice stored in ${duration}ms | Payload ID: ${result.payloadId}`);
        
        return result.payloadId;
      }
      
      // Mock data for testing when service might be reactivated
      if (options.mockData) {
        const mockAdvancedStats: NFLDataPyPlayer[] = [
          {
            player_id: 'mock_josh_allen',
            player_name: 'Josh Allen',
            position: 'QB',
            team: 'BUF',
            season,
            week,
            epa_per_play: 0.15,
            completion_percentage_over_expected: 2.3,
            air_yards_per_attempt: 8.7,
            time_to_throw: 2.65,
            fantasy_points: 23.4,
            fantasy_points_ppr: 23.4
          },
          {
            player_id: 'mock_tyreek_hill',
            player_name: 'Tyreek Hill',
            position: 'WR',
            team: 'MIA',
            season,
            week,
            yards_per_route_run: 2.8,
            target_share: 0.28,
            air_yards_share: 0.35,
            wopr: 0.65,
            racr: 1.2,
            targets: 8,
            receptions: 6,
            receiving_yards: 95,
            receiving_tds: 1,
            fantasy_points: 21.5,
            fantasy_points_ppr: 27.5
          }
        ];
        
        // Filter by position if specified
        let filteredData = mockAdvancedStats;
        if (options.positions && options.positions.length > 0) {
          filteredData = mockAdvancedStats.filter(player => 
            options.positions!.includes(player.position)
          );
        }

        const payloadInput: RawPayloadInput = {
          source: 'nfl_data_py',
          endpoint: '/advanced_stats',
          payload: { players: filteredData, mock: true },
          version: 'mock_v1',
          jobId,
          season,
          week,
          metadata: {
            apiVersion: 'mock_v1',
            extractedAt: new Date(),
            sourceSize: filteredData.length,
            sourceFormat: 'json',
            mockData: true
          }
        };

        const result = await bronzeLayerService.storeRawPayload(payloadInput);
        
        const duration = Date.now() - startTime;
        console.log(`✅ [NFLDataPyAdapter] Mock advanced stats stored in ${duration}ms`);
        console.log(`   📊 Players: ${filteredData.length} | Payload ID: ${result.payloadId}`);
        
        return result.payloadId;
      }
      
      throw new Error('NFL-Data-Py service is deprecated and mock data not requested');

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [NFLDataPyAdapter] Advanced stats ingestion failed after ${duration}ms:`, error);
      throw new Error(`NFL-Data-Py advanced stats ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ingest roster data from NFL-Data-Py
   * Currently returns deprecation notice or mock data
   */
  async ingestRosterData(options: NFLDataPyIngestionOptions = {}): Promise<number> {
    const startTime = Date.now();
    const season = options.season || new Date().getFullYear();
    const jobId = options.jobId || `nfl_data_py_roster_${season}_${Date.now()}`;
    
    try {
      console.log(`🔄 [NFLDataPyAdapter] Starting roster ingestion for Season ${season}`);
      
      if (this.SERVICE_DEPRECATED && !options.mockData) {
        const deprecationNotice = {
          status: 'DEPRECATED',
          message: 'NFL-Data-Py roster service disabled',
          season,
          requested_at: new Date().toISOString()
        };

        const payloadInput: RawPayloadInput = {
          source: 'nfl_data_py',
          endpoint: '/roster',
          payload: deprecationNotice,
          version: this.API_VERSION,
          jobId,
          season,
          metadata: {
            apiVersion: this.API_VERSION,
            extractedAt: new Date(),
            sourceSize: 1,
            sourceFormat: 'json',
            deprecationNotice: true
          }
        };

        const result = await bronzeLayerService.storeRawPayload(payloadInput);
        await bronzeLayerService.updatePayloadStatus(
          result.payloadId, 
          'FAILED', 
          'Service deprecated'
        );
        
        return result.payloadId;
      }
      
      // Mock roster data for testing
      if (options.mockData) {
        const mockRosterData = {
          season,
          teams: {
            'BUF': {
              players: [
                { player_id: 'mock_josh_allen', name: 'Josh Allen', position: 'QB', status: 'ACT' },
                { player_id: 'mock_stefon_diggs', name: 'Stefon Diggs', position: 'WR', status: 'ACT' }
              ]
            },
            'MIA': {
              players: [
                { player_id: 'mock_tua', name: 'Tua Tagovailoa', position: 'QB', status: 'ACT' },
                { player_id: 'mock_tyreek', name: 'Tyreek Hill', position: 'WR', status: 'ACT' }
              ]
            }
          },
          collected_at: new Date().toISOString(),
          mock: true
        };

        const payloadInput: RawPayloadInput = {
          source: 'nfl_data_py',
          endpoint: '/roster',
          payload: mockRosterData,
          version: 'mock_v1',
          jobId,
          season,
          metadata: {
            apiVersion: 'mock_v1',
            extractedAt: new Date(),
            sourceSize: Object.keys(mockRosterData.teams).length,
            sourceFormat: 'json',
            mockData: true
          }
        };

        const result = await bronzeLayerService.storeRawPayload(payloadInput);
        
        console.log(`✅ [NFLDataPyAdapter] Mock roster data stored | Payload ID: ${result.payloadId}`);
        return result.payloadId;
      }
      
      throw new Error('NFL-Data-Py service is deprecated and mock data not requested');

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [NFLDataPyAdapter] Roster ingestion failed after ${duration}ms:`, error);
      throw new Error(`NFL-Data-Py roster ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Full ingestion cycle for NFL-Data-Py data
   * Currently handles deprecation gracefully
   */
  async ingestFullCycle(options: NFLDataPyIngestionOptions = {}): Promise<{ advancedStatsPayloadId: number; rosterPayloadId: number }> {
    const jobId = options.jobId || `nfl_data_py_full_${Date.now()}`;
    const fullOptions = { ...options, jobId };
    
    console.log(`🚀 [NFLDataPyAdapter] Starting full ingestion cycle (deprecated service)`);
    
    try {
      const advancedStatsPayloadId = await this.ingestAdvancedStats(fullOptions);
      const rosterPayloadId = await this.ingestRosterData(fullOptions);
      
      console.log(`⚠️ [NFLDataPyAdapter] Full ingestion cycle completed (deprecated) for job ${jobId}`);
      
      return {
        advancedStatsPayloadId,
        rosterPayloadId
      };
      
    } catch (error) {
      console.error(`❌ [NFLDataPyAdapter] Full ingestion cycle failed:`, error);
      throw error;
    }
  }

  /**
   * Check if service is available (always returns false due to deprecation)
   */
  isServiceAvailable(): boolean {
    return false;
  }

  /**
   * Get service status information
   */
  getServiceStatus(): { available: boolean; deprecated: boolean; message: string } {
    return {
      available: false,
      deprecated: true,
      message: 'NFL-Data-Py service disabled by TIBER directive'
    };
  }
}

// Export singleton instance
export const nflDataPyAdapter = new NFLDataPyAdapter();