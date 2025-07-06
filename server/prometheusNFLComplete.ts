/**
 * Prometheus Complete NFL Rankings
 * Working implementation with authentic 2024 NFL data
 */

import { spawn } from 'child_process';

export interface PrometheusRankedPlayer {
  playerId: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  
  // 2024 Season Totals
  games: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  rushingYards: number;
  rushingTds: number;
  passingYards: number;
  passingTds: number;
  attempts: number;
  
  // Advanced Metrics
  targetShare: number;
  airYardsShare: number;
  wopr: number;
  yardsPerTarget: number;
  catchRate: number;
  fantasyPointsPPR: number;
  
  // Dynasty Components
  productionScore: number;
  opportunityScore: number;
  ageScore: number;
  efficiencyScore: number;
  stabilityScore: number;
  
  // Final Dynasty Rating
  dynastyScore: number;
  prometheusRank: number;
  tier: 'Elite' | 'Premium' | 'Strong' | 'Solid' | 'Depth' | 'Bench';
  
  strengths: string[];
  concerns: string[];
  trend: 'Rising' | 'Stable' | 'Declining';
  confidence: number;
}

class PrometheusCompleteNFL {
  
  async generateRankings(): Promise<Record<string, PrometheusRankedPlayer[]>> {
    console.log('🚀 Generating Prometheus Complete NFL Rankings...');
    
    try {
      const nflData = await this.fetchNFLData();
      console.log(`📊 Loaded ${nflData.length} player-week records`);
      
      const rankings = {
        QB: this.processPosition(nflData, 'QB'),
        RB: this.processPosition(nflData, 'RB'), 
        WR: this.processPosition(nflData, 'WR'),
        TE: this.processPosition(nflData, 'TE')
      };
      
      console.log('✅ Prometheus Complete Rankings Generated');
      Object.entries(rankings).forEach(([pos, players]) => {
        console.log(`${pos}: ${players.length} players ranked`);
      });
      
      return rankings;
      
    } catch (error) {
      console.error('Error generating complete rankings:', error);
      throw error;
    }
  }
  
  private async fetchNFLData(): Promise<any[]> {
    const pythonScript = `
import nfl_data_py as nfl
import json
import sys
import pandas as pd

try:
    # Get all 2024 weekly data
    weekly = nfl.import_weekly_data([2024])
    
    # Filter to skill positions only
    skill_positions = ['QB', 'RB', 'WR', 'TE']
    weekly = weekly[weekly['position'].isin(skill_positions)]
    
    # Select only columns we need and ensure they exist
    available_columns = []
    desired_columns = [
        'player_id', 'player_name', 'position', 'recent_team', 'week',
        'targets', 'receptions', 'receiving_yards', 'receiving_tds',
        'carries', 'rushing_yards', 'rushing_tds', 
        'passing_yards', 'passing_tds', 'attempts',
        'target_share', 'air_yards_share', 'wopr',
        'fantasy_points_ppr'
    ]
    
    for col in desired_columns:
        if col in weekly.columns:
            available_columns.append(col)
    
    weekly_filtered = weekly[available_columns]
    
    # Handle any NaN values that could break JSON
    weekly_filtered = weekly_filtered.fillna(0)
    
    # Convert to records, handling data types properly
    result = []
    for _, row in weekly_filtered.iterrows():
        record = {}
        for col in available_columns:
            value = row[col]
            # Convert numpy types to Python types
            if pd.isna(value):
                record[col] = 0
            elif isinstance(value, (int, float)):
                if pd.isna(value):
                    record[col] = 0
                else:
                    record[col] = float(value) if col in ['target_share', 'air_yards_share', 'wopr'] else int(value)
            else:
                record[col] = str(value)
        result.append(record)
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {'error': str(e)}
    print(json.dumps(error_result), file=sys.stderr)
    sys.exit(1)
`;

    return this.executePython(pythonScript);
  }
  
