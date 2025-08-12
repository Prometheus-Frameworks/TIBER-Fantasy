export interface CompetenceRequest {
  query: string;
  context?: {
    leagueSettings?: {
      scoring: 'ppr' | 'half-ppr' | 'standard';
      format: 'dynasty' | 'redraft' | 'keeper';
      startingRosters: Record<string, number>;
      tradeDeadline?: string;
    };
    userRoster?: Array<{
      playerId: string;
      name: string;
      position: string;
      team: string;
    }>;
    recentTrades?: Array<{
      date: string;
      traded: string[];
      received: string[];
      outcome?: 'win' | 'loss' | 'neutral';
    }>;
    draftHistory?: Array<{
      year: number;
      picks: Array<{
        round: number;
        pick: number;
        player: string;
        value?: number;
      }>;
    }>;
  };
  riskTolerance?: 'conservative' | 'balanced' | 'aggressive';
}

export interface CompetenceResponse {
  recommendation: string;
  reasoning: string;
  confidence: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  alternatives?: Array<{
    option: string;
    pros: string[];
    cons: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  proactiveInsights?: string[];
  dataSupport?: Array<{
    metric: string;
    value: string | number;
    source: string;
    context: string;
  }>;
  challengesToUserThinking?: string[];
}

export interface CompetenceMode {
  truthOverAgreement: boolean;
  contextAwareness: boolean;
  proactiveGuidance: boolean;
  transparentReasoning: boolean;
  riskAwareness: boolean;
  userGrowthFocus: boolean;
}