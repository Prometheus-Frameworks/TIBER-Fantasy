import type { Player } from "@shared/schema";

// Research-based analytics framework for dynasty valuation
export interface AdvancedMetrics {
  // Volume Metrics (Most Predictive - 40% weight)
  targetShare: number;           // % of team targets
  touchesPerGame: number;        // RB: rushes + targets per game
  snapShare: number;             // % of offensive snaps
  redZoneShare: number;          // % of red zone opportunities
  
  // Efficiency Metrics (Secondary - 25% weight)
  yardsPerRouteRun: number;      // YPRR - elite threshold 2.0+
  firstDownsPerRoute: number;    // 1D/RR - more predictive than YPRR
  yardsAfterContact: number;     // RB efficiency metric
  catchRate: number;             // Reception percentage
  
  // Context Metrics (Situational - 20% weight)
  teamPassAttempts: number;      // Offensive context
  depthOfTarget: number;         // aDOT for receivers
  thirdDownUsage: number;        // Situational role
  pressureRate: number;          // QB context
  
  // Stability Metrics (Predictive Power - 15% weight)
  consistencyScore: number;      // Week-to-week variance
  injuryHistory: number;         // Availability factor
  ageAdjustment: number;         // Peak performance curve
  teamStability: number;         // Coaching/scheme consistency
}

export interface PlayerAnalytics {
  player: Player;
  metrics: AdvancedMetrics;
  dynastyScore: number;          // 0-100 composite score
  tier: 'Elite' | 'Tier1' | 'Tier2' | 'Tier3' | 'Bench';
  confidence: number;            // Statistical confidence in score
  predictiveFactors: string[];   // Key metrics driving the score
  riskFactors: string[];         // Concerns or volatility indicators
}

export class AdvancedAnalyticsEngine {
  
  /**
   * Calculate comprehensive dynasty value using research-backed weighting
   */
  async analyzePlayer(player: Player): Promise<PlayerAnalytics> {
    const metrics = this.calculateAdvancedMetrics(player);
    const dynastyScore = this.calculateDynastyScore(metrics, player.position);
    const tier = this.assignTier(dynastyScore);
    const confidence = this.calculateConfidence(metrics, player);
    const predictiveFactors = this.identifyKeyFactors(metrics, player.position);
    const riskFactors = this.identifyRiskFactors(metrics, player);
    
    return {
      player,
      metrics,
      dynastyScore,
      tier,
      confidence,
      predictiveFactors,
      riskFactors
    };
  }
  
  private calculateAdvancedMetrics(player: Player): AdvancedMetrics {
    // Calculate metrics based on available player data
    return {
      // Volume metrics (most predictive)
      targetShare: this.calculateTargetShare(player),
      touchesPerGame: this.calculateTouchesPerGame(player),
      snapShare: this.calculateSnapShare(player),
      redZoneShare: this.calculateRedZoneShare(player),
      
      // Efficiency metrics
      yardsPerRouteRun: this.calculateYPRR(player),
      firstDownsPerRoute: this.calculateFirstDownsPerRoute(player),
      yardsAfterContact: this.calculateYAC(player),
      catchRate: this.calculateCatchRate(player),
      
      // Context metrics
      teamPassAttempts: this.getTeamContext(player),
      depthOfTarget: this.calculateADOT(player),
      thirdDownUsage: this.calculateThirdDownUsage(player),
      pressureRate: this.getQBPressureContext(player),
      
      // Stability metrics
      consistencyScore: this.calculateConsistency(player),
      injuryHistory: this.calculateInjuryFactor(player),
      ageAdjustment: this.calculateAgeAdjustment(player),
      teamStability: this.calculateTeamStability(player)
    };
  }
  
  private calculateDynastyScore(metrics: AdvancedMetrics, position: string): number {
    // Research-based weighting system
    const volumeWeight = 0.40;      // Most predictive
    const efficiencyWeight = 0.25;  // Secondary importance
    const contextWeight = 0.20;     // Situational factors
    const stabilityWeight = 0.15;   // Predictive consistency
    
    const volumeScore = this.calculateVolumeScore(metrics, position);
    const efficiencyScore = this.calculateEfficiencyScore(metrics, position);
    const contextScore = this.calculateContextScore(metrics, position);
    const stabilityScore = this.calculateStabilityScore(metrics);
    
    return Math.round(
      (volumeScore * volumeWeight) +
      (efficiencyScore * efficiencyWeight) +
      (contextScore * contextWeight) +
      (stabilityScore * stabilityWeight)
    );
  }
  
