import { Player } from "@shared/schema";
import { playerAnalysisCache } from "./playerAnalysisCache";

interface DynastyValueComponents {
  fantasyProduction: number;    // 30% - Current fantasy output
  advancedMetrics: number;      // 25% - NFL Next Gen Stats (separation, YPRR, etc)
  opportunity: number;          // 20% - Target share, snap count, role
  efficiency: number;           // 15% - Yards per target, catch rate, etc
  situational: number;          // 10% - Age, team context, injury history
}

interface DynastyValueScore {
  player: Player;
  totalScore: number;           // 0-100 composite score
  grade: 'Elite' | 'Great' | 'Good' | 'Average' | 'Poor';
  components: DynastyValueComponents;
  marketComparison: {
    ourValue: number;
    marketValue: number;       // Ownership % as proxy
    arbitrageOpportunity: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
  };
  reasoning: string[];
}

export class DynastyValuationService {
  
  // Main valuation function combining all data sources
  async calculateDynastyValue(player: Player): Promise<DynastyValueScore> {
    const components = await this.calculateComponents(player);
    
    // Weighted scoring system
    const weights = {
      fantasyProduction: 0.30,
      advancedMetrics: 0.25,
      opportunity: 0.20,
      efficiency: 0.15,
      situational: 0.10
    };
    
    const totalScore = Math.round(
      (components.fantasyProduction * weights.fantasyProduction) +
      (components.advancedMetrics * weights.advancedMetrics) +
      (components.opportunity * weights.opportunity) +
      (components.efficiency * weights.efficiency) +
      (components.situational * weights.situational)
    );
    
    const grade = this.getGrade(totalScore);
    const marketComparison = this.calculateMarketArbitrage(player, totalScore);
    const reasoning = this.generateReasoning(player, components, totalScore);
    
    return {
      player,
      totalScore,
      grade,
      components,
      marketComparison,
      reasoning
    };
  }
  
  private async calculateComponents(player: Player): Promise<DynastyValueComponents> {
    const position = player.position;
    
    // 1. Fantasy Production (30%) - Real performance
    const fantasyProduction = this.calculateFantasyProduction(player, position);
    
    // 2. Advanced Metrics (25%) - NFL Next Gen Stats
    const advancedMetrics = await this.calculateAdvancedMetrics(player, position);
    
    // 3. Opportunity (20%) - Target share, snap count, role
    const opportunity = this.calculateOpportunity(player, position);
    
    // 4. Efficiency (15%) - Per-target/carry efficiency
    const efficiency = this.calculateEfficiency(player, position);
    
    // 5. Situational (10%) - Age, team, injury, trends
    const situational = this.calculateSituational(player, position);
    
    return {
      fantasyProduction,
      advancedMetrics,
      opportunity,
      efficiency,
      situational
    };
  }
  
  // Component 1: Fantasy Production (30%)
  private calculateFantasyProduction(player: Player, position: string): number {
    const avgPoints = player.avgPoints || 0;
    const projectedPoints = player.projectedPoints || 0;
    const consistency = player.consistency || 50; // Default middle score
    
    let score = 0;
    
    // Position-adjusted scoring thresholds
    if (position === 'QB') {
      if (avgPoints >= 22) score = 95;      // Elite (Josh Allen tier)
      else if (avgPoints >= 20) score = 85; // Great (Dak tier)
      else if (avgPoints >= 18) score = 70; // Good (Baker tier)
      else if (avgPoints >= 15) score = 50; // Average
      else score = 25;                      // Poor
    } else if (position === 'RB') {
      if (avgPoints >= 16) score = 95;      // Elite (CMC tier)
      else if (avgPoints >= 14) score = 85; // Great
      else if (avgPoints >= 12) score = 70; // Good
      else if (avgPoints >= 9) score = 50;  // Average
      else score = 25;                      // Poor
    } else if (position === 'WR') {
      if (avgPoints >= 15) score = 95;      // Elite (Hill tier)
      else if (avgPoints >= 13) score = 85; // Great
      else if (avgPoints >= 11) score = 70; // Good
      else if (avgPoints >= 8) score = 50;  // Average
      else score = 25;                      // Poor
    } else if (position === 'TE') {
      if (avgPoints >= 12) score = 95;      // Elite (Kelce tier)
      else if (avgPoints >= 10) score = 85; // Great
      else if (avgPoints >= 8) score = 70;  // Good
      else if (avgPoints >= 6) score = 50;  // Average
      else score = 25;                      // Poor
    }
    
    // Consistency adjustment (±10 points)
    const consistencyBonus = (consistency - 50) * 0.2;
    
    return Math.max(0, Math.min(100, score + consistencyBonus));
  }
  
