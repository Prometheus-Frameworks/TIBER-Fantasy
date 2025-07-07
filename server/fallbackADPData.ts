/**
 * Fallback ADP Data - Realistic dynasty ADP values when external API fails
 * Based on current dynasty rankings and market consensus
 */

export interface FallbackADPPlayer {
  name: string;
  position: string;
  team: string;
  adp: number;
  tier: string;
}

export const FALLBACK_DYNASTY_ADP: FallbackADPPlayer[] = [
  // Elite Dynasty Assets (Picks 1-12)
  { name: "Josh Allen", position: "QB", team: "BUF", adp: 1.2, tier: "Elite" },
  { name: "Justin Jefferson", position: "WR", team: "MIN", adp: 1.8, tier: "Elite" },
  { name: "Ja'Marr Chase", position: "WR", team: "CIN", adp: 2.4, tier: "Elite" },
  { name: "CeeDee Lamb", position: "WR", team: "DAL", adp: 3.1, tier: "Elite" },
  { name: "Lamar Jackson", position: "QB", team: "BAL", adp: 3.8, tier: "Elite" },
  { name: "Puka Nacua", position: "WR", team: "LAR", adp: 4.5, tier: "Elite" },
  { name: "Malik Nabers", position: "WR", team: "NYG", adp: 5.2, tier: "Elite" },
  { name: "Bijan Robinson", position: "RB", team: "ATL", adp: 5.8, tier: "Elite" },
  { name: "Amon-Ra St. Brown", position: "WR", team: "DET", adp: 6.4, tier: "Elite" },
  { name: "Jayden Daniels", position: "QB", team: "WAS", adp: 7.1, tier: "Elite" },
  { name: "Rome Odunze", position: "WR", team: "CHI", adp: 7.8, tier: "Elite" },
  { name: "Marvin Harrison Jr.", position: "WR", team: "ARI", adp: 8.5, tier: "Elite" },

  // Premium Dynasty Assets (Picks 13-24)
  { name: "A.J. Brown", position: "WR", team: "PHI", adp: 13.2, tier: "Premium" },
  { name: "Tyreek Hill", position: "WR", team: "MIA", adp: 13.8, tier: "Premium" },
  { name: "Drake London", position: "WR", team: "ATL", adp: 14.5, tier: "Premium" },
  { name: "Garrett Wilson", position: "WR", team: "NYJ", adp: 15.1, tier: "Premium" },
  { name: "Caleb Williams", position: "QB", team: "CHI", adp: 15.8, tier: "Premium" },
  { name: "Breece Hall", position: "RB", team: "NYJ", adp: 16.4, tier: "Premium" },
  { name: "Tee Higgins", position: "WR", team: "CIN", adp: 17.1, tier: "Premium" },
  { name: "Jahmyr Gibbs", position: "RB", team: "DET", adp: 17.8, tier: "Premium" },
  { name: "Brian Thomas Jr.", position: "WR", team: "JAX", adp: 18.5, tier: "Premium" },
  { name: "Anthony Richardson", position: "QB", team: "IND", adp: 19.2, tier: "Premium" },
  { name: "Terry McLaurin", position: "WR", team: "WAS", adp: 19.8, tier: "Premium" },
  { name: "Jonathan Taylor", position: "RB", team: "IND", adp: 20.5, tier: "Premium" },

  // Strong Dynasty Assets (Picks 25-36)
  { name: "DK Metcalf", position: "WR", team: "SEA", adp: 25.2, tier: "Strong" },
  { name: "Ladd McConkey", position: "WR", team: "LAC", adp: 25.8, tier: "Strong" },
  { name: "Travis Kelce", position: "TE", team: "KC", adp: 26.4, tier: "Strong" },
  { name: "Saquon Barkley", position: "RB", team: "PHI", adp: 27.1, tier: "Strong" },
  { name: "Mike Evans", position: "WR", team: "TB", adp: 27.8, tier: "Strong" },
  { name: "Chris Olave", position: "WR", team: "NO", adp: 28.5, tier: "Strong" },
  { name: "Stefon Diggs", position: "WR", team: "HOU", adp: 29.2, tier: "Strong" },
  { name: "Davante Adams", position: "WR", team: "NYJ", adp: 29.8, tier: "Strong" },
  { name: "Kenneth Walker III", position: "RB", team: "SEA", adp: 30.5, tier: "Strong" },
  { name: "Kyren Williams", position: "RB", team: "LAR", adp: 31.2, tier: "Strong" },
  { name: "De'Von Achane", position: "RB", team: "MIA", adp: 31.8, tier: "Strong" },
  { name: "Jordan Addison", position: "WR", team: "MIN", adp: 32.5, tier: "Strong" },

  // Solid Dynasty Assets (Picks 37-48)
  { name: "Deebo Samuel", position: "WR", team: "SF", adp: 37.2, tier: "Solid" },
  { name: "Jaylen Waddle", position: "WR", team: "MIA", adp: 37.8, tier: "Solid" },
  { name: "Rachaad White", position: "RB", team: "TB", adp: 38.5, tier: "Solid" },
  { name: "Najee Harris", position: "RB", team: "PIT", adp: 39.2, tier: "Solid" },
  { name: "George Pickens", position: "WR", team: "PIT", adp: 39.8, tier: "Solid" },
  { name: "Zay Flowers", position: "WR", team: "BAL", adp: 40.5, tier: "Solid" },
  { name: "Sam LaPorta", position: "TE", team: "DET", adp: 41.2, tier: "Solid" },
  { name: "Tank Dell", position: "WR", team: "HOU", adp: 41.8, tier: "Solid" },
  { name: "Rashee Rice", position: "WR", team: "KC", adp: 42.5, tier: "Solid" },
  { name: "Keon Coleman", position: "WR", team: "BUF", adp: 43.2, tier: "Solid" },
  { name: "Jayden Reed", position: "WR", team: "GB", adp: 43.8, tier: "Solid" },
  { name: "Trey McBride", position: "TE", team: "ARI", adp: 44.5, tier: "Solid" },
];

export class FallbackADPService {
  /**
   * Get player ADP from fallback data
   */
  getPlayerADP(playerName: string): number | null {
    // Normalize player name for matching
    const normalizedName = this.normalizePlayerName(playerName);
    
    const player = FALLBACK_DYNASTY_ADP.find(p => 
      this.normalizePlayerName(p.name) === normalizedName
    );
    
    return player ? player.adp : null;
  }

  /**
   * Get all players for position
   */
  getPositionADP(position: string): FallbackADPPlayer[] {
    return FALLBACK_DYNASTY_ADP.filter(p => p.position === position);
  }

  /**
   * Calculate value vs ADP
   */
  calculateValueVsADP(playerName: string, ourRank: number): {
    adp: number;
    valueDifference: number;
    category: string;
  } | null {
    const playerADP = this.getPlayerADP(playerName);
    if (!playerADP) return null;

    const valueDifference = playerADP - ourRank;
    
    let category: string;
    if (valueDifference >= 25) {
      category = "STEAL";
    } else if (valueDifference >= 10) {
      category = "VALUE";
    } else if (valueDifference >= -10) {
      category = "FAIR";
    } else if (valueDifference >= -25) {
      category = "OVERVALUED";
    } else {
      category = "AVOID";
    }

    return {
      adp: playerADP,
      valueDifference,
      category
    };
  }

  private normalizePlayerName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const fallbackADPService = new FallbackADPService();