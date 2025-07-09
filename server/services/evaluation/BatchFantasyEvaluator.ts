/**
 * Batch Fantasy Evaluator v1.3
 * Prometheus Dynasty Analytics - Multi-position batch processing with Promethean multiplier logic
 * Enhanced QB evaluation with dual-threat boost for elite prospects like Allen, Lamar, Daniels
 */

// Core input/output interfaces
interface PlayerInput {
  playerName: string;
  season: number;
  position: string;
  [key: string]: any; // Additional position-specific fields
}

interface EvaluationOutput {
  contextScore: number;
  logs: string[];
  tags: string[];
  subScores: {
    [key: string]: number;
  };
  lastEvaluatedSeason: number;
  playerName: string;
}

interface BatchResult {
  QB: EvaluationOutput[];
  RB: EvaluationOutput[];
  WR: EvaluationOutput[];
  TE: EvaluationOutput[];
  totalEvaluated: number;
  errorCount: number;
  rejectedPre2024: number;
}

// Position-specific input types - Updated for v1.3
interface QBPlayerInput extends PlayerInput {
  position: 'QB';
  scrambleRate: number; // 0–1
  rushYPG: number;
  yardsPerCarry: number;
  rushTDRate: number; // 0–1, added for Promethean
  explosiveRushRate: number; // 0–1
  explosivePlayCount: number; // Added for Promethean, 20+ yd plays
  cpoe: number; // -10 to 10
  adjustedCompletionPct: number; // 0–1
  deepAccuracyRate: number; // 0–1
  pressureToSackRate: number; // 0–1
  tdRate: number; // 0–1, added for Promethean
  fantasyPointsPerGame: number; // Added for Promethean
  team: {
    passBlockGrade: number; // 0–100
    passBlockWinRate: number; // 0–1
    pressureRateAllowed: number; // 0–1
    pressureRateOverExpected: number;
    wrYPRR: number;
    wr1DRR: number;
    yardsPerTarget: number;
    yacPerReception: number;
    contestedCatchRate: number; // 0–1
    routeWinRateRanks: number[]; // 0–100
    offseasonWRUpgrades: string[];
  };
}

interface RBPlayerInput extends PlayerInput {
  position: 'RB';
  rushingYards: number;
  rushingTDs: number;
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  targets: number;
  yardsAfterContact?: number;
  breakaways?: number;
}

interface WRPlayerInput extends PlayerInput {
  position: 'WR';
  tpRR: number; // Targets per route run
  ypRR: number; // Yards per route run
  routeParticipation: number;
  targetShare: number;
  airYardShare: number;
  yacPerReception?: number;
  separationRate?: number;
}

interface TEPlayerInput extends PlayerInput {
  position: 'TE';
  tpRR: number;
  ypRR: number;
  routeParticipation: number;
  redZoneTargetShare: number;
  expectedTDs: number;
  actualTDs: number;
  targetShare: number;
  catchRateOverExpected?: number;
}

class BatchFantasyEvaluator {
  private version = '1.3';
  private qbService: any;
  private rbService: any;
  private wrService: any;
  private teService: any;

  constructor() {
    // Services will be dynamically imported to avoid circular dependencies
    this.initializeServices();
  }

  private async initializeServices() {
    try {
      // Import all evaluation services
      const { qbEnvironmentContextScoreService } = await import('../../qbEnvironmentContextScore');
      const { rbTouchdownSustainabilityAnalyzer } = await import('../../rbTouchdownSustainability');
      const { wrEvaluationService } = await import('../../wrEvaluationForecastScore');
      const { teEvaluationService } = await import('./teEvaluationService');

      this.qbService = qbEnvironmentContextScoreService;
      this.rbService = rbTouchdownSustainabilityAnalyzer;
      this.wrService = wrEvaluationService;
      this.teService = teEvaluationService;
    } catch (error) {
      console.error('❌ Failed to initialize evaluation services:', error);
      throw new Error('Batch evaluator initialization failed');
    }
  }

  /**
   * Validate player input for 2024+ data requirement
   */
  private validatePlayerData(player: PlayerInput): { valid: boolean; reason?: string } {
    if (!player.season || player.season < 2024) {
      return {
        valid: false,
        reason: `Pre-2024 data rejected: ${player.playerName} (${player.season})`
      };
    }

    if (!player.playerName || !player.position) {
      return {
        valid: false,
        reason: `Missing required fields: ${player.playerName || 'Unknown'}`
      };
    }

    const validPositions = ['QB', 'RB', 'WR', 'TE'];
    if (!validPositions.includes(player.position.toUpperCase())) {
      return {
        valid: false,
        reason: `Invalid position: ${player.position} for ${player.playerName}`
      };
    }

    return { valid: true };
  }

