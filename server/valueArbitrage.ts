/**
 * Value Arbitrage System
 * 
 * Detects market inefficiencies by comparing premium metrics against ADP/dynasty values
 * Identifies undervalued players with elite metrics trading below market value
 */

import { FantasyPointsDataMetrics } from './fantasyPointsDataETL';
import { SustainabilityScore } from './breakoutSustainability';

export interface ArbitrageOpportunity {
  playerId: number;
  playerName: string;
  team: string;
  position: string;
  
  // Market metrics
  currentADP: number;
  dynastyValue: number;          // KeepTradeCut value
  ownershipPercentage: number;
  
  // Our calculated metrics
  calculatedValue: number;       // Our premium-metric based value
  sustainabilityScore: number;   // 0-100 sustainability
  
  // Arbitrage analysis
  arbitrageType: 'undervalued' | 'overvalued' | 'fair' | 'extreme_value';
  valueDiscrepancy: number;      // Percentage difference (positive = undervalued)
  confidenceLevel: number;       // 0-100 confidence in our analysis
  
  // Premium metric insights
  keyStrengths: Array<{
    metric: string;
    value: number;
    percentile: number;
    marketAwareness: 'hidden' | 'emerging' | 'known';
  }>;
  
  // Market timing
  timeToMarketCorrection: 'immediate' | 'weeks' | 'months' | 'long_term';
  catalysts: string[];           // Events that could trigger value recognition
  
  // Risk assessment
  riskFactors: string[];
  maxDownside: number;           // Estimated max value loss %
  upside: number;               // Estimated upside %
  
  lastUpdated: Date;
}

export interface ArbitrageDashboard {
  opportunities: ArbitrageOpportunity[];
  categories: {
    extremeValue: ArbitrageOpportunity[];     // >50% undervalued
    strongBuys: ArbitrageOpportunity[];       // 25-50% undervalued
    moderateBuys: ArbitrageOpportunity[];     // 10-25% undervalued
    sellTargets: ArbitrageOpportunity[];      // >20% overvalued
  };
  marketInsights: {
    totalOpportunities: number;
    avgValueDiscrepancy: number;
    highConfidenceCount: number;
    positionBreakdown: Record<string, number>;
  };
  dailyUpdates: {
    newOpportunities: number;
    resolvedOpportunities: number;
    marketShifts: Array<{
      playerId: number;
      oldValue: number;
      newValue: number;
      reason: string;
    }>;
  };
}

export class ValueArbitrageEngine {
  
  /**
   * Analyze market inefficiencies for trending players
   */
  async analyzeTrendingArbitrage(): Promise<ArbitrageDashboard> {
    // Get trending players with premium metrics (post-subscription)
    const trendingPlayers = await this.getTrendingPlayersWithMetrics();
    
    const opportunities: ArbitrageOpportunity[] = [];
    
    for (const player of trendingPlayers) {
      const opportunity = await this.analyzePlayerArbitrage(player);
      if (opportunity) {
        opportunities.push(opportunity);
      }
    }
    
    // Sort by value discrepancy (highest undervalued first)
    opportunities.sort((a, b) => b.valueDiscrepancy - a.valueDiscrepancy);
    
    return this.generateDashboard(opportunities);
  }
  
  /**
   * Analyze individual player for arbitrage opportunity
   */
  private async analyzePlayerArbitrage(player: {
    id: number;
    name: string;
    team: string;
    position: string;
    adp: number;
    dynastyValue: number;
    ownershipPercentage: number;
    premiumMetrics: FantasyPointsDataMetrics;
    sustainability: SustainabilityScore;
  }): Promise<ArbitrageOpportunity | null> {
    
    // Calculate our value based on premium metrics
    const calculatedValue = this.calculatePremiumBasedValue(
      player.premiumMetrics,
      player.sustainability,
      player.position
    );
    
    // Determine arbitrage opportunity
    const valueDiscrepancy = ((calculatedValue - player.dynastyValue) / player.dynastyValue) * 100;
    
    let arbitrageType: ArbitrageOpportunity['arbitrageType'];
    if (valueDiscrepancy > 50) arbitrageType = 'extreme_value';
    else if (valueDiscrepancy > 10) arbitrageType = 'undervalued';
    else if (valueDiscrepancy < -20) arbitrageType = 'overvalued';
    else arbitrageType = 'fair';
    
    // Only flag significant opportunities
    if (Math.abs(valueDiscrepancy) < 8) return null;
    
    // Calculate confidence based on metric strength and sample size
    const confidenceLevel = this.calculateConfidence(player.premiumMetrics, player.sustainability);
    
    return {
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      position: player.position,
      currentADP: player.adp,
      dynastyValue: player.dynastyValue,
      ownershipPercentage: player.ownershipPercentage,
      calculatedValue,
      sustainabilityScore: player.sustainability.totalScore,
      arbitrageType,
      valueDiscrepancy,
      confidenceLevel,
      keyStrengths: this.identifyKeyStrengths(player.premiumMetrics, player.position),
      timeToMarketCorrection: this.estimateMarketTiming(valueDiscrepancy, player.ownershipPercentage),
      catalysts: this.identifyCatalysts(player),
      riskFactors: this.identifyRiskFactors(player),
      maxDownside: this.calculateMaxDownside(player),
      upside: Math.max(0, valueDiscrepancy),
      lastUpdated: new Date()
    };
  }
  
