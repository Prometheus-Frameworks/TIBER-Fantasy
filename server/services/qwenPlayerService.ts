// QwenPlayer interface
export interface QwenPlayer {
  id: string;
  name: string;
  team: string;
  pos: "QB" | "RB" | "WR" | "TE";
  rank: number;
  tier: string;
  performanceScore: number;
}

// PlayerFilters interface  
export interface PlayerFilters {
  pos?: string;
  team?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// Sample Qwen player data - replace with real implementation
const SAMPLE_QWEN_PLAYERS: QwenPlayer[] = [
  { id: "ja-marr-chase", name: "Ja'Marr Chase", team: "CIN", pos: "WR", rank: 1, tier: "Elite", performanceScore: 97.5 },
  { id: "ceedee-lamb", name: "CeeDee Lamb", team: "DAL", pos: "WR", rank: 2, tier: "Elite", performanceScore: 95.2 },
  { id: "justin-jefferson", name: "Justin Jefferson", team: "MIN", pos: "WR", rank: 3, tier: "Elite", performanceScore: 94.8 },
  { id: "tyreek-hill", name: "Tyreek Hill", team: "MIA", pos: "WR", rank: 4, tier: "High-End", performanceScore: 92.1 },
  { id: "davante-adams", name: "Davante Adams", team: "LV", pos: "WR", rank: 5, tier: "High-End", performanceScore: 90.7 },
  
  { id: "josh-allen", name: "Josh Allen", team: "BUF", pos: "QB", rank: 1, tier: "Elite", performanceScore: 96.3 },
  { id: "lamar-jackson", name: "Lamar Jackson", team: "BAL", pos: "QB", rank: 2, tier: "Elite", performanceScore: 94.1 },
  { id: "jalen-hurts", name: "Jalen Hurts", team: "PHI", pos: "QB", rank: 3, tier: "High-End", performanceScore: 91.8 },
  { id: "patrick-mahomes", name: "Patrick Mahomes", team: "KC", pos: "QB", rank: 4, tier: "High-End", performanceScore: 90.5 },
  { id: "joe-burrow", name: "Joe Burrow", team: "CIN", pos: "QB", rank: 5, tier: "High-End", performanceScore: 89.2 },

  { id: "christian-mccaffrey", name: "Christian McCaffrey", team: "SF", pos: "RB", rank: 1, tier: "Elite", performanceScore: 95.8 },
  { id: "austin-ekeler", name: "Austin Ekeler", team: "LAC", pos: "RB", rank: 2, tier: "Elite", performanceScore: 92.4 },
  { id: "nick-chubb", name: "Nick Chubb", team: "CLE", pos: "RB", rank: 3, tier: "High-End", performanceScore: 90.1 },
  { id: "derrick-henry", name: "Derrick Henry", team: "TEN", pos: "RB", rank: 4, tier: "High-End", performanceScore: 88.7 },
  { id: "jonathan-taylor", name: "Jonathan Taylor", team: "IND", pos: "RB", rank: 5, tier: "High-End", performanceScore: 87.3 },

  { id: "travis-kelce", name: "Travis Kelce", team: "KC", pos: "TE", rank: 1, tier: "Elite", performanceScore: 94.2 },
  { id: "mark-andrews", name: "Mark Andrews", team: "BAL", pos: "TE", rank: 2, tier: "High-End", performanceScore: 89.5 },
  { id: "george-kittle", name: "George Kittle", team: "SF", pos: "TE", rank: 3, tier: "High-End", performanceScore: 87.8 },
  { id: "tj-hockenson", name: "T.J. Hockenson", team: "MIN", pos: "TE", rank: 4, tier: "Mid-Tier", performanceScore: 84.1 },
  { id: "kyle-pitts", name: "Kyle Pitts", team: "ATL", pos: "TE", rank: 5, tier: "Mid-Tier", performanceScore: 82.7 }
];

export class QwenPlayerService {
  async getPlayers(filters: PlayerFilters = {}) {
    console.log(`🎯 Qwen Players API: pos=${filters.pos || "ALL"} team=${filters.team || "ALL"} search="${filters.search || ""}" page=${filters.page || 1}`);
    
    let filteredPlayers = [...SAMPLE_QWEN_PLAYERS];

    // Apply position filter (case insensitive)
    if (filters.pos) {
      filteredPlayers = filteredPlayers.filter(p => p.pos.toLowerCase() === filters.pos.toLowerCase());
    }

    // Apply team filter
    if (filters.team) {
      filteredPlayers = filteredPlayers.filter(p => p.team === filters.team);
    }

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredPlayers = filteredPlayers.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.team.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize || 10));
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex);

    return {
      data: paginatedPlayers,
      meta: {
        source: "qwen_player_service",
        version: "1.0",
        ts: new Date().toISOString(),
        total: filteredPlayers.length,
        page,
        pageSize,
        hasNext: endIndex < filteredPlayers.length,
        filters: {
          pos: filters.pos || null,
          team: filters.team || null,
          search: filters.search || null
        }
      }
    };
  }
}

export const qwenPlayerService = new QwenPlayerService();