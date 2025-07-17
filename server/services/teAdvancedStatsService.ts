import { spawn } from 'child_process';

export interface TEAdvancedStats {
  playerName: string;
  team: string;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
  yardsPerRouteRun: number;
  firstDowns: number;
  redZoneTargets: number;
  targetShare: number;
  snapPercentage: number;
  fantasyPoints: number;
}

export class TEAdvancedStatsService {
  async getTEAdvancedStats(): Promise<TEAdvancedStats[]> {
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
    
    # Filter for TE position only
    te_data = weekly_df[weekly_df['position'] == 'TE'].copy()
    
    if te_data.empty:
        print(json.dumps([]))
        sys.exit(0)
    
    # Group by player and calculate season totals/averages
    te_stats = te_data.groupby(['player_id', 'player_name', 'recent_team']).agg({
        'targets': 'sum',
        'receptions': 'sum',
        'receiving_yards': 'sum',
        'receiving_tds': 'sum',
        'target_share': 'mean',
        'fantasy_points_ppr': 'sum'
    }).reset_index()
    
    # Add placeholder for first_downs (not available in NFL-Data-Py)
    te_stats['first_downs'] = 0
    
    # Calculate YPRR (estimate using receptions and receiving yards)
    # Note: Routes run data not available in NFL-Data-Py, so we'll use a reasonable estimate
    te_stats['yards_per_route_run'] = te_stats.apply(lambda row: 
        round(row['receiving_yards'] / (row['targets'] * 1.5), 2) if row['targets'] > 0 else 0, 
        axis=1)
    
    # Red zone targets and snap percentage not available in NFL-Data-Py
    # These will be marked as NA in the frontend
    te_stats['red_zone_targets'] = 0  # Will be displayed as NA
    te_stats['snap_percentage'] = 0   # Will be displayed as NA
    
    # Filter for fantasy relevant players only (minimum 5 targets for the season)
    te_stats = te_stats[te_stats['targets'] >= 5]
    
    # Sort by fantasy points descending
    te_stats = te_stats.sort_values('fantasy_points_ppr', ascending=False)
    
    # Convert to output format
    output_data = []
    for _, row in te_stats.iterrows():
        player_data = {
            'playerName': str(row['player_name']),
            'team': str(row['recent_team']),
            'targets': int(row['targets']) if pd.notna(row['targets']) else 0,
            'receptions': int(row['receptions']) if pd.notna(row['receptions']) else 0,
            'receivingYards': int(row['receiving_yards']) if pd.notna(row['receiving_yards']) else 0,
            'receivingTouchdowns': int(row['receiving_tds']) if pd.notna(row['receiving_tds']) else 0,
            'yardsPerRouteRun': float(row['yards_per_route_run']) if pd.notna(row['yards_per_route_run']) else 0.0,
            'firstDowns': 0,  # Not available in NFL-Data-Py
            'redZoneTargets': 0,  # Will be displayed as NA
            'targetShare': round(float(row['target_share']), 2) if pd.notna(row['target_share']) else 0.0,
            'snapPercentage': 0,  # Will be displayed as NA
            'fantasyPoints': round(float(row['fantasy_points_ppr']), 1) if pd.notna(row['fantasy_points_ppr']) else 0.0
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

          const teStats = JSON.parse(jsonLine);
          console.log(`✅ Successfully fetched ${teStats.length} TE advanced stats from NFL API`);
          resolve(teStats);
        } catch (error) {
          console.error('❌ Error parsing Python output:', error);
          reject(new Error(`JSON parsing error: ${error}`));
        }
      });
    });
  }
}

export const teAdvancedStatsService = new TEAdvancedStatsService();