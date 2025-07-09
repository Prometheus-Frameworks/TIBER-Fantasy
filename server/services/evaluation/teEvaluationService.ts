/**
 * TE Evaluation & Forecast Score (v1.1)
 * Prometheus TE Evaluation layer for dynasty tight end analysis
 * Focus: Usage profile, efficiency, touchdown regression, and volatility
 */

interface TEPlayerInput {
  season: number;
  position: string;
  tpRR: number; // Targets per route run
  ypRR: number; // Yards per route run
  routeParticipation: number; // 0–1
  redZoneTargetShare: number; // 0–1
  expectedTDs: number;
  actualTDs: number;
  targetShare: number; // 0–1
  catchRateOverExpected: number; // -1 to 1
  redZoneTargetConsistency: number; // 0–1, consistency of red zone targets
  age: number;
  contractYearsRemaining: number;
  teamEPARank: number; // 1–32
  wrTargetCompetition: number; // 0–3, low to high competition
  qbStabilityScore: number; // 0–1
  teamPassVolume: number; // Total pass attempts per season
}

interface TEEvaluationOutput {
  contextScore: number; // 0–100
  logs: string[];
  tags: string[];
  subScores: {
    usageProfile: number;
    efficiency: number;
    tdRegression: number;
    volatilityPenalty: number;
  };
  lastEvaluatedSeason: number;
}

class TEEvaluationService {
  private version = '1.1';
  private readonly weights = {
    usageProfile: 0.3,
    efficiency: 0.3,
    tdRegression: 0.2,
    volatilityPenalty: 0.2,
  };

  private evaluateUsageProfile(player: TEPlayerInput): { score: number; logs: string[]; tags: string[] } {
    let score = 0;
    const logs: string[] = [];
    const tags: string[] = [];

    if (player.tpRR > 0.18) { 
      score += 25; 
      logs.push('High TPRR'); 
      tags.push('Primary Target TE'); 
    }
    
    if (player.targetShare > 0.15) { 
      score += 20; 
      logs.push('High Target Share'); 
    }
    
    if (player.routeParticipation > 0.7) { 
      score += 20; 
      logs.push('Strong Route Participation'); 
    }
    
    if (player.redZoneTargetShare > 0.15) { 
      score += 15; 
      logs.push('High Red Zone Usage'); 
    }
    
    if (player.tpRR < 0.1) { 
      score -= 15; 
      logs.push('Low TPRR'); 
      tags.push('Low Usage TE'); 
    }

    return { score: Math.max(0, Math.min(100, score)), logs, tags };
  }

  private evaluateEfficiency(player: TEPlayerInput): { score: number; logs: string[]; tags: string[] } {
    let score = 0;
    const logs: string[] = [];
    const tags: string[] = [];

    if (player.ypRR > 1.7) { 
      score += 25; 
      logs.push('Elite YPRR'); 
      tags.push('Big Play Threat'); 
    }
    else if (player.ypRR > 1.4) { 
      score += 15; 
      logs.push('Above Average YPRR'); 
    }
    else if (player.ypRR > 1.1) { 
      score += 5; 
      logs.push('Serviceable YPRR'); 
    }
    else { 
      score -= 10; 
      logs.push('Inefficient YPRR'); 
    }

    if (player.catchRateOverExpected > 0.05) { 
      score += 15; 
      logs.push('Reliable Hands'); 
    }
    else if (player.catchRateOverExpected < -0.05) { 
      score -= 10; 
      logs.push('Poor Catch Rate'); 
    }

    return { score: Math.max(0, Math.min(100, score)), logs, tags };
  }

