/**
 * Ranking Validation System
 * Compares our dynasty values against ECR and ADP to ensure realistic rankings
 */

// Expert Consensus Rankings (ECR) from FantasyPros - 2024 Dynasty Rankings
export const ECR_DYNASTY_RANKINGS = {
  QB: [
    { name: "Josh Allen", rank: 1, tier: "Elite" },
    { name: "Lamar Jackson", rank: 2, tier: "Elite" },
    { name: "Justin Herbert", rank: 3, tier: "Premium" },
    { name: "Joe Burrow", rank: 4, tier: "Premium" },
    { name: "Anthony Richardson", rank: 5, tier: "Premium" },
    { name: "Caleb Williams", rank: 6, tier: "Premium" },
    { name: "Jayden Daniels", rank: 7, tier: "Premium" },
    { name: "C.J. Stroud", rank: 8, tier: "Premium" },
    { name: "Jalen Hurts", rank: 9, tier: "Strong" },
    { name: "Dak Prescott", rank: 10, tier: "Strong" },
    { name: "Tua Tagovailoa", rank: 11, tier: "Strong" },
    { name: "Jordan Love", rank: 12, tier: "Strong" },
    { name: "Bo Nix", rank: 13, tier: "Solid" },
    { name: "Drake Maye", rank: 14, tier: "Solid" },
    { name: "Brock Purdy", rank: 15, tier: "Solid" },
    // Below this line: Depth tier players
    { name: "Baker Mayfield", rank: 16, tier: "Depth" },
    { name: "Geno Smith", rank: 17, tier: "Depth" },
    { name: "Sam Darnold", rank: 18, tier: "Depth" },
    { name: "Russell Wilson", rank: 19, tier: "Depth" },
    { name: "Kirk Cousins", rank: 20, tier: "Depth" },
    // Bench tier - aging/backup QBs
    { name: "Aaron Rodgers", rank: 21, tier: "Bench" },
    { name: "Daniel Jones", rank: 22, tier: "Bench" },
    { name: "Deshaun Watson", rank: 23, tier: "Bench" },
  ],
  RB: [
    { name: "Bijan Robinson", rank: 1, tier: "Elite" },
    { name: "Breece Hall", rank: 2, tier: "Elite" },
    { name: "Jahmyr Gibbs", rank: 3, tier: "Elite" },
    { name: "Jonathan Taylor", rank: 4, tier: "Premium" },
    { name: "Saquon Barkley", rank: 5, tier: "Premium" },
    { name: "Kenneth Walker III", rank: 6, tier: "Premium" },
    { name: "Kyren Williams", rank: 7, tier: "Premium" },
    { name: "De'Von Achane", rank: 8, tier: "Premium" },
    { name: "Josh Jacobs", rank: 9, tier: "Strong" },
    { name: "Derrick Henry", rank: 10, tier: "Strong" },
    { name: "Alvin Kamara", rank: 11, tier: "Strong" },
    { name: "Joe Mixon", rank: 12, tier: "Strong" },
    { name: "James Cook", rank: 13, tier: "Solid" },
    { name: "Rachaad White", rank: 14, tier: "Solid" },
    { name: "Travis Etienne Jr.", rank: 15, tier: "Solid" },
    // Depth tier
    { name: "Rhamondre Stevenson", rank: 16, tier: "Depth" },
    { name: "Tony Pollard", rank: 17, tier: "Depth" },
    { name: "David Montgomery", rank: 18, tier: "Depth" },
    { name: "Aaron Jones", rank: 19, tier: "Depth" },
    { name: "Najee Harris", rank: 20, tier: "Depth" },
    // Bench tier - aging/backup RBs
    { name: "Ezekiel Elliott", rank: 21, tier: "Bench" },
    { name: "Kareem Hunt", rank: 22, tier: "Bench" },  // Should be ~30-40 dynasty score
    { name: "Miles Sanders", rank: 23, tier: "Bench" },
    { name: "Samaje Perine", rank: 24, tier: "Bench" }, // Should be ~25-35 dynasty score
    { name: "Dare Ogunbowale", rank: 25, tier: "Bench" }, // Should be ~20-30 dynasty score
  ],
  WR: [
    { name: "CeeDee Lamb", rank: 1, tier: "Elite" },
    { name: "Justin Jefferson", rank: 2, tier: "Elite" },
    { name: "Ja'Marr Chase", rank: 3, tier: "Elite" },
    { name: "Tyreek Hill", rank: 4, tier: "Premium" },
    { name: "A.J. Brown", rank: 5, tier: "Premium" },
    { name: "Amon-Ra St. Brown", rank: 6, tier: "Premium" },
    { name: "Puka Nacua", rank: 7, tier: "Premium" },
    { name: "Davante Adams", rank: 8, tier: "Premium" },
    { name: "DK Metcalf", rank: 9, tier: "Strong" },
    { name: "DeVonta Smith", rank: 10, tier: "Strong" },
    { name: "Mike Evans", rank: 11, tier: "Strong" },
    { name: "Chris Olave", rank: 12, tier: "Strong" },
    { name: "Stefon Diggs", rank: 13, tier: "Strong" },
    { name: "Drake London", rank: 14, tier: "Solid" },
    { name: "Garrett Wilson", rank: 15, tier: "Solid" },
    // Depth tier
    { name: "DJ Moore", rank: 16, tier: "Depth" },
    { name: "Jaylen Waddle", rank: 17, tier: "Depth" },
    { name: "Terry McLaurin", rank: 18, tier: "Depth" },
    { name: "Amari Cooper", rank: 19, tier: "Depth" },
    { name: "Cooper Kupp", rank: 20, tier: "Depth" },
    // Bench tier
    { name: "Mike Williams", rank: 21, tier: "Bench" },
    { name: "Curtis Samuel", rank: 22, tier: "Bench" },
    { name: "Chris Godwin", rank: 23, tier: "Bench" },
    { name: "Anthony Miller", rank: 24, tier: "Bench" },
    { name: "Justin Watson", rank: 25, tier: "Bench" },
  ],
  TE: [
    { name: "Travis Kelce", rank: 1, tier: "Elite" },
    { name: "Mark Andrews", rank: 2, tier: "Premium" },
    { name: "George Kittle", rank: 3, tier: "Premium" },
    { name: "Sam LaPorta", rank: 4, tier: "Premium" },
    { name: "Kyle Pitts", rank: 5, tier: "Strong" },
    { name: "Trey McBride", rank: 6, tier: "Strong" },
    { name: "Evan Engram", rank: 7, tier: "Strong" },
    { name: "David Njoku", rank: 8, tier: "Solid" },
    { name: "Jake Ferguson", rank: 9, tier: "Solid" },
    { name: "Dalton Kincaid", rank: 10, tier: "Solid" },
    // Depth tier
    { name: "Tyler Higbee", rank: 11, tier: "Depth" },
    { name: "Hunter Henry", rank: 12, tier: "Depth" },
    { name: "Noah Fant", rank: 13, tier: "Depth" },
    { name: "Pat Freiermuth", rank: 14, tier: "Depth" },
    { name: "Jonnu Smith", rank: 15, tier: "Depth" },
    // Bench tier
    { name: "Gerald Everett", rank: 16, tier: "Bench" },
    { name: "Mike Gesicki", rank: 17, tier: "Bench" },
    { name: "Zach Ertz", rank: 18, tier: "Bench" },
  ]
};

