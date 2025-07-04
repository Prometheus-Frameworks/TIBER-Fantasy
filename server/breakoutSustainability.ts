/**
 * Breakout Sustainability Scoring System
 * 
 * Calculates 0-100 sustainability scores using premium metrics
 * Integrates with FantasyPointsData for advanced analysis
 */

import { FantasyPointsDataMetrics } from './fantasyPointsDataETL';

export interface SustainabilityScore {
  playerId: number;
  playerName: string;
  totalScore: number;           // 0-100 composite sustainability score
  
  // Component scores (0-100 each)
  volumeStability: number;      // 40% weight - target/carry consistency
  teamContext: number;          // 25% weight - depth chart position
  skillMetrics: number;         // 20% weight - efficiency indicators
  healthProfile: number;        // 10% weight - injury risk
  ageProgression: number;       // 5% weight - career stage
  
  // Detailed factors
  factors: {
    positive: string[];         // Factors supporting sustainability
    negative: string[];         // Risk factors
    keyMetrics: Array<{
      name: string;
      value: number;
      percentile: number;
      impact: 'high' | 'medium' | 'low';
    }>;
  };
  
  // Predictive analysis
  projections: {
    weeklyFloor: number;        // Expected minimum weekly points
    weeklyCeiling: number;      // Expected maximum weekly points
    seasonLongViability: 'elite' | 'good' | 'risky' | 'volatile';
    regressionRisk: number;     // 0-100, higher = more risk
  };
  
  lastCalculated: Date;
}

export class BreakoutSustainabilityEngine {
  
  /**
   * Calculate comprehensive sustainability score
   */
  calculateSustainability(
    playerId: number,
    playerName: string,
    position: string,
    premiumMetrics: FantasyPointsDataMetrics,
    basicMetrics: {
      snapShareIncrease: number;
      touchIncrease: number;
      targetIncrease: number;
      trendStartWeek: number;
    }
  ): SustainabilityScore {
    
    // Component calculations with premium metrics
    const volumeStability = this.calculateVolumeStability(premiumMetrics, basicMetrics, position);
    const teamContext = this.calculateTeamContext(premiumMetrics, position);
    const skillMetrics = this.calculateSkillMetrics(premiumMetrics, position);
    const healthProfile = this.calculateHealthProfile(playerId, position);
    const ageProgression = this.calculateAgeProgression(playerId, position);
    
    // Weighted composite score
    const totalScore = Math.round(
      (volumeStability * 0.40) +
      (teamContext * 0.25) +
      (skillMetrics * 0.20) +
      (healthProfile * 0.10) +
      (ageProgression * 0.05)
    );
    
    // Generate detailed analysis
    const factors = this.generateFactorAnalysis(premiumMetrics, basicMetrics, position, playerName);
    const projections = this.generateProjections(totalScore, premiumMetrics, position);
    
    return {
      playerId,
      playerName,
      totalScore: Math.max(0, Math.min(100, totalScore)),
      volumeStability,
      teamContext,
      skillMetrics,
      healthProfile,
      ageProgression,
      factors,
      projections,
      lastCalculated: new Date()
    };
  }
  
