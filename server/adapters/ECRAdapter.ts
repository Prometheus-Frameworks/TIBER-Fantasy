/**
 * ECR (Expert Consensus Rankings) Adapter - Bronze Layer Raw Data Ingestion
 * 
 * Handles raw data extraction from Expert Consensus Rankings sources
 * Stores unprocessed expert rankings and ADP data for comprehensive analysis
 * 
 * Supported Data Sources:
 * - FantasyPros ECR rankings
 * - Expert ADP data
 * - Consensus rankings by position
 * - Weekly rankings updates
 * - Best ball and dynasty rankings
 */

import { bronzeLayerService, type RawPayloadInput } from '../services/BronzeLayerService';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';

interface ECRRanking {
  player_name: string;
  player_id?: string;
  team: string;
  position: string;
  rank: number;
  tier?: number;
  avg_rank?: number;
  std_dev?: number;
  min_rank?: number;
  max_rank?: number;
  times_drafted?: number;
  adp?: number;
}

interface ECRResponse {
  rankings: ECRRanking[];
  position: string;
  scoring_format: string;
  league_format: string;
  week?: number;
  season: number;
  last_updated: string;
  expert_count?: number;
}

interface ECRADPResponse {
  players: Array<{
    player_name: string;
    player_id?: string;
    team: string;
    position: string;
    adp: number;
    times_drafted: number;
    avg_pick?: number;
    std_dev?: number;
  }>;
  format: string;
  league_type: string;
  sample_size: number;
  last_updated: string;
}

export interface ECRIngestionOptions {
  season?: number;
  week?: number;
  jobId?: string;
  positions?: string[]; // ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
  formats?: string[]; // ['ppr', 'half-ppr', 'standard']
  leagueTypes?: string[]; // ['redraft', 'dynasty', 'bestball']
  includeADP?: boolean;
  mockData?: boolean; // For testing when actual API isn't available
}

/**
 * ECR Adapter for Bronze Layer Raw Data Storage
 * Focuses on expert consensus rankings and market data
 */
export class ECRAdapter {
  private readonly FANTASYPROS_BASE_URL = 'https://www.fantasypros.com/nfl';
  private readonly DEFAULT_TIMEOUT = 45000; // 45 seconds for large ranking sets
  private readonly API_VERSION = 'v1';
  private readonly USER_AGENT = 'OTC-Fantasy-Hub/1.0';

