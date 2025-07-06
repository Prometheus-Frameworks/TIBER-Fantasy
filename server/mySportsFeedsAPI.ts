/**
 * MySportsFeeds API Integration
 * Commercial-friendly NFL data source with comprehensive coverage
 * Free tier available, affordable commercial plans
 */

interface MySportsFeedsConfig {
  baseUrl: string;
  version: string;
  username?: string;
  password?: string;
}

export interface MSFPlayer {
  id: number;
  firstName: string;
  lastName: string;
  position: {
    abbreviation: string;
  };
  currentTeam?: {
    abbreviation: string;
  };
  currentInjury?: {
    description: string;
    playingProbability?: string;
  };
  age?: number;
  height?: string;
  weight?: number;
}

export interface MSFPlayerStats {
  player: MSFPlayer;
  stats: {
    passing?: {
      passAttempts?: number;
      passCompletions?: number;
      passYards?: number;
      passTouchdowns?: number;
      passInterceptions?: number;
      passRating?: number;
    };
    rushing?: {
      rushAttempts?: number;
      rushYards?: number;
      rushTouchdowns?: number;
      rushLong?: number;
    };
    receiving?: {
      receptions?: number;
      recYards?: number;
      recTouchdowns?: number;
      targets?: number;
      recLong?: number;
    };
    fantasyPoints?: {
      standard?: number;
      halfPpr?: number;
      ppr?: number;
    };
  };
}

export interface MSFGameScore {
  id: number;
  date: string;
  status: string;
  homeTeam: {
    abbreviation: string;
    score?: number;
  };
  awayTeam: {
    abbreviation: string;
    score?: number;
  };
  week?: number;
  season: number;
}

class MySportsFeedsAPI {
  private config: MySportsFeedsConfig;
  private rateLimitDelay = 1000; // 1 second between requests for free tier

