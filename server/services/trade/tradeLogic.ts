import { determineTradeVerdict, TradeVerdict, calculateTradeBalanceIndex } from './verdictSystem';
import { applyRBValueDeRisker, PlayerProfile } from './rbValueDeRisker';

interface TradePlayer {
  id: string;
  name?: string;
  position?: string;
  prometheusScore: number;
  tier?: string;
  isStarter?: boolean;
  age?: number;
}

interface TradeInput {
  teamA: TradePlayer[];
  teamB: TradePlayer[];
}

interface TradeAnalysis {
  totalValue: number;
  starterValue: number;
  benchValue: number;
  averageAge: number;
  tierBreakdown: Record<string, number>;
  strengthAreas: string[];
  concerns: string[];
  playerDetails: Array<{
    name: string;
    adjustedValue: number;
    originalValue: number;
    adjustments: string[];
  }>;
}

interface TradeEvaluationResult {
  winner: string;
  confidence: number;
  valueDifference: number;
  teamATotal: number;
  teamBTotal: number;
  balanceIndex: number;
  verdict: TradeVerdict;
  analysis: {
    teamA: TradeAnalysis;
    teamB: TradeAnalysis;
  };
  recommendations: string[];
}

const TIER_VALUES = {
  'Elite': 35,
  'Premium': 25,
  'Strong': 15,
  'Solid': 5,
  'Depth': 0,
  'Bench': -5
};

const STARTER_BONUS = 5;
const AGE_PENALTY_THRESHOLD = 29;
const AGE_PENALTY_PER_YEAR = 2;

function applyRBDeRiskingToPlayer(player: TradePlayer): { adjustedValue: number; adjustments: string[] } {
  if (player.position !== 'RB') {
    return { adjustedValue: player.prometheusScore, adjustments: [] };
  }

  // Convert TradePlayer to PlayerProfile for RB de-risking
  const rbProfile: PlayerProfile = {
    age: player.age,
    // Note: For now, we'll apply basic age-based de-risking
    // In a full implementation, these would come from the database
    debugLog: []
  };

  const penalty = applyRBValueDeRisker(rbProfile);
  const adjustedValue = Math.max(0, player.prometheusScore + penalty);
  
  return {
    adjustedValue,
    adjustments: rbProfile.debugLog || []
  };
}

function calculateTeamValue(players: TradePlayer[]): TradeAnalysis {
  let totalValue = 0;
  let starterValue = 0;
  let benchValue = 0;
  let totalAge = 0;
  let playerCount = 0;
  
  const tierBreakdown: Record<string, number> = {
    'Elite': 0, 'Premium': 0, 'Strong': 0, 'Solid': 0, 'Depth': 0, 'Bench': 0
  };
  
  const strengthAreas: string[] = [];
  const concerns: string[] = [];
  const playerDetails: TradeAnalysis['playerDetails'] = [];

  for (const player of players) {
    let adjustedValue = player.prometheusScore;
    const adjustments: string[] = [];

    // Apply RB de-risking
    const { adjustedValue: rbAdjustedValue, adjustments: rbAdjustments } = applyRBDeRiskingToPlayer(player);
    adjustedValue = rbAdjustedValue;
    adjustments.push(...rbAdjustments);

    // Tier bonus
    if (player.tier && TIER_VALUES[player.tier] !== undefined) {
      const tierBonus = TIER_VALUES[player.tier];
      adjustedValue += tierBonus;
      if (tierBonus > 0) {
        adjustments.push(`+${tierBonus}: ${player.tier} tier bonus`);
      } else if (tierBonus < 0) {
        adjustments.push(`${tierBonus}: ${player.tier} tier penalty`);
      }
      tierBreakdown[player.tier]++;
    }

    // Starter bonus
    if (player.isStarter) {
      adjustedValue += STARTER_BONUS;
      starterValue += adjustedValue;
      adjustments.push(`+${STARTER_BONUS}: Starter bonus`);
    } else {
      benchValue += adjustedValue;
    }

    // Age penalty
    if (player.age && player.age > AGE_PENALTY_THRESHOLD) {
      const agePenalty = (player.age - AGE_PENALTY_THRESHOLD) * AGE_PENALTY_PER_YEAR;
      adjustedValue -= agePenalty;
      adjustments.push(`-${agePenalty}: Age penalty (${player.age} years old)`);
    }

    totalValue += adjustedValue;
    
    if (player.age) {
      totalAge += player.age;
      playerCount++;
    }

    playerDetails.push({
      name: player.name || player.id,
      adjustedValue,
      originalValue: player.prometheusScore,
      adjustments
    });
  }

  // Identify strengths and concerns
  if (tierBreakdown['Elite'] >= 2) {
    strengthAreas.push('Multiple elite assets');
  }
  if (starterValue > totalValue * 0.8) {
    strengthAreas.push('Strong starting lineup value');
  }
  if (playerCount > 0 && totalAge / playerCount < 26) {
    strengthAreas.push('Young core');
  }

  if (tierBreakdown['Bench'] + tierBreakdown['Depth'] > players.length * 0.5) {
    concerns.push('Too many low-tier players');
  }
  if (playerCount > 0 && totalAge / playerCount > 28) {
    concerns.push('Aging roster');
  }
  if (players.length > 3) {
    concerns.push('Quantity over quality');
  }

  return {
    totalValue: Math.round(totalValue),
    starterValue: Math.round(starterValue),
    benchValue: Math.round(benchValue),
    averageAge: playerCount > 0 ? Math.round(totalAge / playerCount * 10) / 10 : 0,
    tierBreakdown,
    strengthAreas,
    concerns,
    playerDetails
  };
}

