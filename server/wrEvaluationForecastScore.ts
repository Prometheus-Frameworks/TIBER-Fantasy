/**
 * WR Environment & Forecast Score (v1.1) 
 * Prometheus WR Evaluation layer with dynamic logic for dynasty forecasting
 * Focus: Usage profile, efficiency, role security, and growth trajectory
 */

interface PlayerInput {
  season: number;
  position: string;
  tpRR: number; // Targets per route run
  ypRR: number; // Yards per route run
  oneDRR: number; // First downs per route run
  firstReadTargetPct: number;
  fantasyPointsPerGame: number;
  dropRate: number; // 0–1
  routeWinRate: number; // 0–1
  age: number;
  draftCapital: 'R1' | 'R2' | 'R3' | 'R4+' | 'UDFA';
  explosivePlayRate: number;
  slotRate: number; // 0–1
  routeParticipation: number; // 0–1
  teamPassAttemptsPerGame: number;
  wrRoomTargetCompetition: number; // 0–3
  qbStabilityScore: number; // 0–1
  contractYearsRemaining: number;
  previousSeasons?: { 
    season: number; 
    ypRR: number; 
    tpRR: number; 
    targetShare: number; 
    firstReadTargetPct: number; 
    fantasyPointsPerGame: number 
  }[];
}

interface EvaluationOutput {
  contextScore: number; // 0–100
  logs: string[];
  tags: string[];
  subScores: {
    usageProfile: number;
    efficiency: number;
    roleSecurity: number;
    growthTrajectory: number;
  };
  lastEvaluatedSeason: number;
}

// Extended interface for compatibility with existing system
export interface WRPlayerInput extends PlayerInput {
  playerId: string;
  playerName: string;
  team: string;
  // Optional fields for backward compatibility
  airYardShare?: number;
  yacPerReception?: number;
  injuryHistory?: 'clean' | 'minor' | 'concerning' | 'major';
  redZoneTargetShare?: number;
  offseasonChanges?: {
    newQB?: boolean;
    newOC?: boolean;
    wrAdditions?: boolean;
    schemeChange?: boolean;
  };
}

export interface WREvaluationResult {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  contextScore: number;
  forecastGrade: 'ELITE' | 'STRONG' | 'SOLID' | 'CONCERNING' | 'AVOID';
  componentScores: {
    usageProfile: number;
    efficiency: number;
    roleSecurity: number;
    growthTrajectory: number;
  };
  forecastTags: string[];
  logs: string[];
  riskFactors: string[];
  upside: string[];
  lastEvaluatedSeason: number;
  timestamp: Date;
}

class WREvaluationService {
  private version = '1.2';
  private readonly weights = {
    usageProfile: 0.3,
    efficiency: 0.3,
    roleSecurity: 0.2,
    growthTrajectory: 0.2,
  };

  evaluate(player: PlayerInput): EvaluationOutput {
    const logs: string[] = [];
    const tags: string[] = [];

    const usage = this.evaluateUsageProfile(player);
    const efficiency = this.evaluateEfficiency(player);
    const security = this.evaluateRoleSecurity(player);
    const growth = this.evaluateGrowthTrajectory(player);

    logs.push(...usage.logs, ...efficiency.logs, ...security.logs, ...growth.logs);
    tags.push(...usage.tags, ...efficiency.tags, ...security.tags, ...growth.tags);

    const contextScore =
      usage.score * this.weights.usageProfile +
      efficiency.score * this.weights.efficiency +
      security.score * this.weights.roleSecurity +
      growth.score * this.weights.growthTrajectory;

    return {
      contextScore: Math.round(contextScore),
      logs,
      tags: [...new Set(tags)],
      subScores: {
        usageProfile: usage.score,
        efficiency: efficiency.score,
        roleSecurity: security.score,
        growthTrajectory: growth.score,
      },
      lastEvaluatedSeason: player.season,
    };
  }

