/**
 * Prometheus Dynasty Rankings System
 * Elite analytics using current 2024 NFL data
 * Inspired by Jake Maraia's FF Dataroma methodology
 */

import { execSync } from 'child_process';

export interface PrometheusPlayer {
  playerId: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  
  // 2024 Current Season Stats
  games: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  rushingYards?: number;
  rushingTds?: number;
  
  // Advanced 2024 Metrics
  catchRate: number;
  yardsPerTarget: number;
  avgSeparation?: number;
  yacAboveExpected?: number;
  avgYac?: number;
  
  // Dynasty Scoring Components
  productionScore: number;    // 30% - Current production
  opportunityScore: number;   // 35% - Volume metrics  
  ageScore: number;          // 20% - Dynasty longevity
  efficiencyScore: number;   // 10% - Advanced metrics
  stabilityScore: number;    // 5% - Consistency/team context
  
  // Final Rankings
  dynastyScore: number;      // 0-100 composite
  prometheusRank: number;    // Our ranking
  ecrRank?: number;         // Expert consensus for comparison
  rankVariance?: number;    // Our rank vs ECR
  
  // Analysis
  tier: 'Elite' | 'Premium' | 'Strong' | 'Solid' | 'Depth' | 'Bench';
  strengths: string[];
  concerns: string[];
  dynastyTrend: 'Rising' | 'Stable' | 'Declining';
}

class PrometheusRankingEngine {
  
  /**
   * Generate complete dynasty rankings using 2024 NFL data
   */
  async generateRankings(): Promise<Record<string, PrometheusPlayer[]>> {
    console.log('🚀 Generating Prometheus Dynasty Rankings...');
    
    try {
      // Get current 2024 NFL data
      const playerData = await this.fetchCurrentNFLData();
      
      // Process each position
      const rankings = {
        QB: await this.rankPosition(playerData.QB, 'QB'),
        RB: await this.rankPosition(playerData.RB, 'RB'), 
        WR: await this.rankPosition(playerData.WR, 'WR'),
        TE: await this.rankPosition(playerData.TE, 'TE')
      };
      
      console.log('✅ Prometheus Rankings Generated');
      return rankings;
      
    } catch (error) {
      console.error('Error generating Prometheus rankings:', error);
      throw error;
    }
  }
  
