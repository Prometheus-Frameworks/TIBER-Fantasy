/**
 * Prometheus Dynasty Rankings Demo System
 * Demonstrates the ranking methodology while we wait for NFL data optimization
 */

export interface PrometheusPlayer {
  playerId: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  
  games: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  rushingYards?: number;
  rushingTds?: number;
  
  catchRate: number;
  yardsPerTarget: number;
  avgSeparation?: number;
  yacAboveExpected?: number;
  avgYac?: number;
  
  productionScore: number;
  opportunityScore: number;
  ageScore: number;
  efficiencyScore: number;
  stabilityScore: number;
  
  dynastyScore: number;
  prometheusRank: number;
  ecrRank?: number;
  rankVariance?: number;
  
  tier: 'Elite' | 'Premium' | 'Strong' | 'Solid' | 'Depth' | 'Bench';
  strengths: string[];
  concerns: string[];
  dynastyTrend: 'Rising' | 'Stable' | 'Declining';
}

class PrometheusRankingsDemoEngine {
  
  /**
   * Generate demo dynasty rankings using sample elite players
   */
  async generateDemoRankings(): Promise<Record<string, PrometheusPlayer[]>> {
    console.log('🚀 Generating Prometheus Demo Rankings...');
    
    try {
      const sampleData = this.getSamplePlayerData();
      
      const rankings = {
        QB: this.processPosition(sampleData.QB, 'QB'),
        RB: this.processPosition(sampleData.RB, 'RB'),
        WR: this.processPosition(sampleData.WR, 'WR'),
        TE: this.processPosition(sampleData.TE, 'TE')
      };
      
      console.log('✅ Prometheus Demo Rankings Generated');
      return rankings;
      
    } catch (error) {
      console.error('Error generating demo rankings:', error);
      throw error;
    }
  }
  
  /**
   * Sample player data based on realistic 2024 stats
   */
  private getSamplePlayerData(): Record<string, any[]> {
    return {
      QB: [
        { 
          player_id: 'mahomes01', player_name: 'Patrick Mahomes', recent_team: 'KC', age: 29,
          games: 17, passing_yards: 4183, passing_tds: 26, rushing_yards: 417, rushing_tds: 2,
          targets: 0, receptions: 0, receiving_yards: 0, receiving_tds: 0
        },
        {
          player_id: 'allen01', player_name: 'Josh Allen', recent_team: 'BUF', age: 28,
          games: 17, passing_yards: 4306, passing_tds: 28, rushing_yards: 524, rushing_tds: 15,
          targets: 0, receptions: 0, receiving_yards: 0, receiving_tds: 0
        },
        {
          player_id: 'jackson01', player_name: 'Lamar Jackson', recent_team: 'BAL', age: 27,
          games: 17, passing_yards: 3678, passing_tds: 24, rushing_yards: 915, rushing_tds: 3,
          targets: 0, receptions: 0, receiving_yards: 0, receiving_tds: 0
        }
      ],
      RB: [
        {
          player_id: 'barkley01', player_name: 'Saquon Barkley', recent_team: 'PHI', age: 27,
          games: 17, targets: 33, receptions: 33, receiving_yards: 278, receiving_tds: 2,
          rushing_yards: 2005, rushing_tds: 13
        },
        {
          player_id: 'henry01', player_name: 'Derrick Henry', recent_team: 'BAL', age: 30,
          games: 17, targets: 11, receptions: 11, receiving_yards: 137, receiving_tds: 0,
          rushing_yards: 1921, rushing_tds: 16
        },
        {
          player_id: 'gibbs01', player_name: 'Jahmyr Gibbs', recent_team: 'DET', age: 22,
          games: 17, targets: 52, receptions: 52, receiving_yards: 517, receiving_tds: 1,
          rushing_yards: 1412, rushing_tds: 16
        }
      ],
      WR: [
        {
          player_id: 'jefferson01', player_name: 'Justin Jefferson', recent_team: 'MIN', age: 25,
          games: 17, targets: 170, receptions: 103, receiving_yards: 1533, receiving_tds: 10,
          avg_separation: 3.45, avg_yac: 6.8, avg_yac_above_expectation: 1.2
        },
        {
          player_id: 'hill01', player_name: 'Tyreek Hill', recent_team: 'MIA', age: 30,
          games: 17, targets: 136, receptions: 81, receiving_yards: 959, receiving_tds: 6,
          avg_separation: 4.12, avg_yac: 5.1, avg_yac_above_expectation: 0.8
        },
        {
          player_id: 'nacua01', player_name: 'Puka Nacua', recent_team: 'LAR', age: 23,
          games: 17, targets: 129, receptions: 90, receiving_yards: 1131, receiving_tds: 3,
          avg_separation: 3.32, avg_yac: 6.7, avg_yac_above_expectation: 1.5
        }
      ],
      TE: [
        {
          player_id: 'kelce01', player_name: 'Travis Kelce', recent_team: 'KC', age: 35,
          games: 17, targets: 123, receptions: 97, receiving_yards: 823, receiving_tds: 3,
          avg_separation: 2.89, avg_yac: 4.2, avg_yac_above_expectation: 0.3
        },
        {
          player_id: 'bowers01', player_name: 'Brock Bowers', recent_team: 'LV', age: 21,
          games: 17, targets: 156, receptions: 112, receiving_yards: 1194, receiving_tds: 5,
          avg_separation: 3.15, avg_yac: 5.8, avg_yac_above_expectation: 1.1
        },
        {
          player_id: 'laporta01', player_name: 'Sam LaPorta', recent_team: 'DET', age: 23,
          games: 17, targets: 97, receptions: 58, receiving_yards: 618, receiving_tds: 9,
          avg_separation: 2.95, avg_yac: 4.8, avg_yac_above_expectation: 0.7
        }
      ]
    };
  }
  