// Realistic ADP ranges for dynasty rankings validation
export const ADP_VALIDATION = {
  Elite: { min: 85, max: 100 },      // Top 15 overall picks
  Premium: { min: 70, max: 89 },    // Round 2-3 picks  
  Strong: { min: 55, max: 74 },     // Round 4-6 picks
  Solid: { min: 40, max: 59 },      // Round 7-10 picks
  Depth: { min: 25, max: 44 },      // Round 11-15 picks
  Bench: { min: 0, max: 29 }        // Undrafted/waiver wire
};

export function validatePlayerRanking(playerName: string, position: string, currentScore: number): {
  isValid: boolean;
  suggestedScore: number;
  suggestedTier: string;
  reason: string;
} {
  const positionRankings = ECR_DYNASTY_RANKINGS[position as keyof typeof ECR_DYNASTY_RANKINGS];
  if (!positionRankings) {
    return {
      isValid: false,
      suggestedScore: 25,
      suggestedTier: "Bench",
      reason: "Invalid position"
    };
  }

  const playerRanking = positionRankings.find(p => 
    p.name.toLowerCase() === playerName.toLowerCase()
  );

  if (playerRanking) {
    // Player found in ECR rankings
    const tierRange = ADP_VALIDATION[playerRanking.tier as keyof typeof ADP_VALIDATION];
    const suggestedScore = Math.round((tierRange.min + tierRange.max) / 2);
    
    return {
      isValid: Math.abs(currentScore - suggestedScore) <= 10,
      suggestedScore,
      suggestedTier: playerRanking.tier,
      reason: `ECR Rank ${playerRanking.rank} ${position}, should be ${playerRanking.tier} tier`
    };
  } else {
    // Player not in top ECR rankings - should be Bench tier
    return {
      isValid: currentScore <= 35,
      suggestedScore: Math.min(currentScore, 30),
      suggestedTier: "Bench",
      reason: "Not in ECR top rankings, should be Bench tier with max 30 score"
    };
  }
}

export function getValidatedDynastyScore(playerName: string, position: string): {
  score: number;
  tier: string;
} {
  const validation = validatePlayerRanking(playerName, position, 0);
  return {
    score: validation.suggestedScore,
    tier: validation.suggestedTier
  };
}