  private evaluateTDRegression(player: TEPlayerInput): { score: number; logs: string[]; tags: string[] } {
    let score = 0;
    const logs: string[] = [];
    const tags: string[] = [];

    const tdDelta = player.expectedTDs - player.actualTDs;
    
    if (tdDelta >= 1.5) { 
      score += 30; 
      logs.push(`Positive TD Regression: ${tdDelta.toFixed(1)} more expected TDs`); 
      tags.push('Positive TD Regression'); 
    }
    else if (tdDelta >= 0.5) { 
      score += 15; 
      logs.push(`Mild TD Regression: ${tdDelta.toFixed(1)} more expected TDs`); 
    }
    
    if (player.actualTDs === 0 && player.expectedTDs > 2) { 
      score += 20; 
      logs.push('Unlucky TD Output'); 
      tags.push('Bounce-Back Candidate'); 
    }
    
    if (player.actualTDs > player.expectedTDs + 1) { 
      score -= 20; 
      logs.push(`Overproduced TDs: ${Math.abs(tdDelta).toFixed(1)} excess TDs`); 
      tags.push('TD Regression Risk'); 
    }

    if (player.redZoneTargetConsistency > 0.7) { 
      score += 15; 
      logs.push('Consistent Red Zone Role'); 
    }

    return { score: Math.max(0, Math.min(100, score)), logs, tags };
  }

  private evaluateVolatilityPenalty(player: TEPlayerInput): { score: number; logs: string[]; tags: string[] } {
    let score = 0;
    const logs: string[] = [];
    const tags: string[] = [];

    if (player.teamEPARank <= 8) { 
      score += 20; 
      logs.push('Elite Offense (EPA Rank)'); 
    }
    else if (player.teamEPARank >= 24) { 
      score -= 20; 
      logs.push('Below Avg. Offense (EPA Rank)'); 
      tags.push('Offensive Risk'); 
    }

    if (player.wrTargetCompetition < 1.5) { 
      score += 15; 
      logs.push('Low WR Competition'); 
      tags.push('Clear TE Role'); 
    }
    else if (player.wrTargetCompetition > 2.0) { 
      score -= 15; 
      logs.push('High WR Competition'); 
    }

    if (player.qbStabilityScore > 0.7) { 
      score += 15; 
      logs.push('Stable QB Environment'); 
    }
    else if (player.qbStabilityScore < 0.4) { 
      score -= 15; 
      logs.push('Unstable QB Environment'); 
    }

    if (player.teamPassVolume < 450) { 
      score -= 15; 
      logs.push('Low Pass Volume'); 
      tags.push('Low Opportunity'); 
    }

    if (player.age > 30) { 
      score -= 10; 
      logs.push('Age Regression Risk'); 
    }
    
    if (player.contractYearsRemaining >= 2) { 
      score += 10; 
      logs.push('Long-Term Contract'); 
    }

    return { score: Math.max(0, Math.min(100, score)), logs, tags };
  }

