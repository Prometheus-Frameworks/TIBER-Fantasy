/**
 * Prometheus NFL File-Based Rankings
 * Uses pre-generated authentic 2024 NFL data
 */

import * as fs from 'fs';
import * as path from 'path';

export interface NFLPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  
  games: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  passingYards: number;
  passingTds: number;
  fantasyPoints: number;
  
  // Dynasty evaluation
  dynastyScore: number;
  tier: string;
  rank: number;
  
  // Analysis
  strengths: string[];
  concerns: string[];
  trend: string;
}

class PrometheusNFLFile {
  private nflData: any = null;
  
  async loadNFLData(): Promise<void> {
    if (this.nflData) return;
    
    try {
      const dataPath = path.join(process.cwd(), 'server', 'nfl_data_2024.json');
      const rawData = fs.readFileSync(dataPath, 'utf8');
      this.nflData = JSON.parse(rawData);
      console.log('📊 NFL Data loaded successfully');
    } catch (error) {
      console.error('Error loading NFL data:', error);
      this.nflData = { QB: [], RB: [], WR: [], TE: [] };
    }
  }
  
  async generateFileBasedRankings(): Promise<Record<string, NFLPlayer[]>> {
    console.log('🚀 Generating File-Based NFL Rankings...');
    
    await this.loadNFLData();
    
    const rankings = {
      QB: this.processPositionData('QB'),
      RB: this.processPositionData('RB'),
      WR: this.processPositionData('WR'),
      TE: this.processPositionData('TE')
    };
    
    console.log('✅ File-Based NFL Rankings Generated');
    Object.entries(rankings).forEach(([pos, players]) => {
      console.log(`${pos}: ${players.length} players ranked`);
      if (players.length > 0) {
        console.log(`  Top player: ${players[0].name} (${players[0].fantasyPoints.toFixed(1)} pts)`);
      }
    });
    
    return rankings;
  }
  
  private processPositionData(position: string): NFLPlayer[] {
    const positionData = this.nflData[position] || [];
    const players: NFLPlayer[] = [];
    
    positionData.forEach((data: any, index: number) => {
      // Calculate dynasty metrics
      const fpprPerGame = data.fantasy_points_ppr / Math.max(1, data.games);
      const estimatedAge = this.estimateAge(data.player_name, fpprPerGame, position);
      
      // Calculate dynasty score using Jake Maraia-inspired methodology
      const productionScore = this.calculateProductionScore(fpprPerGame, position);
      const ageScore = this.calculateAgeScore(estimatedAge);
      const opportunityScore = this.calculateOpportunityScore(data, position);
      
      // Weighted dynasty score: Production (50%), Age (30%), Opportunity (20%)
      const dynastyScore = Math.round(
        (productionScore * 0.50) +
        (ageScore * 0.30) +
        (opportunityScore * 0.20)
      );
      
      const player: NFLPlayer = {
        playerId: data.player_id,
        name: data.player_name,
        position,
        team: data.recent_team,
        
        games: data.games,
        targets: data.targets || 0,
        receptions: data.receptions || 0,
        receivingYards: data.receiving_yards || 0,
        receivingTds: data.receiving_tds || 0,
        passingYards: data.passing_yards || 0,
        passingTds: data.passing_tds || 0,
        fantasyPoints: data.fantasy_points_ppr,
        
        dynastyScore: Math.max(0, Math.min(100, dynastyScore)),
        tier: this.assignTier(dynastyScore),
        rank: index + 1,
        
        strengths: this.identifyStrengths(data, estimatedAge, position),
        concerns: this.identifyConcerns(data, estimatedAge, position),
        trend: this.calculateTrend(estimatedAge, fpprPerGame)
      };
      
      players.push(player);
    });
    
    // Sort by dynasty score
    players.sort((a, b) => b.dynastyScore - a.dynastyScore);
    
    // Update ranks
    players.forEach((player, index) => {
      player.rank = index + 1;
    });
    
    return players;
  }
  
