/**
 * Sleeper Roster Sync - Complete Team Download
 * Downloads entire rosters from Sleeper leagues for dynasty analysis
 */

interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  age: number | null;
  status: string;
  injury_status: string | null;
  fantasy_positions: string[];
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players: string[];
  starters: string[];
  reserve: string[];
  taxi: string[];
  settings: any;
}

interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  sport: string;
  season_type: string;
  total_rosters: number;
  settings: any;
  scoring_settings: any;
}

interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export class SleeperRosterSyncService {
  private baseUrl = 'https://api.sleeper.app/v1';
  private rateLimit = 100; // 100ms between requests
  
  /**
   * Download complete league data including all rosters
   */
  async syncCompleteLeague(leagueId: string): Promise<{
    success: boolean;
    league?: SleeperLeague;
    users?: SleeperUser[];
    rosters?: Array<{
      roster: SleeperRoster;
      user: SleeperUser;
      players: Array<{
        sleeperId: string;
        name: string;
        position: string;
        team: string;
        isStarter: boolean;
        isReserve: boolean;
        isTaxi: boolean;
      }>;
    }>;
    totalPlayers?: number;
    error?: string;
  }> {
    try {
      console.log(`🚀 Starting complete Sleeper sync for league: ${leagueId}`);
      
      // 1. Get league info
      const league = await this.fetchLeagueInfo(leagueId);
      if (!league) {
        return { success: false, error: 'League not found' };
      }
      
      // 2. Get all users in league
      const users = await this.fetchLeagueUsers(leagueId);
      if (!users || users.length === 0) {
        return { success: false, error: 'No users found in league' };
      }
      
      // 3. Get all rosters
      const rosters = await this.fetchLeagueRosters(leagueId);
      if (!rosters || rosters.length === 0) {
        return { success: false, error: 'No rosters found in league' };
      }
      
      // 4. Get player database for name mapping
      const playerDB = await this.fetchPlayerDatabase();
      
      // 5. Process each roster with complete player data
      const processedRosters = [];
      let totalPlayers = 0;
      
      for (const roster of rosters) {
        await this.rateLimitDelay();
        
        const user = users.find(u => u.user_id === roster.owner_id);
        if (!user) continue;
        
        const rosterPlayers = [];
        
        // Process all players on roster
        for (const playerId of roster.players || []) {
          const playerInfo = playerDB[playerId];
          if (playerInfo) {
            rosterPlayers.push({
              sleeperId: playerId,
              name: playerInfo.full_name || `${playerInfo.first_name} ${playerInfo.last_name}`,
              position: playerInfo.position || 'UNK',
              team: playerInfo.team || 'FA',
              isStarter: (roster.starters || []).includes(playerId),
              isReserve: (roster.reserve || []).includes(playerId),
              isTaxi: (roster.taxi || []).includes(playerId)
            });
            totalPlayers++;
          }
        }
        
        processedRosters.push({
          roster,
          user,
          players: rosterPlayers
        });
        
        console.log(`✅ Processed roster for ${user.display_name || user.username}: ${rosterPlayers.length} players`);
      }
      
      console.log(`🎯 Complete sync finished: ${processedRosters.length} teams, ${totalPlayers} total players`);
      
      return {
        success: true,
        league,
        users,
        rosters: processedRosters,
        totalPlayers
      };
      
    } catch (error: any) {
      console.error('❌ Sleeper roster sync failed:', error);
      return {
        success: false,
        error: error.message || 'Unknown sync error'
      };
    }
  }
  
  /**
   * Download specific team roster with dynasty values
   */
  async syncTeamRoster(leagueId: string, userId: string): Promise<{
    success: boolean;
    team?: {
      owner: SleeperUser;
      roster: SleeperRoster;
      players: Array<{
        sleeperId: string;
        name: string;
        position: string;
        team: string;
        dynastyValue?: number;
        isStarter: boolean;
      }>;
    };
    error?: string;
  }> {
    try {
      console.log(`🔄 Syncing team roster for user ${userId} in league ${leagueId}`);
      
      // Get league users
      const users = await this.fetchLeagueUsers(leagueId);
      const user = users?.find(u => u.user_id === userId);
      if (!user) {
        return { success: false, error: 'User not found in league' };
      }
      
      // Get rosters
      const rosters = await this.fetchLeagueRosters(leagueId);
      const roster = rosters?.find(r => r.owner_id === userId);
      if (!roster) {
        return { success: false, error: 'Roster not found for user' };
      }
      
      // Get player database
      const playerDB = await this.fetchPlayerDatabase();
      
      // Process roster players
      const players = [];
      for (const playerId of roster.players || []) {
        const playerInfo = playerDB[playerId];
        if (playerInfo) {
          players.push({
            sleeperId: playerId,
            name: playerInfo.full_name || `${playerInfo.first_name} ${playerInfo.last_name}`,
            position: playerInfo.position || 'UNK',
            team: playerInfo.team || 'FA',
            dynastyValue: this.estimateDynastyValue(playerInfo),
            isStarter: (roster.starters || []).includes(playerId)
          });
        }
      }
      
      console.log(`✅ Team sync completed: ${players.length} players for ${user.display_name || user.username}`);
      
      return {
        success: true,
        team: {
          owner: user,
          roster,
          players
        }
      };
      
    } catch (error: any) {
      console.error('❌ Team roster sync failed:', error);
      return {
        success: false,
        error: error.message || 'Team sync failed'
      };
    }
  }
  
  /**
   * Test Sleeper API connectivity
   */
  async testConnection(): Promise<{
    success: boolean;
    apiStatus?: any;
    playerCount?: number;
    error?: string;
  }> {
    try {
      console.log('🧪 Testing Sleeper API connectivity...');
      
      // Test 1: Get NFL state
      const nflState = await this.makeRequest(`${this.baseUrl}/state/nfl`);
      
      // Test 2: Get player count
      const players = await this.makeRequest(`${this.baseUrl}/players/nfl`);
      const playerCount = Object.keys(players || {}).length;
      
      console.log(`✅ Sleeper API test successful: Week ${nflState?.week} of ${nflState?.season}, ${playerCount} players in database`);
      
      return {
        success: true,
        apiStatus: nflState,
        playerCount
      };
      
    } catch (error: any) {
      console.error('❌ Sleeper API test failed:', error);
      return {
        success: false,
        error: error.message || 'Connection test failed'
      };
    }
  }
  
  // Private helper methods
  private async fetchLeagueInfo(leagueId: string): Promise<SleeperLeague | null> {
    return await this.makeRequest(`${this.baseUrl}/league/${leagueId}`);
  }
  
  private async fetchLeagueUsers(leagueId: string): Promise<SleeperUser[] | null> {
    return await this.makeRequest(`${this.baseUrl}/league/${leagueId}/users`);
  }
  
  private async fetchLeagueRosters(leagueId: string): Promise<SleeperRoster[] | null> {
    return await this.makeRequest(`${this.baseUrl}/league/${leagueId}/rosters`);
  }
  
  private async fetchPlayerDatabase(): Promise<Record<string, SleeperPlayer>> {
    const cached = this.getCachedPlayers();
    if (cached) return cached;
    
    const players = await this.makeRequest(`${this.baseUrl}/players/nfl`);
    this.cachePlayersData(players);
    return players || {};
  }
  
  private async makeRequest(url: string): Promise<any> {
    await this.rateLimitDelay();
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Prometheus-Dynasty-Analytics/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  private async rateLimitDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.rateLimit));
  }
  
  private estimateDynastyValue(player: SleeperPlayer): number {
    // Basic dynasty value estimation based on position and status
    const position = player.position;
    const age = player.age || 25;
    const status = player.status;
    
    if (status !== 'Active') return 15;
    
    // Position-based base values
    let baseValue = 30;
    if (position === 'QB') baseValue = 45;
    else if (position === 'RB') baseValue = 35;
    else if (position === 'WR') baseValue = 40;
    else if (position === 'TE') baseValue = 35;
    
    // Age adjustments
    if (age <= 23) baseValue += 20;
    else if (age <= 25) baseValue += 10;
    else if (age <= 27) baseValue += 5;
    else if (age >= 30) baseValue -= 15;
    
    return Math.max(15, Math.min(95, baseValue));
  }
  
  private getCachedPlayers(): Record<string, SleeperPlayer> | null {
    try {
      const fs = require('fs'); // Keep synchronous for cache read performance
      const cached = fs.readFileSync('/tmp/sleeper_players_cache.json', 'utf8');
      const data = JSON.parse(cached);
      
      // Check if cache is less than 1 hour old
      if (Date.now() - data.timestamp < 3600000) {
        return data.players;
      }
    } catch (error) {
      // Cache doesn't exist or is invalid
    }
    
    return null;
  }
  
  private cachePlayersData(players: Record<string, SleeperPlayer>): void {
    try {
      const fs = require('fs'); // Keep synchronous for cache write performance
      const cacheData = {
        timestamp: Date.now(),
        players
      };
      fs.writeFileSync('/tmp/sleeper_players_cache.json', JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache player data:', error);
    }
  }
  
  /**
   * Sync and persist league rosters to database (league_teams table)
   * This is the main entry point for populating roster data for ownership checks
   */
  async syncAndPersistLeague(internalLeagueId: string, sleeperLeagueId: string): Promise<{
    success: boolean;
    leagueId: string;
    teamsUpserted: number;
    totalPlayersStored: number;
    error?: string;
  }> {
    try {
      console.log(`🔄 [RosterSync] Starting sync for league ${internalLeagueId} (Sleeper: ${sleeperLeagueId})`);
      
      // 1. Fetch complete league data from Sleeper
      const syncResult = await this.syncCompleteLeague(sleeperLeagueId);
      
      if (!syncResult.success || !syncResult.rosters) {
        return {
          success: false,
          leagueId: internalLeagueId,
          teamsUpserted: 0,
          totalPlayersStored: 0,
          error: syncResult.error || 'Failed to fetch league data from Sleeper'
        };
      }
      
      // 2. Import db for upserts
      const { db } = await import('./infra/db');
      const { sql } = await import('drizzle-orm');
      
      let teamsUpserted = 0;
      let totalPlayersStored = 0;
      
      // 3. Upsert each roster into league_teams
      for (const rosterData of syncResult.rosters) {
        const { roster, user, players } = rosterData;
        
        // Extract Sleeper player IDs as JSONB array
        const playerIds = players.map(p => p.sleeperId);
        const starterIds = roster.starters || [];
        
        // Upsert using external_roster_id as the unique key
        await db.execute(sql`
          INSERT INTO league_teams (
            id,
            league_id, 
            external_user_id, 
            external_roster_id, 
            display_name, 
            is_commissioner,
            avatar,
            players,
            starters,
            last_synced_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            ${internalLeagueId},
            ${user.user_id},
            ${String(roster.roster_id)},
            ${user.display_name || user.username || `Team ${roster.roster_id}`},
            false,
            ${user.avatar || null},
            ${JSON.stringify(playerIds)}::jsonb,
            ${JSON.stringify(starterIds)}::jsonb,
            NOW(),
            NOW()
          )
          ON CONFLICT (league_id, external_roster_id) 
          DO UPDATE SET
            external_user_id = EXCLUDED.external_user_id,
            display_name = EXCLUDED.display_name,
            avatar = EXCLUDED.avatar,
            players = EXCLUDED.players,
            starters = EXCLUDED.starters,
            last_synced_at = NOW(),
            updated_at = NOW()
        `);
        
        teamsUpserted++;
        totalPlayersStored += playerIds.length;
        
        console.log(`✅ [RosterSync] Upserted team ${user.display_name || user.username}: ${playerIds.length} players`);
      }
      
      console.log(`🎯 [RosterSync] Complete: ${teamsUpserted} teams, ${totalPlayersStored} total players`);
      
      return {
        success: true,
        leagueId: internalLeagueId,
        teamsUpserted,
        totalPlayersStored
      };
      
    } catch (error: any) {
      console.error('❌ [RosterSync] Sync failed:', error);
      return {
        success: false,
        leagueId: internalLeagueId,
        teamsUpserted: 0,
        totalPlayersStored: 0,
        error: error.message || 'Unknown sync error'
      };
    }
  }
}

export const sleeperRosterSync = new SleeperRosterSyncService();