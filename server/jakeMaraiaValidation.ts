/**
 * Jake Maraia Dynasty Rankings Validation System
 * Simple benchmark comparison to validate our algorithm accuracy
 * Success = within 3-5 spots of Jake's rankings for most players
 */

interface ValidationResult {
  playerName: string;
  position: string;
  ourRank: number;
  jakeRank: number;
  difference: number;
  status: 'Excellent' | 'Good' | 'Acceptable' | 'Review';
  note?: string;
}

/**
 * Jake Maraia's current dynasty rankings (January 2025)
 */
const JAKE_MARAIA_BENCHMARKS = {
  WR: {
    "Ja'Marr Chase": 1,
    "Justin Jefferson": 2,
    "Malik Nabers": 3,
    "CeeDee Lamb": 4,
    "Brian Thomas Jr.": 5,
    "Puka Nacua": 6,
    "Amon-Ra St. Brown": 7,
    "Drake London": 8,
    "Ladd McConkey": 9,
    "Nico Collins": 10,
    "A.J. Brown": 11,
    "Rashee Rice": 12,
    "Tee Higgins": 13,
    "Garrett Wilson": 16,
    "Marvin Harrison Jr.": 17,
    "Jaxon Smith-Njigba": 18,
    "DeVonta Smith": 21,
    "Jaylen Waddle": 22,
    "Zay Flowers": 23,
    "Chris Olave": 25,
    "DK Metcalf": 26,
    "Terry McLaurin": 27,
    "Brandon Aiyuk": 28,
    "Rome Odunze": 29,
    "Jordan Addison": 30,
    "Mike Evans": 31,
    "Davante Adams": 32
  },
  RB: {
    "Bijan Robinson": 1,
    "Ashton Jeanty": 2,
    "Jahmyr Gibbs": 3,
    "De'Von Achane": 5,
    "Saquon Barkley": 6,
    "Kenneth Walker III": 8,
    "Bucky Irving": 9,
    "Josh Jacobs": 10,
    "Breece Hall": 11,
    "Jonathan Taylor": 12,
    "Derrick Henry": 13,
    "Chase Brown": 15,
    "James Cook": 16,
    "Christian McCaffrey": 17,
    "Chuba Hubbard": 18,
    "Joe Mixon": 19,
    "Kyren Williams": 20,
    "Alvin Kamara": 23,
    "David Montgomery": 25,
    "Tony Pollard": 26,
    "James Conner": 27
  },
  QB: {
    "Josh Allen": 1,
    "Jayden Daniels": 2,
    "Lamar Jackson": 3,
    "Joe Burrow": 4,
    "Jalen Hurts": 5,
    "Drake Maye": 6,
    "Justin Herbert": 7,
    "Patrick Mahomes II": 8,
    "C.J. Stroud": 9,
    "Brock Purdy": 10,
    "Caleb Williams": 11,
    "Kyler Murray": 12,
    "Baker Mayfield": 13,
    "Bo Nix": 14
  },
  TE: {
    "Brock Bowers": 1,
    "Trey McBride": 2,
    "Sam LaPorta": 3,
    "George Kittle": 4,
    "Mark Andrews": 5,
    "Travis Kelce": 6,
    "Dalton Kincaid": 7,
    "Jake Ferguson": 8,
    "Tucker Kraft": 9,
    "David Njoku": 10,
    "Kyle Pitts": 11
  }
};

class JakeMaraiaValidator {
  
  /**
   * Validate a single player ranking against Jake's benchmark
   */
  validatePlayer(playerName: string, position: string, ourRank: number): ValidationResult | null {
    const benchmarks = JAKE_MARAIA_BENCHMARKS[position as keyof typeof JAKE_MARAIA_BENCHMARKS];
    const jakeRank = benchmarks?.[playerName];
    
    if (!jakeRank) {
      return null; // Player not in Jake's rankings
    }
    
    const difference = Math.abs(ourRank - jakeRank);
    let status: ValidationResult['status'];
    let note: string | undefined;
    
    if (difference <= 2) {
      status = 'Excellent';
    } else if (difference <= 5) {
      status = 'Good';
    } else if (difference <= 8) {
      status = 'Acceptable';
    } else {
      status = 'Review';
      note = difference >= 15 ? 'Major discrepancy - algorithm may need adjustment' : 'Notable difference';
    }
    
    return {
      playerName,
      position,
      ourRank,
      jakeRank,
      difference,
      status,
      note
    };
  }
  
  /**
   * Quick check if a player ranking needs review
   */
  needsReview(playerName: string, position: string, ourRank: number): boolean {
    const validation = this.validatePlayer(playerName, position, ourRank);
    return validation?.status === 'Review' || false;
  }
  
  /**
   * Get benchmark rank for a player (if available)
   */
  getBenchmarkRank(playerName: string, position: string): number | null {
    const benchmarks = JAKE_MARAIA_BENCHMARKS[position as keyof typeof JAKE_MARAIA_BENCHMARKS];
    return benchmarks?.[playerName] || null;
  }
  
  /**
   * Validate our entire ranking system accuracy
   */
  validateRankingAccuracy(ourRankings: Array<{name: string, position: string, rank: number}>): {
    totalValidated: number;
    excellent: number;
    good: number;
    acceptable: number;
    needsReview: number;
    averageDifference: number;
    accuracyScore: number; // 0-100
    topIssues: ValidationResult[];
  } {
    const validations: ValidationResult[] = [];
    
    for (const player of ourRankings) {
      const validation = this.validatePlayer(player.name, player.position, player.rank);
      if (validation) {
        validations.push(validation);
      }
    }
    
    const stats = {
      totalValidated: validations.length,
      excellent: validations.filter(v => v.status === 'Excellent').length,
      good: validations.filter(v => v.status === 'Good').length,
      acceptable: validations.filter(v => v.status === 'Acceptable').length,
      needsReview: validations.filter(v => v.status === 'Review').length,
      averageDifference: validations.reduce((sum, v) => sum + v.difference, 0) / validations.length,
      accuracyScore: 0,
      topIssues: validations
        .filter(v => v.status === 'Review')
        .sort((a, b) => b.difference - a.difference)
        .slice(0, 5)
    };
    
    // Calculate accuracy score (80%+ excellent/good = high accuracy)
    const goodRankings = stats.excellent + stats.good;
    stats.accuracyScore = Math.round((goodRankings / stats.totalValidated) * 100);
    
    return stats;
  }
}

export const jakeMaraiaValidator = new JakeMaraiaValidator();