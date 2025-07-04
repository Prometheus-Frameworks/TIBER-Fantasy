import type { Player } from "@shared/schema";

export interface PlayerRanking {
  player: Player;
  
  // Our analytical rankings
  ourOverallRank: number;        // Our overall dynasty ranking (1-300)
  ourPositionRank: number;       // Our position ranking (WR1, WR2, etc.)
  
  // Market consensus
  consensusADP: number;          // Market ADP (1-300)
  consensusPositionRank: number; // Market position ranking
  
  // Value analysis
  adpDifference: number;         // Positive = undervalued, Negative = overvalued
  positionDifference: number;    // Position rank difference
  valueCategory: 'STEAL' | 'VALUE' | 'FAIR' | 'OVERVALUED' | 'AVOID';
  
  // Supporting data
  analyticsScore: number;        // Our 0-100 analytical score
  reasoning: string[];           // Why we rank them differently
  confidence: number;            // How confident we are (0-100)
}

export class RankingComparisonService {
  
  async generateRankings(players: Player[]): Promise<PlayerRanking[]> {
    const rankings: PlayerRanking[] = [];
    
    // Calculate our analytical rankings first
    const scoredPlayers = await Promise.all(
      players.map(async (player) => ({
        player,
        analyticsScore: await this.calculateAnalyticsScore(player)
      }))
    );
    
    // Sort by analytics score and assign overall ranks
    scoredPlayers.sort((a, b) => b.analyticsScore - a.analyticsScore);
    
    // Generate position-specific rankings
    const positionRanks = this.calculatePositionRanks(scoredPlayers);
    
    // Create rankings with value analysis
    for (let i = 0; i < scoredPlayers.length; i++) {
      const { player, analyticsScore } = scoredPlayers[i];
      const ourOverallRank = i + 1;
      const ourPositionRank = positionRanks[player.position]?.[player.id] || 99;
      
      const consensusADP = this.estimateConsensusADP(player);
      const consensusPositionRank = this.estimateConsensusPositionRank(player);
      
      const adpDifference = consensusADP - ourOverallRank;
      const positionDifference = consensusPositionRank - ourPositionRank;
      
      const valueCategory = this.categorizeValue(adpDifference, analyticsScore);
      const reasoning = this.generateReasoning(player, adpDifference, positionDifference, analyticsScore);
      const confidence = this.calculateConfidence(player, analyticsScore);
      
      rankings.push({
        player,
        ourOverallRank,
        ourPositionRank,
        consensusADP,
        consensusPositionRank,
        adpDifference,
        positionDifference,
        valueCategory,
        analyticsScore,
        reasoning,
        confidence
      });
    }
    
    return rankings;
  }
  
  private async calculateAnalyticsScore(player: Player): Promise<number> {
    // Research-based scoring focusing on predictive metrics
    
    // Production weight: 35% - Current fantasy output
    const productionScore = this.calculateProductionScore(player);
    
    // Opportunity weight: 30% - Volume and usage (most predictive)
    const opportunityScore = this.calculateOpportunityScore(player);
    
    // Talent weight: 20% - Efficiency metrics
    const talentScore = this.calculateTalentScore(player);
    
    // Stability weight: 15% - Age, consistency, team context
    const stabilityScore = this.calculateStabilityScore(player);
    
    const compositeScore = 
      (productionScore * 0.35) +
      (opportunityScore * 0.30) +
      (talentScore * 0.20) +
      (stabilityScore * 0.15);
    
    return Math.round(compositeScore);
  }
  
