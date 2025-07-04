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
  
  /*
   * Dynasty Score Distribution Philosophy:
   * 
   * 95-100: Generational talents (0.5-1% of players) - Peak Mahomes, prime CMC, Kelce at his best
   * 85-94:  Elite tier (5-8% of players) - Top 10-15 fantasy producers with exceptional metrics
   * 70-84:  Great tier (15-20% of players) - Quality weekly starters with multiple strengths
   * 50-69:  Good/Average (30-40% of players) - Roster-worthy players with specific roles
   * <50:    Below average/replacement level
   * 
   * The weighted system requires multiple components to align for high scores:
   * - A 90+ overall score needs excellence across most categories (not just fantasy points)
   * - Component caps prevent single-dimension excellence from inflating scores
   * - Position-specific thresholds reflect real scarcity and value
   */
  
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
  
  // Component 1: Fantasy Production (30%) - More conservative scoring
  private calculateFantasyProduction(player: Player, position: string): number {
    const avgPoints = player.avgPoints || 0;
    const projectedPoints = player.projectedPoints || 0;
    const consistency = player.consistency || 50;
    
    let score = 0;
    
    // Highly restrictive thresholds - only generational talents hit 90+
    if (position === 'QB') {
      if (avgPoints >= 25) score = 95;      // Generational (peak Mahomes/Allen level)
      else if (avgPoints >= 23) score = 85; // Elite tier (Josh Allen 2024)
      else if (avgPoints >= 21) score = 75; // Great tier (Lamar, Dak)
      else if (avgPoints >= 18) score = 60; // Good tier (Baker, Sam)
      else if (avgPoints >= 15) score = 45; // Average/bench
      else score = 20;                      // Poor
    } else if (position === 'RB') {
      if (avgPoints >= 18) score = 95;      // Generational (peak CMC level)
      else if (avgPoints >= 16) score = 85; // Elite (CMC 2024)
      else if (avgPoints >= 14) score = 75; // Great
      else if (avgPoints >= 11) score = 60; // Good
      else if (avgPoints >= 8) score = 45;  // Average
      else score = 20;                      // Poor
    } else if (position === 'WR') {
      if (avgPoints >= 17) score = 95;      // Generational (peak Jefferson/Kupp level)
      else if (avgPoints >= 15) score = 85; // Elite (Hill, Jefferson)
      else if (avgPoints >= 13) score = 75; // Great
      else if (avgPoints >= 10) score = 60; // Good
      else if (avgPoints >= 7) score = 45;  // Average
      else score = 20;                      // Poor
    } else if (position === 'TE') {
      if (avgPoints >= 14) score = 95;      // Generational (peak Kelce level)
      else if (avgPoints >= 12) score = 85; // Elite (current Kelce)
      else if (avgPoints >= 10) score = 75; // Great (Hockenson, Andrews)
      else if (avgPoints >= 7) score = 60;  // Good
      else if (avgPoints >= 5) score = 45;  // Average
      else score = 20;                      // Poor
    }
    
    // Smaller consistency adjustment (±5 points max)
    const consistencyBonus = (consistency - 50) * 0.1;
    
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
    if (position !== 'WR' && position !== 'TE') return 40; // Lower default
    
    let score = 0;
    let factors = 0;
    
    // Much more restrictive separation scoring - only elite get high marks
    if (analysis.separation_metrics?.avg_separation_percentile) {
      const separationPercentile = analysis.separation_metrics.avg_separation_percentile;
      if (separationPercentile >= 95) score += 30; // Truly elite separation (top 5%)
      else if (separationPercentile >= 85) score += 22; // Very good (top 15%)
      else if (separationPercentile >= 70) score += 15; // Above average
      else if (separationPercentile >= 50) score += 8;  // Average
      else score += 2; // Below average
      factors++;
    }
    
    // Target quality - more restrictive
    if (analysis.separation_metrics?.avg_intended_air_yards) {
      const airYards = analysis.separation_metrics.avg_intended_air_yards;
      if (airYards >= 15) score += 18; // Deep threat elite
      else if (airYards >= 12) score += 12; // Deep threats
      else if (airYards >= 8) score += 8; // Intermediate
      else score += 4; // Short/underneath
      factors++;
    }
    
    // Efficiency metrics - much higher bar
    if (analysis.efficiency_metrics?.yards_per_target) {
      const ypt = analysis.efficiency_metrics.yards_per_target;
      if (ypt >= 10) score += 25; // Elite efficiency (very rare)
      else if (ypt >= 8.5) score += 18; // Great efficiency
      else if (ypt >= 7) score += 12; // Good efficiency
      else if (ypt >= 5) score += 6; // Average
      else score += 2; // Poor
      factors++;
    }
    
    // Season trends - more conservative bonuses
    if (analysis.season_trends?.target_trend === 'increasing') {
      score += 8; // Positive trajectory (smaller bonus)
      factors++;
    } else if (analysis.season_trends?.target_trend === 'stable') {
      score += 4; // Stability (smaller bonus)
      factors++;
    }
    
    // Cap advanced metrics at lower ceiling unless truly exceptional
    const maxScore = factors > 0 ? Math.min(90, score) : 40;
    return maxScore;
  }
  
  // Component 3: Opportunity (20%) - Much more restrictive
  private calculateOpportunity(player: Player, position: string): number {
    let score = 40; // Start lower than middle
    
    // Target share for pass catchers - only elite volume gets high scores
    if ((position === 'WR' || position === 'TE') && player.targetShare) {
      if (player.targetShare >= 30) score = 85; // Elite target hog (very rare)
      else if (player.targetShare >= 25) score = 75; // High usage
      else if (player.targetShare >= 20) score = 60; // Good usage
      else if (player.targetShare >= 15) score = 45; // Decent
      else if (player.targetShare >= 10) score = 30; // Limited
      else score = 15; // Minimal role
    }
    
    // Carries for RBs - extremely high bar for elite scores
    if (position === 'RB' && player.carries) {
      if (player.carries >= 300) score = 90; // Elite workhorse (very rare)
      else if (player.carries >= 250) score = 80; // Workhorse
      else if (player.carries >= 200) score = 65; // Good volume
      else if (player.carries >= 150) score = 50; // Decent
      else if (player.carries >= 100) score = 35; // Limited
      else score = 20; // Minimal role
    }
    
    // Snap count bonus - smaller impact
    if (player.snapCount) {
      const snapBonus = Math.min(8, player.snapCount / 80); // Max 8 point bonus, higher threshold
      score += snapBonus;
    }
    
    // Red zone opportunity - smaller bonuses
    if (player.redZoneTargets) {
      const rzBonus = Math.min(6, player.redZoneTargets * 0.8); // Smaller multiplier
      score += rzBonus;
    }
    
    return Math.max(0, Math.min(85, score)); // Cap opportunity at 85 to prevent inflation
  }
  
  // Component 4: Efficiency (15%) - Much more restrictive, elite scores very rare
  private calculateEfficiency(player: Player, position: string): number {
    let score = 35; // Start below middle
    const avgPoints = player.avgPoints || 0;
    const projectedPoints = player.projectedPoints || 0;
    
    // Points per opportunity efficiency - much higher thresholds
    if (position === 'WR' || position === 'TE') {
      if (player.targetShare && player.targetShare > 0) {
        const pointsPerTargetShare = avgPoints / player.targetShare;
        if (pointsPerTargetShare >= 1.0) score = 80;  // Elite efficiency (very rare)
        else if (pointsPerTargetShare >= 0.8) score = 65; // Great efficiency
        else if (pointsPerTargetShare >= 0.6) score = 50; // Good efficiency
        else if (pointsPerTargetShare >= 0.4) score = 35; // Average
        else score = 20; // Poor efficiency
      }
    }
    
    if (position === 'RB' && player.carries && player.carries > 0) {
      const pointsPerCarry = avgPoints / player.carries;
      if (pointsPerCarry >= 0.10) score = 80;  // Elite efficiency (very rare)
      else if (pointsPerCarry >= 0.08) score = 65; // Great efficiency
      else if (pointsPerCarry >= 0.06) score = 50; // Good efficiency  
      else if (pointsPerCarry >= 0.04) score = 35; // Average
      else score = 20; // Poor efficiency
    }
    
    // Projected vs actual (consistency indicator) - smaller bonuses
    if (projectedPoints > 0) {
      const accuracy = Math.abs(avgPoints - projectedPoints) / projectedPoints;
      if (accuracy <= 0.05) score += 8; // Extremely predictable (rare)
      else if (accuracy <= 0.1) score += 5; // Very predictable
      else if (accuracy <= 0.15) score += 2; // Somewhat predictable
      // No bonus for unpredictable players
    }
    
    return Math.max(0, Math.min(75, score)); // Cap efficiency at 75 to prevent inflation
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
    if (score >= 95) return 'Elite';    // Reserved for generational talents (top 1-2% of players)
    if (score >= 85) return 'Great';    // Top tier starters (top 5-10%)
    if (score >= 70) return 'Good';     // Quality starters (top 25%)
    if (score >= 50) return 'Average';  // Roster-worthy players
    return 'Poor';                      // Replacement level or worse
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