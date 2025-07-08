/**
 * RB Touchdown Regression Logic (v1.0)
 * Evaluates the sustainability of RB touchdowns and flags regression risk
 * 
 * Modular plugin for dynasty value calculations and player context analysis
 */

export interface RBTouchdownContext {
  tdRate: number; // TDs per touch percentage
  totalTouches: number;
  inside5Carries: number;
  teamInside5Share: number;
  qbRedZoneRushes: number;
  hasRookieCompetition: boolean;
  hasVetCompetition: boolean;
  schemeChange: boolean;
}

export interface RegressionRiskFlags {
  highTDRate: boolean;
  lowGoalLineWork: boolean;
  qbRedZoneThreat: boolean;
  lowTouchHighTD: boolean;
  competitionPresent: boolean;
}

export interface TDRegressionAssessment {
  playerId: string;
  playerName: string;
  season: number;
  riskFlags: RegressionRiskFlags;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  valueAdjustment: number; // Percentage adjustment to dynasty value
  tags: string[];
  contextualNote: string;
  recommendation: string;
}

export class RBTouchdownRegressionAnalyzer {
  private readonly LEAGUE_AVG_RB_TD_RATE = 3.5; // Default 3.5% TD rate for RBs
  
  /**
   * Analyze TD regression risk for a running back
   */
  assessTDRegressionRisk(
    playerId: string,
    playerName: string,
    context: RBTouchdownContext,
    season: number = 2024
  ): TDRegressionAssessment {
    const riskFlags = this.evaluateRiskFactors(context);
    const riskLevel = this.calculateRiskLevel(riskFlags);
    const valueAdjustment = this.calculateValueAdjustment(riskFlags, riskLevel);
    const tags = this.generateRiskTags(riskFlags, riskLevel);
    
    return {
      playerId,
      playerName,
      season,
      riskFlags,
      riskLevel,
      valueAdjustment,
      tags,
      contextualNote: this.generateContextualNote(context, riskFlags),
      recommendation: this.generateRecommendation(riskLevel, valueAdjustment)
    };
  }

  /**
   * Step 1: Flagging for Regression Risk
   * Compare player TD rate to league average and identify high-risk scenarios
   */
  private evaluateRiskFactors(context: RBTouchdownContext): RegressionRiskFlags {
    return {
      highTDRate: context.tdRate > (1.5 * this.LEAGUE_AVG_RB_TD_RATE),
      lowGoalLineWork: context.inside5Carries < 5 && context.teamInside5Share < 0.4,
      qbRedZoneThreat: context.qbRedZoneRushes > 20,
      lowTouchHighTD: context.totalTouches < 220 && context.tdRate > 8.0,
      competitionPresent: context.hasRookieCompetition || context.hasVetCompetition
    };
  }

  /**
   * Step 2: Calculate Risk Level
   * Determine overall regression risk based on contextual factors
   */
  private calculateRiskLevel(flags: RegressionRiskFlags): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    const riskFactorCount = Object.values(flags).filter(Boolean).length;
    
