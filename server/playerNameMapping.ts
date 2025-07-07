/**
 * Player Name Mapping System
 * Bridges ranking player names with NFL database and Sleeper IDs
 */

export interface PlayerNameMap {
  rankingName: string;
  nflName: string;
  sleeperId?: string;
  team: string;
  position: string;
}

/**
 * Manual name mappings for top dynasty players
 */
export const PLAYER_NAME_MAPPINGS: PlayerNameMap[] = [
  // Top QBs
  { rankingName: "Josh Allen", nflName: "J.Allen", team: "BUF", position: "QB" },
  { rankingName: "Lamar Jackson", nflName: "L.Jackson", team: "BAL", position: "QB" },
  { rankingName: "Patrick Mahomes", nflName: "P.Mahomes", team: "KC", position: "QB" },
  { rankingName: "Joe Burrow", nflName: "J.Burrow", team: "CIN", position: "QB" },
  { rankingName: "Jayden Daniels", nflName: "J.Daniels", team: "WAS", position: "QB" },
  { rankingName: "Caleb Williams", nflName: "C.Williams", team: "CHI", position: "QB" },
  { rankingName: "C.J. Stroud", nflName: "C.Stroud", team: "HOU", position: "QB" },
  { rankingName: "Anthony Richardson", nflName: "A.Richardson", team: "IND", position: "QB" },
  { rankingName: "Drake Maye", nflName: "D.Maye", team: "NE", position: "QB" },
  { rankingName: "Bo Nix", nflName: "B.Nix", team: "DEN", position: "QB" },
  
  // Top RBs
  { rankingName: "Saquon Barkley", nflName: "S.Barkley", team: "PHI", position: "RB" },
  { rankingName: "Breece Hall", nflName: "B.Hall", team: "NYJ", position: "RB" },
  { rankingName: "Bijan Robinson", nflName: "B.Robinson", team: "ATL", position: "RB" },
  { rankingName: "Jahmyr Gibbs", nflName: "J.Gibbs", team: "DET", position: "RB" },
  { rankingName: "Kenneth Walker III", nflName: "K.Walker", team: "SEA", position: "RB" },
  { rankingName: "Josh Jacobs", nflName: "J.Jacobs", team: "GB", position: "RB" },
  { rankingName: "De'Von Achane", nflName: "D.Achane", team: "MIA", position: "RB" },
  { rankingName: "Kyren Williams", nflName: "K.Williams", team: "LAR", position: "RB" },
  { rankingName: "Jonathan Taylor", nflName: "J.Taylor", team: "IND", position: "RB" },
  { rankingName: "James Cook", nflName: "J.Cook", team: "BUF", position: "RB" },
  
  // Top WRs
  { rankingName: "Ja'Marr Chase", nflName: "J.Chase", team: "CIN", position: "WR" },
  { rankingName: "Justin Jefferson", nflName: "J.Jefferson", team: "MIN", position: "WR" },
  { rankingName: "CeeDee Lamb", nflName: "C.Lamb", team: "DAL", position: "WR" },
  { rankingName: "Malik Nabers", nflName: "M.Nabers", team: "NYG", position: "WR" },
  { rankingName: "Marvin Harrison Jr.", nflName: "M.Harrison", team: "ARI", position: "WR" },
  { rankingName: "Rome Odunze", nflName: "R.Odunze", team: "CHI", position: "WR" },
  { rankingName: "Puka Nacua", nflName: "P.Nacua", team: "LAR", position: "WR" },
  { rankingName: "Drake London", nflName: "D.London", team: "ATL", position: "WR" },
  { rankingName: "Garrett Wilson", nflName: "G.Wilson", team: "NYJ", position: "WR" },
  { rankingName: "Chris Olave", nflName: "C.Olave", team: "NO", position: "WR" },
  { rankingName: "Amon-Ra St. Brown", nflName: "A.St. Brown", team: "DET", position: "WR" },
  { rankingName: "A.J. Brown", nflName: "A.Brown", team: "PHI", position: "WR" },
  { rankingName: "Tyreek Hill", nflName: "T.Hill", team: "MIA", position: "WR" },
  { rankingName: "Davante Adams", nflName: "D.Adams", team: "LV", position: "WR" },
  { rankingName: "Cooper Kupp", nflName: "C.Kupp", team: "LAR", position: "WR" },
  
  // Top TEs
  { rankingName: "Brock Bowers", nflName: "B.Bowers", team: "LV", position: "TE" },
  { rankingName: "Sam LaPorta", nflName: "S.LaPorta", team: "DET", position: "TE" },
  { rankingName: "Trey McBride", nflName: "T.McBride", team: "ARI", position: "TE" },
  { rankingName: "Travis Kelce", nflName: "T.Kelce", team: "KC", position: "TE" },
  { rankingName: "Mark Andrews", nflName: "M.Andrews", team: "BAL", position: "TE" },
  { rankingName: "George Kittle", nflName: "G.Kittle", team: "SF", position: "TE" },
  { rankingName: "Dalton Kincaid", nflName: "D.Kincaid", team: "BUF", position: "TE" },
  { rankingName: "Kyle Pitts", nflName: "K.Pitts", team: "ATL", position: "TE" },
  { rankingName: "T.J. Hockenson", nflName: "T.Hockenson", team: "MIN", position: "TE" },
  { rankingName: "Jake Ferguson", nflName: "J.Ferguson", team: "DAL", position: "TE" }
];

export class PlayerNameMappingService {
  private nameMap: Map<string, PlayerNameMap>;
  
  constructor() {
    this.nameMap = new Map();
    this.buildNameMap();
  }
  
  private buildNameMap() {
    PLAYER_NAME_MAPPINGS.forEach(mapping => {
      // Index by ranking name for quick lookup
      this.nameMap.set(mapping.rankingName.toLowerCase(), mapping);
      
      // Also index by NFL name for reverse lookup
      this.nameMap.set(mapping.nflName.toLowerCase(), mapping);
    });
  }
  
  /**
   * Get NFL database name from ranking name
   */
  getNFLName(rankingName: string): string | null {
    const mapping = this.nameMap.get(rankingName.toLowerCase());
    return mapping ? mapping.nflName : null;
  }
  
  /**
   * Get ranking name from NFL database name
   */
  getRankingName(nflName: string): string | null {
    const mapping = this.nameMap.get(nflName.toLowerCase());
    return mapping ? mapping.rankingName : null;
  }
  
  /**
   * Get complete mapping for a player
   */
  getMapping(name: string): PlayerNameMap | null {
    return this.nameMap.get(name.toLowerCase()) || null;
  }
  
  /**
   * Convert ranking name to format used in NFL database
   */
  convertToNFLFormat(rankingName: string): string {
    const mapping = this.getNFLName(rankingName);
    if (mapping) return mapping;
    
    // Fallback: convert "First Last" to "F.Last"
    const parts = rankingName.trim().split(' ');
    if (parts.length >= 2) {
      const firstName = parts[0];
      const lastName = parts[parts.length - 1];
      return `${firstName[0]}.${lastName}`;
    }
    
    return rankingName;
  }
  
  /**
   * Get all mappings for a position
   */
  getMappingsForPosition(position: string): PlayerNameMap[] {
    return PLAYER_NAME_MAPPINGS.filter(m => m.position === position);
  }
}

export const playerNameMapping = new PlayerNameMappingService();