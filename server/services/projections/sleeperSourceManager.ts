import axios from 'axios';

// Sleeper API endpoints
export const SLEEPER_ENDPOINTS = {
  PLAYER_DATA: 'https://api.sleeper.app/v1/players/nfl',
  NFL_STATS_2024: 'https://api.sleeper.app/v1/stats/nfl/regular/2024/1', // Real 2024 NFL statistics (BEST DATA SOURCE)
  SEASONAL_PROJECTIONS: 'https://api.sleeper.app/v1/projections/nfl/2024/regular/1', // Back to projections but lower threshold
  WEEKLY_PROJECTIONS: 'https://api.sleeper.app/v1/projections/nfl/2024/regular/11', // Working ADP source
  LEAGUE_MATCHUPS: 'https://api.sleeper.app/v1/league/{league_id}/matchups/{week}'
} as const;

export interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string;
  birth_date?: string;
  active: boolean;
}

export interface SleeperProjection {
  pts_ppr?: number;
  pts_half_ppr?: number;
  pts_std?: number;
  rec?: number;
  rush_yd?: number;
  rec_yd?: number;
  pass_yd?: number;
  pass_td?: number;
  rush_td?: number;
  rec_td?: number;
  adp_dd_ppr?: number; // ADP data sometimes returned instead
  adp_dd_half_ppr?: number;
  adp_dd_std?: number;
}

export interface LeagueMatchupPlayer {
  player_id: string;
  starters_points: number;
}

export interface ProjectionSource {
  type: 'season' | 'league' | 'rosters';
  league_id?: string;
  week?: number;
}

/**
 * Unified Sleeper API service for dynamic source switching
 */
export class SleeperSourceManager {
  private cache = {
    players: null as Record<string, SleeperPlayer> | null,
    seasonalProjections: null as Record<string, SleeperProjection> | null,
    leagueProjections: null as Record<string, LeagueMatchupPlayer> | null,
    lastFetch: 0
  };

  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  /**
   * Fetch player metadata from Sleeper
   */
  async fetchPlayerMetadata(): Promise<Record<string, SleeperPlayer>> {
    console.log('🔄 Fetching player metadata from Sleeper...');
    
    try {
      const response = await axios.get(SLEEPER_ENDPOINTS.PLAYER_DATA, {
        timeout: 15000
      });
      
      const players = response.data || {};
      console.log(`✅ Fetched ${Object.keys(players).length} players from Sleeper`);
      
      this.cache.players = players;
      this.cache.lastFetch = Date.now();
      
      return players;
    } catch (error) {
      console.error('❌ Failed to fetch player metadata:', error);
      throw new Error('Unable to fetch player data from Sleeper API');
    }
  }

  /**
   * Fetch seasonal projections with multi-tier fallback system
   */
  async fetchSeasonalProjections(leagueId: string = '1197631162923614208'): Promise<{
    projections: Record<string, SleeperProjection | LeagueMatchupPlayer>;
    sourceType: 'season' | 'league' | 'rosters' | 'stats';
  }> {
    // FORCE: Always use NFL stats for real data
    console.log('🔧 FORCING: Using 2024 NFL stats endpoint for real player data');
    return await this.fetchNFL2024Stats();
    console.log('🔄 Fetching 2024 seasonal projections from Sleeper (2025 not yet available)...');
    console.log(`📡 Seasonal API URL: ${seasonalUrl}`);
    
    try {
      const response = await axios.get(seasonalUrl, {
        timeout: 15000
      });
      
      console.log(`🌐 HTTP Status: ${response.status}`);
      console.log(`📦 Response Headers:`, response.headers['content-type']);
      
      const projections = response.data || {};
      console.log(`📊 Raw response type: ${typeof projections}`);
      console.log(`📊 2024 seasonal projections: ${Object.keys(projections).length} players`);
      
      // Log sample projection data if available
      if (Object.keys(projections).length > 0) {
        const firstPlayerId = Object.keys(projections)[0];
        const firstProjection = projections[firstPlayerId];
        console.log(`🎯 Sample projection for ${firstPlayerId}:`, JSON.stringify(firstProjection, null, 2));
        
        // Check for nested stats structure
        if (firstProjection && typeof firstProjection === 'object') {
          console.log(`🔍 Available keys in projection:`, Object.keys(firstProjection));
          if (firstProjection.stats) {
            console.log(`📊 Stats sub-object:`, JSON.stringify(firstProjection.stats, null, 2).slice(0, 300));
          }
        }
      } else {
        console.warn(`⚠️ No projection data returned from ${seasonalUrl}`);
      }
      
      // SKIP ALL FALLBACK LOGIC - Direct to NFL stats
      console.warn('⚠️ Skipping all projection validation - using NFL stats exclusively');
      
      // FORCE: Always use 2024 NFL stats for real data - skip all other logic
      console.warn('🔧 FORCING: 2024 NFL stats endpoint for real player data');
      return await this.fetchNFL2024Stats();
      
      this.cache.seasonalProjections = projections;
      this.cache.lastFetch = Date.now();
      
      return {
        projections,
        sourceType: 'season'
      };
    } catch (error) {
      console.error('❌ Failed to fetch seasonal projections:', error);
      if (error.response) {
        console.error(`❌ HTTP Status: ${error.response.status}`);
        console.error(`❌ Response Data:`, error.response.data);
      }
      console.log('🔄 Trying multi-tier fallback...');
      return await this.fetchMultiTierFallback(leagueId);
    }
  }

