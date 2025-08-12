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
    const lowercaseQuery = query.toLowerCase();
    
    // Trade Analysis - No Hand-Holding
    if (lowercaseQuery.includes('trade')) {
      if (lowercaseQuery.includes('should i') || lowercaseQuery.includes('what do you think')) {
        return {
          recommendation: "Stop asking for validation. Calculate the trade yourself: Future production probability × positional scarcity × injury risk. Name recognition is irrelevant.",
          reasoning: "You're seeking comfort, not analysis. Most trades fail because managers optimize for feeling good about the deal rather than winning games.",
          confidence: 95
        };
      }
      return {
        recommendation: "Trade evaluation requires specific players, league format, and your roster construction. Vague questions get vague answers.",
        reasoning: "Without context, any advice is worthless. Provide specifics or make your own decision.",
        confidence: 90
      };
    }
    
    // Draft Analysis - Reality Check
    if (lowercaseQuery.includes('draft')) {
      if (lowercaseQuery.includes('sleeper') || lowercaseQuery.includes('breakout')) {
        return {
          recommendation: "Chasing breakouts in drafts is how you finish 6th. Draft proven volume, trade for upside later when you have capital.",
          reasoning: "Breakout picks feel smart but statistically underperform. Volume is predictable, talent evaluation is not.",
          confidence: 88
        };
      }
      return {
        recommendation: "Draft for volume and positional scarcity first, talent second. Your gut feelings about players are probably wrong.",
        reasoning: "Most managers draft based on highlight reels and narratives. Data-driven positional value wins leagues.",
        confidence: 85
      };
    }
    
    // Waiver/Pickup Analysis - Cut Through Noise  
    if (lowercaseQuery.includes('waiver') || lowercaseQuery.includes('pickup') || lowercaseQuery.includes('add')) {
      return {
        recommendation: "If you're asking about a waiver pickup, you already know the answer. Clear path to 15+ touches/targets? Add them. Everything else is lottery ticket gambling.",
        reasoning: "Waiver analysis paralysis costs more games than bad pickups. Volume opportunity is binary - either it exists or it doesn't.",
        confidence: 92
      };
    }
    
    // Start/Sit - Expose the Foolishness
    if (lowercaseQuery.includes('start') || lowercaseQuery.includes('sit') || lowercaseQuery.includes('lineup')) {
      return {
        recommendation: "Start your best players. If you're agonizing over start/sit decisions, your roster construction is the real problem.",
        reasoning: "Start/sit anxiety indicates insufficient depth. Good teams don't have agonizing lineup decisions every week.",
        confidence: 93
      };
    }
    
    // Dynasty/Keeper - Long-term Truth
    if (lowercaseQuery.includes('dynasty') || lowercaseQuery.includes('keeper')) {
      return {
        recommendation: "Dynasty success requires patience most managers don't have. If you're looking for quick fixes, play redraft.",
        reasoning: "Dynasty rewards those who accept short-term pain for long-term gain. Most quit before seeing results.",
        confidence: 90
      };
    }
    
    // Default Response - No Coddling
    return {
      recommendation: "Your question lacks the specificity needed for useful analysis. Fantasy football rewards precision, not vague theorizing.",
      reasoning: "Successful managers ask specific questions with context. General advice produces general results - which means losing.",
      confidence: 85
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