  /**
   * Create default rejection output for invalid players
   */
  private createRejectionOutput(player: PlayerInput, reason: string): EvaluationOutput {
    return {
      contextScore: 0,
      logs: [reason, 'Player evaluation skipped'],
      tags: ['Rejected', 'Pre-2024 Data'],
      subScores: {},
      lastEvaluatedSeason: player.season || 2024,
      playerName: player.playerName || 'Unknown Player'
    };
  }

  /**
   * Evaluate a single player using appropriate position service
   */
  private async evaluatePlayer(player: PlayerInput): Promise<EvaluationOutput> {
    const validation = this.validatePlayerData(player);
    if (!validation.valid) {
      return this.createRejectionOutput(player, validation.reason!);
    }

    const position = player.position.toUpperCase();
    const playerName = player.playerName;

    try {
      // Ensure services are initialized
      if (!this.qbService || !this.rbService || !this.wrService || !this.teService) {
        await this.initializeServices();
      }

      switch (position) {
        case 'QB': {
          // Convert to QB environment input format
          const qbInput = {
            playerId: `qb-${player.playerName?.toLowerCase().replace(/\s+/g, '-')}`,
            playerName: player.playerName,
            position: 'QB',
            team: 'TEST',
            season: player.season,
            scrambleRate: (player as QBPlayerInput).scrambleRate || 0.1,
            rushingYPC: (player as QBPlayerInput).yardsPerCarry || 3.5,
            explosiveRunRate: ((player as QBPlayerInput).explosiveRushRate || 0.1) * 100,
            cpoe: (player as QBPlayerInput).cpoe || 0.0,
            adjCompletionRate: ((player as QBPlayerInput).adjustedCompletionPct || 0.6) * 100,
            deepAccuracy: ((player as QBPlayerInput).deepAccuracyRate || 0.4) * 100,
            pffOLineGrade: (player as QBPlayerInput).team?.passBlockGrade || 60,
            pbwr: ((player as QBPlayerInput).team?.passBlockWinRate || 0.5) * 100,
            pressureRate: ((player as QBPlayerInput).team?.pressureRateAllowed || 0.4) * 100,
            avgWRYPRR: (player as QBPlayerInput).team?.wrYPRR || 1.5,
            avgWRSeparation: 2.5,
            avgWRYAC: (player as QBPlayerInput).team?.yacPerReception || 5.0,
            hasWRUpgrade: true,
            upgradeDescription: (player as QBPlayerInput).team?.offseasonWRUpgrades?.join(', ') || 'None'
          };
          
          if (!this.qbService) {
            throw new Error('QB service not initialized');
          }
          
          const result = this.qbService.evaluateQBEnvironment(qbInput);
          
          // Apply Promethean multiplier for dual-threat QBs
          const enhancedResult = this.applyPrometheanMultiplier(player as QBPlayerInput, result);
          
          return {
            contextScore: enhancedResult.contextScore,
            logs: enhancedResult.logs,
            tags: enhancedResult.tags,
            subScores: enhancedResult.subScores,
            lastEvaluatedSeason: player.season,
            playerName: player.playerName
          };
        }
        case 'RB': {
          const result = this.rbService.evaluate(player as RBPlayerInput);
          return { ...result, playerName };
        }
        case 'WR': {
          const result = this.wrService.evaluate(player as WRPlayerInput);
          return { ...result, playerName };
        }
        case 'TE': {
          const result = this.teService.evaluate(player as TEPlayerInput);
          return { ...result, playerName };
        }
        default:
          return {
            contextScore: 0,
            logs: [`Unsupported position: ${position}`],
            tags: ['Error'],
            subScores: {},
            lastEvaluatedSeason: 2024,
            playerName,
          };
      }
    } catch (err) {
      return {
        contextScore: 0,
        logs: [`Error evaluating player: ${(err as Error).message}`],
        tags: ['Evaluation Error'],
        subScores: {},
        lastEvaluatedSeason: 2024,
        playerName: player.playerName || 'Unknown Player',
      };
    }
  }