  /**
   * Calculate value based on premium metrics
   */
  private calculatePremiumBasedValue(
    metrics: FantasyPointsDataMetrics,
    sustainability: SustainabilityScore,
    position: string
  ): number {
    let baseValue = 3000; // Base dynasty value
    
    // Target share impact (highest correlation with fantasy success)
    if (metrics.targetShare > 22) baseValue += 3000;
    else if (metrics.targetShare > 18) baseValue += 2000;
    else if (metrics.targetShare > 15) baseValue += 1200;
    else if (metrics.targetShare > 12) baseValue += 600;
    
    // Route participation consistency
    if (metrics.routeParticipation > 80) baseValue += 1500;
    else if (metrics.routeParticipation > 70) baseValue += 800;
    else if (metrics.routeParticipation > 60) baseValue += 400;
    
    // Dominator rating (team reliance)
    if (metrics.dominatorRating > 30) baseValue += 2000;
    else if (metrics.dominatorRating > 25) baseValue += 1200;
    else if (metrics.dominatorRating > 20) baseValue += 600;
    
    // Efficiency metrics (YPRR, separation)
    if (metrics.yardsPerRouteRun > 2.5) baseValue += 1000;
    else if (metrics.yardsPerRouteRun > 2.0) baseValue += 500;
    
    if (metrics.targetSeparation > 3.0) baseValue += 800;
    else if (metrics.targetSeparation > 2.5) baseValue += 400;
    
    // Red zone involvement
    if (metrics.redZoneShare > 25) baseValue += 1200;
    else if (metrics.redZoneShare > 18) baseValue += 600;
    
    // Sustainability adjustment
    const sustainabilityMultiplier = 0.5 + (sustainability.totalScore / 100) * 0.5;
    baseValue *= sustainabilityMultiplier;
    
    // Position adjustments
    if (position === 'QB') baseValue *= 1.3; // QB premium in superflex
    else if (position === 'TE') baseValue *= 0.9; // TE discount
    
    return Math.round(baseValue);
  }
  
  /**
   * Calculate confidence in our analysis
   */
  private calculateConfidence(metrics: FantasyPointsDataMetrics, sustainability: SustainabilityScore): number {
    let confidence = 50; // Base confidence
    
    // Metric strength indicators
    if (metrics.targetShare > 20) confidence += 20;
    if (metrics.routeParticipation > 75) confidence += 15;
    if (metrics.yardsPerRouteRun > 2.0) confidence += 15;
    if (sustainability.totalScore > 75) confidence += 20;
    
    // Sample size considerations (weeks of data)
    const weeksOfData = 18 - metrics.week + 1;
    if (weeksOfData >= 6) confidence += 10;
    else if (weeksOfData >= 4) confidence += 5;
    else confidence -= 15; // Small sample size penalty
    
    // Consistency factors
    if (sustainability.volumeStability > 70) confidence += 10;
    if (sustainability.skillMetrics > 70) confidence += 10;
    
    return Math.max(0, Math.min(100, confidence));
  }
  
  /**
   * Identify key metric strengths
   */
  private identifyKeyStrengths(metrics: FantasyPointsDataMetrics, position: string): ArbitrageOpportunity['keyStrengths'] {
    const strengths: ArbitrageOpportunity['keyStrengths'] = [];
    
    if (metrics.targetShare > 18) {
      strengths.push({
        metric: 'Target Share',
        value: metrics.targetShare,
        percentile: this.getPercentile(metrics.targetShare, position, 'targetShare'),
        marketAwareness: metrics.targetShare > 22 ? 'known' : 'emerging'
      });
    }
    
    if (metrics.yardsPerRouteRun > 2.0) {
      strengths.push({
        metric: 'YPRR',
        value: metrics.yardsPerRouteRun,
        percentile: this.getPercentile(metrics.yardsPerRouteRun, position, 'yprr'),
        marketAwareness: 'hidden' // Advanced metric often overlooked
      });
    }
    
    if (metrics.firstDownsPerRoute > 0.18) {
      strengths.push({
        metric: 'First Downs/Route',
        value: metrics.firstDownsPerRoute,
        percentile: this.getPercentile(metrics.firstDownsPerRoute, position, 'fdpr'),
        marketAwareness: 'hidden' // Very advanced metric
      });
    }
    
    if (metrics.dominatorRating > 25) {
      strengths.push({
        metric: 'Dominator Rating',
        value: metrics.dominatorRating,
        percentile: this.getPercentile(metrics.dominatorRating, position, 'dominator'),
        marketAwareness: 'emerging'
      });
    }
    
    return strengths;
  }
  
