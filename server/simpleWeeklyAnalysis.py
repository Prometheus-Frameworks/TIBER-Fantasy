#!/usr/bin/env python3
"""
Simple Weekly Spike Analysis for Prometheus Benchmark Cluster
Filter by player_id, calculate spike weeks using fantasy_points_ppr
"""

import nfl_data_py as nfl
import pandas as pd
import json
import numpy as np
import warnings

# Suppress pandas downcasting warnings
warnings.filterwarnings('ignore', category=pd.errors.PerformanceWarning)
pd.options.mode.chained_assignment = None

def analyze_player_spikes(player_id, player_name, position):
    """Analyze spike weeks for a specific player"""
    try:
        # Import 2024 weekly data
        weekly_df = nfl.import_weekly_data([2024])
        
        # Filter by player
        player_data = weekly_df[weekly_df['player_id'] == player_id].copy()
        
        if player_data.empty:
            return {"error": f"No data for {player_name}"}
        
        # Use built-in fantasy_points_ppr column
        fantasy_points = player_data['fantasy_points_ppr'].dropna()
        
        if len(fantasy_points) == 0:
            return {"error": f"No fantasy points for {player_name}"}
        
        # Calculate metrics
        season_avg = float(fantasy_points.mean())
        spike_threshold = season_avg * 1.5
        spike_weeks = fantasy_points[fantasy_points >= spike_threshold]
        spike_count = len(spike_weeks)
        spike_percentage = (spike_count / len(fantasy_points)) * 100
        
        # Weekly breakdown
        weeks = []
        for _, week in player_data.iterrows():
            if pd.notna(week['fantasy_points_ppr']):
                fp = float(week['fantasy_points_ppr'])
                is_spike = fp >= spike_threshold
                weeks.append({
                    "week": int(week['week']),
                    "fantasy_points": round(fp, 1),
                    "is_spike_week": is_spike,
                    "opponent": str(week.get('opponent_team', 'Unknown'))
                })
        
        # Position-specific context
        context = {}
        if position in ['WR', 'TE'] and 'targets' in player_data.columns:
            target_share = player_data['target_share'].mean()
            wopr = player_data['wopr'].mean()
            context = {
                "targets_per_game": round(float(player_data['targets'].mean()), 1),
                "target_share": round(float(target_share) if pd.notna(target_share) else 0, 3),
                "wopr": round(float(wopr) if pd.notna(wopr) else 0, 3)
            }
        elif position == 'RB' and 'carries' in player_data.columns:
            carries_avg = player_data['carries'].mean()
            context = {
                "carries_per_game": round(float(carries_avg) if pd.notna(carries_avg) else 0, 1),
                "receiving_targets": round(float(player_data['targets'].mean()) if 'targets' in player_data.columns else 0, 1)
            }
        elif position == 'QB':
            pass_yds = player_data['passing_yards'].mean()
            rush_yds = player_data['rushing_yards'].mean()
            context = {
                "passing_yards_per_game": round(float(pass_yds) if pd.notna(pass_yds) else 0, 1),
                "rushing_yards_per_game": round(float(rush_yds) if pd.notna(rush_yds) else 0, 1)
            }
        
        return {
            "player_name": player_name,
            "position": position,
            "games_played": len(fantasy_points),
            "season_average": round(season_avg, 1),
            "spike_threshold": round(spike_threshold, 1),
            "spike_weeks_count": spike_count,
            "spike_percentage": round(spike_percentage, 1),
            "weekly_breakdown": weeks,
            "context_metrics": context
        }
        
    except Exception as e:
        return {"error": f"Analysis failed for {player_name}: {str(e)}"}

def main():
    """Analyze our Prometheus Benchmark Cluster elite players"""
    
    # Get 2024 weekly data for player lookup
    weekly_df = nfl.import_weekly_data([2024])
    
    # Find elite players with exact names
    elite_players = []
    
    # Ja'Marr Chase
    chase = weekly_df[(weekly_df['player_display_name'] == "Ja'Marr Chase") & (weekly_df['position'] == 'WR')]
    if not chase.empty:
        elite_players.append(("Ja'Marr Chase", "WR", chase['player_id'].iloc[0]))
    
    # Saquon Barkley  
    barkley = weekly_df[(weekly_df['player_display_name'] == 'Saquon Barkley') & (weekly_df['position'] == 'RB')]
    if not barkley.empty:
        elite_players.append(("Saquon Barkley", "RB", barkley['player_id'].iloc[0]))
    
    # Lamar Jackson
    lamar = weekly_df[(weekly_df['player_display_name'] == 'Lamar Jackson') & (weekly_df['position'] == 'QB')]
    if not lamar.empty:
        elite_players.append(("Lamar Jackson", "QB", lamar['player_id'].iloc[0]))
    
    # Josh Allen
    allen = weekly_df[(weekly_df['player_display_name'] == 'Josh Allen') & (weekly_df['position'] == 'QB')]
    if not allen.empty:
        elite_players.append(("Josh Allen", "QB", allen['player_id'].iloc[0]))
    
    # Analyze each player
    results = {}
    for name, position, player_id in elite_players:
        analysis = analyze_player_spikes(player_id, name, position)
        results[name] = analysis
    
    # Output results
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()