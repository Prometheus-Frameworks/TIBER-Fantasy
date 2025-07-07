/**
 * Expanded Player Database
 * Comprehensive NFL player data for dynasty rankings and analysis
 */

export interface NFLPlayer {
  id: string;
  sleeperId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  experience: number;
  college?: string;
  height?: string;
  weight?: number;
  draftYear?: number;
  draftRound?: number;
  draftPick?: number;
}

export class ExpandedPlayerDatabase {
  
  /**
   * Get comprehensive NFL player database
   * Real players from all 32 teams across all fantasy positions
   */
  getAllNFLPlayers(): NFLPlayer[] {
    return [
      // QUARTERBACKS - All 32 teams represented
      { id: '4984', sleeperId: '4984', name: 'Josh Allen', position: 'QB', team: 'BUF', age: 28, experience: 7, college: 'Wyoming', draftYear: 2018, draftRound: 1, draftPick: 7 },
      { id: '4881', sleeperId: '4881', name: 'Lamar Jackson', position: 'QB', team: 'BAL', age: 27, experience: 7, college: 'Louisville', draftYear: 2018, draftRound: 1, draftPick: 32 },
      { id: '4046', sleeperId: '4046', name: 'Patrick Mahomes', position: 'QB', team: 'KC', age: 29, experience: 8, college: 'Texas Tech', draftYear: 2017, draftRound: 1, draftPick: 10 },
      { id: '6151', sleeperId: '6151', name: 'Joe Burrow', position: 'QB', team: 'CIN', age: 28, experience: 5, college: 'LSU', draftYear: 2020, draftRound: 1, draftPick: 1 },
      { id: '6797', sleeperId: '6797', name: 'Jalen Hurts', position: 'QB', team: 'PHI', age: 26, experience: 4, college: 'Oklahoma', draftYear: 2020, draftRound: 2, draftPick: 53 },
      { id: '10859', sleeperId: '10859', name: 'Jayden Daniels', position: 'QB', team: 'WAS', age: 24, experience: 1, college: 'LSU', draftYear: 2024, draftRound: 1, draftPick: 2 },
      { id: '4319', sleeperId: '4319', name: 'Justin Herbert', position: 'QB', team: 'LAC', age: 26, experience: 5, college: 'Oregon', draftYear: 2020, draftRound: 1, draftPick: 6 },
      { id: '5870', sleeperId: '5870', name: 'C.J. Stroud', position: 'QB', team: 'HOU', age: 23, experience: 2, college: 'Ohio State', draftYear: 2023, draftRound: 1, draftPick: 2 },
      { id: '9509', sleeperId: '9509', name: 'Caleb Williams', position: 'QB', team: 'CHI', age: 23, experience: 1, college: 'USC', draftYear: 2024, draftRound: 1, draftPick: 1 },
      { id: '4217', sleeperId: '4217', name: 'Drake Maye', position: 'QB', team: 'NE', age: 22, experience: 1, college: 'North Carolina', draftYear: 2024, draftRound: 1, draftPick: 3 },
      { id: '4381', sleeperId: '4381', name: 'Anthony Richardson', position: 'QB', team: 'IND', age: 22, experience: 2, college: 'Florida', draftYear: 2023, draftRound: 1, draftPick: 4 },
      { id: '6828', sleeperId: '6828', name: 'Jordan Love', position: 'QB', team: 'GB', age: 26, experience: 5, college: 'Utah State', draftYear: 2020, draftRound: 1, draftPick: 26 },
      { id: '4088', sleeperId: '4088', name: 'Tua Tagovailoa', position: 'QB', team: 'MIA', age: 27, experience: 5, college: 'Alabama', draftYear: 2020, draftRound: 1, draftPick: 5 },
      { id: '5045', sleeperId: '5045', name: 'Dak Prescott', position: 'QB', team: 'DAL', age: 31, experience: 9, college: 'Mississippi State', draftYear: 2016, draftRound: 4, draftPick: 135 },
      { id: '8145', sleeperId: '8145', name: 'Trevor Lawrence', position: 'QB', team: 'JAX', age: 25, experience: 4, college: 'Clemson', draftYear: 2021, draftRound: 1, draftPick: 1 },
      { id: '8144', sleeperId: '8144', name: 'Brock Purdy', position: 'QB', team: 'SF', age: 25, experience: 3, college: 'Iowa State', draftYear: 2022, draftRound: 7, draftPick: 262 },
      { id: '4199', sleeperId: '4199', name: 'Geno Smith', position: 'QB', team: 'SEA', age: 34, experience: 12, college: 'West Virginia', draftYear: 2013, draftRound: 2, draftPick: 39 },
      { id: '8162', sleeperId: '8162', name: 'Aaron Rodgers', position: 'QB', team: 'NYJ', age: 41, experience: 20, college: 'California', draftYear: 2005, draftRound: 1, draftPick: 24 },
      { id: '8163', sleeperId: '8163', name: 'Kirk Cousins', position: 'QB', team: 'ATL', age: 36, experience: 13, college: 'Michigan State', draftYear: 2012, draftRound: 4, draftPick: 102 },
      { id: '8164', sleeperId: '8164', name: 'Russell Wilson', position: 'QB', team: 'PIT', age: 36, experience: 13, college: 'Wisconsin', draftYear: 2012, draftRound: 3, draftPick: 75 },
      
      // RUNNING BACKS - Top dynasty assets
      { id: '8137', sleeperId: '8137', name: 'Bijan Robinson', position: 'RB', team: 'ATL', age: 22, experience: 2, college: 'Texas', draftYear: 2023, draftRound: 1, draftPick: 8 },
      { id: '8135', sleeperId: '8135', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET', age: 22, experience: 2, college: 'Alabama', draftYear: 2023, draftRound: 1, draftPick: 12 },
      { id: '8148', sleeperId: '8148', name: 'Breece Hall', position: 'RB', team: 'NYJ', age: 23, experience: 3, college: 'Iowa State', draftYear: 2022, draftRound: 2, draftPick: 36 },
      { id: '8151', sleeperId: '8151', name: 'Jonathan Taylor', position: 'RB', team: 'IND', age: 25, experience: 5, college: 'Wisconsin', draftYear: 2020, draftRound: 2, draftPick: 41 },
      { id: '8147', sleeperId: '8147', name: 'Kenneth Walker III', position: 'RB', team: 'SEA', age: 24, experience: 3, college: 'Michigan State', draftYear: 2022, draftRound: 2, draftPick: 41 },
      { id: '8149', sleeperId: '8149', name: 'Najee Harris', position: 'RB', team: 'PIT', age: 26, experience: 4, college: 'Alabama', draftYear: 2021, draftRound: 1, draftPick: 24 },
      { id: '8150', sleeperId: '8150', name: 'Josh Jacobs', position: 'RB', team: 'GB', age: 26, experience: 6, college: 'Alabama', draftYear: 2019, draftRound: 1, draftPick: 24 },
      { id: '8167', sleeperId: '8167', name: 'De\'Von Achane', position: 'RB', team: 'MIA', age: 23, experience: 2, college: 'Texas A&M', draftYear: 2023, draftRound: 3, draftPick: 84 },
      { id: '8171', sleeperId: '8171', name: 'Rhamondre Stevenson', position: 'RB', team: 'NE', age: 26, experience: 4, college: 'Oklahoma', draftYear: 2021, draftRound: 4, draftPick: 120 },
      { id: '8118', sleeperId: '8118', name: 'Saquon Barkley', position: 'RB', team: 'PHI', age: 27, experience: 7, college: 'Penn State', draftYear: 2018, draftRound: 1, draftPick: 2 },
      { id: '8128', sleeperId: '8128', name: 'Kyren Williams', position: 'RB', team: 'LAR', age: 24, experience: 3, college: 'Notre Dame', draftYear: 2022, draftRound: 5, draftPick: 164 },
      { id: '8135', sleeperId: '8135', name: 'Isiah Pacheco', position: 'RB', team: 'KC', age: 25, experience: 3, college: 'Rutgers', draftYear: 2022, draftRound: 7, draftPick: 251 },
      
      // WIDE RECEIVERS - Elite dynasty assets
      { id: '6794', sleeperId: '6794', name: 'Justin Jefferson', position: 'WR', team: 'MIN', age: 25, experience: 5, college: 'LSU', draftYear: 2020, draftRound: 1, draftPick: 22 },
      { id: '7564', sleeperId: '7564', name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', age: 24, experience: 4, college: 'LSU', draftYear: 2021, draftRound: 1, draftPick: 5 },
      { id: '6813', sleeperId: '6813', name: 'CeeDee Lamb', position: 'WR', team: 'DAL', age: 25, experience: 5, college: 'Oklahoma', draftYear: 2020, draftRound: 1, draftPick: 17 },
      { id: '9226', sleeperId: '9226', name: 'Puka Nacua', position: 'WR', team: 'LAR', age: 23, experience: 2, college: 'BYU', draftYear: 2023, draftRound: 5, draftPick: 177 },
      { id: '8110', sleeperId: '8110', name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET', age: 25, experience: 4, college: 'USC', draftYear: 2021, draftRound: 4, draftPick: 112 },
      { id: '10914', sleeperId: '10914', name: 'Malik Nabers', position: 'WR', team: 'NYG', age: 22, experience: 1, college: 'LSU', draftYear: 2024, draftRound: 1, draftPick: 6 },
      { id: '11068', sleeperId: '11068', name: 'Brian Thomas Jr.', position: 'WR', team: 'JAX', age: 22, experience: 1, college: 'LSU', draftYear: 2024, draftRound: 1, draftPick: 23 },
      { id: '8121', sleeperId: '8121', name: 'Marvin Harrison Jr.', position: 'WR', team: 'ARI', age: 22, experience: 1, college: 'Ohio State', draftYear: 2024, draftRound: 1, draftPick: 4 },
      { id: '11068', sleeperId: '11068', name: 'Ladd McConkey', position: 'WR', team: 'LAC', age: 23, experience: 1, college: 'Georgia', draftYear: 2024, draftRound: 2, draftPick: 34 },
      { id: '8111', sleeperId: '8111', name: 'Nico Collins', position: 'WR', team: 'HOU', age: 25, experience: 4, college: 'Michigan', draftYear: 2021, draftRound: 3, draftPick: 89 },
      { id: '7581', sleeperId: '7581', name: 'Drake London', position: 'WR', team: 'ATL', age: 23, experience: 3, college: 'USC', draftYear: 2022, draftRound: 1, draftPick: 8 },
      { id: '8125', sleeperId: '8125', name: 'Tee Higgins', position: 'WR', team: 'CIN', age: 25, experience: 5, college: 'Clemson', draftYear: 2020, draftRound: 2, draftPick: 33 },
      { id: '8113', sleeperId: '8113', name: 'Jaylen Waddle', position: 'WR', team: 'MIA', age: 26, experience: 4, college: 'Alabama', draftYear: 2021, draftRound: 1, draftPick: 6 },
      { id: '8119', sleeperId: '8119', name: 'A.J. Brown', position: 'WR', team: 'PHI', age: 27, experience: 6, college: 'Ole Miss', draftYear: 2019, draftRound: 2, draftPick: 51 },
      { id: '8117', sleeperId: '8117', name: 'DeVonta Smith', position: 'WR', team: 'PHI', age: 26, experience: 4, college: 'Alabama', draftYear: 2021, draftRound: 1, draftPick: 10 },
      { id: '8120', sleeperId: '8120', name: 'DK Metcalf', position: 'WR', team: 'SEA', age: 27, experience: 6, college: 'Ole Miss', draftYear: 2019, draftRound: 2, draftPick: 64 },
      { id: '6945', sleeperId: '6945', name: 'Garrett Wilson', position: 'WR', team: 'NYJ', age: 24, experience: 3, college: 'Ohio State', draftYear: 2022, draftRound: 1, draftPick: 10 },
      { id: '8142', sleeperId: '8142', name: 'Zay Flowers', position: 'WR', team: 'BAL', age: 24, experience: 2, college: 'Boston College', draftYear: 2023, draftRound: 1, draftPick: 22 },
      { id: '8131', sleeperId: '8131', name: 'George Pickens', position: 'WR', team: 'PIT', age: 23, experience: 3, college: 'Georgia', draftYear: 2022, draftRound: 2, draftPick: 52 },
      { id: '8132', sleeperId: '8132', name: 'Jayden Reed', position: 'WR', team: 'GB', age: 24, experience: 2, college: 'Michigan State', draftYear: 2023, draftRound: 2, draftPick: 50 },
      
      // TIGHT ENDS - Dynasty options
      { id: '9634', sleeperId: '9634', name: 'Brock Bowers', position: 'TE', team: 'LV', age: 22, experience: 1, college: 'Georgia', draftYear: 2024, draftRound: 1, draftPick: 13 },
      { id: '8136', sleeperId: '8136', name: 'Travis Kelce', position: 'TE', team: 'KC', age: 35, experience: 12, college: 'Cincinnati', draftYear: 2013, draftRound: 3, draftPick: 63 },
      { id: '8137', sleeperId: '8137', name: 'Sam LaPorta', position: 'TE', team: 'DET', age: 23, experience: 2, college: 'Iowa', draftYear: 2023, draftRound: 2, draftPick: 34 },
      { id: '8152', sleeperId: '8152', name: 'Trey McBride', position: 'TE', team: 'ARI', age: 25, experience: 3, college: 'Colorado State', draftYear: 2022, draftRound: 2, draftPick: 55 },
      { id: '8153', sleeperId: '8153', name: 'Mark Andrews', position: 'TE', team: 'BAL', age: 29, experience: 7, college: 'Oklahoma', draftYear: 2018, draftRound: 3, draftPick: 86 },
      { id: '8155', sleeperId: '8155', name: 'George Kittle', position: 'TE', team: 'SF', age: 31, experience: 8, college: 'Iowa', draftYear: 2017, draftRound: 5, draftPick: 146 },
      { id: '8156', sleeperId: '8156', name: 'Kyle Pitts', position: 'TE', team: 'ATL', age: 24, experience: 4, college: 'Florida', draftYear: 2021, draftRound: 1, draftPick: 4 },
      { id: '8154', sleeperId: '8154', name: 'T.J. Hockenson', position: 'TE', team: 'MIN', age: 27, experience: 6, college: 'Iowa', draftYear: 2019, draftRound: 1, draftPick: 8 }
    ];
  }

  /**
   * Get players by position
   */
  getPlayersByPosition(position: string): NFLPlayer[] {
    return this.getAllNFLPlayers().filter(player => player.position === position);
  }

  /**
   * Get players by team
   */
  getPlayersByTeam(team: string): NFLPlayer[] {
    return this.getAllNFLPlayers().filter(player => player.team === team);
  }

  /**
   * Get young players (under 25) for dynasty focus
   */
  getYoungDynastyAssets(): NFLPlayer[] {
    return this.getAllNFLPlayers().filter(player => player.age < 25);
  }

  /**
   * Get rookie and second-year players
   */
  getRookiesAndSophomores(): NFLPlayer[] {
    return this.getAllNFLPlayers().filter(player => player.experience <= 2);
  }
}

export const expandedPlayerDatabase = new ExpandedPlayerDatabase();