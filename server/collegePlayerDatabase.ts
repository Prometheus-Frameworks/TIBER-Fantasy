/**
 * College Player Database with Draft Capital Integration
 * Includes Travis Hunter, Emeka Egbuka, Jack Bech, Luther Burden
 */

export interface CollegePlayer {
  id: number;
  name: string;
  position: string;
  college: string;
  year: string; // Senior, Junior, etc.
  
  // Draft Projection (heavily weighted)
  draftCapital: {
    projectedRound: number;
    projectedPick: number;
    draftGrade: number; // 0-100 scout grade
    consensus: string; // "1st Round Lock", "Day 2 Target", etc.
  };
  
  // College Production (2024 season)
  college2024: {
    games: number;
    targets?: number;
    receptions?: number;
    receivingYards?: number;
    receivingTds?: number;
    carries?: number;
    rushingYards?: number;
    rushingTds?: number;
    tackles?: number;
    interceptions?: number;
    passDeflections?: number;
  };
  
  // Physical Profile
  physical: {
    height: string;
    weight: number;
    age: number;
    armLength?: string;
    handSize?: string;
  };
  
  // Athletic Profile
  athletic: {
    estimatedFortyYard?: number; // Pre-combine estimate
    estimatedRAS?: number; // Estimated RAS based on film
    athleticismGrade: number; // 0-100 scout grade
  };
  
  // Dynasty Projection
  dynastyProjection: {
    immediateImpact: number; // 0-100 rookie year projection
    ceilingGrade: number; // 0-100 peak potential
    floorGrade: number; // 0-100 worst-case scenario
    threeYearProjection: number; // Dynasty value in year 3
    riskLevel: 'Low' | 'Medium' | 'High';
  };
  
  // Scouting Profile
  scouting: {
    strengths: string[];
    concerns: string[];
    comparison: string; // NFL player comparison
    scheme: string; // Best scheme fit
  };
}

/**
 * 2025 College Player Database - Top Dynasty Prospects
 */
export const COLLEGE_DYNASTY_PROSPECTS: Record<string, CollegePlayer> = {
  "Travis Hunter": {
    id: 20001,
    name: "Travis Hunter",
    position: "WR/CB", // Two-way player
    college: "Colorado",
    year: "Junior",
    
    draftCapital: {
      projectedRound: 1,
      projectedPick: 3, // Top 5 pick
      draftGrade: 98,
      consensus: "Generational Talent - Top 3 Pick"
    },
    
    college2024: {
      games: 12,
      targets: 96,
      receptions: 74,
      receivingYards: 1152,
      receivingTds: 14,
      // Defense stats
      tackles: 32,
      interceptions: 4,
      passDeflections: 11
    },
    
    physical: {
      height: "6'1\"",
      weight: 185,
      age: 21,
      armLength: "32 1/4\"",
      handSize: "9 1/8\""
    },
    
    athletic: {
      estimatedFortyYard: 4.35,
      estimatedRAS: 9.2,
      athleticismGrade: 97
    },
    
    dynastyProjection: {
      immediateImpact: 85, // Elite rookie projection
      ceilingGrade: 98, // Generational ceiling
      floorGrade: 75, // High floor due to versatility
      threeYearProjection: 95,
      riskLevel: 'Low'
    },
    
    scouting: {
      strengths: ["Elite route running", "Two-way versatility", "Game-breaking speed", "Shutdown coverage ability"],
      concerns: ["Durability playing both ways", "NFL position uncertainty", "Weight concerns"],
      comparison: "Deion Sanders (two-way ability)",
      scheme: "Any - elite versatility"
    }
  },

  "Emeka Egbuka": {
    id: 20002,
    name: "Emeka Egbuka",
    position: "WR",
    college: "Ohio State",
    year: "Senior",
    
    draftCapital: {
      projectedRound: 1,
      projectedPick: 18,
      draftGrade: 87,
      consensus: "Late 1st Round - Polished Route Runner"
    },
    
    college2024: {
      games: 13,
      targets: 102,
      receptions: 67,
      receivingYards: 964,
      receivingTds: 10
    },
    
    physical: {
      height: "6'1\"",
      weight: 205,
      age: 22,
      armLength: "32 3/8\"",
      handSize: "9 3/4\""
    },
    
    athletic: {
      estimatedFortyYard: 4.47,
      estimatedRAS: 7.8,
      athleticismGrade: 82
    },
    
    dynastyProjection: {
      immediateImpact: 75,
      ceilingGrade: 85,
      floorGrade: 65,
      threeYearProjection: 82,
      riskLevel: 'Medium'
    },
    
    scouting: {
      strengths: ["Polished route running", "Reliable hands", "Red zone target", "High football IQ"],
      concerns: ["Limited separation ability", "Not explosive after catch", "Age for draft class"],
      comparison: "Allen Robinson - reliable possession receiver",
      scheme: "West Coast/Timing offense"
    }
  },

  "Luther Burden": {
    id: 20003,
    name: "Luther Burden",
    position: "WR",
    college: "Missouri",
    year: "Junior",
    
    draftCapital: {
      projectedRound: 1,
      projectedPick: 12,
      draftGrade: 90,
      consensus: "Mid 1st Round - Dynamic Playmaker"
    },
    
    college2024: {
      games: 13,
      targets: 88,
      receptions: 61,
      receivingYards: 676,
      receivingTds: 8,
      carries: 15,
      rushingYards: 147,
      rushingTds: 2
    },
    
    physical: {
      height: "5'11\"",
      weight: 205,
      age: 21,
      armLength: "31 7/8\"",
      handSize: "9 1/2\""
    },
    
    athletic: {
      estimatedFortyYard: 4.38,
      estimatedRAS: 8.9,
      athleticismGrade: 91
    },
    
    dynastyProjection: {
      immediateImpact: 80,
      ceilingGrade: 92,
      floorGrade: 70,
      threeYearProjection: 88,
      riskLevel: 'Medium'
    },
    
    scouting: {
      strengths: ["Elite acceleration", "YAC ability", "Versatile usage", "Big play potential"],
      concerns: ["Size limitations", "Route tree development", "Consistency vs press"],
      comparison: "Tyreek Hill - explosive slot weapon",
      scheme: "Spread/RPO systems"
    }
  },

  "Jack Bech": {
    id: 20004,
    name: "Jack Bech",
    position: "WR",
    college: "TCU",
    year: "Senior",
    
    draftCapital: {
      projectedRound: 2,
      projectedPick: 45,
      draftGrade: 78,
      consensus: "Day 2 Value Pick - Reliable Target"
    },
    
    college2024: {
      games: 13,
      targets: 94,
      receptions: 63,
      receivingYards: 825,
      receivingTds: 7
    },
    
    physical: {
      height: "6'0\"",
      weight: 190,
      age: 22,
      armLength: "31 1/2\"",
      handSize: "9 1/4\""
    },
    
    athletic: {
      estimatedFortyYard: 4.52,
      estimatedRAS: 6.8,
      athleticismGrade: 72
    },
    
    dynastyProjection: {
      immediateImpact: 65,
      ceilingGrade: 75,
      floorGrade: 55,
      threeYearProjection: 68,
      riskLevel: 'Medium'
    },
    
    scouting: {
      strengths: ["Sure hands", "Route precision", "Third down specialist", "Red zone awareness"],
      concerns: ["Limited athleticism", "Separation struggles", "Lacks elite upside"],
      comparison: "Hunter Renfrow - possession slot receiver",
      scheme: "Slot-heavy passing attacks"
    }
  }
};

