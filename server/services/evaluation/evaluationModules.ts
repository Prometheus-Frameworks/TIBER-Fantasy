/**
 * Evaluation Modules Export
 * Centralizes all position evaluation services for BatchFantasyEvaluator v1.4
 */

// Import actual QB service
import { QBEnvironmentContextScoreService } from '../../qbEnvironmentContextScore.js';

// Default fallback values for missing QB stats
const defaultFallbackValues = {
  scrambleRate: 0.08,
  rushYPG: 15.0,
  yardsPerCarry: 4.5,
  rushTDRate: 0.02,
  explosiveRushRate: 0.08,
  explosivePlayCount: 10,
  cpoe: 0.0,
  adjustedCompletionPct: 0.65,
  deepAccuracyRate: 0.35,
  pressureToSackRate: 0.20,
  tdRate: 0.045,
  fantasyPointsPerGame: 15.0,
  team: {
    passBlockGrade: 65.0,
    passBlockWinRate: 0.58,
    pressureRateAllowed: 0.25,
    pressureRateOverExpected: 0.0,
    wrYPRR: 1.6,
    wr1DRR: 0.18,
    yardsPerTarget: 8.5,
    yacPerReception: 4.5,
    contestedCatchRate: 0.55,
    routeWinRateRanks: [50, 50, 50, 50],
    offseasonWRUpgrades: []
  }
};

// Import actual TE service  
import { teEvaluationService } from './teEvaluationService.js';

// Import actual WR service
import { wrEvaluationForecastService } from '../../wrEvaluationForecastScore.js';

// Import RB sustainability service
import { rbTouchdownSustainabilityAnalyzer } from '../../rbTouchdownSustainability.js';

// Wrapper classes to match BatchFantasyEvaluator interface
class RBEvaluationService {
  async evaluate({ player }: { player: any }) {
    // Use RB sustainability service as evaluation base
    const assessment = rbTouchdownSustainabilityAnalyzer.assessTouchdownSustainability(
      player.playerName.toLowerCase().replace(' ', '-'),
      player.playerName,
      {
        tdRate: 0.035, // Default league average
        totalTouches: player.rushYardsPerGame * 17 / (player.yardsPerCarry || 4.0) + (player.receivingYards / 10),
        inside5Carries: player.redZoneCarries || 5,
        inside10Carries: (player.redZoneCarries || 5) * 1.5,
        teamInside5Share: 0.18,
        teamInside10Share: 0.22,
        qbRedZoneRushes: 15,
        teamRushingAttempts: 450,
        opportunityShare: player.targetShare || 0.15,
        receivingShare: (player.receivingYards / 1000) || 0.1,
        targetShare: player.targetShare || 0.12,
        receivingYards: player.receivingYards || 200,
        receivingTDs: Math.floor(player.receivingYards / 150) || 1,
        backfieldCompetition: []
      },
      player.season || 2024
    );

    // Calculate context score based on RB performance
    let contextScore = 50; // Base score
    
    // Rushing production
    if (player.rushYardsPerGame > 80) contextScore += 20;
    else if (player.rushYardsPerGame > 60) contextScore += 15;
    else if (player.rushYardsPerGame > 40) contextScore += 10;
    
    // Efficiency
    if (player.yardsPerCarry > 5.0) contextScore += 15;
    else if (player.yardsPerCarry > 4.5) contextScore += 10;
    else if (player.yardsPerCarry > 4.0) contextScore += 5;
    
    // Receiving upside
    if (player.receivingYards > 500) contextScore += 15;
    else if (player.receivingYards > 300) contextScore += 10;
    else if (player.receivingYards > 200) contextScore += 5;
    
    // Team context
    if (player.teamEPARank <= 10) contextScore += 10;
    else if (player.teamEPARank <= 20) contextScore += 5;
    
    return {
      contextScore: Math.min(100, Math.max(0, contextScore)),
      logs: assessment.logs,
      tags: assessment.tags,
      subScores: {
        rushingProduction: Math.min(100, (player.rushYardsPerGame / 100) * 100),
        efficiency: Math.min(100, (player.yardsPerCarry / 6.0) * 100),
        receivingUpside: Math.min(100, (player.receivingYards / 600) * 100),
        teamContext: Math.min(100, ((32 - player.teamEPARank) / 32) * 100)
      },
      lastEvaluatedSeason: player.season || 2024
    };
  }
}

