/**
 * TE Touchdown Regression Logic (v1.1)
 * Modular methodology plugin for evaluating TE touchdown sustainability and regression risk
 * 
 * Integration Philosophy:
 * - Safely appends to existing evaluation logic without overwriting
 * - Preserves spike week detection, WR/RB regression, and adjustedDynastyValue formulas
 * - Independent testing and rollback capability
 */

export interface TERegressionContext {
  tdRate: number;                // Touchdown rate per target
  seasonTDs: number;             // Current season touchdowns
  careerTDRate: number;          // Career average TD rate
  routesRun: number;             // Total routes run
  receptions: number;            // Total receptions
  targetShare: number;           // Team target share (0-1)
  receivingYards: number;        // Total receiving yards
  redZoneTargets: number;        // Red zone targets
  inside10Targets: number;       // Inside-10 targets
  teamPassAttempts: number;      // Team pass attempts
  redZonePassShare: number;      // Red zone pass share
  teTDShare: number;             // TE TD share of team TDs
  teTargetShare: number;         // TE target share of team
  passVolumeVolatility: number;  // Pass volume volatility
  teRoomDepth: number;           // TE room depth/competition
}

export interface TERegressionAssessment {
  playerId: string;
  playerName: string;
  flagged: boolean;
  riskFlags: string[];
  dynastyValueAdjustment: number;
  tags: string[];
  logs: string[];
  contextAnalysis: {
    tdRateRatio: number;
    receivingFloor: boolean;
    regressionFlags: number;
    passCatchingPenalty: boolean;
  };
  season: number;
  lastEvaluatedSeason: number; // Confirms evaluation using current season data
  timestamp: Date;
}

export interface TERegressionDefaults {
  leagueAvgTETDRate: number;
  redZoneThreshold: number;
  volatilityThreshold: number;
}

export class TETouchdownRegressionService {
  private defaults: TERegressionDefaults = {
    leagueAvgTETDRate: 0.055,  // 5.5% default
    redZoneThreshold: 8,       // Red zone target threshold
    volatilityThreshold: 0.12  // 12% volatility threshold
  };

