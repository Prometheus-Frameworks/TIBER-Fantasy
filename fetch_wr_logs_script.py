#!/usr/bin/env python3
"""
Script to fetch 2024 WR game logs for players NOT in the top 50 CSV dataset.
This will generate clean JSON output as requested by the user.
"""

import requests
import json
import time
import csv
from typing import Dict, List, Set

# Load excluded players from CSV
def load_excluded_players() -> Set[str]:
    excluded = set()
    try:
        with open('server/data/WR_2024_Ratings_With_Tags.csv', 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                player_name = row['player_name'].strip()
                excluded.add(player_name.lower())
        print(f"📋 Loaded {len(excluded)} players to exclude from top 50 dataset")
        return excluded
    except Exception as e:
        print(f"❌ Error loading CSV: {e}")
        return set()

def fetch_sleeper_players() -> Dict[str, any]:
    """Fetch all NFL players from Sleeper API"""
    try:
        response = requests.get('https://api.sleeper.app/v1/players/nfl')
        return response.json()
    except Exception as e:
        print(f"❌ Error fetching players: {e}")
        return {}

def fetch_week_stats(week: int) -> Dict[str, any]:
    """Fetch stats for a specific week"""
    try:
        response = requests.get(f'https://api.sleeper.app/v1/stats/nfl/regular/2024/{week}')
        return response.json()
    except Exception as e:
        print(f"❌ Error fetching week {week}: {e}")
        return {}

def calculate_fantasy_points(receiving: dict, rushing: dict) -> float:
    """Calculate PPR fantasy points"""
    rec_points = (receiving.get('receptions', 0) + 
                 receiving.get('yards', 0) * 0.1 + 
                 receiving.get('touchdowns', 0) * 6)
    
    rush_points = (rushing.get('yards', 0) * 0.1 + 
                  rushing.get('touchdowns', 0) * 6)
    
    return round(rec_points + rush_points, 1)

def calculate_yards_per_target(yards: int, targets: int) -> float:
    return round(yards / targets, 1) if targets > 0 else 0.0

def calculate_yards_per_carry(yards: int, attempts: int) -> float:
    return round(yards / attempts, 1) if attempts > 0 else 0.0

def calculate_yards_per_catch(yards: int, receptions: int) -> float:
    return round(yards / receptions, 1) if receptions > 0 else 0.0

def main():
    print("🏈 Starting 2024 WR Game Logs Collection...")
    
    # Load excluded players
    excluded_players = load_excluded_players()
    
    # Fetch all players
    print("📊 Fetching NFL players database...")
    all_players = fetch_sleeper_players()
    
    if not all_players:
        print("❌ Failed to fetch players database")
        return
    
    # Initialize WR tracking
    wr_players = {}
    
    print("🔄 Processing weeks 1-17...")
    
    # Process each week
    for week in range(1, 18):
        print(f"  Week {week}...")
        week_stats = fetch_week_stats(week)
        
        if not week_stats:
            continue
            
        # Process each player in the week
        for player_id, stats in week_stats.items():
            if player_id not in all_players:
                continue
                
            player_info = all_players[player_id]
            
            # Only process WRs
            if player_info.get('position') != 'WR':
                continue
                
            player_name = player_info.get('full_name', '').strip()
            
            # Skip if no name or in excluded list
            if not player_name or player_name.lower() in excluded_players:
                continue
                
            # Skip if no receiving activity
            if not (stats.get('rec_tgt') or stats.get('rec_rec') or stats.get('rec_yd')):
                continue
            
            # Initialize player if new
            if player_name not in wr_players:
                wr_players[player_name] = {
                    'player_name': player_name,
                    'position': 'WR',
                    'team': player_info.get('team', 'FA'),
                    'game_logs': []
                }
                
                # Initialize all 17 weeks with zeros
                for w in range(1, 18):
                    wr_players[player_name]['game_logs'].append({
                        'week': w,
                        'fantasy_points': 0.0,
                        'snap_pct': 0,
                        'rank': 999,
                        'receiving': {
                            'targets': 0,
                            'receptions': 0,
                            'yards': 0,
                            'yards_per_target': 0.0,
                            'yards_per_catch': 0.0,
                            'touchdowns': 0
                        },
                        'rushing': {
                            'attempts': 0,
                            'yards': 0,
                            'yards_per_carry': 0.0,
                            'touchdowns': 0
                        }
                    })
            
            # Update the specific week's data
            week_index = week - 1
            game_log = wr_players[player_name]['game_logs'][week_index]
            
            # Receiving stats
            game_log['receiving']['targets'] = stats.get('rec_tgt', 0)
            game_log['receiving']['receptions'] = stats.get('rec_rec', 0)
            game_log['receiving']['yards'] = stats.get('rec_yd', 0)
            game_log['receiving']['touchdowns'] = stats.get('rec_td', 0)
            game_log['receiving']['yards_per_target'] = calculate_yards_per_target(
                game_log['receiving']['yards'], 
                game_log['receiving']['targets']
            )
            game_log['receiving']['yards_per_catch'] = calculate_yards_per_catch(
                game_log['receiving']['yards'], 
                game_log['receiving']['receptions']
            )
            
            # Rushing stats
            game_log['rushing']['attempts'] = stats.get('rush_att', 0)
            game_log['rushing']['yards'] = stats.get('rush_yd', 0)
            game_log['rushing']['touchdowns'] = stats.get('rush_td', 0)
            game_log['rushing']['yards_per_carry'] = calculate_yards_per_carry(
                game_log['rushing']['yards'], 
                game_log['rushing']['attempts']
            )
            
            # Calculate fantasy points
            game_log['fantasy_points'] = calculate_fantasy_points(
                game_log['receiving'], 
                game_log['rushing']
            )
            
            # Estimate snap percentage based on targets
            if game_log['receiving']['targets'] > 0:
                game_log['snap_pct'] = min(95, max(25, game_log['receiving']['targets'] * 5))
        
        # Rate limiting
        time.sleep(0.1)
    
    # Filter out players with minimal activity
    active_wrs = []
    for player_name, player_data in wr_players.items():
        total_targets = sum(log['receiving']['targets'] for log in player_data['game_logs'])
        total_points = sum(log['fantasy_points'] for log in player_data['game_logs'])
        
        # Keep players with at least 10 targets or 15 fantasy points
        if total_targets >= 10 or total_points >= 15:
            active_wrs.append(player_data)
    
    # Sort by total fantasy points
    active_wrs.sort(key=lambda x: sum(log['fantasy_points'] for log in x['game_logs']), reverse=True)
    
    print(f"✅ Successfully collected game logs for {len(active_wrs)} WR players")
    
    # Output the clean JSON
    print("\n" + "="*80)
    print("📄 CLEAN JSON OUTPUT:")
    print("="*80)
    
    print(json.dumps(active_wrs, indent=2))
    
    # Also save to file
    with open('wr_2024_additional_game_logs.json', 'w') as f:
        json.dump(active_wrs, f, indent=2)
    
    print(f"\n💾 Saved to: wr_2024_additional_game_logs.json")
    print(f"📊 Total players: {len(active_wrs)}")
    
    if active_wrs:
        sample_player = active_wrs[0]
        total_points = sum(log['fantasy_points'] for log in sample_player['game_logs'])
        print(f"🎯 Top player: {sample_player['player_name']} ({sample_player['team']}) - {total_points:.1f} total points")

if __name__ == "__main__":
    main()