import json
import nfl_data_py as nfl
import pandas as pd

def create_complete_18_week_structure():
    """Create guaranteed 18-week structure for each RB"""
    
    print("Creating complete 18-week game logs structure...")
    
    # Load NFL data
    weekly_data = nfl.import_weekly_data([2024])
    target_players = ['Saquon Barkley', 'James Conner', 'Rico Dowdle']
    
    # Filter RB data
    rb_data = weekly_data[
        (weekly_data['position'] == 'RB') & 
        (weekly_data['player_display_name'].isin(target_players))
    ]
    
    complete_dataset = {
        "running_backs": []
    }
    
    for player_name in target_players:
        player_data = rb_data[rb_data['player_display_name'] == player_name]
        team = player_data['recent_team'].iloc[0] if len(player_data) > 0 else "N/A"
        
        print(f"\nProcessing {player_name}...")
        
        # Create exactly 18 weeks
        game_logs = []
        
        for week_num in range(1, 19):  # Weeks 1-18
            week_data = player_data[player_data['week'] == week_num]
            
            if len(week_data) > 0:
                # Has data for this week
                row = week_data.iloc[0]
                game_log = {
                    "week": week_num,
                    "opponent": row['opponent_team'] if pd.notna(row['opponent_team']) else None,
                    "rush_attempts": int(row['carries']) if pd.notna(row['carries']) else 0,
                    "rush_yards": int(row['rushing_yards']) if pd.notna(row['rushing_yards']) else 0,
                    "rush_touchdowns": int(row['rushing_tds']) if pd.notna(row['rushing_tds']) else 0,
                    "receptions": int(row['receptions']) if pd.notna(row['receptions']) else 0,
                    "receiving_yards": int(row['receiving_yards']) if pd.notna(row['receiving_yards']) else 0,
                    "receiving_touchdowns": int(row['receiving_tds']) if pd.notna(row['receiving_tds']) else 0,
                    "fumbles_lost": int(row['rushing_fumbles_lost']) if pd.notna(row['rushing_fumbles_lost']) else 0,
                    "fantasy_points_ppr": round(float(row['fantasy_points_ppr']), 2) if pd.notna(row['fantasy_points_ppr']) else 0.0
                }
                print(f"  Week {week_num}: {game_log['fantasy_points_ppr']} PPR vs {game_log['opponent']}")
            else:
                # No data for this week - create zero entry
                game_log = {
                    "week": week_num,
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
                print(f"  Week {week_num}: 0.0 PPR (No data)")
            
            game_logs.append(game_log)
        
        # Verify we have exactly 18 weeks
        assert len(game_logs) == 18, f"Expected 18 weeks, got {len(game_logs)}"
        
        player_entry = {
            "player_name": player_name,
            "position": "RB",
            "team": team,
            "season": 2024,
            "game_logs": game_logs
        }
        
        complete_dataset["running_backs"].append(player_entry)
        
        # Summary
        active_weeks = len([g for g in game_logs if g['fantasy_points_ppr'] > 0])
        total_ppr = sum([g['fantasy_points_ppr'] for g in game_logs])
        print(f"  ✅ {player_name}: {active_weeks} active weeks, {total_ppr:.1f} total PPR")
    
    return complete_dataset

# Generate complete dataset
complete_data = create_complete_18_week_structure()

# Save to file
with open('complete_18_week_rb_logs.json', 'w') as f:
    json.dump(complete_data, f, indent=2)

print(f"\n✅ COMPLETE 18-WEEK DATASET SAVED")
print(f"📁 File: complete_18_week_rb_logs.json")

# Final verification
print(f"\n🔍 FINAL VERIFICATION:")
for player in complete_data['running_backs']:
    weeks = [g['week'] for g in player['game_logs']]
    print(f"  {player['player_name']}: Weeks {min(weeks)}-{max(weeks)} ({len(weeks)} total)")
    
    # Verify sequential weeks
    expected_weeks = list(range(1, 19))
    actual_weeks = sorted(weeks)
    if expected_weeks == actual_weeks:
        print(f"    ✅ All weeks 1-18 present sequentially")
    else:
        print(f"    ❌ Missing weeks: {set(expected_weeks) - set(actual_weeks)}")