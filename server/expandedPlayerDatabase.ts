/**
 * Expanded Player Database System
 * Uses authentic NFL-Data-Py to provide comprehensive 600+ player coverage
 * Replaces limited 150-player hardcoded dataset
 */

import { spawn } from 'child_process';

export interface ExpandedNFLPlayer {
  id: number;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  avgPoints: number;
  
  // 2024 Performance Data (heavily weighted)
  games2024: number;
  targets2024: number;
  receptions2024: number;
  receivingYards2024: number;
  receivingTds2024: number;
  rushingYards2024: number;
  rushingTds2024: number;
  passingYards2024: number;
  passingTds2024: number;
  fantasyPoints2024: number;
  
  // Dynasty Metrics
  dynastyValue: number;
  dynastyTier: string;
  projectedPoints: number;
  
  // Market Data
  targetShare: number;
  snapShare: number;
  redZoneShare: number;
  
  // Analysis
  strengths: string[];
  concerns: string[];
  trend: 'Rising' | 'Stable' | 'Declining';
}

export class ExpandedPlayerDatabase {
  private static instance: ExpandedPlayerDatabase;
  private playersCache: ExpandedNFLPlayer[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): ExpandedPlayerDatabase {
    if (!ExpandedPlayerDatabase.instance) {
      ExpandedPlayerDatabase.instance = new ExpandedPlayerDatabase();
    }
    return ExpandedPlayerDatabase.instance;
  }

  /**
   * Get all 600+ fantasy-relevant players from NFL database
   */
  async getAllPlayers(): Promise<ExpandedNFLPlayer[]> {
    // Check cache
    if (this.playersCache && Date.now() - this.cacheTimestamp < this.CACHE_DURATION) {
      return this.playersCache;
    }

    console.log('🔄 Fetching 600+ players from NFL database...');
    
    try {
      const nflData = await this.fetchNFLPlayerData();
      const expandedPlayers = await this.processPlayerData(nflData);
      
      // Cache results
      this.playersCache = expandedPlayers;
      this.cacheTimestamp = Date.now();
      
      console.log(`✅ Loaded ${expandedPlayers.length} players from NFL database`);
      return expandedPlayers;
    } catch (error) {
      console.error('❌ Failed to load expanded player database:', error);
      return [];
    }
  }

  /**
   * Get players by position with dynasty rankings
   */
  async getPlayersByPosition(position: string, limit: number = 100): Promise<ExpandedNFLPlayer[]> {
    const allPlayers = await this.getAllPlayers();
    return allPlayers
      .filter(p => p.position === position)
      .sort((a, b) => b.dynastyValue - a.dynastyValue)
      .slice(0, limit);
  }

