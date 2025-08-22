import nfl_data_py as nfl
import pandas as pd
import numpy as np

# Define the year
year = 2024

print(f"🏈 Loading {year} seasonal player data...")

# Load seasonal player data and roster data to get positions
seasonal_df = nfl.import_seasonal_data([year])
print(f"📊 Loaded seasonal data: {seasonal_df.shape}")

# Load player roster data to get positions
print(f"🏈 Loading roster data for positions...")
roster_df = nfl.import_seasonal_rosters([year])
print(f"📊 Loaded roster data: {roster_df.shape}")

# Get unique player-position mapping from roster
player_positions = roster_df[['player_id', 'position']].drop_duplicates()

# Merge seasonal data with positions
seasonal_df = seasonal_df.merge(player_positions, on='player_id', how='left')

print(f"📋 Available columns after merge: {list(seasonal_df.columns)}")
print(f"📊 Data shape after merge: {seasonal_df.shape}")

# Filter to regular season if season_type exists
if 'season_type' in seasonal_df.columns:
    seasonal_df = seasonal_df[seasonal_df['season_type'] == 'REG']
    print(f"✅ Filtered to regular season only")

# Filter for relevant positions and remove null positions
seasonal_df = seasonal_df[seasonal_df['position'].isin(['QB', 'RB', 'WR', 'TE'])]
seasonal_df = seasonal_df[seasonal_df['position'].notna()]
print(f"✅ Filtered to skill positions: {len(seasonal_df)} players")

if len(seasonal_df) == 0:
    print("❌ No data found after filtering")
    exit(1)

# Add recent_team column if missing
if 'recent_team' not in seasonal_df.columns:
    # Get team from roster
    roster_team = roster_df[['player_id', 'team']].drop_duplicates()
    seasonal_df = seasonal_df.merge(roster_team, on='player_id', how='left', suffixes=('', '_roster'))
    seasonal_df['recent_team'] = seasonal_df['team']

# Compute derived fields, guarding against divide by zero
seasonal_df['cmp_pct'] = np.where(seasonal_df['attempts'] > 0, (seasonal_df['completions'] / seasonal_df['attempts']) * 100, np.nan)
seasonal_df['ypa'] = np.where(seasonal_df['attempts'] > 0, seasonal_df['passing_yards'] / seasonal_df['attempts'], np.nan)
seasonal_df['aypa'] = np.where(
    seasonal_df['attempts'] > 0,
    (seasonal_df['passing_yards'] + 20 * seasonal_df['passing_tds'] - 45 * seasonal_df['interceptions']) / seasonal_df['attempts'],
    np.nan
)

# Handle EPA safely
seasonal_df['epa_per_play'] = np.where(seasonal_df['attempts'] > 0,
                                       seasonal_df['passing_epa'] / seasonal_df['attempts'],
                                       np.nan)

# Use carries instead of rush_attempts
seasonal_df['rush_ypc'] = np.where(seasonal_df['carries'] > 0, seasonal_df['rushing_yards'] / seasonal_df['carries'], np.nan)

# Compute td_total for RBs
seasonal_df['td_total'] = seasonal_df['rushing_tds'] + seasonal_df['receiving_tds']

# Keep QB rush in both places
seasonal_df['qb_rush_yards'] = np.where(seasonal_df['position'] == 'QB', seasonal_df['rushing_yards'], np.nan)
seasonal_df['qb_rush_tds'] = np.where(seasonal_df['position'] == 'QB', seasonal_df['rushing_tds'], np.nan)

# Set advanced fields to null as not available or nullable
seasonal_df['rush_yac_per_att'] = np.nan
seasonal_df['rush_mtf'] = np.nan
seasonal_df['rush_expl_10p'] = np.nan
seasonal_df['yprr'] = np.nan
seasonal_df['adot'] = np.nan
seasonal_df['routes'] = np.nan
seasonal_df['racr'] = np.nan
seasonal_df['target_share'] = np.nan
seasonal_df['wopr'] = np.nan
seasonal_df['epa_per_play'] = np.where(seasonal_df['position'] != 'QB', np.nan, seasonal_df['epa_per_play'])  # Nullable for non-QB

# Get player names from roster
if 'player_name' not in seasonal_df.columns:
    roster_names = roster_df[['player_id', 'player_name']].drop_duplicates()
    seasonal_df = seasonal_df.merge(roster_names, on='player_id', how='left')

# Rename columns to match schema
rename_map = {
    'player_id': 'player_id',
    'player_name': 'player_name', 
    'position': 'position',
    'recent_team': 'team',
    'games': 'games',
    'fantasy_points': 'fpts',
    'fantasy_points_ppr': 'fpts_ppr',
    'targets': 'targets',
    'receptions': 'receptions',
    'receiving_yards': 'rec_yards',
    'receiving_tds': 'rec_tds',
    'carries': 'rush_att',
    'rushing_yards': 'rush_yards',
    'rushing_tds': 'rush_tds',
    'completions': 'cmp',
    'attempts': 'att',
    'passing_yards': 'pass_yards',
    'passing_tds': 'pass_tds',
    'interceptions': 'int'
}
seasonal_df = seasonal_df.rename(columns=rename_map)

# Remove any duplicate columns first
seasonal_df = seasonal_df.loc[:, ~seasonal_df.columns.duplicated()]

# Select only schema columns that exist, create missing ones
schema_columns = [
    'player_id', 'player_name', 'position', 'team', 'games', 'fpts', 'fpts_ppr',
    'targets', 'receptions', 'rec_yards', 'rec_tds', 'routes', 'yprr', 'adot', 'racr', 'target_share', 'wopr',
    'rush_att', 'rush_yards', 'rush_tds', 'rush_ypc', 'rush_yac_per_att', 'rush_mtf', 'rush_expl_10p',
    'cmp', 'att', 'cmp_pct', 'pass_yards', 'pass_tds', 'int', 'ypa', 'aypa', 'epa_per_play',
    'qb_rush_yards', 'qb_rush_tds', 'td_total'
]

# Create final dataframe with only the columns we need
final_df = pd.DataFrame()
for col in schema_columns:
    if col in seasonal_df.columns:
        final_df[col] = seasonal_df[col]
    else:
        final_df[col] = np.nan

# Clean up any remaining null values in required fields
final_df = final_df.dropna(subset=['player_name', 'position'])

# Save to CSV
final_df.to_csv('data/player_season_2024.csv', index=False)

print(f"✅ 2024 player season data saved to data/player_season_2024.csv")
print(f"📊 Dataset includes {len(final_df)} total players:")
for pos in ['QB', 'RB', 'WR', 'TE']:
    count = len(final_df[final_df['position'] == pos])
    print(f"  • {pos}: {count} players")

# Show sample of top performers by position
print(f"\n🏆 Top performers by position (PPR):")
for pos in ['QB', 'RB', 'WR', 'TE']:
    pos_data = final_df[final_df['position'] == pos].sort_values('fpts_ppr', ascending=False).head(3)
    print(f"\n{pos}:")
    for _, player in pos_data.iterrows():
        name = player['player_name']
        team = player['team']
        fpts = player['fpts_ppr'] if not pd.isna(player['fpts_ppr']) else player['fpts']
        if not pd.isna(fpts):
            print(f"  {name} ({team}) - {fpts:.1f} pts")