  /**
   * Ingest expert consensus rankings by position
   * Stores comprehensive ranking data with expert metadata
   */
  async ingestECRRankings(options: ECRIngestionOptions = {}): Promise<number[]> {
    const startTime = Date.now();
    const season = options.season || new Date().getFullYear();
    const week = options.week; // undefined for season-long rankings
    const jobId = options.jobId || `ecr_rankings_${season}${week ? `_w${week}` : ''}_${Date.now()}`;
    
    const positions = options.positions || ['QB', 'RB', 'WR', 'TE'];
    const formats = options.formats || ['ppr'];
    const leagueTypes = options.leagueTypes || ['redraft'];
    const payloadIds: number[] = [];
    
    try {
      console.log(`🔄 [ECRAdapter] Starting ECR rankings ingestion for season ${season}${week ? `, week ${week}` : ''}`);
      
      if (options.mockData) {
        // Generate mock ECR data for testing
        return await this.generateMockECRData(positions, formats, leagueTypes, jobId, season, week);
      }
      
      for (const position of positions) {
        for (const format of formats) {
          for (const leagueType of leagueTypes) {
            try {
              const payloadId = await this.ingestPositionRankings(
                position, 
                format, 
                leagueType, 
                { ...options, jobId, season, week }
              );
              payloadIds.push(payloadId);
              
              // Add delay between requests to be respectful
              await new Promise(resolve => setTimeout(resolve, 1000));
              
            } catch (error) {
              console.error(`❌ [ECRAdapter] Failed to ingest ${position} ${format} ${leagueType}:`, error);
              // Continue with other positions/formats
            }
          }
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ [ECRAdapter] ECR rankings ingestion completed in ${duration}ms`);
      console.log(`   📊 Positions: ${positions.join(',')} | Payloads: ${payloadIds.length}`);
      
      return payloadIds;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [ECRAdapter] ECR rankings ingestion failed after ${duration}ms:`, error);
      throw new Error(`ECR rankings ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ingest ADP data from ECR sources
   * Captures market consensus on draft positions
   */
  async ingestADPData(options: ECRIngestionOptions = {}): Promise<number[]> {
    const startTime = Date.now();
    const season = options.season || new Date().getFullYear();
    const jobId = options.jobId || `ecr_adp_${season}_${Date.now()}`;
    
    const formats = options.formats || ['ppr', 'half-ppr', 'standard'];
    const leagueTypes = options.leagueTypes || ['redraft', 'dynasty'];
    const payloadIds: number[] = [];
    
    try {
      console.log(`🔄 [ECRAdapter] Starting ADP data ingestion for season ${season}`);
      
      if (options.mockData) {
        // Generate mock ADP data
        const mockADPData: ECRADPResponse = {
          players: [
            {
              player_name: 'Christian McCaffrey',
              team: 'SF',
              position: 'RB',
              adp: 1.2,
              times_drafted: 1543,
              avg_pick: 1.2,
              std_dev: 0.8
            },
            {
              player_name: 'Josh Allen',
              team: 'BUF',
              position: 'QB',
              adp: 2.3,
              times_drafted: 1456,
              avg_pick: 2.3,
              std_dev: 1.1
            },
            {
              player_name: 'Tyreek Hill',
              team: 'MIA',
              position: 'WR',
              adp: 5.7,
              times_drafted: 1398,
              avg_pick: 5.7,
              std_dev: 2.1
            }
          ],
          format: 'ppr',
          league_type: 'redraft',
          sample_size: 10000,
          last_updated: new Date().toISOString()
        };

        const payloadInput: RawPayloadInput = {
          source: 'fantasypros',
          endpoint: '/adp/mock',
          payload: mockADPData,
          version: 'mock_v1',
          jobId,
          season,
          metadata: {
            apiVersion: 'mock_v1',
            extractedAt: new Date(),
            sourceSize: mockADPData.players.length,
            sourceFormat: 'json',
            mockData: true
          }
        };

        const result = await bronzeLayerService.storeRawPayload(payloadInput);
        console.log(`✅ [ECRAdapter] Mock ADP data stored | Payload ID: ${result.payloadId}`);
        
        return [result.payloadId];
      }
      
      for (const format of formats) {
        for (const leagueType of leagueTypes) {
          try {
            // In a real implementation, this would make HTTP requests to ECR APIs
            // For now, we'll store a placeholder indicating the structure
            const placeholderADP = {
              format,
              league_type: leagueType,
              season,
              status: 'placeholder',
              note: 'Actual ECR API integration pending',
              collected_at: new Date().toISOString()
            };

            const payloadInput: RawPayloadInput = {
              source: 'fantasypros',
              endpoint: `/adp/${leagueType}/${format}`,
              payload: placeholderADP,
              version: this.API_VERSION,
              jobId,
              season,
              metadata: {
                apiVersion: this.API_VERSION,
                extractedAt: new Date(),
                sourceSize: 1,
                sourceFormat: 'json',
                placeholder: true
              }
            };

            const result = await bronzeLayerService.storeRawPayload(payloadInput);
            payloadIds.push(result.payloadId);
            
          } catch (error) {
            console.error(`❌ [ECRAdapter] Failed to ingest ADP ${format} ${leagueType}:`, error);
          }
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ [ECRAdapter] ADP ingestion completed in ${duration}ms | Payloads: ${payloadIds.length}`);
      
      return payloadIds;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [ECRAdapter] ADP ingestion failed after ${duration}ms:`, error);
      throw new Error(`ECR ADP ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ingest rankings for a specific position/format combination
   */
  private async ingestPositionRankings(
    position: string,
    format: string,
    leagueType: string,
    options: ECRIngestionOptions & { jobId: string; season: number; week?: number }
  ): Promise<number> {
    
    // For now, create placeholder data structure until actual API integration
    const placeholderRankings: ECRResponse = {
      rankings: [],
      position,
      scoring_format: format,
      league_format: leagueType,
      week: options.week,
      season: options.season,
      last_updated: new Date().toISOString(),
      expert_count: 0
    };
    
    const endpoint = `/rankings/${leagueType}/${format}/${position.toLowerCase()}${options.week ? `/${options.week}` : ''}`;
    
    const payloadInput: RawPayloadInput = {
      source: 'fantasypros',
      endpoint,
      payload: placeholderRankings,
      version: this.API_VERSION,
      jobId: options.jobId,
      season: options.season,
      week: options.week,
      metadata: {
        apiVersion: this.API_VERSION,
        extractedAt: new Date(),
        sourceSize: 0,
        sourceFormat: 'json',
        position,
        format,
        leagueType,
        placeholder: true
      }
    };

    const result = await bronzeLayerService.storeRawPayload(payloadInput);
    
    console.log(`📊 [ECRAdapter] Stored ${position} ${format} ${leagueType} rankings | Payload ID: ${result.payloadId}`);
    
    return result.payloadId;
  }

  /**
   * Generate mock ECR data for testing
   */
  private async generateMockECRData(
    positions: string[],
    formats: string[],
    leagueTypes: string[],
    jobId: string,
    season: number,
    week?: number
  ): Promise<number[]> {
    const payloadIds: number[] = [];
    
    const mockPlayers: { [position: string]: ECRRanking[] } = {
      QB: [
        { player_name: 'Josh Allen', team: 'BUF', position: 'QB', rank: 1, tier: 1, avg_rank: 1.2, std_dev: 0.5, adp: 2.3 },
        { player_name: 'Lamar Jackson', team: 'BAL', position: 'QB', rank: 2, tier: 1, avg_rank: 2.1, std_dev: 0.8, adp: 3.1 }
      ],
      RB: [
        { player_name: 'Christian McCaffrey', team: 'SF', position: 'RB', rank: 1, tier: 1, avg_rank: 1.0, std_dev: 0.2, adp: 1.2 },
        { player_name: 'Austin Ekeler', team: 'LAC', position: 'RB', rank: 2, tier: 1, avg_rank: 2.3, std_dev: 1.1, adp: 4.2 }
      ],
      WR: [
        { player_name: 'Cooper Kupp', team: 'LAR', position: 'WR', rank: 1, tier: 1, avg_rank: 1.1, std_dev: 0.4, adp: 3.8 },
        { player_name: 'Tyreek Hill', team: 'MIA', position: 'WR', rank: 2, tier: 1, avg_rank: 1.9, std_dev: 0.7, adp: 5.7 }
      ],
      TE: [
        { player_name: 'Travis Kelce', team: 'KC', position: 'TE', rank: 1, tier: 1, avg_rank: 1.0, std_dev: 0.1, adp: 8.9 },
        { player_name: 'Mark Andrews', team: 'BAL', position: 'TE', rank: 2, tier: 1, avg_rank: 2.2, std_dev: 0.9, adp: 12.4 }
      ]
    };
    
    for (const position of positions) {
      for (const format of formats) {
        for (const leagueType of leagueTypes) {
          const mockRankings: ECRResponse = {
            rankings: mockPlayers[position] || [],
            position,
            scoring_format: format,
            league_format: leagueType,
            week,
            season,
            last_updated: new Date().toISOString(),
            expert_count: 25
          };

          const endpoint = `/rankings/${leagueType}/${format}/${position.toLowerCase()}/mock`;
          
          const payloadInput: RawPayloadInput = {
            source: 'fantasypros',
            endpoint,
            payload: mockRankings,
            version: 'mock_v1',
            jobId,
            season,
            week,
            metadata: {
              apiVersion: 'mock_v1',
              extractedAt: new Date(),
              sourceSize: mockRankings.rankings.length,
              sourceFormat: 'json',
              mockData: true,
              position,
              format,
              leagueType
            }
          };

          const result = await bronzeLayerService.storeRawPayload(payloadInput);
          payloadIds.push(result.payloadId);
        }
      }
    }
    
    return payloadIds;
  }

  /**
   * Full ingestion cycle for ECR data
   */
  async ingestFullCycle(options: ECRIngestionOptions = {}): Promise<{ rankingsPayloadIds: number[]; adpPayloadIds?: number[] }> {
    const jobId = options.jobId || `ecr_full_${Date.now()}`;
    const fullOptions = { ...options, jobId };
    
    console.log(`🚀 [ECRAdapter] Starting full ECR ingestion cycle`);
    
    try {
      const rankingsPayloadIds = await this.ingestECRRankings(fullOptions);
      
      const result: { rankingsPayloadIds: number[]; adpPayloadIds?: number[] } = {
        rankingsPayloadIds
      };
      
      if (options.includeADP !== false) {
        try {
          result.adpPayloadIds = await this.ingestADPData(fullOptions);
        } catch (error) {
          console.warn(`⚠️ [ECRAdapter] ADP ingestion failed, continuing:`, error);
        }
      }
      
      console.log(`✅ [ECRAdapter] Full ECR ingestion cycle completed for job ${jobId}`);
      return result;
      
    } catch (error) {
      console.error(`❌ [ECRAdapter] Full ingestion cycle failed:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const ecrAdapter = new ECRAdapter();