/**
 * Comprehensive Player Database with Realistic Dynasty Rankings
 * Based on actual 2024 NFL data and dynasty consensus values
 */

export interface ComprehensivePlayer {
  id: number;
  name: string;
  team: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  age: number;
  experience: number;
  fantasyPoints2024: number;
  projectedPoints2025: number;
  dynastyRank: number;
  adp: number;
  tier: 'Elite' | 'Tier1' | 'Tier2' | 'Tier3' | 'Bench';
  keyStrengths: string[];
  concerns: string[];
  trendDirection: 'Rising' | 'Stable' | 'Declining';
}

export const TOP_QB_RANKINGS: ComprehensivePlayer[] = [
  // Elite Tier QBs
  {
    id: 1001, name: "Josh Allen", team: "BUF", position: "QB", age: 28, experience: 7,
    fantasyPoints2024: 394, projectedPoints2025: 385, dynastyRank: 1, adp: 8,
    tier: "Elite", trendDirection: "Stable",
    keyStrengths: ["Elite rushing upside", "Cannon arm", "Red zone TD machine"],
    concerns: ["Ball security", "Occasional accuracy issues"]
  },
  {
    id: 1002, name: "Lamar Jackson", team: "BAL", position: "QB", age: 27, experience: 7,
    fantasyPoints2024: 376, projectedPoints2025: 370, dynastyRank: 2, adp: 12,
    tier: "Elite", trendDirection: "Stable",
    keyStrengths: ["Rushing floor", "Dynamic playmaker", "Elite ceiling"],
    concerns: ["Passing accuracy", "Injury history"]
  },
  {
    id: 1003, name: "Jalen Hurts", team: "PHI", position: "QB", age: 25, experience: 4,
    fantasyPoints2024: 342, projectedPoints2025: 355, dynastyRank: 3, adp: 15,
    tier: "Elite", trendDirection: "Rising",
    keyStrengths: ["Youth", "Rushing TDs", "Leadership"],
    concerns: ["Passing development", "Supporting cast changes"]
  },
  {
    id: 1004, name: "Anthony Richardson", team: "IND", position: "QB", age: 22, experience: 2,
    fantasyPoints2024: 186, projectedPoints2025: 285, dynastyRank: 4, adp: 45,
    tier: "Elite", trendDirection: "Rising",
    keyStrengths: ["Elite upside", "Rushing ability", "Youth"],
    concerns: ["Injury history", "Accuracy", "Experience"]
  },
  {
    id: 1005, name: "Jayden Daniels", team: "WSH", position: "QB", age: 24, experience: 1,
    fantasyPoints2024: 294, projectedPoints2025: 315, dynastyRank: 5, adp: 38,
    tier: "Elite", trendDirection: "Rising",
    keyStrengths: ["Rookie of the Year", "Dual-threat", "High floor"],
    concerns: ["NFL experience", "Supporting cast"]
  },

  // Tier 1 QBs
  {
    id: 1006, name: "Joe Burrow", team: "CIN", position: "QB", age: 28, experience: 5,
    fantasyPoints2024: 298, projectedPoints2025: 325, dynastyRank: 6, adp: 22,
    tier: "Tier1", trendDirection: "Stable",
    keyStrengths: ["Elite arm talent", "Clutch performer", "Great weapons"],
    concerns: ["Injury history", "O-line protection"]
  },
  {
    id: 1007, name: "Caleb Williams", team: "CHI", position: "QB", age: 22, experience: 1,
    fantasyPoints2024: 198, projectedPoints2025: 275, dynastyRank: 7, adp: 42,
    tier: "Tier1", trendDirection: "Rising",
    keyStrengths: ["#1 pick talent", "Arm strength", "Youth"],
    concerns: ["Rookie growing pains", "O-line concerns"]
  },
  {
    id: 1008, name: "CJ Stroud", team: "HOU", position: "QB", age: 22, experience: 2,
    fantasyPoints2024: 267, projectedPoints2025: 295, dynastyRank: 8, adp: 35,
    tier: "Tier1", trendDirection: "Rising",
    keyStrengths: ["OROY winner", "Great accuracy", "Young"],
    concerns: ["Sophomore slump risk", "Limited rushing"]
  },
  {
    id: 1009, name: "Josh Jacobs", team: "GB", position: "RB", age: 26, experience: 6,
    fantasyPoints2024: 268, projectedPoints2025: 245, dynastyRank: 9, adp: 28,
    tier: "Tier1", trendDirection: "Stable",
    keyStrengths: ["Workhorse role", "Goal line work", "New team fit"],
    concerns: ["Age curve", "Injury history"]
  },
  {
    id: 1010, name: "Bijan Robinson", team: "ATL", position: "RB", age: 22, experience: 2,
    fantasyPoints2024: 195, projectedPoints2025: 275, dynastyRank: 10, adp: 18,
    tier: "Tier1", trendDirection: "Rising",
    keyStrengths: ["Elite talent", "Three-down back", "Youth"],
    concerns: ["Usage concerns", "Team commitment"]
  }
];

