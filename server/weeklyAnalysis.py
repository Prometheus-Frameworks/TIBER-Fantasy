#!/usr/bin/env python3
"""
Enhanced Weekly Fantasy Analysis
Filter by player_id, sum fantasy points per week, count threshold hits
"""

import nfl_data_py as nfl
import pandas as pd
import json
import sys

def calculate_spike_weeks(player_id, position, threshold_multiplier=1.5):
    """
    Calculate spike weeks for a specific player using weekly fantasy data
    
    Args:
        player_id: NFL player ID 
        position: Player position (QB, RB, WR, TE)
        threshold_multiplier: Multiplier for spike week threshold (default 1.5x season average)
    
    Returns:
        Dict with spike week analysis
    """
    try:
        # Import 2024 weekly data
        weekly_df = nfl.import_weekly_data([2024])
        
        # Filter by specific player
        player_weeks = weekly_df[weekly_df['player_id'] == player_id].copy()
        
        if player_weeks.empty:
            return {"error": f"No data found for player_id: {player_id}"}
        
        # Use NFL-Data-Py's built-in PPR fantasy points calculation
        if 'fantasy_points_ppr' in player_weeks.columns:
            player_weeks['fantasy_points'] = player_weeks['fantasy_points_ppr'].fillna(0)
        else:
            # Fallback calculation if not available
            player_weeks['fantasy_points'] = (
                player_weeks.get('passing_yards', 0).fillna(0) * 0.04 +
                player_weeks.get('passing_tds', 0).fillna(0) * 4 +
                player_weeks.get('rushing_yards', 0).fillna(0) * 0.1 +
                player_weeks.get('rushing_tds', 0).fillna(0) * 6 +
                player_weeks.get('receiving_yards', 0).fillna(0) * 0.1 +
                player_weeks.get('receiving_tds', 0).fillna(0) * 6 +
                player_weeks.get('receptions', 0).fillna(0) * 1 +
                player_weeks.get('interceptions', 0).fillna(0) * -2
            )
        
        # Clean data - remove weeks with missing/null fantasy points
        player_weeks = player_weeks.dropna(subset=['fantasy_points'])
        
        if len(player_weeks) == 0:
            return {"error": f"No valid fantasy data for player_id: {player_id}"}
        
        # Calculate season averages and spike threshold
        season_avg = player_weeks['fantasy_points'].mean()
        spike_threshold = season_avg * threshold_multiplier
        
        # Count spike weeks (games above threshold)
        spike_weeks = player_weeks[player_weeks['fantasy_points'] >= spike_threshold]
        spike_count = len(spike_weeks)
        spike_percentage = (spike_count / len(player_weeks)) * 100
        
        # Weekly breakdown with game context
        weekly_breakdown = []
        for _, week in player_weeks.iterrows():
            is_spike = week['fantasy_points'] >= spike_threshold
            weekly_breakdown.append({
                "week": int(week['week']),
                "opponent": str(week['opponent_team']) if pd.notna(week['opponent_team']) else "Unknown",
                "fantasy_points": round(float(week['fantasy_points']), 1),
                "is_spike_week": bool(is_spike),
                "threshold_met": round(float(week['fantasy_points'] - spike_threshold), 1) if is_spike else None
            })
        
        # Position-specific context metrics
        context_metrics = {}
        if position in ['WR', 'TE']:
            context_metrics = {
                "targets_per_game": round(float(player_weeks['targets'].mean() if 'targets' in player_weeks.columns else 0), 1),
                "target_share": round(float(player_weeks['target_share'].mean() if 'target_share' in player_weeks.columns else 0), 3),
                "air_yards_share": round(float(player_weeks['air_yards_share'].mean() if 'air_yards_share' in player_weeks.columns else 0), 3),
                "wopr": round(float(player_weeks['wopr'].mean() if 'wopr' in player_weeks.columns else 0), 3)
            }
        elif position == 'RB':
            context_metrics = {
                "carries_per_game": round(float(player_weeks['carries'].mean() if 'carries' in player_weeks.columns else 0), 1),
                "yards_per_carry": round(float((player_weeks['rushing_yards'].sum() / player_weeks['carries'].sum()) if player_weeks['carries'].sum() > 0 else 0), 1),
                "target_share": round(float(player_weeks['target_share'].mean() if 'target_share' in player_weeks.columns else 0), 3)
            }
        elif position == 'QB':
            context_metrics = {
                "passing_yards_per_game": round(float(player_weeks['passing_yards'].mean() if 'passing_yards' in player_weeks.columns else 0), 1),
                "rushing_yards_per_game": round(float(player_weeks['rushing_yards'].mean() if 'rushing_yards' in player_weeks.columns else 0), 1),
                "total_tds_per_game": round(float((player_weeks['passing_tds'] + player_weeks['rushing_tds']).mean()), 1)
            }
        
        return {
            "player_id": player_id,
            "position": position,
            "games_played": len(player_weeks),
            "season_average": round(season_avg, 1),
            "spike_threshold": round(spike_threshold, 1),
            "spike_weeks_count": spike_count,
            "spike_percentage": round(spike_percentage, 1),
            "weekly_breakdown": weekly_breakdown,
            "context_metrics": context_metrics,
            "threshold_multiplier": threshold_multiplier
        }
        
    except Exception as e:
        return {"error": f"Analysis failed: {str(e)}"}

def analyze_elite_benchmarks():
    """
    Analyze spike weeks for our Prometheus Benchmark Cluster
    Using correct player IDs from NFL-Data-Py
    """
    # Dynamic player ID lookup from 2024 data
    weekly_df = nfl.import_weekly_data([2024])
    
    elite_players = []
    
    # Get exact player IDs from 2024 weekly data
    chase = weekly_df[(weekly_df['player_display_name'] == "Ja'Marr Chase") & (weekly_df['position'] == 'WR')]
    barkley = weekly_df[(weekly_df['player_display_name'] == 'Saquon Barkley') & (weekly_df['position'] == 'RB')]
    lamar = weekly_df[(weekly_df['player_display_name'] == 'Lamar Jackson') & (weekly_df['position'] == 'QB')]
    allen = weekly_df[(weekly_df['player_display_name'] == 'Josh Allen') & (weekly_df['position'] == 'QB')]
    
    elite_players = []
    
    if not chase.empty:
        elite_players.append({"name": "Ja'Marr Chase", "position": "WR", "player_id": chase['player_id'].iloc[0]})
    if not barkley.empty:
        elite_players.append({"name": "Saquon Barkley", "position": "RB", "player_id": barkley['player_id'].iloc[0]})
    if not lamar.empty:
        elite_players.append({"name": "Lamar Jackson", "position": "QB", "player_id": lamar['player_id'].iloc[0]})
    if not allen.empty:
        elite_players.append({"name": "Josh Allen", "position": "QB", "player_id": allen['player_id'].iloc[0]})
    
    results = {}
    for player in elite_players:
        analysis = calculate_spike_weeks(player["player_id"], player["position"])
        results[player["name"]] = analysis
    
    return results

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Single player analysis
        player_id = sys.argv[1]
        position = sys.argv[2] if len(sys.argv) > 2 else "WR"
        result = calculate_spike_weeks(player_id, position)
        print(json.dumps(result, indent=2))
    else:
        # Elite benchmark analysis
        results = analyze_elite_benchmarks()
        print(json.dumps(results, indent=2))