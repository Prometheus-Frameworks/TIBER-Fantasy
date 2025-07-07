/**
 * Dynasty Weighting System - Complete Methodology
 * Shows exact scoring weights and calculations for all players
 */

export interface DynastyWeightingBreakdown {
  playerName: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  
  // Raw Component Scores (0-100)
  productionScore: number;
  opportunityScore: number;
  ageScore: number;
  stabilityScore: number;
  efficiencyScore: number;
  
  // Position-Specific Weights
  weights: {
    production: number;
    opportunity: number;
    age: number;
    stability: number;
    efficiency: number;
  };
  
  // Weighted Calculations
  weightedProduction: number;
  weightedOpportunity: number;
  weightedAge: number;
  weightedStability: number;
  weightedEfficiency: number;
  
  // Final Scores
  rawDynastyValue: number;
  enhancedDynastyValue: number;
  elitePlayerBonus: number;
  
  // Explanation
  methodology: string;
  strengthAnalysis: string;
  concernAnalysis: string;
}

export class DynastyWeightingSystem {
  
  /**
   * CURRENT WEIGHTING METHODOLOGY
   * 
   * Based on Fantasy Research and Expert Consensus:
   * - Production = Current fantasy performance (most predictive)
   * - Opportunity = Volume metrics (target share, touches) 
   * - Age = Career stage and longevity projection
   * - Stability = Health, consistency, team context
   * - Efficiency = Advanced metrics (minimal weight due to low correlation)
   */
  
  getPositionWeights(position: string): DynastyWeightingBreakdown['weights'] {
    switch (position) {
      case 'QB':
        return {
          production: 0.40,   // 40% - Elite QB production most important
          opportunity: 0.25,  // 25% - Starting role critical
          age: 0.20,         // 20% - QBs play longer than other positions
          stability: 0.15,   // 15% - Health/team stability
          efficiency: 0.00   // 0% - Minimal weight (EPA included in production)
        };
        
      case 'RB':
        return {
          production: 0.45,   // 45% - Current production highest weight
          opportunity: 0.30,  // 30% - Workload share critical
          age: 0.15,         // 15% - Age cliff consideration but not overpowering
          stability: 0.10,   // 10% - Injury risk factor
          efficiency: 0.00   // 0% - YAC/efficiency less predictive than volume
        };
        
      case 'WR':
      case 'TE':
        return {
          production: 0.40,   // 40% - Current fantasy points per game
          opportunity: 0.30,  // 30% - Target share most predictive metric
          age: 0.15,         // 15% - Career longevity factor
          stability: 0.15,   // 15% - Health and team context
          efficiency: 0.00   // 0% - YPRR more descriptive than predictive
        };
        
      default:
        return {
          production: 0.30,
          opportunity: 0.35,
          age: 0.20,
          stability: 0.15,
          efficiency: 0.00
        };
    }
  }
  