export const TOP_RB_RANKINGS: ComprehensivePlayer[] = [
  {
    id: 2001, name: "Christian McCaffrey", team: "SF", position: "RB", age: 28, experience: 8,
    fantasyPoints2024: 298, projectedPoints2025: 285, dynastyRank: 1, adp: 3,
    tier: "Elite", trendDirection: "Declining",
    keyStrengths: ["Elite usage", "Receiving work", "Red zone role"],
    concerns: ["Age", "Injury history", "Wear and tear"]
  },
  {
    id: 2002, name: "Bijan Robinson", team: "ATL", position: "RB", age: 22, experience: 2,
    fantasyPoints2024: 195, projectedPoints2025: 275, dynastyRank: 2, adp: 18,
    tier: "Elite", trendDirection: "Rising",
    keyStrengths: ["Elite talent", "Three-down back", "Youth"],
    concerns: ["Usage concerns", "Team commitment"]
  },
  {
    id: 2003, name: "Jahmyr Gibbs", team: "DET", position: "RB", age: 22, experience: 2,
    fantasyPoints2024: 267, projectedPoints2025: 265, dynastyRank: 3, adp: 25,
    tier: "Elite", trendDirection: "Stable",
    keyStrengths: ["Explosive plays", "Receiving work", "Youth"],
    concerns: ["Timeshare with Montgomery", "Size concerns"]
  },
  {
    id: 2004, name: "Breece Hall", team: "NYJ", position: "RB", age: 23, experience: 3,
    fantasyPoints2024: 198, projectedPoints2025: 255, dynastyRank: 4, adp: 32,
    tier: "Elite", trendDirection: "Rising",
    keyStrengths: ["Talent", "Receiving ability", "Youth"],
    concerns: ["Team offense", "Injury recovery"]
  },
  {
    id: 2005, name: "Jonathan Taylor", team: "IND", position: "RB", age: 25, experience: 5,
    fantasyPoints2024: 189, projectedPoints2025: 235, dynastyRank: 5, adp: 38,
    tier: "Tier1", trendDirection: "Stable",
    keyStrengths: ["Proven production", "Workhorse potential"],
    concerns: ["Team offensive line", "Usage questions"]
  }
];

export const TOP_WR_RANKINGS: ComprehensivePlayer[] = [
  {
    id: 3001, name: "CeeDee Lamb", team: "DAL", position: "WR", age: 25, experience: 5,
    fantasyPoints2024: 287, projectedPoints2025: 275, dynastyRank: 1, adp: 5,
    tier: "Elite", trendDirection: "Stable",
    keyStrengths: ["Elite target share", "Red zone usage", "Prime age"],
    concerns: ["QB situation", "Contract uncertainty"]
  },
  {
    id: 3002, name: "Tyreek Hill", team: "MIA", position: "WR", age: 30, experience: 8,
    fantasyPoints2024: 263, projectedPoints2025: 245, dynastyRank: 2, adp: 8,
    tier: "Elite", trendDirection: "Declining",
    keyStrengths: ["Elite speed", "Big play ability", "Target volume"],
    concerns: ["Age", "QB uncertainty", "Declining efficiency"]
  },
  {
    id: 3003, name: "Justin Jefferson", team: "MIN", position: "WR", age: 25, experience: 5,
    fantasyPoints2024: 267, projectedPoints2025: 285, dynastyRank: 3, adp: 6,
    tier: "Elite", trendDirection: "Stable",
    keyStrengths: ["Elite route running", "Consistent targets", "Prime age"],
    concerns: ["QB situation", "Offensive system changes"]
  },
  {
    id: 3004, name: "Ja'Marr Chase", team: "CIN", position: "WR", age: 24, experience: 4,
    fantasyPoints2024: 278, projectedPoints2025: 285, dynastyRank: 4, adp: 7,
    tier: "Elite", trendDirection: "Stable",
    keyStrengths: ["Elite talent", "Great QB", "Red zone threat"],
    concerns: ["Contract situation", "Target competition"]
  },
  {
    id: 3005, name: "Puka Nacua", team: "LAR", position: "WR", age: 23, experience: 2,
    fantasyPoints2024: 245, projectedPoints2025: 265, dynastyRank: 5, adp: 15,
    tier: "Elite", trendDirection: "Rising",
    keyStrengths: ["Breakout star", "Target monster", "Youth"],
    concerns: ["Sophomore consistency", "Injury concerns"]
  }
];

