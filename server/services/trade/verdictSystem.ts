interface PlayerProfile {
  anchorPlayer?: boolean;
  [key: string]: any;
}

interface TradeEvaluationConfig {
  evenTradeThreshold: number;
  minContributionRatio: number;
  verdictStrengthThresholds: {
    slightEdge: number;
    moderateWin: number;
    strongWin: number;
  };
  anchorPenaltyMultiplier: number; // New
}

interface TradeVerdict {
  outcome: string;
  tag: string;
  recommendation: string;
  strength: 'Even' | 'Slight Edge' | 'Moderate Win' | 'Strong Win';
  confidenceScore: number;
  justificationLog: string[];
  isLopsided?: boolean;
}

const TRADE_CONFIG: TradeEvaluationConfig = {
  evenTradeThreshold: 50,
  minContributionRatio: 0.1,
  verdictStrengthThresholds: {
    slightEdge: 10,
    moderateWin: 25,
    strongWin: 40,
  },
  anchorPenaltyMultiplier: 1.15,
};

const calculateTradeBalanceIndex = (teamAScore: number, teamBScore: number): number => {
  const totalScore = teamAScore + teamBScore;
  if (totalScore <= 0) return 0;
  const maxScore = Math.max(teamAScore, teamBScore);
  const minScore = Math.min(teamAScore, teamBScore);
  return Math.round(((maxScore - minScore) / totalScore) * 100);
};

const checkLopsidedTrade = (
  teamAScore: number,
  teamBScore: number,
  config: TradeEvaluationConfig
): { isLopsided: boolean; lowContributionTeam?: string; contributionPercent?: number } => {
  const totalScore = teamAScore + teamBScore;
  if (totalScore <= 0) return { isLopsided: false };
  const teamAContribution = teamAScore / totalScore;
  const teamBContribution = teamBScore / totalScore;
  if (teamAContribution < config.minContributionRatio) {
    return { isLopsided: true, lowContributionTeam: 'Team A', contributionPercent: Math.round(teamAContribution * 100) };
  }
  if (teamBContribution < config.minContributionRatio) {
    return { isLopsided: true, lowContributionTeam: 'Team B', contributionPercent: Math.round(teamBContribution * 100) };
  }
  return { isLopsided: false };
};

const determineVerdictStrength = (balanceIndex: number, config: TradeEvaluationConfig): TradeVerdict['strength'] => {
  const { slightEdge, moderateWin, strongWin } = config.verdictStrengthThresholds;
  if (balanceIndex >= strongWin) return 'Strong Win';
  if (balanceIndex >= moderateWin) return 'Moderate Win';
  if (balanceIndex >= slightEdge) return 'Slight Edge';
  return 'Even';
};

const calculateConfidenceScore = (balanceIndex: number): number => {
  return Math.min(balanceIndex * 2, 100);
};

// New helper function for anchor player penalty
const applyAnchorPenalty = (
  teamAScore: number,
  teamBScore: number,
  teamAHasAnchor: boolean,
  teamBHasAnchor: boolean,
  config: TradeEvaluationConfig
): { adjustedTeamAScore: number; adjustedTeamBScore: number; anchorLog: string[] } => {
  let adjustedTeamAScore = teamAScore;
  let adjustedTeamBScore = teamBScore;
  const anchorLog: string[] = [];

  if (teamAHasAnchor) {
    adjustedTeamAScore *= config.anchorPenaltyMultiplier;
    anchorLog.push(`Team A includes anchor player, requiring ${config.anchorPenaltyMultiplier}x value`);
  }
  if (teamBHasAnchor) {
    adjustedTeamBScore *= config.anchorPenaltyMultiplier;
    anchorLog.push(`Team B includes anchor player, requiring ${config.anchorPenaltyMultiplier}x value`);
  }

  return { adjustedTeamAScore, adjustedTeamBScore, anchorLog };
};

const determineTradeVerdict = (
  teamA: PlayerProfile[],
  teamB: PlayerProfile[],
  teamAScore: number,
  teamBScore: number,
  config: TradeEvaluationConfig = TRADE_CONFIG
): TradeVerdict => {
  // Check for anchor players
  const teamAHasAnchor = teamA.some(player => player.anchorPlayer);
  const teamBHasAnchor = teamB.some(player => player.anchorPlayer);

  // Apply anchor penalty if applicable
  const { adjustedTeamAScore, adjustedTeamBScore, anchorLog } = applyAnchorPenalty(
    teamAScore,
    teamBScore,
    teamAHasAnchor,
    teamBHasAnchor,
    config
  );

  // Use adjusted scores for calculations
  const balanceIndex = calculateTradeBalanceIndex(adjustedTeamAScore, adjustedTeamBScore);
  const { isLopsided, lowContributionTeam, contributionPercent } = checkLopsidedTrade(adjustedTeamAScore, adjustedTeamBScore, config);
  const justificationLog: string[] = [...anchorLog];
  const verdictStrength = determineVerdictStrength(balanceIndex, config);
  const confidenceScore = calculateConfidenceScore(balanceIndex);

  if (isLopsided && lowContributionTeam && contributionPercent !== undefined) {
    justificationLog.push(`${lowContributionTeam} contributes only ${contributionPercent}% of total value`);
    justificationLog.push(`Outcome classified as Lopsided Trade`);
    return {
      outcome: 'Lopsided Trade',
      tag: '⚠️ Potential Throw-In',
      recommendation:
        'One team contributes less than 10% of total value. Consider balancing the trade or confirming intent.',
      strength: verdictStrength,
      confidenceScore,
      justificationLog,
      isLopsided: true,
    };
  }

  if (balanceIndex < config.evenTradeThreshold) {
    justificationLog.push(`Trade balance index: ${balanceIndex}% (below fair threshold)`);
    justificationLog.push(`Outcome classified as Even`);
    return {
      outcome: 'Even',
      tag: '✅ Fair Trade',
      recommendation: 'Trade is balanced. Slight edges may depend on team needs or league format.',
      strength: verdictStrength,
      confidenceScore,
      justificationLog,
    };
  }

  const winningTeam = adjustedTeamAScore > adjustedTeamBScore ? 'Team A' : 'Team B';
  const losingTeam = adjustedTeamAScore > adjustedTeamBScore ? 'Team B' : 'Team A';
  justificationLog.push(`Trade balance index: ${balanceIndex}% (above fair threshold)`);
  justificationLog.push(`Outcome classified as ${verdictStrength} for ${winningTeam}`);
  return {
    outcome: `${winningTeam} wins`,
    tag: '🔥 Overpay Detected',
    recommendation: `${losingTeam} is giving up more value. Consider adding an elite asset or adjusting low-impact players.`,
    strength: verdictStrength,
    confidenceScore,
    justificationLog,
  };
};

export { TradeVerdict, TradeEvaluationConfig, PlayerProfile, determineTradeVerdict, calculateTradeBalanceIndex, TRADE_CONFIG };