  private calculateProductionScore(player: Player): number {
    const avgPoints = player.avgPoints || 0;
    
    // Position-relative scoring based on 2024 data
    if (player.position === 'QB') {
      if (avgPoints >= 23) return 95;    // Josh Allen tier
      if (avgPoints >= 20) return 85;    // Lamar/Hurts tier
      if (avgPoints >= 18) return 75;    // Burrow/Mahomes tier
      if (avgPoints >= 15) return 60;    // QB1 range
      if (avgPoints >= 12) return 40;    // QB2 range
      return 20;
    }
    
    if (player.position === 'RB') {
      if (avgPoints >= 18) return 95;    // CMC/Saquon tier
      if (avgPoints >= 15) return 85;    // Henry/Gibbs tier
      if (avgPoints >= 12) return 75;    // RB1 range
      if (avgPoints >= 10) return 60;    // RB2 range
      if (avgPoints >= 7) return 40;     // Flex range
      return 20;
    }
    
    if (player.position === 'WR') {
      if (avgPoints >= 18) return 95;    // CeeDee/Tyreek tier
      if (avgPoints >= 15) return 85;    // Jefferson/Chase tier
      if (avgPoints >= 12) return 75;    // WR1 range
      if (avgPoints >= 10) return 60;    // WR2 range
      if (avgPoints >= 7) return 40;     // WR3 range
      return 20;
    }
    
    if (player.position === 'TE') {
      if (avgPoints >= 12) return 95;    // Kelce tier
      if (avgPoints >= 10) return 85;    // Andrews/Kittle tier
      if (avgPoints >= 8) return 75;     // TE1 range
      if (avgPoints >= 6) return 60;     // Streaming tier
      if (avgPoints >= 4) return 40;     // Deep league
      return 20;
    }
    
    return 50;
  }
  
  private calculateOpportunityScore(player: Player): number {
    // Most predictive metric - volume and usage
    let score = 0;
    
    if (player.position === 'WR' || player.position === 'TE') {
      const targetShare = player.targetShare || this.estimateTargetShare(player);
      
      // Target share thresholds based on research
      if (targetShare >= 25) score += 50;        // Elite (Kupp, Jefferson level)
      else if (targetShare >= 22) score += 45;   // Very high
      else if (targetShare >= 18) score += 40;   // High
      else if (targetShare >= 15) score += 30;   // Solid
      else if (targetShare >= 12) score += 20;   // Moderate
      else if (targetShare >= 8) score += 10;    // Limited
      else score += 5;                           // Minimal
      
      // Red zone targets add value
      const redZoneTargets = player.redZoneTargets || 0;
      if (redZoneTargets >= 10) score += 25;     // Elite red zone target
      else if (redZoneTargets >= 6) score += 20; // High red zone usage
      else if (redZoneTargets >= 3) score += 15; // Some red zone work
      else score += 5;                           // Limited red zone role
      
      // Snap share context
      const snapShare = this.estimateSnapShare(player);
      if (snapShare >= 85) score += 25;          // True workhorse
      else if (snapShare >= 70) score += 20;     // High usage
      else if (snapShare >= 55) score += 15;     // Solid role
      else score += 5;                           // Rotational
      
    } else if (player.position === 'RB') {
      const carries = player.carries || this.estimateCarries(player);
      const targetShare = player.targetShare || this.estimateTargetShare(player);
      const totalTouches = carries + (targetShare * 2.5); // Weight targets higher
      
      // Touch volume is king for RBs
      if (totalTouches >= 22) score += 50;       // Bell cow (CMC level)
      else if (totalTouches >= 18) score += 45;  // Heavy usage
      else if (totalTouches >= 15) score += 35;  // Solid usage
      else if (totalTouches >= 12) score += 25;  // Committee back
      else if (totalTouches >= 8) score += 15;   // Change of pace
      else score += 5;                           // Limited role
      
      // Goal line work
      if (carries >= 15 && player.avgPoints >= 10) score += 25; // Likely goal line back
      else if (carries >= 10) score += 15;       // Some goal line work
      else score += 5;
      
      // Three-down capability (receiving work)
      if (targetShare >= 8) score += 25;         // Elite receiving back
      else if (targetShare >= 5) score += 20;    // Good receiving work
      else if (targetShare >= 3) score += 15;    // Some receiving
      else score += 5;                           // Limited passing downs
      
    } else if (player.position === 'QB') {
      // Team pass volume and rushing upside
      const passingPoints = Math.min(player.avgPoints, 18); // Cap passing points
      const rushingUpside = Math.max(0, player.avgPoints - passingPoints);
      
      // Passing volume proxy
      if (passingPoints >= 16) score += 40;      // High-volume passer
      else if (passingPoints >= 14) score += 35; // Good volume
      else if (passingPoints >= 12) score += 30; // Average volume
      else score += 20;                          // Limited volume
      
      // Rushing upside is crucial for QB value
      if (rushingUpside >= 8) score += 40;       // Elite dual threat (Lamar, Josh)
      else if (rushingUpside >= 5) score += 30;  // Strong rushing (Hurts)
      else if (rushingUpside >= 3) score += 20;  // Some rushing
      else score += 10;                          // Pocket passer
      
      // Red zone rushing TDs
      if (rushingUpside >= 6) score += 20;       // Likely gets rushing TDs
      else if (rushingUpside >= 3) score += 10;  // Some rushing TDs
    }
    
    return Math.min(100, score);
  }
  