  /**
   * Fetch current 2024 NFL data using NFL-Data-Py
   */
  private async fetchCurrentNFLData(): Promise<Record<string, any[]>> {
    try {
      const result = execSync('python3 server/prometheus_nfl_data.py', { 
        encoding: 'utf8',
        timeout: 60000, // Increased timeout for data fetching
        cwd: process.cwd()
      });
      
      // Parse the JSON result
      const data = JSON.parse(result);
      
      // Check for error in response
      if (data.error) {
        throw new Error(`NFL data fetch error: ${data.error}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching NFL data:', error);
      throw new Error('Failed to fetch current NFL data');
    }
  }
  
  /**
   * Rank players for specific position
   */
  private async rankPosition(players: any[], position: string): Promise<PrometheusPlayer[]> {
    const rankedPlayers: PrometheusPlayer[] = [];
    
    for (const playerData of players) {
      const player = this.createPrometheusPlayer(playerData, position);
      rankedPlayers.push(player);
    }
    
    // Sort by dynasty score (highest first)
    rankedPlayers.sort((a, b) => b.dynastyScore - a.dynastyScore);
    
    // Assign ranks
    rankedPlayers.forEach((player, index) => {
      player.prometheusRank = index + 1;
    });
    
    return rankedPlayers;
  }
  
  /**
   * Create Prometheus player evaluation
   */
  private createPrometheusPlayer(data: any, position: string): PrometheusPlayer {
    // Calculate component scores
    const productionScore = this.calculateProductionScore(data, position);
    const opportunityScore = this.calculateOpportunityScore(data, position);
    const ageScore = this.calculateAgeScore(data.age || 25);
    const efficiencyScore = this.calculateEfficiencyScore(data, position);
    const stabilityScore = this.calculateStabilityScore(data, position);
    
    // Weighted dynasty score (Jake Maraia inspired weighting)
    const dynastyScore = Math.round(
      (productionScore * 0.30) +    // Current production
      (opportunityScore * 0.35) +   // Volume/opportunity (most predictive)
      (ageScore * 0.20) +          // Dynasty longevity
      (efficiencyScore * 0.10) +   // Advanced metrics
      (stabilityScore * 0.05)      // Consistency
    );
    
    const player: PrometheusPlayer = {
      playerId: data.player_id,
      name: data.player_name,
      position: position as any,
      team: data.recent_team,
      age: data.age || 25,
      
      // Stats
      games: data.games || 0,
      targets: data.targets || 0,
      receptions: data.receptions || 0,
      receivingYards: data.receiving_yards || 0,
      receivingTds: data.receiving_tds || 0,
      rushingYards: data.rushing_yards || 0,
      rushingTds: data.rushing_tds || 0,
      
      // Advanced metrics
      catchRate: data.catch_rate || 0,
      yardsPerTarget: data.yards_per_target || 0,
      avgSeparation: data.avg_separation,
      yacAboveExpected: data.avg_yac_above_expectation,
      avgYac: data.avg_yac,
      
      // Component scores
      productionScore,
      opportunityScore,
      ageScore,
      efficiencyScore,
      stabilityScore,
      
      // Final evaluation
      dynastyScore: Math.max(0, Math.min(100, dynastyScore)),
      prometheusRank: 0, // Set later
      
      tier: this.assignTier(dynastyScore),
      strengths: this.identifyStrengths(data, position),
      concerns: this.identifyConcerns(data, position),
      dynastyTrend: this.calculateTrend(data, position)
    };
    
    return player;
  }
  
  /**
   * Calculate production score (30% weight)
   */
  private calculateProductionScore(data: any, position: string): number {
    const games = Math.max(1, data.games || 1);
    
    if (position === 'QB') {
      const passYardsPerGame = (data.passing_yards || 0) / games;
      const passTdsPerGame = (data.passing_tds || 0) / games;
      const rushYardsPerGame = (data.rushing_yards || 0) / games;
      
      // Elite QB: 275+ pass yards, 2+ pass TDs, 25+ rush yards per game
      const score = Math.min(100, 
        (passYardsPerGame / 275 * 40) +
        (passTdsPerGame / 2 * 40) +
        (rushYardsPerGame / 25 * 20)
      );
      return Math.round(score);
    }
    
    if (position === 'RB') {
      const rushYardsPerGame = (data.rushing_yards || 0) / games;
      const recYardsPerGame = (data.receiving_yards || 0) / games;
      const totalTdsPerGame = ((data.rushing_tds || 0) + (data.receiving_tds || 0)) / games;
      
      // Elite RB: 80+ rush yards, 25+ rec yards, 0.8+ TDs per game
      const score = Math.min(100,
        (rushYardsPerGame / 80 * 50) +
        (recYardsPerGame / 25 * 30) +
        (totalTdsPerGame / 0.8 * 20)
      );
      return Math.round(score);
    }
    
    // WR/TE
    const recYardsPerGame = (data.receiving_yards || 0) / games;
    const receptionsPerGame = (data.receptions || 0) / games;
    const recTdsPerGame = (data.receiving_tds || 0) / games;
    
    const eliteYards = position === 'WR' ? 80 : 60;
    const eliteReceptions = position === 'WR' ? 6 : 4.5;
    const eliteTds = position === 'WR' ? 0.6 : 0.5;
    
    const score = Math.min(100,
      (recYardsPerGame / eliteYards * 50) +
      (receptionsPerGame / eliteReceptions * 30) +
      (recTdsPerGame / eliteTds * 20)
    );
    
    return Math.round(score);
  }
  
  /**
   * Calculate opportunity score (35% weight - most predictive)
   */
  private calculateOpportunityScore(data: any, position: string): number {
    if (position === 'QB') {
      // QB opportunity based on attempts and team context
      const games = Math.max(1, data.games || 1);
      const passAttempts = (data.passing_yards || 0) / 7.5; // Estimate attempts
      const attemptsPerGame = passAttempts / games;
      
      // Elite QB: 35+ attempts per game
      return Math.round(Math.min(100, (attemptsPerGame / 35) * 100));
    }
    
    if (position === 'RB') {
      const games = Math.max(1, data.games || 1);
      const targetsPerGame = (data.targets || 0) / games;
      const rushAttemptsEst = (data.rushing_yards || 0) / 4.2; // Estimate attempts
      const touchesPerGame = (targetsPerGame + (rushAttemptsEst / games));
      
      // Elite RB: 20+ touches per game
      return Math.round(Math.min(100, (touchesPerGame / 20) * 100));
    }
    
    // WR/TE opportunity based on targets
    const games = Math.max(1, data.games || 1);
    const targetsPerGame = (data.targets || 0) / games;
    
    const eliteTargets = position === 'WR' ? 10 : 7;
    return Math.round(Math.min(100, (targetsPerGame / eliteTargets) * 100));
  }
  
  /**
   * Calculate age score (20% weight)
   */
  private calculateAgeScore(age: number): number {
    if (age <= 22) return 100; // Elite young players
    if (age <= 24) return 90;  // Premium youth
    if (age <= 26) return 80;  // Peak years
    if (age <= 28) return 70;  // Still strong
    if (age <= 30) return 55;  // Aging but valuable
    if (age <= 32) return 35;  // Declining
    return 15; // Veteran depth
  }
  
  /**
   * Calculate efficiency score (10% weight)
   */
  private calculateEfficiencyScore(data: any, position: string): number {
    if (position === 'QB') {
      // QB efficiency placeholder - would use more advanced metrics
      return 50;
    }
    
    if (position === 'RB') {
      const yardsPerCarry = data.rushing_yards && data.rushing_yards > 0 ? 
        data.rushing_yards / Math.max(1, data.rushing_yards / 4.2) : 0;
      
      // Elite RB: 4.8+ YPC
      return Math.round(Math.min(100, (yardsPerCarry / 4.8) * 100));
    }
    
    // WR/TE efficiency
    const yardsPerTarget = data.yards_per_target || 0;
    const catchRate = data.catch_rate || 0;
    const yacAboveExp = data.avg_yac_above_expectation || 0;
    
    const eliteYPT = position === 'WR' ? 9.0 : 8.5;
    const eliteCatchRate = position === 'WR' ? 65 : 70;
    
    const score = 
      (yardsPerTarget / eliteYPT * 40) +
      (catchRate / eliteCatchRate * 40) +
      (Math.max(0, yacAboveExp + 2) / 4 * 20); // YAC above expected (-2 to +2 range)
    
    return Math.round(Math.min(100, score));
  }
  
  /**
   * Calculate stability score (5% weight)
   */
  private calculateStabilityScore(data: any, position: string): number {
    // Simplified stability - games played consistency
    const games = data.games || 0;
    const maxGames = 17; // 2024 season
    
    const gamesPct = games / maxGames;
    
    if (gamesPct >= 0.9) return 90; // Excellent availability
    if (gamesPct >= 0.7) return 75; // Good availability
    if (gamesPct >= 0.5) return 60; // Average availability
    return 40; // Poor availability
  }
  
  /**
   * Assign dynasty tier
   */
  private assignTier(score: number): PrometheusPlayer['tier'] {
    if (score >= 90) return 'Elite';
    if (score >= 75) return 'Premium';
    if (score >= 60) return 'Strong';
    if (score >= 45) return 'Solid';
    if (score >= 30) return 'Depth';
    return 'Bench';
  }
  
  /**
   * Identify player strengths
   */
  private identifyStrengths(data: any, position: string): string[] {
    const strengths: string[] = [];
    
    // Age-based strengths
    if ((data.age || 25) <= 24) strengths.push('Elite youth');
    
    // Volume strengths
    const games = Math.max(1, data.games || 1);
    if (position !== 'QB' && (data.targets || 0) / games >= 8) {
      strengths.push('High target share');
    }
    
    // Efficiency strengths
    if (data.yards_per_target >= 8.5) strengths.push('Elite efficiency');
    if (data.catch_rate >= 70) strengths.push('Reliable hands');
    if (data.avg_yac_above_expectation > 0.5) strengths.push('YAC ability');
    
    return strengths.slice(0, 3); // Top 3 strengths
  }
  
  /**
   * Identify player concerns
   */
  private identifyConcerns(data: any, position: string): string[] {
    const concerns: string[] = [];
    
    // Age concerns
    if ((data.age || 25) >= 30) concerns.push('Age decline risk');
    
    // Volume concerns
    const games = Math.max(1, data.games || 1);
    if (position !== 'QB' && (data.targets || 0) / games < 5) {
      concerns.push('Limited opportunity');
    }
    
    // Efficiency concerns
    if (data.catch_rate < 60 && data.targets > 20) concerns.push('Drop issues');
    if (data.yards_per_target < 7.0 && data.targets > 30) concerns.push('Low efficiency');
    
    // Availability concerns
    if ((data.games || 0) < 12) concerns.push('Injury concerns');
    
    return concerns.slice(0, 3); // Top 3 concerns
  }
  
  /**
   * Calculate dynasty trend
   */
  private calculateTrend(data: any, position: string): PrometheusPlayer['dynastyTrend'] {
    const age = data.age || 25;
    
    // Simplified trend calculation
    if (age <= 25 && (data.targets || 0) > 50) return 'Rising';
    if (age <= 28) return 'Stable';
    return 'Declining';
  }
}

export const prometheusRankings = new PrometheusRankingEngine();