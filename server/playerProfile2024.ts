/**
 * Enhanced Player Profile System with 2024 Analytics & Percentile Rankings
 * Includes physical attributes, combine metrics, and RAS scores
 */

export interface PlayerPhysicalProfile {
  height: string;          // e.g., "6'1\""
  weight: number;          // pounds
  age: number;
  bmi: number;
  armLength?: string;      // e.g., "32 1/8\""
  handSize?: string;       // e.g., "9 1/2\""
}

export interface CombineMetrics {
  fortyYard?: number;      // 40-yard dash time
  twentyYard?: number;     // 20-yard split
  tenYard?: number;        // 10-yard split
  benchPress?: number;     // 225 lb reps
  verticalJump?: number;   // inches
  broadJump?: number;      // inches
  threeCone?: number;      // 3-cone drill time
  twentyShuttle?: number;  // 20-yard shuttle time
  rasScore?: number;       // Relative Athletic Score (0-10)
  rasPercentile?: number;  // RAS percentile by position
}

export interface Analytics2024Percentile {
  metric: string;
  value: number;
  percentile: number;
  rank: string;            // "Elite", "Above Average", "Average", "Below Average"
  context: string;         // Explanation of the metric
}

export interface PlayerProfile2024 {
  // Basic Info
  id: number;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  jerseyNumber?: number;
  
  // Physical Profile
  physical: PlayerPhysicalProfile;
  
  // Combine/Athletic Profile
  combine: CombineMetrics;
  
  // 2024 Performance
  stats2024: {
    games: number;
    targets?: number;
    receptions?: number;
    receivingYards?: number;
    receivingTds?: number;
    carries?: number;
    rushingYards?: number;
    rushingTds?: number;
    passingYards?: number;
    passingTds?: number;
    interceptions?: number;
    fantasyPoints: number;
    avgPoints: number;
  };
  
  // Top 4 Percentile Rankings (highest performing metrics)
  topPercentileMetrics: Analytics2024Percentile[];
  
  // Dynasty Profile
  dynastyValue: number;
  dynastyTier: string;
  trend: 'Rising' | 'Stable' | 'Declining';
  
  // Strengths and Concerns
  analysis: {
    strengths: string[];
    concerns: string[];
    outlook: string;
  };
}

/**
 * NFL Player Database with Physical Profiles & RAS Scores
 */
