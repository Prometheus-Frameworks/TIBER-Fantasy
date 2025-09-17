/**
 * MySportsFeeds API Adapter - Bronze Layer Raw Data Ingestion
 * 
 * Handles raw data extraction from MySportsFeeds comprehensive sports data
 * Stores unprocessed game logs, player stats, and team information
 * 
 * Supported Data Sources:
 * - Player game logs and statistics
 * - Team rosters and depth charts
 * - Injury reports and player status
 * - Schedule and game information
 * - Advanced metrics and tracking data
 */

import { bronzeLayerService, type RawPayloadInput } from '../services/BronzeLayerService';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';

interface MySportsFeedsPlayer {
  id: number;
  firstName: string;
  lastName: string;
  primaryPosition: string;
  jerseyNumber?: number;
  currentTeam?: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
  };
  currentRosterStatus: string;
  currentInjury?: {
    description: string;
    playingProbability: string;
  };
}

interface MySportsFeedsGameLog {
  player: MySportsFeedsPlayer;
  team: {
    id: number;
    abbreviation: string;
  };
  game: {
    id: number;
    week: number;
    awayTeam: any;
    homeTeam: any;
    startTime: string;
  };
  stats: {
    passing?: {
      passAttempts?: number;
      passCompletions?: number;
      passYards?: number;
      passTouchdowns?: number;
      passInterceptions?: number;
    };
    rushing?: {
      rushAttempts?: number;
      rushYards?: number;
      rushTouchdowns?: number;
    };
    receiving?: {
      receptions?: number;
      recYards?: number;
      recTouchdowns?: number;
      targets?: number;
    };
  };
}

interface MySportsFeedsResponse<T> {
  lastUpdatedOn: string;
  players?: T[];
  gamelogs?: T[];
  teams?: T[];
  games?: T[];
}

export interface MySportsFeedsIngestionOptions {
  season?: number;
  week?: number;
  jobId?: string;
  positions?: string[];
  teams?: string[];
  includeInjuries?: boolean;
  includeGameLogs?: boolean;
  includeRosters?: boolean;
  mockData?: boolean;
  apiKey?: string; // MySportsFeeds requires API key
}

/**
 * MySportsFeeds Adapter for Bronze Layer Raw Data Storage
 * Comprehensive sports data ingestion from MySportsFeeds API
 */