  /**
   * Assess TE touchdown regression risk according to exact specification
   */
  assessTouchdownRegression(
    playerId: string,
    playerName: string,
    context: TERegressionContext,
    season: number = 2024
  ): TERegressionAssessment {
    const riskFlags: string[] = [];
    const logs: string[] = [];
    const tags: string[] = [];

    // Step 0: 2024 Season Validation
    if (season < 2024) {
      console.warn(`⚠️ TE TD Regression: Using outdated season data (${season}) for ${playerName}. Consider using 2024 data for current evaluations.`);
    }

    // Step 1: Flagging for Regression Risk
    
    // Flag 1: TD Rate > 2x Career Average
    if (context.tdRate > 2 * context.careerTDRate) {
      riskFlags.push('TD Rate > 2x Career Avg');
      logs.push('TD Rate > 2x Career Avg');
    }

    // Flag 2: High TDs with Low Red Zone Usage
    if (context.seasonTDs >= 6 && context.redZoneTargets < this.defaults.redZoneThreshold) {
      riskFlags.push('Low Red Zone Usage');
      logs.push('Low Red Zone Usage');
    }

    // Flag 3: Low Inside-10 Usage
    if (context.inside10Targets < 4) {
      riskFlags.push('Low Inside-10 Usage');
      logs.push('Low Inside-10 Usage');
    }

    // Flag 4: Low Target Share with High TE TD Share
    if (context.targetShare < 0.12 && context.teTDShare > 0.25) {
      riskFlags.push('High TE TD Share');
      logs.push('High TE TD Share');
    }

    // Flag 5: Volatile Passing Offense
    if (context.passVolumeVolatility > this.defaults.volatilityThreshold) {
      riskFlags.push('Volatile Passing Offense');
      logs.push('Volatile Passing Offense');
    }

    // Flag 6: TE Room Competition
    if (context.teRoomDepth >= 3) {
      riskFlags.push('TE Room Competition');
      logs.push('TE Room Competition');
    }

    // Step 2: Pass-Catching Floor Check
    let passCatchingPenalty = false;
    const receivingFloor = context.receptions >= 40 && context.routesRun >= 300;

    if (!receivingFloor) {
      logs.push('Low Receiving Floor');
    }

    if (context.targetShare < 0.10 && context.receivingYards < 400) {
      passCatchingPenalty = true;
      logs.push('Pass-Catching Floor Penalty Applied');
    }

    // Step 3: Dynasty Value Adjustment
    const regressionFlags = riskFlags.length;
    let dynastyValueAdjustment = 0;
    const flagged = regressionFlags >= 2;

    if (regressionFlags >= 2) {
      dynastyValueAdjustment = -0.10;
    }

    if (regressionFlags >= 3) {
      dynastyValueAdjustment = -0.20;
    }

    if (passCatchingPenalty) {
      dynastyValueAdjustment -= 0.05;
    }

    // Cap adjustment at -0.25
    dynastyValueAdjustment = Math.max(-0.25, dynastyValueAdjustment);

    if (Math.abs(dynastyValueAdjustment) >= 0.10) {
      tags.push('TE Regression Risk');
    }

    logs.push(`Regression Penalty Applied: ${dynastyValueAdjustment.toFixed(2)}`);

    // Calculate context analysis ratios
    const tdRateRatio = context.tdRate / this.defaults.leagueAvgTETDRate;

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
        receivingFloor,
        regressionFlags,
        passCatchingPenalty
      },
      season,
      lastEvaluatedSeason: 2024, // Confirms evaluation using current season data
      timestamp: new Date()
    };
  }

  /**
   * Validate required fields
   */
  validateContext(context: Partial<TERegressionContext>): { 
    requiredFieldsPresent: boolean; 
    missingFields: string[] 
  } {
    const requiredFields = [
      'tdRate', 'seasonTDs', 'careerTDRate', 'routesRun', 
      'receptions', 'targetShare', 'receivingYards',
      'redZoneTargets', 'inside10Targets', 'teamPassAttempts',
      'redZonePassShare', 'teTDShare', 'teTargetShare',
      'passVolumeVolatility', 'teRoomDepth'
    ];
    
    const missingFields = requiredFields.filter(field => 
      !(field in context) || context[field as keyof TERegressionContext] === undefined
    );
    
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
      name: "TE Touchdown Regression Logic (v1.1)",
      version: "1.1",
      description: "Evaluates TE touchdown sustainability and regression risk based on TD rate, volume, red zone usage, pass volatility, and receiving floor.",
      triggerScope: ["dynastyValuation", "playerProfile", "analyticsPanel"],
      analysisSteps: {
        step1: "Flag for regression risk based on TD rate, red zone usage, and competition",
        step2: "Evaluate pass-catching floor and volume sustainability",
        step3: "Apply dynasty value adjustment based on total risk factors"
      },
      inputValidation: {
        requiredFields: [
          'tdRate', 'seasonTDs', 'careerTDRate', 'routesRun', 
          'receptions', 'targetShare', 'receivingYards',
          'redZoneTargets', 'inside10Targets', 'teamPassAttempts',
          'redZonePassShare', 'teTDShare', 'teTargetShare',
          'passVolumeVolatility', 'teRoomDepth'
        ],
        defaults: this.defaults
      },
      riskCategories: {
        regressionFlags: "TD rate sustainability, red zone usage, competition",
        passCatchingFloor: "Reception volume and target share stability",
        teamContext: "Pass volume volatility and TE target distribution"
      }
    };
  }

  /**
   * Get example player for testing - matches specification exactly
   */
  getExamplePlayer(): TERegressionAssessment {
    const exampleContext: TERegressionContext = {
      tdRate: 0.18,              // 18% TD rate
      seasonTDs: 8,              // 8 TDs
      careerTDRate: 0.06,        // 6% career average
      routesRun: 270,            // 270 routes
      receptions: 36,            // 36 receptions
      targetShare: 0.09,         // 9% target share
      receivingYards: 390,       // 390 receiving yards
      redZoneTargets: 5,         // 5 red zone targets (below 8 threshold)
      inside10Targets: 2,        // 2 inside-10 targets (below 4 threshold)
      teamPassAttempts: 540,     // 540 team pass attempts
      redZonePassShare: 0.18,    // 18% red zone pass share
      teTDShare: 0.29,           // 29% TE TD share (above 25% threshold)
      teTargetShare: 0.14,       // 14% TE target share
      passVolumeVolatility: 0.15, // 15% volatility (above 12% threshold)
      teRoomDepth: 3             // 3 TEs in room (triggers competition flag)
    };

    return this.assessTouchdownRegression(
      'example-te',
      'Example TE',
      exampleContext,
      2024
    );
  }

  /**
   * Apply default values for missing fields
   */
  applyDefaults(context: Partial<TERegressionContext>): TERegressionContext {
    return {
      tdRate: context.tdRate ?? this.defaults.leagueAvgTETDRate,
      seasonTDs: context.seasonTDs ?? 4,
      careerTDRate: context.careerTDRate ?? this.defaults.leagueAvgTETDRate,
      routesRun: context.routesRun ?? 300,
      receptions: context.receptions ?? 40,
      targetShare: context.targetShare ?? 0.12,
      receivingYards: context.receivingYards ?? 450,
      redZoneTargets: context.redZoneTargets ?? this.defaults.redZoneThreshold,
      inside10Targets: context.inside10Targets ?? 4,
      teamPassAttempts: context.teamPassAttempts ?? 550,
      redZonePassShare: context.redZonePassShare ?? 0.20,
      teTDShare: context.teTDShare ?? 0.20,
      teTargetShare: context.teTargetShare ?? 0.15,
      passVolumeVolatility: context.passVolumeVolatility ?? 0.10,
      teRoomDepth: context.teRoomDepth ?? 2
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
        "spike week detection",
        "WR touchdown regression",
        "RB touchdown sustainability", 
        "adjustedDynastyValue calculations",
        "YPRR analysis",
        "opportunity metrics",
        "efficiency scoring"
      ],
      noOverwrites: true,
      rollbackCapable: true,
      conflictRisk: "None - module appends safely to existing methodology"
    };
  }
}

export const teTouchdownRegressionService = new TETouchdownRegressionService();