export const NFL_PLAYER_PROFILES: Record<string, PlayerProfile2024> = {
  "Brian Thomas Jr.": {
    id: 9001,
    name: "Brian Thomas Jr.",
    position: "WR",
    team: "JAC",
    jerseyNumber: 7,
    
    physical: {
      height: "6'3\"",
      weight: 209,
      age: 22,
      bmi: 26.1,
      armLength: "33 1/4\"",
      handSize: "9 1/8\""
    },
    
    combine: {
      fortyYard: 4.33,       // Elite speed
      twentyYard: 2.51,
      tenYard: 1.53,
      verticalJump: 40.5,    // Elite explosion
      broadJump: 141,        // 11'9" - elite
      threeCone: 6.85,       // Good agility
      twentyShuttle: 4.25,
      rasScore: 9.32,        // Elite RAS
      rasPercentile: 93.2    // 93rd percentile among WRs
    },
    
    stats2024: {
      games: 17,
      targets: 98,
      receptions: 64,
      receivingYards: 1108,
      receivingTds: 6,
      fantasyPoints: 227.8,
      avgPoints: 13.4
    },
    
    topPercentileMetrics: [
      {
        metric: "Deep Target Rate",
        value: 24.5,
        percentile: 95,
        rank: "Elite",
        context: "24.5% of targets 20+ yards downfield - elite deep threat"
      },
      {
        metric: "Yards per Route Run",
        value: 2.89,
        percentile: 92,
        rank: "Elite", 
        context: "2.89 YPRR - elite route running efficiency for rookie"
      },
      {
        metric: "Contested Catch Rate",
        value: 68.2,
        percentile: 88,
        rank: "Elite",
        context: "68.2% contested catch rate - excellent ball skills"
      },
      {
        metric: "Red Zone Target Share",
        value: 28.6,
        percentile: 85,
        rank: "Above Average",
        context: "28.6% red zone target share - strong scoring opportunity role"
      }
    ],
    
    dynastyValue: 82.5,
    dynastyTier: "Premium",
    trend: "Rising",
    
    analysis: {
      strengths: ["Elite athleticism (9.32 RAS)", "Deep threat ability", "Strong contested catch skills", "Young breakout profile"],
      concerns: ["Rookie volatility", "Inconsistent QB play", "Limited route tree"],
      outlook: "Elite athletic profile with proven 2024 production suggests top-10 dynasty WR potential"
    }
  },

  "Ladd McConkey": {
    id: 9002,
    name: "Ladd McConkey",
    position: "WR",
    team: "LAC",
    jerseyNumber: 15,
    
    physical: {
      height: "6'0\"",
      weight: 186,
      age: 23,
      bmi: 25.2,
      armLength: "31 7/8\"",
      handSize: "9 1/4\""
    },
    
    combine: {
      fortyYard: 4.39,       // Good speed
      twentyYard: 2.54,
      tenYard: 1.56,
      verticalJump: 36.0,    // Above average
      broadJump: 126,        // 10'6" - good
      threeCone: 6.71,       // Excellent agility
      twentyShuttle: 4.12,   // Excellent
      rasScore: 7.84,        // Above average RAS
      rasPercentile: 78.4    // 78th percentile among WRs
    },
    
    stats2024: {
      games: 17,
      targets: 98,
      receptions: 82,
      receivingYards: 1149,
      receivingTds: 4,
      fantasyPoints: 224.9,
      avgPoints: 13.2
    },
    
    topPercentileMetrics: [
      {
        metric: "Catch Rate",
        value: 83.7,
        percentile: 94,
        rank: "Elite",
        context: "83.7% catch rate - elite hands and route precision"
      },
      {
        metric: "Slot Target Rate", 
        value: 71.4,
        percentile: 91,
        rank: "Elite",
        context: "71.4% of snaps from slot - elite slot specialist"
      },
      {
        metric: "YAC per Reception",
        value: 7.8,
        percentile: 87,
        rank: "Above Average", 
        context: "7.8 YAC/reception - excellent after-catch ability"
      },
      {
        metric: "Target Share",
        value: 21.2,
        percentile: 82,
        rank: "Above Average",
        context: "21.2% target share as rookie - strong usage rate"
      }
    ],
    
    dynastyValue: 79.8,
    dynastyTier: "Premium", 
    trend: "Rising",
    
    analysis: {
      strengths: ["Elite catch rate (83.7%)", "Slot mastery", "Route precision", "YAC ability"],
      concerns: ["Lower TD rate", "Size limitations", "Target competition"],
      outlook: "Consistent target hog with elite hands profile suggests reliable WR2+ dynasty asset"
    }
  },

  "Josh Allen": {
    id: 105,
    name: "Josh Allen",
    position: "QB",
    team: "BUF",
    jerseyNumber: 17,
    
    physical: {
      height: "6'5\"",
      weight: 237,
      age: 28,
      bmi: 28.1,
      armLength: "33 3/8\"",
      handSize: "10 1/4\""
    },
    
    combine: {
      fortyYard: 4.75,
      verticalJump: 33.5,
      broadJump: 118,
      threeCone: 7.17,
      twentyShuttle: 4.52,
      rasScore: 6.49,
      rasPercentile: 64.9
    },
    
    stats2024: {
      games: 17,
      passingYards: 4306,
      passingTds: 28,
      interceptions: 6,
      carries: 109,
      rushingYards: 523,
      rushingTds: 12,
      fantasyPoints: 398.2,
      avgPoints: 23.4
    },
    
    topPercentileMetrics: [
      {
        metric: "Rushing TDs",
        value: 12,
        percentile: 98,
        rank: "Elite",
        context: "12 rushing TDs - elite QB rushing floor in red zone"
      },
      {
        metric: "Deep Ball Accuracy",
        value: 49.3,
        percentile: 89,
        rank: "Elite", 
        context: "49.3% accuracy on 20+ yard throws - elite arm talent"
      },
      {
        metric: "EPA per Play",
        value: 0.31,
        percentile: 85,
        rank: "Above Average",
        context: "0.31 EPA/play - efficient offensive production"
      },
      {
        metric: "Pressure to Sack Rate",
        value: 14.2,
        percentile: 82,
        rank: "Above Average",
        context: "14.2% pressure-to-sack rate - good pocket presence"
      }
    ],
    
    dynastyValue: 95.2,
    dynastyTier: "Elite",
    trend: "Stable",
    
    analysis: {
      strengths: ["Elite dual-threat ability", "Top-tier arm strength", "Red zone rushing", "Playoff experience"],
      concerns: ["Occasional interception spikes", "Age 28 prime window", "Injury risk from rushing"],
      outlook: "Elite QB1 with unique rushing floor maintaining dynasty QB1 status through 2027"
    }
  }
};

