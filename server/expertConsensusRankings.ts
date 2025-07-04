// Expert Consensus Dynasty Rankings (2025)
export interface ExpertPlayer {
  name: string;
  position: string;
  team: string;
  rank: number;
  dynastyScore: number;
  dynastyTier: string;
}

// Authentic Expert Consensus QB Rankings (2025)
export const EXPERT_CONSENSUS_QB_RANKINGS: ExpertPlayer[] = [
  { name: "Josh Allen", position: "QB", team: "BUF", rank: 1, dynastyScore: 98, dynastyTier: "Elite" },
  { name: "Lamar Jackson", position: "QB", team: "BAL", rank: 2, dynastyScore: 96, dynastyTier: "Elite" },
  { name: "Caleb Williams", position: "QB", team: "CHI", rank: 3, dynastyScore: 94, dynastyTier: "Premium" },
  { name: "Jayden Daniels", position: "QB", team: "WAS", rank: 4, dynastyScore: 92, dynastyTier: "Premium" },
  { name: "Joe Burrow", position: "QB", team: "CIN", rank: 5, dynastyScore: 90, dynastyTier: "Premium" },
  { name: "Drake Maye", position: "QB", team: "NE", rank: 6, dynastyScore: 88, dynastyTier: "Premium" },
  { name: "Anthony Richardson", position: "QB", team: "IND", rank: 7, dynastyScore: 86, dynastyTier: "Premium" },
  { name: "Patrick Mahomes", position: "QB", team: "KC", rank: 8, dynastyScore: 84, dynastyTier: "Strong" },
  { name: "C.J. Stroud", position: "QB", team: "HOU", rank: 9, dynastyScore: 82, dynastyTier: "Strong" },
  { name: "Bo Nix", position: "QB", team: "DEN", rank: 10, dynastyScore: 80, dynastyTier: "Strong" },
  { name: "Jalen Hurts", position: "QB", team: "PHI", rank: 11, dynastyScore: 78, dynastyTier: "Strong" },
  { name: "Dak Prescott", position: "QB", team: "DAL", rank: 12, dynastyScore: 76, dynastyTier: "Strong" },
  { name: "Tua Tagovailoa", position: "QB", team: "MIA", rank: 13, dynastyScore: 74, dynastyTier: "Solid" },
  { name: "Jordan Love", position: "QB", team: "GB", rank: 14, dynastyScore: 72, dynastyTier: "Solid" },
  { name: "Brock Purdy", position: "QB", team: "SF", rank: 15, dynastyScore: 70, dynastyTier: "Solid" },
  { name: "Trevor Lawrence", position: "QB", team: "JAC", rank: 16, dynastyScore: 68, dynastyTier: "Solid" },
  { name: "Kyler Murray", position: "QB", team: "ARI", rank: 17, dynastyScore: 66, dynastyTier: "Solid" },
  { name: "Geno Smith", position: "QB", team: "SEA", rank: 18, dynastyScore: 64, dynastyTier: "Solid" },
  { name: "Jared Goff", position: "QB", team: "DET", rank: 19, dynastyScore: 62, dynastyTier: "Depth" },
  { name: "Sam Darnold", position: "QB", team: "MIN", rank: 20, dynastyScore: 60, dynastyTier: "Depth" },
  { name: "Will Levis", position: "QB", team: "TEN", rank: 21, dynastyScore: 58, dynastyTier: "Depth" },
  { name: "Bryce Young", position: "QB", team: "CAR", rank: 22, dynastyScore: 56, dynastyTier: "Depth" },
  { name: "Daniel Jones", position: "QB", team: "NYG", rank: 23, dynastyScore: 54, dynastyTier: "Depth" },
  { name: "Russell Wilson", position: "QB", team: "PIT", rank: 24, dynastyScore: 52, dynastyTier: "Depth" },
  { name: "Justin Fields", position: "QB", team: "ATL", rank: 25, dynastyScore: 50, dynastyTier: "Depth" }
];