  /**
   * Calculate complete dynasty breakdown for any player
   */
  calculatePlayerBreakdown(player: {
    name: string;
    position: 'QB' | 'RB' | 'WR' | 'TE';
    age: number;
    avgPoints: number;
    targetShare?: number;
    snapShare?: number;
    gamesPlayed?: number;
    team: string;
  }): DynastyWeightingBreakdown {
    
    const weights = this.getPositionWeights(player.position);
    
    // Calculate raw component scores (0-100)
    const productionScore = this.calculateProductionScore(player);
    const opportunityScore = this.calculateOpportunityScore(player);
    const ageScore = this.calculateAgeScore(player.age, player.position);
    const stabilityScore = this.calculateStabilityScore(player);
    const efficiencyScore = this.calculateEfficiencyScore(player);
    
    // Apply weights to get final contributions
    const weightedProduction = productionScore * weights.production;
    const weightedOpportunity = opportunityScore * weights.opportunity;
    const weightedAge = ageScore * weights.age;
    const weightedStability = stabilityScore * weights.stability;
    const weightedEfficiency = efficiencyScore * weights.efficiency;
    
    // Calculate final dynasty value
    const rawDynastyValue = Math.round(
      weightedProduction + weightedOpportunity + weightedAge + 
      weightedStability + weightedEfficiency
    );
    
    // Apply elite player scaling
    const { enhancedValue, eliteBonus } = this.applyEliteScaling(rawDynastyValue, player.position);
    
    return {
      playerName: player.name,
      position: player.position,
      productionScore,
      opportunityScore,
      ageScore,
      stabilityScore,
      efficiencyScore,
      weights,
      weightedProduction: Math.round(weightedProduction * 10) / 10,
      weightedOpportunity: Math.round(weightedOpportunity * 10) / 10,
      weightedAge: Math.round(weightedAge * 10) / 10,
      weightedStability: Math.round(weightedStability * 10) / 10,
      weightedEfficiency: Math.round(weightedEfficiency * 10) / 10,
      rawDynastyValue,
      enhancedDynastyValue: enhancedValue,
      elitePlayerBonus: eliteBonus,
      methodology: this.getMethodologyExplanation(player.position),
      strengthAnalysis: this.analyzeStrengths(player, productionScore, opportunityScore, ageScore),
      concernAnalysis: this.analyzeConcerns(player, productionScore, opportunityScore, ageScore)
    };
  }
  
  /**
   * Josh Allen Example Calculation:
   * 
   * Raw Scores:
   * - Production: 95 (Elite 23.4 PPG)
   * - Opportunity: 90 (Starting QB, high pass attempts)
   * - Age: 85 (28 years old, prime years)
   * - Stability: 90 (Healthy, stable team)
   * - Efficiency: 80 (Good but not weighted)
   * 
   * QB Weights Applied:
   * - Production: 95 × 0.40 = 38.0 points
   * - Opportunity: 90 × 0.25 = 22.5 points  
   * - Age: 85 × 0.20 = 17.0 points
   * - Stability: 90 × 0.15 = 13.5 points
   * - Efficiency: 80 × 0.00 = 0.0 points
   * 
   * Raw Dynasty Value: 91 points
   * Elite Scaling: +7 bonus = 98 final dynasty value
   */
  
  private calculateProductionScore(player: any): number {
    const avgPoints = player.avgPoints || 0;
    
    // Position-specific elite thresholds
    const eliteThresholds = {
      'QB': 23,    // Josh Allen tier
      'RB': 18,    // CMC tier  
      'WR': 16,    // Jefferson tier
      'TE': 14     // Kelce tier
    };
    
    const threshold = eliteThresholds[player.position as keyof typeof eliteThresholds] || 15;
    
    if (avgPoints >= threshold) return 95;
    if (avgPoints >= threshold * 0.85) return 85;
    if (avgPoints >= threshold * 0.70) return 75;
    if (avgPoints >= threshold * 0.55) return 65;
    if (avgPoints >= threshold * 0.40) return 55;
    return Math.max(20, Math.round(avgPoints * 3));
  }
  
  private calculateOpportunityScore(player: any): number {
    // For QBs: Starting role and pass attempts
    if (player.position === 'QB') {
      return player.avgPoints > 15 ? 90 : 60; // Simplified for starters vs backups
    }
    
    // For skill positions: Target/touch share estimation
    const targetShare = player.targetShare || this.estimateTargetShare(player);
    
    if (targetShare >= 25) return 95;      // Elite target share
    if (targetShare >= 20) return 85;      // High target share
    if (targetShare >= 15) return 75;      // Good target share
    if (targetShare >= 10) return 65;      // Moderate share
    if (targetShare >= 5) return 55;       // Low share
    return 30;                             // Minimal opportunity
  }
  