/**
 * Calculate dynasty value for college prospects including draft capital
 */
export function calculateCollegeDynastyValue(player: CollegePlayer): number {
  // Draft Capital Score (50% weight - most predictive)
  const draftScore = calculateDraftCapitalScore(player.draftCapital);
  
  // College Production Score (30% weight)
  const productionScore = calculateCollegeProductionScore(player.college2024, player.position);
  
  // Physical/Athletic Score (20% weight)
  const athleticScore = calculateAthleticScore(player.physical, player.athletic);
  
  // Weighted final score
  const finalScore = (draftScore * 0.5) + (productionScore * 0.3) + (athleticScore * 0.2);
  
  return Math.min(95, Math.max(45, finalScore)); // Cap college prospects 45-95
}

/**
 * Draft capital is the most predictive factor for NFL success
 */
function calculateDraftCapitalScore(draftCapital: any): number {
  const { projectedRound, projectedPick, draftGrade } = draftCapital;
  
  // Round-based scoring (heavily favor early picks)
  let roundScore = 50;
  if (projectedRound === 1) {
    if (projectedPick <= 5) roundScore = 95;      // Top 5 picks
    else if (projectedPick <= 15) roundScore = 88; // Mid 1st
    else roundScore = 82;                          // Late 1st
  } else if (projectedRound === 2) {
    roundScore = 72;
  } else if (projectedRound === 3) {
    roundScore = 65;
  }
  
  // Combine with scout grade
  return (roundScore * 0.7) + (draftGrade * 0.3);
}

/**
 * College production adjusted for position and competition
 */
function calculateCollegeProductionScore(stats: any, position: string): number {
  if (position.includes('WR')) {
    const yards = stats.receivingYards || 0;
    const tds = stats.receivingTds || 0;
    const receptions = stats.receptions || 0;
    
    // Elite thresholds: 1000+ yards, 10+ TDs, 60+ catches
    const yardScore = Math.min(35, (yards / 1000) * 35);
    const tdScore = Math.min(25, (tds / 10) * 25);
    const catchScore = Math.min(25, (receptions / 60) * 25);
    
    return yardScore + tdScore + catchScore;
  }
  
  return 50; // Default for other positions
}

/**
 * Physical and athletic projection
 */
function calculateAthleticScore(physical: any, athletic: any): number {
  let score = 50;
  
  // Size premium for WRs
  const heightInches = parseFloat(physical.height.split("'")[0]) * 12 + 
                      parseFloat(physical.height.split("'")[1].replace("\"", ""));
  if (heightInches >= 73) score += 10; // 6'1" or taller
  if (physical.weight >= 200) score += 5; // Size premium
  
  // Athletic ability
  if (athletic.estimatedRAS >= 8.5) score += 15;
  else if (athletic.estimatedRAS >= 7.5) score += 10;
  else if (athletic.estimatedRAS >= 6.5) score += 5;
  
  // Speed premium
  if (athletic.estimatedFortyYard && athletic.estimatedFortyYard <= 4.4) score += 10;
  
  return Math.min(85, score);
}

/**
 * Get college player by name or ID
 */
export function getCollegePlayer(identifier: string | number): CollegePlayer | null {
  if (typeof identifier === 'string') {
    return COLLEGE_DYNASTY_PROSPECTS[identifier] || null;
  }
  
  return Object.values(COLLEGE_DYNASTY_PROSPECTS).find(p => p.id === identifier) || null;
}

/**
 * Get all college prospects with dynasty projections
 */
export function getAllCollegeProspects(): CollegePlayer[] {
  return Object.values(COLLEGE_DYNASTY_PROSPECTS).map(player => ({
    ...player,
    dynastyValue: calculateCollegeDynastyValue(player)
  })).sort((a, b) => (b.dynastyValue || 0) - (a.dynastyValue || 0));
}