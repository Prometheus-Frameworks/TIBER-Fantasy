/**
 * MySportsFeeds API Adapter
 * Commercial-grade NFL fantasy data with authentic player statistics
 * Pricing: $39 CAD/month (~$29 USD) for non-live data
 */

import { PlatformCredentials, SyncData, UserProfile, LeagueData, TeamData, RosterData, TransactionData, ScoreData, PlatformSettings } from '../index';

export interface MySportsFeedsCredentials extends PlatformCredentials {
  apiKey: string;
  password?: string; // Always "MYSPORTSFEEDS" 
}

export class MySportsFeedsAdapter {
  private baseUrl = 'https://api.mysportsfeeds.com/v2.1/pull/nfl';
  public supportsWebhooks = false;
  public supportedDataTypes = ['player_stats', 'games', 'lineups', 'injuries', 'projections', 'dfs_salaries'];

  /**
   * Authenticate with MySportsFeeds using API key
   */
  async authenticate(credentials: MySportsFeedsCredentials): Promise<boolean> {
    if (!credentials.apiKey) {
      throw new Error('MySportsFeeds requires an API key');
    }

    try {
      // Test authentication with a simple API call
      const response = await this.makeRequest(
        '/2024-regular/games.json',
        credentials,
        { limit: 1 }
      );

      return response.status === 200;
    } catch (error) {
      console.error('MySportsFeeds authentication failed:', error);
      return false;
    }
  }

  /**
   * Check if connection is active
   */
  async checkConnection(credentials: MySportsFeedsCredentials | null): Promise<boolean> {
    if (!credentials) return false;
    return await this.authenticate(credentials);
  }

  /**
   * Fetch user profile (limited data available from MySportsFeeds)
   */
  async fetchUserProfile(credentials: MySportsFeedsCredentials): Promise<UserProfile> {
    return {
      userId: 'mysportsfeeds_user',
      displayName: 'MySportsFeeds User',
      email: credentials.accessToken || 'user@example.com',
      totalLeagues: 1,
      memberSince: new Date()
    };
  }