  private calculateAgeScore(age: number, position: string): number {
    // Position-specific age curves
    const ageCurves = {
      'QB': { peak: [26, 32], decline: 35 },   // QBs peak longer
      'RB': { peak: [23, 27], decline: 30 },   // RBs decline fastest
      'WR': { peak: [24, 29], decline: 32 },   // WRs decline moderately
      'TE': { peak: [25, 30], decline: 33 }    // TEs similar to WRs
    };
    
    const curve = ageCurves[position as keyof typeof ageCurves] || ageCurves['WR'];
    
    if (age <= 22) return 85;                    // Young with upside
    if (age >= curve.peak[0] && age <= curve.peak[1]) return 100;  // Peak years
    if (age <= curve.decline) return Math.max(60, 100 - ((age - curve.peak[1]) * 8));
    return Math.max(30, 100 - ((age - curve.decline) * 15));  // Steep decline
  }
  
  private calculateStabilityScore(player: any): number {
    // Simplified stability based on team and performance consistency
    const gamesPlayed = player.gamesPlayed || 16;
    let score = 80; // Base stability
    
    if (gamesPlayed >= 15) score += 10;      // Availability bonus
    if (gamesPlayed <= 10) score -= 20;     // Injury concern
    
    // Team stability (simplified)
    const stableTeams = ['KC', 'BUF', 'GB', 'DAL', 'SF'];
    if (stableTeams.includes(player.team)) score += 5;
    
    return Math.min(95, Math.max(50, score));
  }
  
  private calculateEfficiencyScore(player: any): number {
    // Minimal impact due to research showing low correlation
    // Mainly for completeness - gets 0% weight anyway
    return 75; // Default reasonable efficiency
  }
  
  private estimateTargetShare(player: any): number {
    // Estimate based on production level
    const avgPoints = player.avgPoints || 0;
    
    if (player.position === 'RB') {
      // RBs get touches, not just targets
      if (avgPoints >= 15) return 25;
      if (avgPoints >= 12) return 20;
      if (avgPoints >= 8) return 15;
      return 10;
    }
    
    // WR/TE target share estimation
    if (avgPoints >= 14) return 25;     // Elite receivers
    if (avgPoints >= 11) return 20;     // High-end receivers  
    if (avgPoints >= 8) return 15;      // Solid receivers
    if (avgPoints >= 5) return 10;      // Depth receivers
    return 5;                           // Minimal role
  }
  
  private applyEliteScaling(rawValue: number, position: string): { enhancedValue: number; eliteBonus: number } {
    // KTC-style exponential scaling for elite players
    if (rawValue >= 90) {
      const bonus = Math.round((rawValue - 90) * 0.8) + 7;
      return { enhancedValue: Math.min(100, rawValue + bonus), eliteBonus: bonus };
    }
    
    if (rawValue >= 80) {
      const bonus = Math.round((rawValue - 80) * 0.3) + 2;
      return { enhancedValue: rawValue + bonus, eliteBonus: bonus };
    }
    
    return { enhancedValue: rawValue, eliteBonus: 0 };
  }
  
  private getMethodologyExplanation(position: string): string {
    const weights = this.getPositionWeights(position);
    return `${position} Dynasty Scoring: Production (${(weights.production * 100)}%) + ` +
           `Opportunity (${(weights.opportunity * 100)}%) + Age (${(weights.age * 100)}%) + ` +
           `Stability (${(weights.stability * 100)}%) + Efficiency (${(weights.efficiency * 100)}%)`;
  }
  
  private analyzeStrengths(player: any, production: number, opportunity: number, age: number): string {
    const strengths = [];
    
    if (production >= 90) strengths.push("Elite current production");
    if (opportunity >= 85) strengths.push("High opportunity share");
    if (age >= 85) strengths.push("Optimal age window");
    if (player.avgPoints >= 15) strengths.push("Proven weekly scorer");
    
    return strengths.join(", ") || "Developing asset";
  }
  
  private analyzeConcerns(player: any, production: number, opportunity: number, age: number): string {
    const concerns = [];
    
    if (production < 70) concerns.push("Limited production");
    if (opportunity < 65) concerns.push("Low opportunity share");
    if (age < 60) concerns.push("Age-related decline risk");
    if ((player.gamesPlayed || 16) < 12) concerns.push("Injury history");
    
    return concerns.join(", ");
  }
}

export const dynastyWeightingSystem = new DynastyWeightingSystem();