import type { Player } from "@shared/schema";

// Simplified, meaningful dynasty valuation system
export interface SimplifiedDynastyValue {
  player: Player;
  
  // Clear, understandable scores (0-100 scale)
  dynastyRank: number;           // 1-300 overall dynasty rank
  positionRank: number;          // 1-60 at position
  
  // Meaningful market comparison
  estimatedADP: number;          // Where they're being drafted (1-300)
  ourADP: number;               // Where we think they should be drafted (1-300)
  adpDifference: number;        // Positive = undervalued, Negative = overvalued
  
  // Component scores that make sense
  productionScore: number;      // Current fantasy output (0-100)
  opportunityScore: number;     // Volume/usage metrics (0-100)
  talentScore: number;          // Efficiency/skill metrics (0-100)
  ageScore: number;             // Age curve factor (0-100)
  
  // Clear recommendation
  recommendation: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'AVOID';
  confidence: number;           // How sure we are (0-100)
  reasoning: string[];          // Plain English explanations
}

export class SimplifiedDynastyValuationService {
  
  async calculateSimplifiedValue(player: Player): Promise<SimplifiedDynastyValue> {
    // Calculate component scores using realistic logic
    const productionScore = this.calculateProductionScore(player);
    const opportunityScore = this.calculateOpportunityScore(player);
    const talentScore = this.calculateTalentScore(player);
    const ageScore = this.calculateAgeScore(player);
    
    // Weight the components based on research
    const compositeScore = 
      (productionScore * 0.35) +    // Current production is most important
      (opportunityScore * 0.30) +   // Volume/usage second
      (talentScore * 0.20) +        // Talent/efficiency third
      (ageScore * 0.15);            // Age factor last
    
    // Convert to meaningful rankings
    const dynastyRank = this.convertScoreToRank(compositeScore, player.position);
    const positionRank = this.convertToPositionRank(compositeScore, player.position);
    
    // Market comparison using realistic ADP logic
    const estimatedADP = this.calculateEstimatedADP(player);
    const ourADP = this.convertScoreToADP(compositeScore, player.position);
    const adpDifference = estimatedADP - ourADP;
    
    // Generate recommendation and confidence
    const recommendation = this.generateRecommendation(adpDifference, compositeScore);
    const confidence = this.calculateConfidence(player, adpDifference);
    const reasoning = this.generateReasoning(player, productionScore, opportunityScore, talentScore, ageScore, adpDifference);
    
    return {
      player,
      dynastyRank,
      positionRank,
      estimatedADP,
      ourADP,
      adpDifference,
      productionScore: Math.round(productionScore),
      opportunityScore: Math.round(opportunityScore),
      talentScore: Math.round(talentScore),
      ageScore: Math.round(ageScore),
      recommendation,
      confidence: Math.round(confidence),
      reasoning
    };
  }
  
  private calculateProductionScore(player: Player): number {
    const avgPoints = player.avgPoints || 0;
    
    // Position-specific scoring based on actual 2024 production
    if (player.position === 'QB') {
      if (avgPoints >= 23) return 95;      // Josh Allen tier (23.4 PPG)
      if (avgPoints >= 20) return 85;      // Lamar Jackson tier
      if (avgPoints >= 18) return 75;      // Solid QB1
      if (avgPoints >= 15) return 60;      // Low-end QB1
      if (avgPoints >= 12) return 40;      // QB2
      return 20;
    }
    
    if (player.position === 'RB') {
      if (avgPoints >= 18) return 95;      // CMC/Saquon tier
      if (avgPoints >= 15) return 85;      // Elite RB1
      if (avgPoints >= 12) return 75;      // Solid RB1
      if (avgPoints >= 10) return 60;      // RB2
      if (avgPoints >= 7) return 40;       // Flex play
      return 20;
    }
    
    if (player.position === 'WR') {
      if (avgPoints >= 18) return 95;      // CeeDee Lamb tier
      if (avgPoints >= 15) return 85;      // Elite WR1
      if (avgPoints >= 12) return 75;      // Solid WR1
      if (avgPoints >= 10) return 60;      // WR2
      if (avgPoints >= 7) return 40;       // WR3/Flex
      return 20;
    }
    
    if (player.position === 'TE') {
      if (avgPoints >= 12) return 95;      // Kelce tier
      if (avgPoints >= 10) return 85;      // Elite TE
      if (avgPoints >= 8) return 75;       // TE1
      if (avgPoints >= 6) return 60;       // Low TE1
      if (avgPoints >= 4) return 40;       // Streaming
      return 20;
    }
    
    return 50; // Default
  }
  
