/**
 * Prometheus NFL Data Integration
 * Complete integration of NFL-Data-Py with Prometheus Dynasty Rankings
 */

import { spawn } from 'child_process';

export interface PrometheusNFLPlayer {
  playerId: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  
  // 2024 Production Stats
  games: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  rushingYards: number;
  rushingTds: number;
  passingYards?: number;
  passingTds?: number;
  
  // Advanced Metrics
  targetShare: number;
  airYardsShare: number;
  yardsPerTarget: number;
  yardsPerRoute?: number;
  catchRate: number;
  wopr?: number; // Weighted Opportunity Rating
  
  // Dynasty Component Scores
  productionScore: number;
  opportunityScore: number;
  ageScore: number;
  efficiencyScore: number;
  stabilityScore: number;
  
  // Final Dynasty Rating
  dynastyScore: number;
  prometheusRank: number;
  tier: 'Elite' | 'Premium' | 'Strong' | 'Solid' | 'Depth' | 'Bench';
  
  // Analysis
  strengths: string[];
  concerns: string[];
  dynastyTrend: 'Rising' | 'Stable' | 'Declining';
  confidence: number; // Data quality score 0-100
}

class PrometheusNFLIntegration {
  
  /**
   * Generate complete dynasty rankings using authentic 2024 NFL data
   */
  async generateCompleteRankings(): Promise<Record<string, PrometheusNFLPlayer[]>> {
    console.log('🚀 Generating Complete NFL Prometheus Rankings...');
    
    try {
      // Fetch all required NFL data in parallel
      const [weeklyData, rosterData, ngsData] = await Promise.all([
        this.fetchWeeklyStats(),
        this.fetchRosterData(), 
        this.fetchNGSData()
      ]);
      
      console.log(`📊 Data loaded: ${weeklyData.length} weekly records, ${rosterData.length} roster players`);
      
      // Process each position
      const rankings = {
        QB: await this.processPosition(weeklyData, rosterData, ngsData, 'QB'),
        RB: await this.processPosition(weeklyData, rosterData, ngsData, 'RB'),
        WR: await this.processPosition(weeklyData, rosterData, ngsData, 'WR'),
        TE: await this.processPosition(weeklyData, rosterData, ngsData, 'TE')
      };
      
      console.log('✅ Complete NFL Prometheus Rankings Generated');
      
      // Log summary
      Object.entries(rankings).forEach(([pos, players]) => {
        console.log(`${pos}: ${players.length} players ranked`);
      });
      
      return rankings;
      
    } catch (error) {
      console.error('Error generating complete NFL rankings:', error);
      throw error;
    }
  }
  
  /**
   * Fetch 2024 weekly statistics from NFL-Data-Py
   */
  private async fetchWeeklyStats(): Promise<any[]> {
    const pythonScript = `
import nfl_data_py as nfl
import json
import sys

try:
    # Get 2024 weekly data for skill positions
    weekly = nfl.import_weekly_data([2024], columns=[
        'player_id', 'player_name', 'position', 'recent_team', 'week',
        'targets', 'receptions', 'receiving_yards', 'receiving_tds',
        'carries', 'rushing_yards', 'rushing_tds',
        'passing_yards', 'passing_tds', 'attempts',
        'target_share', 'air_yards_share', 'wopr', 'racr',
        'fantasy_points', 'fantasy_points_ppr'
    ])
    
    # Filter to skill positions only
    skill_positions = ['QB', 'RB', 'WR', 'TE']
    weekly = weekly[weekly['position'].isin(skill_positions)]
    
    # Convert to records
    result = weekly.to_dict('records')
    print(json.dumps(result, default=str))
    
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    return this.executePython(pythonScript);
  }
  
  /**
   * Fetch 2024 roster data
   */
  private async fetchRosterData(): Promise<any[]> {
    const pythonScript = `
import nfl_data_py as nfl
import json
import sys

try:
    # Get 2024 roster data
    roster = nfl.import_seasonal_rosters([2024])
    
    # Filter to skill positions
    skill_positions = ['QB', 'RB', 'WR', 'TE']
    roster = roster[roster['position'].isin(skill_positions)]
    
    result = roster.to_dict('records')
    print(json.dumps(result, default=str))
    
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    return this.executePython(pythonScript);
  }
  
