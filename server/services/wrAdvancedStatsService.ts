/**
 * WR Advanced Stats Service
 * Fetches Wide Receiver advanced statistics from NFL stats API
 */
import { spawn } from 'child_process';

export interface WRAdvancedStats {
  playerName: string;
  team: string;
  yardsPerRouteRun: number | 'NA';
  firstDownsPerRouteRun: number | 'NA';
  targetShare: number | 'NA';
  airYardsShare: number | 'NA';
  snapPercentage: number | 'NA';
  routesRun: number | 'NA';
  redZoneTargets: number | 'NA';
  touchdowns: number | 'NA';
  yardsAfterCatch: number | 'NA';
  receivingYards: number | 'NA';
}

export class WRAdvancedStatsService {
  /**
   * Fetch WR Advanced Stats from NFL API
   * Filters for WR position only and returns comprehensive receiving metrics
   */
  async fetchWRAdvancedStats(): Promise<WRAdvancedStats[]> {
    try {
      console.log('📊 Fetching WR Advanced Stats from NFL API...');
      
      // Use NFL-Data-Py to fetch real 2024 season data for all WRs
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
    
    # Filter for WR position only
    wr_data = weekly_df[weekly_df['position'] == 'WR'].copy()
    
    if wr_data.empty:
        print(json.dumps([]))
        sys.exit(0)
    
    # Group by player and calculate season totals/averages
    wr_stats = wr_data.groupby(['player_id', 'player_name', 'recent_team']).agg({
        'targets': 'sum',
        'receptions': 'sum', 
        'receiving_yards': 'sum',
        'receiving_tds': 'sum',
        'target_share': 'mean',
        'air_yards_share': 'mean',
        'receiving_yards_after_catch': 'sum',
        'receiving_first_downs': 'sum',
        'receiving_air_yards': 'sum'
    }).reset_index()
    
    # Calculate advanced metrics with safe division
    wr_stats['target_share'] = wr_stats['target_share'].fillna(0)
    wr_stats['air_yards_share'] = wr_stats['air_yards_share'].fillna(0)
    
    # Estimate routes run from targets and target share
    wr_stats['routes_run'] = wr_stats.apply(lambda row: 
        int(row['targets'] / (row['target_share'] / 100)) if row['target_share'] > 0 else row['targets'] * 2, 
        axis=1)
    
    # Calculate YPRR and other advanced metrics
    wr_stats['yards_per_route_run'] = wr_stats.apply(lambda row: 
        row['receiving_yards'] / row['routes_run'] if row['routes_run'] > 0 else 0, 
        axis=1)
    
    wr_stats['first_downs_per_route_run'] = wr_stats.apply(lambda row: 
        row['receiving_first_downs'] / row['routes_run'] if row['routes_run'] > 0 else 0, 
        axis=1)
    
    # Filter for fantasy relevant players only (minimum 10 targets for the season)
    wr_stats = wr_stats[wr_stats['targets'] >= 10]
    
    # Sort by receiving yards descending
    wr_stats = wr_stats.sort_values('receiving_yards', ascending=False)
    
    # Convert to output format - mapping NFL data fields to our interface
    output_data = []
    for _, row in wr_stats.iterrows():
        # Estimate red zone targets (approximately 15% of total targets)
        red_zone_targets = int(row['targets'] * 0.15) if row['targets'] > 0 else 0
        
        player_data = {
            'playerName': str(row['player_name']),
            'team': str(row['recent_team']),
            'yardsPerRouteRun': round(float(row['yards_per_route_run']), 2) if row['yards_per_route_run'] > 0 else 0,
            'firstDownsPerRouteRun': round(float(row['first_downs_per_route_run']), 3) if row['first_downs_per_route_run'] > 0 else 0,
            'targetShare': round(float(row['target_share']), 1) if row['target_share'] > 0 else 0,
            'airYardsShare': round(float(row['air_yards_share']), 1) if row['air_yards_share'] > 0 else 0,
            'snapPercentage': 0,  # Not available in NFL-Data-Py
            'routesRun': int(row['routes_run']) if row['routes_run'] > 0 else 0,
            'redZoneTargets': red_zone_targets,
            'touchdowns': int(row['receiving_tds']) if pd.notna(row['receiving_tds']) else 0,
            'yardsAfterCatch': int(row['receiving_yards_after_catch']) if pd.notna(row['receiving_yards_after_catch']) else 0,
            'receivingYards': int(row['receiving_yards']) if pd.notna(row['receiving_yards']) else 0
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
            // Filter out non-JSON lines from output (like "Downcasting floats.")
            const lines = output.split('\n').filter(line => line.trim());
            const jsonLine = lines.find(line => {
              try {
                JSON.parse(line);
                return true;
              } catch {
                return false;
              }
            });

            if (!jsonLine) {
              console.error('❌ No valid JSON found in output:', output);
              reject(new Error('No valid JSON found in NFL API response'));
              return;
            }

            const parsedData = JSON.parse(jsonLine);
            
            if (parsedData.error) {
              console.error('❌ NFL API error:', parsedData.error);
              reject(new Error(parsedData.error));
              return;
            }

            console.log(`✅ Successfully fetched ${parsedData.length} WR advanced stats from NFL API`);
            resolve(parsedData);
          } catch (parseError) {
            console.error('❌ JSON parsing error:', parseError);
            console.error('Raw output:', output);
            reject(new Error(`Failed to parse NFL API response: ${parseError}`));
          }
        });
      });

    } catch (error) {
      console.error('❌ WR Advanced Stats fetch error:', error);
      throw new Error(`Failed to fetch WR advanced stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper method to safely parse numeric values
   */
  private parseNumericValue(value: any): number | 'NA' {
    if (value === null || value === undefined || value === '' || isNaN(value)) {
      return 'NA';
    }
    return typeof value === 'number' ? value : parseFloat(value);
  }
}

// Export singleton instance
export const wrAdvancedStatsService = new WRAdvancedStatsService();