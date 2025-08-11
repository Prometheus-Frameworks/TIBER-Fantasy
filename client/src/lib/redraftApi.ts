import { apiRequest } from './queryClient';

export interface RedraftPlayer {
  id: string;
  player_name: string;
  position: string;
  team: string;
  projected_points?: number;
  adp?: number;
  vorp?: number;
  tier?: string;
}

export interface RedraftApiResponse {
  ok: boolean;
  data: RedraftPlayer[];
}

// API client methods for redraft data
export const api = {
  async redraftRankings(params: { pos: string; limit?: number; season?: string }): Promise<RedraftApiResponse> {
    const query = new URLSearchParams();
    query.append('pos', params.pos);
    query.append('limit', (params.limit || 50).toString());
    query.append('season', params.season || '2025');
    
    const response = await fetch(`/api/redraft/rankings?${query}`);
    return response.json();
  },

  async vorpRankings(params: { position?: string; limit?: number }): Promise<RedraftPlayer[]> {
    const query = new URLSearchParams();
    if (params.position) query.append('position', params.position);
    
    const response = await fetch(`/api/analytics/vorp?${query}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async usageLeaders(params: { limit?: number } = {}): Promise<any> {
    const query = new URLSearchParams();
    query.append('limit', (params.limit || 30).toString());
    
    const response = await fetch(`/api/usage-leaders?${query}`);
    return response.json();
  }
};

// Shared rankings loader function
export async function loadRankings(pos: "QB" | "RB" | "WR" | "TE" | "ALL"): Promise<RedraftPlayer[]> {
  if (pos === "ALL") {
    const [qb, rb, wr, te] = await Promise.all([
      api.redraftRankings({ pos: "QB", limit: 50 }),
      api.redraftRankings({ pos: "RB", limit: 50 }),
      api.redraftRankings({ pos: "WR", limit: 50 }),
      api.redraftRankings({ pos: "TE", limit: 50 }),
    ]);
    
    // Combine all position data
    return [
      ...(qb.data || []),
      ...(rb.data || []),
      ...(wr.data || []),
      ...(te.data || [])
    ];
  }
  
  const result = await api.redraftRankings({ pos, limit: 50 });
  return result.data || [];
}

// Enhanced data merger that combines rankings with VORP and usage data
export async function loadEnhancedRankings(pos: "QB" | "RB" | "WR" | "TE" | "ALL"): Promise<RedraftPlayer[]> {
  const [rankings, vorpData] = await Promise.all([
    loadRankings(pos),
    api.vorpRankings({ position: pos !== "ALL" ? pos : undefined })
  ]);
  
  // Merge rankings with VORP data
  const enhancedPlayers = rankings.map(player => {
    const vorpMatch = vorpData.find(v => 
      v.player_name?.toLowerCase() === player.player_name?.toLowerCase() ||
      v.id === player.id
    );
    
    return {
      ...player,
      vorp: vorpMatch?.vorp || 0,
      projected_points: player.projected_points || vorpMatch?.projected_points || 0
    };
  });
  
  return enhancedPlayers;
}