  private calculateOpportunityScore(player: Player): number {
    // Use target share and snap data when available
    const targetShare = player.targetShare || this.estimateTargetShare(player);
    const snapShare = this.estimateSnapShare(player);
    
    if (player.position === 'WR' || player.position === 'TE') {
      let score = 0;
      
      // Target share is king for receivers
      if (targetShare >= 25) score += 50;        // Elite target share
      else if (targetShare >= 20) score += 40;   // High target share  
      else if (targetShare >= 15) score += 30;   // Solid target share
      else if (targetShare >= 10) score += 20;   // Role player
      else score += 10;                          // Limited role
      
      // Snap share adds context
      if (snapShare >= 80) score += 30;          // Workhorse
      else if (snapShare >= 65) score += 25;     // High usage
      else if (snapShare >= 50) score += 15;     // Rotational
      else score += 5;                           // Limited snaps
      
      // Red zone usage
      const redZoneTargets = player.redZoneTargets || 0;
      if (redZoneTargets >= 8) score += 20;      // Elite red zone target
      else if (redZoneTargets >= 5) score += 15; // Good red zone usage
      else if (redZoneTargets >= 3) score += 10; // Some red zone work
      
      return Math.min(100, score);
    }
    
    if (player.position === 'RB') {
      let score = 0;
      
      // Rushing attempts + targets
      const carries = player.carries || this.estimateCarries(player);
      const totalTouches = carries + (targetShare * 2); // Weight targets higher
      
      if (totalTouches >= 20) score += 50;       // Bell cow
      else if (totalTouches >= 15) score += 40;  // Heavy usage
      else if (totalTouches >= 12) score += 30;  // Solid usage
      else if (totalTouches >= 8) score += 20;   // Committee back
      else score += 10;                          // Change of pace
      
      // Snap share matters for RBs too
      if (snapShare >= 70) score += 25;          // Three-down back
      else if (snapShare >= 55) score += 20;     // Good usage
      else if (snapShare >= 40) score += 15;     // Early down back
      else score += 5;                           // Limited role
      
      // Goal line work
      if (carries >= 15 && player.avgPoints >= 10) score += 25; // Likely goal line back
      else if (carries >= 10) score += 15;       // Some goal line work
      
      return Math.min(100, score);
    }
    
    if (player.position === 'QB') {
      // QB opportunity is about team passing volume and rushing upside
      const teamPassAttempts = this.estimateTeamPassAttempts(player);
      let score = 0;
      
      if (teamPassAttempts >= 600) score += 40;   // High-volume passing offense
      else if (teamPassAttempts >= 550) score += 35; // Above average
      else if (teamPassAttempts >= 500) score += 30; // Average
      else score += 20;                           // Run-heavy offense
      
      // Rushing upside (estimate from total points vs passing points)
      const rushingUpside = Math.max(0, player.avgPoints - 15); // Points above pure passing
      if (rushingUpside >= 8) score += 40;        // Elite dual threat
      else if (rushingUpside >= 5) score += 30;   // Good rushing upside
      else if (rushingUpside >= 3) score += 20;   // Some rushing
      else score += 10;                           // Pocket passer
      
      // Red zone rushing TDs
      if (player.avgPoints >= 20) score += 20;    // Likely gets rushing TDs
      
      return Math.min(100, score);
    }
    
    return 50; // Default
  }
  