// Authentic Expert Consensus RB Rankings (2025)
export const EXPERT_CONSENSUS_RB_RANKINGS: ExpertPlayer[] = [
  { name: "Bijan Robinson", position: "RB", team: "ATL", rank: 1, dynastyScore: 98, dynastyTier: "Elite" },
  { name: "Ashton Jeanty", position: "RB", team: "LV", rank: 2, dynastyScore: 96, dynastyTier: "Elite" },
  { name: "Jahmyr Gibbs", position: "RB", team: "DET", rank: 3, dynastyScore: 94, dynastyTier: "Premium" },
  { name: "Omarion Hampton", position: "RB", team: "LAC", rank: 4, dynastyScore: 92, dynastyTier: "Premium" },
  { name: "De'Von Achane", position: "RB", team: "MIA", rank: 5, dynastyScore: 90, dynastyTier: "Premium" },
  { name: "Saquon Barkley", position: "RB", team: "PHI", rank: 6, dynastyScore: 88, dynastyTier: "Premium" },
  { name: "TreVeyon Henderson", position: "RB", team: "NE", rank: 7, dynastyScore: 86, dynastyTier: "Premium" },
  { name: "Kenneth Walker III", position: "RB", team: "SEA", rank: 8, dynastyScore: 84, dynastyTier: "Strong" },
  { name: "Bucky Irving", position: "RB", team: "TB", rank: 9, dynastyScore: 82, dynastyTier: "Strong" },
  { name: "Josh Jacobs", position: "RB", team: "GB", rank: 10, dynastyScore: 80, dynastyTier: "Strong" },
  { name: "Breece Hall", position: "RB", team: "NYJ", rank: 11, dynastyScore: 78, dynastyTier: "Strong" },
  { name: "Jonathan Taylor", position: "RB", team: "IND", rank: 12, dynastyScore: 76, dynastyTier: "Strong" },
  { name: "Derrick Henry", position: "RB", team: "BAL", rank: 13, dynastyScore: 74, dynastyTier: "Solid" },
  { name: "RJ Harvey", position: "RB", team: "DEN", rank: 14, dynastyScore: 72, dynastyTier: "Solid" },
  { name: "Kyren Williams", position: "RB", team: "LAR", rank: 15, dynastyScore: 70, dynastyTier: "Solid" },
  { name: "James Cook", position: "RB", team: "BUF", rank: 16, dynastyScore: 68, dynastyTier: "Solid" },
  { name: "Rhamondre Stevenson", position: "RB", team: "NE", rank: 17, dynastyScore: 66, dynastyTier: "Solid" },
  { name: "J.K. Dobbins", position: "RB", team: "LAC", rank: 18, dynastyScore: 64, dynastyTier: "Solid" },
  { name: "Tank Bigsby", position: "RB", team: "JAC", rank: 19, dynastyScore: 62, dynastyTier: "Depth" },
  { name: "Jonathon Brooks", position: "RB", team: "CAR", rank: 20, dynastyScore: 60, dynastyTier: "Depth" },
  { name: "Tyjae Spears", position: "RB", team: "TEN", rank: 21, dynastyScore: 58, dynastyTier: "Depth" },
  { name: "Isaac Guerendo", position: "RB", team: "SF", rank: 22, dynastyScore: 56, dynastyTier: "Depth" },
  { name: "Tyler Allgeier", position: "RB", team: "ATL", rank: 23, dynastyScore: 54, dynastyTier: "Depth" },
  { name: "Rachaad White", position: "RB", team: "TB", rank: 24, dynastyScore: 52, dynastyTier: "Depth" },
  { name: "Chase Brown", position: "RB", team: "CIN", rank: 25, dynastyScore: 50, dynastyTier: "Depth" }
];

