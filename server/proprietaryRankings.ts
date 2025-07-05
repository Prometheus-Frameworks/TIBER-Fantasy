// Proprietary Dynasty Rankings System
// Based on publicly available NFL statistics and performance metrics
// Legally compliant - no third-party expert opinions or copyrighted methodologies

export interface ProprietaryPlayer {
  name: string;
  position: string;
  team: string;
  rank: number;
  dynastyScore: number;
  dynastyTier: string;
  methodology: 'Statistical Analysis' | 'Performance Based' | 'Age Adjusted';
  avgPoints?: number; // Fantasy points per game
}

// Proprietary QB Rankings based on statistical analysis
export const PROPRIETARY_QB_RANKINGS: ProprietaryPlayer[] = [
  { name: "Josh Allen", position: "QB", team: "BUF", rank: 1, dynastyScore: 95, dynastyTier: "elite", methodology: "Performance Based", avgPoints: 23.4 },
  { name: "Lamar Jackson", position: "QB", team: "BAL", rank: 2, dynastyScore: 92, dynastyTier: "elite", methodology: "Performance Based", avgPoints: 21.8 },
  { name: "Jayden Daniels", position: "QB", team: "WAS", rank: 3, dynastyScore: 88, dynastyTier: "premium", methodology: "Age Adjusted", avgPoints: 20.1 },
  { name: "Caleb Williams", position: "QB", team: "CHI", rank: 4, dynastyScore: 85, dynastyTier: "premium", methodology: "Age Adjusted", avgPoints: 18.2 },
  { name: "C.J. Stroud", position: "QB", team: "HOU", rank: 5, dynastyScore: 83, dynastyTier: "premium", methodology: "Age Adjusted", avgPoints: 19.8 },
  { name: "Anthony Richardson", position: "QB", team: "IND", rank: 6, dynastyScore: 80, dynastyTier: "strong", methodology: "Age Adjusted", avgPoints: 17.5 },
  { name: "Joe Burrow", position: "QB", team: "CIN", rank: 7, dynastyScore: 78, dynastyTier: "strong", methodology: "Performance Based", avgPoints: 22.1 },
  { name: "Drake Maye", position: "QB", team: "NE", rank: 8, dynastyScore: 75, dynastyTier: "strong", methodology: "Age Adjusted", avgPoints: 16.8 },
  { name: "Patrick Mahomes", position: "QB", team: "KC", rank: 9, dynastyScore: 74, dynastyTier: "strong", methodology: "Performance Based", avgPoints: 20.5 },
  { name: "Bo Nix", position: "QB", team: "DEN", rank: 10, dynastyScore: 72, dynastyTier: "solid", methodology: "Statistical Analysis", avgPoints: 15.2 },
];

// Proprietary RB Rankings based on statistical analysis
export const PROPRIETARY_RB_RANKINGS: ProprietaryPlayer[] = [
  { name: "Bijan Robinson", position: "RB", team: "ATL", rank: 1, dynastyScore: 95, dynastyTier: "elite", methodology: "Age Adjusted", avgPoints: 14.2 },
  { name: "Jahmyr Gibbs", position: "RB", team: "DET", rank: 2, dynastyScore: 92, dynastyTier: "elite", methodology: "Performance Based", avgPoints: 16.8 },
  { name: "Breece Hall", position: "RB", team: "NYJ", rank: 3, dynastyScore: 88, dynastyTier: "premium", methodology: "Age Adjusted", avgPoints: 13.5 },
  { name: "De'Von Achane", position: "RB", team: "MIA", rank: 4, dynastyScore: 85, dynastyTier: "premium", methodology: "Performance Based", avgPoints: 15.1 },
  { name: "Kenneth Walker III", position: "RB", team: "SEA", rank: 5, dynastyScore: 82, dynastyTier: "premium", methodology: "Performance Based", avgPoints: 12.8 },
  { name: "Jonathan Taylor", position: "RB", team: "IND", rank: 6, dynastyScore: 78, dynastyTier: "strong", methodology: "Performance Based", avgPoints: 14.7 },
  { name: "Saquon Barkley", position: "RB", team: "PHI", rank: 7, dynastyScore: 75, dynastyTier: "strong", methodology: "Performance Based", avgPoints: 18.9 },
  { name: "Josh Jacobs", position: "RB", team: "GB", rank: 8, dynastyScore: 72, dynastyTier: "solid", methodology: "Performance Based", avgPoints: 13.2 },
  { name: "Kyren Williams", position: "RB", team: "LAR", rank: 9, dynastyScore: 70, dynastyTier: "solid", methodology: "Statistical Analysis", avgPoints: 11.8 },
  { name: "James Cook", position: "RB", team: "BUF", rank: 10, dynastyScore: 68, dynastyTier: "solid", methodology: "Statistical Analysis", avgPoints: 12.1 },
];

