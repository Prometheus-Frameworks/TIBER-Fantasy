import nfl_data_py as nfl
import pandas as pd
import json

def fetch_complete_rb_gamelogs():
    """Fetch complete 2024 game logs for Barkley, Conner, and Dowdle"""
    
    print("Fetching complete 2024 RB game logs...")
    
    # Load 2024 weekly data
    weekly_data = nfl.import_weekly_data([2024])
    
    # Target players
    target_players = ['Saquon Barkley', 'James Conner', 'Rico Dowdle']
    
    # Filter for our RBs
    rb_data = weekly_data[
        (weekly_data['position'] == 'RB') & 
        (weekly_data['player_display_name'].isin(target_players))
    ]
    
    print(f"Found {len(rb_data)} total game records")
    
    # Create complete game logs structure
    rb_gamelogs = {
        "running_backs": []
    }
    
    for player_name in target_players:
        player_data = rb_data[rb_data['player_display_name'] == player_name]
        
        if len(player_data) > 0:
            # Get player info
            team = player_data['recent_team'].iloc[0]
            
            # Create complete weekly structure (weeks 1-18)
            game_logs = []
            
            for week in range(1, 19):  # Weeks 1-18
                week_data = player_data[player_data['week'] == week]
                
                if len(week_data) > 0:
                    # Player had data for this week
                    row = week_data.iloc[0]
                    game_log = {
                        "week": int(week),
                        "opponent": row['opponent_team'],
                        "rush_attempts": int(row['carries']) if pd.notna(row['carries']) else 0,
                        "rush_yards": int(row['rushing_yards']) if pd.notna(row['rushing_yards']) else 0,
                        "rush_touchdowns": int(row['rushing_tds']) if pd.notna(row['rushing_tds']) else 0,
                        "receptions": int(row['receptions']) if pd.notna(row['receptions']) else 0,
                        "receiving_yards": int(row['receiving_yards']) if pd.notna(row['receiving_yards']) else 0,
                        "receiving_touchdowns": int(row['receiving_tds']) if pd.notna(row['receiving_tds']) else 0,
                        "fumbles_lost": int(row['rushing_fumbles_lost']) if pd.notna(row['rushing_fumbles_lost']) else 0,
                        "fantasy_points_ppr": round(float(row['fantasy_points_ppr']), 2) if pd.notna(row['fantasy_points_ppr']) else 0.0
                    }
                else:
                    # Player had no data for this week (bye, injury, etc.)
                    game_log = {
                        "week": week,
                        "opponent": None,
                        "rush_attempts": 0,
                        "rush_yards": 0,
                        "rush_touchdowns": 0,
                        "receptions": 0,
                        "receiving_yards": 0,
                        "receiving_touchdowns": 0,
                        "fumbles_lost": 0,
                        "fantasy_points_ppr": 0.0
                    }
                
                game_logs.append(game_log)
            
            # Add player to structure
            player_entry = {
                "player_name": player_name,
                "position": "RB",
                "team": team,
                "season": 2024,
                "game_logs": game_logs
            }
            
            rb_gamelogs["running_backs"].append(player_entry)
            
            # Print summary for this player
            games_played = len([g for g in game_logs if g['fantasy_points_ppr'] > 0])
            total_ppr = sum([g['fantasy_points_ppr'] for g in game_logs])
            print(f"\n{player_name} ({team}):")
            print(f"  Games with stats: {games_played}/18")
            print(f"  Total PPR points: {total_ppr:.1f}")
            print(f"  Avg PPR per game: {total_ppr/games_played:.1f}" if games_played > 0 else "  No games played")
    
    return rb_gamelogs

# Execute the fetch
rb_gamelogs = fetch_complete_rb_gamelogs()

# Save to JSON file
with open('tiber_rb_gamelogs_complete.json', 'w') as f:
    json.dump(rb_gamelogs, f, indent=2)

print(f"\n✅ Complete game logs saved to tiber_rb_gamelogs_complete.json")
print(f"📊 Total players: {len(rb_gamelogs['running_backs'])}")

# Display sample structure
if rb_gamelogs['running_backs']:
    sample_player = rb_gamelogs['running_backs'][0]
    print(f"\nSample structure for {sample_player['player_name']}:")
    print(f"  Total weeks: {len(sample_player['game_logs'])}")
    print(f"  Week 1 data: {sample_player['game_logs'][0]}")