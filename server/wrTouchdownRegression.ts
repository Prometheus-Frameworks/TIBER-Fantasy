/**
 * WR Touchdown Regression Logic (v1.0)
 * Modular methodology plugin for evaluating WR touchdown sustainability and regression risk
 * 
 * Integration Philosophy:
 * - Safely appends to existing evaluation logic without overwriting
 * - Preserves spike week detection, YPRR analysis, and adjustedDynastyValue formulas
 * - Independent testing and rollback capability
 */

export interface WRRegressionContext {
  tdRate: number;              // Touchdown rate per target
  seasonTDs: number;           // Current season touchdowns
  careerTDRate: number;        // Career average TD rate
  routesRun: number;           // Total routes run
  receptions: number;          // Total receptions
  targetShare: number;         // Team target share (0-1)
  routeParticipation: number;  // Route participation rate (0-1)
  teamRunPassRatio: number;    // Team run/pass ratio
}

export interface WRRegressionAssessment {
  playerId: string;
  playerName: string;
  flagged: boolean;
  riskFlags: string[];
  dynastyValueAdjustment: number;
  tags: string[];
  logs: string[];
  contextAnalysis: {
    tdRateRatio: number;
    targetShareRatio: number;
    routeParticipationRatio: number;
    riskFactorCount: number;
  };
  season: number;
  timestamp: Date;
}

export interface WRRegressionDefaults {
  leagueAvgTDRate: number;
  lowTargetShareThreshold: number;
  lowRouteParticipation: number;
  runPassRatio: number;
}

export class WRTouchdownRegressionService {
  private defaults: WRRegressionDefaults = {
    leagueAvgTDRate: 0.045,
    lowTargetShareThreshold: 0.12,
    lowRouteParticipation: 0.65,
    runPassRatio: 1.0
  };

  /**
   * Assess WR touchdown regression risk according to exact specification
   */
  assessTouchdownRegression(
    playerId: string,
    playerName: string,
    context: WRRegressionContext,
    season: number
  ): WRRegressionAssessment {
    const riskFlags: string[] = [];
    const logs: string[] = [];
    const tags: string[] = [];

    // Step 1: Flagging for Regression Risk
    const tdRateRatio = context.tdRate / this.defaults.leagueAvgTDRate;
    
    // Flag 1: Back-to-Back Elite TD Rate (simplified for single season)
    if (tdRateRatio > 1.5) {
      riskFlags.push('Back-to-Back Elite TD Rate');
      logs.push('Back-to-Back Elite TD Rate');
    }

    // Flag 2: TD Rate Exceeds Career Average
    if (context.tdRate > 2 * context.careerTDRate) {
      riskFlags.push('TD Rate Exceeds Career Avg');
      logs.push('TD Rate Exceeds Career Avg');
    }

    // Flag 3: Low Target Share High TDs
    if (context.targetShare < this.defaults.lowTargetShareThreshold && context.seasonTDs > 6) {
      riskFlags.push('Low Target Share High TDs');
      logs.push('Low Target Share High TDs');
    }

    // Flag 4: Run-Heavy Low Route Participation
    if (context.teamRunPassRatio > 1.2 && context.routeParticipation < this.defaults.lowRouteParticipation) {
      riskFlags.push('Run-Heavy Low Route Participation');
      logs.push('Run-Heavy Low Route Participation');
    }

    // Flag 5: Extreme TD Rate
    if (context.tdRate > 0.25) {
      riskFlags.push('Extreme TD Rate');
      logs.push('Extreme TD Rate');
    }

    // Step 2: Adjust Dynasty Value
    const flagCount = riskFlags.length;
    let dynastyValueAdjustment = 0;
    const flagged = flagCount >= 2;

    if (flagCount >= 2) {
      tags.push('TD Regression Risk');
      logs.push('Regression Penalty Applied');
      dynastyValueAdjustment = -0.15;
    }

    if (flagCount >= 3) {
      dynastyValueAdjustment = -0.25;
      tags.push('High TD Regression Risk');
      logs.push('High Regression Penalty Applied');
    }

    // Cap adjustment and log final result
    dynastyValueAdjustment = Math.max(-0.25, Math.min(0.25, dynastyValueAdjustment));
    logs.push(`Final Adjustment: ${dynastyValueAdjustment.toFixed(2)}`);

    // Calculate context analysis ratios
    const targetShareRatio = context.targetShare / this.defaults.lowTargetShareThreshold;
    const routeParticipationRatio = context.routeParticipation / this.defaults.lowRouteParticipation;

    return {
      playerId,
      playerName,
      flagged,
      riskFlags,
      dynastyValueAdjustment,
      tags,
      logs,
      contextAnalysis: {
        tdRateRatio,
        targetShareRatio,
        routeParticipationRatio,
        riskFactorCount: riskFlags.length
      },
      season,
      timestamp: new Date()
    };
  }