  /**
   * Fetch league data (NFL season structure)
   */
  async fetchLeagues(credentials: MySportsFeedsCredentials): Promise<LeagueData[]> {
    try {
      const response = await this.makeRequest('/2024-regular/games.json', credentials, { limit: 1 });
      const data = await response.json();

      return [{
        leagueId: 'nfl-2024-regular',
        name: 'NFL 2024 Regular Season',
        season: 2024,
        size: 32, // 32 NFL teams
        scoringType: 'ppr', // Default to PPR
        rosterPositions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'D/ST'],
        isActive: true,
        draftStatus: 'post-draft',
        settings: {
          scoringSettings: {
            passingYards: 0.04,
            passingTDs: 4,
            rushingYards: 0.1,
            rushingTDs: 6,
            receivingYards: 0.1,
            receivingTDs: 6,
            receptions: 1 // PPR
          },
          rosterSettings: {
            starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, 'D/ST': 1 },
            bench: 6,
            ir: 2
          },
          waiverSettings: {
            type: 'rolling',
            clearTime: '03:00'
          },
          tradeSettings: {
            deadline: new Date('2024-11-19'),
            reviewPeriod: 48,
            vetoPeriod: 24
          }
        }
      }];
    } catch (error) {
      console.error('Failed to fetch MySportsFeeds leagues:', error);
      throw new Error('Unable to fetch league data');
    }
  }

  /**
   * Fetch NFL teams data
   */
  async fetchTeams(credentials: MySportsFeedsCredentials): Promise<TeamData[]> {
    try {
      const response = await this.makeRequest('/2024-regular/standings.json', credentials);
      const data = await response.json();

      return (data.teams || []).map((team: any, index: number) => ({
        teamId: team.team?.id?.toString() || index.toString(),
        leagueId: 'nfl-2024-regular',
        ownerId: team.team?.abbreviation || `team_${index}`,
        teamName: `${team.team?.city} ${team.team?.name}` || `Team ${index}`,
        logoUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${team.team?.abbreviation?.toLowerCase()}.png`,
        record: {
          wins: team.stats?.standings?.wins || 0,
          losses: team.stats?.standings?.losses || 0,
          ties: team.stats?.standings?.ties || 0
        },
        pointsFor: team.stats?.standings?.pointsFor || 0,
        pointsAgainst: team.stats?.standings?.pointsAgainst || 0,
        rank: team.rank || index + 1,
        draftPosition: index + 1
      }));
    } catch (error) {
      console.error('Failed to fetch NFL teams:', error);
      return [];
    }
  }

  /**
   * Fetch player statistics for fantasy rosters
   */
  async fetchRosters(credentials: MySportsFeedsCredentials): Promise<RosterData[]> {
    try {
      const response = await this.makeRequest('/2024-regular/player_stats_totals.json', credentials);
      const data = await response.json();

      // Group players by team
      const teamRosters: Record<string, any[]> = {};
      
      for (const playerStats of data.playerStatsTotals || []) {
        const teamId = playerStats.team?.id?.toString() || 'unknown';
        if (!teamRosters[teamId]) {
          teamRosters[teamId] = [];
        }
        
        teamRosters[teamId].push({
          playerId: playerStats.player?.id?.toString() || '',
          playerName: `${playerStats.player?.firstName} ${playerStats.player?.lastName}` || 'Unknown Player',
          position: this.mapPosition(playerStats.player?.primaryPosition),
          team: playerStats.team?.abbreviation || 'FA',
          slotPosition: this.getSlotPosition(playerStats.player?.primaryPosition),
          isLocked: false,
          projectedPoints: this.calculateFantasyPoints(playerStats.stats),
          actualPoints: this.calculateFantasyPoints(playerStats.stats)
        });
      }

      // Convert to roster format
      return Object.entries(teamRosters).map(([teamId, players]) => ({
        teamId,
        leagueId: 'nfl-2024-regular',
        starters: players.filter(p => this.isStarterPosition(p.position)).slice(0, 9),
        bench: players.filter(p => !this.isStarterPosition(p.position)),
        ir: [],
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('Failed to fetch rosters:', error);
      return [];
    }
  }

  /**
   * Fetch player transactions (limited data from MySportsFeeds)
   */
  async fetchTransactions(credentials: MySportsFeedsCredentials): Promise<TransactionData[]> {
    // MySportsFeeds doesn't provide transaction data
    // This would need to be supplemented by other APIs or manual entry
    return [];
  }

  /**
   * Fetch weekly scoring data
   */
  async fetchScores(credentials: MySportsFeedsCredentials): Promise<ScoreData[]> {
    try {
      const scores: ScoreData[] = [];
      
      // Fetch scores for weeks 1-18
      for (let week = 1; week <= 18; week++) {
        try {
          const response = await this.makeRequest(
            `/2024-regular/week/${week}/player_stats_totals.json`,
            credentials
          );
          const data = await response.json();

          for (const playerStats of data.playerStatsTotals || []) {
            const fantasyPoints = this.calculateFantasyPoints(playerStats.stats);
            
            scores.push({
              teamId: playerStats.team?.id?.toString() || 'unknown',
              leagueId: 'nfl-2024-regular',
              week,
              season: 2024,
              totalPoints: fantasyPoints,
              projectedPoints: fantasyPoints * 1.1, // Estimate
              playerScores: [{
                playerId: playerStats.player?.id?.toString() || '',
                points: fantasyPoints,
                projected: fantasyPoints * 1.1,
                started: this.isStarterPosition(playerStats.player?.primaryPosition)
              }],
              result: undefined // Would need game outcome data
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch week ${week} scores:`, error);
        }
      }

      return scores;
    } catch (error) {
      console.error('Failed to fetch scores:', error);
      return [];
    }
  }

  /**
   * Fetch platform settings
   */
  async fetchSettings(credentials: MySportsFeedsCredentials): Promise<PlatformSettings> {
    return {
      notifications: {
        trades: true,
        waivers: true,
        scores: true,
        news: true
      },
      privacy: {
        shareRoster: true,
        shareRecord: true,
        allowMessages: true
      },
      preferences: {
        timezone: 'America/New_York',
        language: 'en',
        theme: 'light'
      }
    };
  }

  /**
   * Fetch changes since last sync
   */
  async fetchChangesSince(credentials: MySportsFeedsCredentials, since: Date): Promise<Partial<SyncData>> {
    // For incremental sync, we'd compare timestamps
    // MySportsFeeds provides lastUpdatedOn timestamps
    return {};
  }

  /**
   * Fetch current week player projections (add-on feature)
   */
  async fetchPlayerProjections(credentials: MySportsFeedsCredentials, week: number): Promise<any[]> {
    try {
      const response = await this.makeRequest(
        `/2024-regular/week/${week}/player_projections.json`,
        credentials
      );
      const data = await response.json();
      
      return (data.playerProjections || []).map((projection: any) => ({
        playerId: projection.player?.id?.toString(),
        playerName: `${projection.player?.firstName} ${projection.player?.lastName}`,
        position: this.mapPosition(projection.player?.primaryPosition),
        team: projection.team?.abbreviation,
        projectedPoints: this.calculateFantasyPoints(projection.projectedStats),
        projectedStats: projection.projectedStats
      }));
    } catch (error) {
      console.error('Failed to fetch projections:', error);
      return [];
    }
  }

  /**
   * Fetch DFS salaries (add-on feature)
   */
  async fetchDFSSalaries(credentials: MySportsFeedsCredentials, week: number): Promise<any[]> {
    try {
      const response = await this.makeRequest(
        `/2024-regular/week/${week}/dfs_salaries.json`,
        credentials
      );
      const data = await response.json();
      
      return (data.dfsSalaries || []).map((salary: any) => ({
        playerId: salary.player?.id?.toString(),
        playerName: `${salary.player?.firstName} ${salary.player?.lastName}`,
        position: this.mapPosition(salary.player?.primaryPosition),
        team: salary.team?.abbreviation,
        draftkingsSalary: salary.salaries?.find((s: any) => s.dfsSource === 'DRAFTKINGS')?.salary,
        fanduelSalary: salary.salaries?.find((s: any) => s.dfsSource === 'FANDUEL')?.salary
      }));
    } catch (error) {
      console.error('Failed to fetch DFS salaries:', error);
      return [];
    }
  }

  // Helper methods
  private async makeRequest(endpoint: string, credentials: MySportsFeedsCredentials, params?: any): Promise<Response> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
      });
    }

    const auth = Buffer.from(`${credentials.apiKey}:MYSPORTSFEEDS`).toString('base64');

    return fetch(url.toString(), {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'User-Agent': 'FantasyWeakness/1.0'
      }
    });
  }

  private mapPosition(position: string): string {
    const positionMap: Record<string, string> = {
      'Quarterback': 'QB',
      'Running Back': 'RB', 
      'Wide Receiver': 'WR',
      'Tight End': 'TE',
      'Kicker': 'K',
      'Defense': 'D/ST'
    };
    return positionMap[position] || position;
  }

  private getSlotPosition(position: string): string {
    const mapped = this.mapPosition(position);
    if (['RB', 'WR', 'TE'].includes(mapped)) return 'FLEX';
    return mapped;
  }

  private isStarterPosition(position: string): boolean {
    const mapped = this.mapPosition(position);
    return ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'].includes(mapped);
  }

  private calculateFantasyPoints(stats: any): number {
    if (!stats) return 0;

    let points = 0;
    
    // Passing
    points += (stats.passing?.passYards || 0) * 0.04;
    points += (stats.passing?.passTD || 0) * 4;
    points -= (stats.passing?.passInt || 0) * 2;
    
    // Rushing
    points += (stats.rushing?.rushYards || 0) * 0.1;
    points += (stats.rushing?.rushTD || 0) * 6;
    
    // Receiving (PPR)
    points += (stats.receiving?.receptions || 0) * 1;
    points += (stats.receiving?.recYards || 0) * 0.1;
    points += (stats.receiving?.recTD || 0) * 6;
    
    // Kicking
    points += (stats.kicking?.fgMade || 0) * 3;
    points += (stats.kicking?.xpMade || 0) * 1;
    
    // Fumbles
    points -= (stats.fumbles?.fumLost || 0) * 2;

    return Math.round(points * 10) / 10;
  }
}