  evaluate(input: { player: TEPlayerInput }): TEEvaluationOutput {
    const player = { ...input.player };

    // Position validation
    if (player.position !== 'TE') {
      return {
        contextScore: 0,
        logs: ['Not a TE. Skipped.'],
        tags: [],
        subScores: { usageProfile: 0, efficiency: 0, tdRegression: 0, volatilityPenalty: 0 },
        lastEvaluatedSeason: player.season || 2024,
      };
    }

    // Season validation
    if (player.season < 2024) {
      return {
        contextScore: 0,
        logs: ['Warning: Evaluation uses pre-2024 data'],
        tags: [],
        subScores: { usageProfile: 0, efficiency: 0, tdRegression: 0, volatilityPenalty: 0 },
        lastEvaluatedSeason: player.season,
      };
    }

    // Data validation and clamping
    player.routeParticipation = Math.max(0, Math.min(1, player.routeParticipation));
    player.redZoneTargetShare = Math.max(0, Math.min(1, player.redZoneTargetShare));
    player.targetShare = Math.max(0, Math.min(1, player.targetShare));
    player.catchRateOverExpected = Math.max(-1, Math.min(1, player.catchRateOverExpected));
    player.redZoneTargetConsistency = Math.max(0, Math.min(1, player.redZoneTargetConsistency));
    player.teamEPARank = Math.max(1, Math.min(32, player.teamEPARank));
    player.wrTargetCompetition = Math.max(0, Math.min(3, player.wrTargetCompetition));
    player.qbStabilityScore = Math.max(0, Math.min(1, player.qbStabilityScore));

    // Evaluate components
    const usage = this.evaluateUsageProfile(player);
    const efficiency = this.evaluateEfficiency(player);
    const tdRegression = this.evaluateTDRegression(player);
    const volatility = this.evaluateVolatilityPenalty(player);

    // Calculate weighted context score
    const contextScore =
      usage.score * this.weights.usageProfile +
      efficiency.score * this.weights.efficiency +
      tdRegression.score * this.weights.tdRegression +
      volatility.score * this.weights.volatilityPenalty;

    // Compile logs
    const logs = [
      ...usage.logs.map(l => `Usage: ${l}`),
      ...efficiency.logs.map(l => `Efficiency: ${l}`),
      ...tdRegression.logs.map(l => `TD Regression: ${l}`),
      ...volatility.logs.map(l => `Volatility: ${l}`),
      `Final TE Context Score: ${contextScore.toFixed(1)}`,
    ];

    return {
      contextScore: Math.max(0, Math.min(100, Math.round(contextScore))),
      logs: logs.length ? logs : ['No TE evaluation adjustments applied'],
      tags: [...new Set([...usage.tags, ...efficiency.tags, ...tdRegression.tags, ...volatility.tags])],
      subScores: {
        usageProfile: usage.score,
        efficiency: efficiency.score,
        tdRegression: tdRegression.score,
        volatilityPenalty: volatility.score,
      },
      lastEvaluatedSeason: player.season,
    };
  }

  /**
   * Generate test cases for validation
   */
  generateTestCases(): Array<{ player: TEPlayerInput; expectedOutcome: string }> {
    return [
      {
        player: {
          season: 2024,
          position: "TE",
          tpRR: 0.20,
          ypRR: 1.8,
          routeParticipation: 0.75,
          redZoneTargetShare: 0.18,
          expectedTDs: 5.5,
          actualTDs: 3,
          targetShare: 0.17,
          catchRateOverExpected: 0.06,
          redZoneTargetConsistency: 0.8,
          age: 35,
          contractYearsRemaining: 2,
          teamEPARank: 5,
          wrTargetCompetition: 1.2,
          qbStabilityScore: 0.9,
          teamPassVolume: 580,
        },
        expectedOutcome: "Elite usage with positive TD regression, offset by age concerns"
      },
      {
        player: {
          season: 2024,
          position: "TE",
          tpRR: 0.12,
          ypRR: 1.5,
          routeParticipation: 0.65,
          redZoneTargetShare: 0.12,
          expectedTDs: 2.5,
          actualTDs: 5,
          targetShare: 0.11,
          catchRateOverExpected: 0.02,
          redZoneTargetConsistency: 0.6,
          age: 26,
          contractYearsRemaining: 3,
          teamEPARank: 12,
          wrTargetCompetition: 1.8,
          qbStabilityScore: 0.6,
          teamPassVolume: 520,
        },
        expectedOutcome: "Moderate usage with TD overproduction risk"
      },
      {
        player: {
          season: 2024,
          position: "TE",
          tpRR: 0.08,
          ypRR: 1.2,
          routeParticipation: 0.55,
          redZoneTargetShare: 0.08,
          expectedTDs: 1.5,
          actualTDs: 1,
          targetShare: 0.08,
          catchRateOverExpected: -0.03,
          redZoneTargetConsistency: 0.4,
          age: 28,
          contractYearsRemaining: 1,
          teamEPARank: 28,
          wrTargetCompetition: 2.5,
          qbStabilityScore: 0.3,
          teamPassVolume: 420,
        },
        expectedOutcome: "Low usage in poor offensive environment"
      }
    ];
  }
}

// Export singleton instance
export const teEvaluationService = new TEEvaluationService();
export default teEvaluationService;

// Export types for external use
export type { TEPlayerInput, TEEvaluationOutput };