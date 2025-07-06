#!/usr/bin/env python3
"""
Prometheus NFL Data Fetcher
Collects current 2024 NFL data for dynasty rankings
"""

import nfl_data_py as nfl
import pandas as pd
import json
import sys

def fetch_nfl_data():
    try:
        # Get 2024 weekly data
        print("Fetching 2024 weekly data...", file=sys.stderr)
        weekly = nfl.import_weekly_data([2024])
        
        # Get 2024 NGS receiving data
        print("Fetching 2024 NGS receiving data...", file=sys.stderr)
        ngs_receiving = nfl.import_ngs_data('receiving', [2024])
        
        # Get seasonal rosters for age data
        print("Fetching 2024 roster data...", file=sys.stderr)
        rosters = nfl.import_seasonal_rosters([2024])
        
        # Aggregate player stats by position
        positions = {}
        
        for pos in ['QB', 'RB', 'WR', 'TE']:
            print(f"Processing {pos} players...", file=sys.stderr)
            
            # Filter weekly data by position
            pos_data = weekly[weekly['position'] == pos].copy()
            
            if pos_data.empty:
                positions[pos] = []
                continue
                
            # Aggregate season stats
            season_stats = pos_data.groupby(['player_id', 'player_name', 'recent_team']).agg({
                'targets': 'sum',
                'receptions': 'sum', 
                'receiving_yards': 'sum',
                'receiving_tds': 'sum',
                'rushing_yards': 'sum',
                'rushing_tds': 'sum',
                'passing_yards': 'sum',
                'passing_tds': 'sum',
                'week': 'count'  # games played
            }).reset_index()
            
            season_stats.rename(columns={'week': 'games'}, inplace=True)
            
            # Merge with NGS data
            ngs_pos = ngs_receiving[ngs_receiving['player_position'] == pos]
            if not ngs_pos.empty:
                season_stats = season_stats.merge(
                    ngs_pos[['player_gsis_id', 'avg_separation', 'avg_yac', 'avg_yac_above_expectation', 'catch_percentage']],
                    left_on='player_id',
                    right_on='player_gsis_id',
                    how='left'
                )
            
            # Add age from rosters
            if not rosters.empty:
                roster_data = rosters[rosters['position'] == pos][['player_id', 'age']].drop_duplicates()
                season_stats = season_stats.merge(roster_data, on='player_id', how='left')
            
            # Filter minimum thresholds
            if pos in ['WR', 'TE']:
                season_stats = season_stats[season_stats['targets'] >= 20]  # Min 20 targets
            elif pos == 'RB':
                season_stats = season_stats[
                    (season_stats['targets'] >= 10) | (season_stats['rushing_yards'] >= 100)
                ]
            elif pos == 'QB':
                season_stats = season_stats[season_stats['passing_yards'] >= 500]  # Min 500 pass yards
                
            # Calculate derived metrics
            season_stats['catch_rate'] = (season_stats['receptions'] / season_stats['targets'] * 100).fillna(0)
            season_stats['yards_per_target'] = (season_stats['receiving_yards'] / season_stats['targets']).fillna(0)
            
            # Convert to records
            positions[pos] = season_stats.to_dict('records')
            print(f"Found {len(positions[pos])} {pos} players", file=sys.stderr)
        
        # Output JSON result
        print(json.dumps(positions))
        
    except Exception as e:
        print(f'{{"error": "{str(e)}"}}')

if __name__ == "__main__":
    fetch_nfl_data()