  constructor() {
    this.config = {
      baseUrl: 'https://api.mysportsfeeds.com',
      version: 'v2.1',
      username: process.env.MSF_USERNAME || '',
      password: process.env.MSF_PASSWORD || ''
    };
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${this.config.baseUrl}/${this.config.version}/pull/nfl/${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Prometheus Fantasy Analytics Platform'
    };

    // Add basic auth if credentials provided
    if (this.config.username && this.config.password) {
      const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    try {
      // Rate limiting for free tier
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));

      const response = await fetch(url.toString(), { headers });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('MySportsFeeds: Authentication required. Please provide MSF_USERNAME and MSF_PASSWORD environment variables.');
        }
        if (response.status === 429) {
          throw new Error('MySportsFeeds: Rate limit exceeded. Please wait before making more requests.');
        }
        throw new Error(`MySportsFeeds API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('MySportsFeeds API request failed:', error);
      throw error;
    }
  }

  /**
   * Get current NFL scores and game information
   */
  async getCurrentScores(season: string = '2024-2025-regular'): Promise<MSFGameScore[]> {
    try {
      const data = await this.makeRequest(`${season}/games.json`, {
        'fordate': new Date().toISOString().split('T')[0]
      });

      return data.games?.map((game: any) => ({
        id: game.schedule.id,
        date: game.schedule.startTime,
        status: game.schedule.playedStatus,
        homeTeam: {
          abbreviation: game.schedule.homeTeam.abbreviation,
          score: game.score?.homeScoreTotal
        },
        awayTeam: {
          abbreviation: game.schedule.awayTeam.abbreviation,
          score: game.score?.awayScoreTotal
        },
        week: game.schedule.week,
        season: parseInt(season.split('-')[0])
      })) || [];
    } catch (error) {
      console.error('Error fetching current scores:', error);
      return [];
    }
  }

  /**
   * Get current season player statistics
   */
  async getPlayerStats(season: string = '2024-2025-regular', position?: string): Promise<MSFPlayerStats[]> {
    try {
      const params: Record<string, string> = {};
      if (position) {
        params.position = position;
      }

      const data = await this.makeRequest(`${season}/player_stats_totals.json`, params);

      return data.playerStatsTotals?.map((playerStat: any) => ({
        player: {
          id: playerStat.player.id,
          firstName: playerStat.player.firstName,
          lastName: playerStat.player.lastName,
          position: {
            abbreviation: playerStat.player.primaryPosition
          },
          currentTeam: playerStat.team ? {
            abbreviation: playerStat.team.abbreviation
          } : undefined,
          age: playerStat.player.age,
          height: playerStat.player.height,
          weight: playerStat.player.weight
        },
        stats: {
          passing: playerStat.stats.passing ? {
            passAttempts: playerStat.stats.passing.passAttempts,
            passCompletions: playerStat.stats.passing.passCompletions,
            passYards: playerStat.stats.passing.passYards,
            passTouchdowns: playerStat.stats.passing.passTouchdowns,
            passInterceptions: playerStat.stats.passing.passInterceptions,
            passRating: playerStat.stats.passing.passRating
          } : undefined,
          rushing: playerStat.stats.rushing ? {
            rushAttempts: playerStat.stats.rushing.rushAttempts,
            rushYards: playerStat.stats.rushing.rushYards,
            rushTouchdowns: playerStat.stats.rushing.rushTouchdowns,
            rushLong: playerStat.stats.rushing.rushLong
          } : undefined,
          receiving: playerStat.stats.receiving ? {
            receptions: playerStat.stats.receiving.receptions,
            recYards: playerStat.stats.receiving.recYards,
            recTouchdowns: playerStat.stats.receiving.recTouchdowns,
            targets: playerStat.stats.receiving.targets,
            recLong: playerStat.stats.receiving.recLong
          } : undefined,
          fantasyPoints: {
            standard: this.calculateFantasyPoints(playerStat.stats, 'standard'),
            halfPpr: this.calculateFantasyPoints(playerStat.stats, 'half-ppr'),
            ppr: this.calculateFantasyPoints(playerStat.stats, 'ppr')
          }
        }
      })) || [];
    } catch (error) {
      console.error('Error fetching player stats:', error);
      return [];
    }
  }

  /**
   * Get injury information for current season
   */
  async getInjuryReport(season: string = '2024-2025-regular'): Promise<MSFPlayer[]> {
    try {
      const data = await this.makeRequest(`${season}/injuries.json`);

      return data.injuries?.map((injury: any) => ({
        id: injury.player.id,
        firstName: injury.player.firstName,
        lastName: injury.player.lastName,
        position: {
          abbreviation: injury.player.primaryPosition
        },
        currentTeam: injury.team ? {
          abbreviation: injury.team.abbreviation
        } : undefined,
        currentInjury: {
          description: injury.injury.description,
          playingProbability: injury.injury.playingProbability
        }
      })) || [];
    } catch (error) {
      console.error('Error fetching injury report:', error);
      return [];
    }
  }

  /**
   * Get team standings
   */
  async getStandings(season: string = '2024-2025-regular') {
    try {
      const data = await this.makeRequest(`${season}/standings.json`);
      return data.teams || [];
    } catch (error) {
      console.error('Error fetching standings:', error);
      return [];
    }
  }

  /**
   * Calculate fantasy points based on scoring system
   */
  private calculateFantasyPoints(stats: any, system: 'standard' | 'half-ppr' | 'ppr'): number {
    let points = 0;

    // Passing points
    if (stats.passing) {
      points += (stats.passing.passYards || 0) / 25; // 1 point per 25 yards
      points += (stats.passing.passTouchdowns || 0) * 4; // 4 points per TD
      points -= (stats.passing.passInterceptions || 0) * 2; // -2 points per INT
    }

    // Rushing points
    if (stats.rushing) {
      points += (stats.rushing.rushYards || 0) / 10; // 1 point per 10 yards
      points += (stats.rushing.rushTouchdowns || 0) * 6; // 6 points per TD
    }

    // Receiving points
    if (stats.receiving) {
      points += (stats.receiving.recYards || 0) / 10; // 1 point per 10 yards
      points += (stats.receiving.recTouchdowns || 0) * 6; // 6 points per TD
      
      // Reception bonuses based on system
      const receptions = stats.receiving.receptions || 0;
      if (system === 'ppr') {
        points += receptions; // 1 point per reception
      } else if (system === 'half-ppr') {
        points += receptions * 0.5; // 0.5 points per reception
      }
    }

    return Math.round(points * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Test API connectivity and authentication
   */
  async testConnection(): Promise<{ success: boolean; message: string; hasAuth: boolean }> {
    try {
      const data = await this.makeRequest('current/games.json', { 'limit': '1' });
      return {
        success: true,
        message: 'MySportsFeeds API connection successful',
        hasAuth: !!(this.config.username && this.config.password)
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        hasAuth: !!(this.config.username && this.config.password)
      };
    }
  }
}

export const mySportsFeedsAPI = new MySportsFeedsAPI();