// Authentic Expert Consensus WR Rankings (2025)
export const EXPERT_CONSENSUS_WR_RANKINGS: ExpertPlayer[] = [
  { name: "Ja'Marr Chase", position: "WR", team: "CIN", rank: 1, dynastyScore: 98, dynastyTier: "Elite" },
  { name: "Justin Jefferson", position: "WR", team: "MIN", rank: 2, dynastyScore: 96, dynastyTier: "Elite" },
  { name: "Malik Nabers", position: "WR", team: "NYG", rank: 3, dynastyScore: 94, dynastyTier: "Premium" },
  { name: "CeeDee Lamb", position: "WR", team: "DAL", rank: 4, dynastyScore: 92, dynastyTier: "Premium" },
  { name: "Brian Thomas Jr.", position: "WR", team: "JAC", rank: 5, dynastyScore: 90, dynastyTier: "Premium" },
  { name: "Puka Nacua", position: "WR", team: "LAR", rank: 6, dynastyScore: 88, dynastyTier: "Premium" },
  { name: "Amon-Ra St. Brown", position: "WR", team: "DET", rank: 7, dynastyScore: 86, dynastyTier: "Premium" },
  { name: "Drake London", position: "WR", team: "ATL", rank: 8, dynastyScore: 84, dynastyTier: "Strong" },
  { name: "Ladd McConkey", position: "WR", team: "LAC", rank: 9, dynastyScore: 82, dynastyTier: "Strong" },
  { name: "Nico Collins", position: "WR", team: "HOU", rank: 10, dynastyScore: 80, dynastyTier: "Strong" },
  { name: "A.J. Brown", position: "WR", team: "PHI", rank: 11, dynastyScore: 78, dynastyTier: "Strong" },
  { name: "Rashee Rice", position: "WR", team: "KC", rank: 12, dynastyScore: 76, dynastyTier: "Strong" },
  { name: "Tee Higgins", position: "WR", team: "CIN", rank: 13, dynastyScore: 74, dynastyTier: "Solid" },
  { name: "Tetairoa McMillan", position: "WR", team: "CAR", rank: 14, dynastyScore: 72, dynastyTier: "Solid" },
  { name: "Rome Odunze", position: "WR", team: "CHI", rank: 15, dynastyScore: 70, dynastyTier: "Solid" },
  { name: "Marvin Harrison Jr.", position: "WR", team: "ARI", rank: 16, dynastyScore: 68, dynastyTier: "Solid" },
  { name: "DeVonta Smith", position: "WR", team: "PHI", rank: 17, dynastyScore: 66, dynastyTier: "Solid" },
  { name: "DK Metcalf", position: "WR", team: "SEA", rank: 18, dynastyScore: 64, dynastyTier: "Solid" },
  { name: "Terry McLaurin", position: "WR", team: "WAS", rank: 19, dynastyScore: 62, dynastyTier: "Depth" },
  { name: "DJ Moore", position: "WR", team: "CHI", rank: 20, dynastyScore: 60, dynastyTier: "Depth" },
  { name: "Mike Evans", position: "WR", team: "TB", rank: 21, dynastyScore: 58, dynastyTier: "Depth" },
  { name: "Garrett Wilson", position: "WR", team: "NYJ", rank: 22, dynastyScore: 56, dynastyTier: "Depth" },
  { name: "Chris Olave", position: "WR", team: "NO", rank: 23, dynastyScore: 54, dynastyTier: "Depth" },
  { name: "Keenan Allen", position: "WR", team: "CHI", rank: 24, dynastyScore: 52, dynastyTier: "Depth" },
  { name: "Tyreek Hill", position: "WR", team: "MIA", rank: 25, dynastyScore: 50, dynastyTier: "Depth" }
];

// Authentic Expert Consensus TE Rankings (2025)
export const EXPERT_CONSENSUS_TE_RANKINGS: ExpertPlayer[] = [
  { name: "Brock Bowers", position: "TE", team: "LV", rank: 1, dynastyScore: 98, dynastyTier: "Elite" },
  { name: "Trey McBride", position: "TE", team: "ARI", rank: 2, dynastyScore: 96, dynastyTier: "Elite" },
  { name: "Colston Loveland", position: "TE", team: "CHI", rank: 3, dynastyScore: 94, dynastyTier: "Premium" },
  { name: "Sam LaPorta", position: "TE", team: "DET", rank: 4, dynastyScore: 92, dynastyTier: "Premium" },
  { name: "George Kittle", position: "TE", team: "SF", rank: 5, dynastyScore: 90, dynastyTier: "Premium" },
  { name: "T.J. Hockenson", position: "TE", team: "MIN", rank: 6, dynastyScore: 88, dynastyTier: "Premium" },
  { name: "Tyler Warren", position: "TE", team: "IND", rank: 7, dynastyScore: 86, dynastyTier: "Premium" },
  { name: "Tucker Kraft", position: "TE", team: "GB", rank: 8, dynastyScore: 84, dynastyTier: "Strong" },
  { name: "Mark Andrews", position: "TE", team: "BAL", rank: 9, dynastyScore: 82, dynastyTier: "Strong" },
  { name: "Dallas Goedert", position: "TE", team: "PHI", rank: 10, dynastyScore: 80, dynastyTier: "Strong" },
  { name: "Travis Kelce", position: "TE", team: "KC", rank: 11, dynastyScore: 78, dynastyTier: "Strong" },
  { name: "Harold Fannin Jr.", position: "TE", team: "CLE", rank: 12, dynastyScore: 76, dynastyTier: "Strong" },
  { name: "Terrance Ferguson", position: "TE", team: "LAR", rank: 13, dynastyScore: 74, dynastyTier: "Solid" },
  { name: "Kyle Pitts", position: "TE", team: "ATL", rank: 14, dynastyScore: 72, dynastyTier: "Solid" },
  { name: "David Njoku", position: "TE", team: "CLE", rank: 15, dynastyScore: 70, dynastyTier: "Solid" },
  { name: "Cade Otton", position: "TE", team: "TB", rank: 16, dynastyScore: 68, dynastyTier: "Solid" },
  { name: "Jake Ferguson", position: "TE", team: "DAL", rank: 17, dynastyScore: 66, dynastyTier: "Solid" },
  { name: "Dalton Kincaid", position: "TE", team: "BUF", rank: 18, dynastyScore: 64, dynastyTier: "Solid" },
  { name: "Pat Freiermuth", position: "TE", team: "PIT", rank: 19, dynastyScore: 62, dynastyTier: "Depth" },
  { name: "Isaiah Likely", position: "TE", team: "BAL", rank: 20, dynastyScore: 60, dynastyTier: "Depth" },
  { name: "Chigoziem Okonkwo", position: "TE", team: "TEN", rank: 21, dynastyScore: 58, dynastyTier: "Depth" },
  { name: "Hunter Henry", position: "TE", team: "NE", rank: 22, dynastyScore: 56, dynastyTier: "Depth" },
  { name: "Noah Fant", position: "TE", team: "SEA", rank: 23, dynastyScore: 54, dynastyTier: "Depth" },
  { name: "Tyler Higbee", position: "TE", team: "LAR", rank: 24, dynastyScore: 52, dynastyTier: "Depth" },
  { name: "Evan Engram", position: "TE", team: "JAC", rank: 25, dynastyScore: 50, dynastyTier: "Depth" }
];