  private calculateTalentScore(player: Player): number {
    // Efficiency metrics - less predictive but important for talent evaluation
    let score = 50; // Base talent level
    
    const avgPoints = player.avgPoints || 0;
    const projectedPoints = player.projectedPoints || avgPoints;
    
    // Outperforming/underperforming projections
    if (projectedPoints > 0) {
      const efficiency = avgPoints / projectedPoints;
      if (efficiency >= 1.2) score += 20;        // Significantly outperforming
      else if (efficiency >= 1.1) score += 15;   // Outperforming
      else if (efficiency >= 0.9) score += 0;    // Meeting expectations
      else if (efficiency >= 0.8) score -= 10;   // Underperforming
      else score -= 20;                          // Significantly underperforming
    }
    
    // Position-specific talent indicators
    if (player.position === 'WR' || player.position === 'TE') {
      // Efficiency per target (rough YPRR proxy)
      const targetShare = this.estimateTargetShare(player);
      if (targetShare > 0) {
        const pointsPerTargetShare = avgPoints / targetShare;
        if (pointsPerTargetShare >= 1.0) score += 20;     // Very efficient
        else if (pointsPerTargetShare >= 0.8) score += 15; // Efficient
        else if (pointsPerTargetShare >= 0.6) score += 10; // Average
        else score -= 10;                                  // Inefficient
      }
      
      // Red zone efficiency
      const redZoneTargets = player.redZoneTargets || 0;
      if (redZoneTargets >= 5) {
        const redZoneEff = (avgPoints * 0.6) / redZoneTargets; // Rough TD conversion
        if (redZoneEff >= 1.0) score += 15;      // Elite red zone converter
        else if (redZoneEff >= 0.7) score += 10; // Good red zone
        else score += 5;                         // Average red zone
      }
      
    } else if (player.position === 'RB') {
      // Receiving ability indicates talent
      const targetShare = this.estimateTargetShare(player);
      if (targetShare >= 8) score += 25;         // Elite receiving back
      else if (targetShare >= 5) score += 20;    // Good receiving back
      else if (targetShare >= 3) score += 15;    // Some receiving ability
      else score += 5;                           // Limited receiving
      
      // TD efficiency
      const carries = this.estimateCarries(player);
      if (carries >= 10) {
        const estimatedTDs = avgPoints * 0.6 / 6; // Rough TD estimate
        const touchdownRate = estimatedTDs / carries;
        if (touchdownRate >= 0.08) score += 15;  // High TD rate
        else if (touchdownRate >= 0.05) score += 10; // Good TD rate
        else if (touchdownRate <= 0.02) score -= 10; // Poor TD rate
      }
      
    } else if (player.position === 'QB') {
      // Accuracy and decision making (proxy via TD:INT ratio)
      if (avgPoints >= 18) {
        // High-end QBs should be efficient
        const expectedTDs = avgPoints * 1.5; // Rough expectation
        score += 15; // Bonus for high-level play
      }
      
      // Rushing efficiency
      const rushingPoints = Math.max(0, avgPoints - 15);
      if (rushingPoints >= 6) score += 20;       // Elite rushing efficiency
      else if (rushingPoints >= 3) score += 15;  // Good rushing efficiency
    }
    
    return Math.max(10, Math.min(100, score));
  }
  
