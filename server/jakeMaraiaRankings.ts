/**
 * Jake Maraia's Official FantasyPros Dynasty Rankings (January 2025)
 * Server-side implementation for database operations
 */

export interface JakeMaraiaRanking {
  rank: number;
  name: string;
  team: string;
  position: string;
  dynastyScore: number;
  tier: string;
}

// Complete Jake Maraia Rankings (Top 25 per position)
export const JAKE_MARAIA_RANKINGS: JakeMaraiaRanking[] = [
  // QB Rankings
  { rank: 1, name: 'Josh Allen', team: 'BUF', position: 'QB', dynastyScore: 100, tier: 'Elite' },
  { rank: 2, name: 'Jayden Daniels', team: 'WAS', position: 'QB', dynastyScore: 98, tier: 'Elite' },
  { rank: 3, name: 'Lamar Jackson', team: 'BAL', position: 'QB', dynastyScore: 96, tier: 'Elite' },
  { rank: 4, name: 'Joe Burrow', team: 'CIN', position: 'QB', dynastyScore: 94, tier: 'Premium' },
  { rank: 5, name: 'Jalen Hurts', team: 'PHI', position: 'QB', dynastyScore: 92, tier: 'Premium' },
  { rank: 6, name: 'Drake Maye', team: 'NE', position: 'QB', dynastyScore: 90, tier: 'Premium' },
  { rank: 7, name: 'Justin Herbert', team: 'LAC', position: 'QB', dynastyScore: 88, tier: 'Premium' },
  { rank: 8, name: 'Patrick Mahomes II', team: 'KC', position: 'QB', dynastyScore: 86, tier: 'Premium' },
  { rank: 9, name: 'C.J. Stroud', team: 'HOU', position: 'QB', dynastyScore: 84, tier: 'Strong' },
  { rank: 10, name: 'Brock Purdy', team: 'SF', position: 'QB', dynastyScore: 82, tier: 'Strong' },
  { rank: 11, name: 'Caleb Williams', team: 'CHI', position: 'QB', dynastyScore: 80, tier: 'Strong' },
  { rank: 12, name: 'Kyler Murray', team: 'ARI', position: 'QB', dynastyScore: 78, tier: 'Strong' },
  { rank: 13, name: 'Baker Mayfield', team: 'TB', position: 'QB', dynastyScore: 76, tier: 'Strong' },
  { rank: 14, name: 'Bo Nix', team: 'DEN', position: 'QB', dynastyScore: 74, tier: 'Solid' },
  { rank: 15, name: 'J.J. McCarthy', team: 'MIN', position: 'QB', dynastyScore: 72, tier: 'Solid' },
  { rank: 16, name: 'Dak Prescott', team: 'DAL', position: 'QB', dynastyScore: 70, tier: 'Solid' },
  { rank: 17, name: 'Michael Penix Jr.', team: 'ATL', position: 'QB', dynastyScore: 68, tier: 'Solid' },
  { rank: 18, name: 'Trevor Lawrence', team: 'JAC', position: 'QB', dynastyScore: 66, tier: 'Solid' },
  { rank: 19, name: 'Cameron Ward', team: 'TEN', position: 'QB', dynastyScore: 64, tier: 'Depth' },
  { rank: 20, name: 'Jared Goff', team: 'DET', position: 'QB', dynastyScore: 62, tier: 'Depth' },
  { rank: 21, name: 'Jordan Love', team: 'GB', position: 'QB', dynastyScore: 60, tier: 'Depth' },
  { rank: 22, name: 'Bryce Young', team: 'CAR', position: 'QB', dynastyScore: 58, tier: 'Depth' },
  { rank: 23, name: 'Tua Tagovailoa', team: 'MIA', position: 'QB', dynastyScore: 56, tier: 'Depth' },
  { rank: 24, name: 'Jaxson Dart', team: 'NYG', position: 'QB', dynastyScore: 54, tier: 'Depth' },
  { rank: 25, name: 'Justin Fields', team: 'NYJ', position: 'QB', dynastyScore: 52, tier: 'Depth' },

  // RB Rankings
  { rank: 1, name: 'Bijan Robinson', team: 'ATL', position: 'RB', dynastyScore: 100, tier: 'Elite' },
  { rank: 2, name: 'Ashton Jeanty', team: 'LV', position: 'RB', dynastyScore: 98, tier: 'Elite' },
  { rank: 3, name: 'Jahmyr Gibbs', team: 'DET', position: 'RB', dynastyScore: 96, tier: 'Elite' },
  { rank: 4, name: 'Omarion Hampton', team: 'LAC', position: 'RB', dynastyScore: 94, tier: 'Premium' },
  { rank: 5, name: 'De\'Von Achane', team: 'MIA', position: 'RB', dynastyScore: 92, tier: 'Premium' },
  { rank: 6, name: 'Saquon Barkley', team: 'PHI', position: 'RB', dynastyScore: 90, tier: 'Premium' },
  { rank: 7, name: 'TreVeyon Henderson', team: 'NE', position: 'RB', dynastyScore: 88, tier: 'Premium' },
  { rank: 8, name: 'Kenneth Walker III', team: 'SEA', position: 'RB', dynastyScore: 86, tier: 'Premium' },
  { rank: 9, name: 'Bucky Irving', team: 'TB', position: 'RB', dynastyScore: 84, tier: 'Strong' },
  { rank: 10, name: 'Josh Jacobs', team: 'GB', position: 'RB', dynastyScore: 82, tier: 'Strong' },
  { rank: 11, name: 'Breece Hall', team: 'NYJ', position: 'RB', dynastyScore: 80, tier: 'Strong' },
  { rank: 12, name: 'Jonathan Taylor', team: 'IND', position: 'RB', dynastyScore: 78, tier: 'Strong' },
  { rank: 13, name: 'Derrick Henry', team: 'BAL', position: 'RB', dynastyScore: 76, tier: 'Strong' },
  { rank: 14, name: 'RJ Harvey', team: 'DEN', position: 'RB', dynastyScore: 74, tier: 'Solid' },
  { rank: 15, name: 'Chase Brown', team: 'CIN', position: 'RB', dynastyScore: 72, tier: 'Solid' },
  { rank: 16, name: 'James Cook', team: 'BUF', position: 'RB', dynastyScore: 70, tier: 'Solid' },
  { rank: 17, name: 'Christian McCaffrey', team: 'SF', position: 'RB', dynastyScore: 68, tier: 'Solid' },
  { rank: 18, name: 'Chuba Hubbard', team: 'CAR', position: 'RB', dynastyScore: 66, tier: 'Solid' },
  { rank: 19, name: 'Joe Mixon', team: 'HOU', position: 'RB', dynastyScore: 64, tier: 'Depth' },
  { rank: 20, name: 'Kyren Williams', team: 'LAR', position: 'RB', dynastyScore: 62, tier: 'Depth' },
  { rank: 21, name: 'Cam Skattebo', team: 'NYG', position: 'RB', dynastyScore: 60, tier: 'Depth' },
  { rank: 22, name: 'Kaleb Johnson', team: 'PIT', position: 'RB', dynastyScore: 58, tier: 'Depth' },
  { rank: 23, name: 'Alvin Kamara', team: 'NO', position: 'RB', dynastyScore: 56, tier: 'Depth' },
  { rank: 24, name: 'Quinshon Judkins', team: 'CLE', position: 'RB', dynastyScore: 54, tier: 'Depth' },
  { rank: 25, name: 'David Montgomery', team: 'DET', position: 'RB', dynastyScore: 52, tier: 'Depth' },

  // WR Rankings
  { rank: 1, name: 'Ja\'Marr Chase', team: 'CIN', position: 'WR', dynastyScore: 100, tier: 'Elite' },
  { rank: 2, name: 'Justin Jefferson', team: 'MIN', position: 'WR', dynastyScore: 98, tier: 'Elite' },
  { rank: 3, name: 'Malik Nabers', team: 'NYG', position: 'WR', dynastyScore: 96, tier: 'Elite' },
  { rank: 4, name: 'CeeDee Lamb', team: 'DAL', position: 'WR', dynastyScore: 94, tier: 'Premium' },
  { rank: 5, name: 'Brian Thomas Jr.', team: 'JAC', position: 'WR', dynastyScore: 92, tier: 'Premium' },
  { rank: 6, name: 'Puka Nacua', team: 'LAR', position: 'WR', dynastyScore: 90, tier: 'Premium' },
  { rank: 7, name: 'Amon-Ra St. Brown', team: 'DET', position: 'WR', dynastyScore: 88, tier: 'Premium' },
  { rank: 8, name: 'Drake London', team: 'ATL', position: 'WR', dynastyScore: 86, tier: 'Premium' },
  { rank: 9, name: 'Ladd McConkey', team: 'LAC', position: 'WR', dynastyScore: 84, tier: 'Strong' },
  { rank: 10, name: 'Nico Collins', team: 'HOU', position: 'WR', dynastyScore: 82, tier: 'Strong' },
  { rank: 11, name: 'A.J. Brown', team: 'PHI', position: 'WR', dynastyScore: 80, tier: 'Strong' },
  { rank: 12, name: 'Rashee Rice', team: 'KC', position: 'WR', dynastyScore: 78, tier: 'Strong' },
  { rank: 13, name: 'Tee Higgins', team: 'CIN', position: 'WR', dynastyScore: 76, tier: 'Strong' },
  { rank: 14, name: 'Tetairoa McMillan', team: 'CAR', position: 'WR', dynastyScore: 74, tier: 'Solid' },
  { rank: 15, name: 'Travis Hunter', team: 'JAC', position: 'WR', dynastyScore: 72, tier: 'Solid' },
  { rank: 16, name: 'Garrett Wilson', team: 'NYJ', position: 'WR', dynastyScore: 70, tier: 'Solid' },
  { rank: 17, name: 'Marvin Harrison Jr.', team: 'ARI', position: 'WR', dynastyScore: 68, tier: 'Solid' },
  { rank: 18, name: 'Jaxon Smith-Njigba', team: 'SEA', position: 'WR', dynastyScore: 66, tier: 'Solid' },
  { rank: 19, name: 'Emeka Egbuka', team: 'TB', position: 'WR', dynastyScore: 64, tier: 'Depth' },
  { rank: 20, name: 'George Pickens', team: 'DAL', position: 'WR', dynastyScore: 62, tier: 'Depth' },
  { rank: 21, name: 'DeVonta Smith', team: 'PHI', position: 'WR', dynastyScore: 60, tier: 'Depth' },
  { rank: 22, name: 'Jaylen Waddle', team: 'MIA', position: 'WR', dynastyScore: 58, tier: 'Depth' },
  { rank: 23, name: 'Zay Flowers', team: 'BAL', position: 'WR', dynastyScore: 56, tier: 'Depth' },
  { rank: 24, name: 'Jameson Williams', team: 'DET', position: 'WR', dynastyScore: 54, tier: 'Depth' },
  { rank: 25, name: 'Chris Olave', team: 'NO', position: 'WR', dynastyScore: 52, tier: 'Depth' },

  // TE Rankings
  { rank: 1, name: 'Brock Bowers', team: 'LV', position: 'TE', dynastyScore: 100, tier: 'Elite' },
  { rank: 2, name: 'Trey McBride', team: 'ARI', position: 'TE', dynastyScore: 98, tier: 'Elite' },
  { rank: 3, name: 'Colston Loveland', team: 'CHI', position: 'TE', dynastyScore: 96, tier: 'Elite' },
  { rank: 4, name: 'Sam LaPorta', team: 'DET', position: 'TE', dynastyScore: 94, tier: 'Premium' },
  { rank: 5, name: 'George Kittle', team: 'SF', position: 'TE', dynastyScore: 92, tier: 'Premium' },
  { rank: 6, name: 'T.J. Hockenson', team: 'MIN', position: 'TE', dynastyScore: 90, tier: 'Premium' },
  { rank: 7, name: 'Tyler Warren', team: 'IND', position: 'TE', dynastyScore: 88, tier: 'Premium' },
  { rank: 8, name: 'Tucker Kraft', team: 'GB', position: 'TE', dynastyScore: 86, tier: 'Premium' },
  { rank: 9, name: 'Mark Andrews', team: 'BAL', position: 'TE', dynastyScore: 84, tier: 'Strong' },
  { rank: 10, name: 'Dallas Goedert', team: 'PHI', position: 'TE', dynastyScore: 82, tier: 'Strong' },
  { rank: 11, name: 'Travis Kelce', team: 'KC', position: 'TE', dynastyScore: 80, tier: 'Strong' },
  { rank: 12, name: 'Harold Fannin Jr.', team: 'CLE', position: 'TE', dynastyScore: 78, tier: 'Strong' },
  { rank: 13, name: 'Terrance Ferguson', team: 'LAR', position: 'TE', dynastyScore: 76, tier: 'Strong' },
  { rank: 14, name: 'David Njoku', team: 'CLE', position: 'TE', dynastyScore: 74, tier: 'Solid' },
  { rank: 15, name: 'Mason Taylor', team: 'NYJ', position: 'TE', dynastyScore: 72, tier: 'Solid' },
  { rank: 16, name: 'Dalton Kincaid', team: 'BUF', position: 'TE', dynastyScore: 70, tier: 'Solid' },
  { rank: 17, name: 'Jake Ferguson', team: 'DAL', position: 'TE', dynastyScore: 68, tier: 'Solid' },
  { rank: 18, name: 'Evan Engram', team: 'DEN', position: 'TE', dynastyScore: 66, tier: 'Solid' },
  { rank: 19, name: 'Brenton Strange', team: 'JAC', position: 'TE', dynastyScore: 64, tier: 'Depth' },
  { rank: 20, name: 'Isaiah Likely', team: 'BAL', position: 'TE', dynastyScore: 62, tier: 'Depth' },
  { rank: 21, name: 'Jonnu Smith', team: 'PIT', position: 'TE', dynastyScore: 60, tier: 'Depth' },
  { rank: 22, name: 'Cade Otton', team: 'TB', position: 'TE', dynastyScore: 58, tier: 'Depth' },
  { rank: 23, name: 'Mike Gesicki', team: 'CIN', position: 'TE', dynastyScore: 56, tier: 'Depth' },
  { rank: 24, name: 'Elijah Arroyo', team: 'SEA', position: 'TE', dynastyScore: 54, tier: 'Depth' },
  { rank: 25, name: 'Theo Johnson', team: 'NYG', position: 'TE', dynastyScore: 52, tier: 'Depth' },
];

/**
 * Get Jake Maraia's dynasty score for a player
 */
export function getJakeMaraiaDynastyScore(playerName: string): number | null {
  const player = JAKE_MARAIA_RANKINGS.find(p => 
    p.name.toLowerCase() === playerName.toLowerCase()
  );
  return player ? player.dynastyScore : null;
}

/**
 * Get Jake Maraia's dynasty tier for a player
 */
export function getJakeMaraiaDynastyTier(playerName: string): string | null {
  const player = JAKE_MARAIA_RANKINGS.find(p => 
    p.name.toLowerCase() === playerName.toLowerCase()
  );
  return player ? player.tier : null;
}

/**
 * Get Jake Maraia's positional rank for a player
 */
export function getJakeMaraiaPositionalRank(playerName: string): number | null {
  const player = JAKE_MARAIA_RANKINGS.find(p => 
    p.name.toLowerCase() === playerName.toLowerCase()
  );
  return player ? player.rank : null;
}

/**
 * Check if player is in Jake Maraia's rankings
 */
export function isInJakeMaraiaRankings(playerName: string): boolean {
  return JAKE_MARAIA_RANKINGS.some(p => 
    p.name.toLowerCase() === playerName.toLowerCase()
  );
}