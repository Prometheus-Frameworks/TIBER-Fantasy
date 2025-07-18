interface FantasyProPlayer {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  jersey_number?: number;
  height?: string;
  weight?: number;
  birthdate?: string;
  years_exp?: number;
}

interface FantasyProRanking {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  rank: number;
  tier?: number;
  notes?: string;
}

interface FantasyProProjection {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  projected_points: number;
  games?: number;
  [key: string]: any; // For position-specific stats
}

type FantasyProEndpoint = 'players' | 'rankings' | 'projections';
type FantasyProSport = 'nfl' | 'nba' | 'mlb' | 'nhl';
type FantasyProScoringType = 'std' | 'half-ppr' | 'ppr' | 'superflex';

class FantasyProService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.fantasypros.com/public/v2';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.apiKey = process.env.FANTASYPROS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ FantasyPros API key not found - service will be disabled');
    } else {
      console.log('✅ FantasyPros API key configured');
    }
  }

  private getCacheKey(endpoint: FantasyProEndpoint, sport: FantasyProSport, params?: Record<string, string>): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${endpoint}_${sport}_${paramStr}`;
  }

  private isValidData(data: any): boolean {
    return data && typeof data === 'object' && !data.error;
  }

  private async makeRequest(url: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('FantasyPros API key not configured');
    }

    console.log(`🔄 Making request to: ${url}`);
    console.log(`🔑 Using API key: ${this.apiKey.substring(0, 8)}...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'FantasyProService/1.0'
      }
    });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error response: ${errorText}`);
      
      if (response.status === 403) {
        throw new Error(`FantasyPros API authentication failed. The API key may be invalid or expired. Status: ${response.status}`);
      }
      
      throw new Error(`FantasyPros API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!this.isValidData(data)) {
      throw new Error('Invalid data received from FantasyPros API');
    }

    console.log(`✅ Successfully fetched data (${Array.isArray(data) ? data.length : 1} items)`);
    return data;
  }

  async fetchPlayers(sport: FantasyProSport = 'nfl', useCache: boolean = true): Promise<FantasyProPlayer[]> {
    const cacheKey = this.getCacheKey('players', sport);
    
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📦 Using cached FantasyPros players data`);
        return cached.data;
      }
    }

    try {
      const url = `${this.baseUrl}/players/${sport}`;
      console.log(`🔄 Fetching FantasyPros players from: ${url}`);
      
      const data = await this.makeRequest(url);
      
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      console.log(`✅ FantasyPros players data cached: ${data.length || 0} players`);
      
      return data;
    } catch (error) {
      console.error('❌ FantasyPros players fetch failed:', error);
      throw error;
    }
  }

  async fetchRankings(
    sport: FantasyProSport = 'nfl',
    params?: {
      position?: string;
      week?: string;
      scoring?: FantasyProScoringType;
      year?: string;
    },
    useCache: boolean = true
  ): Promise<FantasyProRanking[]> {
    const cacheKey = this.getCacheKey('rankings', sport, params);
    
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📦 Using cached FantasyPros rankings data`);
        return cached.data;
      }
    }

    try {
      let url = `${this.baseUrl}/rankings/${sport}`;
      
      if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value) searchParams.append(key, value);
        });
        if (searchParams.toString()) {
          url += `?${searchParams.toString()}`;
        }
      }

      console.log(`🔄 Fetching FantasyPros rankings from: ${url}`);
      
      const data = await this.makeRequest(url);
      
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      console.log(`✅ FantasyPros rankings data cached: ${data.length || 0} rankings`);
      
      return data;
    } catch (error) {
      console.error('❌ FantasyPros rankings fetch failed:', error);
      throw error;
    }
  }

  async fetchProjections(
    sport: FantasyProSport = 'nfl',
    params?: {
      position?: string;
      week?: string;
      scoring?: FantasyProScoringType;
      year?: string;
    },
    useCache: boolean = true
  ): Promise<FantasyProProjection[]> {
    const cacheKey = this.getCacheKey('projections', sport, params);
    
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📦 Using cached FantasyPros projections data`);
        return cached.data;
      }
    }

    try {
      let url = `${this.baseUrl}/projections/${sport}`;
      
      if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value) searchParams.append(key, value);
        });
        if (searchParams.toString()) {
          url += `?${searchParams.toString()}`;
        }
      }

      console.log(`🔄 Fetching FantasyPros projections from: ${url}`);
      
      const data = await this.makeRequest(url);
      
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      console.log(`✅ FantasyPros projections data cached: ${data.length || 0} projections`);
      
      return data;
    } catch (error) {
      console.error('❌ FantasyPros projections fetch failed:', error);
      throw error;
    }
  }

  // Generic method for flexible endpoint control
  async fetchData(
    endpoint: FantasyProEndpoint,
    sport: FantasyProSport = 'nfl',
    params?: Record<string, string>,
    useCache: boolean = true
  ): Promise<any> {
    switch (endpoint) {
      case 'players':
        return this.fetchPlayers(sport, useCache);
      case 'rankings':
        return this.fetchRankings(sport, params, useCache);
      case 'projections':
        return this.fetchProjections(sport, params, useCache);
      default:
        throw new Error(`Unsupported endpoint: ${endpoint}`);
    }
  }

  // Clear cache method
  clearCache(endpoint?: FantasyProEndpoint, sport?: FantasyProSport): void {
    if (endpoint && sport) {
      const pattern = `${endpoint}_${sport}`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(pattern)) {
          this.cache.delete(key);
        }
      }
      console.log(`🗑️ Cleared FantasyPros cache for ${endpoint}/${sport}`);
    } else {
      this.cache.clear();
      console.log(`🗑️ Cleared all FantasyPros cache`);
    }
  }

  // Get cache status
  getCacheStatus(): { endpoint: string; sport: string; cached: number; total: number } {
    const cacheEntries = Array.from(this.cache.keys());
    const now = Date.now();
    const validEntries = cacheEntries.filter(key => {
      const cached = this.cache.get(key);
      return cached && (now - cached.timestamp < this.cacheTimeout);
    });

    return {
      endpoint: 'all',
      sport: 'all',
      cached: validEntries.length,
      total: cacheEntries.length
    };
  }

  // Check if service is available
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

export const fantasyProService = new FantasyProService();
export type { FantasyProPlayer, FantasyProRanking, FantasyProProjection, FantasyProEndpoint, FantasyProSport, FantasyProScoringType };