  // Component 2: Advanced Metrics (25%) - NFL Next Gen Stats
  private async calculateAdvancedMetrics(player: Player, position: string): Promise<number> {
    try {
      // Try to get NFL Next Gen Stats from our cache
      const analysis = await playerAnalysisCache.getPlayerAnalysis(player.name);
      
      if (analysis?.separation_metrics) {
        return this.scoreNextGenMetrics(analysis, position);
      }
    } catch (error) {
      // If no advanced data available, use basic estimation
      console.log(`No advanced metrics for ${player.name}, using estimation`);
    }
    
    // Fallback: Estimate based on fantasy production
    const fantasyScore = player.avgPoints || 0;
    const upside = player.upside || 0;
    
    // Conservative estimation when no advanced data
    if (position === 'WR' || position === 'TE') {
      return Math.min(80, (fantasyScore * 3) + upside); // Cap at 80 without real data
    }
    
    return 50; // Default middle score for positions without separation data
  }
  
  private scoreNextGenMetrics(analysis: any, position: string): number {
    if (position !== 'WR' && position !== 'TE') return 50;
    
    let score = 0;
    let factors = 0;
    
    // Separation metrics (key for WR/TE dynasty value)
    if (analysis.separation_metrics?.avg_separation_percentile) {
      const separationPercentile = analysis.separation_metrics.avg_separation_percentile;
      if (separationPercentile >= 80) score += 25;
      else if (separationPercentile >= 65) score += 20;
      else if (separationPercentile >= 50) score += 15;
      else if (separationPercentile >= 35) score += 10;
      else score += 5;
      factors++;
    }
    
    // Target quality
    if (analysis.separation_metrics?.avg_intended_air_yards) {
      const airYards = analysis.separation_metrics.avg_intended_air_yards;
      if (airYards >= 12) score += 20; // Deep threats
      else if (airYards >= 8) score += 15; // Intermediate
      else score += 10; // Short/underneath
      factors++;
    }
    
    // Efficiency metrics
    if (analysis.efficiency_metrics?.yards_per_target) {
      const ypt = analysis.efficiency_metrics.yards_per_target;
      if (ypt >= 9) score += 20;
      else if (ypt >= 7) score += 15;
      else if (ypt >= 5) score += 10;
      else score += 5;
      factors++;
    }
    
    // Season trends (dynasty crucial)
    if (analysis.season_trends?.target_trend === 'increasing') {
      score += 15; // Positive trajectory
      factors++;
    } else if (analysis.season_trends?.target_trend === 'stable') {
      score += 10;
      factors++;
    }
    
    return factors > 0 ? Math.min(100, score) : 50;
  }
  
