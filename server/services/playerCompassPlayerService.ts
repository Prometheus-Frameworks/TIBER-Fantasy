import { PlayerCompassService } from "./playerCompassService";

// Player Compass focused player service - in-house technical analysis
export interface CompassPlayer {
  id: string;
  name: string;
  team: string;
  pos: "QB" | "RB" | "WR" | "TE";
  compassScore: number;
  tier: string;
  volumeScore: number;
  talentScore: number;
  environmentScore: number;
  riskScore: number;
}

export interface PlayerFilters {
  pos?: string;
  team?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// Sample Compass data - this will integrate with actual PlayerCompassService
const SAMPLE_COMPASS_PLAYERS: CompassPlayer[] = [
  { id: "ja-marr-chase", name: "Ja'Marr Chase", team: "CIN", pos: "WR", compassScore: 8.2, tier: "High-End Dynasty", volumeScore: 85, talentScore: 95, environmentScore: 82, riskScore: 15 },
  { id: "ceedee-lamb", name: "CeeDee Lamb", team: "DAL", pos: "WR", compassScore: 8.0, tier: "High-End Dynasty", volumeScore: 88, talentScore: 92, environmentScore: 85, riskScore: 18 },
  { id: "justin-jefferson", name: "Justin Jefferson", team: "MIN", pos: "WR", compassScore: 7.9, tier: "High-End Dynasty", volumeScore: 90, talentScore: 96, environmentScore: 78, riskScore: 12 },
  { id: "tyreek-hill", name: "Tyreek Hill", team: "MIA", pos: "WR", compassScore: 7.5, tier: "Dynasty Solid", volumeScore: 83, talentScore: 89, environmentScore: 80, riskScore: 25 },
  { id: "davante-adams", name: "Davante Adams", team: "LV", pos: "WR", compassScore: 7.3, tier: "Dynasty Solid", volumeScore: 86, talentScore: 93, environmentScore: 75, riskScore: 30 },
  
  { id: "josh-allen", name: "Josh Allen", team: "BUF", pos: "QB", compassScore: 5.0, tier: "Dynasty Risk", volumeScore: 92, talentScore: 88, environmentScore: 85, riskScore: 40 },
  { id: "lamar-jackson", name: "Lamar Jackson", team: "BAL", pos: "QB", compassScore: 5.0, tier: "Dynasty Risk", volumeScore: 89, talentScore: 85, environmentScore: 82, riskScore: 45 },
  { id: "jalen-hurts", name: "Jalen Hurts", team: "PHI", pos: "QB", compassScore: 5.0, tier: "Dynasty Risk", volumeScore: 87, talentScore: 83, environmentScore: 88, riskScore: 42 },
  { id: "patrick-mahomes", name: "Patrick Mahomes", team: "KC", pos: "QB", compassScore: 5.0, tier: "Dynasty Risk", volumeScore: 85, talentScore: 96, environmentScore: 90, riskScore: 35 },
  { id: "joe-burrow", name: "Joe Burrow", team: "CIN", pos: "QB", compassScore: 5.0, tier: "Dynasty Risk", volumeScore: 83, talentScore: 91, environmentScore: 78, riskScore: 38 },

  { id: "christian-mccaffrey", name: "Christian McCaffrey", team: "SF", pos: "RB", compassScore: 6.8, tier: "Dynasty Solid", volumeScore: 95, talentScore: 89, environmentScore: 88, riskScore: 55 },
  { id: "austin-ekeler", name: "Austin Ekeler", team: "LAC", pos: "RB", compassScore: 6.2, tier: "Dynasty Solid", volumeScore: 88, talentScore: 82, environmentScore: 83, riskScore: 48 },
  { id: "nick-chubb", name: "Nick Chubb", team: "CLE", pos: "RB", compassScore: 6.5, tier: "Dynasty Solid", volumeScore: 92, talentScore: 85, environmentScore: 75, riskScore: 52 },
  { id: "derrick-henry", name: "Derrick Henry", team: "TEN", pos: "RB", compassScore: 5.8, tier: "Dynasty Risk", volumeScore: 85, talentScore: 78, environmentScore: 70, riskScore: 65 },
  { id: "jonathan-taylor", name: "Jonathan Taylor", team: "IND", pos: "RB", compassScore: 6.0, tier: "Dynasty Risk", volumeScore: 90, talentScore: 87, environmentScore: 72, riskScore: 58 },

  { id: "travis-kelce", name: "Travis Kelce", team: "KC", pos: "TE", compassScore: 7.1, tier: "Dynasty Solid", volumeScore: 88, talentScore: 92, environmentScore: 90, riskScore: 50 },
  { id: "mark-andrews", name: "Mark Andrews", team: "BAL", pos: "TE", compassScore: 6.5, tier: "Dynasty Solid", volumeScore: 82, talentScore: 85, environmentScore: 82, riskScore: 35 },
  { id: "george-kittle", name: "George Kittle", team: "SF", pos: "TE", compassScore: 6.3, tier: "Dynasty Solid", volumeScore: 78, talentScore: 88, environmentScore: 88, riskScore: 40 },
  { id: "tj-hockenson", name: "T.J. Hockenson", team: "MIN", pos: "TE", compassScore: 5.9, tier: "Dynasty Risk", volumeScore: 75, talentScore: 80, environmentScore: 78, riskScore: 25 },
  { id: "kyle-pitts", name: "Kyle Pitts", team: "ATL", pos: "TE", compassScore: 5.7, tier: "Dynasty Risk", volumeScore: 72, talentScore: 85, environmentScore: 68, riskScore: 30 }
];

export class PlayerCompassPlayerService {
  private compassService = new PlayerCompassService();

  async getPlayers(filters: PlayerFilters = {}) {
    console.log(`🧭 Player Compass API: pos=${filters.pos || "ALL"} team=${filters.team || "ALL"} search="${filters.search || ""}" page=${filters.page || 1}`);
    
    let filteredPlayers = [...SAMPLE_COMPASS_PLAYERS];

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

    // Sort by compass score (descending)
    filteredPlayers.sort((a, b) => b.compassScore - a.compassScore);

    // Pagination
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize || 10));
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex);

    return {
      data: paginatedPlayers,
      meta: {
        source: "player_compass_service",
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

export const playerCompassPlayerService = new PlayerCompassPlayerService();