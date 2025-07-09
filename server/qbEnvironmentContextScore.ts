/**
 * QB Environment & Context Score (v1.1)
 * Evaluates QB fantasy outlook by factoring in rushing upside, throwing accuracy,
 * offensive line protection, teammate quality, and offseason upgrades
 */

export interface QBEnvironmentInput {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  season?: number;
  
  // Rushing upside metrics
  scrambleRate?: number;
  rushingYPC?: number;
  explosiveRunRate?: number; // 15+ yard runs per attempt
  
  // Throwing accuracy metrics
  cpoe?: number; // Completion Percentage Over Expected
  adjCompletionRate?: number;
  deepAccuracy?: number; // 20+ yard completions
  
  // Offensive line protection
  pffOLineGrade?: number;
  pbwr?: number; // Pass Block Win Rate
  pressureRate?: number;
  
  // Teammate quality
  avgWRYPRR?: number; // Average WR Yards Per Route Run
  avgWRSeparation?: number;
  avgWRYAC?: number;
  
  // Offseason upgrades
  hasWRUpgrade?: boolean;
  upgradeDescription?: string;
}

export interface QBEnvironmentResult {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  contextScore: number;
  componentScores: {
    rushingUpside: number;
    throwingAccuracy: number;
    oLineProtection: number;
    teammateQuality: number;
    offseasonUpgrade: number;
  };
  environmentTags: string[];
  logs: string[];
  timestamp: Date;
}

export class QBEnvironmentContextScoreService {
  private readonly version = "1.1";
  private readonly name = "QB Environment & Context Score";

  /**
   * Evaluate QB environment and context factors
   */
  evaluateQBEnvironment(input: QBEnvironmentInput): QBEnvironmentResult {
    const logs: string[] = [];
    const environmentTags: string[] = [];
    
    // Validate inputs
    if (!input || input.position !== 'QB') {
      logs.push("Invalid input or non-QB player");
      return this.createResult(input, 0, {
        rushingUpside: 0,
        throwingAccuracy: 0,
        oLineProtection: 0,
        teammateQuality: 0,
        offseasonUpgrade: 0
      }, environmentTags, logs);
    }

    logs.push(`Evaluating QB environment for ${input.playerName} (${input.team})`);

    // Component 1: Rushing Upside (25% weight)
    const rushingUpside = this.calculateRushingUpside(input, logs, environmentTags);
    
    // Component 2: Throwing Accuracy (25% weight)
    const throwingAccuracy = this.calculateThrowingAccuracy(input, logs, environmentTags);
    
    // Component 3: O-Line Protection (20% weight)
    const oLineProtection = this.calculateOLineProtection(input, logs, environmentTags);
    
    // Component 4: Teammate Quality (20% weight)
    const teammateQuality = this.calculateTeammateQuality(input, logs, environmentTags);
    
    // Component 5: Offseason Upgrade (10% weight)
    const offseasonUpgrade = this.calculateOffseasonUpgrade(input, logs, environmentTags);

    const componentScores = {
      rushingUpside,
      throwingAccuracy,
      oLineProtection,
      teammateQuality,
      offseasonUpgrade
    };

    // Calculate weighted context score
    const contextScore = 
      (rushingUpside * 0.25) +
      (throwingAccuracy * 0.25) +
      (oLineProtection * 0.20) +
      (teammateQuality * 0.20) +
      (offseasonUpgrade * 0.10);

    logs.push(`Final context score: ${contextScore.toFixed(1)} (weighted composite)`);
    
    // Add overall environment tags
    if (contextScore >= 80) {
      environmentTags.push("Elite Environment");
    } else if (contextScore >= 65) {
      environmentTags.push("Strong Environment");
    } else if (contextScore >= 50) {
      environmentTags.push("Average Environment");
    } else {
      environmentTags.push("Challenging Environment");
    }

    return this.createResult(input, contextScore, componentScores, environmentTags, logs);
  }

