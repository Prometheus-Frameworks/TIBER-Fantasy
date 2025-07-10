interface TradeEvaluationConfig {
  evenTradeThreshold: number;
  minContributionRatio: number;
  verdictStrengthThresholds: {
    slightEdge: number;
    moderateWin: number;
    strongWin: number;
  };
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

const determineTradeVerdict = (
  teamAScore: number,
  teamBScore: number,
  config: TradeEvaluationConfig = TRADE_CONFIG
): TradeVerdict => {
  const balanceIndex = calculateTradeBalanceIndex(teamAScore, teamBScore);
  const { isLopsided, lowContributionTeam, contributionPercent } = checkLopsidedTrade(teamAScore, teamBScore, config);
  const justificationLog: string[] = [];
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

  const winningTeam = teamAScore > teamBScore ? 'Team A' : 'Team B';
  const losingTeam = teamAScore > teamBScore ? 'Team B' : 'Team A';
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

export { TradeVerdict, TradeEvaluationConfig, determineTradeVerdict, calculateTradeBalanceIndex, TRADE_CONFIG };