  /**
   * Batch evaluate multiple players using parallel processing
   */
  async evaluateBatch(players: PlayerInput[]): Promise<BatchResult> {
    console.log(`🔄 Starting batch evaluation of ${players.length} players...`);

    if (!players || players.length === 0) {
      throw new Error('No players provided for batch evaluation');
    }

    // Initialize result structure
    const results: BatchResult = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      totalEvaluated: 0,
      errorCount: 0,
      rejectedPre2024: 0
    };

    // Parallel evaluation using Promise.all
    const evaluations = await Promise.all(
      players.map(player => this.evaluatePlayer(player))
    );

    // Process results and categorize by position
    for (let i = 0; i < evaluations.length; i++) {
      const evalResult = evaluations[i];
      const originalPlayer = players[i];
      
      results.totalEvaluated++;

      // Count errors and rejections - with safety checks
      const tags = evalResult.tags || [];
      if (tags.includes('Error') || tags.includes('Evaluation Error')) {
        results.errorCount++;
        continue;
      }

      if (tags.includes('Rejected') || tags.includes('Pre-2024 Data')) {
        results.rejectedPre2024++;
        continue;
      }

      // Add to appropriate position array
      const position = originalPlayer.position.toUpperCase();
      if (position in results && Array.isArray(results[position as keyof BatchResult])) {
        (results[position as keyof BatchResult] as EvaluationOutput[]).push(evalResult);
      }
    }

    // Sort all positions by contextScore + usageProfile tiebreaker
    const sortByScore = (a: EvaluationOutput, b: EvaluationOutput) => {
      if (b.contextScore !== a.contextScore) {
        return b.contextScore - a.contextScore;
      }
      return (b.subScores?.usageProfile || 0) - (a.subScores?.usageProfile || 0);
    };

    results.QB.sort(sortByScore);
    results.RB.sort(sortByScore);
    results.WR.sort(sortByScore);
    results.TE.sort(sortByScore);

    console.log(`✅ Batch evaluation complete: ${results.totalEvaluated} players processed`);
    console.log(`📊 Results: QB(${results.QB.length}), RB(${results.RB.length}), WR(${results.WR.length}), TE(${results.TE.length})`);
    console.log(`⚠️ Errors: ${results.errorCount}, Rejected: ${results.rejectedPre2024}`);

