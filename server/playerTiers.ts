/**
 * Dynasty Player Tier System
 * Based on Jake Maraia methodology analysis
 */

export interface TierPlayer {
  name: string;
  position: string;
  team: string;
  age: number;
  tier: 'Elite' | 'Tier1' | 'Tier2' | 'Tier3' | 'Tier4' | 'Tier5';
  tierDescription: string;
  dynastyScore: number;
  strengths: string[];
  concerns: string[];
}

// Tier 1: Elite Dynasty Assets (95-100 score)
export const TIER_1_ELITE: TierPlayer[] = [
  {
    name: "Ja'Marr Chase",
    position: "WR",
    team: "CIN",
    age: 25,
    tier: "Elite",
    tierDescription: "Generational talent, peak age, elite offense",
    dynastyScore: 100,
    strengths: ["Elite YAC ability", "Perfect age (25)", "Burrow connection", "Proven WR1"],
    concerns: ["None significant"]
  },
  {
    name: "CeeDee Lamb", 
    position: "WR",
    team: "DAL",
    age: 26,
    tier: "Elite",
    tierDescription: "Elite production, entering prime",
    dynastyScore: 98,
    strengths: ["Massive target share", "Elite route running", "QB proof", "Prime age"],
    concerns: ["Team offensive changes"]
  },
  {
    name: "Puka Nacua",
    position: "WR", 
    team: "LAR",
    age: 24,
    tier: "Elite",
    tierDescription: "Record-breaking rookie, young age",
    dynastyScore: 96,
    strengths: ["Historic rookie season", "Perfect age", "Slot/outside versatility"],
    concerns: ["Sophomore slump risk", "Target competition"]
  },
  {
    name: "Justin Jefferson",
    position: "WR",
    team: "MIN", 
    age: 26,
    tier: "Elite",
    tierDescription: "Hall of Fame trajectory, proven elite",
    dynastyScore: 95,
    strengths: ["Elite metrics", "Route mastery", "Red zone usage", "Proven ceiling"],
    concerns: ["QB situation volatility"]
  }
];

// Tier 2: Premium Young Assets (85-94 score)
export const TIER_2_PREMIUM: TierPlayer[] = [
  {
    name: "Brian Thomas Jr.",
    position: "WR",
    team: "JAC", 
    age: 22,
    tier: "Tier1",
    tierDescription: "Elite rookie talent, perfect age",
    dynastyScore: 89,
    strengths: ["Elite college metrics", "Youth advantage", "No target competition"],
    concerns: ["Rookie uncertainty", "Team QB play"]
  },
  {
    name: "Amon-Ra St. Brown",
    position: "WR",
    team: "DET",
    age: 25,
    tier: "Tier1", 
    tierDescription: "Proven slot dominance, elite offense",
    dynastyScore: 88,
    strengths: ["Target hog potential", "Elite offense", "Consistent production"],
    concerns: ["Target share ceiling", "Injury history"]
  },
  {
    name: "Nico Collins",
    position: "WR",
    team: "HOU",
    age: 26,
    tier: "Tier1",
    tierDescription: "Breakout star, excellent situation",
    dynastyScore: 87,
    strengths: ["Massive target share", "Young QB connection", "Size advantage"],
    concerns: ["Injury concerns", "Competition for targets"]
  },
  {
    name: "Malik Nabers",
    position: "WR", 
    team: "NYG",
    age: 22,
    tier: "Tier1",
    tierDescription: "Elite rookie, volume opportunity",
    dynastyScore: 86,
    strengths: ["Elite college production", "Alpha role", "Youth"],
    concerns: ["QB play", "Offensive line issues"]
  }
];

// Tier 3: Solid Dynasty Assets (75-84 score)
export const TIER_3_SOLID: TierPlayer[] = [
  {
    name: "Drake London",
    position: "WR",
    team: "ATL",
    age: 23,
    tier: "Tier2",
    tierDescription: "Young alpha receiver, improving situation",
    dynastyScore: 84,
    strengths: ["Size and athleticism", "Target share", "Youth"],
    concerns: ["Efficiency metrics", "Team passing volume"]
  },
  {
    name: "Ladd McConkey",
    position: "WR",
    team: "LAC",
    age: 23,
    tier: "Tier2",
    tierDescription: "Slot specialist, elite QB",
    dynastyScore: 83,
    strengths: ["Elite route running", "Herbert connection", "Slot security"],
    concerns: ["Target ceiling", "Size limitations"]
  },
  {
    name: "Rashee Rice",
    position: "WR",
    team: "KC",
    age: 24,
    tier: "Tier2", 
    tierDescription: "Elite situation, proven production",
    dynastyScore: 82,
    strengths: ["Mahomes connection", "Target share growth", "Championship offense"],
    concerns: ["Legal issues", "Target competition"]
  },
  {
    name: "A.J. Brown",
    position: "WR",
    team: "PHI",
    age: 27,
    tier: "Tier2",
    tierDescription: "Elite talent, age concerns emerging",
    dynastyScore: 81,
    strengths: ["Proven WR1", "Elite offense", "Target share"],
    concerns: ["Age progression", "Injury history"]
  },
  {
    name: "Tee Higgins",
    position: "WR",
    team: "CIN", 
    age: 26,
    tier: "Tier2",
    tierDescription: "Proven WR2, contract uncertainty",
    dynastyScore: 80,
    strengths: ["Proven production", "Elite QB", "Red zone threat"],
    concerns: ["WR2 role ceiling", "Contract situation"]
  }
];