/**
 * Calculate percentile ranking for a metric
 */
export function calculatePercentile(value: number, position: string, metric: string): number {
  // Position-specific percentile thresholds based on 2024 NFL data
  const thresholds: Record<string, Record<string, number[]>> = {
    WR: {
      "Catch Rate": [55, 65, 72, 78, 85], // 20th, 40th, 60th, 80th, 95th percentiles
      "YPRR": [1.2, 1.6, 2.0, 2.4, 2.8],
      "Target Share": [8, 12, 16, 20, 26],
      "YAC per Reception": [3.5, 4.8, 6.2, 7.5, 9.2]
    },
    QB: {
      "EPA per Play": [-0.1, 0.05, 0.15, 0.25, 0.35],
      "Deep Ball Accuracy": [30, 35, 40, 45, 52],
      "Rushing TDs": [0, 2, 4, 7, 12]
    }
  };

  const posThresholds = thresholds[position]?.[metric];
  if (!posThresholds) return 50; // Default 50th percentile
  
  if (value <= posThresholds[0]) return 20;
  if (value <= posThresholds[1]) return 40;
  if (value <= posThresholds[2]) return 60;
  if (value <= posThresholds[3]) return 80;
  return 95;
}

/**
 * Get rank description from percentile
 */
export function getPercentileRank(percentile: number): string {
  if (percentile >= 90) return "Elite";
  if (percentile >= 75) return "Above Average";
  if (percentile >= 25) return "Average";
  return "Below Average";
}

/**
 * Get player profile by ID or name
 */
export function getPlayerProfile(identifier: string | number): PlayerProfile2024 | null {
  // Search by name first
  if (typeof identifier === 'string') {
    const profile = NFL_PLAYER_PROFILES[identifier];
    if (profile) return profile;
    
    // Search by partial name match
    const matchedKey = Object.keys(NFL_PLAYER_PROFILES).find(name => 
      name.toLowerCase().includes(identifier.toLowerCase())
    );
    if (matchedKey) return NFL_PLAYER_PROFILES[matchedKey];
  }
  
  // Search by ID
  const profileByID = Object.values(NFL_PLAYER_PROFILES).find(p => p.id === identifier);
  return profileByID || null;
}

/**
 * Calculate BMI from height and weight
 */
export function calculateBMI(heightFeet: number, heightInches: number, weight: number): number {
  const totalInches = (heightFeet * 12) + heightInches;
  const heightMeters = totalInches * 0.0254;
  const weightKg = weight * 0.453592;
  return weightKg / (heightMeters * heightMeters);
}