  private calculateTalentScore(player: Player): number {
    // Efficiency metrics when available
    const avgPoints = player.avgPoints || 0;
    const projectedPoints = player.projectedPoints || avgPoints;
    
    // Use projection vs actual as efficiency indicator
    const efficiency = projectedPoints > 0 ? (avgPoints / projectedPoints) : 1;
    
    let baseScore = 50;
    
    // Efficiency adjustment
    if (efficiency >= 1.15) baseScore += 25;      // Outperforming projections significantly
    else if (efficiency >= 1.05) baseScore += 15; // Slightly outperforming
    else if (efficiency >= 0.95) baseScore += 0;  // Meeting expectations
    else if (efficiency >= 0.85) baseScore -= 10; // Underperforming slightly
    else baseScore -= 20;                          // Significantly underperforming
    
    // Position-specific talent indicators
    if (player.position === 'WR' || player.position === 'TE') {
      // Higher points per target indicates efficiency
      const targetShare = this.estimateTargetShare(player);
      const pointsPerTarget = targetShare > 0 ? (avgPoints * 16) / (targetShare * 35) : 1;
      
      if (pointsPerTarget >= 2.0) baseScore += 20;      // Very efficient
      else if (pointsPerTarget >= 1.5) baseScore += 10; // Efficient
      else if (pointsPerTarget <= 1.0) baseScore -= 10; // Inefficient
    }
    
    if (player.position === 'RB') {
      // Receiving ability adds talent points
      const targetShare = this.estimateTargetShare(player);
      if (targetShare >= 8) baseScore += 20;       // Elite receiving back
      else if (targetShare >= 5) baseScore += 15;  // Good receiving back
      else if (targetShare >= 3) baseScore += 10;  // Some receiving work
      
      // Touchdown efficiency (more TDs per touch = more talent)
      const carries = this.estimateCarries(player);
      const totalTouches = carries + targetShare;
      const estimatedTDs = avgPoints * 0.15; // Rough TD estimate
      if (totalTouches > 0) {
        const tdRate = estimatedTDs / totalTouches;
        if (tdRate >= 0.08) baseScore += 15;      // High TD rate
        else if (tdRate <= 0.04) baseScore -= 10; // Low TD rate
      }
    }
    
    return Math.max(0, Math.min(100, baseScore));
  }
  
  private calculateAgeScore(player: Player): number {
    const age = player.age || 25; // Default reasonable age
    
    // Position-specific age curves
    if (player.position === 'RB') {
      if (age <= 23) return 95;        // Prime rookie/2nd year
      if (age <= 25) return 85;        // Peak years
      if (age <= 27) return 70;        // Still good
      if (age <= 29) return 50;        // Declining
      if (age <= 31) return 30;        // Steep decline
      return 10;                       // Very old
    }
    
    if (player.position === 'WR') {
      if (age <= 24) return 90;        // Prime developing years
      if (age <= 27) return 85;        // Peak years
      if (age <= 30) return 70;        // Still good
      if (age <= 32) return 50;        // Declining
      if (age <= 34) return 30;        // Notable decline
      return 15;                       // Very old
    }
    
    if (player.position === 'TE') {
      if (age <= 25) return 85;        // Peak years
      if (age <= 28) return 80;        // Prime
      if (age <= 31) return 65;        // Still good
      if (age <= 33) return 45;        // Declining
      if (age <= 35) return 25;        // Notable decline
      return 10;                       // Very old
    }
    
    if (player.position === 'QB') {
      if (age <= 26) return 85;        // Developing/prime
      if (age <= 32) return 90;        // Peak years
      if (age <= 36) return 75;        // Still good
      if (age <= 38) return 50;        // Declining
      if (age <= 40) return 30;        // Notable decline
      return 15;                       // Very old
    }
    
    return 60; // Default
  }
  
  private convertScoreToRank(score: number, position: string): number {
    // Convert 0-100 score to overall dynasty rank (1-300)
    if (score >= 90) return Math.round(1 + (95 - score) * 2);      // Rank 1-10
    if (score >= 80) return Math.round(11 + (90 - score) * 3);     // Rank 11-40
    if (score >= 70) return Math.round(41 + (80 - score) * 4);     // Rank 41-80
    if (score >= 60) return Math.round(81 + (70 - score) * 6);     // Rank 81-140
    if (score >= 50) return Math.round(141 + (60 - score) * 8);    // Rank 141-220
    return Math.round(221 + (50 - score) * 1.6);                   // Rank 221-300
  }
  
  private convertToPositionRank(score: number, position: string): number {
    // Position ranks (QB: 1-32, RB: 1-60, WR: 1-80, TE: 1-32)
    const maxRanks = { QB: 32, RB: 60, WR: 80, TE: 32 };
    const maxRank = maxRanks[position as keyof typeof maxRanks] || 60;
    
    if (score >= 90) return Math.round(1 + (95 - score) * 0.2);
    if (score >= 80) return Math.round(2 + (90 - score) * 0.5);
    if (score >= 70) return Math.round(7 + (80 - score) * 0.8);
    if (score >= 60) return Math.round(15 + (70 - score) * 1.2);
    if (score >= 50) return Math.round(27 + (60 - score) * 1.5);
    return Math.min(maxRank, Math.round(42 + (50 - score) * 0.8));
  }
  
