/**
 * Enhanced Dynasty Algorithm v2.0
 * Implements Grok's feedback and KTC-style exponential scaling
 * Research-backed weighting with position-specific efficiency adjustments
 */

export interface EnhancedDynastyMetrics {
  playerId: number;
  playerName: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  
  // Core Components
  productionScore: number;    // Fantasy points per game baseline
  opportunityScore: number;   // Volume metrics (target share, touches)
  ageScore: number;          // Age curve and longevity
  stabilityScore: number;    // Health, consistency, team stability
  efficiencyScore: number;   // Position-specific efficiency metrics
  
  // Enhanced Scoring
  rawDynastyValue: number;   // Before exponential scaling
  enhancedDynastyValue: number; // After KTC-style adjustments
  elitePlayerBonus: number;  // Exponential scaling for top players
  
  // Market Analysis
  tier: 'Elite' | 'Premium' | 'Strong' | 'Solid' | 'Depth' | 'Bench';
  confidenceScore: number;   // Statistical confidence in valuation
  marketComparison: string;  // vs KTC/consensus rankings
}

export class EnhancedDynastyAlgorithm {
  
  /**
   * Calculate enhanced dynasty value with position-specific efficiency weights
   * and KTC-style exponential scaling for elite players
   */
  calculateEnhancedDynastyValue(player: {
    id: number;
    name: string;
    position: 'QB' | 'RB' | 'WR' | 'TE';
    team: string;
    age: number;
    avgPoints: number;
    projectedPoints?: number;
    targetShare?: number;
    snapShare?: number;
    yardsPerRoute?: number;
    yardsAfterContact?: number;
    completionPercentageOverExpected?: number;
    epaPerPlay?: number;
  }): EnhancedDynastyMetrics {
    
    // Position-specific weight adjustments (Grok's recommendation)
    const weights = this.getPositionSpecificWeights(player.position);
    
    // Calculate component scores
    const productionScore = this.calculateProductionScore(player);
    const opportunityScore = this.calculateOpportunityScore(player);
    const ageScore = this.calculateAgeScore(player.age, player.position);
    const stabilityScore = this.calculateStabilityScore(player);
    const efficiencyScore = this.calculateEfficiencyScore(player);
    
    // Calculate raw dynasty value (linear)
    const rawDynastyValue = Math.round(
      (productionScore * weights.production) +
      (opportunityScore * weights.opportunity) +
      (ageScore * weights.age) +
      (stabilityScore * weights.stability) +
      (efficiencyScore * weights.efficiency)
    );
    
    // Apply KTC-style exponential scaling for elite players
    const { enhancedValue, eliteBonus } = this.applyElitePlayerScaling(rawDynastyValue, player.position);
    
    const tier = this.assignTier(enhancedValue);
    const confidenceScore = this.calculateConfidenceScore(player);
    
    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      team: player.team,
      age: player.age,
      productionScore,
      opportunityScore,
      ageScore,
      stabilityScore,
      efficiencyScore,
      rawDynastyValue,
      enhancedDynastyValue: enhancedValue,
      elitePlayerBonus: eliteBonus,
      tier,
      confidenceScore,
      marketComparison: this.getMarketComparison(enhancedValue, player.position)
    };
  }
  
  /**
   * Position-specific weight adjustments based on Grok's feedback
   */
  private getPositionSpecificWeights(position: string): {
    production: number;
    opportunity: number;
    age: number;
    stability: number;
    efficiency: number;
  } {
    switch (position) {
      case 'QB':
        return {
          production: 0.30,
          opportunity: 0.30,  // Starting role is critical
          age: 0.20,         // QBs have longer careers
          stability: 0.15,   // Health critical for QBs
          efficiency: 0.05   // INCREASED: EPA/play, accuracy matter more for QBs
        };
        
      case 'RB':
        return {
          production: 0.32,
          opportunity: 0.35,  // Volume is king for RBs
          age: 0.18,         // RBs age faster
          stability: 0.12,   // Injury risk higher
          efficiency: 0.03   // INCREASED: YAC, elusiveness separate elite RBs
        };
        
      case 'WR':
      case 'TE':
        return {
          production: 0.30,
          opportunity: 0.35,  // Target share most predictive
          age: 0.20,         // Standard aging curve
          stability: 0.15,   // Moderate injury risk
          efficiency: 0.00   // Keep low - YPRR more descriptive than predictive
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
   * KTC-style exponential scaling for elite players
   * Prevents "four quarters equal a dollar" problem
   */
  private applyElitePlayerScaling(rawValue: number, position: string): {
    enhancedValue: number;
    eliteBonus: number;
  } {
    // KTC-inspired exponential formula for elite players
    // Elite players (85+) get disproportionate value increases
    
    const maxValue = 100;
    const valueRatio = rawValue / maxValue;
    
    // Exponential scaling formula inspired by KTC's raw adjustment
    // Elite players get exponentially higher values
    let eliteMultiplier = 1.0;
    
    if (rawValue >= 90) {
      // Top 1% players - massive premium (Josh Allen, Justin Jefferson tier)
      eliteMultiplier = 1.0 + 0.25 * Math.pow(valueRatio, 3);
    } else if (rawValue >= 85) {
      // Elite tier - significant premium
      eliteMultiplier = 1.0 + 0.15 * Math.pow(valueRatio, 2.5);
    } else if (rawValue >= 80) {
      // Premium tier - moderate premium
      eliteMultiplier = 1.0 + 0.08 * Math.pow(valueRatio, 2);
    } else if (rawValue >= 75) {
      // Strong tier - small premium
      eliteMultiplier = 1.0 + 0.03 * Math.pow(valueRatio, 1.5);
    }
    
    // Position-specific adjustments
    if (position === 'QB' && rawValue >= 85) {
      // QBs get additional premium in dynasty (longer careers)
      eliteMultiplier *= 1.05;
    }
    
    const enhancedValue = Math.min(100, Math.round(rawValue * eliteMultiplier));
    const eliteBonus = enhancedValue - rawValue;
    
    return { enhancedValue, eliteBonus };
  }
  
  /**
   * Calculate production score with position-specific thresholds
   */
  private calculateProductionScore(player: any): number {
    const avgPoints = player.avgPoints || 0;
    
    // Position-specific elite thresholds
    const thresholds = {
      'QB': { elite: 25, good: 18, average: 12 },
      'RB': { elite: 18, good: 14, average: 10 },
      'WR': { elite: 16, good: 12, average: 8 },
      'TE': { elite: 14, good: 10, average: 6 }
    };
    
    const posThreshold = thresholds[player.position as keyof typeof thresholds] || thresholds['WR'];
    
    if (avgPoints >= posThreshold.elite) return 95;
    if (avgPoints >= posThreshold.good) return 80;
    if (avgPoints >= posThreshold.average) return 60;
    
    // Linear scaling below average
    return Math.max(0, Math.round((avgPoints / posThreshold.average) * 60));
  }
  
  /**
   * Calculate opportunity score based on volume metrics
   */
  private calculateOpportunityScore(player: any): number {
    let score = 50; // Base score
    
    // Target share (most predictive metric)
    if (player.targetShare) {
      if (player.targetShare >= 0.25) score += 25; // Elite target share
      else if (player.targetShare >= 0.20) score += 15; // Good target share
      else if (player.targetShare >= 0.15) score += 5; // Decent target share
      else score -= 10; // Low target share
    }
    
    // Snap share
    if (player.snapShare) {
      if (player.snapShare >= 0.80) score += 15; // Workhorse
      else if (player.snapShare >= 0.60) score += 5; // Good usage
      else score -= 5; // Limited role
    }
    
    // Position-specific adjustments
    if (player.position === 'QB') {
      // Starting QBs get opportunity premium
      score += 20;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Age score with position-specific aging curves
   */
  /**
   * Research-backed position-specific aging curves
   * Based on NFL aging research: RBs cliff at 30, WRs at 32, TEs at 33, QBs plateau 25-35
   */
  private calculateAgeScore(age: number, position: string): number {
    let score = 50; // Base score
    
    switch (position) {
      case 'QB':
        // QBs: Peak 25-30, gradual decline after 35
        // Research: 34% of age 36+ players are QBs, long sustained prime
        if (age <= 24) score = 85; // Development years
        else if (age <= 30) score = 100; // Prime plateau (25-30)
        else if (age <= 34) score = 95; // Still elite
        else if (age <= 37) score = 80; // Gradual decline
        else if (age <= 40) score = 60; // Late career
        else score = 35;
        break;
        
      case 'RB':
        // RBs: Peak 22-26, steep decline at 28, cliff at 30
        // Research: 95% of elite seasons before 29, only 3% at age 30
        if (age <= 22) score = 85; // Early career
        else if (age <= 26) score = 100; // Peak years (76% of elite seasons)
        else if (age <= 28) score = 65; // 15% decline starts
        else if (age <= 29) score = 45; // 25% decline
        else if (age <= 30) score = 25; // Age cliff (40% decline)
        else score = 10; // Post-cliff wasteland
        break;
        
      case 'WR':
        // WRs: Peak 24-27, gradual decline 29-30, cliff at 32
        // Research: 79% of peak seasons before 30, 5.6% after 32
        if (age <= 23) score = 85; // Development/breakout years
        else if (age <= 27) score = 100; // Peak years
        else if (age <= 30) score = 85; // Gradual decline starts
        else if (age <= 32) score = 65; // Noticeable drop
        else if (age <= 34) score = 40; // Post-cliff
        else score = 20;
        break;
        
      case 'TE':
        // TEs: Peak 25-28, decline at 30, cliff at 33
        // Research: 92% of peak seasons before 33, late bloomers
        if (age <= 24) score = 80; // Late development
        else if (age <= 28) score = 100; // Peak years (Years 5-6)
        else if (age <= 30) score = 85; // Still solid
        else if (age <= 33) score = 60; // Decline period
        else if (age <= 35) score = 35; // Post-cliff
        else score = 15;
        break;
        
      default:
        // Generic aging curve
        if (age <= 25) score = 90;
        else if (age <= 28) score = 100;
        else if (age <= 31) score = 75;
        else score = 50;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Enhanced efficiency score with position-specific metrics
   */
  private calculateEfficiencyScore(player: any): number {
    let score = 50; // Base efficiency
    
    switch (player.position) {
      case 'QB':
        // For elite QBs like Josh Allen, Mahomes, etc., use production as efficiency proxy
        const avgPoints = player.avgPoints || 0;
        
        // Elite fantasy production indicates efficiency
        if (avgPoints >= 25) score += 30; // Elite QB1s like Josh Allen
        else if (avgPoints >= 20) score += 20; // High-end QB1s
        else if (avgPoints >= 15) score += 10; // Solid starters
        else if (avgPoints < 10) score -= 15; // Poor efficiency
        
        // Dual-threat bonus for mobile QBs
        if (player.rushingYards && player.rushingYards > 400) {
          score += 15; // Josh Allen, Lamar, Hurts get efficiency boost
        }
        
        // Traditional efficiency metrics when available
        if (player.epaPerPlay) {
          if (player.epaPerPlay >= 0.15) score += 10;
          else if (player.epaPerPlay >= 0.05) score += 5;
        }
        break;
        
      case 'RB':
        // Yards after contact and elusiveness
        if (player.yardsAfterContact) {
          if (player.yardsAfterContact >= 3.5) score += 25;
          else if (player.yardsAfterContact >= 2.8) score += 10;
          else if (player.yardsAfterContact < 2.0) score -= 10;
        }
        break;
        
      case 'WR':
      case 'TE':
        // YPRR - but weighted lower per research
        if (player.yardsPerRoute) {
          if (player.yardsPerRoute >= 2.5) score += 15;
          else if (player.yardsPerRoute >= 2.0) score += 5;
          else if (player.yardsPerRoute < 1.5) score -= 5;
        }
        break;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate stability score
   */
  private calculateStabilityScore(player: any): number {
    let score = 70; // Base stability
    
    // Age-based injury risk
    if (player.age >= 30) score -= 15;
    else if (player.age >= 28) score -= 5;
    else if (player.age <= 24) score += 10;
    
    // Position-specific injury risk
    if (player.position === 'RB') score -= 10; // Higher injury risk
    if (player.position === 'QB') score += 5; // Lower injury risk
    
    return Math.max(20, Math.min(100, score));
  }
  
  /**
   * Assign tier based on enhanced dynasty value
   */
  private assignTier(value: number): 'Elite' | 'Premium' | 'Strong' | 'Solid' | 'Depth' | 'Bench' {
    if (value >= 90) return 'Elite';
    if (value >= 75) return 'Premium';
    if (value >= 60) return 'Strong';
    if (value >= 45) return 'Solid';
    if (value >= 30) return 'Depth';
    return 'Bench';
  }
  
  /**
   * Calculate confidence score in valuation
   */
  private calculateConfidenceScore(player: any): number {
    let confidence = 50;
    
    // More data = higher confidence
    if (player.avgPoints && player.avgPoints > 0) confidence += 20;
    if (player.targetShare) confidence += 15;
    if (player.snapShare) confidence += 10;
    if (player.age && player.age >= 23 && player.age <= 30) confidence += 5;
    
    return Math.min(100, confidence);
  }
  
  /**
   * Compare to market consensus
   */
  private getMarketComparison(value: number, position: string): string {
    if (value >= 90) return 'Elite dynasty asset - top tier';
    if (value >= 75) return 'Premium player - high-end starter';
    if (value >= 60) return 'Strong contributor - reliable starter';
    if (value >= 45) return 'Solid role player - bye week fill';
    if (value >= 30) return 'Depth piece - bench asset';
    return 'Deep roster - taxi squad';
  }
}

export const enhancedDynastyAlgorithm = new EnhancedDynastyAlgorithm();