  private calculateStabilityScore(player: Player): number {
    let score = 50; // Base stability
    
    // Age factor (most important for dynasty)
    const age = player.age || 25;
    
    if (player.position === 'RB') {
      if (age <= 23) score += 25;        // Prime years
      else if (age <= 25) score += 20;   // Peak
      else if (age <= 27) score += 10;   // Still good
      else if (age <= 29) score -= 10;   // Declining
      else score -= 25;                  // Major decline
    } else if (player.position === 'WR') {
      if (age <= 25) score += 20;        // Prime/developing
      else if (age <= 28) score += 15;   // Peak
      else if (age <= 31) score += 5;    // Still good
      else if (age <= 33) score -= 10;   // Declining
      else score -= 20;                  // Major decline
    } else if (player.position === 'TE') {
      if (age <= 26) score += 15;        // Prime
      else if (age <= 29) score += 10;   // Peak
      else if (age <= 32) score += 0;    // Neutral
      else if (age <= 34) score -= 15;   // Declining
      else score -= 25;                  // Major decline
    } else if (player.position === 'QB') {
      if (age <= 28) score += 10;        // Developing/prime
      else if (age <= 34) score += 15;   // Peak years
      else if (age <= 37) score += 0;    // Still good
      else if (age <= 39) score -= 10;   // Declining
      else score -= 20;                  // Major decline
    }
    
    // Injury history
    if (player.injuryStatus === 'OUT') score -= 15;
    else if (player.injuryStatus === 'DOUBTFUL') score -= 10;
    else if (player.injuryStatus === 'QUESTIONABLE') score -= 5;
    
    // Team context/stability
    if (player.avgPoints >= 12) score += 10;     // Stable, productive situation
    else if (player.avgPoints <= 5) score -= 10; // Unstable situation
    
    // Consistency (estimated from production level)
    if (player.avgPoints >= 15) score += 15;     // Stars are consistent
    else if (player.avgPoints >= 10) score += 10; // Solid players
    else if (player.avgPoints <= 5) score -= 15;  // Very volatile
    
    return Math.max(0, Math.min(100, score));
  }
  
  private calculatePositionRanks(scoredPlayers: { player: Player; analyticsScore: number }[]): Record<string, Record<number, number>> {
    const positionRanks: Record<string, Record<number, number>> = {};
    
    // Group by position
    const byPosition: Record<string, typeof scoredPlayers> = {};
    for (const scored of scoredPlayers) {
      const pos = scored.player.position;
      if (!byPosition[pos]) byPosition[pos] = [];
      byPosition[pos].push(scored);
    }
    
    // Rank within each position
    for (const [position, players] of Object.entries(byPosition)) {
      players.sort((a, b) => b.analyticsScore - a.analyticsScore);
      positionRanks[position] = {};
      
      for (let i = 0; i < players.length; i++) {
        positionRanks[position][players[i].player.id] = i + 1;
      }
    }
    
    return positionRanks;
  }
  
  private estimateConsensusADP(player: Player): number {
    // Convert ownership percentage to realistic ADP
    const ownership = player.ownershipPercentage || 50;
    
    if (ownership >= 95) return 5 + Math.random() * 15;    // Picks 5-20
    if (ownership >= 85) return 20 + Math.random() * 25;   // Picks 20-45
    if (ownership >= 70) return 45 + Math.random() * 35;   // Picks 45-80
    if (ownership >= 55) return 80 + Math.random() * 40;   // Picks 80-120
    if (ownership >= 40) return 120 + Math.random() * 50;  // Picks 120-170
    if (ownership >= 25) return 170 + Math.random() * 60;  // Picks 170-230
    return 230 + Math.random() * 70;                       // Picks 230-300
  }
  
  private estimateConsensusPositionRank(player: Player): number {
    const consensusADP = this.estimateConsensusADP(player);
    
    // Rough position rank conversion (12-team league assumptions)
    if (player.position === 'QB') {
      if (consensusADP <= 50) return Math.ceil(consensusADP / 12);    // Top QBs
      return Math.ceil((consensusADP - 50) / 8) + 5;                 // Later QBs
    }
    
    if (player.position === 'RB') {
      if (consensusADP <= 36) return Math.ceil(consensusADP / 3);     // Top RBs (3 per round)
      return Math.ceil((consensusADP - 36) / 4) + 12;                // Later RBs
    }
    
    if (player.position === 'WR') {
      if (consensusADP <= 48) return Math.ceil(consensusADP / 4);     // Top WRs (4 per round)
      return Math.ceil((consensusADP - 48) / 5) + 12;                // Later WRs
    }
    
    if (player.position === 'TE') {
      if (consensusADP <= 60) return Math.ceil(consensusADP / 20);    // Early TEs
      return Math.ceil((consensusADP - 60) / 15) + 3;                // Later TEs
    }
    
    return 50; // Default
  }
  
