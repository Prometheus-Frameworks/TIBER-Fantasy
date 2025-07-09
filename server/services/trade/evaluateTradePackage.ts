export interface Player {
  name: string;
  tier: 'Bench' | 'Depth' | 'Solid' | 'Strong' | 'Premium' | 'Elite';
  value: number;
  positionRank: number;
  isStarter: boolean;
  position?: string;
  age?: number;
  dynastyValue?: number;
}

export interface TradePackage {
  teamA: Player[];
  teamB: Player[];
}

export interface TradeVerdict {
  winner: 'Team A' | 'Team B' | 'Fair Trade';
  confidence: number;
  valueDifference: number;
  teamATotal: number;
  teamBTotal: number;
  analysis: {
    teamA: TradeAnalysis;
    teamB: TradeAnalysis;
  };
  recommendations: string[];
}

export interface TradeAnalysis {
  totalValue: number;
  starterValue: number;
  benchValue: number;
  averageAge: number;
  tierBreakdown: Record<string, number>;
  strengthAreas: string[];
  concerns: string[];
}

const TIER_VALUES = {
  'Elite': 100,
  'Premium': 85,
  'Strong': 70,
  'Solid': 55,
  'Depth': 40,
  'Bench': 25
};

const STARTER_MULTIPLIER = 1.3;
const AGE_PENALTY_THRESHOLD = 29;
const AGE_PENALTY_PER_YEAR = 2;

export function evaluateTradePackage({ teamA, teamB }: TradePackage): TradeVerdict {
  const analysisA = analyzeTeam(teamA, 'Team A');
  const analysisB = analyzeTeam(teamB, 'Team B');
  
  const valueDifference = analysisA.totalValue - analysisB.totalValue;
  const absValueDiff = Math.abs(valueDifference);
  
  let winner: 'Team A' | 'Team B' | 'Fair Trade';
  let confidence: number;
  
  if (absValueDiff < 5) {
    winner = 'Fair Trade';
    confidence = 95 - absValueDiff;
  } else if (valueDifference > 0) {
    winner = 'Team A';
    confidence = Math.min(95, 60 + (absValueDiff * 2));
  } else {
    winner = 'Team B';
    confidence = Math.min(95, 60 + (absValueDiff * 2));
  }
  
  const recommendations = generateRecommendations(analysisA, analysisB, winner);
  
  return {
    winner,
    confidence,
    valueDifference,
    teamATotal: analysisA.totalValue,
    teamBTotal: analysisB.totalValue,
    analysis: {
      teamA: analysisA,
      teamB: analysisB
    },
    recommendations
  };
}

function analyzeTeam(players: Player[], teamName: string): TradeAnalysis {
  let totalValue = 0;
  let starterValue = 0;
  let benchValue = 0;
  let totalAge = 0;
  let ageCount = 0;
  
  const tierBreakdown: Record<string, number> = {
    'Elite': 0,
    'Premium': 0,
    'Strong': 0,
    'Solid': 0,
    'Depth': 0,
    'Bench': 0
  };
  
  players.forEach(player => {
    let playerValue = TIER_VALUES[player.tier] || player.value || 0;
    
    // Apply age penalty for older players
    if (player.age && player.age > AGE_PENALTY_THRESHOLD) {
      const penalty = (player.age - AGE_PENALTY_THRESHOLD) * AGE_PENALTY_PER_YEAR;
      playerValue = Math.max(0, playerValue - penalty);
    }
    
    // Apply starter bonus
    if (player.isStarter) {
      playerValue *= STARTER_MULTIPLIER;
      starterValue += playerValue;
    } else {
      benchValue += playerValue;
    }
    
    totalValue += playerValue;
    tierBreakdown[player.tier]++;
    
    if (player.age) {
      totalAge += player.age;
      ageCount++;
    }
  });
  
  const averageAge = ageCount > 0 ? totalAge / ageCount : 0;
  
  const strengthAreas = identifyStrengths(players, tierBreakdown);
  const concerns = identifyConcerns(players, averageAge, tierBreakdown);
  
  return {
    totalValue: Math.round(totalValue),
    starterValue: Math.round(starterValue),
    benchValue: Math.round(benchValue),
    averageAge: Math.round(averageAge * 10) / 10,
    tierBreakdown,
    strengthAreas,
    concerns
  };
}

function identifyStrengths(players: Player[], tierBreakdown: Record<string, number>): string[] {
  const strengths: string[] = [];
  
  if (tierBreakdown.Elite >= 2) {
    strengths.push('Multiple elite assets');
  }
  
  if (tierBreakdown.Premium + tierBreakdown.Elite >= 3) {
    strengths.push('Strong core players');
  }
  
  const youngStarters = players.filter(p => p.isStarter && p.age && p.age < 26).length;
  if (youngStarters >= 2) {
    strengths.push('Young starter foundation');
  }
  
  const depthCount = players.filter(p => !p.isStarter).length;
  if (depthCount >= 3) {
    strengths.push('Good depth pieces');
  }
  
  return strengths;
}

function identifyConcerns(players: Player[], averageAge: number, tierBreakdown: Record<string, number>): string[] {
  const concerns: string[] = [];
  
  if (averageAge > 28) {
    concerns.push('Aging roster concerns');
  }
  
  if (tierBreakdown.Bench + tierBreakdown.Depth > players.length * 0.6) {
    concerns.push('Limited high-end talent');
  }
  
  const oldStarters = players.filter(p => p.isStarter && p.age && p.age > 30).length;
  if (oldStarters >= 2) {
    concerns.push('Multiple aging starters');
  }
  
  if (players.length > 4 && tierBreakdown.Elite === 0) {
    concerns.push('No true elite players');
  }
  
  return concerns;
}

function generateRecommendations(
  teamA: TradeAnalysis, 
  teamB: TradeAnalysis, 
  winner: string
): string[] {
  const recommendations: string[] = [];
  
  if (winner === 'Fair Trade') {
    recommendations.push('This appears to be a balanced trade with similar overall value');
    
    if (teamA.averageAge < teamB.averageAge - 2) {
      recommendations.push('Team A gets younger players, Team B gets more immediate production');
    } else if (teamB.averageAge < teamA.averageAge - 2) {
      recommendations.push('Team B gets younger players, Team A gets more immediate production');
    }
  } else {
    const winningTeam = winner === 'Team A' ? teamA : teamB;
    const losingTeam = winner === 'Team A' ? teamB : teamA;
    
    recommendations.push(`${winner} appears to get better overall value in this trade`);
    
    if (winningTeam.starterValue > losingTeam.starterValue * 1.2) {
      recommendations.push(`${winner} significantly improves their starting lineup`);
    }
    
    if (losingTeam.averageAge > winningTeam.averageAge + 3) {
      recommendations.push('The losing side is trading away youth for aging veterans');
    }
  }
  
  // Position-specific recommendations could be added here with more position data
  
  return recommendations;
}