  /**
   * Process players for a specific position
   */
  private processPosition(players: any[], position: string): PrometheusPlayer[] {
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
    const ageScore = this.calculateAgeScore(data.age);
    const efficiencyScore = this.calculateEfficiencyScore(data, position);
    const stabilityScore = this.calculateStabilityScore(data);
    
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
      age: data.age,
      
      games: data.games || 17,
      targets: data.targets || 0,
      receptions: data.receptions || 0,
      receivingYards: data.receiving_yards || 0,
      receivingTds: data.receiving_tds || 0,
      rushingYards: data.rushing_yards || 0,
      rushingTds: data.rushing_tds || 0,
      
      catchRate: data.targets > 0 ? (data.receptions / data.targets * 100) : 0,
      yardsPerTarget: data.targets > 0 ? (data.receiving_yards / data.targets) : 0,
      avgSeparation: data.avg_separation,
      yacAboveExpected: data.avg_yac_above_expectation,
      avgYac: data.avg_yac,
      
      productionScore,
      opportunityScore,
      ageScore,
      efficiencyScore,
      stabilityScore,
      
      dynastyScore: Math.max(0, Math.min(100, dynastyScore)),
      prometheusRank: 0,
      
      tier: this.assignTier(dynastyScore),
      strengths: this.identifyStrengths(data, position),
      concerns: this.identifyConcerns(data, position),
      dynastyTrend: this.calculateTrend(data)
    };
    