  private categorizeValue(adpDifference: number, analyticsScore: number): 'STEAL' | 'VALUE' | 'FAIR' | 'OVERVALUED' | 'AVOID' {
    if (adpDifference >= 50 && analyticsScore >= 75) return 'STEAL';      // Great player, 50+ picks undervalued
    if (adpDifference >= 25 && analyticsScore >= 60) return 'VALUE';      // Good player, 25+ picks undervalued
    if (adpDifference >= -25) return 'FAIR';                              // Within 25 picks of fair value
    if (adpDifference >= -50) return 'OVERVALUED';                        // 25-50 picks overvalued
    return 'AVOID';                                                       // 50+ picks overvalued
  }
  
  private generateReasoning(player: Player, adpDiff: number, posDiff: number, score: number): string[] {
    const reasons: string[] = [];
    
    // ADP reasoning
    if (adpDiff >= 30) {
      reasons.push(`Market undervaluing by ${adpDiff.toFixed(0)} overall picks`);
    } else if (adpDiff <= -30) {
      reasons.push(`Market overvaluing by ${Math.abs(adpDiff).toFixed(0)} overall picks`);
    }
    
    // Position rank reasoning
    if (posDiff >= 5) {
      reasons.push(`${posDiff} spots higher than consensus at ${player.position}`);
    } else if (posDiff <= -5) {
      reasons.push(`${Math.abs(posDiff)} spots lower than consensus at ${player.position}`);
    }
    
    // Score-based reasoning
    if (score >= 80) {
      reasons.push(`Elite analytical profile (${score}/100)`);
    } else if (score >= 65) {
      reasons.push(`Strong analytical metrics (${score}/100)`);
    } else if (score <= 40) {
      reasons.push(`Concerning analytical profile (${score}/100)`);
    }
    
    // Production reasoning
    const avgPoints = player.avgPoints || 0;
    if (avgPoints >= 15) {
      reasons.push(`Elite current production (${avgPoints.toFixed(1)} PPG)`);
    } else if (avgPoints <= 5) {
      reasons.push(`Limited current production (${avgPoints.toFixed(1)} PPG)`);
    }
    
    return reasons.slice(0, 3); // Top 3 reasons
  }
  
  private calculateConfidence(player: Player, score: number): number {
    let confidence = 50;
    
    // More confident in extreme differences
    confidence += Math.min(25, Math.abs(score - 50) / 2);
    
    // More confident with established production
    if (player.avgPoints >= 10) confidence += 20;
    else if (player.avgPoints <= 3) confidence -= 15;
    
    // More confident with clear role
    const targetShare = this.estimateTargetShare(player);
    if (targetShare >= 15 || (player.carries && player.carries >= 12)) {
      confidence += 15;
    }
    
    return Math.max(10, Math.min(95, confidence));
  }
  
  // Helper estimation methods
  private estimateTargetShare(player: Player): number {
    if (player.targetShare) return player.targetShare;
    
    const avgPoints = player.avgPoints || 0;
    if (player.position === 'WR') {
      if (avgPoints >= 15) return 22;
      if (avgPoints >= 12) return 18;
      if (avgPoints >= 8) return 14;
      return 10;
    }
    if (player.position === 'TE') {
      if (avgPoints >= 10) return 16;
      if (avgPoints >= 7) return 12;
      return 8;
    }
    if (player.position === 'RB') {
      if (avgPoints >= 15) return 7;
      if (avgPoints >= 10) return 5;
      return 3;
    }
    return 5;
  }
  
  private estimateSnapShare(player: Player): number {
    const avgPoints = player.avgPoints || 0;
    if (avgPoints >= 15) return 80;
    if (avgPoints >= 10) return 65;
    if (avgPoints >= 6) return 50;
    return 35;
  }
  
  private estimateCarries(player: Player): number {
    if (player.carries) return player.carries;
    if (player.position !== 'RB') return 0;
    
    const avgPoints = player.avgPoints || 0;
    if (avgPoints >= 15) return 18;
    if (avgPoints >= 10) return 12;
    if (avgPoints >= 6) return 8;
    return 4;
  }
}

export const rankingComparisonService = new RankingComparisonService();