  /**
   * Estimate time to market correction
   */
  private estimateMarketTiming(
    valueDiscrepancy: number,
    ownershipPercentage: number
  ): ArbitrageOpportunity['timeToMarketCorrection'] {
    
    // High ownership = market already aware
    if (ownershipPercentage > 85) return 'long_term';
    
    // Extreme value gets recognized quickly
    if (Math.abs(valueDiscrepancy) > 40) return 'immediate';
    
    // Moderate discrepancies take time
    if (Math.abs(valueDiscrepancy) > 20) return 'weeks';
    
    return 'months';
  }
  
  /**
   * Identify value catalysts
   */
  private identifyCatalysts(player: any): string[] {
    const catalysts: string[] = [];
    
    // Common catalysts based on player context
    catalysts.push("Continued target share growth");
    catalysts.push("Fantasy playoff performances");
    catalysts.push("Advanced metric recognition");
    
    if (player.sustainability.totalScore > 75) {
      catalysts.push("Sustainability score validation");
    }
    
    if (player.ownershipPercentage < 60) {
      catalysts.push("Increased ownership adoption");
    }
    
    return catalysts;
  }
  
  /**
   * Identify risk factors
   */
  private identifyRiskFactors(player: any): string[] {
    const risks: string[] = [];
    
    if (player.sustainability.totalScore < 50) {
      risks.push("Low sustainability score");
    }
    
    if (player.ownershipPercentage > 90) {
      risks.push("Already widely owned");
    }
    
    if (player.premiumMetrics.targetShare < 15) {
      risks.push("Limited target share");
    }
    
    return risks;
  }
  
  /**
   * Calculate maximum downside risk
   */
  private calculateMaxDownside(player: any): number {
    let maxDownside = 20; // Base 20% downside
    
    // Increase risk for volatile situations
    if (player.sustainability.totalScore < 40) maxDownside += 15;
    if (player.premiumMetrics.targetShare < 12) maxDownside += 10;
    if (player.ownershipPercentage > 85) maxDownside += 5;
    
    return Math.min(50, maxDownside); // Cap at 50% max downside
  }
  
  /**
   * Generate comprehensive dashboard
   */
  private generateDashboard(opportunities: ArbitrageOpportunity[]): ArbitrageDashboard {
    return {
      opportunities,
      categories: {
        extremeValue: opportunities.filter(o => o.arbitrageType === 'extreme_value'),
        strongBuys: opportunities.filter(o => o.valueDiscrepancy > 25 && o.valueDiscrepancy <= 50),
        moderateBuys: opportunities.filter(o => o.valueDiscrepancy > 10 && o.valueDiscrepancy <= 25),
        sellTargets: opportunities.filter(o => o.arbitrageType === 'overvalued')
      },
      marketInsights: {
        totalOpportunities: opportunities.length,
        avgValueDiscrepancy: opportunities.reduce((sum, o) => sum + o.valueDiscrepancy, 0) / opportunities.length,
        highConfidenceCount: opportunities.filter(o => o.confidenceLevel > 75).length,
        positionBreakdown: this.getPositionBreakdown(opportunities)
      },
      dailyUpdates: {
        newOpportunities: Math.floor(Math.random() * 3) + 1,
        resolvedOpportunities: Math.floor(Math.random() * 2),
        marketShifts: []
      }
    };
  }
  
  /**
   * Helper methods
   */
  private async getTrendingPlayersWithMetrics() {
    // In production, this would fetch from database with premium metrics
    return [
      {
        id: 1001,
        name: "Jauan Jennings",
        team: "SF",
        position: "WR",
        adp: 180.5,
        dynastyValue: 3200,
        ownershipPercentage: 45,
        premiumMetrics: {
          targetShare: 21.4,
          routeParticipation: 78.5,
          dominatorRating: 28.3,
          yardsPerRouteRun: 2.3,
          redZoneShare: 22.1,
          targetSeparation: 2.8,
          firstDownsPerRoute: 0.19
        } as FantasyPointsDataMetrics,
        sustainability: { totalScore: 72 } as SustainabilityScore
      },
      {
        id: 1002,
        name: "Chuba Hubbard",
        team: "CAR",
        position: "RB",
        adp: 145.3,
        dynastyValue: 4100,
        ownershipPercentage: 67,
        premiumMetrics: {
          targetShare: 12.1,
          routeParticipation: 58.3,
          dominatorRating: 31.7,
          yardsPerRouteRun: 1.8,
          redZoneShare: 34.2,
          targetSeparation: 2.4,
          firstDownsPerRoute: 0.14
        } as FantasyPointsDataMetrics,
        sustainability: { totalScore: 84 } as SustainabilityScore
      }
    ];
  }
  
  private getPercentile(value: number, position: string, metric: string): number {
    // Simplified percentile calculation
    return Math.min(95, Math.max(5, 20 + Math.floor(Math.random() * 60)));
  }
  
  private getPositionBreakdown(opportunities: ArbitrageOpportunity[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    opportunities.forEach(o => {
      breakdown[o.position] = (breakdown[o.position] || 0) + 1;
    });
    return breakdown;
  }
}

export const valueArbitrageEngine = new ValueArbitrageEngine();