#!/usr/bin/env python3
"""
NFL Analytics using nfl_data_py for advanced separation and route data
"""

import nfl_data_py as nfl
import pandas as pd
import json
import sys

def analyze_player(player_name, season=2024):
    """
    Analyze a player using comprehensive NFL data including separation metrics
    """
    try:
        # Get Next Gen Stats (includes separation data)
        print(f"Fetching Next Gen Stats for {season}...", file=sys.stderr)
        ngs_receiving = nfl.import_ngs_data('receiving', [season])
        
        # Get play-by-play data for detailed analysis
        print(f"Fetching play-by-play data for {season}...", file=sys.stderr)
        pbp_data = nfl.import_pbp_data([season])
        
        # Get weekly data for season progression
        print(f"Fetching weekly data for {season}...", file=sys.stderr)
        weekly_data = nfl.import_weekly_data([season])
        
        # Filter for our player
        player_ngs = ngs_receiving[ngs_receiving['player_display_name'].str.contains(player_name, case=False, na=False)]
        player_weekly = weekly_data[weekly_data['player_display_name'].str.contains(player_name, case=False, na=False)]
        
        if player_ngs.empty:
            return {"error": f"Player {player_name} not found in NGS data"}
        
        # Get player info
        player_info = player_ngs.iloc[0]
        
        # Debug: Check available columns
        print(f"Available columns: {list(player_ngs.columns)}", file=sys.stderr)
        print(f"Player data keys: {player_info.to_dict().keys()}", file=sys.stderr)
        
        # Calculate advanced metrics
        analysis = {
            "player": {
                "name": player_info.get('player_display_name', 'Unknown'),
                "team": player_info.get('team_abbr', 'Unknown'),
                "position": player_info.get('player_position', 'Unknown'),
                "season": season
            },
            "separation_metrics": {
                "avg_separation": float(player_info.get('avg_separation', 0)),
                "avg_cushion": float(player_info.get('avg_cushion', 0)),
                "avg_separation_percentile": calculate_percentile(ngs_receiving, 'avg_separation', player_info.get('avg_separation', 0)),
                "avg_intended_air_yards": float(player_info.get('avg_intended_air_yards', 0)),
                "percent_share_of_intended_air_yards": float(player_info.get('percent_share_of_intended_air_yards', 0))
            },
            "receiving_metrics": {
                "targets": int(player_info.get('targets', 0)),
                "receptions": int(player_info.get('receptions', 0)),
                "receiving_yards": int(player_info.get('yards', 0)),  # Column is 'yards' not 'receiving_yards'
                "receiving_tds": int(player_info.get('rec_touchdowns', 0)),  # Column is 'rec_touchdowns'
                "catch_percentage": float(player_info.get('catch_percentage', 0)),
                "avg_yac": float(player_info.get('avg_yac', 0)),
                "avg_yac_above_expectation": float(player_info.get('avg_yac_above_expectation', 0))
            },
            "efficiency_metrics": {
                "yards_per_target": float(player_info['yards'] / player_info['targets']) if player_info.get('targets', 0) > 0 else 0,
                "yards_per_reception": float(player_info['yards'] / player_info['receptions']) if player_info.get('receptions', 0) > 0 else 0,
                "air_yards_vs_separation": float(player_info.get('avg_intended_air_yards', 0)) - float(player_info.get('avg_separation', 0))
            }
        }
        
        # Add weekly progression if available
        if not player_weekly.empty:
            weekly_stats = []
            for _, week in player_weekly.iterrows():
                weekly_stats.append({
                    "week": int(week.get('week', 0)),
                    "targets": int(week.get('targets', 0)),
                    "receptions": int(week.get('receptions', 0)),
                    "receiving_yards": int(week.get('receiving_yards', 0)),
                    "receiving_tds": int(week.get('receiving_tds', 0)),
                    "target_share": float(week.get('target_share', 0)),
                    "air_yards_share": float(week.get('air_yards_share', 0)),
                    "fantasy_points_ppr": float(week.get('fantasy_points_ppr', 0))
                })
            
            analysis["weekly_progression"] = weekly_stats
            
            # Calculate season trends
            if len(weekly_stats) > 4:  # Need enough data points
                early_season = [w for w in weekly_stats if w['week'] <= 6]
                late_season = [w for w in weekly_stats if w['week'] > 6]
                
                if early_season and late_season:
                    early_avg_targets = sum(w['targets'] for w in early_season) / len(early_season)
                    late_avg_targets = sum(w['targets'] for w in late_season) / len(late_season)
                    
                    analysis["season_trends"] = {
                        "target_trend": "increasing" if late_avg_targets > early_avg_targets else "decreasing",
                        "early_season_avg_targets": round(early_avg_targets, 1),
                        "late_season_avg_targets": round(late_avg_targets, 1),
                        "target_improvement": round(late_avg_targets - early_avg_targets, 1)
                    }
        
        # Get route-specific data from play-by-play
        player_targets = pbp_data[
            (pbp_data['receiver_player_name'].str.contains(player_name, case=False, na=False)) &
            (pbp_data['play_type'] == 'pass')
        ]
        
        if not player_targets.empty:
            route_analysis = {
                "total_routes": len(player_targets),
                "target_rate": len(player_targets[player_targets['receiver_player_name'].notna()]) / len(player_targets) if len(player_targets) > 0 else 0,
                "deep_targets": len(player_targets[player_targets['air_yards'] >= 20]),
                "red_zone_targets": len(player_targets[player_targets['yardline_100'] <= 20]),
                "avg_air_yards": float(player_targets['air_yards'].mean()) if not player_targets['air_yards'].isna().all() else 0,
                "avg_yac": float(player_targets['yards_after_catch'].mean()) if not player_targets['yards_after_catch'].isna().all() else 0
            }
            analysis["route_analysis"] = route_analysis
        
        return analysis
        
    except Exception as e:
        return {"error": f"Error analyzing player: {str(e)}"}

def calculate_percentile(df, column, value):
    """Calculate percentile rank for a value in a column"""
    try:
        if pd.isna(value) or value == 0:
            return 0
        percentile = (df[column] < value).sum() / len(df) * 100
        return round(percentile, 1)
    except:
        return 0

def get_league_leaders(stat='avg_separation', season=2024, min_targets=30):
    """Get league leaders for a specific stat"""
    try:
        ngs_data = nfl.import_ngs_data('receiving', [season])
        qualified = ngs_data[ngs_data['targets'] >= min_targets]
        leaders = qualified.nlargest(10, stat)[['player_display_name', 'team_abbr', stat, 'targets']]
        return leaders.to_dict('records')
    except Exception as e:
        return {"error": f"Error getting leaders: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Player name required"}))
        sys.exit(1)
    
    player_name = sys.argv[1]
    season = int(sys.argv[2]) if len(sys.argv) > 2 else 2024
    
    result = analyze_player(player_name, season)
    print(json.dumps(result, indent=2))