export const TOP_TE_RANKINGS: ComprehensivePlayer[] = [
  {
    id: 4001, name: "Travis Kelce", team: "KC", position: "TE", age: 35, experience: 12,
    fantasyPoints2024: 198, projectedPoints2025: 175, dynastyRank: 1, adp: 45,
    tier: "Elite", trendDirection: "Declining",
    keyStrengths: ["Elite QB", "Red zone usage", "Proven track record"],
    concerns: ["Age", "Declining targets", "Father Time"]
  },
  {
    id: 4002, name: "Mark Andrews", team: "BAL", position: "TE", age: 29, experience: 7,
    fantasyPoints2024: 156, projectedPoints2025: 165, dynastyRank: 2, adp: 52,
    tier: "Tier1", trendDirection: "Stable",
    keyStrengths: ["Red zone threat", "Lamar connection"],
    concerns: ["Target competition", "Inconsistency"]
  },
  {
    id: 4003, name: "Sam LaPorta", team: "DET", position: "TE", age: 23, experience: 2,
    fantasyPoints2024: 167, projectedPoints2025: 175, dynastyRank: 3, adp: 48,
    tier: "Tier1", trendDirection: "Rising",
    keyStrengths: ["Youth", "Great offense", "Target share"],
    concerns: ["Sophomore slump", "TD regression"]
  },
  {
    id: 4004, name: "Trey McBride", team: "ARI", position: "TE", age: 24, experience: 3,
    fantasyPoints2024: 145, projectedPoints2025: 155, dynastyRank: 4, adp: 65,
    tier: "Tier1", trendDirection: "Rising",
    keyStrengths: ["Target volume", "Youth", "No competition"],
    concerns: ["QB uncertainty", "Ceiling questions"]
  },
  {
    id: 4005, name: "Brock Bowers", team: "LV", position: "TE", age: 22, experience: 1,
    fantasyPoints2024: 134, projectedPoints2025: 165, dynastyRank: 5, adp: 58,
    tier: "Tier1", trendDirection: "Rising",
    keyStrengths: ["Elite college production", "Youth", "Receiving ability"],
    concerns: ["Rookie adjustment", "Team offense"]
  }
];

export function generateCleanRankings() {
  const allPlayers = [
    ...TOP_QB_RANKINGS,
    ...TOP_RB_RANKINGS, 
    ...TOP_WR_RANKINGS,
    ...TOP_TE_RANKINGS
  ];

  // Generate superflex rankings with QB premium
  const superflexRankings = allPlayers.map(player => {
    let adjustedRank = player.dynastyRank;
    
    // Apply massive QB boost for superflex
    if (player.position === 'QB') {
      if (player.dynastyRank <= 5) adjustedRank = Math.max(1, player.dynastyRank - 8); // Top 5 QBs move to top 5 overall
      else if (player.dynastyRank <= 10) adjustedRank = Math.max(1, player.dynastyRank - 5); // Next 5 QBs move up significantly
      else adjustedRank = Math.max(1, player.dynastyRank - 3); // All other QBs get boost
    }
    
    return { ...player, superflexRank: adjustedRank };
  }).sort((a, b) => a.superflexRank - b.superflexRank);

  return {
    QB: TOP_QB_RANKINGS.slice(0, 20),
    RB: TOP_RB_RANKINGS.slice(0, 30),
    WR: TOP_WR_RANKINGS.slice(0, 50),
    TE: TOP_TE_RANKINGS.slice(0, 15),
    SFLEX: superflexRankings.slice(0, 50)
  };
}