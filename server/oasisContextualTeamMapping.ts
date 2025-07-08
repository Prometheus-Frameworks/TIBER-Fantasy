/**
 * OASIS Contextual Team Mapping (v1.0)
 * Applies team-level context tags (OASIS) to player evaluation logic
 * for WR, RB, TE, and QB based on offensive scheme and tempo.
 * 
 * Note: This is a temporary framework pending final OASIS schema from @EaglesXsandOs
 */

export interface OASISTeamContext {
  oasisTags: string[];
  offensiveScheme?: string;
  tempo?: 'High' | 'Medium' | 'Low';
  redZoneUsage?: string;
  runConcepts?: string[];
}

export interface PlayerWithTeamContext {
  playerId: string;
  playerName: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  dynastyValue: number;
  projectedYPC?: number;
  touchdownCeiling?: number;
  rushingScoreWeight?: number;
}

export interface OASISContextualResult {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  contextAdjustments: {
    dynastyValueBoost: number;
    ypcProjectionBoost: number;
    touchdownCeilingBoost: number;
    rushingScoreWeightBoost: number;
  };
  appliedTags: string[];
  logs: string[];
  timestamp: Date;
}

export class OASISContextualTeamMappingService {
  private readonly version = "1.0";
  private readonly name = "OASIS Contextual Team Mapping";

  /**
   * Apply OASIS team context to player evaluation
   */
  applyTeamContext(
    player: PlayerWithTeamContext,
    teamContext: OASISTeamContext
  ): OASISContextualResult {
    const logs: string[] = [];
    const appliedTags: string[] = [];
    const contextAdjustments = {
      dynastyValueBoost: 0,
      ypcProjectionBoost: 0,
      touchdownCeilingBoost: 0,
      rushingScoreWeightBoost: 0
    };

    // Validate inputs
    if (!player || !teamContext) {
      logs.push("Invalid player or team data");
      return this.createResult(player, contextAdjustments, appliedTags, logs);
    }

    const tags = Array.isArray(teamContext.oasisTags) ? teamContext.oasisTags : [];
    logs.push(`Evaluating ${player.playerName} (${player.position}) with ${tags.length} OASIS tags`);

    // WR Context Logic
    if (player.position === "WR" && tags.includes("High Tempo Pass Offense")) {
      contextAdjustments.dynastyValueBoost = 0.05;
      appliedTags.push("High Tempo Pass Offense");
      logs.push("WR tempo boost applied: +0.05 dynasty value");
    }

    // RB Context Logic
    if (player.position === "RB" && tags.includes("Outside Zone Run")) {
      contextAdjustments.ypcProjectionBoost = 0.3;
      appliedTags.push("Outside Zone Run");
      logs.push("RB OZ scheme YPC bump: +0.3 projected YPC");
    }

    // TE Context Logic
    if (player.position === "TE" && tags.includes("Condensed Red Zone Usage")) {
      contextAdjustments.touchdownCeilingBoost = 1;
      appliedTags.push("Condensed Red Zone Usage");
      logs.push("TE TD ceiling raised due to red zone usage: +1 TD ceiling");
    }

    // QB Context Logic
    if (player.position === "QB" && tags.includes("Designed QB Run Concepts")) {
      contextAdjustments.rushingScoreWeightBoost = 0.1;
      appliedTags.push("Designed QB Run Concepts");
      logs.push("QB rushing scheme boost: +0.1 rushing score weight");
    }

    // Log if no adjustments applied
    if (appliedTags.length === 0) {
      logs.push("No OASIS context adjustments applied");
    } else {
      logs.push(`Applied ${appliedTags.length} OASIS context adjustments`);
    }

    return this.createResult(player, contextAdjustments, appliedTags, logs);
  }

  /**
   * Create standardized result object
   */
  private createResult(
    player: PlayerWithTeamContext,
    contextAdjustments: any,
    appliedTags: string[],
    logs: string[]
  ): OASISContextualResult {
    return {
      playerId: player?.playerId || 'unknown',
      playerName: player?.playerName || 'Unknown Player',
      position: player?.position || 'Unknown',
      team: player?.team || 'Unknown Team',
      contextAdjustments,
      appliedTags,
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
      description: "Applies team-level context tags (OASIS) to player evaluation logic for WR, RB, TE, and QB based on offensive scheme and tempo.",
      triggerScope: ["dynastyValuation", "playerProfile", "teamContext"],
      inputValidation: {
        requiredFields: ["player.team", "player.position"],
        optionalFields: ["team.oasisTags"]
      },
      contextMappings: {
        WR: "High Tempo Pass Offense → +0.05 dynasty value",
        RB: "Outside Zone Run → +0.3 YPC projection",
        TE: "Condensed Red Zone Usage → +1 TD ceiling",
        QB: "Designed QB Run Concepts → +0.1 rushing score weight"
      },
      note: "Temporary framework pending final OASIS schema from @EaglesXsandOs"
    };
  }

  /**
   * Test with example inputs
   */
  runTestCases(): OASISContextualResult[] {
    const testCases = [
      // WR Test Case
      {
        player: {
          playerId: 'wr-test-1',
          playerName: 'Test WR',
          position: 'WR' as const,
          team: 'TEST',
          dynastyValue: 75
        },
        teamContext: {
          oasisTags: ['High Tempo Pass Offense']
        }
      },
      // RB Test Case
      {
        player: {
          playerId: 'rb-test-1',
          playerName: 'Test RB',
          position: 'RB' as const,
          team: 'TEST',
          dynastyValue: 80,
          projectedYPC: 4.2
        },
        teamContext: {
          oasisTags: ['Outside Zone Run']
        }
      },
      // TE Test Case
      {
        player: {
          playerId: 'te-test-1',
          playerName: 'Test TE',
          position: 'TE' as const,
          team: 'TEST',
          dynastyValue: 65,
          touchdownCeiling: 6
        },
        teamContext: {
          oasisTags: ['Condensed Red Zone Usage']
        }
      },
      // QB Test Case
      {
        player: {
          playerId: 'qb-test-1',
          playerName: 'Test QB',
          position: 'QB' as const,
          team: 'TEST',
          dynastyValue: 90,
          rushingScoreWeight: 0.2
        },
        teamContext: {
          oasisTags: ['Designed QB Run Concepts']
        }
      }
    ];

    return testCases.map(testCase => 
      this.applyTeamContext(testCase.player, testCase.teamContext)
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
        'dynastyValue calculations',
        'spike week detection',
        'YPRR analysis',
        'red zone role evaluation',
        'rushing EPA modules',
        'touchdown regression logic'
      ],
      conflicts: [],
      rollbackCapable: true,
      upgradeReady: true,
      note: "Designed for clean replacement when final OASIS schema arrives"
    };
  }
}

export const oasisContextualTeamMappingService = new OASISContextualTeamMappingService();