  // Component 3: Opportunity (20%)
  private calculateOpportunity(player: Player, position: string): number {
    let score = 50; // Start at middle
    
    // Target share for pass catchers
    if ((position === 'WR' || position === 'TE') && player.targetShare) {
      if (player.targetShare >= 25) score = 90;
      else if (player.targetShare >= 20) score = 75;
      else if (player.targetShare >= 15) score = 60;
      else if (player.targetShare >= 10) score = 45;
      else score = 30;
    }
    
    // Carries for RBs
    if (position === 'RB' && player.carries) {
      if (player.carries >= 250) score = 95; // Workhorse
      else if (player.carries >= 180) score = 80; // Good volume
      else if (player.carries >= 120) score = 65; // Decent
      else if (player.carries >= 80) score = 45; // Limited
      else score = 25; // Minimal role
    }
    
    // Snap count (universal)
    if (player.snapCount) {
      const snapBonus = Math.min(15, player.snapCount / 50); // Up to 15 point bonus
      score += snapBonus;
    }
    
    // Red zone opportunity
    if (player.redZoneTargets) {
      const rzBonus = Math.min(10, player.redZoneTargets * 1.5);
      score += rzBonus;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  // Component 4: Efficiency (15%)
  private calculateEfficiency(player: Player, position: string): number {
    let score = 50;
    const avgPoints = player.avgPoints || 0;
    const projectedPoints = player.projectedPoints || 0;
    
    // Points per opportunity efficiency
    if (position === 'WR' || position === 'TE') {
      if (player.targetShare && player.targetShare > 0) {
        const pointsPerTargetShare = avgPoints / player.targetShare;
        if (pointsPerTargetShare >= 0.8) score = 90;
        else if (pointsPerTargetShare >= 0.6) score = 75;
        else if (pointsPerTargetShare >= 0.4) score = 60;
        else score = 40;
      }
    }
    
    if (position === 'RB' && player.carries && player.carries > 0) {
      const pointsPerCarry = avgPoints / player.carries;
      if (pointsPerCarry >= 0.08) score = 90;
      else if (pointsPerCarry >= 0.06) score = 75;
      else if (pointsPerCarry >= 0.04) score = 60;
      else score = 40;
    }
    
    // Projected vs actual (consistency indicator)
    if (projectedPoints > 0) {
      const accuracy = Math.abs(avgPoints - projectedPoints) / projectedPoints;
      if (accuracy <= 0.1) score += 10; // Very predictable
      else if (accuracy <= 0.2) score += 5; // Somewhat predictable
      // No bonus for unpredictable players
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  // Component 5: Situational (10%)
  private calculateSituational(player: Player, position: string): number {
    let score = 50;
    
    // Injury status
    if (player.injuryStatus === 'Healthy') score += 15;
    else if (player.injuryStatus === 'Questionable') score += 5;
    else if (player.injuryStatus === 'Doubtful') score -= 10;
    else if (player.injuryStatus === 'Out') score -= 20;
    
    // Trend
    if (player.trend === 'up') score += 15;
    else if (player.trend === 'stable') score += 5;
    else if (player.trend === 'down') score -= 10;
    
    // Team context (simplified - could be expanded)
    const goodOffenses = ['KC', 'BUF', 'MIA', 'DAL', 'SF'];
    if (goodOffenses.includes(player.team)) {
      score += 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  private getGrade(score: number): 'Elite' | 'Great' | 'Good' | 'Average' | 'Poor' {
    if (score >= 85) return 'Elite';
    if (score >= 75) return 'Great';
    if (score >= 65) return 'Good';
    if (score >= 45) return 'Average';
    return 'Poor';
  }
  
  private calculateMarketArbitrage(player: Player, ourValue: number): any {
    const marketValue = player.ownershipPercentage || 50;
    const difference = ourValue - marketValue;
    
    let arbitrageOpportunity: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 50;
    
    if (difference >= 20) {
      arbitrageOpportunity = 'BUY';
      confidence = Math.min(95, 50 + difference);
    } else if (difference <= -20) {
      arbitrageOpportunity = 'SELL';
      confidence = Math.min(95, 50 + Math.abs(difference));
    }
    
    return {
      ourValue,
      marketValue,
      arbitrageOpportunity,
      confidence
    };
  }
  
  private generateReasoning(player: Player, components: DynastyValueComponents, totalScore: number): string[] {
    const reasons: string[] = [];
    
    // Strongest component
    const maxComponent = Math.max(
      components.fantasyProduction,
      components.advancedMetrics,
      components.opportunity,
      components.efficiency,
      components.situational
    );
    
    if (components.fantasyProduction === maxComponent && components.fantasyProduction >= 80) {
      reasons.push(`Strong fantasy production (${player.avgPoints?.toFixed(1)} PPG)`);
    }
    
    if (components.advancedMetrics === maxComponent && components.advancedMetrics >= 80) {
      reasons.push("Elite advanced metrics (separation, efficiency)");
    }
    
    if (components.opportunity === maxComponent && components.opportunity >= 80) {
      reasons.push("High opportunity share in offense");
    }
    
    if (totalScore >= 85) {
      reasons.push("Dynasty cornerstone with multiple elite traits");
    } else if (totalScore >= 75) {
      reasons.push("High-end dynasty asset with strong fundamentals");
    } else if (totalScore <= 35) {
      reasons.push("Limited dynasty upside across multiple metrics");
    }
    
    return reasons.length > 0 ? reasons : ["Standard dynasty asset"];
  }
  
  // Batch calculate for rankings
  async calculateTeamValues(players: Player[]): Promise<DynastyValueScore[]> {
    const scores = await Promise.all(
      players.map(player => this.calculateDynastyValue(player))
    );
    
    return scores.sort((a, b) => b.totalScore - a.totalScore);
  }
}

export const dynastyValuationService = new DynastyValuationService();