export class MySportsFeedsAdapter {
  private readonly BASE_URL = 'https://api.mysportsfeeds.com/v2.1/pull/nfl';
  private readonly DEFAULT_TIMEOUT = 60000; // 60 seconds for large datasets
  private readonly API_VERSION = 'v2.1';
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.MYSPORTSFEEDS_API_KEY || null;
  }

  /**
   * Ingest player roster data from MySportsFeeds
   * Comprehensive player information with team affiliations
   */
  async ingestPlayerRosters(options: MySportsFeedsIngestionOptions = {}): Promise<number> {
    const startTime = Date.now();
    const season = options.season || new Date().getFullYear();
    const jobId = options.jobId || `msf_rosters_${season}_${Date.now()}`;
    
    try {
      console.log(`🔄 [MySportsFeedsAdapter] Starting roster ingestion for season ${season}`);
      
      if (!this.apiKey && !options.mockData) {
        console.warn(`⚠️ [MySportsFeedsAdapter] No API key provided, storing placeholder`);
        
        const noApiKeyNotice = {
          status: 'NO_API_KEY',
          message: 'MySportsFeeds API key required for data ingestion',
          season,
          requested_at: new Date().toISOString(),
          setup_instructions: 'Set MYSPORTSFEEDS_API_KEY environment variable'
        };

        const payloadInput: RawPayloadInput = {
          source: 'mysportsfeeds',
          endpoint: '/players',
          payload: noApiKeyNotice,
          version: this.API_VERSION,
          jobId,
          season,
          metadata: {
            apiVersion: this.API_VERSION,
            extractedAt: new Date(),
            sourceSize: 1,
            sourceFormat: 'json',
            noApiKey: true
          }
        };

        const result = await bronzeLayerService.storeRawPayload(payloadInput);
        
        // Mark as failed due to missing API key
        await bronzeLayerService.updatePayloadStatus(
          result.payloadId,
          'FAILED',
          'MySportsFeeds API key required'
        );
        
        return result.payloadId;
      }
      
      if (options.mockData) {
        const mockRosterData: MySportsFeedsResponse<MySportsFeedsPlayer> = {
          lastUpdatedOn: new Date().toISOString(),
          players: [
            {
              id: 12001,
              firstName: 'Josh',
              lastName: 'Allen',
              primaryPosition: 'QB',
              jerseyNumber: 17,
              currentTeam: {
                id: 4,
                abbreviation: 'BUF',
                city: 'Buffalo',
                name: 'Bills'
              },
              currentRosterStatus: 'ROSTER'
            },
            {
              id: 12002,
              firstName: 'Tyreek',
              lastName: 'Hill',
              primaryPosition: 'WR',
              jerseyNumber: 10,
              currentTeam: {
                id: 15,
                abbreviation: 'MIA',
                city: 'Miami',
                name: 'Dolphins'
              },
              currentRosterStatus: 'ROSTER'
            },
            {
              id: 12003,
              firstName: 'Christian',
              lastName: 'McCaffrey',
              primaryPosition: 'RB',
              jerseyNumber: 23,
              currentTeam: {
                id: 25,
                abbreviation: 'SF',
                city: 'San Francisco',
                name: '49ers'
              },
              currentRosterStatus: 'ROSTER'
            }
          ]
        };
        
        // Filter by position if specified
        if (options.positions && options.positions.length > 0) {
          mockRosterData.players = mockRosterData.players!.filter(player => 
            options.positions!.includes(player.primaryPosition)
          );
        }

        const payloadInput: RawPayloadInput = {
          source: 'mysportsfeeds',
          endpoint: '/players',
          payload: mockRosterData,
          version: 'mock_v1',
          jobId,
          season,
          metadata: {
            apiVersion: 'mock_v1',
            extractedAt: new Date(),
            sourceSize: mockRosterData.players?.length || 0,
            sourceFormat: 'json',
            mockData: true
          }
        };

        const result = await bronzeLayerService.storeRawPayload(payloadInput);
        
        console.log(`✅ [MySportsFeedsAdapter] Mock roster data stored`);
        console.log(`   📊 Players: ${mockRosterData.players?.length || 0} | Payload ID: ${result.payloadId}`);
        
        return result.payloadId;
      }
      
      // Actual API integration would go here
      const placeholderRoster = {
        status: 'placeholder',
        message: 'MySportsFeeds API integration pending',
        season,
        collected_at: new Date().toISOString()
      };

      const payloadInput: RawPayloadInput = {
        source: 'mysportsfeeds',
        endpoint: '/players',
        payload: placeholderRoster,
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
      
      const duration = Date.now() - startTime;
      console.log(`📊 [MySportsFeedsAdapter] Roster placeholder stored in ${duration}ms | Payload ID: ${result.payloadId}`);
      
      return result.payloadId;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [MySportsFeedsAdapter] Roster ingestion failed after ${duration}ms:`, error);
      throw new Error(`MySportsFeeds roster ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ingest weekly game logs from MySportsFeeds
   * Detailed player performance data by game
   */
  async ingestWeeklyGameLogs(options: MySportsFeedsIngestionOptions = {}): Promise<number> {
    const startTime = Date.now();
    const season = options.season || new Date().getFullYear();
    const week = options.week || parseInt(getCurrentNFLWeek());
    const jobId = options.jobId || `msf_gamelogs_${season}_w${week}_${Date.now()}`;
    
    try {
      console.log(`🔄 [MySportsFeedsAdapter] Starting game logs ingestion for Season ${season}, Week ${week}`);
      
      if (options.mockData) {
        const mockGameLogs: MySportsFeedsResponse<MySportsFeedsGameLog> = {
          lastUpdatedOn: new Date().toISOString(),
          gamelogs: [
            {
              player: {
                id: 12001,
                firstName: 'Josh',
                lastName: 'Allen',
                primaryPosition: 'QB',
                jerseyNumber: 17,
                currentRosterStatus: 'ROSTER'
              },
              team: {
                id: 4,
                abbreviation: 'BUF'
              },
              game: {
                id: 67890,
                week,
                awayTeam: { abbreviation: 'BUF' },
                homeTeam: { abbreviation: 'MIA' },
                startTime: new Date().toISOString()
              },
              stats: {
                passing: {
                  passAttempts: 34,
                  passCompletions: 24,
                  passYards: 312,
                  passTouchdowns: 3,
                  passInterceptions: 1
                },
                rushing: {
                  rushAttempts: 6,
                  rushYards: 42,
                  rushTouchdowns: 1
                }
              }
            },
            {
              player: {
                id: 12002,
                firstName: 'Tyreek',
                lastName: 'Hill',
                primaryPosition: 'WR',
                jerseyNumber: 10,
                currentRosterStatus: 'ROSTER'
              },
              team: {
                id: 15,
                abbreviation: 'MIA'
              },
              game: {
                id: 67890,
                week,
                awayTeam: { abbreviation: 'BUF' },
                homeTeam: { abbreviation: 'MIA' },
                startTime: new Date().toISOString()
              },
              stats: {
                receiving: {
                  receptions: 8,
                  recYards: 134,
                  recTouchdowns: 2,
                  targets: 11
                }
              }
            }
          ]
        };
        
        // Filter by position if specified
        if (options.positions && options.positions.length > 0) {
          mockGameLogs.gamelogs = mockGameLogs.gamelogs!.filter(log => 
            options.positions!.includes(log.player.primaryPosition)
          );
        }

        const payloadInput: RawPayloadInput = {
          source: 'mysportsfeeds',
          endpoint: `/weekly-player-gamelogs`,
          payload: mockGameLogs,
          version: 'mock_v1',
          jobId,
          season,
          week,
          metadata: {
            apiVersion: 'mock_v1',
            extractedAt: new Date(),
            sourceSize: mockGameLogs.gamelogs?.length || 0,
            sourceFormat: 'json',
            mockData: true
          }
        };

        const result = await bronzeLayerService.storeRawPayload(payloadInput);
        
        console.log(`✅ [MySportsFeedsAdapter] Mock game logs stored`);
        console.log(`   📊 Game Logs: ${mockGameLogs.gamelogs?.length || 0} | Week ${week} | Payload ID: ${result.payloadId}`);
        
        return result.payloadId;
      }
      
      // Placeholder for actual API integration
      const placeholderGameLogs = {
        week,
        season,
        status: 'placeholder',
        message: 'MySportsFeeds game logs API integration pending',
        collected_at: new Date().toISOString()
      };

      const payloadInput: RawPayloadInput = {
        source: 'mysportsfeeds',
        endpoint: `/weekly-player-gamelogs`,
        payload: placeholderGameLogs,
        version: this.API_VERSION,
        jobId,
        season,
        week,
        metadata: {
          apiVersion: this.API_VERSION,
          extractedAt: new Date(),
          sourceSize: 1,
          sourceFormat: 'json',
          placeholder: true
        }
      };

      const result = await bronzeLayerService.storeRawPayload(payloadInput);
      
      const duration = Date.now() - startTime;
      console.log(`📊 [MySportsFeedsAdapter] Game logs placeholder stored in ${duration}ms | Payload ID: ${result.payloadId}`);
      
      return result.payloadId;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [MySportsFeedsAdapter] Game logs ingestion failed after ${duration}ms:`, error);
      throw new Error(`MySportsFeeds game logs ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ingest injury reports from MySportsFeeds
   * Current player injury status and playing probabilities
   */
  async ingestInjuryReports(options: MySportsFeedsIngestionOptions = {}): Promise<number> {
    const startTime = Date.now();
    const season = options.season || new Date().getFullYear();
    const jobId = options.jobId || `msf_injuries_${season}_${Date.now()}`;
    
    try {
      console.log(`🔄 [MySportsFeedsAdapter] Starting injury reports ingestion for season ${season}`);
      
      if (options.mockData) {
        const mockInjuries = {
          lastUpdatedOn: new Date().toISOString(),
          players: [
            {
              id: 12004,
              firstName: 'Jonathan',
              lastName: 'Taylor',
              primaryPosition: 'RB',
              currentTeam: { abbreviation: 'IND' },
              currentInjury: {
                description: 'Ankle',
                playingProbability: 'Questionable'
              }
            },
            {
              id: 12005,
              firstName: 'DeAndre',
              lastName: 'Hopkins',
              primaryPosition: 'WR',
              currentTeam: { abbreviation: 'TEN' },
              currentInjury: {
                description: 'Hamstring',
                playingProbability: 'Doubtful'
              }
            }
          ]
        };

        const payloadInput: RawPayloadInput = {
          source: 'mysportsfeeds',
          endpoint: '/player-injuries',
          payload: mockInjuries,
          version: 'mock_v1',
          jobId,
          season,
          metadata: {
            apiVersion: 'mock_v1',
            extractedAt: new Date(),
            sourceSize: mockInjuries.players.length,
            sourceFormat: 'json',
            mockData: true
          }
        };

        const result = await bronzeLayerService.storeRawPayload(payloadInput);
        
        console.log(`✅ [MySportsFeedsAdapter] Mock injury reports stored | Payload ID: ${result.payloadId}`);
        return result.payloadId;
      }
      
      // Placeholder for actual injuries API
      const placeholderInjuries = {
        season,
        status: 'placeholder',
        message: 'MySportsFeeds injuries API integration pending',
        collected_at: new Date().toISOString()
      };

      const payloadInput: RawPayloadInput = {
        source: 'mysportsfeeds',
        endpoint: '/player-injuries',
        payload: placeholderInjuries,
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
      
      const duration = Date.now() - startTime;
      console.log(`📊 [MySportsFeedsAdapter] Injury placeholder stored in ${duration}ms | Payload ID: ${result.payloadId}`);
      
      return result.payloadId;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [MySportsFeedsAdapter] Injury reports ingestion failed:`, error);
      throw new Error(`MySportsFeeds injury ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Full ingestion cycle for MySportsFeeds data
   */
  async ingestFullCycle(options: MySportsFeedsIngestionOptions = {}): Promise<{
    rostersPayloadId: number;
    gameLogsPayloadId?: number;
    injuriesPayloadId?: number;
  }> {
    const jobId = options.jobId || `msf_full_${Date.now()}`;
    const fullOptions = { ...options, jobId };
    
    console.log(`🚀 [MySportsFeedsAdapter] Starting full MySportsFeeds ingestion cycle`);
    
    try {
      const rostersPayloadId = await this.ingestPlayerRosters(fullOptions);
      
      const result: {
        rostersPayloadId: number;
        gameLogsPayloadId?: number;
        injuriesPayloadId?: number;
      } = { rostersPayloadId };
      
      if (options.includeGameLogs !== false) {
        try {
          result.gameLogsPayloadId = await this.ingestWeeklyGameLogs(fullOptions);
        } catch (error) {
          console.warn(`⚠️ [MySportsFeedsAdapter] Game logs ingestion failed, continuing:`, error);
        }
      }
      
      if (options.includeInjuries !== false) {
        try {
          result.injuriesPayloadId = await this.ingestInjuryReports(fullOptions);
        } catch (error) {
          console.warn(`⚠️ [MySportsFeedsAdapter] Injuries ingestion failed, continuing:`, error);
        }
      }
      
      console.log(`✅ [MySportsFeedsAdapter] Full ingestion cycle completed for job ${jobId}`);
      return result;
      
    } catch (error) {
      console.error(`❌ [MySportsFeedsAdapter] Full ingestion cycle failed:`, error);
      throw error;
    }
  }

  /**
   * Set API key for MySportsFeeds requests
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const mySportsFeedsAdapter = new MySportsFeedsAdapter();