    return player;
  }
  
  private calculateProductionScore(data: any, position: string): number {
    const games = Math.max(1, data.games || 17);
    
    if (position === 'QB') {
      const passYardsPerGame = (data.passing_yards || 0) / games;
      const passTdsPerGame = (data.passing_tds || 0) / games;
      const rushYardsPerGame = (data.rushing_yards || 0) / games;
      
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
  
  private calculateOpportunityScore(data: any, position: string): number {
    if (position === 'QB') {
      const games = Math.max(1, data.games || 17);
      const passAttempts = (data.passing_yards || 0) / 7.5;
      const attemptsPerGame = passAttempts / games;
      return Math.round(Math.min(100, (attemptsPerGame / 35) * 100));
    }
    
    if (position === 'RB') {
      const games = Math.max(1, data.games || 17);
      const targetsPerGame = (data.targets || 0) / games;
      const rushAttemptsEst = (data.rushing_yards || 0) / 4.2;
      const touchesPerGame = (targetsPerGame + (rushAttemptsEst / games));
      return Math.round(Math.min(100, (touchesPerGame / 20) * 100));
    }
    
    const games = Math.max(1, data.games || 17);
    const targetsPerGame = (data.targets || 0) / games;
    const eliteTargets = position === 'WR' ? 10 : 7;
    return Math.round(Math.min(100, (targetsPerGame / eliteTargets) * 100));
  }
  
  private calculateAgeScore(age: number): number {
    if (age <= 22) return 100;
    if (age <= 24) return 90;
    if (age <= 26) return 80;
    if (age <= 28) return 70;
    if (age <= 30) return 55;
    if (age <= 32) return 35;
    return 15;
  }
  
  private calculateEfficiencyScore(data: any, position: string): number {
    if (position === 'QB') return 75; // Simplified for demo
    
    if (position === 'RB') {
      const yardsPerCarry = data.rushing_yards && data.rushing_yards > 0 ? 
        data.rushing_yards / Math.max(1, data.rushing_yards / 4.2) : 0;
      return Math.round(Math.min(100, (yardsPerCarry / 4.8) * 100));
    }
    
    const yardsPerTarget = data.targets > 0 ? data.receiving_yards / data.targets : 0;
    const catchRate = data.targets > 0 ? (data.receptions / data.targets * 100) : 0;
    const yacAboveExp = data.avg_yac_above_expectation || 0;
    
    const eliteYPT = position === 'WR' ? 9.0 : 8.5;
    const eliteCatchRate = position === 'WR' ? 65 : 70;
    
    const score = 
      (yardsPerTarget / eliteYPT * 40) +
      (catchRate / eliteCatchRate * 40) +
      (Math.max(0, yacAboveExp + 2) / 4 * 20);
    
    return Math.round(Math.min(100, score));
  }
  
  private calculateStabilityScore(data: any): number {
    const games = data.games || 17;
    const maxGames = 17;
    const gamesPct = games / maxGames;
    
    if (gamesPct >= 0.9) return 90;
    if (gamesPct >= 0.7) return 75;
    if (gamesPct >= 0.5) return 60;
    return 40;
  }
  
  private assignTier(score: number): PrometheusPlayer['tier'] {
    if (score >= 90) return 'Elite';
    if (score >= 75) return 'Premium';
    if (score >= 60) return 'Strong';
    if (score >= 45) return 'Solid';
    if (score >= 30) return 'Depth';
    return 'Bench';
  }
  
  private identifyStrengths(data: any, position: string): string[] {
    const strengths: string[] = [];
    
    if (data.age <= 24) strengths.push('Elite youth');
    
    const games = Math.max(1, data.games || 17);
    if (position !== 'QB' && (data.targets || 0) / games >= 8) {
      strengths.push('High target share');
    }
    
    if (data.targets > 0) {
      const yardsPerTarget = data.receiving_yards / data.targets;
      if (yardsPerTarget >= 8.5) strengths.push('Elite efficiency');
      
      const catchRate = (data.receptions / data.targets * 100);
      if (catchRate >= 70) strengths.push('Reliable hands');
    }
    
    if (data.avg_yac_above_expectation > 0.5) strengths.push('YAC ability');
    
    return strengths.slice(0, 3);
  }
  
  private identifyConcerns(data: any, position: string): string[] {
    const concerns: string[] = [];
    
    if (data.age >= 30) concerns.push('Age decline risk');
    
    const games = Math.max(1, data.games || 17);
    if (position !== 'QB' && (data.targets || 0) / games < 5) {
      concerns.push('Limited opportunity');
    }
    
    if (data.targets > 30) {
      const catchRate = (data.receptions / data.targets * 100);
      if (catchRate < 60) concerns.push('Drop issues');
      
      const yardsPerTarget = data.receiving_yards / data.targets;
      if (yardsPerTarget < 7.0) concerns.push('Low efficiency');
    }
    
    if (data.games < 15) concerns.push('Injury concerns');
    
    return concerns.slice(0, 3);
  }
  
  private calculateTrend(data: any): PrometheusPlayer['dynastyTrend'] {
    const age = data.age;
    
    if (age <= 25 && (data.targets || 0) > 50) return 'Rising';
    if (age <= 28) return 'Stable';
    return 'Declining';
  }
}

export const prometheusDemoRankings = new PrometheusRankingsDemoEngine();