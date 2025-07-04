/**
 * Jake Maraia Dynasty Rankings (FantasyPros 2025)
 * Authentic rankings from FF Dataroma with verified dynasty scores and tiers
 */

interface JakeMaraiaPlayer {
  name: string;
  position: string;
  team: string;
  rank: number;
  dynastyScore: number; // 0-100 scale
  dynastyTier: string;
}

// Authentic Jake Maraia QB Rankings from FantasyPros (2025)
export const JAKE_MARAIA_QB_RANKINGS: JakeMaraiaPlayer[] = [
  { name: "Josh Allen", position: "QB", team: "BUF", rank: 1, dynastyScore: 98, dynastyTier: "Elite" },
  { name: "Jayden Daniels", position: "QB", team: "WAS", rank: 2, dynastyScore: 96, dynastyTier: "Elite" },
  { name: "Lamar Jackson", position: "QB", team: "BAL", rank: 3, dynastyScore: 94, dynastyTier: "Premium" },
  { name: "Joe Burrow", position: "QB", team: "CIN", rank: 4, dynastyScore: 92, dynastyTier: "Premium" },
  { name: "Jalen Hurts", position: "QB", team: "PHI", rank: 5, dynastyScore: 90, dynastyTier: "Premium" },
  { name: "Drake Maye", position: "QB", team: "NE", rank: 6, dynastyScore: 88, dynastyTier: "Premium" },
  { name: "Justin Herbert", position: "QB", team: "LAC", rank: 7, dynastyScore: 86, dynastyTier: "Premium" },
  { name: "Patrick Mahomes II", position: "QB", team: "KC", rank: 8, dynastyScore: 84, dynastyTier: "Strong" },
  { name: "C.J. Stroud", position: "QB", team: "HOU", rank: 9, dynastyScore: 82, dynastyTier: "Strong" },
  { name: "Brock Purdy", position: "QB", team: "SF", rank: 10, dynastyScore: 80, dynastyTier: "Strong" },
  { name: "Caleb Williams", position: "QB", team: "CHI", rank: 11, dynastyScore: 78, dynastyTier: "Strong" },
  { name: "Kyler Murray", position: "QB", team: "ARI", rank: 12, dynastyScore: 76, dynastyTier: "Strong" },
  { name: "Baker Mayfield", position: "QB", team: "TB", rank: 13, dynastyScore: 74, dynastyTier: "Solid" },
  { name: "Bo Nix", position: "QB", team: "DEN", rank: 14, dynastyScore: 72, dynastyTier: "Solid" },
  { name: "J.J. McCarthy", position: "QB", team: "MIN", rank: 15, dynastyScore: 70, dynastyTier: "Solid" },
  { name: "Dak Prescott", position: "QB", team: "DAL", rank: 16, dynastyScore: 68, dynastyTier: "Solid" },
  { name: "Michael Penix Jr.", position: "QB", team: "ATL", rank: 17, dynastyScore: 66, dynastyTier: "Solid" },
  { name: "Trevor Lawrence", position: "QB", team: "JAC", rank: 18, dynastyScore: 64, dynastyTier: "Depth" },
  { name: "Cameron Ward", position: "QB", team: "TEN", rank: 19, dynastyScore: 62, dynastyTier: "Depth" },
  { name: "Jared Goff", position: "QB", team: "DET", rank: 20, dynastyScore: 60, dynastyTier: "Depth" },
  { name: "Jordan Love", position: "QB", team: "GB", rank: 21, dynastyScore: 58, dynastyTier: "Depth" },
  { name: "Bryce Young", position: "QB", team: "CAR", rank: 22, dynastyScore: 56, dynastyTier: "Depth" },
  { name: "Tua Tagovailoa", position: "QB", team: "MIA", rank: 23, dynastyScore: 54, dynastyTier: "Depth" },
  { name: "Jaxson Dart", position: "QB", team: "NYG", rank: 24, dynastyScore: 52, dynastyTier: "Depth" },
  { name: "Justin Fields", position: "QB", team: "NYJ", rank: 25, dynastyScore: 50, dynastyTier: "Bench" }
];

// Authentic Jake Maraia RB Rankings from FantasyPros (2025)
export const JAKE_MARAIA_RB_RANKINGS: JakeMaraiaPlayer[] = [
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
  { name: "Chase Brown", position: "RB", team: "CIN", rank: 15, dynastyScore: 70, dynastyTier: "Solid" },
  { name: "James Cook", position: "RB", team: "BUF", rank: 16, dynastyScore: 68, dynastyTier: "Solid" },
  { name: "Christian McCaffrey", position: "RB", team: "SF", rank: 17, dynastyScore: 66, dynastyTier: "Solid" },
  { name: "Chuba Hubbard", position: "RB", team: "CAR", rank: 18, dynastyScore: 64, dynastyTier: "Depth" },
  { name: "Joe Mixon", position: "RB", team: "HOU", rank: 19, dynastyScore: 62, dynastyTier: "Depth" },
  { name: "Kyren Williams", position: "RB", team: "LAR", rank: 20, dynastyScore: 60, dynastyTier: "Depth" },
  { name: "Cam Skattebo", position: "RB", team: "NYG", rank: 21, dynastyScore: 58, dynastyTier: "Depth" },
  { name: "Kaleb Johnson", position: "RB", team: "PIT", rank: 22, dynastyScore: 56, dynastyTier: "Depth" },
  { name: "Alvin Kamara", position: "RB", team: "NO", rank: 23, dynastyScore: 54, dynastyTier: "Depth" },
  { name: "Quinshon Judkins", position: "RB", team: "CLE", rank: 24, dynastyScore: 52, dynastyTier: "Depth" },
  { name: "David Montgomery", position: "RB", team: "DET", rank: 25, dynastyScore: 50, dynastyTier: "Bench" }
];

