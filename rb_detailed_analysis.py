from nfl_data_py import import_seasonal_data
import pandas as pd

print("Fetching 2024 game logs for Barkley, Conner, and Dowdle using NFL-Data-Py...")

# Load 2024 game data using seasonal data as specified
try:
    # Try weekly data first for game-by-game logs
    import nfl_data_py as nfl
    season_data = nfl.import_weekly_data([2024])
    print("Loaded weekly game data successfully")
except:
    # Fallback to seasonal if weekly fails
    season_data = import_seasonal_data([2024])
    print("Loaded seasonal data successfully")

# Filter for RBs of interest
players_of_interest = ['Saquon Barkley', 'James Conner', 'Rico Dowdle']
rb_games = season_data[season_data['position'] == 'RB']

# Use player_display_name for filtering (more reliable)
rb_games = rb_games[rb_games['player_display_name'].isin(players_of_interest)]

print(f"Found {len(rb_games)} game records")
print(f"Players found: {rb_games['player_display_name'].unique()}")

# Select relevant fantasy columns matching your specification
cols = [
    'player_display_name', 'week', 'recent_team', 'opponent_team', 'carries', 'rushing_yards', 'rushing_tds',
    'receptions', 'receiving_yards', 'receiving_tds', 'rushing_fumbles_lost', 'fantasy_points_ppr'
]

# Rename columns to match your specification
rb_logs = rb_games[cols].copy()
rb_logs.rename(columns={
    'player_display_name': 'player_name',
    'recent_team': 'team',
    'opponent_team': 'opponent',
    'carries': 'rush_att',
    'rushing_yards': 'rush_yds',
    'rushing_tds': 'rush_td',
    'receptions': 'rec',
    'receiving_yards': 'rec_yds',
    'receiving_tds': 'rec_td',
    'rushing_fumbles_lost': 'fumbles_lost'
}, inplace=True)

# Sort by player name and week as specified
rb_logs = rb_logs.sort_values(by=['player_name', 'week'])

# Display for export or modeling
rb_logs.reset_index(drop=True, inplace=True)
rb_logs.to_csv('rb_sample_logs_2024.csv', index=False)

print("\n=== 2024 RB Game Logs Analysis ===")
print(f"Total game records: {len(rb_logs)}")

# Summary stats for each player
for player in players_of_interest:
    player_data = rb_logs[rb_logs['player_name'] == player]
    if len(player_data) > 0:
        print(f"\n{player}:")
        print(f"  Games played: {len(player_data)}")
        print(f"  Total rushing yards: {player_data['rush_yds'].sum()}")
        print(f"  Total rushing TDs: {player_data['rush_td'].sum()}")
        print(f"  Total receptions: {player_data['rec'].sum()}")
        print(f"  Total receiving yards: {player_data['rec_yds'].sum()}")
        print(f"  Total PPR points: {player_data['fantasy_points_ppr'].sum():.1f}")
        print(f"  Avg PPR per game: {player_data['fantasy_points_ppr'].mean():.1f}")

print(f"\nData exported to rb_sample_logs_2024.csv")
print("\nFirst 10 records:")
print(rb_logs.head(10).to_string())

# Display the DataFrame as requested
rb_logs