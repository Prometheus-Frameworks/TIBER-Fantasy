import json
import nfl_data_py as nfl
import pandas as pd

def create_wr_18_week_gamelogs():
    """Create complete 18-week WR game logs from NFL data"""
    
    print("🏈 Fetching 2024 WR game logs from NFL API...")
    
    # Load NFL weekly data for 2024
    weekly_data = nfl.import_weekly_data([2024])
    
    # Filter for WRs only
    wr_data = weekly_data[weekly_data['position'] == 'WR'].copy()
    
    print(f"📊 Found {len(wr_data)} WR weekly records")
    
    # Get unique WR players with substantial data
    wr_players = wr_data.groupby('player_display_name').agg({
        'targets': 'sum',
        'receptions': 'sum', 
        'receiving_yards': 'sum',
        'fantasy_points_ppr': 'sum',
        'recent_team': 'first'
    }).reset_index()
    
    # Filter for fantasy-relevant WRs (minimum thresholds)
    relevant_wrs = wr_players[
        (wr_players['targets'] >= 20) |  # At least 20 targets season
        (wr_players['fantasy_points_ppr'] >= 50)  # Or 50+ fantasy points
    ].sort_values('fantasy_points_ppr', ascending=False)
    
    print(f"🎯 Processing {len(relevant_wrs)} fantasy-relevant WRs")
    
    wr_gamelogs = []
    
    for _, player_row in relevant_wrs.head(50).iterrows():  # Top 50 WRs
        player_name = player_row['player_display_name']
        team = player_row['recent_team']
        
        print(f"Processing {player_name} ({team})...")
        
        # Get all weeks for this player
        player_weeks = wr_data[wr_data['player_display_name'] == player_name]
        
        game_logs = []
        
        # Create exactly 18 weeks
        for week_num in range(1, 19):
            week_data = player_weeks[player_weeks['week'] == week_num]
            
            if len(week_data) > 0:
                # Has data for this week
                row = week_data.iloc[0]
                
                # Calculate derived stats
                targets = int(row['targets']) if pd.notna(row['targets']) else 0
                receptions = int(row['receptions']) if pd.notna(row['receptions']) else 0
                rec_yards = int(row['receiving_yards']) if pd.notna(row['receiving_yards']) else 0
                carries = int(row['carries']) if pd.notna(row['carries']) else 0
                rush_yards = int(row['rushing_yards']) if pd.notna(row['rushing_yards']) else 0
                
                game_log = {
                    "week": week_num,
                    "fantasy_points": round(float(row['fantasy_points_ppr']), 1) if pd.notna(row['fantasy_points_ppr']) else 0.0,
                    "snap_pct": 0,  # Not available in this dataset
                    "rank": 999,    # Will calculate based on weekly fantasy points
                    
                    "receiving": {
                        "targets": targets,
                        "receptions": receptions,
                        "yards": rec_yards,
                        "yards_per_target": round(rec_yards / targets, 1) if targets > 0 else 0.0,
                        "yards_per_catch": round(rec_yards / receptions, 1) if receptions > 0 else 0.0,
                        "touchdowns": int(row['receiving_tds']) if pd.notna(row['receiving_tds']) else 0
                    },
                    
                    "rushing": {
                        "attempts": carries,
                        "yards": rush_yards,
                        "yards_per_carry": round(rush_yards / carries, 1) if carries > 0 else 0.0,
                        "touchdowns": int(row['rushing_tds']) if pd.notna(row['rushing_tds']) else 0
                    }
                }
            else:
                # No data for this week - create zero entry
                game_log = {
                    "week": week_num,
                    "fantasy_points": 0.0,
                    "snap_pct": 0,
                    "rank": 999,
                    
                    "receiving": {
                        "targets": 0,
                        "receptions": 0,
                        "yards": 0,
                        "yards_per_target": 0.0,
                        "yards_per_catch": 0.0,
                        "touchdowns": 0
                    },
                    
                    "rushing": {
                        "attempts": 0,
                        "yards": 0,
                        "yards_per_carry": 0.0,
                        "touchdowns": 0
                    }
                }
            
            game_logs.append(game_log)
        
        # Verify exactly 18 weeks
        assert len(game_logs) == 18, f"Expected 18 weeks, got {len(game_logs)}"
        
        # Create player entry
        wr_entry = {
            "player_name": player_name,
            "position": "WR", 
            "team": team,
            "game_logs": game_logs
        }
        
        wr_gamelogs.append(wr_entry)
        
        # Summary stats
        total_ppr = sum([g['fantasy_points'] for g in game_logs])
        active_weeks = len([g for g in game_logs if g['fantasy_points'] > 0])
        total_targets = sum([g['receiving']['targets'] for g in game_logs])
        
        print(f"  ✅ {player_name}: {active_weeks} active weeks, {total_ppr:.1f} PPR, {total_targets} targets")
    
    return wr_gamelogs

# Generate WR dataset
print("🚀 Starting WR 18-week extraction...")
wr_dataset = create_wr_18_week_gamelogs()

# Save to JSON file
with open('wr_18_week_gamelogs.json', 'w') as f:
    json.dump(wr_dataset, f, indent=2)

print(f"\n✅ WR 18-WEEK DATASET COMPLETE")
print(f"📁 File: wr_18_week_gamelogs.json")
print(f"🏈 Players: {len(wr_dataset)} WRs")

# Verification
print(f"\n🔍 VERIFICATION:")
for i, player in enumerate(wr_dataset[:5]):  # Show top 5
    weeks = len(player['game_logs'])
    total_ppr = sum([g['fantasy_points'] for g in player['game_logs']])
    print(f"  {i+1}. {player['player_name']} ({player['team']}): {weeks} weeks, {total_ppr:.1f} PPR")