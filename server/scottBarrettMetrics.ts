/**
 * Scott Barrett Analytics Integration
 * CEO of FantasyPointsData - Advanced Metrics Framework
 * 
 * Key Insights:
 * - YPRR 2.00+ threshold for NFL success (2.50+ elite)
 * - TPRR measures target-earning ability (0.20+ solid)
 * - Actual Opportunity: 0.97 correlation vs 0.89 raw touches
 * - Bell Cow Index: Snap% + Carry% + Target% for RBs
 * - Volume > Efficiency for predictive power
 */

interface ScottBarrettMetrics {
  // Core Efficiency Metrics
  yardsPerRouteRun: number;      // YPRR - Elite threshold 2.00+
  targetsPerRouteRun: number;    // TPRR - Target-earning ability 0.20+
  firstDownsPerRoute: number;    // 1D/RR - More stable than YPRR
  
  // Opportunity Metrics (Most Predictive)
  actualOpportunity: number;     // Expected points based on usage (0.97 correlation)
  weightedOpportunity: number;   // (Carries × 0.58) + (Targets × 1.59) for RBs
  snapShare: number;             // % of offensive snaps
  
  // Position-Specific
  bellCowIndex?: number;         // RB: Snap% + Carry% + Target% combined
  redZoneShare?: number;         // % of team red zone opportunities
  goalLineCarries?: number;      // RB goal line touches (high value)
  
  // Context & Stability  
  teamPassAttempts: number;      // Offensive context
  consistencyScore: number;      // Week-to-week variance (lower = better)
  ageAdjustment: number;         // Age curve factor
}

export interface ScottBarrettPlayerEval {
  player: {
    name: string;
    position: string;
    team: string;
    age: number;
  };
  metrics: ScottBarrettMetrics;
  dynastyScore: number;          // 0-100 using Barrett methodology
  tier: 'Elite' | 'BellCow' | 'High-End' | 'Solid' | 'Depth' | 'Bust';
  confidence: number;            // Based on sample size and metric strength
  strengths: string[];           // Key positive metrics
  concerns: string[];            // Risk factors
}

export class ScottBarrettAnalyticsEngine {
  
  /**
   * Calculate dynasty value using Scott Barrett's methodology
   * Priority: Actual Opportunity (40%) + YPRR/TPRR (30%) + Age (20%) + Context (10%)
   */
  analyzePlayer(player: any): ScottBarrettPlayerEval {
    const metrics = this.calculateBarrettMetrics(player);
    const dynastyScore = this.calculateBarrettDynastyScore(metrics, player.position);
    const tier = this.assignBarrettTier(dynastyScore, player.position);
    const confidence = this.calculateConfidence(metrics, player);
    
    return {
      player: {
        name: player.name,
        position: player.position,
        team: player.team,
        age: player.age
      },
      metrics,
      dynastyScore,
      tier,
      confidence,
      strengths: this.identifyStrengths(metrics, player.position),
      concerns: this.identifyConcerns(metrics, player)
    };
  }
  
  private calculateBarrettMetrics(player: any): ScottBarrettMetrics {
    const position = player.position;
    
    // Calculate YPRR (Yards Per Route Run)
    const estimatedRoutes = this.estimateRoutes(player);
    const yardsPerRouteRun = estimatedRoutes > 0 ? 
      (player.receivingYards || this.estimateReceivingYards(player)) / estimatedRoutes : 0;
    
    // Calculate TPRR (Targets Per Route Run) 
    const targetsPerRouteRun = estimatedRoutes > 0 ?
      (player.targets || this.estimateTargets(player)) / estimatedRoutes : 0;
    
    // Calculate First Downs Per Route (more stable than YPRR)
    const firstDownsPerRoute = estimatedRoutes > 0 ?
      this.estimateFirstDowns(player) / estimatedRoutes : 0;
    
    // Calculate Actual Opportunity (Barrett's signature metric)
    const actualOpportunity = this.calculateActualOpportunity(player);
    
    // Calculate Weighted Opportunity for RBs: (Carries × 0.58) + (Targets × 1.59)
    const weightedOpportunity = position === 'RB' ?
      (this.estimateCarries(player) * 0.58) + (this.estimateTargets(player) * 1.59) :
      this.estimateTargets(player) * 1.59; // WR/TE only targets
    
    return {
      yardsPerRouteRun,
      targetsPerRouteRun,
      firstDownsPerRoute,
      actualOpportunity,
      weightedOpportunity,
      snapShare: this.estimateSnapShare(player),
      bellCowIndex: position === 'RB' ? this.calculateBellCowIndex(player) : undefined,
      redZoneShare: this.estimateRedZoneShare(player),
      goalLineCarries: position === 'RB' ? this.estimateGoalLineCarries(player) : undefined,
      teamPassAttempts: this.getTeamContext(player),
      consistencyScore: this.calculateConsistency(player),
      ageAdjustment: this.calculateAgeAdjustment(player)
    };
  }
  
