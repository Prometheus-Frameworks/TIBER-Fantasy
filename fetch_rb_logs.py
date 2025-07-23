import nfl_data_py as nfl
import pandas as pd

print("Fetching 2024 game logs for Barkley, Conner, and Dowdle...")

# Load 2024 weekly data
weekly_data = nfl.import_weekly_data([2024])

# Filter for RBs of interest
players_of_interest = ['Saquon Barkley', 'James Conner', 'Rico Dowdle']
rb_games = weekly_data[weekly_data['position'] == 'RB']
rb_games = rb_games[rb_games['player_display_name'].isin(players_of_interest)]

# Select relevant fantasy columns
cols = [
    'player_display_name', 'week', 'recent_team', 'opponent_team', 'rushing_yards', 'rushing_tds',
    'receptions', 'receiving_yards', 'receiving_tds', 'fumbles_lost', 'fantasy_points_ppr'
]

# Check available columns
print("Available columns:", rb_games.columns.tolist())

# Use actual column names from the data
available_cols = []
col_mapping = {
    'player_display_name': 'player_name',
    'week': 'week', 
    'recent_team': 'team',
    'opponent_team': 'opponent',
    'rushing_yards': 'rush_yds',
    'rushing_tds': 'rush_td',
    'receptions': 'rec',
    'receiving_yards': 'rec_yds', 
    'receiving_tds': 'rec_td',
    'fumbles_lost': 'fumbles_lost',
    'fantasy_points_ppr': 'fantasy_points_ppr'
}

# Build available columns list
final_cols = []
for col in cols:
    if col in rb_games.columns:
        final_cols.append(col)
        
rb_logs = rb_games[final_cols].sort_values(by=['player_display_name', 'week'])

print(f"\nFound data for {len(rb_logs)} player-weeks")
print(f"Players found: {rb_logs['player_display_name'].unique()}")

# Display and save
rb_logs.reset_index(drop=True, inplace=True)
rb_logs.to_csv('rb_sample_logs_2024.csv', index=False)

print("\nSample data:")
print(rb_logs.head(10))

print(f"\nData saved to rb_sample_logs_2024.csv")
print(f"Total records: {len(rb_logs)}")