  // Wrapper method for backward compatibility with existing system
  evaluateWR(input: WRPlayerInput): WREvaluationResult {
    const logs: string[] = [];
    const forecastTags: string[] = [];
    const riskFactors: string[] = [];
    const upside: string[] = [];
    
    // Validate inputs
    if (!input || input.position !== 'WR') {
      logs.push("Invalid input or non-WR player");
      return this.createResult(input, 0, {
        usageProfile: 0,
        efficiency: 0,
        roleSecurity: 0,
        growthTrajectory: 0
      }, forecastTags, logs, riskFactors, upside, 'AVOID');
    }

    // Convert to core PlayerInput format
    const playerInput: PlayerInput = {
      season: input.season,
      position: input.position,
      tpRR: input.tpRR,
      ypRR: input.ypRR,
      oneDRR: input.oneDRR,
      firstReadTargetPct: input.firstReadTargetPct,
      fantasyPointsPerGame: input.fantasyPointsPerGame || 0,
      dropRate: input.dropRate,
      routeWinRate: input.routeWinRate,
      age: input.age,
      draftCapital: input.draftCapital,
      explosivePlayRate: input.explosivePlayRate,
      slotRate: input.slotRate,
      routeParticipation: input.routeParticipation,
      teamPassAttemptsPerGame: input.teamPassAttemptsPerGame,
      wrRoomTargetCompetition: input.wrRoomTargetCompetition,
      qbStabilityScore: input.qbStabilityScore,
      contractYearsRemaining: input.contractYearsRemaining || 0,
      previousSeasons: input.previousSeasons
    };

    // Use core evaluation
    const result = this.evaluate(playerInput);
    
    // Convert to expected WREvaluationResult format
    const forecastGrade = this.determineForecastGrade(result.contextScore, result.subScores, []);
    
    return this.createResult(
      input, 
      result.contextScore, 
      result.subScores, 
      result.tags, 
      result.logs, 
      riskFactors, 
      upside, 
      forecastGrade
    );
  }

  private evaluateUsageProfile(player: PlayerInput): { score: number; logs: string[]; tags: string[] } {
    let score = 0;
    const logs: string[] = [];
    const tags: string[] = [];

    if (player.tpRR > 0.22) { 
      score += 25; 
      logs.push('High TPRR'); 
      tags.push('Alpha Usage'); 
    }
    
    if (player.firstReadTargetPct > 0.25) { 
      score += 20; 
      logs.push('Strong First Read %'); 
    }
    
    if (player.routeParticipation > 0.9) { 
      score += 20; 
      logs.push('Elite Route Participation'); 
    }
    
    if (player.teamPassAttemptsPerGame > 30) { 
      score += 15; 
      logs.push('High Pass Volume'); 
    }
    
    if (player.tpRR < 0.15) { 
      score -= 20; 
      logs.push('Low TPRR'); 
      tags.push('Spike Risk'); 
    }

    return { score: Math.max(0, Math.min(score, 100)), logs, tags };
  }

  private evaluateEfficiency(player: PlayerInput): { score: number; logs: string[]; tags: string[] } {
    let score = 0;
    const logs: string[] = [];
    const tags: string[] = [];

    if (player.ypRR > 2.0) { 
      score += 25; 
      logs.push('Elite YPRR'); 
      tags.push('Efficient Weapon'); 
    }
    else if (player.ypRR > 1.7) { 
      score += 15; 
      logs.push('Strong YPRR'); 
    }
    else if (player.ypRR < 1.3) { 
      score -= 15; 
      logs.push('Inefficient YPRR'); 
    }

    if (player.oneDRR > 0.08) { 
      score += 15; 
      logs.push('High First Down Rate'); 
    }
    
    if (player.dropRate < 0.05) { 
      score += 10; 
      logs.push('Reliable Hands'); 
    }
    else if (player.dropRate > 0.08) { 
      score -= 10; 
      logs.push('Drop Concerns'); 
    }

    if (player.routeWinRate > 0.5) { 
      score += 10; 
      logs.push('Good Route Win Rate'); 
    }
    else if (player.routeWinRate < 0.35) { 
      score -= 10; 
      logs.push('Poor Route Win Rate'); 
    }

    if (player.explosivePlayRate > 0.15) { 
      score += 10; 
      logs.push('Explosive Playmaker'); 
      tags.push('Big Play Threat'); 
    }
    else if (player.explosivePlayRate < 0.1) { 
      score -= 10; 
      logs.push('Low Explosive Plays'); 
    }

    return { score: Math.max(0, Math.min(score, 100)), logs, tags };
  }