  private calculateVolumeScore(metrics: AdvancedMetrics, position: string): number {
    let score = 0;
    
    if (position === 'WR' || position === 'TE') {
      // Target share is king for receivers
      if (metrics.targetShare >= 25) score += 35;      // Elite target share
      else if (metrics.targetShare >= 20) score += 30; // High target share
      else if (metrics.targetShare >= 15) score += 20; // Solid target share
      else if (metrics.targetShare >= 10) score += 10; // Role player
      
      // Snap share importance
      if (metrics.snapShare >= 80) score += 25;
      else if (metrics.snapShare >= 65) score += 20;
      else if (metrics.snapShare >= 50) score += 15;
      
      // Red zone opportunity
      if (metrics.redZoneShare >= 25) score += 15;
      else if (metrics.redZoneShare >= 15) score += 10;
      
    } else if (position === 'RB') {
      // Touches per game critical for RBs
      if (metrics.touchesPerGame >= 20) score += 35;   // Bell cow usage
      else if (metrics.touchesPerGame >= 15) score += 25; // Strong usage
      else if (metrics.touchesPerGame >= 12) score += 15; // Committee back
      else if (metrics.touchesPerGame >= 8) score += 8;   // Change of pace
      
      // Target share for receiving backs
      if (metrics.targetShare >= 8) score += 20;  // Elite receiving back
      else if (metrics.targetShare >= 5) score += 15; // Good receiving back
      else if (metrics.targetShare >= 3) score += 10; // Some receiving work
      
      // Red zone dominance
      if (metrics.redZoneShare >= 40) score += 20;
      else if (metrics.redZoneShare >= 25) score += 15;
      
    } else if (position === 'QB') {
      // Pass attempts and team context
      if (metrics.teamPassAttempts >= 600) score += 30; // High-volume offense
      else if (metrics.teamPassAttempts >= 550) score += 25;
      else if (metrics.teamPassAttempts >= 500) score += 20;
      
      if (metrics.snapShare >= 95) score += 25; // Durability
      else if (metrics.snapShare >= 90) score += 20;
    }
    
    return Math.min(score, 100);
  }
  
  private calculateEfficiencyScore(metrics: AdvancedMetrics, position: string): number {
    let score = 0;
    
    if (position === 'WR' || position === 'TE') {
      // YPRR - elite threshold research
      if (metrics.yardsPerRouteRun >= 3.0) score += 30;      // Elite college level
      else if (metrics.yardsPerRouteRun >= 2.5) score += 25; // Very strong
      else if (metrics.yardsPerRouteRun >= 2.0) score += 20; // Strong NFL level
      else if (metrics.yardsPerRouteRun >= 1.5) score += 15; // Average
      else if (metrics.yardsPerRouteRun >= 1.0) score += 10; // Below average
      
      // First downs per route (more predictive than YPRR)
      if (metrics.firstDownsPerRoute >= 0.12) score += 25; // Elite 12%+
      else if (metrics.firstDownsPerRoute >= 0.095) score += 20; // Strong 9.5%+
      else if (metrics.firstDownsPerRoute >= 0.08) score += 15;
      
      // Catch rate
      if (metrics.catchRate >= 75) score += 20;
      else if (metrics.catchRate >= 70) score += 15;
      else if (metrics.catchRate >= 65) score += 10;
      
    } else if (position === 'RB') {
      // Yards after contact per attempt
      if (metrics.yardsAfterContact >= 3.0) score += 25;
      else if (metrics.yardsAfterContact >= 2.5) score += 20;
      else if (metrics.yardsAfterContact >= 2.0) score += 15;
      
      // Receiving efficiency
      if (metrics.yardsPerRouteRun >= 2.0) score += 20; // Elite receiving back
      else if (metrics.yardsPerRouteRun >= 1.5) score += 15;
      
      if (metrics.catchRate >= 80) score += 15;
      else if (metrics.catchRate >= 75) score += 12;
    }
    
    return Math.min(score, 100);
  }
  
