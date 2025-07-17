import { spawn } from 'child_process';

export interface RBAdvancedStats {
  playerName: string;
  team: string;
  rushingAttempts: number;
  rushingYards: number;
  yardsPerCarry: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  yardsPerReception: number;
  targetShare: number | 'NA';
  totalTouchdowns: number;
  snapPercentage: 'NA'; // Not available in NFL-Data-Py
}

export class RBAdvancedStatsService {
  async getRBAdvancedStats(): Promise<RBAdvancedStats[]> {
    const pythonScript = `
import nfl_data_py as nfl
import pandas as pd
import json
import sys
import warnings
import os
import io

# Suppress all warnings and NFL-Data-Py output
warnings.filterwarnings('ignore')
os.environ['PYTHONWARNINGS'] = 'ignore'

try:
    # Capture all stdout to prevent "Downcasting floats" from corrupting JSON
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    
    # Import 2024 weekly data for comprehensive stats
    weekly_df = nfl.import_weekly_data([2024])
    
    # Restore stdout
    sys.stdout = old_stdout
    
    # Filter for RB position only
    rb_data = weekly_df[weekly_df['position'] == 'RB'].copy()
    
    if rb_data.empty:
        print(json.dumps([]))
        sys.exit(0)
    
    # Group by player and calculate season totals/averages
    rb_stats = rb_data.groupby(['player_id', 'player_name', 'recent_team']).agg({
        'carries': 'sum',
        'rushing_yards': 'sum',
        'rushing_tds': 'sum',
        'targets': 'sum',
        'receptions': 'sum',
        'receiving_yards': 'sum',
        'receiving_tds': 'sum',
        'target_share': 'mean'
    }).reset_index()
    
    # Calculate advanced metrics with safe division
    rb_stats['target_share'] = rb_stats['target_share'].fillna(0)
    
    # Calculate Yards Per Carry (YPC)
    rb_stats['yards_per_carry'] = rb_stats.apply(lambda row: 
        round(row['rushing_yards'] / row['carries'], 2) if row['carries'] > 0 else 0, 
        axis=1)
    
    # Calculate Yards Per Reception (YPR)
    rb_stats['yards_per_reception'] = rb_stats.apply(lambda row: 
        round(row['receiving_yards'] / row['receptions'], 2) if row['receptions'] > 0 else 0, 
        axis=1)
    
    # Calculate Total Touchdowns
    rb_stats['total_touchdowns'] = rb_stats['rushing_tds'] + rb_stats['receiving_tds']
    
    # Filter for fantasy relevant players only (minimum 10 touches for the season)
    rb_stats['total_touches'] = rb_stats['carries'] + rb_stats['targets']
    rb_stats = rb_stats[rb_stats['total_touches'] >= 10]
    
    # Sort by total fantasy points (rushing + receiving yards + TDs)
    rb_stats['fantasy_points'] = rb_stats['rushing_yards'] + rb_stats['receiving_yards'] + (rb_stats['total_touchdowns'] * 6)
    rb_stats = rb_stats.sort_values('fantasy_points', ascending=False)
    
    # Convert to output format
    output_data = []
    for _, row in rb_stats.iterrows():
        player_data = {
            'playerName': str(row['player_name']),
            'team': str(row['recent_team']),
            'rushingAttempts': int(row['carries']) if pd.notna(row['carries']) else 0,
            'rushingYards': int(row['rushing_yards']) if pd.notna(row['rushing_yards']) else 0,
            'yardsPerCarry': float(row['yards_per_carry']) if pd.notna(row['yards_per_carry']) else 0.0,
            'targets': int(row['targets']) if pd.notna(row['targets']) else 0,
            'receptions': int(row['receptions']) if pd.notna(row['receptions']) else 0,
            'receivingYards': int(row['receiving_yards']) if pd.notna(row['receiving_yards']) else 0,
            'yardsPerReception': float(row['yards_per_reception']) if pd.notna(row['yards_per_reception']) else 0.0,
            'targetShare': round(float(row['target_share']), 3) if row['target_share'] > 0 else 'NA',
            'totalTouchdowns': int(row['total_touchdowns']) if pd.notna(row['total_touchdowns']) else 0,
            'snapPercentage': 'NA'  # Not available in NFL-Data-Py
        }
        output_data.append(player_data)
    
    # Return ALL players (no limits or caps)
    print(json.dumps(output_data))
    
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['-c', pythonScript]);
      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          console.error('❌ Python script error:', errorOutput);
          reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
          return;
        }

        try {
          // Filter out non-JSON lines from output
          const lines = output.split('\n').filter(line => line.trim());
          const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));
          
          if (!jsonLine) {
            console.error('❌ No JSON output found from Python script');
            reject(new Error('No JSON output from Python script'));
            return;
          }

          const rbStats = JSON.parse(jsonLine);
          console.log(`✅ Successfully fetched ${rbStats.length} RB advanced stats from NFL API`);
          resolve(rbStats);
        } catch (error) {
          console.error('❌ Error parsing Python output:', error);
          reject(new Error(`JSON parsing error: ${error}`));
        }
      });
    });
  }
}

export const rbAdvancedStatsService = new RBAdvancedStatsService();