  private async executePython(script: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', ['-c', script]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(Array.isArray(result) ? result : []);
          } catch (error) {
            console.error('JSON parse error:', error);
            resolve([]);
          }
        } else {
          console.error('Python error:', stderr);
          resolve([]);
        }
      });
    });
  }
  
  private processPosition(nflData: any[], position: string): PrometheusRankedPlayer[] {
    // Filter data for this position
    const positionData = nflData.filter(p => p.position === position);
    
    // Group by player and aggregate season stats
    const playerMap = new Map();
    
    positionData.forEach(week => {
      const playerId = week.player_id;
      
      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, {
          player_id: playerId,
          player_name: week.player_name,
          position: week.position,
          recent_team: week.recent_team,
          weeks: [],
          totals: {
            games: 0,
            targets: 0,
            receptions: 0,
            receiving_yards: 0,
            receiving_tds: 0,
            carries: 0,
            rushing_yards: 0,
            rushing_tds: 0,
            passing_yards: 0,
            passing_tds: 0,
            attempts: 0,
            fantasy_points_ppr: 0
          },
          averages: {
            target_share: 0,
            air_yards_share: 0,
            wopr: 0
          }
        });
      }
      
      const player = playerMap.get(playerId);
      player.weeks.push(week);
      
      // Sum totals
      player.totals.games += 1;
      player.totals.targets += week.targets || 0;
      player.totals.receptions += week.receptions || 0;
      player.totals.receiving_yards += week.receiving_yards || 0;
      player.totals.receiving_tds += week.receiving_tds || 0;
      player.totals.carries += week.carries || 0;
      player.totals.rushing_yards += week.rushing_yards || 0;
      player.totals.rushing_tds += week.rushing_tds || 0;
      player.totals.passing_yards += week.passing_yards || 0;
      player.totals.passing_tds += week.passing_tds || 0;
      player.totals.attempts += week.attempts || 0;
      player.totals.fantasy_points_ppr += week.fantasy_points_ppr || 0;
    });
    
    // Calculate averages
    playerMap.forEach(player => {
      const validWeeks = player.weeks.filter((w: any) => 
        w.target_share !== null && w.target_share !== undefined && !isNaN(w.target_share)
      );
      
      if (validWeeks.length > 0) {
        player.averages.target_share = validWeeks.reduce((sum: number, w: any) => sum + (w.target_share || 0), 0) / validWeeks.length;
        player.averages.air_yards_share = validWeeks.reduce((sum: number, w: any) => sum + (w.air_yards_share || 0), 0) / validWeeks.length;
        player.averages.wopr = validWeeks.reduce((sum: number, w: any) => sum + (w.wopr || 0), 0) / validWeeks.length;
      }
    });
    
    // Convert to ranked players
    const rankedPlayers: PrometheusRankedPlayer[] = [];
    
    playerMap.forEach(playerData => {
      // Fantasy relevance filters - only include players who matter
      
      if (position === 'QB') {
        // Must have started meaningful games
        if (playerData.totals.games < 4 || playerData.totals.attempts < 50) return;
        if (playerData.totals.fantasy_points_ppr < 50) return;
      }
      
      if (position === 'RB') {
        // Must have significant touches or be a key receiving back
        const totalTouches = (playerData.totals.carries || 0) + (playerData.totals.targets || 0);
        if (playerData.totals.games < 4 || totalTouches < 30) return;
        if (playerData.totals.fantasy_points_ppr < 20) return;
      }
      
      if (position === 'WR') {
        // Must have meaningful target volume - eliminates practice squad/deep bench
        if (playerData.totals.games < 4 || playerData.totals.targets < 15) return;
        if (playerData.totals.fantasy_points_ppr < 10) return;
      }
      
      if (position === 'TE') {
        // TE relevance threshold is lower due to position scarcity
        if (playerData.totals.games < 4 || playerData.totals.targets < 10) return;
        if (playerData.totals.fantasy_points_ppr < 15) return;
      }
      
      const rankedPlayer = this.createRankedPlayer(playerData, position);
      rankedPlayers.push(rankedPlayer);
    });
    
    // Sort by dynasty score and assign ranks
    rankedPlayers.sort((a, b) => b.dynastyScore - a.dynastyScore);
    rankedPlayers.forEach((player, index) => {
      player.prometheusRank = index + 1;
    });
    
    return rankedPlayers.slice(0, 50); // Top 50 per position
  }
  
  private createRankedPlayer(playerData: any, position: string): PrometheusRankedPlayer {
    const totals = playerData.totals;
    const averages = playerData.averages;
    
    // Estimate age (we'll use 26 as default since we don't have roster data)
    const estimatedAge = this.estimateAge(playerData.player_name, totals);
    
    // Calculate basic metrics
    const yardsPerTarget = totals.targets > 0 ? totals.receiving_yards / totals.targets : 0;
    const catchRate = totals.targets > 0 ? (totals.receptions / totals.targets * 100) : 0;
    
    // Calculate dynasty component scores
    const productionScore = this.calculateProductionScore(totals, position);
    const opportunityScore = this.calculateOpportunityScore(totals, averages, position);
    const ageScore = this.calculateAgeScore(estimatedAge);
    const efficiencyScore = this.calculateEfficiencyScore(totals, position);
    const stabilityScore = this.calculateStabilityScore(totals, playerData.weeks);
    
    // Jake Maraia inspired weighted dynasty score
    const dynastyScore = Math.round(
      (productionScore * 0.30) +    // Fantasy production
      (opportunityScore * 0.35) +   // Volume/opportunity (most predictive)
      (ageScore * 0.20) +          // Dynasty longevity
      (efficiencyScore * 0.10) +   // Advanced efficiency
      (stabilityScore * 0.05)      // Consistency
    );
    
    const player: PrometheusRankedPlayer = {
      playerId: playerData.player_id,
      name: playerData.player_name,
      position: position as any,
      team: playerData.recent_team,
      
      games: totals.games,
      targets: totals.targets,
      receptions: totals.receptions,
      receivingYards: totals.receiving_yards,
      receivingTds: totals.receiving_tds,
      rushingYards: totals.rushing_yards || 0,
      rushingTds: totals.rushing_tds || 0,
      passingYards: totals.passing_yards || 0,
      passingTds: totals.passing_tds || 0,
      attempts: totals.attempts || 0,
      
      targetShare: averages.target_share * 100 || 0,
      airYardsShare: averages.air_yards_share * 100 || 0,
      wopr: averages.wopr || 0,
      yardsPerTarget,
      catchRate,
      fantasyPointsPPR: totals.fantasy_points_ppr,
      
      productionScore,
      opportunityScore,
      ageScore,
      efficiencyScore,
      stabilityScore,
      
      dynastyScore: Math.max(0, Math.min(100, dynastyScore)),
      prometheusRank: 0,
      tier: this.assignTier(dynastyScore),
      
      strengths: this.identifyStrengths(totals, averages, estimatedAge, position),
      concerns: this.identifyConcerns(totals, averages, estimatedAge, position),
      trend: this.calculateTrend(estimatedAge, totals),
      confidence: this.calculateConfidence(totals, playerData.weeks)
    };
    
    return player;
  }
  
  private estimateAge(playerName: string, totals: any): number {
    // Simple age estimation based on performance patterns
    const fpprPerGame = totals.fantasy_points_ppr / Math.max(1, totals.games);
    
    // Veterans typically have consistent high production
    if (fpprPerGame > 15) return 28;
    if (fpprPerGame > 10) return 25;
    return 24; // Young players with lower production
  }
  
  private calculateProductionScore(totals: any, position: string): number {
    const games = Math.max(1, totals.games);
    const fpprPerGame = totals.fantasy_points_ppr / games;
    
    if (position === 'QB') {
      const passYardsPerGame = totals.passing_yards / games;
      const passTdsPerGame = totals.passing_tds / games;
      const rushYardsPerGame = totals.rushing_yards / games;
      
      const score = Math.min(100,
        (passYardsPerGame / 275 * 50) +
        (passTdsPerGame / 2 * 30) +
        (rushYardsPerGame / 25 * 20)
      );
      return Math.round(score);
    }
    
    // For all skill positions, use fantasy points as primary metric
    const eliteFPPR = position === 'RB' ? 18 : position === 'WR' ? 16 : 12;
    const score = Math.min(100, (fpprPerGame / eliteFPPR) * 100);
    
    return Math.round(score);
  }
  
  private calculateOpportunityScore(totals: any, averages: any, position: string): number {
    if (position === 'QB') {
      const games = Math.max(1, totals.games);
      const attemptsPerGame = totals.attempts / games;
      return Math.round(Math.min(100, (attemptsPerGame / 35) * 100));
    }
    
    if (position === 'RB') {
      const games = Math.max(1, totals.games);
      const targetsPerGame = totals.targets / games;
      const carriesPerGame = totals.carries / games;
      const touchesPerGame = targetsPerGame + carriesPerGame;
      return Math.round(Math.min(100, (touchesPerGame / 20) * 100));
    }
    
    // WR/TE - target share is most predictive
    const targetShare = averages.target_share * 100;
    const games = Math.max(1, totals.games);
    const targetsPerGame = totals.targets / games;
    
    const eliteTargetShare = position === 'WR' ? 25 : 20;
    const eliteTargetsPerGame = position === 'WR' ? 10 : 7;
    
    const score = Math.min(100,
      (targetShare / eliteTargetShare * 60) +
      (targetsPerGame / eliteTargetsPerGame * 40)
    );
    
    return Math.round(score);
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
  
  private calculateEfficiencyScore(totals: any, position: string): number {
    if (position === 'QB') return 75; // Simplified
    
    if (position === 'RB') {
      const yardsPerCarry = totals.carries > 0 ? totals.rushing_yards / totals.carries : 0;
      const yardsPerTarget = totals.targets > 0 ? totals.receiving_yards / totals.targets : 0;
      
      const score = Math.min(100,
        (yardsPerCarry / 4.8 * 60) +
        (yardsPerTarget / 8.0 * 40)
      );
      return Math.round(score);
    }
    
    // WR/TE
    const yardsPerTarget = totals.targets > 0 ? totals.receiving_yards / totals.targets : 0;
    const catchRate = totals.targets > 0 ? (totals.receptions / totals.targets * 100) : 0;
    
    const eliteYPT = position === 'WR' ? 9.0 : 8.5;
    const eliteCatchRate = position === 'WR' ? 65 : 70;
    
    const score = Math.min(100,
      (yardsPerTarget / eliteYPT * 50) +
      (catchRate / eliteCatchRate * 50)
    );
    
    return Math.round(score);
  }
  
  private calculateStabilityScore(totals: any, weeks: any[]): number {
    const gamesPct = totals.games / 17;
    const consistencyScore = weeks.length > 5 ? 80 : 60;
    
    if (gamesPct >= 0.9) return Math.max(85, consistencyScore);
    if (gamesPct >= 0.7) return Math.max(70, consistencyScore);
    if (gamesPct >= 0.5) return Math.max(55, consistencyScore);
    return 40;
  }
  
  private assignTier(score: number): PrometheusRankedPlayer['tier'] {
    if (score >= 90) return 'Elite';
    if (score >= 75) return 'Premium';
    if (score >= 60) return 'Strong';
    if (score >= 45) return 'Solid';
    if (score >= 30) return 'Depth';
    return 'Bench';
  }
  
  private identifyStrengths(totals: any, averages: any, age: number, position: string): string[] {
    const strengths: string[] = [];
    
    if (age <= 24) strengths.push('Elite youth');
    
    const games = Math.max(1, totals.games);
    const targetShare = averages.target_share * 100;
    const fpprPerGame = totals.fantasy_points_ppr / games;
    
    if (position !== 'QB' && targetShare >= 20) {
      strengths.push('High target share');
    }
    
    if (totals.targets > 0) {
      const yardsPerTarget = totals.receiving_yards / totals.targets;
      const catchRate = (totals.receptions / totals.targets * 100);
      
      if (yardsPerTarget >= 8.5) strengths.push('Elite efficiency');
      if (catchRate >= 70) strengths.push('Reliable hands');
    }
    
    if (fpprPerGame >= 15) strengths.push('Elite production');
    
    return strengths.slice(0, 3);
  }
  
  private identifyConcerns(totals: any, averages: any, age: number, position: string): string[] {
    const concerns: string[] = [];
    
    if (age >= 30) concerns.push('Age decline risk');
    
    const targetShare = averages.target_share * 100;
    
    if (position !== 'QB' && targetShare < 10) {
      concerns.push('Limited opportunity');
    }
    
    if (totals.targets > 30) {
      const catchRate = (totals.receptions / totals.targets * 100);
      const yardsPerTarget = totals.receiving_yards / totals.targets;
      
      if (catchRate < 60) concerns.push('Drop issues');
      if (yardsPerTarget < 7.0) concerns.push('Low efficiency');
    }
    
    if (totals.games < 12) concerns.push('Injury concerns');
    
    return concerns.slice(0, 3);
  }
  
  private calculateTrend(age: number, totals: any): PrometheusRankedPlayer['trend'] {
    const games = Math.max(1, totals.games);
    const fpprPerGame = totals.fantasy_points_ppr / games;
    
    if (age <= 25 && fpprPerGame > 10) return 'Rising';
    if (age <= 28 && fpprPerGame > 12) return 'Stable';
    return 'Declining';
  }
  
  private calculateConfidence(totals: any, weeks: any[]): number {
    let confidence = 50;
    
    if (totals.games >= 15) confidence += 20;
    else if (totals.games >= 10) confidence += 10;
    
    if (totals.targets >= 80) confidence += 15;
    else if (totals.targets >= 40) confidence += 10;
    
    if (weeks.length > 10) confidence += 15;
    
    return Math.min(100, confidence);
  }
}

export const prometheusCompleteNFL = new PrometheusCompleteNFL();