  /**
   * Multi-tier fallback system: matchups -> rosters
   */
  private async fetchMultiTierFallback(leagueId: string): Promise<{
    projections: Record<string, SleeperProjection | LeagueMatchupPlayer>;
    sourceType: 'league' | 'rosters';
  }> {
    // Tier 1: Try league matchups across multiple weeks
    console.log(`🔄 Tier 1 fallback: Searching league matchups (League: ${leagueId})...`);
    
    let foundData = false;
    const leagueProjections: Record<string, LeagueMatchupPlayer> = {};
    
    // Search weeks 1-18 for available matchup data
    for (let week = 1; week <= 18; week++) {
      try {
        const matchupsUrl = SLEEPER_ENDPOINTS.LEAGUE_MATCHUPS
          .replace('{league_id}', leagueId)
          .replace('{week}', week.toString());
          
        console.log(`🔍 Fetching week ${week} matchups from: ${matchupsUrl}`);
        
        const response = await axios.get(matchupsUrl, { timeout: 15000 });
        
        console.log(`🌐 Week ${week} HTTP Status: ${response.status}`);
        console.log(`📦 Week ${week} Response type: ${typeof response.data}`);
        
        const matchups = response.data || [];
        console.log(`📊 Week ${week} matchups count: ${matchups.length}`);
        
        if (matchups && matchups.length > 0) {
          foundData = true;
          console.log(`✅ Found matchup data for week ${week}`);
          
          // Log sample matchup structure
          if (matchups[0]) {
            console.log(`🎯 Sample matchup structure:`, JSON.stringify(matchups[0], null, 2));
          }
          
          for (const matchup of matchups) {
            const starters = matchup.starters || [];
            const startersPoints = matchup.starters_points || [];
            
            console.log(`📋 Matchup starters: ${starters.length}, points: ${startersPoints.length}`);
            
            for (let i = 0; i < starters.length; i++) {
              const playerId = starters[i];
              const points = startersPoints[i];
              
              if (playerId && points !== undefined) {
                leagueProjections[playerId] = {
                  player_id: playerId,
                  starters_points: points
                };
                
                // Log first few player entries
                if (Object.keys(leagueProjections).length <= 3) {
                  console.log(`🎯 Player ${playerId}: ${points} points`);
                }
              }
            }
          }
          break; // Use first available week
        }
      } catch (error) {
        console.log(`❌ Week ${week} matchups error:`, error.response?.status || error.message);
        continue;
      }
    }
    
    if (foundData) {
      console.log(`✅ League matchups fallback: ${Object.keys(leagueProjections).length} players`);
      this.cache.leagueProjections = leagueProjections;
      this.cache.lastFetch = Date.now();
      
      return {
        projections: leagueProjections,
        sourceType: 'league'
      };
    }
    
    // Tier 2: Roster-based fallback
    console.warn('⚠️ Matchups empty — fallback to rosters.');
    return await this.fetchRostersFallback(leagueId);
  }