class WREvaluationService {
  async evaluate({ player }: { player: any }) {
    // Use WR forecast service as evaluation base
    const wrInput = {
      playerId: player.playerName.toLowerCase().replace(' ', '-'),
      playerName: player.playerName,
      position: 'WR',
      team: 'NFL',
      season: player.season || 2024,
      tpRR: player.tpRR || 0.15,
      ypRR: player.ypRR || 1.5,
      oneDRR: player.oneDRR || 0.15,
      firstReadTargetPct: player.firstReadTargetPct || 0.25,
      fantasyPointsPerGame: player.fantasyPointsPerGame || 8.0,
      dropRate: player.dropRate || 0.05,
      routeWinRate: player.routeWinRate || 0.50,
      age: player.age || 25,
      draftCapital: player.draftCapital || 'R3',
      explosivePlayRate: player.explosivePlayRate || 0.10,
      slotRate: player.slotRate || 0.30,
      routeParticipation: player.routeParticipation || 0.80,
      teamPassAttemptsPerGame: player.teamPassAttemptsPerGame || 35,
      wrRoomTargetCompetition: player.wrRoomTargetCompetition || 1.5,
      qbStabilityScore: player.qbStabilityScore || 0.7,
      contractYearsRemaining: player.contractYearsRemaining || 2
    };

    const result = wrEvaluationForecastService.evaluateWR(wrInput);
    
    return {
      contextScore: result.contextScore,
      logs: result.logs,
      tags: result.forecastTags,
      subScores: {
        usageProfile: result.componentScores.usageProfile,
        efficiency: result.componentScores.efficiency,
        roleSecurity: result.componentScores.roleSecurity,
        growthTrajectory: result.componentScores.growthTrajectory
      },
      lastEvaluatedSeason: player.season || 2024
    };
  }
}

// Create wrapper for TE service to match interface
class TEEvaluationService {
  constructor() {}
  
  async evaluate({ player }: { player: any }) {
    // Import and use the actual TE service
    const { teEvaluationService } = await import('./teEvaluationService.js');
    
    const teInput = {
      season: player.season || 2024,
      position: 'TE',
      playerName: player.playerName,
      tpRR: player.tpRR || 0.12,
      ypRR: player.ypRR || 1.2,
      routeParticipation: player.routeParticipation || 0.65,
      redZoneTargetShare: player.redZoneTargetShare || 0.15,
      expectedTDs: player.expectedTDs || 4,
      actualTDs: player.actualTDs || 4,
      targetShare: player.targetShare || 0.15,
      catchRateOverExpected: player.catchRateOverExpected || 0.02,
      redZoneTargetConsistency: player.redZoneTargetConsistency || 0.6,
      age: player.age || 26,
      contractYearsRemaining: player.contractYearsRemaining || 2,
      teamEPARank: player.teamEPARank || 16,
      wrTargetCompetition: player.wrTargetCompetition || 1.5,
      qbStabilityScore: player.qbStabilityScore || 0.5,
      teamPassVolume: player.teamPassVolume || 35
    };

    const result = teEvaluationService.evaluateTE(teInput);
    
    return {
      contextScore: result.contextScore,
      logs: result.logs,
      tags: result.tags,
      subScores: result.subScores,
      lastEvaluatedSeason: player.season || 2024
    };
  }
}

// Create wrapper for QB service to match interface
class QBEvaluationServiceWrapper {
  private qbService = new QBEnvironmentContextScoreService();
  
  constructor() {}
  
