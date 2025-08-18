// OTC Consensus Player service - community rankings
export interface OTCConsensusPlayer {
  id: string;
  name: string;
  team: string;
  pos: "QB" | "RB" | "WR" | "TE";
  consensusRank: number;
  tier: string;
  votingStrength: number;
  communityConfidence: number;
}

export interface PlayerFilters {
  pos?: string;
  team?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// Sample OTC Consensus data - replace with real community voting implementation
const SAMPLE_CONSENSUS_PLAYERS: OTCConsensusPlayer[] = [
  { id: "ja-marr-chase", name: "Ja'Marr Chase", team: "CIN", pos: "WR", consensusRank: 2, tier: "Tier 1", votingStrength: 95, communityConfidence: 92 },
  { id: "ceedee-lamb", name: "CeeDee Lamb", team: "DAL", pos: "WR", consensusRank: 1, tier: "Tier 1", votingStrength: 97, communityConfidence: 94 },
  { id: "justin-jefferson", name: "Justin Jefferson", team: "MIN", pos: "WR", consensusRank: 3, tier: "Tier 1", votingStrength: 93, communityConfidence: 89 },
  { id: "tyreek-hill", name: "Tyreek Hill", team: "MIA", pos: "WR", consensusRank: 5, tier: "Tier 2", votingStrength: 87, communityConfidence: 85 },
  { id: "davante-adams", name: "Davante Adams", team: "LV", pos: "WR", consensusRank: 4, tier: "Tier 2", votingStrength: 89, communityConfidence: 87 },
  
  { id: "josh-allen", name: "Josh Allen", team: "BUF", pos: "QB", consensusRank: 2, tier: "Tier 1", votingStrength: 91, communityConfidence: 88 },
  { id: "lamar-jackson", name: "Lamar Jackson", team: "BAL", pos: "QB", consensusRank: 3, tier: "Tier 1", votingStrength: 88, communityConfidence: 85 },
  { id: "jalen-hurts", name: "Jalen Hurts", team: "PHI", pos: "QB", consensusRank: 1, tier: "Tier 1", votingStrength: 95, communityConfidence: 91 },
  { id: "patrick-mahomes", name: "Patrick Mahomes", team: "KC", pos: "QB", consensusRank: 4, tier: "Tier 2", votingStrength: 86, communityConfidence: 83 },
  { id: "joe-burrow", name: "Joe Burrow", team: "CIN", pos: "QB", consensusRank: 5, tier: "Tier 2", votingStrength: 84, communityConfidence: 81 },

  { id: "christian-mccaffrey", name: "Christian McCaffrey", team: "SF", pos: "RB", consensusRank: 1, tier: "Tier 1", votingStrength: 98, communityConfidence: 96 },
  { id: "austin-ekeler", name: "Austin Ekeler", team: "LAC", pos: "RB", consensusRank: 3, tier: "Tier 1", votingStrength: 89, communityConfidence: 87 },
  { id: "nick-chubb", name: "Nick Chubb", team: "CLE", pos: "RB", consensusRank: 2, tier: "Tier 1", votingStrength: 92, communityConfidence: 90 },
  { id: "derrick-henry", name: "Derrick Henry", team: "TEN", pos: "RB", consensusRank: 5, tier: "Tier 2", votingStrength: 83, communityConfidence: 80 },
  { id: "jonathan-taylor", name: "Jonathan Taylor", team: "IND", pos: "RB", consensusRank: 4, tier: "Tier 2", votingStrength: 85, communityConfidence: 82 },

  { id: "travis-kelce", name: "Travis Kelce", team: "KC", pos: "TE", consensusRank: 1, tier: "Tier 1", votingStrength: 96, communityConfidence: 94 },
  { id: "mark-andrews", name: "Mark Andrews", team: "BAL", pos: "TE", consensusRank: 2, tier: "Tier 2", votingStrength: 87, communityConfidence: 85 },
  { id: "george-kittle", name: "George Kittle", team: "SF", pos: "TE", consensusRank: 3, tier: "Tier 2", votingStrength: 85, communityConfidence: 83 },
  { id: "tj-hockenson", name: "T.J. Hockenson", team: "MIN", pos: "TE", consensusRank: 4, tier: "Tier 3", votingStrength: 79, communityConfidence: 76 },
  { id: "kyle-pitts", name: "Kyle Pitts", team: "ATL", pos: "TE", consensusRank: 5, tier: "Tier 3", votingStrength: 77, communityConfidence: 74 }
];

export class OTCConsensusPlayerService {
  async getPlayers(filters: PlayerFilters = {}) {
    console.log(`🏆 OTC Consensus API: pos=${filters.pos || "ALL"} team=${filters.team || "ALL"} search="${filters.search || ""}" page=${filters.page || 1}`);
    
    let filteredPlayers = [...SAMPLE_CONSENSUS_PLAYERS];

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

    // Sort by consensus rank
    filteredPlayers.sort((a, b) => a.consensusRank - b.consensusRank);

    // Pagination
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize || 10));
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex);

    return {
      data: paginatedPlayers,
      meta: {
        source: "otc_consensus_service",
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

export const otcConsensusPlayerService = new OTCConsensusPlayerService();