  private evaluateRoleSecurity(player: PlayerInput): { score: number; logs: string[]; tags: string[] } {
    let score = 0;
    const logs: string[] = [];
    const tags: string[] = [];

    if (player.routeParticipation > 0.85) { 
      score += 20; 
      logs.push('Consistent Route Role'); 
      tags.push('Role Secure'); 
    }
    
    if (player.slotRate > 0.5) { 
      score += 10; 
      logs.push('Slot Flexibility'); 
    }

    if (player.wrRoomTargetCompetition < 1.5) {
      score += 15;
      logs.push('Low WR Competition');
      tags.push('Path to Volume');
    } else if (player.wrRoomTargetCompetition > 2.0) {
      score -= 10;
      logs.push('Crowded WR Room');
    }

    if (player.qbStabilityScore > 0.7) { 
      score += 10; 
      logs.push('Stable QB Environment'); 
    }
    else if (player.qbStabilityScore < 0.4) { 
      score -= 10; 
      logs.push('Unstable QB Environment'); 
    }

    if (player.contractYearsRemaining >= 2) { 
      score += 10; 
      logs.push('Long-Term Contract'); 
    }

    return { score: Math.max(0, Math.min(score, 100)), logs, tags };
  }

  private evaluateGrowthTrajectory(player: PlayerInput): { score: number; logs: string[]; tags: string[] } {
    let score = 0;
    const logs: string[] = [];
    const tags: string[] = [];

    if (player.age < 25) { 
      score += 20; 
      logs.push('Young with Upside'); 
      tags.push('Breakout Candidate'); 
    }
    else if (player.age >= 29) { 
      score -= 15; 
      logs.push('Age Decline Risk'); 
    }

    // Draft capital evaluation
    switch (player.draftCapital) {
      case 'R1':
        score += 15;
        logs.push('Round 1 Pedigree');
        tags.push('Elite Draft Capital');
        break;
      case 'R2':
        score += 10;
        logs.push('Round 2 Investment');
        break;
      case 'R3':
        score += 5;
        logs.push('Day 2 Pick');
        break;
      case 'UDFA':
        score -= 10;
        logs.push('Undrafted Risk');
        break;
    }

    // Historical growth if available
    if (player.previousSeasons && player.previousSeasons.length > 0) {
      const lastSeason = player.previousSeasons[player.previousSeasons.length - 1];
      
      const yprrGrowth = player.ypRR - lastSeason.ypRR;
      if (yprrGrowth > 0.3) {
        score += 15;
        logs.push('Big YPRR Growth');
        tags.push('Breakout Trend');
      }

      const tpRRGrowth = player.tpRR - lastSeason.tpRR;
      if (tpRRGrowth > 0.04) {
        score += 10;
        logs.push('Increased Target Role');
      }
    }

    if (player.qbStabilityScore > 0.75) {
      score += 10;
      logs.push('Stable QB Environment');
    } else if (player.qbStabilityScore < 0.4) {
      score -= 10;
      logs.push('QB Volatility Risk');
    }

    return { score: Math.max(0, Math.min(score, 100)), logs, tags };
  }

  /**
   * Determine forecast grade based on comprehensive analysis
   */
  private determineForecastGrade(
    contextScore: number,
    componentScores: any,
    riskFactors: string[]
  ): 'ELITE' | 'STRONG' | 'SOLID' | 'CONCERNING' | 'AVOID' {
    
    // High-risk overrides
    if (riskFactors.length >= 4) return 'AVOID';
    if (riskFactors.length >= 3) return 'CONCERNING';
    
    // Score-based grading
    if (contextScore >= 80) return 'ELITE';
    if (contextScore >= 70) return 'STRONG';
    if (contextScore >= 55) return 'SOLID';
    if (contextScore >= 40) return 'CONCERNING';
    return 'AVOID';
  }

  /**
   * Create standardized result object
   */
  private createResult(
    input: WRPlayerInput | undefined,
    contextScore: number,
    componentScores: any,
    forecastTags: string[],
    logs: string[],
    riskFactors: string[],
    upside: string[],
    forecastGrade: 'ELITE' | 'STRONG' | 'SOLID' | 'CONCERNING' | 'AVOID'
  ): WREvaluationResult {
    return {
      playerId: input?.playerId || 'unknown',
      playerName: input?.playerName || 'Unknown Player',
      position: input?.position || 'WR',
      team: input?.team || 'Unknown Team',
      contextScore: Math.round(contextScore * 10) / 10,
      forecastGrade,
      componentScores,
      forecastTags: [...new Set(forecastTags)],
      logs,
      riskFactors: [...new Set(riskFactors)],
      upside: [...new Set(upside)],
      lastEvaluatedSeason: input?.season || new Date().getFullYear(),
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
      description: "Forward-looking dynasty WR evaluation using 4-component scoring with predictive focus",
      triggerScope: ["dynastyValuation", "playerProfile", "forecastAnalysis"],
      components: {
        usageProfile: "35% - TPRR, route participation, first read %, air yard share, team context",
        efficiency: "25% - YPRR, first down rate, route wins, explosive plays, YAC, drops",
        roleSecurity: "25% - Age, draft capital, alignment, contract, injury history, RZ role",
        growthTrajectory: "15% - Historical trends, QB stability, offseason changes"
      },
      inputValidation: {
        requiredFields: ["playerId", "playerName", "position", "team", "season", "tpRR", "ypRR"],
        optionalFields: ["previousSeasons", "offseasonChanges", "injuryHistory", "contractYearsRemaining"]
      },
      outputFields: ["contextScore", "forecastGrade", "componentScores", "forecastTags", "riskFactors", "upside"]
    };
  }

