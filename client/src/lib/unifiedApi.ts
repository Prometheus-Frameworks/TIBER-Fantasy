/**
 * Unified API Client for the consolidated player pool system
 * This replaces all the scattered API calls across different endpoints
 */

export interface UnifiedPlayer {
  id: string;
  name: string;
  team: string;
  pos: 'QB' | 'RB' | 'WR' | 'TE';
  rank: number;
  proj_pts: number;
  tier: string;
  adp?: number;
  vorp?: number;
  compass?: {
    north: number;
    east: number;
    south: number;
    west: number;
    score: number;
  };
  dynasty_score?: number;
  redraft_score?: number;
  usage_score?: number;
  rookie_grade?: string;
  last_updated: string;
}

export interface PlayerPoolResponse {
  ok: boolean;
  data: UnifiedPlayer[];
  meta: {
    total_players: number;
    by_position: Record<string, number>;
    last_sync: string;
    data_sources: string[];
    filters_applied: any;
    timestamp: string;
  };
}

export interface PlayerResponse {
  ok: boolean;
  data: UnifiedPlayer;
  meta: {
    last_updated: string;
  };
}

export interface PlayerFilters {
  pos?: string;
  limit?: number;
  search?: string;
  minRank?: number;
  maxRank?: number;
}

class UnifiedApiClient {
  private baseUrl = '';

  async getPlayers(filters: PlayerFilters = {}): Promise<UnifiedPlayer[]> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const url = `/api/unified-players${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    const data: PlayerPoolResponse = await response.json();

    if (!data.ok) {
      throw new Error(`API Error: ${(data as any).error || 'Unknown error'}`);
    }

    return data.data;
  }

  async getPlayer(id: string): Promise<UnifiedPlayer> {
    const response = await fetch(`/api/unified-players/${id}`);
    const data: PlayerResponse = await response.json();

    if (!data.ok) {
      throw new Error(`Player not found: ${id}`);
    }

    return data.data;
  }

  async refreshPlayerPool(): Promise<void> {
    const response = await fetch('/api/unified-players/refresh', {
      method: 'POST'
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Refresh failed: ${data.error}`);
    }
  }

  // Helper methods for common use cases

  async getRedraftRankings(pos?: string, limit: number = 50): Promise<UnifiedPlayer[]> {
    return this.getPlayers({ pos, limit });
  }

  async getDynastyRankings(pos?: string, limit: number = 50): Promise<UnifiedPlayer[]> {
    const players = await this.getPlayers({ pos, limit });
    return players.sort((a, b) => (b.dynasty_score || 0) - (a.dynasty_score || 0));
  }

  async getWaiverWire(limit: number = 50): Promise<UnifiedPlayer[]> {
    return this.getPlayers({ minRank: 51, maxRank: 200, limit });
  }

  async searchPlayers(search: string, pos?: string, limit: number = 20): Promise<UnifiedPlayer[]> {
    return this.getPlayers({ search, pos, limit });
  }

  async getPlayersByTier(tier: string, pos?: string): Promise<UnifiedPlayer[]> {
    const players = await this.getPlayers({ pos });
    return players.filter(p => p.tier === tier);
  }

  async getTopPerformers(pos?: string, limit: number = 10): Promise<UnifiedPlayer[]> {
    const players = await this.getPlayers({ pos, limit });
    return players.sort((a, b) => b.proj_pts - a.proj_pts);
  }
}

export const unifiedApi = new UnifiedApiClient();