  private calculateContextScore(metrics: AdvancedMetrics, position: string): number {
    let score = 50; // Base score
    
    // Team offensive context
    if (metrics.teamPassAttempts >= 600) score += 20; // High-volume passing offense
    else if (metrics.teamPassAttempts <= 450) score -= 15; // Run-heavy offense
    
    // Depth of target context for receivers
    if (position === 'WR' || position === 'TE') {
      if (metrics.depthOfTarget >= 12) score += 15; // Deep threat value
      else if (metrics.depthOfTarget <= 6) score += 10; // PPR safety
    }
    
    // Third down usage indicates trust
    if (metrics.thirdDownUsage >= 60) score += 15;
    else if (metrics.thirdDownUsage >= 40) score += 10;
    
    return Math.max(0, Math.min(score, 100));
  }
  
  private calculateStabilityScore(metrics: AdvancedMetrics): number {
    let score = 50; // Base score
    
    // Consistency is key for dynasty
    if (metrics.consistencyScore >= 80) score += 20;
    else if (metrics.consistencyScore >= 70) score += 15;
    else if (metrics.consistencyScore >= 60) score += 10;
    else if (metrics.consistencyScore <= 40) score -= 15;
    
    // Age curve adjustment
    score += metrics.ageAdjustment;
    
    // Injury history penalty
    if (metrics.injuryHistory >= 3) score -= 20; // Multiple injuries
    else if (metrics.injuryHistory >= 1) score -= 10; // Some injury concern
    
    // Team stability
    if (metrics.teamStability >= 80) score += 15; // Stable organization
    else if (metrics.teamStability <= 40) score -= 10; // Chaotic situation
    
    return Math.max(0, Math.min(score, 100));
  }
  
  private assignTier(score: number): 'Elite' | 'Tier1' | 'Tier2' | 'Tier3' | 'Bench' {
    if (score >= 85) return 'Elite';
    if (score >= 75) return 'Tier1';
    if (score >= 60) return 'Tier2';
    if (score >= 45) return 'Tier3';
    return 'Bench';
  }
  
  private calculateConfidence(metrics: AdvancedMetrics, player: Player): number {
    let confidence = 50;
    
    // Higher confidence with more volume
    if (metrics.snapShare >= 70) confidence += 20;
    if (metrics.targetShare >= 15 || metrics.touchesPerGame >= 15) confidence += 15;
    
    // Sample size matters
    if (player.gamesPlayed >= 14) confidence += 15;
    else if (player.gamesPlayed <= 8) confidence -= 15;
    
    // Consistency adds confidence
    if (metrics.consistencyScore >= 70) confidence += 10;
    else if (metrics.consistencyScore <= 50) confidence -= 10;
    
    return Math.max(0, Math.min(confidence, 100));
  }
  
  private identifyKeyFactors(metrics: AdvancedMetrics, position: string): string[] {
    const factors: string[] = [];
    
    // Volume factors (most important)
    if (metrics.targetShare >= 20) factors.push(`Elite ${metrics.targetShare.toFixed(1)}% target share`);
    if (metrics.touchesPerGame >= 18) factors.push(`Bell cow usage (${metrics.touchesPerGame.toFixed(1)} touches/game)`);
    if (metrics.snapShare >= 75) factors.push(`High snap count (${metrics.snapShare.toFixed(1)}%)`);
    
    // Efficiency factors
    if (metrics.yardsPerRouteRun >= 2.5) factors.push(`Elite efficiency (${metrics.yardsPerRouteRun.toFixed(2)} YPRR)`);
    if (metrics.firstDownsPerRoute >= 0.095) factors.push(`Strong chain moving (${(metrics.firstDownsPerRoute * 100).toFixed(1)}% 1D/RR)`);
    
    // Context factors
    if (metrics.teamPassAttempts >= 600) factors.push('High-volume passing offense');
    if (metrics.redZoneShare >= 25) factors.push(`Strong red zone role (${metrics.redZoneShare.toFixed(1)}%)`);
    
    return factors.slice(0, 4); // Top 4 factors
  }
  