  async evaluate({ player }: { player: any }) {
    const logs: string[] = [];
    
    // Apply default fallback values for missing stats
    const playerWithDefaults = this.applyDefaultFallbacks(player, logs);
    
    // Map BatchFantasyEvaluator fields to QBEnvironmentInput
    const qbInput = {
      playerName: playerWithDefaults.playerName,
      position: 'QB',
      team: playerWithDefaults.team?.name || 'NFL',
      scrambleRate: playerWithDefaults.scrambleRate * 100, // Convert to percentage
      rushingYPG: playerWithDefaults.rushYPG,
      rushingYPC: playerWithDefaults.yardsPerCarry,
      explosiveRunRate: playerWithDefaults.explosiveRushRate * 100, // Convert to percentage
      cpoe: playerWithDefaults.cpoe,
      adjCompletionRate: playerWithDefaults.adjustedCompletionPct * 100, // Convert to percentage
      deepAccuracy: playerWithDefaults.deepAccuracyRate * 100, // Convert to percentage
      pffOLineGrade: playerWithDefaults.team?.passBlockGrade || defaultFallbackValues.team.passBlockGrade,
      pbwr: (playerWithDefaults.team?.passBlockWinRate || defaultFallbackValues.team.passBlockWinRate) * 100,
      pressureRate: (playerWithDefaults.team?.pressureRateAllowed || defaultFallbackValues.team.pressureRateAllowed) * 100,
      wrYPRR: playerWithDefaults.team?.wrYPRR || defaultFallbackValues.team.wrYPRR,
      wr1DRR: (playerWithDefaults.team?.wr1DRR || defaultFallbackValues.team.wr1DRR) * 100,
      yardsPerTarget: playerWithDefaults.team?.yardsPerTarget || defaultFallbackValues.team.yardsPerTarget,
      yacPerReception: playerWithDefaults.team?.yacPerReception || defaultFallbackValues.team.yacPerReception,
      contestedCatchRate: (playerWithDefaults.team?.contestedCatchRate || defaultFallbackValues.team.contestedCatchRate) * 100,
      routeWinRateAvg: playerWithDefaults.team?.routeWinRateRanks ? 
        playerWithDefaults.team.routeWinRateRanks.reduce((sum, rank) => sum + rank, 0) / playerWithDefaults.team.routeWinRateRanks.length : 50,
      offseasonWRUpgrades: playerWithDefaults.team?.offseasonWRUpgrades || []
    };
    
    try {
      const result = this.qbService.evaluateQBEnvironment(qbInput);
      
      return {
        contextScore: result.contextScore,
        logs: [...logs, ...result.logs],
        tags: result.environmentTags,
        subScores: result.componentScores,
        lastEvaluatedSeason: player.season || 2024
      };
    } catch (error) {
      logs.push(`Error evaluating ${player.playerName}: ${error.message}`);
      return {
        contextScore: 0,
        logs,
        tags: [],
        subScores: {},
        lastEvaluatedSeason: player.season || 2024
      };
    }
  }
  
  private applyDefaultFallbacks(player: any, logs: string[]): any {
    const playerWithDefaults = { ...player };
    let fallbacksApplied = 0;
    
    // Apply fallbacks for missing numeric values
    Object.keys(defaultFallbackValues).forEach(key => {
      if (key === 'team') return; // Handle team separately
      
      if (playerWithDefaults[key] === null || playerWithDefaults[key] === undefined) {
        playerWithDefaults[key] = defaultFallbackValues[key];
        fallbacksApplied++;
        logs.push(`Applied fallback for ${key}: ${defaultFallbackValues[key]}`);
      }
    });
    
    // Apply team fallbacks
    if (!playerWithDefaults.team) {
      playerWithDefaults.team = { ...defaultFallbackValues.team };
      fallbacksApplied++;
      logs.push('Applied complete team fallback data');
    } else {
      Object.keys(defaultFallbackValues.team).forEach(key => {
        if (playerWithDefaults.team[key] === null || playerWithDefaults.team[key] === undefined) {
          playerWithDefaults.team[key] = defaultFallbackValues.team[key];
          fallbacksApplied++;
          logs.push(`Applied team fallback for ${key}: ${defaultFallbackValues.team[key]}`);
        }
      });
    }
    
    if (fallbacksApplied > 0) {
      logs.push(`Total fallbacks applied: ${fallbacksApplied}`);
    }
    
    return playerWithDefaults;
  }
}

// Export all services
export { QBEvaluationServiceWrapper as QBEnvironmentContextScoreService, RBEvaluationService, WREvaluationService, TEEvaluationService };