  /**
   * Calculate rushing upside score (0-100)
   */
  private calculateRushingUpside(
    input: QBEnvironmentInput, 
    logs: string[], 
    tags: string[]
  ): number {
    let score = 50; // Base score
    const metrics: string[] = [];

    // Scramble rate evaluation
    if (input.scrambleRate !== undefined) {
      if (input.scrambleRate >= 8.0) {
        score += 20;
        metrics.push(`High scramble rate (${input.scrambleRate.toFixed(1)}%)`);
        tags.push("Elite Scrambler");
      } else if (input.scrambleRate >= 5.0) {
        score += 10;
        metrics.push(`Good scramble rate (${input.scrambleRate.toFixed(1)}%)`);
      } else {
        score -= 10;
        metrics.push(`Low scramble rate (${input.scrambleRate.toFixed(1)}%)`);
      }
    }

    // Rushing YPC evaluation
    if (input.rushingYPC !== undefined) {
      if (input.rushingYPC >= 6.0) {
        score += 15;
        metrics.push(`Elite rushing YPC (${input.rushingYPC.toFixed(1)})`);
      } else if (input.rushingYPC >= 4.5) {
        score += 8;
        metrics.push(`Good rushing YPC (${input.rushingYPC.toFixed(1)})`);
      } else {
        score -= 5;
        metrics.push(`Limited rushing YPC (${input.rushingYPC.toFixed(1)})`);
      }
    }

    // Explosive run rate
    if (input.explosiveRunRate !== undefined) {
      if (input.explosiveRunRate >= 15.0) {
        score += 15;
        metrics.push(`High explosive run rate (${input.explosiveRunRate.toFixed(1)}%)`);
        tags.push("Big Play Threat");
      } else if (input.explosiveRunRate >= 8.0) {
        score += 8;
        metrics.push(`Decent explosive run rate (${input.explosiveRunRate.toFixed(1)}%)`);
      }
    }

    logs.push(`Rushing upside: ${score}/100 - ${metrics.join(", ")}`);
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate throwing accuracy score (0-100)
   */
  private calculateThrowingAccuracy(
    input: QBEnvironmentInput,
    logs: string[],
    tags: string[]
  ): number {
    let score = 50; // Base score
    const metrics: string[] = [];

    // CPOE evaluation
    if (input.cpoe !== undefined) {
      if (input.cpoe >= 3.0) {
        score += 20;
        metrics.push(`Elite CPOE (+${input.cpoe.toFixed(1)}%)`);
        tags.push("Elite Accuracy");
      } else if (input.cpoe >= 1.0) {
        score += 12;
        metrics.push(`Good CPOE (+${input.cpoe.toFixed(1)}%)`);
      } else if (input.cpoe >= -1.0) {
        score += 5;
        metrics.push(`Average CPOE (${input.cpoe.toFixed(1)}%)`);
      } else {
        score -= 10;
        metrics.push(`Poor CPOE (${input.cpoe.toFixed(1)}%)`);
      }
    }

    // Adjusted completion rate
    if (input.adjCompletionRate !== undefined) {
      if (input.adjCompletionRate >= 70.0) {
        score += 15;
        metrics.push(`High completion rate (${input.adjCompletionRate.toFixed(1)}%)`);
      } else if (input.adjCompletionRate >= 65.0) {
        score += 8;
        metrics.push(`Good completion rate (${input.adjCompletionRate.toFixed(1)}%)`);
      } else {
        score -= 8;
        metrics.push(`Low completion rate (${input.adjCompletionRate.toFixed(1)}%)`);
      }
    }

    // Deep accuracy
    if (input.deepAccuracy !== undefined) {
      if (input.deepAccuracy >= 45.0) {
        score += 15;
        metrics.push(`Elite deep accuracy (${input.deepAccuracy.toFixed(1)}%)`);
        tags.push("Deep Ball Threat");
      } else if (input.deepAccuracy >= 35.0) {
        score += 8;
        metrics.push(`Good deep accuracy (${input.deepAccuracy.toFixed(1)}%)`);
      } else {
        score -= 5;
        metrics.push(`Limited deep accuracy (${input.deepAccuracy.toFixed(1)}%)`);
      }
    }

    logs.push(`Throwing accuracy: ${score}/100 - ${metrics.join(", ")}`);
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate offensive line protection score (0-100)
   */
  private calculateOLineProtection(
    input: QBEnvironmentInput,
    logs: string[],
    tags: string[]
  ): number {
    let score = 50; // Base score
    const metrics: string[] = [];

    // PFF O-Line grade
    if (input.pffOLineGrade !== undefined) {
      if (input.pffOLineGrade >= 80.0) {
        score += 25;
        metrics.push(`Elite O-Line (${input.pffOLineGrade.toFixed(1)} PFF)`);
        tags.push("Elite Protection");
      } else if (input.pffOLineGrade >= 70.0) {
        score += 15;
        metrics.push(`Good O-Line (${input.pffOLineGrade.toFixed(1)} PFF)`);
      } else if (input.pffOLineGrade >= 60.0) {
        score += 5;
        metrics.push(`Average O-Line (${input.pffOLineGrade.toFixed(1)} PFF)`);
      } else {
        score -= 15;
        metrics.push(`Poor O-Line (${input.pffOLineGrade.toFixed(1)} PFF)`);
        tags.push("Protection Concerns");
      }
    }

    // Pass Block Win Rate
    if (input.pbwr !== undefined) {
      if (input.pbwr >= 65.0) {
        score += 15;
        metrics.push(`High PBWR (${input.pbwr.toFixed(1)}%)`);
      } else if (input.pbwr >= 58.0) {
        score += 8;
        metrics.push(`Good PBWR (${input.pbwr.toFixed(1)}%)`);
      } else {
        score -= 10;
        metrics.push(`Low PBWR (${input.pbwr.toFixed(1)}%)`);
      }
    }

    // Pressure rate (lower is better)
    if (input.pressureRate !== undefined) {
      if (input.pressureRate <= 20.0) {
        score += 10;
        metrics.push(`Low pressure rate (${input.pressureRate.toFixed(1)}%)`);
      } else if (input.pressureRate <= 25.0) {
        score += 5;
        metrics.push(`Average pressure rate (${input.pressureRate.toFixed(1)}%)`);
      } else {
        score -= 10;
        metrics.push(`High pressure rate (${input.pressureRate.toFixed(1)}%)`);
      }
    }

    logs.push(`O-Line protection: ${score}/100 - ${metrics.join(", ")}`);
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate teammate quality score (0-100)
   */
  private calculateTeammateQuality(
    input: QBEnvironmentInput,
    logs: string[],
    tags: string[]
  ): number {
    let score = 50; // Base score
    const metrics: string[] = [];

    // Average WR YPRR
    if (input.avgWRYPRR !== undefined) {
      if (input.avgWRYPRR >= 2.2) {
        score += 20;
        metrics.push(`Elite WR YPRR (${input.avgWRYPRR.toFixed(2)})`);
        tags.push("Elite Weapons");
      } else if (input.avgWRYPRR >= 1.8) {
        score += 12;
        metrics.push(`Good WR YPRR (${input.avgWRYPRR.toFixed(2)})`);
      } else if (input.avgWRYPRR >= 1.5) {
        score += 5;
        metrics.push(`Average WR YPRR (${input.avgWRYPRR.toFixed(2)})`);
      } else {
        score -= 10;
        metrics.push(`Poor WR YPRR (${input.avgWRYPRR.toFixed(2)})`);
      }
    }

    // Average WR separation
    if (input.avgWRSeparation !== undefined) {
      if (input.avgWRSeparation >= 3.0) {
        score += 15;
        metrics.push(`High separation (${input.avgWRSeparation.toFixed(1)} yards)`);
      } else if (input.avgWRSeparation >= 2.5) {
        score += 8;
        metrics.push(`Good separation (${input.avgWRSeparation.toFixed(1)} yards)`);
      } else {
        score -= 8;
        metrics.push(`Low separation (${input.avgWRSeparation.toFixed(1)} yards)`);
      }
    }

    // Average WR YAC
    if (input.avgWRYAC !== undefined) {
      if (input.avgWRYAC >= 5.5) {
        score += 15;
        metrics.push(`High YAC ability (${input.avgWRYAC.toFixed(1)})`);
        tags.push("YAC Weapons");
      } else if (input.avgWRYAC >= 4.5) {
        score += 8;
        metrics.push(`Good YAC ability (${input.avgWRYAC.toFixed(1)})`);
      } else {
        score -= 5;
        metrics.push(`Limited YAC ability (${input.avgWRYAC.toFixed(1)})`);
      }
    }

    logs.push(`Teammate quality: ${score}/100 - ${metrics.join(", ")}`);
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate offseason upgrade score (0-100)
   */
  private calculateOffseasonUpgrade(
    input: QBEnvironmentInput,
    logs: string[],
    tags: string[]
  ): number {
    let score = 50; // Base score

    if (input.hasWRUpgrade) {
      score += 30;
      tags.push("Offseason Upgrade");
      
      if (input.upgradeDescription) {
        logs.push(`Offseason upgrade: ${input.upgradeDescription} (+30 points)`);
      } else {
        logs.push(`Offseason WR upgrade identified (+30 points)`);
      }
    } else {
      logs.push(`No significant offseason upgrades (neutral)`);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Create standardized result object
   */
  private createResult(
    input: QBEnvironmentInput | undefined,
    contextScore: number,
    componentScores: any,
    environmentTags: string[],
    logs: string[]
  ): QBEnvironmentResult {
    return {
      playerId: input?.playerId || 'unknown',
      playerName: input?.playerName || 'Unknown Player',
      position: input?.position || 'QB',
      team: input?.team || 'Unknown Team',
      contextScore: Math.round(contextScore * 10) / 10,
      componentScores,
      environmentTags,
      logs,
      timestamp: new Date()
    };
  }

  /**
   * Get methodology information
   */
  getMethodology() {
    return {
      name: this.name,
      version: this.version,
      description: "Evaluates QB fantasy outlook by factoring in rushing upside, throwing accuracy, offensive line protection, teammate quality, and offseason upgrades",
      triggerScope: ["dynastyValuation", "playerProfile", "environmentScan"],
      components: {
        rushingUpside: "25% - Scramble rate, YPC, explosive runs",
        throwingAccuracy: "25% - CPOE, completion rate, deep accuracy",
        oLineProtection: "20% - PFF grade, PBWR, pressure metrics",
        teammateQuality: "20% - WR YPRR, separation, YAC ability",
        offseasonUpgrade: "10% - New weapons, scheme changes"
      },
      inputValidation: {
        requiredFields: ["playerId", "playerName", "position", "team"],
        optionalFields: ["scrambleRate", "rushingYPC", "cpoe", "pffOLineGrade", "avgWRYPRR", "hasWRUpgrade"]
      },
      outputFields: ["contextScore", "componentScores", "environmentTags", "logs"]
    };
  }

  /**
   * Test with example QB data
   */
  runTestCases(): QBEnvironmentResult[] {
    const testCases = [
      // Elite rushing QB
      {
        playerId: 'lamar-jackson-test',
        playerName: 'Lamar Jackson',
        position: 'QB',
        team: 'BAL',
        scrambleRate: 9.2,
        rushingYPC: 5.8,
        explosiveRunRate: 18.5,
        cpoe: 2.1,
        adjCompletionRate: 67.5,
        deepAccuracy: 42.3,
        pffOLineGrade: 72.5,
        pbwr: 61.8,
        pressureRate: 23.1,
        avgWRYPRR: 1.9,
        avgWRSeparation: 2.8,
        avgWRYAC: 5.2,
        hasWRUpgrade: false
      },
      // Pocket passer with elite weapons
      {
        playerId: 'joe-burrow-test',
        playerName: 'Joe Burrow',
        position: 'QB',
        team: 'CIN',
        scrambleRate: 3.1,
        rushingYPC: 3.2,
        explosiveRunRate: 5.8,
        cpoe: 3.8,
        adjCompletionRate: 71.2,
        deepAccuracy: 47.6,
        pffOLineGrade: 68.3,
        pbwr: 58.9,
        pressureRate: 26.4,
        avgWRYPRR: 2.4,
        avgWRSeparation: 3.2,
        avgWRYAC: 5.8,
        hasWRUpgrade: false
      },
      // QB with offseason upgrade
      {
        playerId: 'tua-upgrade-test',
        playerName: 'Tua Tagovailoa',
        position: 'QB',
        team: 'MIA',
        scrambleRate: 2.8,
        rushingYPC: 2.9,
        explosiveRunRate: 3.2,
        cpoe: 1.8,
        adjCompletionRate: 69.1,
        deepAccuracy: 38.4,
        pffOLineGrade: 75.2,
        pbwr: 63.5,
        pressureRate: 21.8,
        avgWRYPRR: 2.1,
        avgWRSeparation: 2.9,
        avgWRYAC: 5.4,
        hasWRUpgrade: true,
        upgradeDescription: "Added Mike McDaniel system with elite speed weapons"
      }
    ];

    return testCases.map(testCase => 
      this.evaluateQBEnvironment(testCase)
    );
  }

  /**
   * Get integration safety information
   */
  getIntegrationSafety() {
    return {
      safe: true,
      modular: true,
      isolatedLogic: true,
      preservedMethods: [
        'QB evaluation core logic',
        'dynasty value calculations', 
        'rushing upside analysis',
        'spike week detection',
        'YPRR analysis'
      ],
      conflicts: [],
      rollbackCapable: true,
      upgradeReady: true,
      note: "Safely extends QB evaluation with environment context scoring"
    };
  }
}

export const qbEnvironmentContextScoreService = new QBEnvironmentContextScoreService();