    return results;
  }

  /**
   * Apply Promethean multiplier for elite dual-threat QBs
   * Boosts Allen, Lamar, Daniels above traditional pocket passers
   */
  private applyPrometheanMultiplier(qb: QBPlayerInput, result: any): any {
    const logs = [...(result.logs || [])];
    const tags = [...(result.environmentTags || [])];
    let prometheanFlags = 0;
    let bonus = 0;

    // Flag 1: Elite Rush Profile (30+ rush YPG, 5%+ rush TD rate, 10%+ scramble rate)
    if (qb.rushYPG > 30 && qb.rushTDRate > 0.05 && qb.scrambleRate > 0.1) {
      prometheanFlags++;
      logs.push('Promethean: Elite Rush Profile');
      tags.push('Elite Rush Profile');
    }

    // Flag 2: Explosive Creator (15+ explosive plays or high explosive rate + deep accuracy)
    if (qb.explosivePlayCount > 15 || (qb.explosiveRushRate > 0.1 && qb.deepAccuracyRate > 0.5)) {
      prometheanFlags++;
      logs.push('Promethean: Explosive Creator');
      tags.push('Explosive Creator');
    }

    // Flag 3: High Fantasy Production (22+ PPG)
    if (qb.fantasyPointsPerGame > 22) {
      prometheanFlags++;
      logs.push('Promethean: Elite Fantasy Production');
      tags.push('Elite Fantasy Production');
    }

    // Flag 4: TD Machine (5%+ total TD rate)
    if (qb.tdRate > 0.05) {
      prometheanFlags++;
      logs.push('Promethean: TD Machine');
      tags.push('TD Machine');
    }

    // Flag 5: Pressure Warrior (low pressure-to-sack rate with high mobility)
    if (qb.pressureToSackRate < 0.15 && qb.scrambleRate > 0.12) {
      prometheanFlags++;
      logs.push('Promethean: Pressure Warrior');
      tags.push('Pressure Warrior');
    }

    // Apply bonus based on flags hit
    if (prometheanFlags >= 4) {
      bonus = 15; // Elite tier (Allen, Lamar, Daniels)
      tags.push('Promethean Elite');
    } else if (prometheanFlags >= 3) {
      bonus = 10; // Strong tier  
      tags.push('Promethean Strong');
    } else if (prometheanFlags >= 2) {
      bonus = 5; // Emerging tier
      tags.push('Promethean Emerging');
    }

    // Update environment classification if bonus applied
    let environment = 'Average Environment';
    const finalScore = result.contextScore + bonus;
    
    if (finalScore >= 75) {
      environment = 'Elite Environment';
    } else if (finalScore >= 65) {
      environment = 'Strong Environment';
    } else if (finalScore >= 55) {
      environment = 'Average Environment';
    } else {
      environment = 'Challenging Environment';
    }

    // Remove old environment tag and add new one
    const filteredTags = tags.filter(tag => !tag.includes('Environment'));
    filteredTags.push(environment);

    logs.push(`QB: ${qb.playerName}`);
    logs.push(`Promethean Flags Hit: ${prometheanFlags}/5`);
    logs.push(`Bonus Applied: +${bonus}`);
    logs.push(`Final Environment: ${environment.replace(' Environment', '').toUpperCase()}`);

    return {
      contextScore: finalScore,
      logs,
      environmentTags: filteredTags,
      componentScores: result.componentScores,
      subScores: result.componentScores
    };
  }

  /**
   * Get top N players per position from batch results
   */
  getTopPlayersByPosition(batchResult: BatchResult, topN: number = 5): BatchResult {
    return {
      QB: batchResult.QB.slice(0, topN),
      RB: batchResult.RB.slice(0, topN),
      WR: batchResult.WR.slice(0, topN),
      TE: batchResult.TE.slice(0, topN),
      totalEvaluated: batchResult.totalEvaluated,
      errorCount: batchResult.errorCount,
      rejectedPre2024: batchResult.rejectedPre2024
    };
  }

  /**
   * Generate test data for batch evaluation
   */
  generateTestPlayers(): PlayerInput[] {
    return [
      // QB Test Players
      {
        playerName: "Jayden Daniels",
        season: 2024,
        position: "QB",
        passingYards: 3568,
        passingTDs: 25,
        interceptions: 9,
        rushingYards: 891,
        rushingTDs: 6,
        completionPercentage: 69.0,
        epaPerPlay: 0.23,
        qbr: 78.5
      },
      {
        playerName: "Josh Allen",
        season: 2024,
        position: "QB",
        passingYards: 4306,
        passingTDs: 28,
        interceptions: 6,
        rushingYards: 553,
        rushingTDs: 15,
        completionPercentage: 63.6,
        epaPerPlay: 0.25,
        qbr: 81.2
      },
      // RB Test Players
      {
        playerName: "Saquon Barkley",
        season: 2024,
        position: "RB",
        rushingYards: 2005,
        rushingTDs: 13,
        receptions: 33,
        receivingYards: 278,
        receivingTDs: 2,
        targets: 43,
        yardsAfterContact: 894,
        breakaways: 9
      },
      // WR Test Players
      {
        playerName: "Ja'Marr Chase",
        season: 2024,
        position: "WR",
        tpRR: 0.28,
        ypRR: 2.4,
        routeParticipation: 0.88,
        targetShare: 0.272,
        airYardShare: 0.327,
        yacPerReception: 6.8,
        separationRate: 0.75
      },
      // TE Test Players
      {
        playerName: "Brock Bowers",
        season: 2024,
        position: "TE",
        tpRR: 0.22,
        ypRR: 1.9,
        routeParticipation: 0.78,
        redZoneTargetShare: 0.16,
        expectedTDs: 4.2,
        actualTDs: 5,
        targetShare: 0.18,
        catchRateOverExpected: 0.08
      },
      // Pre-2024 player (should be rejected)
      {
        playerName: "Legacy Player",
        season: 2023,
        position: "WR",
        tpRR: 0.20,
        ypRR: 1.5,
        routeParticipation: 0.70,
        targetShare: 0.15,
        airYardShare: 0.20
      }
    ];
  }
}

// Export singleton instance
export const batchFantasyEvaluator = new BatchFantasyEvaluator();
export default batchFantasyEvaluator;

// Export types for external use
export type { PlayerInput, EvaluationOutput, BatchResult, QBPlayerInput, RBPlayerInput, WRPlayerInput, TEPlayerInput };