  /**
   * Volume Stability (40% weight) - Most predictive factor
   */
  private calculateVolumeStability(
    metrics: FantasyPointsDataMetrics,
    basic: any,
    position: string
  ): number {
    let score = 50; // Base score
    
    // Target share consistency (premium metric)
    if (metrics.targetShare > 20) score += 25;
    else if (metrics.targetShare > 15) score += 15;
    else if (metrics.targetShare > 10) score += 5;
    
    // Route participation reliability
    if (metrics.routeParticipation > 75) score += 20;
    else if (metrics.routeParticipation > 60) score += 10;
    
    // Red zone involvement
    if (metrics.redZoneShare > 25) score += 15;
    else if (metrics.redZoneShare > 15) score += 8;
    
    // Snap count trending
    if (basic.snapShareIncrease > 30) score += 10;
    else if (basic.snapShareIncrease > 20) score += 5;
    
    // Position-specific adjustments
    if (position === 'RB') {
      // RBs need carry volume for sustainability
      if (basic.touchIncrease > 15) score += 10;
      else if (basic.touchIncrease < 8) score -= 15;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Team Context (25% weight) - Depth chart and scheme fit
   */
  private calculateTeamContext(metrics: FantasyPointsDataMetrics, position: string): number {
    let score = 60; // Base score
    
    // Dominator rating indicates team reliance
    if (metrics.dominatorRating > 30) score += 25;
    else if (metrics.dominatorRating > 20) score += 15;
    else if (metrics.dominatorRating > 15) score += 5;
    else score -= 10;
    
    // Weighted opportunity rating
    if (metrics.weightedOpportunityRating > 8.0) score += 15;
    else if (metrics.weightedOpportunityRating > 6.0) score += 8;
    else if (metrics.weightedOpportunityRating < 4.0) score -= 15;
    
    // Air yards share (WR/TE specific)
    if (position === 'WR' || position === 'TE') {
      if (metrics.airYardsShare > 25) score += 10;
      else if (metrics.airYardsShare > 15) score += 5;
      else if (metrics.airYardsShare < 8) score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Skill Metrics (20% weight) - Efficiency and ability
   */
  private calculateSkillMetrics(metrics: FantasyPointsDataMetrics, position: string): number {
    let score = 55; // Base score
    
    // Yards per route run efficiency
    if (metrics.yardsPerRouteRun > 2.5) score += 20;
    else if (metrics.yardsPerRouteRun > 2.0) score += 12;
    else if (metrics.yardsPerRouteRun > 1.5) score += 5;
    else score -= 10;
    
    // Target separation (skill indicator)
    if (metrics.targetSeparation > 3.0) score += 15;
    else if (metrics.targetSeparation > 2.5) score += 8;
    else if (metrics.targetSeparation < 2.0) score -= 8;
    
    // Catch probability
    if (metrics.catchProbability > 0.75) score += 10;
    else if (metrics.catchProbability > 0.65) score += 5;
    else if (metrics.catchProbability < 0.55) score -= 10;
    
    // First downs per route (high correlation metric)
    if (metrics.firstDownsPerRoute > 0.20) score += 15;
    else if (metrics.firstDownsPerRoute > 0.15) score += 8;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Health Profile (10% weight) - Injury risk assessment
   */
  private calculateHealthProfile(playerId: number, position: string): number {
    // In production, this would analyze injury history from database
    let score = 75; // Base assumption of good health
    
    // Position-based injury risk
    const riskFactors: Record<string, number> = {
      'RB': -15,  // Higher injury risk
      'WR': -5,   // Moderate risk
      'TE': -8,   // Moderate-high risk
      'QB': 5     // Lower injury risk
    };
    
    score += riskFactors[position] || 0;
    
    // Simulated injury considerations
    const hasRecentInjury = Math.random() < 0.15; // 15% chance
    if (hasRecentInjury) score -= 20;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Age Progression (5% weight) - Career stage analysis
   */
  private calculateAgeProgression(playerId: number, position: string): number {
    // Simulate realistic age distribution
    const estimatedAge = 23 + Math.floor(Math.random() * 8); // 23-30 range
    
    let score = 50;
    
    // Peak age curves by position
    if (position === 'RB') {
      if (estimatedAge <= 24) score = 90;
      else if (estimatedAge <= 26) score = 80;
      else if (estimatedAge <= 28) score = 60;
      else score = 30;
    } else if (position === 'WR') {
      if (estimatedAge <= 26) score = 85;
      else if (estimatedAge <= 29) score = 75;
      else if (estimatedAge <= 31) score = 55;
      else score = 35;
    } else if (position === 'TE') {
      if (estimatedAge <= 27) score = 80;
      else if (estimatedAge <= 30) score = 75;
      else if (estimatedAge <= 32) score = 60;
      else score = 40;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Generate detailed factor analysis
   */
  private generateFactorAnalysis(
    metrics: FantasyPointsDataMetrics,
    basic: any,
    position: string,
    playerName: string
  ): SustainabilityScore['factors'] {
    const positive: string[] = [];
    const negative: string[] = [];
    const keyMetrics: Array<{name: string; value: number; percentile: number; impact: 'high' | 'medium' | 'low'}> = [];
    
    // Positive factors
    if (metrics.targetShare > 18) positive.push("High target share indicates established role");
    if (metrics.routeParticipation > 70) positive.push("Consistent route participation");
    if (metrics.dominatorRating > 25) positive.push("Significant team offensive involvement");
    if (metrics.yardsPerRouteRun > 2.0) positive.push("Elite route running efficiency");
    if (basic.snapShareIncrease > 25) positive.push("Substantial snap share growth");
    
    // Negative factors
    if (metrics.targetShare < 12) negative.push("Limited target share may indicate secondary role");
    if (metrics.routeParticipation < 50) negative.push("Inconsistent route participation");
    if (basic.trendStartWeek > 12) negative.push("Late-season emergence may lack sustainability");
    if (metrics.weightedOpportunityRating < 5.0) negative.push("Below-average opportunity metrics");
    
    // Key metrics with percentiles
    keyMetrics.push({
      name: "Target Share",
      value: metrics.targetShare,
      percentile: this.calculatePercentile(metrics.targetShare, position, 'targetShare'),
      impact: 'high'
    });
    
    keyMetrics.push({
      name: "Route Participation",
      value: metrics.routeParticipation,
      percentile: this.calculatePercentile(metrics.routeParticipation, position, 'routeParticipation'),
      impact: 'medium'
    });
    
    keyMetrics.push({
      name: "YPRR",
      value: metrics.yardsPerRouteRun,
      percentile: this.calculatePercentile(metrics.yardsPerRouteRun, position, 'yprr'),
      impact: 'medium'
    });
    
    return { positive, negative, keyMetrics };
  }
  
  /**
   * Generate performance projections
   */
  private generateProjections(
    sustainabilityScore: number,
    metrics: FantasyPointsDataMetrics,
    position: string
  ): SustainabilityScore['projections'] {
    // Base projections adjusted by sustainability
    let baseFloor = position === 'RB' ? 8 : position === 'WR' ? 6 : 5;
    let baseCeiling = position === 'RB' ? 20 : position === 'WR' ? 18 : 15;
    
    // Adjust based on sustainability score
    const multiplier = sustainabilityScore / 100;
    const weeklyFloor = baseFloor * (0.5 + multiplier * 0.5);
    const weeklyCeiling = baseCeiling * (0.7 + multiplier * 0.3);
    
    // Season-long viability
    let seasonLongViability: 'elite' | 'good' | 'risky' | 'volatile';
    if (sustainabilityScore >= 80) seasonLongViability = 'elite';
    else if (sustainabilityScore >= 65) seasonLongViability = 'good';
    else if (sustainabilityScore >= 45) seasonLongViability = 'risky';
    else seasonLongViability = 'volatile';
    
    // Regression risk
    const regressionRisk = Math.max(0, Math.min(100, 100 - sustainabilityScore));
    
    return {
      weeklyFloor: Math.round(weeklyFloor * 10) / 10,
      weeklyCeiling: Math.round(weeklyCeiling * 10) / 10,
      seasonLongViability,
      regressionRisk
    };
  }
  
  /**
   * Calculate metric percentiles for position
   */
  private calculatePercentile(value: number, position: string, metric: string): number {
    // Simplified percentile calculation - in production would use historical data
    const benchmarks: Record<string, Record<string, number[]>> = {
      'WR': {
        'targetShare': [8, 12, 16, 20, 25],     // 20th, 40th, 60th, 80th, 95th percentiles
        'routeParticipation': [60, 70, 78, 85, 92],
        'yprr': [1.2, 1.5, 1.8, 2.2, 2.8]
      },
      'RB': {
        'targetShare': [4, 7, 10, 14, 18],
        'routeParticipation': [35, 45, 55, 65, 75],
        'yprr': [1.0, 1.3, 1.6, 2.0, 2.5]
      },
      'TE': {
        'targetShare': [8, 12, 16, 20, 25],
        'routeParticipation': [65, 72, 78, 84, 90],
        'yprr': [1.1, 1.4, 1.7, 2.1, 2.6]
      }
    };
    
    const positionBenchmarks = benchmarks[position]?.[metric] || [0, 25, 50, 75, 100];
    
    for (let i = 0; i < positionBenchmarks.length; i++) {
      if (value <= positionBenchmarks[i]) {
        return (i + 1) * 20; // 20th, 40th, 60th, 80th, 100th percentile
      }
    }
    
    return 95; // Above 95th percentile
  }
}

export const sustainabilityEngine = new BreakoutSustainabilityEngine();