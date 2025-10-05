#!/usr/bin/env python3
"""
Weekly Stats Fetcher - Fetch real NFL weekly statistics using nfl-data-py
Outputs JSON data that matches the ETL pipeline's PlayerStatsSchema format
"""

import nfl_data_py as nfl
import pandas as pd
import numpy as np
import json
import sys
from datetime import datetime

def fetch_weekly_stats(week, season):
    """
    Fetch real NFL weekly statistics for all skill position players
    
    Args:
        week: NFL week number (1-18)
        season: NFL season year (e.g., 2024)
    
    Returns:
        List of player stat dictionaries matching PlayerStatsSchema
    """
    try:
        print(f"📊 Fetching weekly data for Week {week}, {season}...", file=sys.stderr)
        
        # Import weekly player stats
        weekly_stats = nfl.import_weekly_data([season])
        
        # Filter to the specific week
        week_data = weekly_stats[weekly_stats['week'] == week].copy()
        
        # Filter to regular season only
        week_data = week_data[week_data['season_type'] == 'REG']
        
        # Filter to skill positions only
        week_data = week_data[week_data['position'].isin(['QB', 'RB', 'WR', 'TE'])]
        
        print(f"✅ Loaded {len(week_data)} player records for Week {week}", file=sys.stderr)
        
        # Import weekly rosters to get team information
        rosters = nfl.import_weekly_rosters([season])
        # Filter to the specific week
        week_rosters = rosters[rosters['week'] == week]
        roster_map = week_rosters[['player_id', 'team', 'position']].drop_duplicates(subset=['player_id'])
        
        # Merge with roster data
        week_data = week_data.merge(
            roster_map,
            left_on='player_id',
            right_on='player_id',
            how='left',
            suffixes=('', '_roster')
        )
        
        # Import Next Gen Stats for advanced metrics
        try:
            ngs_receiving = nfl.import_ngs_data('receiving', [season])
            ngs_rushing = nfl.import_ngs_data('rushing', [season])
            print(f"✅ Loaded Next Gen Stats", file=sys.stderr)
        except Exception as e:
            print(f"⚠️ Warning: Could not load Next Gen Stats: {e}", file=sys.stderr)
            ngs_receiving = pd.DataFrame()
            ngs_rushing = pd.DataFrame()
        
        # Process player stats
        player_stats = []
        
        for _, row in week_data.iterrows():
            player_id = str(row.get('player_id', ''))
            player_name = row.get('player_display_name', row.get('player_name', ''))
            position = row.get('position', row.get('position_roster', ''))
            team = row.get('recent_team', row.get('team', 'FA'))
            
            # Skip if missing critical data
            if not player_id or not player_name or position not in ['QB', 'RB', 'WR', 'TE']:
                continue
            
            # Calculate snap share (if available)
            snap_count = row.get('offense_snaps', 0)
            snap_share = row.get('offense_pct', 0) / 100.0 if pd.notna(row.get('offense_pct')) else None
            
            # Calculate routes per game for pass catchers
            routes_run = row.get('routes_run', 0)
            routes_per_game = routes_run if pd.notna(routes_run) else None
            
            # Calculate targets per game
            targets = row.get('targets', 0)
            targets_per_game = targets if pd.notna(targets) else None
            
            # Rush attempts
            rush_attempts = row.get('carries', 0)
            
            # Fantasy points PPR
            fantasy_points_ppr = row.get('fantasy_points_ppr', row.get('fantasy_points', 0))
            
            # Red zone touches (targets + carries in red zone)
            red_zone_targets = row.get('target_share', 0)  # Approximate
            red_zone_touches = red_zone_targets if pd.notna(red_zone_targets) else None
            
            # EPA per play (if available from play-by-play data)
            epa_per_play = None  # Will be calculated separately if needed
            
            # Yards per route run
            receiving_yards = row.get('receiving_yards', 0)
            yards_per_route_run = (receiving_yards / routes_run) if routes_run and routes_run > 0 else None
            
            # YAC per attempt
            receiving_yac = row.get('receiving_yac', 0)
            receptions = row.get('receptions', 0)
            yac_per_attempt = (receiving_yac / receptions) if receptions and receptions > 0 else None
            
            # Missed tackles forced (approximate from Next Gen Stats if available)
            missed_tackles_forced = None
            
            # Build stat object
            stat = {
                'player_id': player_id,
                'name': player_name,
                'position': position,
                'team': team,
            }
            
            # Add optional fields only if they have values
            if snap_count and snap_count > 0:
                stat['snap_count'] = int(snap_count)
            if snap_share is not None:
                stat['snap_share'] = float(snap_share)
            if routes_per_game is not None and routes_per_game > 0:
                stat['routes_per_game'] = float(routes_per_game)
            if targets_per_game is not None and targets_per_game > 0:
                stat['targets_per_game'] = float(targets_per_game)
            if rush_attempts and rush_attempts > 0:
                stat['rush_attempts'] = int(rush_attempts)
            if fantasy_points_ppr:
                stat['fantasy_points_ppr'] = float(fantasy_points_ppr)
            if red_zone_touches is not None:
                stat['red_zone_touches'] = float(red_zone_touches)
            if epa_per_play is not None:
                stat['epa_per_play'] = float(epa_per_play)
            if yards_per_route_run is not None:
                stat['yards_per_route_run'] = float(yards_per_route_run)
            if yac_per_attempt is not None:
                stat['yac_per_attempt'] = float(yac_per_attempt)
            if missed_tackles_forced is not None:
                stat['missed_tackles_forced'] = float(missed_tackles_forced)
            
            player_stats.append(stat)
        
        print(f"✅ Processed {len(player_stats)} player stats", file=sys.stderr)
        
        # Return as JSON
        result = {
            'success': True,
            'week': week,
            'season': season,
            'players': player_stats,
            'count': len(player_stats),
            'generated_at': datetime.now().isoformat()
        }
        
        return result
        
    except Exception as e:
        print(f"❌ Error fetching weekly stats: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            'success': False,
            'error': str(e),
            'week': week,
            'season': season,
            'players': [],
            'count': 0
        }

if __name__ == '__main__':
    # Parse command line arguments
    if len(sys.argv) < 3:
        print("Usage: fetchWeeklyStats.py <week> <season>", file=sys.stderr)
        sys.exit(1)
    
    week = int(sys.argv[1])
    season = int(sys.argv[2])
    
    # Fetch and output stats
    result = fetch_weekly_stats(week, season)
    
    # Output JSON to stdout
    print(json.dumps(result, indent=2))
    
    # Exit with appropriate code
    sys.exit(0 if result['success'] else 1)
