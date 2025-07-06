/**
 * NFL-Data-Py Integration
 * Free, authentic NFL data including advanced metrics like YPRR
 * Uses official NFL statistics via the nfl-data-py Python package
 */

import { spawn } from 'child_process';
import * as path from 'path';

export interface NFLPlayerAdvanced {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  season: number;
  week?: number;
  
  // Receiving Advanced Metrics
  yards_per_route_run?: number;
  target_share?: number;
  air_yards_share?: number;
  wopr?: number; // Weighted Opportunity Rating
  racr?: number; // Receiver Air Conversion Ratio
  targets?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  
  // Rushing Advanced Metrics
  yards_after_contact?: number;
  yards_before_contact?: number;
  breakaway_yards?: number;
  rushing_yards_over_expected?: number;
  
  // QB Advanced Metrics  
  epa_per_play?: number;
  completion_percentage_over_expected?: number;
  air_yards_per_attempt?: number;
  time_to_throw?: number;
  
  // Fantasy Points
  fantasy_points?: number;
  fantasy_points_ppr?: number;
}

export interface NFLRosterData {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  status: string;
  age?: number;
  years_exp?: number;
}

class NFLDataPyAPI {
  private pythonScriptPath = path.join(process.cwd(), 'server', 'nfl_data_fetcher.py');

  /**
   * Execute Python script to fetch NFL data
   */
  private async executePythonScript(scriptContent: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', ['-c', scriptContent]);
      
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
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error}`));
          }
        } else {
          reject(new Error(`Python script failed: ${stderr}`));
        }
      });
      
      python.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Get current NFL roster data
   */
  async getCurrentRoster(): Promise<NFLRosterData[]> {
    const pythonScript = `
import nfl_data_py as nfl
import json
import sys

try:
    # Get current roster data
    roster = nfl.import_rosters([2024])
    
    # Convert to list of dictionaries
    roster_data = []
    for _, row in roster.iterrows():
        player_data = {
            'player_id': str(row.get('player_id', '')),
            'player_name': str(row.get('player_name', '')),
            'position': str(row.get('position', '')),
            'team': str(row.get('team', '')),
            'status': str(row.get('status', 'Active')),
            'age': int(row.get('age', 0)) if row.get('age') else None,
            'years_exp': int(row.get('years_exp', 0)) if row.get('years_exp') else None
        }
        roster_data.append(player_data)
    
