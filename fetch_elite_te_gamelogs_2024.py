#!/usr/bin/env python3
"""
Fetch 2024 game logs for elite TEs: Brock Bowers, Trey McBride, Travis Kelce, Njoku, Kyle Pitts
Creates clean JSON output for TE analysis module integration
"""

import nfl_data_py as nfl
import pandas as pd
import json
import sys
import warnings
import os

# Suppress warnings
warnings.filterwarnings('ignore')
os.environ['PYTHONWARNINGS'] = 'ignore'

def fetch_elite_te_gamelogs():
    """Fetch 2024 game logs for the specified elite TEs"""
    
    # Target TEs requested by user
    target_tes = [
        'Brock Bowers',
        'Trey McBride', 
        'Travis Kelce',
        'David Njoku',  # Full name for Njoku
        'Kyle Pitts'
    ]
    
    print("🏈 Fetching 2024 TE game logs from NFL data...")
    
    try:
        # Load 2024 weekly data
        weekly_data = nfl.import_weekly_data([2024])
        
        # Filter for TEs only
        te_data = weekly_data[weekly_data['position'] == 'TE'].copy()
        
        print(f"📊 Found {len(te_data)} TE weekly records")
        
        elite_te_logs = []
        
        for target_te in target_tes:
            print(f"Processing {target_te}...")
            
            # Find player (try exact match first, then fuzzy)
            player_weeks = te_data[
                te_data['player_display_name'].str.contains(target_te, case=False, na=False)
            ]
            
            if player_weeks.empty:
                # Try alternative name patterns
                if target_te == 'David Njoku':
                    player_weeks = te_data[
                        te_data['player_display_name'].str.contains('Njoku', case=False, na=False)
                    ]
                elif target_te == 'Trey McBride':
                    player_weeks = te_data[
                        te_data['player_display_name'].str.contains('McBride', case=False, na=False)
                    ]
            
            if player_weeks.empty:
                print(f"❌ No data found for {target_te}")
                continue
                
            # Get player info
            player_info = player_weeks.iloc[0]
            actual_name = player_info['player_display_name']
            team = player_info['recent_team']
            
            print(f"✅ Found: {actual_name} ({team})")
            
            # Create complete 18-week game log
            game_logs = []
            season_totals = {
                'targets': 0,
                'receptions': 0,
                'receiving_yards': 0,
                'receiving_tds': 0,
                'fantasy_points_ppr': 0
            }
            
            for week in range(1, 19):  # Weeks 1-18
                week_data = player_weeks[player_weeks['week'] == week]
                
                if not week_data.empty:
                    stats = week_data.iloc[0]
                    
                    week_log = {
                        'week': week,
                        'active': True,
                        'targets': int(stats.get('targets', 0)),
                        'receptions': int(stats.get('receptions', 0)),
                        'receiving_yards': int(stats.get('receiving_yards', 0)),
                        'receiving_tds': int(stats.get('receiving_tds', 0)),
                        'rushing_attempts': int(stats.get('rushing_attempts', 0)),
                        'rushing_yards': int(stats.get('rushing_yards', 0)),
                        'rushing_tds': int(stats.get('rushing_tds', 0)),
                        'fantasy_points_ppr': round(float(stats.get('fantasy_points_ppr', 0)), 1),
                        'fantasy_points_half_ppr': round(float(stats.get('fantasy_points_half_ppr', 0)), 1),
                        'fantasy_points_std': round(float(stats.get('fantasy_points', 0)), 1),
                        
                        # Advanced TE metrics
                        'target_share': round(float(stats.get('target_share', 0)), 3),
                        'air_yards_share': round(float(stats.get('air_yards_share', 0)), 3),
                        'red_zone_targets': int(stats.get('red_zone_targets', 0)),
                        'wopr': round(float(stats.get('wopr', 0)), 3),  # Weighted Opportunity Rating
                        
                        # Game context
                        'opponent': stats.get('opponent_team', 'BYE'),
                        'game_script': 'neutral'  # Could be enhanced with score data
                    }
                    
                    # Add to season totals
                    for key in season_totals:
                        if key in stats:
                            season_totals[key] += stats[key]
                    
                    game_logs.append(week_log)
                else:
                    # Bye week or inactive
                    week_log = {
                        'week': week,
                        'active': False,
                        'targets': 0,
                        'receptions': 0,
                        'receiving_yards': 0,
                        'receiving_tds': 0,
                        'rushing_attempts': 0,
                        'rushing_yards': 0,
                        'rushing_tds': 0,
                        'fantasy_points_ppr': 0,
                        'fantasy_points_half_ppr': 0,
                        'fantasy_points_std': 0,
                        'target_share': 0,
                        'air_yards_share': 0,
                        'red_zone_targets': 0,
                        'wopr': 0,
                        'opponent': 'BYE',
                        'game_script': 'bye'
                    }
                    game_logs.append(week_log)
            
            # Calculate advanced season metrics
            active_weeks = len([log for log in game_logs if log['active']])
            ppg_ppr = round(season_totals['fantasy_points_ppr'] / max(active_weeks, 1), 1)
            
            # Calculate consistency metrics
            ppr_scores = [log['fantasy_points_ppr'] for log in game_logs if log['active']]
            if ppr_scores:
                ppr_std = round(pd.Series(ppr_scores).std(), 1)
                ceiling = round(max(ppr_scores), 1)
                floor = round(min(ppr_scores), 1)
            else:
                ppr_std = 0
                ceiling = 0
                floor = 0
            
            # Calculate TE-specific analytics
            total_routes_est = season_totals['targets'] * 1.8  # TE route estimation
            yprr_est = round(season_totals['receiving_yards'] / max(total_routes_est, 1), 2)
            tprr_est = round(season_totals['targets'] / max(total_routes_est, 1), 3)
            
            player_summary = {
                'player_name': actual_name,
                'team': team,
                'position': 'TE',
                'season': 2024,
                'total_weeks': 18,
                'active_weeks': active_weeks,
                'bye_weeks': 18 - active_weeks,
                
                # Season totals
                'season_stats': {
                    'targets': int(season_totals['targets']),
                    'receptions': int(season_totals['receptions']),
                    'receiving_yards': int(season_totals['receiving_yards']),
                    'receiving_tds': int(season_totals['receiving_tds']),
                    'fantasy_points_ppr': round(season_totals['fantasy_points_ppr'], 1),
                    'ppg_ppr': ppg_ppr,
                    'catch_rate': round(season_totals['receptions'] / max(season_totals['targets'], 1), 3)
                },
                
                # TE-specific advanced metrics
                'te_analytics': {
                    'estimated_yprr': yprr_est,
                    'estimated_tprr': tprr_est,
                    'red_zone_share': 'calculated_from_weekly',
                    'target_dominance': 'team_context_dependent',
                    'route_participation': 'estimated_70_percent'
                },
                
                # Consistency metrics
                'consistency': {
                    'ppr_standard_deviation': ppr_std,
                    'ceiling_game': ceiling,
                    'floor_game': floor,
                    'boom_rate': len([s for s in ppr_scores if s >= 15]) / max(len(ppr_scores), 1),
                    'bust_rate': len([s for s in ppr_scores if s <= 5]) / max(len(ppr_scores), 1)
                },
                
                # Weekly game logs
                'game_logs': game_logs
            }
            
            elite_te_logs.append(player_summary)
    
        # Create final output
        output = {
            'data_source': 'NFL-Data-Py 2024 Season',
            'fetch_timestamp': pd.Timestamp.now().isoformat(),
            'total_players': len(elite_te_logs),
            'positions': ['TE'],
            'season': 2024,
            'weeks_covered': '1-18',
            'requested_players': target_tes,
            'found_players': [player['player_name'] for player in elite_te_logs],
            'te_game_logs': elite_te_logs
        }
        
        # Save to JSON file
        output_file = 'elite_te_2024_gamelogs.json'
        with open(output_file, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"\n✅ Successfully fetched game logs for {len(elite_te_logs)} elite TEs")
        print(f"📁 Saved to: {output_file}")
        
        # Print summary
        print("\n📊 ELITE TE 2024 SUMMARY:")
        print("=" * 50)
        for player in elite_te_logs:
            stats = player['season_stats']
            print(f"{player['player_name']} ({player['team']})")
            print(f"  Targets: {stats['targets']} | Rec: {stats['receptions']} | Yards: {stats['receiving_yards']} | TDs: {stats['receiving_tds']}")
            print(f"  PPR: {stats['fantasy_points_ppr']} ({stats['ppg_ppr']} PPG) | Catch Rate: {stats['catch_rate']:.1%}")
            print(f"  Est. YPRR: {player['te_analytics']['estimated_yprr']} | Est. TPRR: {player['te_analytics']['estimated_tprr']}")
            print()
        
        return output
        
    except Exception as e:
        print(f"❌ Error fetching TE game logs: {e}")
        return None

if __name__ == "__main__":
    print("🎯 ELITE TE 2024 GAME LOG FETCHER")
    print("=" * 40)
    print("Target TEs: Brock Bowers, Trey McBride, Travis Kelce, Njoku, Kyle Pitts")
    print()
    
    result = fetch_elite_te_gamelogs()
    
    if result:
        print("✅ Game log fetch completed successfully!")
        print(f"📈 Ready for TE scoring module analysis")
    else:
        print("❌ Game log fetch failed")
        sys.exit(1)