// Tier 4: Good Dynasty Assets (65-74 score)
export const TIER_4_GOOD: TierPlayer[] = [
  {
    name: "Tyreek Hill",
    position: "WR",
    team: "MIA",
    age: 30,
    tier: "Tier3",
    tierDescription: "Elite talent, age concerns",
    dynastyScore: 79,
    strengths: ["Elite speed", "Proven ceiling", "Target volume"],
    concerns: ["Age (30)", "Declining athleticism risk"]
  },
  {
    name: "Mike Evans",
    position: "WR",
    team: "TB",
    age: 31,
    tier: "Tier3", 
    tierDescription: "Consistent producer, aging",
    dynastyScore: 78,
    strengths: ["Red zone dominance", "Size advantage", "Consistent targets"],
    concerns: ["Age (31)", "Team transition"]
  },
  {
    name: "Garrett Wilson",
    position: "WR",
    team: "NYJ",
    age: 24,
    tier: "Tier3",
    tierDescription: "Elite talent, poor situation",
    dynastyScore: 77,
    strengths: ["Elite route running", "Youth", "Target volume"],
    concerns: ["QB play", "Offensive line", "Team dysfunction"]
  },
  {
    name: "Marvin Harrison Jr.",
    position: "WR",
    team: "ARI",
    age: 22,
    tier: "Tier3", 
    tierDescription: "Elite pedigree, developing situation",
    dynastyScore: 76,
    strengths: ["Elite college production", "Perfect age", "Route mastery"],
    concerns: ["Rookie adjustment", "Team offense"]
  }
];

// Tier 5: Depth Dynasty Assets (55-64 score)
export const TIER_5_DEPTH: TierPlayer[] = [
  {
    name: "Terry McLaurin",
    position: "WR",
    team: "WAS",
    age: 29,
    tier: "Tier4",
    tierDescription: "Proven talent, situation dependent",
    dynastyScore: 75,
    strengths: ["Route running", "Daniels connection", "Proven floor"],
    concerns: ["Age approaching 30", "Target competition"]
  },
  {
    name: "George Pickens",
    position: "WR", 
    team: "PIT",
    age: 23,
    tier: "Tier4",
    tierDescription: "Elite talent, behavioral concerns",
    dynastyScore: 74,
    strengths: ["Elite contested catches", "Youth", "Physical tools"],
    concerns: ["Attitude issues", "Target competition", "QB play"]
  },
  {
    name: "DeVonta Smith",
    position: "WR",
    team: "PHI",
    age: 26,
    tier: "Tier4",
    tierDescription: "Proven producer, WR2 role",
    dynastyScore: 73,
    strengths: ["Elite route running", "Good offense", "Reliable"],
    concerns: ["Size limitations", "WR2 ceiling", "Target share"]
  },
  {
    name: "Jaylen Waddle",
    position: "WR",
    team: "MIA",
    age: 26,
    tier: "Tier4",
    tierDescription: "Slot specialist, ceiling concerns",
    dynastyScore: 72,
    strengths: ["Slot mastery", "Speed", "Target volume"],
    concerns: ["Limited ceiling", "Injury history", "Team changes"]
  }
];

// Tier 6: Bench/Speculative Assets (45-54 score)
export const TIER_6_BENCH: TierPlayer[] = [
  {
    name: "Zay Flowers",
    position: "WR",
    team: "BAL",
    age: 24,
    tier: "Tier5",
    tierDescription: "Rising talent, run-heavy offense",
    dynastyScore: 71,
    strengths: ["Youth", "Target growth", "Speed"],
    concerns: ["Run-heavy offense", "Target ceiling", "Size"]
  },
  {
    name: "Courtland Sutton",
    position: "WR",
    team: "DEN", 
    age: 29,
    tier: "Tier5",
    tierDescription: "Aging veteran, situation dependent",
    dynastyScore: 62,
    strengths: ["Size", "Red zone threat", "Target volume"],
    concerns: ["Age (29)", "QB inconsistency", "Declining athleticism"]
  },
  {
    name: "Jameson Williams",
    position: "WR",
    team: "DET",
    age: 23,
    tier: "Tier5",
    tierDescription: "Boom/bust speed threat",
    dynastyScore: 60,
    strengths: ["Elite speed", "Youth", "Explosive plays"],
    concerns: ["Target share", "Route running", "Consistency"]
  },
  {
    name: "Xavier Worthy",
    position: "WR",
    team: "KC",
    age: 21,
    tier: "Tier5",
    tierDescription: "Young speed asset, limited role",
    dynastyScore: 58,
    strengths: ["Elite speed", "Perfect age", "Good situation"],
    concerns: ["Size limitations", "Route tree", "Target competition"]
  }
];

// Combine all tiers
export const ALL_DYNASTY_TIERS = [
  ...TIER_1_ELITE,
  ...TIER_2_PREMIUM, 
  ...TIER_3_SOLID,
  ...TIER_4_GOOD,
  ...TIER_5_DEPTH,
  ...TIER_6_BENCH
];

export function getPlayerTier(playerName: string): TierPlayer | undefined {
  return ALL_DYNASTY_TIERS.find(p => 
    p.name.toLowerCase() === playerName.toLowerCase() ||
    playerName.toLowerCase().includes(p.name.toLowerCase()) ||
    p.name.toLowerCase().includes(playerName.toLowerCase())
  );
}

export function getPlayersByTier(tier: string): TierPlayer[] {
  return ALL_DYNASTY_TIERS.filter(p => p.tier === tier);
}