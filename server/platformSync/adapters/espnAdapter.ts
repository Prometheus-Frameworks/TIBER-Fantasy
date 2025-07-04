/**
 * ESPN Fantasy Sports API Adapter
 * Handles authentication, data fetching, and real-time sync for ESPN Fantasy
 */

import { PlatformCredentials, SyncData, UserProfile, LeagueData, TeamData, RosterData, TransactionData, ScoreData, PlatformSettings } from '../index';

export class ESPNSyncAdapter {
  private baseUrl = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl';
  public supportsWebhooks = false; // ESPN doesn't support webhooks
  public supportedDataTypes = ['leagues', 'teams', 'rosters', 'transactions', 'scores', 'settings'];

  /**
   * Authenticate with ESPN using SWID and espn_s2 cookies
   */
  async authenticate(credentials: PlatformCredentials): Promise<boolean> {
    if (!credentials.swid || !credentials.espnS2) {
      throw new Error('ESPN requires both SWID and espn_s2 cookies for authentication');
    }

    try {
      // Test authentication by fetching league info
      const response = await this.makeESPNRequest(
        `/seasons/2024/segments/0/leagues/${credentials.leagueId}`,
        credentials
      );

      return response.status === 200;
    } catch (error) {
      console.error('ESPN authentication failed:', error);
      return false;
    }
  }

  /**
   * Check if connection to ESPN is active
   */
  async checkConnection(credentials: PlatformCredentials | null): Promise<boolean> {
    if (!credentials) return false;
    return await this.authenticate(credentials);
  }

  /**
   * Fetch user profile from ESPN
   */
  async fetchUserProfile(credentials: PlatformCredentials): Promise<UserProfile> {
    try {
      const leagueResponse = await this.makeESPNRequest(
        `/seasons/2024/segments/0/leagues/${credentials.leagueId}`,
        credentials
      );
      
      const leagueData = await leagueResponse.json();
      const currentUser = leagueData.members?.find((member: any) => 
        member.id === credentials.teamId
      );

      return {
        userId: credentials.teamId || 'unknown',
        displayName: currentUser?.displayName || 'ESPN User',
        email: currentUser?.email,
        avatarUrl: currentUser?.profileImageUrl,
        memberSince: new Date(currentUser?.joinedDate || Date.now()),
        totalLeagues: 1, // ESPN API doesn't provide total leagues easily
        favoriteTeam: currentUser?.favoriteTeam
      };
    } catch (error) {
      console.error('Failed to fetch ESPN user profile:', error);
      throw new Error('Unable to fetch user profile from ESPN');
    }
  }

  /**
   * Fetch leagues data from ESPN
   */
  async fetchLeagues(credentials: PlatformCredentials): Promise<LeagueData[]> {
    try {
      const response = await this.makeESPNRequest(
        `/seasons/2024/segments/0/leagues/${credentials.leagueId}`,
        credentials,
        { view: ['mSettings', 'mTeam'] }
      );
      
      const leagueData = await response.json();
      
      return [{
        leagueId: credentials.leagueId,
        name: leagueData.settings?.name || 'ESPN League',
        season: 2024,
        size: leagueData.settings?.size || 10,
        scoringType: this.mapESPNScoringType(leagueData.settings?.scoringSettings),
        rosterPositions: this.parseRosterPositions(leagueData.settings?.rosterSettings),
        tradeDeadline: leagueData.settings?.tradeDeadline ? new Date(leagueData.settings.tradeDeadline) : undefined,
        playoffStart: leagueData.settings?.playoffStartDate ? new Date(leagueData.settings.playoffStartDate) : undefined,
        isActive: leagueData.status?.isActive || true,
        draftStatus: this.mapDraftStatus(leagueData.status?.draftComplete),
        settings: this.parseLeagueSettings(leagueData.settings)
      }];
    } catch (error) {
      console.error('Failed to fetch ESPN leagues:', error);
      throw new Error('Unable to fetch leagues from ESPN');
    }
  }