  private identifyRiskFactors(metrics: AdvancedMetrics, player: Player): string[] {
    const risks: string[] = [];
    
    // Volume concerns
    if (metrics.targetShare <= 10 && (player.position === 'WR' || player.position === 'TE')) {
      risks.push(`Low target share (${metrics.targetShare.toFixed(1)}%)`);
    }
    if (metrics.touchesPerGame <= 10 && player.position === 'RB') {
      risks.push(`Limited touches (${metrics.touchesPerGame.toFixed(1)}/game)`);
    }
    
    // Efficiency red flags
    if (metrics.yardsPerRouteRun <= 1.5) risks.push('Below-average efficiency');
    if (metrics.catchRate <= 60) risks.push('Poor catch rate');
    
    // Context risks
    if (metrics.teamPassAttempts <= 450) risks.push('Run-heavy offense');
    if (metrics.consistencyScore <= 50) risks.push('High week-to-week variance');
    
    // Age/injury
    if (metrics.ageAdjustment <= -15) risks.push('Age-related decline risk');
    if (metrics.injuryHistory >= 2) risks.push('Injury history concerns');
    
    return risks.slice(0, 3); // Top 3 risks
  }
  
  // Helper calculation methods
  private calculateTargetShare(player: Player): number {
    // Use existing target share or estimate from team context
    return player.targetShare || this.estimateTargetShare(player);
  }
  
  private estimateTargetShare(player: Player): number {
    // Estimate based on fantasy points and position
    if (player.position === 'WR') {
      if (player.avgPoints >= 15) return 22; // WR1 level
      if (player.avgPoints >= 12) return 18; // WR2 level
      if (player.avgPoints >= 8) return 14;  // WR3 level
      return 10; // Depth player
    }
    if (player.position === 'TE') {
      if (player.avgPoints >= 12) return 18; // Elite TE
      if (player.avgPoints >= 8) return 14;  // TE1 level
      return 10; // Streaming option
    }
    if (player.position === 'RB') {
      if (player.avgPoints >= 15) return 8;  // Elite receiving back
      if (player.avgPoints >= 10) return 5;  // Solid receiving work
      return 3; // Limited receiving
    }
    return 5; // QB default
  }
  
  private calculateTouchesPerGame(player: Player): number {
    if (player.position !== 'RB') return 0;
    
    // Estimate from carries + receiving work
    const carries = player.carries || this.estimateCarries(player);
    const targets = player.targetShare ? (player.targetShare * 35 / 100) : 3; // Est targets/game
    
    return carries + targets;
  }
  
  private estimateCarries(player: Player): number {
    if (player.avgPoints >= 15) return 18; // RB1
    if (player.avgPoints >= 10) return 12; // RB2
    if (player.avgPoints >= 6) return 8;   // RB3
    return 4; // Backup
  }
  
  private calculateSnapShare(player: Player): number {
    return player.snapCount ? (player.snapCount / 16 / 65 * 100) : this.estimateSnapShare(player);
  }
  
  private estimateSnapShare(player: Player): number {
    if (player.avgPoints >= 15) return 80; // Workhorse
    if (player.avgPoints >= 10) return 65; // Solid starter
    if (player.avgPoints >= 6) return 50;  // Rotational
    return 30; // Limited role
  }
  
  private calculateRedZoneShare(player: Player): number {
    return player.redZoneTargets ? (player.redZoneTargets / 16 * 4) : this.estimateRedZoneShare(player);
  }
  
  private estimateRedZoneShare(player: Player): number {
    // Estimate based on touchdown production
    const touchdowns = Math.round(player.avgPoints * 0.6); // Rough TD estimate
    if (touchdowns >= 8) return 25; // High red zone usage
    if (touchdowns >= 5) return 18; // Solid red zone role
    if (touchdowns >= 3) return 12; // Some red zone work
    return 6; // Limited red zone role
  }
  
  private calculateYPRR(player: Player): number {
    // Estimate YPRR from receiving yards and snaps
    if (player.position === 'QB') return 0;
    
    const routes = this.estimateRoutes(player);
    const yards = player.receivingYards || this.estimateReceivingYards(player);
    
    return routes > 0 ? yards / routes : 0;
  }
  
  private estimateRoutes(player: Player): number {
    const snapShare = this.calculateSnapShare(player);
    const passPlays = 600 * 0.6; // Team pass attempts * 60% pass plays
    return snapShare / 100 * passPlays;
  }
  