  private calculateBarrettDynastyScore(metrics: ScottBarrettMetrics, position: string): number {
    let score = 0;
    
    // Actual Opportunity (40% weight) - Most predictive per Barrett
    const opportunityScore = this.scoreActualOpportunity(metrics.actualOpportunity, position);
    score += opportunityScore * 0.40;
    
    // Efficiency Metrics (30% weight) - YPRR/TPRR combination
    const efficiencyScore = this.scoreEfficiency(metrics, position);
    score += efficiencyScore * 0.30;
    
    // Age (20% weight) - Youth premium for dynasty
    const ageScore = metrics.ageAdjustment;
    score += ageScore * 0.20;
    
    // Context (10% weight) - Team situation and consistency
    const contextScore = this.scoreContext(metrics, position);
    score += contextScore * 0.10;
    
    return Math.max(0, Math.min(100, score));
  }
  
  private scoreActualOpportunity(actualOpp: number, position: string): number {
    // Scott Barrett thresholds for high-end opportunity
    const thresholds = {
      'RB': { elite: 400, high: 300, solid: 200, low: 100 },
      'WR': { elite: 300, high: 225, solid: 150, low: 75 },
      'TE': { elite: 200, high: 150, solid: 100, low: 50 },
      'QB': { elite: 500, high: 400, solid: 300, low: 200 }
    };
    
    const thresh = thresholds[position as keyof typeof thresholds];
    if (actualOpp >= thresh.elite) return 95;
    if (actualOpp >= thresh.high) return 85;
    if (actualOpp >= thresh.solid) return 70;
    if (actualOpp >= thresh.low) return 50;
    return 25;
  }
  
  private scoreEfficiency(metrics: ScottBarrettMetrics, position: string): number {
    let score = 0;
    
    if (position === 'WR' || position === 'TE') {
      // YPRR Scoring (Barrett's 2.00+ threshold)
      if (metrics.yardsPerRouteRun >= 2.50) score += 45; // Elite
      else if (metrics.yardsPerRouteRun >= 2.00) score += 35; // NFL Success
      else if (metrics.yardsPerRouteRun >= 1.50) score += 25; // Concern
      else score += 10; // Major concern
      
      // TPRR Scoring (Target-earning ability)
      if (metrics.targetsPerRouteRun >= 0.25) score += 45; // Elite target earner
      else if (metrics.targetsPerRouteRun >= 0.20) score += 35; // Solid
      else if (metrics.targetsPerRouteRun >= 0.15) score += 25; // Average
      else score += 10; // Poor target earning
      
    } else if (position === 'RB') {
      // Bell Cow Index for RBs
      const bellCow = metrics.bellCowIndex || 0;
      if (bellCow >= 80) score += 45; // True bell cow
      else if (bellCow >= 60) score += 35; // High usage
      else if (bellCow >= 40) score += 25; // Committee back
      else score += 10; // Limited role
      
      // Weighted Opportunity for RBs
      if (metrics.weightedOpportunity >= 25) score += 45; // Elite usage
      else if (metrics.weightedOpportunity >= 20) score += 35; // High usage  
      else if (metrics.weightedOpportunity >= 15) score += 25; // Solid usage
      else score += 10; // Limited usage
    }
    
    return Math.min(90, score);
  }
  
  private scoreContext(metrics: ScottBarrettMetrics, position: string): number {
    let score = 50; // Base score
    
    // Team Pass Attempts (more = better for WR/TE)
    if (position === 'WR' || position === 'TE') {
      if (metrics.teamPassAttempts >= 600) score += 20; // High volume offense
      else if (metrics.teamPassAttempts >= 550) score += 10; // Average
      else score -= 10; // Run-heavy offense
    }
    
    // Consistency (lower variance = better)
    if (metrics.consistencyScore <= 0.3) score += 15; // Very consistent
    else if (metrics.consistencyScore <= 0.5) score += 5; // Average
    else score -= 10; // Boom/bust
    
    // Snap Share
    if (metrics.snapShare >= 80) score += 15; // Elite usage
    else if (metrics.snapShare >= 60) score += 5; // Good usage
    else score -= 5; // Limited snaps
    
    return Math.max(0, Math.min(100, score));
  }
  
  private assignBarrettTier(score: number, position: string): 'Elite' | 'BellCow' | 'High-End' | 'Solid' | 'Depth' | 'Bust' {
    if (score >= 90) return 'Elite';
    if (score >= 80) return position === 'RB' ? 'BellCow' : 'High-End';
    if (score >= 70) return 'High-End';
    if (score >= 55) return 'Solid';
    if (score >= 35) return 'Depth';
    return 'Bust';
  }
  