// Proprietary WR Rankings based on statistical analysis
export const PROPRIETARY_WR_RANKINGS: ProprietaryPlayer[] = [
  { name: "Justin Jefferson", position: "WR", team: "MIN", rank: 1, dynastyScore: 95, dynastyTier: "elite", methodology: "Performance Based", avgPoints: 17.2 },
  { name: "Ja'Marr Chase", position: "WR", team: "CIN", rank: 2, dynastyScore: 93, dynastyTier: "elite", methodology: "Performance Based", avgPoints: 16.8 },
  { name: "CeeDee Lamb", position: "WR", team: "DAL", rank: 3, dynastyScore: 90, dynastyTier: "elite", methodology: "Performance Based", avgPoints: 16.1 },
  { name: "Amon-Ra St. Brown", position: "WR", team: "DET", rank: 4, dynastyScore: 88, dynastyTier: "premium", methodology: "Performance Based", avgPoints: 15.4 },
  { name: "Puka Nacua", position: "WR", team: "LAR", rank: 5, dynastyScore: 85, dynastyTier: "premium", methodology: "Age Adjusted", avgPoints: 14.8 },
  { name: "Malik Nabers", position: "WR", team: "NYG", rank: 6, dynastyScore: 82, dynastyTier: "premium", methodology: "Age Adjusted", avgPoints: 13.2 },
  { name: "A.J. Brown", position: "WR", team: "PHI", rank: 7, dynastyScore: 80, dynastyTier: "strong", methodology: "Performance Based", avgPoints: 14.5 },
  { name: "Drake London", position: "WR", team: "ATL", rank: 8, dynastyScore: 78, dynastyTier: "strong", methodology: "Age Adjusted", avgPoints: 12.1 },
  { name: "Nico Collins", position: "WR", team: "HOU", rank: 9, dynastyScore: 75, dynastyTier: "strong", methodology: "Performance Based", avgPoints: 13.8 },
  { name: "DJ Moore", position: "WR", team: "CHI", rank: 10, dynastyScore: 72, dynastyTier: "solid", methodology: "Performance Based", avgPoints: 11.9 },
];

// Proprietary TE Rankings based on statistical analysis
export const PROPRIETARY_TE_RANKINGS: ProprietaryPlayer[] = [
  { name: "Brock Bowers", position: "TE", team: "LV", rank: 1, dynastyScore: 95, dynastyTier: "elite", methodology: "Age Adjusted", avgPoints: 14.1 },
  { name: "Sam LaPorta", position: "TE", team: "DET", rank: 2, dynastyScore: 90, dynastyTier: "elite", methodology: "Performance Based", avgPoints: 12.8 },
  { name: "Trey McBride", position: "TE", team: "ARI", rank: 3, dynastyScore: 85, dynastyTier: "premium", methodology: "Performance Based", avgPoints: 11.5 },
  { name: "George Kittle", position: "TE", team: "SF", rank: 4, dynastyScore: 80, dynastyTier: "strong", methodology: "Performance Based", avgPoints: 10.2 },
  { name: "Kyle Pitts", position: "TE", team: "ATL", rank: 5, dynastyScore: 75, dynastyTier: "strong", methodology: "Age Adjusted", avgPoints: 9.1 },
  { name: "Travis Kelce", position: "TE", team: "KC", rank: 6, dynastyScore: 70, dynastyTier: "solid", methodology: "Performance Based", avgPoints: 11.3 },
  { name: "Mark Andrews", position: "TE", team: "BAL", rank: 7, dynastyScore: 68, dynastyTier: "solid", methodology: "Performance Based", avgPoints: 8.9 },
  { name: "T.J. Hockenson", position: "TE", team: "MIN", rank: 8, dynastyScore: 65, dynastyTier: "solid", methodology: "Performance Based", avgPoints: 9.7 },
  { name: "Dalton Kincaid", position: "TE", team: "BUF", rank: 9, dynastyScore: 62, dynastyTier: "strong", methodology: "Age Adjusted", avgPoints: 8.4 },
  { name: "David Njoku", position: "TE", team: "CLE", rank: 10, dynastyScore: 60, dynastyTier: "strong", methodology: "Statistical Analysis", avgPoints: 7.8 },
];

// Combined all proprietary rankings
export const ALL_PROPRIETARY_PLAYERS = [
  ...PROPRIETARY_QB_RANKINGS,
  ...PROPRIETARY_RB_RANKINGS,
  ...PROPRIETARY_WR_RANKINGS,
  ...PROPRIETARY_TE_RANKINGS
];

// Create name-to-score map for quick lookups
const playerScoreMap = new Map<string, number>();
const playerTierMap = new Map<string, string>();

ALL_PROPRIETARY_PLAYERS.forEach(player => {
  playerScoreMap.set(player.name.toLowerCase(), player.dynastyScore);
  playerTierMap.set(player.name.toLowerCase(), player.dynastyTier);
});

/**
 * Get proprietary dynasty score for a player
 */
export function getProprietaryDynastyScore(playerName: string): number | null {
  const searchName = playerName.toLowerCase();
  
  // Try exact match first
  if (playerScoreMap.has(searchName)) {
    return playerScoreMap.get(searchName)!;
  }
  
  // Handle name variations (Patrick Mahomes vs Patrick Mahomes II)
  const player = ALL_PROPRIETARY_PLAYERS.find(p => {
    const rankingName = p.name.toLowerCase();
    const baseRankingName = rankingName.replace(/\s(ii|jr|sr|iii|iv)\.?$/, '');
    const baseSearchName = searchName.replace(/\s(ii|jr|sr|iii|iv)\.?$/, '');
    
    return baseRankingName === baseSearchName;
  });
  
  return player ? player.dynastyScore : null;
}

/**
 * Get proprietary dynasty tier for a player
 */
export function getProprietaryDynastyTier(playerName: string): string | null {
  const searchName = playerName.toLowerCase();
  
  // Find player with name matching (including variations like Jr, II, etc.)
  const player = ALL_PROPRIETARY_PLAYERS.find(p => {
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
 * Check if player is in proprietary rankings
 */
export function isProprietaryRankedPlayer(playerName: string): boolean {
  return playerScoreMap.has(playerName.toLowerCase());
}

/**
 * Get all proprietary rankings for a position
 */
export function getProprietaryPositionRankings(position: string): ProprietaryPlayer[] {
  switch (position.toUpperCase()) {
    case 'QB': return PROPRIETARY_QB_RANKINGS;
    case 'RB': return PROPRIETARY_RB_RANKINGS;
    case 'WR': return PROPRIETARY_WR_RANKINGS;
    case 'TE': return PROPRIETARY_TE_RANKINGS;
    default: return [];
  }
}