    print(json.dumps(roster_data))
    
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    try {
      const result = await this.executePythonScript(pythonScript);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching NFL roster:', error);
      return [];
    }
  }

  /**
   * Get advanced receiving stats including YPRR
   */
  async getAdvancedReceivingStats(season: number = 2024): Promise<NFLPlayerAdvanced[]> {
    const pythonScript = `
import nfl_data_py as nfl
import pandas as pd
import json
import sys

try:
    # Get weekly receiving data for the season
    weekly_data = nfl.import_weekly_data([${season}], columns=[
        'player_id', 'player_name', 'position', 'recent_team', 
        'targets', 'receptions', 'receiving_yards', 'receiving_tds',
        'target_share', 'air_yards_share', 'wopr', 'racr',
        'fantasy_points', 'fantasy_points_ppr'
    ])
    
    # Get route data for YPRR calculation
    try:
        # This might not be available for all seasons
        routes_data = nfl.import_ngs_data('receiving', [${season}])
        if not routes_data.empty:
            weekly_data = weekly_data.merge(
                routes_data[['player_id', 'avg_yards_per_route_run']],
                on='player_id',
                how='left'
            )
            weekly_data['yards_per_route_run'] = weekly_data['avg_yards_per_route_run']
    except:
        # Calculate estimated YPRR from available data
        weekly_data['yards_per_route_run'] = None
    
    # Filter to skill positions and aggregate season totals
    skill_positions = ['WR', 'TE', 'RB']
    receiving_data = weekly_data[weekly_data['position'].isin(skill_positions)]
    
    # Group by player and sum stats
    season_stats = receiving_data.groupby(['player_id', 'player_name', 'position']).agg({
        'recent_team': 'last',
        'targets': 'sum',
        'receptions': 'sum', 
        'receiving_yards': 'sum',
        'receiving_tds': 'sum',
        'target_share': 'mean',
        'air_yards_share': 'mean',
        'wopr': 'mean',
        'racr': 'mean',
        'yards_per_route_run': 'mean',
        'fantasy_points': 'sum',
        'fantasy_points_ppr': 'sum'
    }).reset_index()
    
    # Convert to list of dictionaries
    result_data = []
    for _, row in season_stats.iterrows():
        player_data = {
            'player_id': str(row['player_id']),
            'player_name': str(row['player_name']),
            'position': str(row['position']),
            'team': str(row['recent_team']),
            'season': ${season},
            'targets': int(row['targets']) if pd.notna(row['targets']) else 0,
            'receptions': int(row['receptions']) if pd.notna(row['receptions']) else 0,
            'receiving_yards': int(row['receiving_yards']) if pd.notna(row['receiving_yards']) else 0,
            'receiving_tds': int(row['receiving_tds']) if pd.notna(row['receiving_tds']) else 0,
            'target_share': float(row['target_share']) if pd.notna(row['target_share']) else None,
            'air_yards_share': float(row['air_yards_share']) if pd.notna(row['air_yards_share']) else None,
            'wopr': float(row['wopr']) if pd.notna(row['wopr']) else None,
            'racr': float(row['racr']) if pd.notna(row['racr']) else None,
            'yards_per_route_run': float(row['yards_per_route_run']) if pd.notna(row['yards_per_route_run']) else None,
            'fantasy_points': float(row['fantasy_points']) if pd.notna(row['fantasy_points']) else 0,
            'fantasy_points_ppr': float(row['fantasy_points_ppr']) if pd.notna(row['fantasy_points_ppr']) else 0
        }
        result_data.append(player_data)
    
    print(json.dumps(result_data))
    
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    try {
      const result = await this.executePythonScript(pythonScript);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching advanced receiving stats:', error);
      return [];
    }
  }

  /**
   * Get specific player's advanced metrics
   */
  async getPlayerAdvancedMetrics(playerName: string, season: number = 2024): Promise<NFLPlayerAdvanced | null> {
    try {
      const allPlayers = await this.getAdvancedReceivingStats(season);
      const player = allPlayers.find(p => 
        p.player_name.toLowerCase().includes(playerName.toLowerCase())
      );
      return player || null;
    } catch (error) {
      console.error(`Error fetching metrics for ${playerName}:`, error);
      return null;
    }
  }

  /**
   * Get Puka Nacua's 2024 YPRR specifically
   */
  async getPukaNacuaYPRR(): Promise<{ yprr: number | null; fullStats: NFLPlayerAdvanced | null }> {
    try {
      const pukaStats = await this.getPlayerAdvancedMetrics('Puka Nacua', 2024);
      return {
        yprr: pukaStats?.yards_per_route_run || null,
        fullStats: pukaStats
      };
    } catch (error) {
      console.error('Error fetching Puka Nacua YPRR:', error);
      return { yprr: null, fullStats: null };
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string; available: boolean }> {
    try {
      const testScript = `
import nfl_data_py as nfl
import json

try:
    # Test by getting a small sample of roster data
    roster = nfl.import_rosters([2024])
    player_count = len(roster)
    print(json.dumps({'success': True, 'player_count': player_count}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`;

      const result = await this.executePythonScript(testScript);
      
      if (result.success) {
        return {
          success: true,
          message: `NFL-Data-Py connected successfully. ${result.player_count} players available.`,
          available: true
        };
      } else {
        return {
          success: false,
          message: `NFL-Data-Py error: ${result.error}`,
          available: false
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        available: false
      };
    }
  }
}

export const nflDataPyAPI = new NFLDataPyAPI();