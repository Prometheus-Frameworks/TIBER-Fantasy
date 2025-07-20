import axios from 'axios';

// Sleeper API endpoints
export const SLEEPER_ENDPOINTS = {
  PLAYER_DATA: 'https://api.sleeper.app/v1/players/nfl',
  SEASONAL_PROJECTIONS: 'https://api.sleeper.com/projections/nfl/2025?season_type=regular&position=QB,RB,WR,TE',
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
}

export interface LeagueMatchupPlayer {
  player_id: string;
  starters_points: number;
}

export interface ProjectionSource {
  type: 'season' | 'league';
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
   * Fetch seasonal projections (2025 season) with ADP fallback
   */
  async fetchSeasonalProjections(): Promise<Record<string, SleeperProjection>> {
    console.log('🔄 Fetching 2025 seasonal projections from Sleeper...');
    
    try {
      // Try 2025 seasonal projections first
      let response = await axios.get(SLEEPER_ENDPOINTS.SEASONAL_PROJECTIONS, {
        timeout: 15000
      });
      
      let projections = response.data || {};
      console.log(`📊 2025 seasonal projections: ${Object.keys(projections).length} players`);
      
      // No fallback - use real data only
      if (Object.keys(projections).length === 0) {
        console.log('⚠️ No seasonal projections available from Sleeper API - returning empty dataset');
      }
      
      this.cache.seasonalProjections = projections;
      return projections;
    } catch (error) {
      console.error('❌ Failed to fetch seasonal projections:', error);
      throw new Error('Unable to fetch seasonal projections from Sleeper API');
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
    sourceType: 'season' | 'league';
  }> {
    // Check cache validity
    const cacheValid = this.cache.lastFetch && (Date.now() - this.cache.lastFetch) < this.CACHE_TTL;
    
    // Always fetch fresh player metadata if cache is stale
    let players = this.cache.players;
    if (!players || !cacheValid) {
      players = await this.fetchPlayerMetadata();
    }

    let projections: Record<string, SleeperProjection | LeagueMatchupPlayer>;
    let sourceType: 'season' | 'league';

    if (source.type === 'league' && source.league_id && source.week) {
      // League-specific projections
      projections = await this.fetchLeagueProjections(source.league_id, source.week);
      sourceType = 'league';
      console.log(`📊 Using league-specific projections for ${source.league_id}, week ${source.week}`);
    } else {
      // Seasonal projections (default)
      projections = this.cache.seasonalProjections && cacheValid 
        ? this.cache.seasonalProjections 
        : await this.fetchSeasonalProjections();
      sourceType = 'season';
      console.log('📊 Using 2025 seasonal projections');
    }

    return {
      players,
      projections,
      sourceType
    };
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