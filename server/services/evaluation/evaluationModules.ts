/**
 * Evaluation Modules Export
 * Centralizes all position evaluation services for BatchFantasyEvaluator v1.4
 */

// Import actual QB service
import { QBEnvironmentContextScoreService } from '../../qbEnvironmentContextScore.js';

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

// Export all services
export { QBEnvironmentContextScoreService, RBEvaluationService, WREvaluationService, TEEvaluationService };