  private estimateAge(playerName: string, fpprPerGame: number, position: string): number {
    // Age estimation based on performance patterns and position
    
    // Known veterans (conservative estimates)
    const veteranNames = ['T.Brady', 'A.Rodgers', 'M.Ryan', 'D.Henry', 'L.Fournette', 'J.Jones', 'D.Adams'];
    if (veteranNames.some(name => playerName.includes(name.split('.')[1]))) {
      return 32;
    }
    
    // Elite performers likely in prime (27-29)
    if (fpprPerGame > 18) return 28;
    
    // Good players likely established (25-27)  
    if (fpprPerGame > 12) return 26;
    
    // Emerging players likely young (22-25)
    if (fpprPerGame > 8) return 24;
    
    // Low production likely rookies/young
    return 23;
  }
  
  private calculateProductionScore(fpprPerGame: number, position: string): number {
    // Position-specific elite thresholds
    let eliteThreshold: number;
    
    switch (position) {
      case 'QB': eliteThreshold = 22; break;
      case 'RB': eliteThreshold = 18; break;
      case 'WR': eliteThreshold = 16; break;
      case 'TE': eliteThreshold = 12; break;
      default: eliteThreshold = 15;
    }
    
    return Math.round(Math.min(100, (fpprPerGame / eliteThreshold) * 100));
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
  
  private calculateOpportunityScore(data: any, position: string): number {
    if (position === 'QB') {
      // QBs get opportunity based on games played (starter role)
      const gamesPct = data.games / 17;
      return Math.round(Math.min(100, gamesPct * 100));
    }
    
    // Skill positions use targets as opportunity metric
    const targetsPerGame = data.targets / Math.max(1, data.games);
    
    let eliteTargets: number;
    switch (position) {
      case 'RB': eliteTargets = 4; break;
      case 'WR': eliteTargets = 8; break;
      case 'TE': eliteTargets = 6; break;
      default: eliteTargets = 6;
    }
    
    return Math.round(Math.min(100, (targetsPerGame / eliteTargets) * 100));
  }
  
  private assignTier(score: number): string {
    if (score >= 90) return 'Elite';
    if (score >= 75) return 'Premium';
    if (score >= 60) return 'Strong';
    if (score >= 45) return 'Solid';
    if (score >= 30) return 'Depth';
    return 'Bench';
  }
  
  private identifyStrengths(data: any, age: number, position: string): string[] {
    const strengths: string[] = [];
    const fpprPerGame = data.fantasy_points_ppr / Math.max(1, data.games);
    
    if (age <= 25) strengths.push('Elite youth');
    if (fpprPerGame >= 15) strengths.push('Elite production');
    
    if (position !== 'QB') {
      const targetsPerGame = data.targets / Math.max(1, data.games);
      if (targetsPerGame >= 8) strengths.push('High target share');
      
      if (data.targets > 0) {
        const catchRate = (data.receptions / data.targets) * 100;
        if (catchRate >= 70) strengths.push('Reliable hands');
        
        const yardsPerTarget = data.receiving_yards / data.targets;
        if (yardsPerTarget >= 8.5) strengths.push('Big play ability');
      }
    }
    
    if (data.games >= 16) strengths.push('Durability');
    
    return strengths.slice(0, 3);
  }
  
  private identifyConcerns(data: any, age: number, position: string): string[] {
    const concerns: string[] = [];
    
    if (age >= 30) concerns.push('Age decline risk');
    if (data.games < 12) concerns.push('Injury concerns');
    
    if (position !== 'QB') {
      const targetsPerGame = data.targets / Math.max(1, data.games);
      if (targetsPerGame < 4) concerns.push('Limited opportunity');
      
      if (data.targets > 30) {
        const catchRate = (data.receptions / data.targets) * 100;
        if (catchRate < 60) concerns.push('Drop issues');
      }
    }
    
    return concerns.slice(0, 3);
  }
  
  private calculateTrend(age: number, fpprPerGame: number): string {
    if (age <= 25 && fpprPerGame > 10) return 'Rising';
    if (age <= 28 && fpprPerGame > 12) return 'Stable';
    return 'Declining';
  }
}

export const prometheusNFLFile = new PrometheusNFLFile();