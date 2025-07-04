/**
 * Sleeper Fantasy Sports API Adapter
 * Free public API for fantasy league data
 */

import { PlatformCredentials, SyncData, UserProfile, LeagueData, TeamData, RosterData, TransactionData, ScoreData, PlatformSettings } from '../index';

export class SleeperSyncAdapter {
  private baseUrl = 'https://api.sleeper.app/v1';
  public supportsWebhooks = false;
  public supportedDataTypes = ['leagues', 'teams', 'rosters', 'transactions', 'scores'];

  async authenticate(credentials: PlatformCredentials): Promise<boolean> {
    // Sleeper API is public, just verify league exists
    if (!credentials.leagueId) {
      throw new Error('Sleeper requires a league ID');
    }

    try {
      const response = await fetch(`${this.baseUrl}/league/${credentials.leagueId}`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async checkConnection(credentials: PlatformCredentials | null): Promise<boolean> {
    if (!credentials?.leagueId) return false;
    return await this.authenticate(credentials);
  }

  async fetchUserProfile(credentials: PlatformCredentials): Promise<UserProfile> {
    try {
      const response = await fetch(`${this.baseUrl}/league/${credentials.leagueId}`);
      const league = await response.json();
      
      return {
        userId: credentials.teamId || 'sleeper_user',
        displayName: league.name || 'Sleeper User',
        totalLeagues: 1,
        memberSince: new Date(league.created || Date.now())
      };
    } catch (error) {
      return {
        userId: 'sleeper_user',
        displayName: 'Sleeper User',
        totalLeagues: 1,
        memberSince: new Date()
      };
    }
  }

  async fetchLeagues(credentials: PlatformCredentials): Promise<LeagueData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/league/${credentials.leagueId}`);
      const league = await response.json();

      return [{
        leagueId: credentials.leagueId,
        name: league.name || 'Sleeper League',
        season: league.season || 2024,
        size: league.total_rosters || 10,
        scoringType: this.mapScoringType(league.scoring_settings),
        rosterPositions: this.parseRosterPositions(league.roster_positions),
        isActive: league.status === 'in_season',
        draftStatus: league.status === 'pre_draft' ? 'pre-draft' : 'post-draft',
        settings: {
          scoringSettings: league.scoring_settings || {},
          rosterSettings: {
            starters: this.parseStarterPositions(league.roster_positions),
            bench: league.settings?.bench_slots || 6,
            ir: league.settings?.reserve_slots || 0
          },
          waiverSettings: {
            type: league.settings?.waiver_type === 0 ? 'rolling' : 'faab',
            budget: league.settings?.waiver_budget || 100,
            clearTime: '03:00'
          },
          tradeSettings: {
            deadline: new Date(league.settings?.trade_deadline * 1000 || Date.now()),
            reviewPeriod: league.settings?.trade_review_days || 1,
            vetoPeriod: 24
          }
        }
      }];
    } catch (error) {
      console.error('Failed to fetch Sleeper league:', error);
      return [];
    }
  }

  async fetchTeams(credentials: PlatformCredentials): Promise<TeamData[]> {
    try {
      const [usersResponse, rostersResponse] = await Promise.all([
        fetch(`${this.baseUrl}/league/${credentials.leagueId}/users`),
        fetch(`${this.baseUrl}/league/${credentials.leagueId}/rosters`)
      ]);

      const users = await usersResponse.json();
      const rosters = await rostersResponse.json();

      return rosters.map((roster: any) => {
        const owner = users.find((user: any) => user.user_id === roster.owner_id);
        
        return {
          teamId: roster.roster_id.toString(),
          leagueId: credentials.leagueId,
          ownerId: roster.owner_id,
          teamName: owner?.display_name || `Team ${roster.roster_id}`,
          logoUrl: owner?.avatar ? `https://sleepercdn.com/avatars/thumbs/${owner.avatar}` : undefined,
          record: {
            wins: roster.settings?.wins || 0,
            losses: roster.settings?.losses || 0,
            ties: roster.settings?.ties || 0
          },
          pointsFor: roster.settings?.fpts || 0,
          pointsAgainst: roster.settings?.fpts_against || 0,
          rank: roster.settings?.rank || 0,
          draftPosition: roster.settings?.draft_position || 0
        };
      });
    } catch (error) {
      console.error('Failed to fetch Sleeper teams:', error);
      return [];
    }
  }

  async fetchRosters(credentials: PlatformCredentials): Promise<RosterData[]> {
    try {
      const [rostersResponse, playersResponse] = await Promise.all([
        fetch(`${this.baseUrl}/league/${credentials.leagueId}/rosters`),
        fetch(`${this.baseUrl}/players/nfl`)
      ]);

      const rosters = await rostersResponse.json();
      const players = await playersResponse.json();

      return rosters.map((roster: any) => ({
        teamId: roster.roster_id.toString(),
        leagueId: credentials.leagueId,
        starters: (roster.starters || []).map((playerId: string) => 
          this.mapPlayer(playerId, players, 'starter')
        ),
        bench: (roster.players || [])
          .filter((playerId: string) => !roster.starters?.includes(playerId))
          .map((playerId: string) => this.mapPlayer(playerId, players, 'bench')),
        ir: (roster.reserve || []).map((playerId: string) => 
          this.mapPlayer(playerId, players, 'ir')
        ),
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('Failed to fetch Sleeper rosters:', error);
      return [];
    }
  }

  async fetchTransactions(credentials: PlatformCredentials): Promise<TransactionData[]> {
    try {
      const transactions: TransactionData[] = [];
      
      // Fetch transactions for current week
      for (let week = 1; week <= 18; week++) {
        try {
          const response = await fetch(
            `${this.baseUrl}/league/${credentials.leagueId}/transactions/${week}`
          );
          const weekTransactions = await response.json();

          for (const transaction of weekTransactions || []) {
            transactions.push({
              transactionId: transaction.transaction_id,
              leagueId: credentials.leagueId,
              type: this.mapTransactionType(transaction.type),
              status: transaction.status === 'complete' ? 'executed' : 'pending',
              timestamp: new Date(transaction.created),
              involvedTeams: Object.keys(transaction.roster_ids || {}),
              players: {
                added: Object.entries(transaction.adds || {}).map(([playerId, rosterId]) => ({
                  playerId,
                  playerName: 'Unknown Player',
                  position: 'UNKNOWN',
                  team: 'UNKNOWN',
                  slotPosition: 'BE',
                  isLocked: false
                })),
                dropped: Object.entries(transaction.drops || {}).map(([playerId, rosterId]) => ({
                  playerId,
                  playerName: 'Unknown Player', 
                  position: 'UNKNOWN',
                  team: 'UNKNOWN',
                  slotPosition: 'BE',
                  isLocked: false
                }))
              },
              faabBid: transaction.settings?.waiver_bid,
              waiverPriority: transaction.settings?.waiver_priority
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch week ${week} transactions:`, error);
        }
      }

      return transactions;
    } catch (error) {
      console.error('Failed to fetch Sleeper transactions:', error);
      return [];
    }
  }

  async fetchScores(credentials: PlatformCredentials): Promise<ScoreData[]> {
    try {
      const scores: ScoreData[] = [];

      for (let week = 1; week <= 18; week++) {
        try {
          const matchupsResponse = await fetch(
            `${this.baseUrl}/league/${credentials.leagueId}/matchups/${week}`
          );
          const matchups = await matchupsResponse.json();

          for (const matchup of matchups || []) {
            scores.push({
              teamId: matchup.roster_id.toString(),
              leagueId: credentials.leagueId,
              week,
              season: 2024,
              totalPoints: matchup.points || 0,
              projectedPoints: matchup.projected_points || 0,
              playerScores: Object.entries(matchup.players_points || {}).map(([playerId, points]) => ({
                playerId,
                points: points as number,
                projected: 0, // Sleeper doesn't provide individual projections in matchups
                started: (matchup.starters || []).includes(playerId)
              })),
              matchupOpponent: matchup.matchup_id ? 
                matchups.find((m: any) => m.matchup_id === matchup.matchup_id && m.roster_id !== matchup.roster_id)?.roster_id?.toString() : 
                undefined
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch week ${week} scores:`, error);
        }
      }

      return scores;
    } catch (error) {
      console.error('Failed to fetch Sleeper scores:', error);
      return [];
    }
  }

  async fetchSettings(credentials: PlatformCredentials): Promise<PlatformSettings> {
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
        theme: 'dark' // Sleeper's default theme
      }
    };
  }

  async fetchChangesSince(credentials: PlatformCredentials, since: Date): Promise<Partial<SyncData>> {
    // Sleeper doesn't provide timestamp-based incremental sync
    // Would need to cache and compare full datasets
    return {};
  }

  // Helper methods
  private mapScoringType(scoringSettings: any): 'standard' | 'ppr' | 'half-ppr' | 'superflex' {
    if (!scoringSettings) return 'standard';
    
    const receptionPoints = scoringSettings.rec || 0;
    const hasSuperflex = scoringSettings.super_flex || false;
    
    if (hasSuperflex) return 'superflex';
    if (receptionPoints === 1) return 'ppr';
    if (receptionPoints === 0.5) return 'half-ppr';
    return 'standard';
  }

  private parseRosterPositions(positions: string[]): string[] {
    return positions || ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
  }

  private parseStarterPositions(positions: string[]): Record<string, number> {
    const starters: Record<string, number> = {};
    
    for (const pos of positions || []) {
      starters[pos] = (starters[pos] || 0) + 1;
    }
    
    return starters;
  }

  private mapPlayer(playerId: string, players: any, slotType: string): any {
    const player = players[playerId];
    
    return {
      playerId,
      playerName: player ? `${player.first_name} ${player.last_name}` : 'Unknown Player',
      position: player?.position || 'UNKNOWN',
      team: player?.team || 'FA',
      slotPosition: slotType === 'starter' ? (player?.position || 'FLEX') : 'BE',
      isLocked: false,
      projectedPoints: 0,
      actualPoints: 0
    };
  }

  private mapTransactionType(type: string): 'trade' | 'waiver' | 'free-agent' | 'drop' {
    const typeMap: Record<string, 'trade' | 'waiver' | 'free-agent' | 'drop'> = {
      'trade': 'trade',
      'waiver': 'waiver',
      'free_agent': 'free-agent',
      'commissioner': 'free-agent'
    };
    return typeMap[type] || 'free-agent';
  }
}