  /**
   * Fetch Next Gen Stats data if available
   */
  private async fetchNGSData(): Promise<any[]> {
    const pythonScript = `
import nfl_data_py as nfl
import json
import sys

try:
    # Try to get NGS receiving data for 2024
    ngs_receiving = nfl.import_ngs_data('receiving', [2024])
    
    # Select relevant columns
    if not ngs_receiving.empty:
        ngs_data = ngs_receiving[[
            'player_id', 'avg_yards_per_route_run', 'avg_separation'
        ]].to_dict('records')
    else:
        ngs_data = []
    
    print(json.dumps(ngs_data, default=str))
    
except Exception as e:
    # NGS data might not be available, return empty
    print(json.dumps([]))
`;

    return this.executePython(pythonScript);
  }
  
  /**
   * Execute Python script and return parsed results
   */
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
  
  /**
   * Process players for specific position
   */
  private async processPosition(
    weeklyData: any[], 
    rosterData: any[], 
    ngsData: any[], 
    position: string
  ): Promise<PrometheusNFLPlayer[]> {
    
    // Filter data for this position
    const positionWeekly = weeklyData.filter(p => p.position === position);
    const positionRoster = rosterData.filter(p => p.position === position);
    
    // Group weekly data by player
    const playerStats = new Map();
    
    positionWeekly.forEach(week => {
      const playerId = week.player_id;
      
      if (!playerStats.has(playerId)) {
        playerStats.set(playerId, {
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
      
      const player = playerStats.get(playerId);
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
    
    // Calculate averages for percentage stats
    playerStats.forEach(player => {
      const validWeeks = player.weeks.filter((w: any) => 
        w.target_share !== null && w.target_share !== undefined
      );
      
      if (validWeeks.length > 0) {
        player.averages.target_share = validWeeks.reduce((sum: number, w: any) => sum + (w.target_share || 0), 0) / validWeeks.length;
        player.averages.air_yards_share = validWeeks.reduce((sum: number, w: any) => sum + (w.air_yards_share || 0), 0) / validWeeks.length;
        player.averages.wopr = validWeeks.reduce((sum: number, w: any) => sum + (w.wopr || 0), 0) / validWeeks.length;
      }
    });
    
    // Convert to Prometheus players and calculate dynasty scores
    const prometheusPlayers: PrometheusNFLPlayer[] = [];
    
    playerStats.forEach(playerData => {
      // Find roster info for age
      const rosterInfo = positionRoster.find(r => r.player_id === playerData.player_id);
      const age = this.calculateAge(rosterInfo);
      
      // Skip players with insufficient data
      if (playerData.totals.games < 4) return;
      
      // Find NGS data
      const ngsInfo = ngsData.find(n => n.player_id === playerData.player_id);
      
      const prometheusPlayer = this.createPrometheusPlayer(playerData, age, ngsInfo, position);
      prometheusPlayers.push(prometheusPlayer);
    });
    
    // Sort by dynasty score and assign ranks
    prometheusPlayers.sort((a, b) => b.dynastyScore - a.dynastyScore);
    prometheusPlayers.forEach((player, index) => {
      player.prometheusRank = index + 1;
    });
    
    return prometheusPlayers.slice(0, 100); // Top 100 per position
  }
  
  /**
   * Create Prometheus player from NFL data
   */
  private createPrometheusPlayer(
    playerData: any, 
    age: number, 
    ngsInfo: any, 
    position: string
  ): PrometheusNFLPlayer {
    
    const totals = playerData.totals;
    const averages = playerData.averages;
    
    // Calculate basic metrics
    const catchRate = totals.targets > 0 ? (totals.receptions / totals.targets * 100) : 0;
    const yardsPerTarget = totals.targets > 0 ? (totals.receiving_yards / totals.targets) : 0;
    
    // Calculate component scores using research-backed methodology
    const productionScore = this.calculateProductionScore(totals, position);
    const opportunityScore = this.calculateOpportunityScore(totals, averages, position);
    const ageScore = this.calculateAgeScore(age);
    const efficiencyScore = this.calculateEfficiencyScore(totals, ngsInfo, position);
    const stabilityScore = this.calculateStabilityScore(totals, playerData.weeks);
    
    // Jake Maraia inspired weighted dynasty score
    const dynastyScore = Math.round(
      (productionScore * 0.30) +    // Current fantasy production
      (opportunityScore * 0.35) +   // Volume/opportunity (most predictive)
      (ageScore * 0.20) +          // Dynasty longevity
      (efficiencyScore * 0.10) +   // Advanced efficiency metrics
      (stabilityScore * 0.05)      // Consistency/availability
    );
    
    const player: PrometheusNFLPlayer = {
      playerId: playerData.player_id,
      name: playerData.player_name,
      position: position as any,
      team: playerData.recent_team,
      age,
      
      games: totals.games,
      targets: totals.targets,
      receptions: totals.receptions,
      receivingYards: totals.receiving_yards,
      receivingTds: totals.receiving_tds,
      rushingYards: totals.rushing_yards || 0,
      rushingTds: totals.rushing_tds || 0,
      passingYards: totals.passing_yards,
      passingTds: totals.passing_tds,
      
      targetShare: averages.target_share * 100,
      airYardsShare: averages.air_yards_share * 100,
      yardsPerTarget,
      yardsPerRoute: ngsInfo?.avg_yards_per_route_run,
      catchRate,
      wopr: averages.wopr,
      
      productionScore,
      opportunityScore,
      ageScore,
      efficiencyScore,
      stabilityScore,
      
      dynastyScore: Math.max(0, Math.min(100, dynastyScore)),
      prometheusRank: 0,
      tier: this.assignTier(dynastyScore),
      
      strengths: this.identifyStrengths(totals, averages, ngsInfo, age, position),
      concerns: this.identifyConcerns(totals, averages, age, position),
      dynastyTrend: this.calculateTrend(age, totals),
      confidence: this.calculateConfidence(totals, playerData.weeks, ngsInfo)
    };
    
    return player;
  }
  
  /**
   * Calculate age from roster data or estimate
   */
  private calculateAge(rosterInfo: any): number {
    if (rosterInfo?.age && rosterInfo.age > 18 && rosterInfo.age < 45) {
      return rosterInfo.age;
    }
    
    // Estimate age from years of experience
    if (rosterInfo?.years_exp) {
      return 22 + rosterInfo.years_exp;
    }
    
    return 26; // League average
  }
  
  /**
   * Calculate production score based on fantasy output
   */
  private calculateProductionScore(totals: any, position: string): number {
    const games = Math.max(1, totals.games);
    
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
    
    if (position === 'RB') {
      const rushYardsPerGame = totals.rushing_yards / games;
      const recYardsPerGame = totals.receiving_yards / games;
      const totalTdsPerGame = (totals.rushing_tds + totals.receiving_tds) / games;
      
      const score = Math.min(100,
        (rushYardsPerGame / 80 * 50) +
        (recYardsPerGame / 25 * 30) +
        (totalTdsPerGame / 0.8 * 20)
      );
      return Math.round(score);
    }
    
    // WR/TE
    const recYardsPerGame = totals.receiving_yards / games;
    const receptionsPerGame = totals.receptions / games;
    const recTdsPerGame = totals.receiving_tds / games;
    
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
   * Calculate opportunity score (most predictive metric)
   */
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
  
  /**
   * Calculate age score for dynasty value
   */
  private calculateAgeScore(age: number): number {
    if (age <= 22) return 100;
    if (age <= 24) return 90;
    if (age <= 26) return 80;
    if (age <= 28) return 70;
    if (age <= 30) return 55;
    if (age <= 32) return 35;
    return 15;
  }
  
  /**
   * Calculate efficiency score from advanced metrics
   */
  private calculateEfficiencyScore(totals: any, ngsInfo: any, position: string): number {
    if (position === 'QB') return 75; // Simplified for now
    
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
    const yardsPerRoute = ngsInfo?.avg_yards_per_route_run || 0;
    
    const eliteYPT = position === 'WR' ? 9.0 : 8.5;
    const eliteCatchRate = position === 'WR' ? 65 : 70;
    const eliteYPRR = position === 'WR' ? 2.0 : 1.8;
    
    const score = Math.min(100,
      (yardsPerTarget / eliteYPT * 40) +
      (catchRate / eliteCatchRate * 30) +
      (yardsPerRoute / eliteYPRR * 30)
    );
    
    return Math.round(score);
  }
  
  /**
   * Calculate stability score
   */
  private calculateStabilityScore(totals: any, weeks: any[]): number {
    const gamesPct = totals.games / 17;
    const consistencyScore = weeks.length > 5 ? 80 : 60; // Simplified
    
    if (gamesPct >= 0.9) return Math.max(85, consistencyScore);
    if (gamesPct >= 0.7) return Math.max(70, consistencyScore);
    if (gamesPct >= 0.5) return Math.max(55, consistencyScore);
    return 40;
  }
  
  /**
   * Assign dynasty tier
   */
  private assignTier(score: number): PrometheusNFLPlayer['tier'] {
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
  private identifyStrengths(totals: any, averages: any, ngsInfo: any, age: number, position: string): string[] {
    const strengths: string[] = [];
    
    if (age <= 24) strengths.push('Elite youth');
    
    const games = Math.max(1, totals.games);
    const targetShare = averages.target_share * 100;
    
    if (position !== 'QB' && targetShare >= 20) {
      strengths.push('High target share');
    }
    
    if (totals.targets > 0) {
      const yardsPerTarget = totals.receiving_yards / totals.targets;
      const catchRate = (totals.receptions / totals.targets * 100);
      
      if (yardsPerTarget >= 8.5) strengths.push('Elite efficiency');
      if (catchRate >= 70) strengths.push('Reliable hands');
    }
    
    if (ngsInfo?.avg_yards_per_route_run >= 2.0) {
      strengths.push('Route running');
    }
    
    const fpprPerGame = totals.fantasy_points_ppr / games;
    if (fpprPerGame >= 15) strengths.push('Elite production');
    
    return strengths.slice(0, 3);
  }
  
  /**
   * Identify player concerns
   */
  private identifyConcerns(totals: any, averages: any, age: number, position: string): string[] {
    const concerns: string[] = [];
    
    if (age >= 30) concerns.push('Age decline risk');
    
    const games = Math.max(1, totals.games);
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
  
  /**
   * Calculate dynasty trend
   */
  private calculateTrend(age: number, totals: any): PrometheusNFLPlayer['dynastyTrend'] {
    const games = Math.max(1, totals.games);
    const fpprPerGame = totals.fantasy_points_ppr / games;
    
    if (age <= 25 && fpprPerGame > 10) return 'Rising';
    if (age <= 28 && fpprPerGame > 12) return 'Stable';
    return 'Declining';
  }
  
  /**
   * Calculate confidence in ranking
   */
  private calculateConfidence(totals: any, weeks: any[], ngsInfo: any): number {
    let confidence = 50;
    
    // Sample size
    if (totals.games >= 15) confidence += 20;
    else if (totals.games >= 10) confidence += 10;
    
    // Target volume  
    if (totals.targets >= 80) confidence += 15;
    else if (totals.targets >= 40) confidence += 10;
    
    // Advanced metrics available
    if (ngsInfo) confidence += 10;
    
    // Consistency
    if (weeks.length > 10) confidence += 5;
    
    return Math.min(100, confidence);
  }
}

export const prometheusNFLIntegration = new PrometheusNFLIntegration();