  /**
   * Run test cases with different WR archetypes
   */
  runTestCases(): WREvaluationResult[] {
    const testCases: WRPlayerInput[] = [
      // Elite alpha WR
      {
        playerId: 'alpha-elite-test',
        playerName: 'Elite Alpha WR',
        position: 'WR',
        team: 'TEST',
        season: 2024,
        tpRR: 0.28,
        routeParticipation: 0.95,
        firstReadTargetPct: 0.35,
        teamPassAttemptsPerGame: 38,
        wrRoomTargetCompetition: 25,
        airYardShare: 0.42,
        ypRR: 2.4,
        oneDRR: 0.12,
        dropRate: 2.5,
        explosivePlayRate: 22.0,
        routeWinRate: 52.0,
        yacPerReception: 6.2,
        age: 24,
        draftCapital: 'R1',
        slotRate: 25.0,
        contractYearsRemaining: 4,
        injuryHistory: 'clean',
        redZoneTargetShare: 28.0,
        qbStabilityScore: 85,
        previousSeasons: [{
          season: 2023,
          ypRR: 2.1,
          tpRR: 0.24,
          targetShare: 0.22,
          firstReadTargetPct: 0.30,
          fantasyPointsPerGame: 18.5
        }]
      },
      // Breakout candidate
      {
        playerId: 'breakout-candidate-test',
        playerName: 'Breakout Candidate WR',
        position: 'WR',
        team: 'TEST',
        season: 2024,
        tpRR: 0.21,
        routeParticipation: 0.82,
        firstReadTargetPct: 0.18,
        teamPassAttemptsPerGame: 35,
        wrRoomTargetCompetition: 45,
        airYardShare: 0.28,
        ypRR: 2.0,
        oneDRR: 0.09,
        dropRate: 4.2,
        explosivePlayRate: 18.0,
        routeWinRate: 44.0,
        yacPerReception: 5.1,
        age: 23,
        draftCapital: 'R2',
        slotRate: 55.0,
        contractYearsRemaining: 3,
        injuryHistory: 'minor',
        redZoneTargetShare: 15.0,
        qbStabilityScore: 72,
        previousSeasons: [{
          season: 2023,
          ypRR: 1.6,
          tpRR: 0.16,
          targetShare: 0.14,
          firstReadTargetPct: 0.12,
          fantasyPointsPerGame: 11.2
        }]
      },
      // Aging veteran with risk
      {
        playerId: 'aging-veteran-test',
        playerName: 'Aging Veteran WR',
        position: 'WR',
        team: 'TEST',
        season: 2024,
        tpRR: 0.22,
        routeParticipation: 0.88,
        firstReadTargetPct: 0.25,
        teamPassAttemptsPerGame: 32,
        wrRoomTargetCompetition: 60,
        airYardShare: 0.32,
        ypRR: 1.9,
        oneDRR: 0.08,
        dropRate: 5.8,
        explosivePlayRate: 14.0,
        routeWinRate: 38.0,
        yacPerReception: 4.3,
        age: 31,
        draftCapital: 'R1',
        slotRate: 15.0,
        contractYearsRemaining: 1,
        injuryHistory: 'concerning',
        redZoneTargetShare: 22.0,
        qbStabilityScore: 45,
        previousSeasons: [{
          season: 2023,
          ypRR: 2.1,
          tpRR: 0.24,
          targetShare: 0.28,
          firstReadTargetPct: 0.28,
          fantasyPointsPerGame: 16.8
        }],
        offseasonChanges: {
          newQB: true,
          wrAdditions: true
        }
      }
    ];

    return testCases.map(testCase => this.evaluateWR(testCase));
  }
}

// Export singleton instance as default
export const wrEvaluationService = new WREvaluationService();
export default wrEvaluationService;

// Backward compatibility export
export const wrEvaluationForecastService = wrEvaluationService;