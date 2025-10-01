#!/usr/bin/env python3
"""
EPA Processor - Extract and calculate EPA-based efficiency metrics
Uses nfl-data-py play-by-play data to generate advanced player and team EPA stats
"""

import nfl_data_py as nfl
import pandas as pd
import numpy as np
import json
import sys
from datetime import datetime

def calculate_player_epa_metrics(season=2024):
    """
    Calculate player-level EPA metrics from play-by-play data
    
    Returns:
        Dict with player EPA stats for QB, RB, WR, TE
    """
    try:
        print(f"📊 Loading play-by-play data for {season}...")
        pbp = nfl.import_pbp_data([season])
        
        # Filter to regular plays only (exclude penalties, special teams)
        pbp = pbp[pbp['play_type'].isin(['pass', 'run'])]
        pbp = pbp[pbp['epa'].notna()]  # Remove plays without EPA
        
        print(f"✅ Loaded {len(pbp):,} plays with EPA data")
        
        # === QB EPA Metrics ===
        print("\n🎯 Calculating QB EPA metrics...")
        qb_passing = pbp[pbp['play_type'] == 'pass'].copy()
        
        qb_stats = qb_passing.groupby(['passer_player_id', 'passer_player_name']).agg({
            'epa': ['mean', 'sum', 'count'],
            'success': 'mean',  # Success rate (EPA > 0)
            'air_epa': 'mean',
            'yac_epa': 'mean',
            'cpoe': 'mean'  # Completion % over expected
        }).round(3)
        
        qb_stats.columns = ['epa_per_play', 'total_epa', 'plays', 'success_rate', 'air_epa_avg', 'yac_epa_avg', 'cpoe']
        qb_stats = qb_stats[qb_stats['plays'] >= 100]  # Min 100 dropbacks
        qb_stats = qb_stats.reset_index()
        
        print(f"✅ Calculated EPA for {len(qb_stats)} QBs (100+ dropbacks)")
        
        # === RB EPA Metrics ===
        print("\n🏃 Calculating RB EPA metrics...")
        rb_rushing = pbp[pbp['play_type'] == 'run'].copy()
        rb_receiving = pbp[(pbp['play_type'] == 'pass') & (pbp['receiver_player_id'].notna())].copy()
        
        # Rushing EPA
        rb_rush_stats = rb_rushing.groupby(['rusher_player_id', 'rusher_player_name']).agg({
            'epa': ['mean', 'sum', 'count'],
            'success': 'mean'
        }).round(3)
        rb_rush_stats.columns = ['rush_epa_per_play', 'total_rush_epa', 'rush_attempts', 'rush_success_rate']
        
        # Receiving EPA for RBs (need to identify RBs in receiving data)
        # This requires position data - we'll calculate it separately for all pass catchers
        
        rb_rush_stats = rb_rush_stats[rb_rush_stats['rush_attempts'] >= 50]  # Min 50 carries
        rb_rush_stats = rb_rush_stats.reset_index()
        
        print(f"✅ Calculated rushing EPA for {len(rb_rush_stats)} RBs (50+ carries)")
        
        # === WR/TE EPA Metrics ===
        print("\n📡 Calculating WR/TE EPA metrics...")
        receiving = pbp[(pbp['play_type'] == 'pass') & (pbp['receiver_player_id'].notna())].copy()
        
        rec_stats = receiving.groupby(['receiver_player_id', 'receiver_player_name']).agg({
            'epa': ['mean', 'sum', 'count'],
            'success': 'mean',
            'air_epa': 'mean',
            'yac_epa': 'mean',
            'xyac_epa': 'mean'  # Expected YAC EPA
        }).round(3)
        
        rec_stats.columns = ['epa_per_target', 'total_epa', 'targets', 'success_rate', 'air_epa_avg', 'yac_epa_avg', 'xyac_epa_avg']
        rec_stats = rec_stats[rec_stats['targets'] >= 25]  # Min 25 targets
        rec_stats = rec_stats.reset_index()
        
        # Calculate YAC over expected (actual - expected)
        rec_stats['yac_over_expected'] = (rec_stats['yac_epa_avg'] - rec_stats['xyac_epa_avg']).round(3)
        
        print(f"✅ Calculated receiving EPA for {len(rec_stats)} pass catchers (25+ targets)")
        
        # === Team EPA Metrics ===
        print("\n🏈 Calculating team EPA context...")
        
        # Offensive EPA by team
        offense_epa = pbp.groupby('posteam').agg({
            'epa': 'mean',
            'success': 'mean',
            'play_id': 'count'
        }).round(3)
        offense_epa.columns = ['offensive_epa', 'success_rate', 'total_plays']
        offense_epa = offense_epa.sort_values('offensive_epa', ascending=False)
        offense_epa['offensive_epa_rank'] = range(1, len(offense_epa) + 1)
        
        # Defensive EPA allowed by team  
        defense_epa = pbp.groupby('defteam').agg({
            'epa': 'mean',
            'success': 'mean'
        }).round(3)
        defense_epa.columns = ['defensive_epa_allowed', 'success_rate_allowed']
        defense_epa = defense_epa.sort_values('defensive_epa_allowed', ascending=True)  # Lower is better
        defense_epa['defensive_rank'] = range(1, len(defense_epa) + 1)
        
        print(f"✅ Calculated EPA for {len(offense_epa)} teams")
        
        # === Compile Results ===
        results = {
            'season': season,
            'generated_at': datetime.now().isoformat(),
            'qb_epa': qb_stats.to_dict('records'),
            'rb_epa': rb_rush_stats.to_dict('records'),
            'receiving_epa': rec_stats.to_dict('records'),
            'team_offense_epa': offense_epa.reset_index().to_dict('records'),
            'team_defense_epa': defense_epa.reset_index().to_dict('records'),
            'metadata': {
                'total_plays_analyzed': len(pbp),
                'qb_count': len(qb_stats),
                'rb_count': len(rb_rush_stats),
                'receiver_count': len(rec_stats),
                'team_count': len(offense_epa)
            }
        }
        
        return results
        
    except Exception as e:
        print(f"❌ Error calculating EPA metrics: {str(e)}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}

def get_player_epa_summary(player_id=None, player_name=None, season=2024):
    """
    Get EPA summary for a specific player by ID or name
    """
    try:
        pbp = nfl.import_pbp_data([season])
        pbp = pbp[pbp['play_type'].isin(['pass', 'run'])]
        pbp = pbp[pbp['epa'].notna()]
        
        # Find player in various roles
        player_data = {
            'player_id': player_id,
            'player_name': player_name,
            'season': season
        }
        
        # Check as passer
        if player_id:
            passing_plays = pbp[pbp['passer_player_id'] == player_id]
        elif player_name:
            passing_plays = pbp[pbp['passer_player_name'].str.contains(player_name, case=False, na=False)]
        
        if len(passing_plays) > 0:
            player_data['passing'] = {
                'epa_per_play': float(round(passing_plays['epa'].mean(), 3)),
                'total_epa': float(round(passing_plays['epa'].sum(), 1)),
                'plays': int(len(passing_plays)),
                'success_rate': float(round(passing_plays['success'].mean(), 3))
            }
        
        # Check as rusher
        if player_id:
            rushing_plays = pbp[pbp['rusher_player_id'] == player_id]
        elif player_name:
            rushing_plays = pbp[pbp['rusher_player_name'].str.contains(player_name, case=False, na=False)]
            
        if len(rushing_plays) > 0:
            player_data['rushing'] = {
                'epa_per_play': float(round(rushing_plays['epa'].mean(), 3)),
                'total_epa': float(round(rushing_plays['epa'].sum(), 1)),
                'plays': int(len(rushing_plays)),
                'success_rate': float(round(rushing_plays['success'].mean(), 3))
            }
        
        # Check as receiver
        if player_id:
            receiving_plays = pbp[pbp['receiver_player_id'] == player_id]
        elif player_name:
            receiving_plays = pbp[pbp['receiver_player_name'].str.contains(player_name, case=False, na=False)]
            
        if len(receiving_plays) > 0:
            player_data['receiving'] = {
                'epa_per_target': float(round(receiving_plays['epa'].mean(), 3)),
                'total_epa': float(round(receiving_plays['epa'].sum(), 1)),
                'targets': int(len(receiving_plays)),
                'success_rate': float(round(receiving_plays['success'].mean(), 3)),
                'air_epa': float(round(receiving_plays['air_epa'].mean(), 3)),
                'yac_epa': float(round(receiving_plays['yac_epa'].mean(), 3))
            }
        
        return player_data
        
    except Exception as e:
        return {'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) > 1:
        # Single player lookup
        player_identifier = sys.argv[1]
        season = int(sys.argv[2]) if len(sys.argv) > 2 else 2024
        
        print(f"🔍 Looking up EPA for: {player_identifier}")
        result = get_player_epa_summary(player_name=player_identifier, season=season)
        print(json.dumps(result, indent=2))
    else:
        # Calculate all EPA metrics
        print("🚀 Calculating EPA metrics for all players...")
        result = calculate_player_epa_metrics()
        
        # Save to file
        output_file = 'server/data/epa_metrics_2024.json'
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"\n✅ EPA metrics saved to {output_file}")
        print(f"📊 Summary: {result['metadata']}")