    if (riskFactorCount >= 4) return 'CRITICAL';
    if (riskFactorCount === 3) return 'HIGH';
    if (riskFactorCount === 2) return 'MODERATE';
    return 'LOW';
  }

  /**
   * Step 3: Adjust Dynasty Value
   * Apply percentage adjustments based on regression risk
   */
  private calculateValueAdjustment(flags: RegressionRiskFlags, riskLevel: string): number {
    // Multiple contextual risk factors trigger 15% reduction as specified
    const multipleRiskFactors = Object.values(flags).filter(Boolean).length >= 2;
    
    if (riskLevel === 'CRITICAL' && multipleRiskFactors) return -20;
    if (riskLevel === 'HIGH' && multipleRiskFactors) return -15;
    if (riskLevel === 'MODERATE') return -8;
    if (riskLevel === 'LOW' && flags.highTDRate) return -5;
    
    return 0;
  }

  /**
   * Generate risk tags for player profile
   */
  private generateRiskTags(flags: RegressionRiskFlags, riskLevel: string): string[] {
    const tags: string[] = [];
    
    if (flags.highTDRate && riskLevel !== 'LOW') {
      tags.push('TD Regression Risk');
    }
    
    if (flags.lowGoalLineWork) {
      tags.push('Limited Goal Line Role');
    }
    
    if (flags.qbRedZoneThreat) {
      tags.push('QB Red Zone Competition');
    }
    
    if (flags.lowTouchHighTD) {
      tags.push('Low Volume High TD Rate');
    }
    
    if (flags.competitionPresent) {
      tags.push('Backfield Competition');
    }
    
    return tags;
  }

  /**
   * Generate contextual explanation
   */
  private generateContextualNote(context: RBTouchdownContext, flags: RegressionRiskFlags): string {
    const notes: string[] = [];
    
    if (flags.highTDRate) {
      notes.push(`${context.tdRate.toFixed(1)}% TD rate significantly above league average (${this.LEAGUE_AVG_RB_TD_RATE}%)`);
    }
    
    if (flags.lowGoalLineWork) {
      notes.push(`Limited goal line work (${context.inside5Carries} carries inside 5-yard line)`);
    }
    
    if (flags.qbRedZoneThreat) {
      notes.push(`QB competition in red zone (${context.qbRedZoneRushes} QB red zone rushes)`);
    }
    
    if (flags.lowTouchHighTD) {
      notes.push(`High TD efficiency on low volume (${context.totalTouches} touches, ${context.tdRate.toFixed(1)}% TD rate)`);
    }
    
    return notes.join('. ') || 'No significant regression risk factors identified.';
  }

  /**
   * Generate dynasty management recommendation
   */
  private generateRecommendation(riskLevel: string, valueAdjustment: number): string {
    switch (riskLevel) {
      case 'CRITICAL':
        return 'High sell candidate - TD rate highly unsustainable with multiple risk factors';
      case 'HIGH':
        return 'Consider selling at peak value - significant regression risk identified';
      case 'MODERATE':
        return 'Monitor closely - some TD regression expected but player maintains value';
      case 'LOW':
        return valueAdjustment < 0 
          ? 'Stable with minor TD regression expected' 
          : 'Sustainable TD production with current role';
      default:
        return 'Assessment incomplete';
    }
  }

  /**
   * Analyze specific player examples
   */
  getExampleAnalysis(): TDRegressionAssessment[] {
    // James Cook example from methodology
    const jamesCookContext: RBTouchdownContext = {
      tdRate: 8.0, // 8% TD rate
      totalTouches: 240, // < 250 touches
      inside5Carries: 3, // Limited goal line work
      teamInside5Share: 0.35, // 35% team share
      qbRedZoneRushes: 25, // Josh Allen red zone threat
      hasRookieCompetition: true, // Ray Davis
      hasVetCompetition: true, // Ty Johnson
      schemeChange: true // OC Joe Brady
    };

    const jamesCookAssessment = this.assessTDRegressionRisk(
      'james-cook',
      'James Cook',
      jamesCookContext,
      2024
    );

    return [jamesCookAssessment];
  }
}

// Export singleton instance
export const rbTDRegressionAnalyzer = new RBTouchdownRegressionAnalyzer();

/**
 * Methodology Module Registration
 * This plugin integrates with dynasty valuation, player profiles, and analytics panels
 */
export const RB_TD_REGRESSION_METHODOLOGY = {
  name: "RB Touchdown Regression Logic (v1.0)",
  version: "1.0",
  description: "Evaluates the sustainability of RB touchdowns and flags regression risk",
  triggerScope: ["dynastyValuation", "playerProfile", "analyticsPanel"],
  
  steps: [
    {
      step: "Flagging for Regression Risk",
      logic: [
        "Compare player.tdRate (TDs per touch) to leagueAvgRBTDrate (~3.5% by default)",
        "If tdRate > 1.5 * leagueAvgRBTDrate, flag for potential regression"
      ]
    },
    {
      step: "Analyze Contextual Risk Factors", 
      logic: [
        "Check if player lacks goal-line work using inside5Carries < 5 and low teamInside5Share",
        "Check if QB has high red zone carries (qb.redZoneRushes > 20)",
        "Check if player has <220 total touches and >8% TD rate",
        "Flag if rookie or vet red zone back is present (e.g. Ray Davis, Tyler Johnson)"
      ]
    },
    {
      step: "Adjust Dynasty Value",
      logic: [
        "If player is flagged with multiple contextual risk factors, reduce adjustedDynastyValue by 15%",
        "Apply 'TD Regression Risk' tag to player profile"
      ]
    }
  ],
  
  examplePlayer: {
    name: "James Cook",
    season: 2024,
    context: {
      tdRate: "8%",
      totalTouches: "<250",
      qb: "Josh Allen (RZ threat)",
      competition: ["Ray Davis (rookie)", "Ty Johnson (veteran)"],
      note: "Scheme shift under OC Joe Brady increased efficiency"
    },
    outcome: {
      flag: true,
      valueAdjustment: "-15%",
      tag: "TD Regression Risk"
    }
  }
};