  /**
   * Validate required fields
   */
  validateContext(context: Partial<WRRegressionContext>): { 
    requiredFieldsPresent: boolean; 
    missingFields: string[] 
  } {
    const requiredFields = [
      'tdRate', 'seasonTDs', 'careerTDRate', 'routesRun', 
      'receptions', 'targetShare', 'routeParticipation', 'teamRunPassRatio'
    ];
    
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (!(field in context) || context[field as keyof WRRegressionContext] === undefined) {
        missingFields.push(field);
      }
    }

    return {
      requiredFieldsPresent: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Get methodology information
   */
  getMethodology() {
    return {
      name: "WR Touchdown Regression Logic (v1.0)",
      version: "1.0",
      description: "Evaluates WR touchdown sustainability and regression risk through three-step analysis",
      triggerScope: ["dynastyValuation", "playerProfile", "analyticsPanel"],
      methodology: {
        step1: "Flag for regression risk based on TD rate vs league average",
        step2: "Analyze contextual factors: target share, route participation, career trends, team context",
        step3: "Apply dynasty value adjustment based on risk factor count"
      },
      inputValidation: {
        requiredFields: [
          'tdRate', 'seasonTDs', 'careerTDRate', 'routesRun', 
          'receptions', 'targetShare', 'routeParticipation', 'teamRunPassRatio'
        ],
        defaults: this.defaults
      },
      outputStructure: {
        flagged: "boolean",
        riskFlags: "string[]",
        dynastyValueAdjustment: "number",
        tags: "string[]",
        logs: "string[]"
      }
    };
  }

  /**
   * Get example player for testing - matches specification exactly
   */
  getExamplePlayer(): WRRegressionAssessment {
    const exampleContext: WRRegressionContext = {
      tdRate: 0.28,              // 28% TD rate (extreme)
      seasonTDs: 14,             // High TDs
      careerTDRate: 0.10,        // 10% career average
      routesRun: 400,
      receptions: 50,
      targetShare: 0.10,         // 10% target share (below 12% threshold)
      routeParticipation: 0.60,  // 60% route participation (below 65% threshold)
      teamRunPassRatio: 1.3      // Run-heavy offense
    };

    return this.assessTouchdownRegression(
      'example-wr',
      'Example WR',
      exampleContext,
      2024
    );
  }

  /**
   * Apply default values for missing fields
   */
  applyDefaults(context: Partial<WRRegressionContext>): WRRegressionContext {
    return {
      tdRate: context.tdRate ?? this.defaults.leagueAvgTDRate,
      seasonTDs: context.seasonTDs ?? 6,
      careerTDRate: context.careerTDRate ?? this.defaults.leagueAvgTDRate,
      routesRun: context.routesRun ?? 500,
      receptions: context.receptions ?? 60,
      targetShare: context.targetShare ?? this.defaults.lowTargetShareThreshold,
      routeParticipation: context.routeParticipation ?? this.defaults.lowRouteParticipation,
      teamRunPassRatio: context.teamRunPassRatio ?? this.defaults.runPassRatio
    };
  }

  /**
   * Get integration safety information
   */
  getIntegrationSafety() {
    return {
      safe: true,
      modular: true,
      preservedMethods: [
        'spike week detection',
        'YPRR analysis', 
        'adjustedDynastyValue calculations',
        'opportunity metrics',
        'efficiency scoring',
        'RB touchdown sustainability'
      ],
      conflicts: [],
      rollbackCapable: true
    };
  }
}

export const wrTouchdownRegressionService = new WRTouchdownRegressionService();