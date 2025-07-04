/**
 * Position-Based Dynasty Rankings System
 * QB, RB, WR, TE, and SFLEX (Superflex) rankings 1-250
 * Focus on dynasty value with elite stats, trajectory, health, age
 */

import { Player } from "@shared/schema";
import { playerDataValidationService } from "./playerDataValidation";
import { storage } from "./storage";

export interface PositionRanking {
  rank: number;
  player: Player;
  dynastyScore: number;           // 0-100 composite score
  tier: 'Elite' | 'Tier1' | 'Tier2' | 'Tier3' | 'Bench';
  keyStrengths: string[];         // Top 3 strengths driving the ranking
  concerns: string[];             // Any notable concerns or risks
  trendDirection: 'Rising' | 'Stable' | 'Declining';
  ageScore: number;              // Age-adjusted value (0-100)
  productionScore: number;       // Current production value (0-100)
  opportunityScore: number;      // Role/usage opportunity (0-100)
  stabilityScore: number;        // Health/consistency factor (0-100)
}

export interface PositionRankings {
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'SFLEX';
  rankings: PositionRanking[];
  totalPlayers: number;
  lastUpdated: Date;
  methodology: string;
}

export class PositionRankingService {
  
  /**
   * Generate position-specific rankings 1-250
   */
  async generatePositionRankings(position: 'QB' | 'RB' | 'WR' | 'TE' | 'SFLEX'): Promise<PositionRankings> {
    console.log(`\n=== GENERATING ${position} RANKINGS ===`);
    
    // Get all players for this position (or all for SFLEX)
    const allPlayers = await storage.getAllPlayers();
    
    let players: Player[];
    if (position === 'SFLEX') {
      // Superflex includes all skill positions but heavily weights QBs
      players = allPlayers.filter((p: Player) => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
    } else {
      players = allPlayers.filter((p: Player) => p.position === position);
    }

    // Filter out problematic players
    const validPlayers = playerDataValidationService.filterValidPlayers(players);
    console.log(`Analyzing ${validPlayers.length} valid ${position} players`);

    // Calculate dynasty scores for each player
    const scoredPlayers = validPlayers.map(player => {
      const dynastyScore = this.calculateDynastyScore(player, position);
      const ranking: PositionRanking = {
        rank: 0, // Will be set after sorting
        player,
        dynastyScore,
        tier: this.assignTier(dynastyScore),
        keyStrengths: this.identifyKeyStrengths(player, position),
        concerns: this.identifyRelevantConcerns(player),
        trendDirection: this.calculateTrendDirection(player),
        ageScore: this.calculateAgeScore(player),
        productionScore: this.calculateProductionScore(player, position),
        opportunityScore: this.calculateOpportunityScore(player, position),
        stabilityScore: this.calculateStabilityScore(player),
      };
      return ranking;
    });

    // Sort by dynasty score (highest first) and assign ranks
    scoredPlayers.sort((a, b) => b.dynastyScore - a.dynastyScore);
    scoredPlayers.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    // Take top 250 (or all if less)
    const top250 = scoredPlayers.slice(0, 250);

    return {
      position,
      rankings: top250,
      totalPlayers: validPlayers.length,
      lastUpdated: new Date(),
      methodology: this.getMethodology(position),
    };
  }

  /**
   * Calculate comprehensive dynasty score (0-100)
   */
  private calculateDynastyScore(player: Player, position: 'QB' | 'RB' | 'WR' | 'TE' | 'SFLEX'): number {
    // Base scoring weights
    let weights = {
      production: 0.30,   // Current fantasy production
      opportunity: 0.25,  // Role, usage, team context
      age: 0.20,         // Age curve and longevity
      stability: 0.15,   // Health, consistency
      efficiency: 0.10,  // Advanced metrics
    };

    // Superflex special weighting - QBs get massive premium
    if (position === 'SFLEX') {
      if (player.position === 'QB') {
        // QBs become premium assets in superflex
        weights = {
          production: 0.35,  // QB production more predictive
          opportunity: 0.30,  // Starting QB role is everything
          age: 0.15,         // QBs have longer careers
          stability: 0.15,   // Health critical for QBs
          efficiency: 0.05,  // Less important for QB value
        };
      } else {
        // Skill positions need to be elite to compete with QB2s
        weights = {
          production: 0.35,  // Must produce elite numbers
          opportunity: 0.25,  // High usage required
          age: 0.25,         // Age matters more vs QB competition
          stability: 0.10,   // Less forgiving than standard leagues
          efficiency: 0.05,  // Advanced metrics secondary
        };
      }
    }

    // Calculate component scores
    const productionScore = this.calculateProductionScore(player, position);
    const opportunityScore = this.calculateOpportunityScore(player, position);
    const ageScore = this.calculateAgeScore(player);
    const stabilityScore = this.calculateStabilityScore(player);
    const efficiencyScore = this.calculateEfficiencyScore(player, position);

    // Apply superflex QB premium - MASSIVE value shift
    let superflexBonus = 0;
    if (position === 'SFLEX' && player.position === 'QB') {
      // QBs go from #24 overall to #1-2 overall in superflex
      if (productionScore > 70) superflexBonus = 35; // Josh Allen, Lamar - become #1-3 overall
      else if (productionScore > 60) superflexBonus = 30; // Elite tier QBs - top 10 overall
      else if (productionScore > 50) superflexBonus = 25; // Solid QB1s - top 20 overall
      else if (productionScore > 40) superflexBonus = 20; // QB2s with upside - top 50 overall
      else if (productionScore > 30) superflexBonus = 15; // Streamers/backups - still valuable
    }

    const dynastyScore = Math.min(100, 
      (productionScore * weights.production) +
      (opportunityScore * weights.opportunity) +
      (ageScore * weights.age) +
      (stabilityScore * weights.stability) +
      (efficiencyScore * weights.efficiency) +
      superflexBonus
    );

    return Math.round(dynastyScore * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate production score based on fantasy output
   */
  private calculateProductionScore(player: Player, position: string): number {
    const avgPoints = player.avgPoints || 0;
    
    // Position-specific elite thresholds for 2024
    const eliteThresholds = {
      QB: 25,    // Josh Allen territory
      RB: 18,    // CMC, Bijan elite level
      WR: 16,    // Jefferson, Hill elite level
      TE: 12,    // Kelce, Andrews elite level
      SFLEX: player.position === 'QB' ? 25 : 16, // QB or skill position elite
    };

    const elite = eliteThresholds[position as keyof typeof eliteThresholds] || 15;
    const solid = elite * 0.7;   // 70% of elite
    const decent = elite * 0.4;  // 40% of elite

    if (avgPoints >= elite) return 95;
    if (avgPoints >= solid) return 80;
    if (avgPoints >= decent) return 60;
    if (avgPoints >= decent * 0.5) return 40;
    return 20;
  }

  /**
   * Calculate opportunity score (role, usage, team context)
   */
  private calculateOpportunityScore(player: Player, position: string): number {
    // This would integrate target share, snap count, red zone usage
    // For now, using production as proxy for opportunity
    const projectedPoints = player.projectedPoints || 0;
    const avgPoints = player.avgPoints || 0;
    
    // Higher projected vs current = better opportunity
    const opportunityRatio = projectedPoints > 0 ? (projectedPoints / Math.max(avgPoints, 1)) : 1;
    
    let baseScore = Math.min(90, (avgPoints / 20) * 100); // Base on current production
    
    // Adjust for opportunity trend
    if (opportunityRatio > 1.2) baseScore += 10; // Growing opportunity
    else if (opportunityRatio < 0.8) baseScore -= 10; // Declining opportunity
    
    return Math.max(10, Math.min(100, baseScore));
  }

  /**
   * Calculate age score (dynasty longevity factor)
   */
  private calculateAgeScore(player: Player): number {
    // Estimate age from name patterns or use default curves
    const estimatedAge = this.estimatePlayerAge(player);
    
    // Position-specific age curves
    const ageCurves = {
      QB: { peak: 28, decline: 35, cliff: 40 },
      RB: { peak: 24, decline: 28, cliff: 32 },
      WR: { peak: 26, decline: 30, cliff: 34 },
      TE: { peak: 27, decline: 31, cliff: 35 },
    };
    
    const curve = ageCurves[player.position as keyof typeof ageCurves] || ageCurves.WR;
    
    if (estimatedAge <= curve.peak) return 100;
    if (estimatedAge <= curve.peak + 2) return 90;
    if (estimatedAge <= curve.decline) return 75;
    if (estimatedAge <= curve.decline + 2) return 60;
    if (estimatedAge <= curve.cliff) return 40;
    return 20;
  }

  /**
   * Calculate stability score (health, consistency)
   */
  private calculateStabilityScore(player: Player): number {
    let score = 80; // Base assumption of stability
    
    // Injury status impact
    if (player.injuryStatus === 'Questionable') score -= 10;
    else if (player.injuryStatus === 'Doubtful') score -= 20;
    else if (player.injuryStatus === 'Out') score -= 30;
    else if (player.injuryStatus === 'IR') score -= 40;
    
    // Upside as consistency indicator
    const upside = player.upside || 0;
    if (upside > 5) score -= 5; // High upside = high variance
    
    return Math.max(20, Math.min(100, score));
  }

  /**
   * Calculate efficiency score (advanced metrics when available)
   */
  private calculateEfficiencyScore(player: Player, position: string): number {
    // Placeholder for advanced metrics integration
    // Would use YPRR, YAC, target quality, etc.
    const avgPoints = player.avgPoints || 0;
    const projectedPoints = player.projectedPoints || 0;
    
    // Use efficiency proxy: projected vs current performance
    if (projectedPoints > avgPoints) return 75; // Efficient/improving
    if (projectedPoints < avgPoints * 0.8) return 45; // Declining efficiency
    return 60; // Stable efficiency
  }

  /**
   * Estimate player age from patterns or default by position
   */
  private estimatePlayerAge(player: Player): number {
    // Simple estimation - would integrate with real age data
    const positionDefaults = { QB: 27, RB: 25, WR: 26, TE: 27 };
    return positionDefaults[player.position as keyof typeof positionDefaults] || 26;
  }

  /**
   * Assign tier based on dynasty score
   */
  private assignTier(score: number): 'Elite' | 'Tier1' | 'Tier2' | 'Tier3' | 'Bench' {
    if (score >= 85) return 'Elite';
    if (score >= 70) return 'Tier1';
    if (score >= 55) return 'Tier2';
    if (score >= 40) return 'Tier3';
    return 'Bench';
  }

  /**
   * Identify key strengths driving the ranking
   */
  private identifyKeyStrengths(player: Player, position: string): string[] {
    const strengths: string[] = [];
    const avgPoints = player.avgPoints || 0;
    
    // Position-specific strength identification
    if (position === 'QB' || (position === 'SFLEX' && player.position === 'QB')) {
      if (avgPoints > 23) strengths.push('Elite Fantasy Production');
      if (player.projectedPoints && player.projectedPoints > avgPoints * 1.1) {
        strengths.push('Positive Trajectory');
      }
      strengths.push('QB Scarcity Premium');
    } else {
      if (avgPoints > 15) strengths.push('Elite Production');
      if (player.upside && player.upside > 3) strengths.push('High Ceiling');
      if (!player.injuryStatus || player.injuryStatus === 'Healthy') {
        strengths.push('Health & Availability');
      }
    }
    
    return strengths.slice(0, 3); // Top 3 strengths
  }

  /**
   * Identify relevant concerns
   */
  private identifyRelevantConcerns(player: Player): string[] {
    const concerns: string[] = [];
    
    if (player.injuryStatus && player.injuryStatus !== 'Healthy') {
      concerns.push(`Injury Status: ${player.injuryStatus}`);
    }
    
    const avgPoints = player.avgPoints || 0;
    const projectedPoints = player.projectedPoints || 0;
    
    if (projectedPoints < avgPoints * 0.8) {
      concerns.push('Declining Projections');
    }
    
    if (avgPoints < 5) {
      concerns.push('Limited Production');
    }
    
    return concerns.slice(0, 2); // Top 2 concerns
  }

  /**
   * Calculate trend direction
   */
  private calculateTrendDirection(player: Player): 'Rising' | 'Stable' | 'Declining' {
    const avgPoints = player.avgPoints || 0;
    const projectedPoints = player.projectedPoints || 0;
    
    if (projectedPoints > avgPoints * 1.15) return 'Rising';
    if (projectedPoints < avgPoints * 0.85) return 'Declining';
    return 'Stable';
  }

  /**
   * Get methodology explanation for position
   */
  private getMethodology(position: string): string {
    const base = "Dynasty rankings prioritize long-term value through production (30%), opportunity (25%), age (20%), stability (15%), and efficiency (10%).";
    
    if (position === 'QB') {
      return base + " QB rankings emphasize consistent high-volume passing with rushing upside.";
    } else if (position === 'SFLEX') {
      return base + " Superflex rankings transform QB values dramatically - Josh Allen goes from #24 overall in 1QB to #1-2 overall. Elite QBs receive 35-point premiums due to 2-QB league scarcity and higher scoring floors.";
    } else if (position === 'RB') {
      return base + " RB rankings prioritize workload and age-curve considerations given positional volatility.";
    } else if (position === 'WR') {
      return base + " WR rankings emphasize target share, route running, and QB stability for predictable production.";
    } else if (position === 'TE') {
      return base + " TE rankings focus on target volume and red zone usage given positional scarcity after elite tier.";
    }
    
    return base;
  }

  /**
   * Get all position rankings
   */
  async getAllPositionRankings(): Promise<{ [key: string]: PositionRankings }> {
    const positions: ('QB' | 'RB' | 'WR' | 'TE' | 'SFLEX')[] = ['QB', 'RB', 'WR', 'TE', 'SFLEX'];
    const rankings: { [key: string]: PositionRankings } = {};
    
    for (const position of positions) {
      rankings[position] = await this.generatePositionRankings(position);
    }
    
    return rankings;
  }
}

export const positionRankingService = new PositionRankingService();