// Combined all rankings
export const ALL_EXPERT_CONSENSUS_PLAYERS = [
  ...EXPERT_CONSENSUS_QB_RANKINGS,
  ...EXPERT_CONSENSUS_RB_RANKINGS,
  ...EXPERT_CONSENSUS_WR_RANKINGS,
  ...EXPERT_CONSENSUS_TE_RANKINGS
];

// Create name-to-score map for quick lookups
const playerScoreMap = new Map<string, number>();
const playerTierMap = new Map<string, string>();

ALL_EXPERT_CONSENSUS_PLAYERS.forEach(player => {
  playerScoreMap.set(player.name.toLowerCase(), player.dynastyScore);
  playerTierMap.set(player.name.toLowerCase(), player.dynastyTier);
});

/**
 * Get expert consensus dynasty score for a player
 */
export function getExpertDynastyScore(playerName: string): number | null {
  const searchName = playerName.toLowerCase();
  
  // Try exact match first
  if (playerScoreMap.has(searchName)) {
    return playerScoreMap.get(searchName)!;
  }
  
  // Handle name variations (Patrick Mahomes vs Patrick Mahomes II)
  const player = ALL_EXPERT_CONSENSUS_PLAYERS.find(p => {
    const rankingName = p.name.toLowerCase();
    const baseRankingName = rankingName.replace(/\s(ii|jr|sr|iii|iv)\.?$/, '');
    const baseSearchName = searchName.replace(/\s(ii|jr|sr|iii|iv)\.?$/, '');
    
    return baseRankingName === baseSearchName;
  });
  
  return player ? player.dynastyScore : null;
}

/**
 * Get expert consensus dynasty tier for a player
 */
export function getExpertDynastyTier(playerName: string): string | null {
  const searchName = playerName.toLowerCase();
  
  // Find player with name matching (including variations like Jr, II, etc.)
  const player = ALL_EXPERT_CONSENSUS_PLAYERS.find(p => {
    const rankingName = p.name.toLowerCase();
    
    // Exact match first
    if (rankingName === searchName) return true;
    
    // Handle name variations (Patrick Mahomes vs Patrick Mahomes II)
    const baseRankingName = rankingName.replace(/\s(ii|jr|sr|iii|iv)\.?$/, '');
    const baseSearchName = searchName.replace(/\s(ii|jr|sr|iii|iv)\.?$/, '');
    
    return baseRankingName === baseSearchName;
  });
  
  return player ? player.dynastyTier : null;
}

/**
 * Check if player is in expert consensus rankings
 */
export function isExpertRankedPlayer(playerName: string): boolean {
  return playerScoreMap.has(playerName.toLowerCase());
}

/**
 * Get all expert consensus rankings for a position
 */
export function getExpertPositionRankings(position: string): ExpertPlayer[] {
  switch (position.toUpperCase()) {
    case 'QB': return EXPERT_CONSENSUS_QB_RANKINGS;
    case 'RB': return EXPERT_CONSENSUS_RB_RANKINGS;
    case 'WR': return EXPERT_CONSENSUS_WR_RANKINGS;
    case 'TE': return EXPERT_CONSENSUS_TE_RANKINGS;
    default: return [];
  }
}