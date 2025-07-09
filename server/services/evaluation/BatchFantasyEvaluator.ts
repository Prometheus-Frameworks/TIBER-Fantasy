/**
 * Batch Fantasy Evaluator
 * Parallel evaluation system for QB, RB, WR, TE positions using respective evaluation services
 * Prometheus Dynasty Analytics - Multi-position batch processing
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

// Position-specific input types
interface QBPlayerInput extends PlayerInput {
  position: 'QB';
  passingYards: number;
  passingTDs: number;
  interceptions: number;
  rushingYards: number;
  rushingTDs: number;
  completionPercentage: number;
  epaPerPlay?: number;
  qbr?: number;
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
      const { wrEvaluationService } = await import('./wrEvaluationService');
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
          const result = this.qbService.evaluate({ player: player as QBPlayerInput });
          return { ...result, playerName };
        }
        case 'RB': {
          const result = this.rbService.evaluate(player as RBPlayerInput);
          return { ...result, playerName };
        }
        case 'WR': {
          const result = this.wrService.evaluate({ player: player as WRPlayerInput });
          return { ...result, playerName };
        }
        case 'TE': {
          const result = this.teService.evaluate({ player: player as TEPlayerInput });
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

      // Count errors and rejections
      if (evalResult.tags.includes('Error') || evalResult.tags.includes('Evaluation Error')) {
        results.errorCount++;
        continue;
      }

      if (evalResult.tags.includes('Rejected') || evalResult.tags.includes('Pre-2024 Data')) {
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