  private estimateReceivingYards(player: Player): number {
    // Estimate from fantasy points
    if (player.position === 'WR' || player.position === 'TE') {
      return player.avgPoints * 10; // Rough yards per point
    }
    if (player.position === 'RB') {
      return player.avgPoints * 3; // RBs get fewer receiving yards
    }
    return 0;
  }
  
  private calculateFirstDownsPerRoute(player: Player): number {
    // Estimate first downs from production
    const routes = this.estimateRoutes(player);
    const firstDowns = Math.round(player.avgPoints * 0.8); // Rough first down estimate
    
    return routes > 0 ? firstDowns / routes : 0;
  }
  
  private calculateYAC(player: Player): number {
    // Estimate yards after contact for RBs
    if (player.position !== 'RB') return 0;
    
    const rushingYards = player.rushingYards || (player.avgPoints * 8);
    const carries = this.estimateCarries(player);
    
    return carries > 0 ? (rushingYards * 0.6) / carries : 0; // 60% of yards are after contact
  }
  
  private calculateCatchRate(player: Player): number {
    const targets = this.calculateTargetShare(player) * 35 / 100 * 16; // Season targets
    const receptions = player.receptions || (targets * 0.7); // Estimate 70% catch rate
    
    return targets > 0 ? (receptions / targets * 100) : 70;
  }
  
  private getTeamContext(player: Player): number {
    // Estimate team pass attempts based on player production
    if (player.avgPoints >= 15) return 600; // High-volume offense
    if (player.avgPoints >= 10) return 550; // Balanced offense
    return 500; // Run-heavy offense
  }
  
  private calculateADOT(player: Player): number {
    // Estimate average depth of target
    if (player.position === 'WR') {
      if (player.avgPoints >= 15) return 12; // Deep threat WR1
      if (player.avgPoints >= 8) return 9;   // Intermediate routes
      return 7; // Short routes/slot
    }
    if (player.position === 'TE') return 8; // TEs typically shorter
    return 0;
  }
  
  private calculateThirdDownUsage(player: Player): number {
    // Estimate third down role from overall usage
    const snapShare = this.calculateSnapShare(player);
    return snapShare * 0.8; // Slightly lower on third downs
  }
  
  private getQBPressureContext(player: Player): number {
    return 25; // League average pressure rate
  }
  
  private calculateConsistency(player: Player): number {
    // Estimate consistency from overall production level
    if (player.avgPoints >= 15) return 75; // Stars are more consistent
    if (player.avgPoints >= 10) return 65; // Solid players
    if (player.avgPoints >= 6) return 55;  // Volatile
    return 45; // Very volatile
  }
  
  private calculateInjuryFactor(player: Player): number {
    // Use injury status as proxy
    if (player.injuryStatus === 'OUT') return 3;
    if (player.injuryStatus === 'DOUBTFUL') return 2;
    if (player.injuryStatus === 'QUESTIONABLE') return 1;
    return 0; // Healthy
  }
  
  private calculateAgeAdjustment(player: Player): number {
    const age = player.age || 25; // Default age
    
    // Age curve adjustments by position
    if (player.position === 'RB') {
      if (age <= 24) return 10;  // Prime years
      if (age <= 27) return 5;   // Still good
      if (age <= 29) return 0;   // Neutral
      if (age <= 31) return -10; // Decline
      return -20; // Significant decline
    }
    
    if (player.position === 'WR' || player.position === 'TE') {
      if (age <= 26) return 5;   // Prime years
      if (age <= 29) return 0;   // Peak
      if (age <= 32) return -5;  // Slight decline
      return -15; // Notable decline
    }
    
    if (player.position === 'QB') {
      if (age <= 28) return 5;   // Improving
      if (age <= 35) return 0;   // Prime
      if (age <= 38) return -5;  // Slight decline
      return -15; // Clear decline
    }
    
    return 0;
  }
  
  private calculateTeamStability(player: Player): number {
    // Estimate team stability from offensive production
    if (player.avgPoints >= 12) return 80; // Stable, productive offense
    if (player.avgPoints >= 8) return 65;  // Decent stability
    if (player.avgPoints >= 4) return 50;  // Some concerns
    return 40; // Unstable situation
  }
}

export const advancedAnalyticsEngine = new AdvancedAnalyticsEngine();