  /**
   * Fetch teams data from ESPN
   */
  async fetchTeams(credentials: PlatformCredentials): Promise<TeamData[]> {
    try {
      const response = await this.makeESPNRequest(
        `/seasons/2024/segments/0/leagues/${credentials.leagueId}`,
        credentials,
        { view: ['mTeam', 'mRoster', 'mMatchup'] }
      );
      
      const leagueData = await response.json();
      
      return leagueData.teams?.map((team: any) => ({
        teamId: team.id.toString(),
        leagueId: credentials.leagueId,
        ownerId: team.primaryOwner,
        teamName: team.name || `Team ${team.id}`,
        logoUrl: team.logo,
        record: {
          wins: team.record?.overall?.wins || 0,
          losses: team.record?.overall?.losses || 0,
          ties: team.record?.overall?.ties || 0
        },
        pointsFor: team.record?.overall?.pointsFor || 0,
        pointsAgainst: team.record?.overall?.pointsAgainst || 0,
        rank: team.record?.overall?.rank || 0,
        playoffSeed: team.playoffSeed,
        draftPosition: team.draftDayProjectedRank || 0
      })) || [];
    } catch (error) {
      console.error('Failed to fetch ESPN teams:', error);
      throw new Error('Unable to fetch teams from ESPN');
    }
  }

  /**
   * Fetch roster data from ESPN
   */
  async fetchRosters(credentials: PlatformCredentials): Promise<RosterData[]> {
    try {
      const response = await this.makeESPNRequest(
        `/seasons/2024/segments/0/leagues/${credentials.leagueId}`,
        credentials,
        { view: ['mRoster'] }
      );
      
      const leagueData = await response.json();
      const rosters: RosterData[] = [];

      for (const team of leagueData.teams || []) {
        const roster = team.roster;
        if (!roster) continue;

        rosters.push({
          teamId: team.id.toString(),
          leagueId: credentials.leagueId,
          starters: this.parseRosterSlots(roster.entries, 'starter'),
          bench: this.parseRosterSlots(roster.entries, 'bench'),
          ir: this.parseRosterSlots(roster.entries, 'ir'),
          lastUpdated: new Date()
        });
      }

      return rosters;
    } catch (error) {
      console.error('Failed to fetch ESPN rosters:', error);
      throw new Error('Unable to fetch rosters from ESPN');
    }
  }

  /**
   * Fetch transaction data from ESPN
   */
  async fetchTransactions(credentials: PlatformCredentials): Promise<TransactionData[]> {
    try {
      const response = await this.makeESPNRequest(
        `/seasons/2024/segments/0/leagues/${credentials.leagueId}`,
        credentials,
        { view: ['mTransactions2'] }
      );
      
      const leagueData = await response.json();
      
      return (leagueData.transactions || []).map((transaction: any) => ({
        transactionId: transaction.id,
        leagueId: credentials.leagueId,
        type: this.mapTransactionType(transaction.type),
        status: this.mapTransactionStatus(transaction.status),
        timestamp: new Date(transaction.proposedDate || transaction.processDate),
        involvedTeams: transaction.teams || [],
        players: {
          added: this.parseTransactionPlayers(transaction.items, 'add'),
          dropped: this.parseTransactionPlayers(transaction.items, 'drop')
        },
        faabBid: transaction.bidAmount,
        waiverPriority: transaction.waiverOrder
      }));
    } catch (error) {
      console.error('Failed to fetch ESPN transactions:', error);
      throw new Error('Unable to fetch transactions from ESPN');
    }
  }