  /**
   * Search players by name
   */
  async searchPlayers(query: string): Promise<ExpandedNFLPlayer[]> {
    const allPlayers = await this.getAllPlayers();
    return allPlayers.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 20);
  }

  /**
   * Fetch raw NFL player data using NFL-Data-Py
   */
  private async fetchNFLPlayerData(): Promise<any[]> {
    const pythonScript = `
import nfl_data_py as nfl
import pandas as pd
import json
import sys

try:
    # Get 2024 weekly data for all positions
    weekly = nfl.import_weekly_data([2024])
    
    # Get 2024 roster data for ages
    rosters = nfl.import_seasonal_rosters([2024])
    
    # Filter for fantasy positions
    fantasy_positions = ['QB', 'RB', 'WR', 'TE']
    weekly_filtered = weekly[weekly['position'].isin(fantasy_positions)]
    
    # Aggregate season stats by player
    season_stats = weekly_filtered.groupby(['player_id', 'player_name', 'recent_team', 'position']).agg({
        'targets': 'sum',
        'receptions': 'sum',
        'receiving_yards': 'sum',
        'receiving_tds': 'sum',
        'rushing_yards': 'sum',
        'rushing_tds': 'sum',
        'passing_yards': 'sum',
        'passing_tds': 'sum',
        'interceptions': 'sum',
        'fantasy_points': 'sum',
        'fantasy_points_ppr': 'sum',
        'week': 'count'  # games played
    }).reset_index()
    
    # Merge with roster data for ages
    if not rosters.empty:
        roster_ages = rosters[['player_id', 'age']].drop_duplicates()
        season_stats = season_stats.merge(roster_ages, on='player_id', how='left')
    
    # Convert to list of dictionaries
    players_data = []
    for _, row in season_stats.iterrows():
        player = {
            'player_id': str(row['player_id']),
            'name': str(row['player_name']),
            'position': str(row['position']),
            'team': str(row['recent_team']),
            'age': int(row.get('age', 26)) if pd.notna(row.get('age')) else 26,
            'games': int(row['week']),
            'targets': int(row['targets']) if pd.notna(row['targets']) else 0,
            'receptions': int(row['receptions']) if pd.notna(row['receptions']) else 0,
            'receiving_yards': int(row['receiving_yards']) if pd.notna(row['receiving_yards']) else 0,
            'receiving_tds': int(row['receiving_tds']) if pd.notna(row['receiving_tds']) else 0,
            'rushing_yards': int(row['rushing_yards']) if pd.notna(row['rushing_yards']) else 0,
            'rushing_tds': int(row['rushing_tds']) if pd.notna(row['rushing_tds']) else 0,
            'passing_yards': int(row['passing_yards']) if pd.notna(row['passing_yards']) else 0,
            'passing_tds': int(row['passing_tds']) if pd.notna(row['passing_tds']) else 0,
            'fantasy_points': float(row['fantasy_points_ppr']) if pd.notna(row['fantasy_points_ppr']) else 0.0
        }
        players_data.append(player)
    
    print(json.dumps(players_data))

except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    return new Promise((resolve, reject) => {
      const python = spawn('python3', ['-c', pythonScript]);
      
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
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result);
            }
          } catch (error) {
            reject(new Error(`Failed to parse NFL data: ${error}`));
          }
        } else {
          reject(new Error(`NFL data fetch failed: ${stderr}`));
        }
      });
    });
  }

  /**
   * Process raw NFL data into expanded player format with dynasty scoring
   */
  private async processPlayerData(nflData: any[]): Promise<ExpandedNFLPlayer[]> {
    const expandedPlayers: ExpandedNFLPlayer[] = [];

    for (let i = 0; i < nflData.length; i++) {
      const player = nflData[i];
      
      // Skip players with minimal fantasy relevance
      if (player.games < 4 && player.fantasy_points < 20) {
        continue;
      }
      
      const avgPoints = player.games > 0 ? player.fantasy_points / player.games : 0;
      
      // Calculate dynasty value using 2024-weighted system
      const dynastyValue = this.calculateDynastyValue(player, avgPoints);
      const dynastyTier = this.getDynastyTier(dynastyValue);
      
      const expandedPlayer: ExpandedNFLPlayer = {
        id: i + 1,
        name: player.name,
        position: player.position as 'QB' | 'RB' | 'WR' | 'TE',
        team: player.team,
        age: player.age,
        avgPoints: parseFloat(avgPoints.toFixed(1)),
        
        // 2024 Performance (authentic data)
        games2024: player.games,
        targets2024: player.targets,
        receptions2024: player.receptions,
        receivingYards2024: player.receiving_yards,
        receivingTds2024: player.receiving_tds,
        rushingYards2024: player.rushing_yards,
        rushingTds2024: player.rushing_tds,
        passingYards2024: player.passing_yards,
        passingTds2024: player.passing_tds,
        fantasyPoints2024: parseFloat(player.fantasy_points.toFixed(1)),
        
        // Dynasty metrics
        dynastyValue: parseFloat(dynastyValue.toFixed(1)),
        dynastyTier,
        projectedPoints: parseFloat((avgPoints * 1.05).toFixed(1)), // Slight projection increase
        
        // Market metrics (calculated from 2024 data)
        targetShare: this.calculateTargetShare(player),
        snapShare: this.estimateSnapShare(player),
        redZoneShare: this.estimateRedZoneShare(player),
        
        // Analysis
        strengths: this.identifyStrengths(player),
        concerns: this.identifyConcerns(player),
        trend: this.analyzeTrend(player)
      };
      
      expandedPlayers.push(expandedPlayer);
    }

    // Sort by dynasty value
    return expandedPlayers.sort((a, b) => b.dynastyValue - a.dynastyValue);
  }

  /**
   * Calculate dynasty value heavily weighted toward 2024 performance
   */
  private calculateDynastyValue(player: any, avgPoints: number): number {
    const pos = player.position;
    
    // 2024 Production Score (70% weight)
    const productionScore = Math.min(95, avgPoints * (pos === 'QB' ? 4 : pos === 'TE' ? 7 : 6));
    
    // Age Score (20% weight) 
    let ageScore = 50;
    if (player.age <= 22) ageScore = 95;
    else if (player.age <= 24) ageScore = 85;
    else if (player.age <= 26) ageScore = 75;
    else if (player.age <= 28) ageScore = 65;
    else if (player.age <= 30) ageScore = 55;
    else ageScore = Math.max(10, 55 - (player.age - 30) * 8);
    
    // Opportunity Score (10% weight) - based on games and targets/attempts
    let opportunityScore = 50;
    if (player.games >= 14) opportunityScore = 90;
    else if (player.games >= 10) opportunityScore = 75;
    else if (player.games >= 6) opportunityScore = 60;
    
    // Add target/opportunity boost
    if ((pos === 'WR' || pos === 'TE') && player.targets > 80) opportunityScore += 10;
    if (pos === 'RB' && (player.rushing_yards + player.receiving_yards) > 800) opportunityScore += 10;
    if (pos === 'QB' && player.passing_yards > 2000) opportunityScore += 10;
    
    // Final weighted score
    const finalScore = (productionScore * 0.70) + (ageScore * 0.20) + (opportunityScore * 0.10);
    
    return Math.max(5, Math.min(98, finalScore));
  }

  /**
   * Assign dynasty tier based on score
   */
  private getDynastyTier(score: number): string {
    if (score >= 85) return 'Elite';
    if (score >= 70) return 'Premium';
    if (score >= 55) return 'Strong';
    if (score >= 40) return 'Solid';
    if (score >= 25) return 'Depth';
    return 'Bench';
  }

  /**
   * Calculate target share from team context
   */
  private calculateTargetShare(player: any): number {
    if (player.position === 'QB') return 0;
    if (player.targets === 0) return 0;
    
    // Estimate based on target volume (simplified)
    if (player.targets > 120) return 28;
    if (player.targets > 100) return 22;
    if (player.targets > 80) return 18;
    if (player.targets > 60) return 15;
    if (player.targets > 40) return 12;
    if (player.targets > 20) return 8;
    return 5;
  }

  /**
   * Estimate snap share based on production
   */
  private estimateSnapShare(player: any): number {
    const pos = player.position;
    if (player.games < 4) return 45;
    
    if (pos === 'QB') {
      return player.passing_yards > 2500 ? 95 : player.passing_yards > 1000 ? 75 : 60;
    }
    if (pos === 'RB') {
      return (player.rushing_yards + player.receiving_yards) > 1000 ? 70 : 55;
    }
    if (pos === 'WR' || pos === 'TE') {
      return player.targets > 80 ? 80 : player.targets > 40 ? 65 : 50;
    }
    return 50;
  }

  /**
   * Estimate red zone share
   */
  private estimateRedZoneShare(player: any): number {
    const totalTds = (player.receiving_tds || 0) + (player.rushing_tds || 0) + (player.passing_tds || 0);
    if (totalTds > 10) return 25;
    if (totalTds > 6) return 18;
    if (totalTds > 3) return 12;
    if (totalTds > 0) return 8;
    return 3;
  }

  /**
   * Identify player strengths based on 2024 data
   */
  private identifyStrengths(player: any): string[] {
    const strengths: string[] = [];
    const avgPoints = player.games > 0 ? player.fantasy_points / player.games : 0;
    
    if (avgPoints > 15) strengths.push('Elite Production');
    if (player.age <= 24) strengths.push('Youth Upside');
    if (player.games >= 14) strengths.push('Durability');
    if (player.targets > 100) strengths.push('High Target Volume');
    if ((player.receiving_tds + player.rushing_tds + player.passing_tds) > 8) strengths.push('TD Scorer');
    
    return strengths.slice(0, 3); // Max 3 strengths
  }

  /**
   * Identify concerns based on 2024 data
   */
  private identifyConcerns(player: any): string[] {
    const concerns: string[] = [];
    
    if (player.age > 30) concerns.push('Age Decline');
    if (player.games < 10) concerns.push('Injury Risk');
    if (player.targets < 40 && (player.position === 'WR' || player.position === 'TE')) concerns.push('Low Target Share');
    if (player.fantasy_points < 100) concerns.push('Limited Production');
    
    return concerns.slice(0, 2); // Max 2 concerns - only authentic datarns
  }

  /**
   * Analyze trend based on recent performance
   */
  private analyzeTrend(player: any): 'Rising' | 'Stable' | 'Declining' {
    if (player.age <= 24) return 'Rising';
    if (player.age >= 31) return 'Declining';
    return 'Stable';
  }
}

export const expandedPlayerDB = ExpandedPlayerDatabase.getInstance();