import { spawn } from 'child_process';

export interface QBAdvancedStats {
  playerName: string;
  team: string;
  passingAttempts: number;
  completions: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptions: number;
  completionPercentage: number;
  yardsPerAttempt: number;
  rushingYards: number;
  rushingTouchdowns: number;
  fantasyPoints: number;
}

export class QBAdvancedStatsService {
  async getQBAdvancedStats(): Promise<QBAdvancedStats[]> {
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
    
    # Filter for QB position only
    qb_data = weekly_df[weekly_df['position'] == 'QB'].copy()
    
    if qb_data.empty:
        print(json.dumps([]))
        sys.exit(0)
    
    # Group by player and calculate season totals/averages
    qb_stats = qb_data.groupby(['player_id', 'player_name', 'recent_team']).agg({
        'attempts': 'sum',
        'completions': 'sum',
        'passing_yards': 'sum',
        'passing_tds': 'sum',
        'interceptions': 'sum',
        'rushing_yards': 'sum',
        'rushing_tds': 'sum',
        'fantasy_points_ppr': 'sum'
    }).reset_index()
    
    # Calculate advanced metrics with safe division
    qb_stats['completion_percentage'] = qb_stats.apply(lambda row: 
        round((row['completions'] / row['attempts']) * 100, 2) if row['attempts'] > 0 else 0, 
        axis=1)
    
    qb_stats['yards_per_attempt'] = qb_stats.apply(lambda row: 
        round(row['passing_yards'] / row['attempts'], 2) if row['attempts'] > 0 else 0, 
        axis=1)
    
    # Filter for fantasy relevant players only (minimum 10 attempts for the season)
    qb_stats = qb_stats[qb_stats['attempts'] >= 10]
    
    # Sort by fantasy points descending
    qb_stats = qb_stats.sort_values('fantasy_points_ppr', ascending=False)
    
    # Convert to output format
    output_data = []
    for _, row in qb_stats.iterrows():
        player_data = {
            'playerName': str(row['player_name']),
            'team': str(row['recent_team']),
            'passingAttempts': int(row['attempts']) if pd.notna(row['attempts']) else 0,
            'completions': int(row['completions']) if pd.notna(row['completions']) else 0,
            'passingYards': int(row['passing_yards']) if pd.notna(row['passing_yards']) else 0,
            'passingTouchdowns': int(row['passing_tds']) if pd.notna(row['passing_tds']) else 0,
            'interceptions': int(row['interceptions']) if pd.notna(row['interceptions']) else 0,
            'completionPercentage': float(row['completion_percentage']) if pd.notna(row['completion_percentage']) else 0.0,
            'yardsPerAttempt': float(row['yards_per_attempt']) if pd.notna(row['yards_per_attempt']) else 0.0,
            'rushingYards': int(row['rushing_yards']) if pd.notna(row['rushing_yards']) else 0,
            'rushingTouchdowns': int(row['rushing_tds']) if pd.notna(row['rushing_tds']) else 0,
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

          const qbStats = JSON.parse(jsonLine);
          console.log(`✅ Successfully fetched ${qbStats.length} QB advanced stats from NFL API`);
          resolve(qbStats);
        } catch (error) {
          console.error('❌ Error parsing Python output:', error);
          reject(new Error(`JSON parsing error: ${error}`));
        }
      });
    });
  }
}

export const qbAdvancedStatsService = new QBAdvancedStatsService();