  /**
   * Fetch scoring data from ESPN
   */
  async fetchScores(credentials: PlatformCredentials): Promise<ScoreData[]> {
    try {
      const scores: ScoreData[] = [];
      
      // Fetch scores for each week (ESPN has up to 17 weeks)
      for (let week = 1; week <= 17; week++) {
        try {
          const response = await this.makeESPNRequest(
            `/seasons/2024/segments/0/leagues/${credentials.leagueId}`,
            credentials,
            { view: ['mMatchup'], scoringPeriodId: week }
          );
          
          const leagueData = await response.json();
          
          for (const team of leagueData.teams || []) {
            const matchup = team.matchup;
            if (!matchup) continue;

            scores.push({
              teamId: team.id.toString(),
              leagueId: credentials.leagueId,
              week,
              season: 2024,
              totalPoints: matchup.totalPoints || 0,
              projectedPoints: matchup.totalProjectedPoints || 0,
              playerScores: this.parsePlayerScores(team.roster?.entries || []),
              matchupOpponent: matchup.away?.teamId === team.id ? 
                matchup.home?.teamId?.toString() : 
                matchup.away?.teamId?.toString(),
              result: this.determineMatchupResult(matchup, team.id)
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch week ${week} scores:`, error);
        }
      }

      return scores;
    } catch (error) {
      console.error('Failed to fetch ESPN scores:', error);
      throw new Error('Unable to fetch scores from ESPN');
    }
  }

  /**
   * Fetch platform settings from ESPN
   */
  async fetchSettings(credentials: PlatformCredentials): Promise<PlatformSettings> {
    try {
      const response = await this.makeESPNRequest(
        `/seasons/2024/segments/0/leagues/${credentials.leagueId}`,
        credentials,
        { view: ['mSettings'] }
      );
      
      const leagueData = await response.json();
      const settings = leagueData.settings || {};

      return {
        notifications: {
          trades: settings.tradeNotifications !== false,
          waivers: settings.waiverNotifications !== false,
          scores: settings.scoreNotifications !== false,
          news: settings.newsNotifications !== false
        },
        privacy: {
          shareRoster: settings.isPublic !== false,
          shareRecord: settings.showRecord !== false,
          allowMessages: settings.allowMessages !== false
        },
        preferences: {
          timezone: settings.timeZone || 'America/New_York',
          language: 'en',
          theme: 'light'
        }
      };
    } catch (error) {
      console.error('Failed to fetch ESPN settings:', error);
      throw new Error('Unable to fetch settings from ESPN');
    }
  }

  /**
   * Fetch changes since last sync (ESPN doesn't support incremental sync)
   */
  async fetchChangesSince(credentials: PlatformCredentials, since: Date): Promise<Partial<SyncData>> {
    // ESPN doesn't provide incremental sync, so we return empty changes
    // In a real implementation, you would cache the last state and compare
    return {};
  }

  // Helper methods for data transformation
  private async makeESPNRequest(endpoint: string, credentials: PlatformCredentials, params?: any): Promise<Response> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (Array.isArray(params[key])) {
          params[key].forEach((value: any) => url.searchParams.append(key, value));
        } else {
          url.searchParams.append(key, params[key]);
        }
      });
    }

    return fetch(url.toString(), {
      headers: {
        'Cookie': `SWID=${credentials.swid}; espn_s2=${credentials.espnS2};`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; FantasyWeakness/1.0)'
      }
    });
  }

  private mapESPNScoringType(scoringSettings: any): 'standard' | 'ppr' | 'half-ppr' | 'superflex' {
    if (!scoringSettings) return 'standard';
    
    const receptionPoints = scoringSettings['53'] || 0; // Reception points
    const qbFlexExists = scoringSettings.rosterSettings?.some((pos: any) => pos.position === 'QB/RB/WR/TE');
    
    if (qbFlexExists) return 'superflex';
    if (receptionPoints === 1) return 'ppr';
    if (receptionPoints === 0.5) return 'half-ppr';
    return 'standard';
  }

  private parseRosterPositions(rosterSettings: any): string[] {
    if (!rosterSettings?.lineupSlotCounts) return ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'D/ST', 'K'];
    
    const positions: string[] = [];
    const slotMap: Record<number, string> = {
      0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 23: 'FLEX', 16: 'D/ST', 17: 'K'
    };
    
    Object.entries(rosterSettings.lineupSlotCounts).forEach(([slotId, count]) => {
      const position = slotMap[parseInt(slotId)];
      if (position) {
        for (let i = 0; i < (count as number); i++) {
          positions.push(position);
        }
      }
    });
    
    return positions;
  }

  private parseLeagueSettings(settings: any): any {
    return {
      scoringSettings: settings?.scoringSettings || {},
      rosterSettings: {
        starters: settings?.rosterSettings?.lineupSlotCounts || {},
        bench: settings?.rosterSettings?.benchSlots || 6,
        ir: settings?.rosterSettings?.iRSlots || 0
      },
      waiverSettings: {
        type: settings?.waiverSettings?.type === 1 ? 'faab' : 'rolling',
        budget: settings?.waiverSettings?.budget,
        clearTime: settings?.waiverSettings?.clearTime || '03:00'
      },
      tradeSettings: {
        deadline: new Date(settings?.tradeSettings?.deadline || Date.now()),
        reviewPeriod: settings?.tradeSettings?.reviewPeriod || 0,
        vetoPeriod: settings?.tradeSettings?.vetoPeriod || 0
      }
    };
  }

  private parseRosterSlots(entries: any[], slotType: string): any[] {
    if (!entries) return [];
    
    return entries
      .filter((entry: any) => this.getSlotType(entry.lineupSlotId) === slotType)
      .map((entry: any) => ({
        playerId: entry.playerId?.toString(),
        playerName: entry.playerPoolEntry?.player?.fullName || 'Unknown Player',
        position: this.mapESPNPosition(entry.playerPoolEntry?.player?.defaultPositionId),
        team: entry.playerPoolEntry?.player?.proTeamId ? this.mapESPNTeam(entry.playerPoolEntry.player.proTeamId) : 'FA',
        slotPosition: this.mapESPNSlot(entry.lineupSlotId),
        isLocked: entry.playerPoolEntry?.player?.injured || false,
        projectedPoints: entry.playerPoolEntry?.player?.stats?.find((s: any) => s.statSourceId === 1)?.appliedTotal,
        actualPoints: entry.playerPoolEntry?.player?.stats?.find((s: any) => s.statSourceId === 0)?.appliedTotal
      }));
  }

  private getSlotType(slotId: number): string {
    if ([0, 2, 4, 6, 16, 17, 23].includes(slotId)) return 'starter';
    if (slotId === 20) return 'bench';
    if (slotId === 21) return 'ir';
    return 'bench';
  }

  private mapESPNPosition(positionId: number): string {
    const positionMap: Record<number, string> = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST'
    };
    return positionMap[positionId] || 'UNKNOWN';
  }

  private mapESPNTeam(teamId: number): string {
    // ESPN team ID mapping - simplified version
    const teamMap: Record<number, string> = {
      1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
      9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN'
      // Add remaining teams...
    };
    return teamMap[teamId] || 'UNK';
  }

  private mapESPNSlot(slotId: number): string {
    const slotMap: Record<number, string> = {
      0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 16: 'D/ST', 17: 'K', 20: 'BE', 21: 'IR', 23: 'FLEX'
    };
    return slotMap[slotId] || 'BE';
  }

  private mapTransactionType(type: number): 'trade' | 'waiver' | 'free-agent' | 'drop' {
    const typeMap: Record<number, 'trade' | 'waiver' | 'free-agent' | 'drop'> = {
      1: 'free-agent', 2: 'waiver', 3: 'trade', 4: 'drop'
    };
    return typeMap[type] || 'free-agent';
  }

  private mapTransactionStatus(status: number): 'pending' | 'executed' | 'vetoed' | 'failed' {
    const statusMap: Record<number, 'pending' | 'executed' | 'vetoed' | 'failed'> = {
      1: 'pending', 2: 'executed', 3: 'vetoed', 4: 'failed'
    };
    return statusMap[status] || 'pending';
  }

  private parseTransactionPlayers(items: any[], action: 'add' | 'drop'): any[] {
    if (!items) return [];
    
    return items
      .filter((item: any) => item.type === (action === 'add' ? 'add' : 'drop'))
      .map((item: any) => ({
        playerId: item.playerId?.toString(),
        playerName: item.player?.fullName || 'Unknown Player',
        position: this.mapESPNPosition(item.player?.defaultPositionId),
        team: this.mapESPNTeam(item.player?.proTeamId),
        slotPosition: 'BE',
        isLocked: false
      }));
  }

  private parsePlayerScores(entries: any[]): any[] {
    if (!entries) return [];
    
    return entries.map((entry: any) => ({
      playerId: entry.playerId?.toString(),
      points: entry.playerPoolEntry?.player?.stats?.find((s: any) => s.statSourceId === 0)?.appliedTotal || 0,
      projected: entry.playerPoolEntry?.player?.stats?.find((s: any) => s.statSourceId === 1)?.appliedTotal || 0,
      started: [0, 2, 4, 6, 16, 17, 23].includes(entry.lineupSlotId)
    }));
  }

  private determineMatchupResult(matchup: any, teamId: number): 'win' | 'loss' | 'tie' | undefined {
    if (!matchup.winner) return undefined;
    if (matchup.winner === teamId) return 'win';
    if (matchup.away?.totalPoints === matchup.home?.totalPoints) return 'tie';
    return 'loss';
  }

  private mapDraftStatus(draftComplete: boolean): 'pre-draft' | 'drafting' | 'post-draft' {
    return draftComplete ? 'post-draft' : 'pre-draft';
  }
}