function generateRecommendations(
  teamAAnalysis: TradeAnalysis,
  teamBAnalysis: TradeAnalysis,
  verdict: TradeVerdict
): string[] {
  const recommendations: string[] = [];

  if (verdict.isLopsided) {
    recommendations.push("This trade appears heavily one-sided. Consider adding more balanced value.");
    return recommendations;
  }

  if (verdict.outcome === 'Even') {
    recommendations.push("This appears to be a balanced trade with similar overall value");
    
    // Add context-specific recommendations
    if (teamAAnalysis.averageAge > teamBAnalysis.averageAge + 2) {
      recommendations.push("Team A is trading older players for younger assets - good dynasty strategy");
    }
    if (teamBAnalysis.averageAge > teamAAnalysis.averageAge + 2) {
      recommendations.push("Team B is trading older players for younger assets - good dynasty strategy");
    }
  } else {
    const winningTeam = verdict.outcome.includes('Team A') ? 'A' : 'B';
    const losingTeam = winningTeam === 'A' ? 'B' : 'A';
    
    recommendations.push(`Team ${winningTeam} receives better value in this trade`);
    
    if (verdict.strength === 'Strong Win') {
      recommendations.push(`Team ${losingTeam} should demand additional compensation`);
    } else if (verdict.strength === 'Moderate Win') {
      recommendations.push(`Consider adding a mid-tier asset to balance the trade`);
    }
  }

  return recommendations;
}

export function evaluateTradePackage(tradeInput: TradeInput): TradeEvaluationResult {
  const teamAAnalysis = calculateTeamValue(tradeInput.teamA);
  const teamBAnalysis = calculateTeamValue(tradeInput.teamB);
  
  const verdict = determineTradeVerdict(teamAAnalysis.totalValue, teamBAnalysis.totalValue);
  const balanceIndex = calculateTradeBalanceIndex(teamAAnalysis.totalValue, teamBAnalysis.totalValue);
  
  const recommendations = generateRecommendations(teamAAnalysis, teamBAnalysis, verdict);
  
  // Determine winner based on verdict
  let winner: string;
  if (verdict.outcome === 'Even' || verdict.isLopsided) {
    winner = verdict.outcome === 'Even' ? 'Fair Trade' : 'Lopsided Trade';
  } else {
    winner = verdict.outcome;
  }

  return {
    winner,
    confidence: verdict.confidenceScore,
    valueDifference: Math.abs(teamAAnalysis.totalValue - teamBAnalysis.totalValue),
    teamATotal: teamAAnalysis.totalValue,
    teamBTotal: teamBAnalysis.totalValue,
    balanceIndex,
    verdict,
    analysis: {
      teamA: teamAAnalysis,
      teamB: teamBAnalysis
    },
    recommendations
  };
}

export { TradeInput, TradePlayer, TradeEvaluationResult, TradeAnalysis };