  /**
   * Roster-based fallback using active league players
   */
  private async fetchRostersFallback(leagueId: string): Promise<{
    projections: Record<string, SleeperProjection>;
    sourceType: 'rosters';
  }> {
    console.log(`🔄 Tier 2 fallback: Using league rosters (League: ${leagueId})...`);
    
    try {
      // Get active roster players
      const rostersUrl = `https://api.sleeper.app/v1/league/${leagueId}/rosters`;
      console.log(`📡 Rosters API URL: ${rostersUrl}`);
      
      const rostersResponse = await axios.get(rostersUrl, { timeout: 15000 });
      
      console.log(`🌐 Rosters HTTP Status: ${rostersResponse.status}`);
      console.log(`📦 Rosters response type: ${typeof rostersResponse.data}`);
      
      const rosters = rostersResponse.data || [];
      console.log(`🏈 League rosters count: ${rosters.length}`);
      
      const activePlayerIds = new Set<string>();
      for (const roster of rosters) {
        if (roster.players) {
          roster.players.forEach((playerId: string) => activePlayerIds.add(playerId));
        }
      }
      
      console.log(`📊 Active roster players: ${activePlayerIds.size}`);
      console.log(`🎯 Sample player IDs: ${Array.from(activePlayerIds).slice(0, 5).join(', ')}`);
      
      // Get projections for active players
      const seasonalUrl = SLEEPER_ENDPOINTS.SEASONAL_PROJECTIONS;
      console.log(`📡 Getting projections from: ${seasonalUrl}`);
      
      const projResponse = await axios.get(seasonalUrl, { timeout: 15000 });
      const allProjections = projResponse.data || {};
      
      console.log(`📊 All projections available: ${Object.keys(allProjections).length}`);
      
      const rosterProjections: Record<string, SleeperProjection> = {};
      for (const playerId of activePlayerIds) {
        if (allProjections[playerId]) {
          rosterProjections[playerId] = allProjections[playerId];
        }
      }
      
      console.log(`✅ Rosters fallback: ${Object.keys(rosterProjections).length} players with projections`);
      
      // Log sample roster projection
      if (Object.keys(rosterProjections).length > 0) {
        const firstPlayerId = Object.keys(rosterProjections)[0];
        const firstProjection = rosterProjections[firstPlayerId];
        console.log(`🎯 Sample roster projection for ${firstPlayerId}:`, JSON.stringify(firstProjection, null, 2));
      }
      
      return {
        projections: rosterProjections,
        sourceType: 'rosters'
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch rosters fallback:', error);
      if (error.response) {
        console.error(`❌ HTTP Status: ${error.response.status}`);
        console.error(`❌ Response Data:`, error.response.data);
      }
      return {
        projections: {},
        sourceType: 'rosters'
      };
    }
  }



  /**
   * Fetch league-specific projections from matchups
   */
  async fetchLeagueProjections(leagueId: string, week: number): Promise<Record<string, LeagueMatchupPlayer>> {
    console.log(`🔄 Fetching league projections for league ${leagueId}, week ${week}...`);
    
    try {
      const url = SLEEPER_ENDPOINTS.LEAGUE_MATCHUPS
        .replace('{league_id}', leagueId)
        .replace('{week}', week.toString());
      
      const response = await axios.get(url, {
        timeout: 15000
      });
      
      const matchups = response.data || [];
      const projections: Record<string, LeagueMatchupPlayer> = {};
      
      // Extract starters_points from matchup data
      matchups.forEach((matchup: any) => {
        if (matchup.starters_points) {
          matchup.starters.forEach((playerId: string, index: number) => {
            projections[playerId] = {
              player_id: playerId,
              starters_points: matchup.starters_points[index] || 0
            };
          });
        }
      });
      
      console.log(`✅ Extracted league projections for ${Object.keys(projections).length} players`);
      
      this.cache.leagueProjections = projections;
      return projections;
    } catch (error) {
      console.error('❌ Failed to fetch league projections:', error);
      throw new Error(`Unable to fetch league projections for ${leagueId}, week ${week}`);
    }
  }

  /**
   * Get projections with dynamic source switching
   */
  async getProjections(source: ProjectionSource): Promise<{
    players: Record<string, SleeperPlayer>;
    projections: Record<string, SleeperProjection | LeagueMatchupPlayer>;
    sourceType: 'season' | 'league' | 'rosters';
  }> {
    // Check cache validity
    const cacheValid = this.cache.lastFetch && (Date.now() - this.cache.lastFetch) < this.CACHE_TTL;
    
    // Always fetch fresh player metadata if cache is stale
    let players = this.cache.players;
    if (!players || !cacheValid) {
      players = await this.fetchPlayerMetadata();
    }

    let projections: Record<string, SleeperProjection | LeagueMatchupPlayer>;
    let sourceType: 'season' | 'league' | 'rosters' | 'stats';

    if (source.type === 'league' && source.league_id && source.week) {
      // League-specific projections
      projections = await this.fetchLeagueProjections(source.league_id, source.week);
      sourceType = 'league';
      console.log(`📊 Using league-specific projections for ${source.league_id}, week ${source.week}`);
    } else {
      // Seasonal projections with automatic fallback
      const result = await this.fetchSeasonalProjections();
      projections = result.projections;
      sourceType = result.sourceType;
      console.log(`📊 Using ${sourceType} projections`);
    }

    return {
      players,
      projections,
      sourceType
    };
  }

  /**
   * Fetch 2024 NFL stats for real fantasy data
   */
  private async fetchNFL2024Stats(): Promise<{
    projections: Record<string, any>;
    sourceType: 'stats';
  }> {
    console.log('🔄 Fetching 2024 NFL stats (Week 1) for real fantasy data...');
    
    try {
      const response = await axios.get(SLEEPER_ENDPOINTS.NFL_STATS_2024, { timeout: 15000 });
      const stats = response.data || {};
      
      console.log(`📊 2024 NFL stats: ${Object.keys(stats).length} players`);
      
      // Convert NFL stats to fantasy points format
      const fantasyProjections: Record<string, any> = {};
      
      for (const [playerId, playerStats] of Object.entries(stats)) {
        const s = playerStats as any;
        
        // Calculate fantasy points from real NFL stats
        let fantasyPoints = 0;
        
        // Passing stats (QB)
        if (s.pass_yd) fantasyPoints += s.pass_yd * 0.04; // 1pt per 25 yards
        if (s.pass_td) fantasyPoints += s.pass_td * 4; // 4pts per TD
        if (s.pass_int) fantasyPoints -= s.pass_int * 2; // -2pts per INT
        
        // Rushing stats (RB, QB)
        if (s.rush_yd) fantasyPoints += s.rush_yd * 0.1; // 1pt per 10 yards
        if (s.rush_td) fantasyPoints += s.rush_td * 6; // 6pts per TD
        
        // Receiving stats (WR, RB, TE)
        if (s.rec) fantasyPoints += s.rec * 1; // PPR: 1pt per reception
        if (s.rec_yd) fantasyPoints += s.rec_yd * 0.1; // 1pt per 10 yards
        if (s.rec_td) fantasyPoints += s.rec_td * 6; // 6pts per TD
        
        // Only include players with meaningful fantasy production
        if (fantasyPoints >= 5) {
          fantasyProjections[playerId] = {
            pts_ppr: fantasyPoints,
            pts_half_ppr: fantasyPoints - (s.rec || 0) * 0.5,
            pts_std: fantasyPoints - (s.rec || 0),
            stats: s
          };
        }
      }
      
      console.log(`✅ NFL stats conversion: ${Object.keys(fantasyProjections).length} players with ≥5 fantasy points`);
      
      return {
        projections: fantasyProjections,
        sourceType: 'stats'
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch 2024 NFL stats:', error);
      throw error;
    }
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return {
      cached: this.cache.players !== null,
      lastFetch: this.cache.lastFetch,
      age: this.cache.lastFetch ? Date.now() - this.cache.lastFetch : 0,
      ttl: this.CACHE_TTL,
      playersCount: this.cache.players ? Object.keys(this.cache.players).length : 0,
      seasonalProjectionsCount: this.cache.seasonalProjections ? Object.keys(this.cache.seasonalProjections).length : 0,
      leagueProjectionsCount: this.cache.leagueProjections ? Object.keys(this.cache.leagueProjections).length : 0
    };
  }
}

export const sleeperSourceManager = new SleeperSourceManager();