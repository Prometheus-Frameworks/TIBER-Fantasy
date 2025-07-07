/**
 * Dynasty ADP Service - Real-time dynasty ADP data integration
 * Using Fantasy Football Calculator API (completely free)
 */

export interface DynastyADPPlayer {
  player_name: string;
  team: string;
  position: string;
  adp: number;
  times_drafted: number;
  high: number;
  low: number;
  std_dev: number;
}

export interface RookieADPPlayer {
  player_name: string;
  team: string;
  position: string;
  adp: number;
  times_drafted: number;
  high: number;
  low: number;
  std_dev: number;
}

export interface ADPData {
  dynasty: DynastyADPPlayer[];
  rookie: RookieADPPlayer[];
  lastUpdated: string;
}

class DynastyADPService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

  /**
   * Fetch dynasty ADP data from Fantasy Football Calculator
   */
  async getDynastyADP(teams: number = 12, format: string = 'dynasty'): Promise<DynastyADPPlayer[]> {
    const cacheKey = `dynasty-${teams}-${format}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch(
        `https://api.fantasyfootballcalculator.com/v1/adp/${format}?teams=${teams}`,
        {
          headers: {
            'User-Agent': 'Prometheus Fantasy Analytics (prometheus-fantasy.com)',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Dynasty ADP API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: data.players || [],
        timestamp: Date.now()
      });

      return data.players || [];
    } catch (error) {
      console.error('Failed to fetch dynasty ADP:', error);
      return [];
    }
  }

  /**
   * Fetch dynasty rookie ADP data
   */
  async getRookieADP(teams: number = 12): Promise<RookieADPPlayer[]> {
    const cacheKey = `rookie-${teams}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch(
        `https://api.fantasyfootballcalculator.com/v1/adp/rookie?teams=${teams}`,
        {
          headers: {
            'User-Agent': 'Prometheus Fantasy Analytics (prometheus-fantasy.com)',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Rookie ADP API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: data.players || [],
        timestamp: Date.now()
      });

      return data.players || [];
    } catch (error) {
      console.error('Failed to fetch rookie ADP:', error);
      return [];
    }
  }

  /**
   * Get combined dynasty and rookie ADP data
   */
  async getCombinedADPData(teams: number = 12): Promise<ADPData> {
    const [dynasty, rookie] = await Promise.all([
      this.getDynastyADP(teams),
      this.getRookieADP(teams)
    ]);

    return {
      dynasty,
      rookie,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Find specific player's dynasty ADP
   */
  async getPlayerADP(playerName: string, teams: number = 12): Promise<DynastyADPPlayer | null> {
    const dynastyData = await this.getDynastyADP(teams);
    
    return dynastyData.find(player => 
      player.player_name.toLowerCase().includes(playerName.toLowerCase()) ||
      playerName.toLowerCase().includes(player.player_name.toLowerCase())
    ) || null;
  }

  /**
   * Get ADP for multiple players
   */
  async getMultiplePlayerADP(playerNames: string[], teams: number = 12): Promise<Map<string, DynastyADPPlayer>> {
    const dynastyData = await this.getDynastyADP(teams);
    const results = new Map<string, DynastyADPPlayer>();

    for (const name of playerNames) {
      const adpPlayer = dynastyData.find(player => 
        player.player_name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(player.player_name.toLowerCase())
      );
      
      if (adpPlayer) {
        results.set(name, adpPlayer);
      }
    }

    return results;
  }

  /**
   * Get dynasty ADP trends by position
   */
  async getPositionADPTrends(position: string, teams: number = 12): Promise<DynastyADPPlayer[]> {
    const dynastyData = await this.getDynastyADP(teams);
    
    return dynastyData
      .filter(player => player.position === position.toUpperCase())
      .sort((a, b) => a.adp - b.adp);
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const dynastyADPService = new DynastyADPService();