  // Helper methods for metric calculations
  private estimateRoutes(player: any): number {
    const position = player.position;
    const gamesPlayed = player.gamesPlayed || 17;
    
    if (position === 'WR') {
      const targets = player.targets || this.estimateTargets(player);
      return targets * 2.2; // Typical targets to routes ratio
    } else if (position === 'TE') {
      const targets = player.targets || this.estimateTargets(player);
      return targets * 1.8; // TEs run fewer routes per target
    }
    return 0;
  }
  
  private estimateTargets(player: any): number {
    // Use actual targets if available, otherwise estimate from fantasy points
    if (player.targets) return player.targets;
    
    const position = player.position;
    const avgPoints = player.avgPoints || 0;
    
    if (position === 'WR') return Math.max(0, avgPoints * 6); // Rough estimation
    if (position === 'TE') return Math.max(0, avgPoints * 4);
    if (position === 'RB') return Math.max(0, avgPoints * 2.5);
    return 0;
  }
  
  private estimateReceivingYards(player: any): number {
    const targets = this.estimateTargets(player);
    const position = player.position;
    
    if (position === 'WR') return targets * 11; // ~11 yards per target
    if (position === 'TE') return targets * 9;  // ~9 yards per target  
    if (position === 'RB') return targets * 7;  // ~7 yards per target
    return 0;
  }
  
  private calculateActualOpportunity(player: any): number {
    // Simplified Actual Opportunity calculation
    const position = player.position;
    const avgPoints = player.avgPoints || 0;
    const gamesPlayed = 17; // Assume full season
    
    // Base opportunity on fantasy production with position adjustments
    if (position === 'RB') {
      const carries = this.estimateCarries(player);
      const targets = this.estimateTargets(player);
      return (carries * 4.2) + (targets * 9.8); // Barrett's weightings
    } else if (position === 'WR' || position === 'TE') {
      const targets = this.estimateTargets(player);
      return targets * 8.5; // Target value for receivers
    } else if (position === 'QB') {
      return avgPoints * gamesPlayed * 0.8; // QB opportunity proxy
    }
    
    return avgPoints * 10; // Fallback
  }
  
  private estimateCarries(player: any): number {
    if (player.position !== 'RB') return 0;
    const avgPoints = player.avgPoints || 0;
    return Math.max(0, avgPoints * 10); // Rough carries estimation
  }
  
  private calculateBellCowIndex(player: any): number {
    if (player.position !== 'RB') return 0;
    
    // Estimate based on production relative to position
    const avgPoints = player.avgPoints || 0;
    
    if (avgPoints >= 18) return 85; // Elite RB1
    if (avgPoints >= 14) return 70; // Solid RB1/2
    if (avgPoints >= 10) return 55; // RB2/3
    if (avgPoints >= 6) return 35;  // Committee back
    return 15; // Limited role
  }
  
  private estimateSnapShare(player: any): number {
    const avgPoints = player.avgPoints || 0;
    const position = player.position;
    
    if (position === 'WR') {
      if (avgPoints >= 16) return 85; // WR1
      if (avgPoints >= 12) return 70; // WR2
      if (avgPoints >= 8) return 55;  // WR3
      return 40; // Limited role
    } else if (position === 'RB') {
      if (avgPoints >= 16) return 80; // Bell cow
      if (avgPoints >= 12) return 65; // High usage
      if (avgPoints >= 8) return 45;  // Committee
      return 25; // Limited
    } else if (position === 'TE') {
      if (avgPoints >= 12) return 75; // TE1
      if (avgPoints >= 8) return 60;  // TE2
      return 45; // Depth
    }
    return 50; // Default
  }
  
  private estimateRedZoneShare(player: any): number {
    const avgPoints = player.avgPoints || 0;
    const position = player.position;
    
    // Higher TD production suggests higher red zone usage
    const estimatedTDs = avgPoints * 0.6; // Rough TD estimation
    
    if (estimatedTDs >= 10) return 25; // High red zone role
    if (estimatedTDs >= 6) return 15;  // Moderate role
    if (estimatedTDs >= 3) return 8;   // Some usage
    return 3; // Limited
  }
  
  private estimateGoalLineCarries(player: any): number {
    if (player.position !== 'RB') return 0;
    const avgPoints = player.avgPoints || 0;
    return Math.max(0, (avgPoints * 0.8) - 2); // Estimate based on TD production
  }
  
  private estimateFirstDowns(player: any): number {
    const targets = this.estimateTargets(player);
    const position = player.position;
    
    if (position === 'WR') return targets * 0.35; // ~35% target to 1D rate
    if (position === 'TE') return targets * 0.30; // ~30% for TEs
    if (position === 'RB') return targets * 0.25; // ~25% for RB targets
    return 0;
  }
  
