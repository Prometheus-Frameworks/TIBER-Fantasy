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

def calculate_qb_context_metrics(season=2024):
    """
    Calculate QB context metrics - "luck" factors that Ben Baldwin adjusts for
    
    Returns context data for: drops, pressure, YAC delta, defensive EPA faced
    """
    try:
        print(f"🔬 Loading play-by-play data for QB context analysis ({season})...", file=sys.stderr)
        
        # Suppress library output by temporarily redirecting stdout
        import os
        import io
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        
        pbp = nfl.import_pbp_data([season])
        
        # Restore stdout
        sys.stdout = old_stdout
        
        # Filter to passing plays only
        passing = pbp[pbp['play_type'] == 'pass'].copy()
        passing = passing[passing['passer_player_id'].notna()]
        
        print(f"✅ Loaded {len(passing):,} passing plays", file=sys.stderr)
        
        # Calculate context metrics for each QB
        qb_context = []
        
        for qb_id in passing['passer_player_id'].unique():
            qb_plays = passing[passing['passer_player_id'] == qb_id]
            qb_name = qb_plays['passer_player_name'].iloc[0] if len(qb_plays) > 0 else 'Unknown'
            
            if len(qb_plays) < 100:  # Min 100 dropbacks
                continue
            
            # === Drop Rate ===
            # Incomplete passes that weren't QB's fault (receiver drops)
            pass_attempts = len(qb_plays)
            completions = qb_plays['complete_pass'].sum()
            incomplete = qb_plays['incomplete_pass'].sum()
            
            # Estimate drops as incompletions on catchable balls (not sacks, throwaways)
            non_sack_attempts = qb_plays[qb_plays['sack'] == 0]
            catchable_incompletions = non_sack_attempts['incomplete_pass'].sum()
            estimated_drops = int(catchable_incompletions * 0.08)  # Rough estimate: 8% drop rate
            drop_rate = estimated_drops / pass_attempts if pass_attempts > 0 else 0
            
            # === Pressure Rate ===
            # QB hits + hurries
            qb_hit = qb_plays['qb_hit'].fillna(0).sum()
            sacks = qb_plays['sack'].fillna(0).sum()
            total_pressures = qb_hit + sacks
            pressure_rate = total_pressures / pass_attempts if pass_attempts > 0 else 0
            sack_rate = sacks / pass_attempts if pass_attempts > 0 else 0
            
            # === YAC Context ===
            # YAC EPA vs Expected YAC EPA
            yac_plays = qb_plays[qb_plays['yac_epa'].notna() & qb_plays['xyac_epa'].notna()]
            total_yac_epa = yac_plays['yac_epa'].sum()
            expected_yac_epa = yac_plays['xyac_epa'].sum()
            yac_delta = total_yac_epa - expected_yac_epa
            
            # === Defensive Strength Faced ===
            # Average defensive EPA allowed by opponents faced
            opponents = qb_plays['defteam'].unique()
            
            # Calculate avg defensive EPA for opponents
            def_epa_values = []
            for opp in opponents:
                opp_def_plays = pbp[pbp['defteam'] == opp]
                if len(opp_def_plays) > 0:
                    avg_def_epa = opp_def_plays['epa'].mean()
                    if pd.notna(avg_def_epa):
                        def_epa_values.append(avg_def_epa)
            
            avg_def_epa_faced = np.mean(def_epa_values) if len(def_epa_values) > 0 else None
            
            # === Turnover Luck ===
            interceptions = qb_plays['interception'].fillna(0).sum()
            # Estimate "should have been intercepted" plays (this is rough without advanced tracking)
            interceptable = int(interceptions * 1.3)  # Rough estimate
            
            # === CPOE (Completion Percentage Over Expected) ===
            # Extract CPOE from nflfastR data (already calculated by Next Gen Stats model)
            cpoe_plays = qb_plays[qb_plays['cpoe'].notna()]
            avg_cpoe = cpoe_plays['cpoe'].mean() if len(cpoe_plays) > 0 else None
            completion_pct = (completions / pass_attempts) if pass_attempts > 0 else None
            
            context_data = {
                'player_id': qb_id,
                'player_name': qb_name,
                'season': season,
                'pass_attempts': int(pass_attempts),
                'completions': int(completions),
                'completion_pct': round(float(completion_pct), 3) if completion_pct is not None else None,
                'cpoe': round(float(avg_cpoe), 3) if avg_cpoe is not None and pd.notna(avg_cpoe) else None,
                'drops': estimated_drops,
                'drop_rate': round(drop_rate, 3),
                'pressures': int(total_pressures),
                'pressure_rate': round(pressure_rate, 3),
                'sacks': int(sacks),
                'sack_rate': round(sack_rate, 3),
                'total_yac_epa': round(float(total_yac_epa), 2) if pd.notna(total_yac_epa) else None,
                'expected_yac_epa': round(float(expected_yac_epa), 2) if pd.notna(expected_yac_epa) else None,
                'yac_delta': round(float(yac_delta), 2) if pd.notna(yac_delta) else None,
                'avg_def_epa_faced': round(float(avg_def_epa_faced), 3) if avg_def_epa_faced is not None else None,
                'interceptable_passes': interceptable,
                'actual_interceptions': int(interceptions)
            }
            
            qb_context.append(context_data)
        
        print(f"✅ Calculated context metrics for {len(qb_context)} QBs", file=sys.stderr)
        
        return {
            'season': season,
            'generated_at': datetime.now().isoformat(),
            'qb_context': qb_context,
            'metadata': {
                'qb_count': len(qb_context),
                'min_attempts': 100
            }
        }
        
    except Exception as e:
        print(f"❌ Error calculating QB context metrics: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
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
        command = sys.argv[1]
        
        if command == 'context':
            # Calculate QB context metrics
            season = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
            print(f"🔬 Calculating QB context metrics for {season}...", file=sys.stderr)
            result = calculate_qb_context_metrics(season)
            print(json.dumps(result))  # Print to stdout for parsing
            
        else:
            # Single player lookup
            player_identifier = command
            season = int(sys.argv[2]) if len(sys.argv) > 2 else 2024
            
            print(f"🔍 Looking up EPA for: {player_identifier}", file=sys.stderr)
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