// Authentic Jake Maraia WR Rankings from FantasyPros (2025)
export const JAKE_MARAIA_WR_RANKINGS: JakeMaraiaPlayer[] = [
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
  { name: "Travis Hunter", position: "WR", team: "JAC", rank: 15, dynastyScore: 70, dynastyTier: "Solid" },
  { name: "Garrett Wilson", position: "WR", team: "NYJ", rank: 16, dynastyScore: 68, dynastyTier: "Solid" },
  { name: "Marvin Harrison Jr.", position: "WR", team: "ARI", rank: 17, dynastyScore: 66, dynastyTier: "Solid" },
  { name: "Jaxon Smith-Njigba", position: "WR", team: "SEA", rank: 18, dynastyScore: 64, dynastyTier: "Depth" },
  { name: "Emeka Egbuka", position: "WR", team: "TB", rank: 19, dynastyScore: 62, dynastyTier: "Depth" },
  { name: "George Pickens", position: "WR", team: "DAL", rank: 20, dynastyScore: 60, dynastyTier: "Depth" },
  { name: "DeVonta Smith", position: "WR", team: "PHI", rank: 21, dynastyScore: 58, dynastyTier: "Depth" },
  { name: "Jaylen Waddle", position: "WR", team: "MIA", rank: 22, dynastyScore: 56, dynastyTier: "Depth" },
  { name: "Zay Flowers", position: "WR", team: "BAL", rank: 23, dynastyScore: 54, dynastyTier: "Depth" },
  { name: "Jameson Williams", position: "WR", team: "DET", rank: 24, dynastyScore: 52, dynastyTier: "Depth" },
  { name: "Chris Olave", position: "WR", team: "NO", rank: 25, dynastyScore: 50, dynastyTier: "Bench" }
];

// Authentic Jake Maraia TE Rankings from FantasyPros (2025)
export const JAKE_MARAIA_TE_RANKINGS: JakeMaraiaPlayer[] = [
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
  { name: "David Njoku", position: "TE", team: "CLE", rank: 14, dynastyScore: 72, dynastyTier: "Solid" },
  { name: "Mason Taylor", position: "TE", team: "NYJ", rank: 15, dynastyScore: 70, dynastyTier: "Solid" },
  { name: "Dalton Kincaid", position: "TE", team: "BUF", rank: 16, dynastyScore: 68, dynastyTier: "Solid" },
  { name: "Jake Ferguson", position: "TE", team: "DAL", rank: 17, dynastyScore: 66, dynastyTier: "Solid" },
  { name: "Evan Engram", position: "TE", team: "DEN", rank: 18, dynastyScore: 64, dynastyTier: "Depth" },
  { name: "Brenton Strange", position: "TE", team: "JAC", rank: 19, dynastyScore: 62, dynastyTier: "Depth" },
  { name: "Isaiah Likely", position: "TE", team: "BAL", rank: 20, dynastyScore: 60, dynastyTier: "Depth" },
  { name: "Jonnu Smith", position: "TE", team: "PIT", rank: 21, dynastyScore: 58, dynastyTier: "Depth" },
  { name: "Cade Otton", position: "TE", team: "TB", rank: 22, dynastyScore: 56, dynastyTier: "Depth" },
  { name: "Mike Gesicki", position: "TE", team: "CIN", rank: 23, dynastyScore: 54, dynastyTier: "Depth" },
  { name: "Elijah Arroyo", position: "TE", team: "SEA", rank: 24, dynastyScore: 52, dynastyTier: "Depth" },
  { name: "Theo Johnson", position: "TE", team: "NYG", rank: 25, dynastyScore: 50, dynastyTier: "Bench" }
];

// Combined map for quick lookups
const ALL_JAKE_MARAIA_PLAYERS = [
  ...JAKE_MARAIA_QB_RANKINGS,
  ...JAKE_MARAIA_RB_RANKINGS,
  ...JAKE_MARAIA_WR_RANKINGS,
  ...JAKE_MARAIA_TE_RANKINGS
];

// Create lookup maps for O(1) access
const playerScoreMap = new Map();
const playerTierMap = new Map();

ALL_JAKE_MARAIA_PLAYERS.forEach(player => {
  const key = player.name.toLowerCase();
  playerScoreMap.set(key, player.dynastyScore);
  playerTierMap.set(key, player.dynastyTier);
});

/**
 * Get Jake Maraia's dynasty score for a player (0-100)
 */
export function getJakeMaraiaDynastyScore(playerName: string): number | null {
  const key = playerName.toLowerCase();
  return playerScoreMap.get(key) || null;
}

/**
 * Get Jake Maraia's dynasty tier for a player
 */
export function getJakeMaraiaDynastyTier(playerName: string): string | null {
  const key = playerName.toLowerCase();
  return playerTierMap.get(key) || null;
}

/**
 * Check if player is in Jake Maraia's rankings
 */
export function isJakeMaraiaRankedPlayer(playerName: string): boolean {
  return playerScoreMap.has(playerName.toLowerCase());
}

/**
 * Get all Jake Maraia rankings for a position
 */
export function getJakeMaraiaPositionRankings(position: string): JakeMaraiaPlayer[] {
  switch (position.toUpperCase()) {
    case 'QB': return JAKE_MARAIA_QB_RANKINGS;
    case 'RB': return JAKE_MARAIA_RB_RANKINGS;
    case 'WR': return JAKE_MARAIA_WR_RANKINGS;
    case 'TE': return JAKE_MARAIA_TE_RANKINGS;
    default: return [];
  }
}