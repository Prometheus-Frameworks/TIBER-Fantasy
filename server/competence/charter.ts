/**
 * Competence Mode Charter Implementation
 * Truth-first, context-aware fantasy football guidance system
 */

import type { CompetenceRequest, CompetenceResponse, CompetenceMode } from "@shared/types/competence";

export const COMPETENCE_CHARTER: CompetenceMode = {
  truthOverAgreement: true,
  contextAwareness: true,
  proactiveGuidance: true,
  transparentReasoning: true,
  riskAwareness: true,
  userGrowthFocus: true,
};

export class CompetenceEngine {
  private charter: CompetenceMode;

  constructor(charter: CompetenceMode = COMPETENCE_CHARTER) {
    this.charter = charter;
  }

  /**
   * Core competence analysis with truth-first principles
   */
  async analyzeRequest(request: CompetenceRequest): Promise<CompetenceResponse> {
    const { query, context, riskTolerance = 'balanced' } = request;

    // Apply context awareness
    const contextualFactors = this.extractContextualFactors(context);
    
    // Generate evidence-based recommendation
    const baseRecommendation = await this.generateRecommendation(query, contextualFactors);
    
    // Apply risk awareness
    const riskAssessment = this.assessRisk(baseRecommendation, contextualFactors);
    
    // Generate alternatives for different risk profiles
    const alternatives = this.generateAlternatives(baseRecommendation, riskTolerance);
    
    // Identify proactive insights
    const proactiveInsights = this.generateProactiveInsights(contextualFactors);
    
    // Challenge user thinking if necessary
    const challenges = this.identifyUserThinkingChallenges(query, contextualFactors);

    return {
      recommendation: baseRecommendation.text,
      reasoning: baseRecommendation.reasoning,
      confidence: baseRecommendation.confidence,
      riskLevel: riskAssessment.level,
      alternatives,
      proactiveInsights,
      dataSupport: baseRecommendation.dataSupport,
      challengesToUserThinking: challenges,
    };
  }

  private extractContextualFactors(context?: CompetenceRequest['context']) {
    if (!context) return {};

    return {
      leagueFormat: context.leagueSettings?.format || 'unknown',
      scoringSystem: context.leagueSettings?.scoring || 'unknown',
      rosterComposition: this.analyzeRosterComposition(context.userRoster),
      tradeHistory: this.analyzeTradeHistory(context.recentTrades),
      draftTendencies: this.analyzeDraftHistory(context.draftHistory),
    };
  }

  private analyzeRosterComposition(roster?: CompetenceRequest['context']['userRoster']) {
    if (!roster) return null;

    const byPosition = roster.reduce((acc, player) => {
      acc[player.position] = (acc[player.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPlayers: roster.length,
      byPosition,
      strengthAreas: Object.entries(byPosition)
        .filter(([_, count]) => count >= 3)
        .map(([pos]) => pos),
      weakAreas: Object.entries(byPosition)
        .filter(([_, count]) => count <= 1)
        .map(([pos]) => pos),
    };
  }

  private analyzeTradeHistory(trades?: CompetenceRequest['context']['recentTrades']) {
    if (!trades || trades.length === 0) return null;

    const outcomes = trades.filter(t => t.outcome).map(t => t.outcome!);
    const winRate = outcomes.filter(o => o === 'win').length / outcomes.length;

    return {
      totalTrades: trades.length,
      winRate,
      isActiveTrader: trades.length > 3,
      tendency: winRate > 0.6 ? 'successful' : winRate < 0.4 ? 'struggling' : 'mixed',
    };
  }

  private analyzeDraftHistory(drafts?: CompetenceRequest['context']['draftHistory']) {
    if (!drafts || drafts.length === 0) return null;

    const recentDraft = drafts[drafts.length - 1];
    const earlyPicks = recentDraft.picks.filter(p => p.round <= 3);
    const positionFrequency = earlyPicks.reduce((acc, pick) => {
      // Would need player data to determine position
      return acc;
    }, {} as Record<string, number>);

    return {
      yearsOfData: drafts.length,
      recentStrategy: 'needs_analysis', // Would be determined by actual pick analysis
    };
  }

  private async generateRecommendation(query: string, contextualFactors: any) {
    // Simple demo implementation
    const insights = this.analyzeQuery(query);
    return {
      text: `Based on analysis: ${insights.recommendation}`,
      reasoning: insights.reasoning,
      confidence: insights.confidence,
      dataSupport: [
        {
          metric: "Context Score",
          value: insights.confidence.toString(),
          source: "Competence Analysis",
          context: "Based on query analysis and available context"
        }
      ]
    };
  }

  private analyzeQuery(query: string) {
    // Simple keyword-based analysis for demo
    const lowercaseQuery = query.toLowerCase();
    
    if (lowercaseQuery.includes('trade')) {
      return {
        recommendation: "Evaluate trade based on positional scarcity and long-term value, not just name recognition",
        reasoning: "Trades should be evaluated on future production potential, not past performance",
        confidence: 85
      };
    }
    
    if (lowercaseQuery.includes('draft')) {
      return {
        recommendation: "Focus on positional value and avoid reaching for team needs early",
        reasoning: "Best player available typically provides better long-term value than reaching for position",
        confidence: 80
      };
    }
    
    if (lowercaseQuery.includes('waiver') || lowercaseQuery.includes('pickup')) {
      return {
        recommendation: "Prioritize players with clear path to targets/touches over ceiling plays",
        reasoning: "Waiver claims should focus on volume opportunity rather than speculative upside",
        confidence: 75
      };
    }
    
    return {
      recommendation: "Provide more specific context for detailed analysis",
      reasoning: "General fantasy advice requires specific context about league format, roster construction, and timeline",
      confidence: 60
    };
  }

  private assessRisk(recommendation: any, contextualFactors: any) {
    // Risk assessment logic based on recommendation type and user context
    return {
      level: 'medium' as const,
      factors: ['market_volatility', 'injury_history'],
    };
  }

  private generateAlternatives(recommendation: any, riskTolerance: string) {
    return [
      {
        option: "Conservative alternative",
        pros: ["Lower risk", "Proven track record"],
        cons: ["Lower upside", "Less exciting"],
        riskLevel: 'low' as const,
      },
      {
        option: "Aggressive alternative", 
        pros: ["High upside potential", "Contrarian value"],
        cons: ["Higher bust risk", "Requires conviction"],
        riskLevel: 'high' as const,
      }
    ];
  }

  private generateProactiveInsights(contextualFactors: any): string[] {
    const insights: string[] = [];

    // Check for upcoming events, market trends, etc.
    insights.push("Trade deadline approaching in 3 weeks - consider consolidating depth for upgrades");
    insights.push("Rookie draft season starting - monitor landing spots for 2025 class");

    return insights;
  }

  private identifyUserThinkingChallenges(query: string, contextualFactors: any): string[] {
    const challenges: string[] = [];

    // Identify potential biases or misconceptions in the query
    if (query.includes("sure thing") || query.includes("guaranteed")) {
      challenges.push("No fantasy moves are guaranteed - even 'safe' players carry risk");
    }

    if (query.includes("everyone says")) {
      challenges.push("Consensus isn't always correct - contrarian moves often provide value");
    }

    return challenges;
  }
}

export const competenceEngine = new CompetenceEngine();