  private getTeamContext(player: any): number {
    // Estimate team pass attempts based on player production
    const position = player.position;
    const avgPoints = player.avgPoints || 0;
    
    // Teams with better fantasy players tend to pass more
    if (avgPoints >= 15) return 580; // High volume offense
    if (avgPoints >= 10) return 540; // Average offense
    return 500; // Run-heavy offense
  }
  
  private calculateConsistency(player: any): number {
    // Lower is better (less variance)
    const avgPoints = player.avgPoints || 0;
    
    // High scorers tend to be more consistent
    if (avgPoints >= 16) return 0.25; // Very consistent
    if (avgPoints >= 12) return 0.35; // Good consistency
    if (avgPoints >= 8) return 0.45;  // Average
    return 0.65; // Boom/bust
  }
  
  private calculateAgeAdjustment(player: any): number {
    const age = player.age || 25;
    const position = player.position;
    
    // Age curves by position (dynasty focused)
    if (position === 'RB') {
      if (age <= 23) return 95; // Prime dynasty age
      if (age <= 25) return 85; // Still good
      if (age <= 27) return 70; // Declining
      if (age <= 29) return 50; // Risky
      return 25; // Avoid
    } else if (position === 'WR' || position === 'TE') {
      if (age <= 24) return 95; // Prime dynasty age
      if (age <= 27) return 85; // Still good
      if (age <= 30) return 70; // Declining
      if (age <= 32) return 50; // Risky  
      return 25; // Avoid
    } else if (position === 'QB') {
      if (age <= 26) return 95; // Prime dynasty age
      if (age <= 30) return 85; // Still good
      if (age <= 34) return 70; // Declining
      if (age <= 36) return 50; // Risky
      return 25; // Avoid
    }
    
    return 70; // Default
  }
  
  private calculateConfidence(metrics: ScottBarrettMetrics, player: any): number {
    let confidence = 50; // Base confidence
    
    // Higher opportunity = higher confidence
    if (metrics.actualOpportunity >= 300) confidence += 25;
    else if (metrics.actualOpportunity >= 200) confidence += 15;
    else if (metrics.actualOpportunity >= 100) confidence += 5;
    else confidence -= 15; // Low opportunity = low confidence
    
    // Higher snap share = higher confidence
    if (metrics.snapShare >= 70) confidence += 15;
    else if (metrics.snapShare >= 50) confidence += 5;
    else confidence -= 10;
    
    // Age factor
    if (player.age <= 25) confidence += 10; // Young = more predictable upside
    else if (player.age >= 30) confidence -= 10; // Old = more unpredictable
    
    return Math.max(0, Math.min(100, confidence));
  }
  
  private identifyStrengths(metrics: ScottBarrettMetrics, position: string): string[] {
    const strengths: string[] = [];
    
    if (metrics.yardsPerRouteRun >= 2.50) strengths.push("Elite YPRR (2.50+)");
    else if (metrics.yardsPerRouteRun >= 2.00) strengths.push("NFL-caliber YPRR (2.00+)");
    
    if (metrics.targetsPerRouteRun >= 0.25) strengths.push("Elite target earning");
    else if (metrics.targetsPerRouteRun >= 0.20) strengths.push("Strong target earning");
    
    if (metrics.actualOpportunity >= 400) strengths.push("Elite opportunity");
    else if (metrics.actualOpportunity >= 300) strengths.push("High opportunity");
    
    if (metrics.snapShare >= 80) strengths.push("Dominant snap share");
    else if (metrics.snapShare >= 70) strengths.push("High snap share");
    
    if (position === 'RB' && (metrics.bellCowIndex || 0) >= 75) {
      strengths.push("Bell cow usage");
    }
    
    if (metrics.consistencyScore <= 0.3) strengths.push("High consistency");
    
    return strengths;
  }
  
  private identifyConcerns(metrics: ScottBarrettMetrics, player: any): string[] {
    const concerns: string[] = [];
    
    if (metrics.yardsPerRouteRun < 1.50) concerns.push("Low YPRR efficiency");
    if (metrics.targetsPerRouteRun < 0.15) concerns.push("Poor target earning");
    if (metrics.actualOpportunity < 100) concerns.push("Limited opportunity");
    if (metrics.snapShare < 50) concerns.push("Low snap share");
    if (metrics.consistencyScore > 0.6) concerns.push("High variance/boom-bust");
    
    if (player.age >= 29) concerns.push("Age decline risk");
    
    if (player.position === 'RB' && (metrics.bellCowIndex || 0) < 40) {
      concerns.push("Committee back role");
    }
    
    return concerns;
  }
}

export const scottBarrettAnalytics = new ScottBarrettAnalyticsEngine();