  private convertScoreToADP(score: number, position: string): number {
    // Convert our score to where we think they should be drafted
    return this.convertScoreToRank(score, position);
  }
  
  private calculateEstimatedADP(player: Player): number {
    // Estimate current market ADP based on ownership and production
    const ownershipPercentage = player.ownershipPercentage || 50;
    const avgPoints = player.avgPoints || 0;
    
    // High ownership = early ADP
    if (ownershipPercentage >= 95) return Math.round(10 + Math.random() * 20);   // Picks 10-30
    if (ownershipPercentage >= 85) return Math.round(30 + Math.random() * 30);   // Picks 30-60
    if (ownershipPercentage >= 70) return Math.round(60 + Math.random() * 40);   // Picks 60-100
    if (ownershipPercentage >= 50) return Math.round(100 + Math.random() * 50);  // Picks 100-150
    if (ownershipPercentage >= 30) return Math.round(150 + Math.random() * 60);  // Picks 150-210
    return Math.round(210 + Math.random() * 90);                                 // Picks 210-300
  }
  
  private generateRecommendation(adpDifference: number, score: number): 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'AVOID' {
    if (adpDifference >= 50 && score >= 70) return 'STRONG BUY';  // Being drafted 50+ picks too late + good score
    if (adpDifference >= 25) return 'BUY';                        // Being drafted 25+ picks too late
    if (adpDifference >= -25) return 'HOLD';                      // Fair value range
    if (adpDifference >= -50) return 'SELL';                      // Being drafted 25-50 picks too early
    return 'AVOID';                                               // Being drafted 50+ picks too early
  }
  
  private calculateConfidence(player: Player, adpDifference: number): number {
    let confidence = 50;
    
    // More confident in larger ADP differences
    confidence += Math.min(30, Math.abs(adpDifference) / 2);
    
    // More confident with more data
    if (player.avgPoints >= 8) confidence += 15;   // Significant production sample
    if (player.targetShare && player.targetShare >= 15) confidence += 10; // Clear role
    
    // Less confident in extreme scores
    if (player.avgPoints <= 3) confidence -= 20;   // Very low production
    
    return Math.max(10, Math.min(95, confidence));
  }
  
  private generateReasoning(player: Player, production: number, opportunity: number, talent: number, age: number, adpDiff: number): string[] {
    const reasoning: string[] = [];
    
    // Production reasoning
    if (production >= 85) reasoning.push(`Elite current production (${player.avgPoints?.toFixed(1)} PPG)`);
    else if (production <= 40) reasoning.push(`Limited current production (${player.avgPoints?.toFixed(1)} PPG)`);
    
    // Opportunity reasoning
    if (opportunity >= 80) reasoning.push(`Excellent volume and usage metrics`);
    else if (opportunity <= 40) reasoning.push(`Limited opportunity in current role`);
    
    // Talent reasoning
    if (talent >= 80) reasoning.push(`High efficiency and talent indicators`);
    else if (talent <= 40) reasoning.push(`Efficiency concerns relative to opportunity`);
    
    // Age reasoning
    if (age >= 85) reasoning.push(`Favorable age profile for position`);
    else if (age <= 40) reasoning.push(`Age-related decline risk`);
    
    // Market reasoning
    if (adpDiff >= 30) reasoning.push(`Market is undervaluing by ${adpDiff.toFixed(0)} ADP spots`);
    else if (adpDiff <= -30) reasoning.push(`Market is overvaluing by ${Math.abs(adpDiff).toFixed(0)} ADP spots`);
    
    return reasoning.slice(0, 4); // Keep to top 4 reasons
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
  
  private estimateTeamPassAttempts(player: Player): number {
    const avgPoints = player.avgPoints || 0;
    if (avgPoints >= 20) return 620;
    if (avgPoints >= 18) return 580;
    if (avgPoints >= 15) return 540;
    return 500;
  }
}

export const simplifiedDynastyValuationService = new SimplifiedDynastyValuationService();