import nfl_data_py as nfl
import pandas as pd
import numpy as np

# Define the year
year = 2024

print(f"Loading seasonal data for {year}...")

# Load seasonal player data for base information
seasonal_df = nfl.import_seasonal_data([year])

print(f"Loaded {len(seasonal_df)} seasonal records")
print(f"Columns available: {list(seasonal_df.columns)}")

# Filter to regular season if season_type exists
if 'season_type' in seasonal_df.columns:
    seasonal_df = seasonal_df[seasonal_df['season_type'] == 'REG']
    print(f"After regular season filter: {len(seasonal_df)} records")

# Handle position column variations
position_col = 'position' if 'position' in seasonal_df.columns else 'fantasy_position'

# Filter for relevant positions
if position_col in seasonal_df.columns:
    seasonal_df = seasonal_df[seasonal_df[position_col].isin(['QB', 'RB', 'WR', 'TE'])]
    print(f"After position filter: {len(seasonal_df)} records")
else:
    print(f"Warning: No position column found. Available columns: {list(seasonal_df.columns)}")
    # Take a sample to continue development
    seasonal_df = seasonal_df.head(100)

# Team/games robustness
if 'games' not in seasonal_df.columns and 'games_played' in seasonal_df.columns:
    seasonal_df['games'] = seasonal_df['games_played']

# Handle column name variations and build rename map
rename_map = {}
if 'player_id' not in seasonal_df.columns:
    if 'gsis_id' in seasonal_df.columns:
        rename_map['gsis_id'] = 'player_id'
if 'player_name' not in seasonal_df.columns:
    if 'player' in seasonal_df.columns:
        rename_map['player'] = 'player_name'
if 'position' not in seasonal_df.columns and 'fantasy_position' in seasonal_df.columns:
    rename_map['fantasy_position'] = 'position'
if 'team' not in seasonal_df.columns:
    if 'recent_team' in seasonal_df.columns:
        rename_map['recent_team'] = 'team'

# Apply renaming
seasonal_df = seasonal_df.rename(columns=rename_map)

# Base df with available columns
required_cols = ['player_id', 'player_name', 'team', 'position', 'games']
available_cols = [col for col in required_cols if col in seasonal_df.columns]
base_df = seasonal_df[available_cols]

print(f"Base dataframe has {len(base_df)} records with columns: {list(base_df.columns)}")

# Load PBP data
pbp = nfl.import_pbp_data([year])
pbp = pbp[pbp['season_type'] == 'REG']

# --- robust ID columns for pbp ---
recv_id_col = 'receiver_id' if 'receiver_id' in pbp.columns else ('receiver_player_id' if 'receiver_player_id' in pbp.columns else None)
rush_id_col = 'rusher_id' if 'rusher_id' in pbp.columns else ('rusher_player_id' if 'rusher_player_id' in pbp.columns else None)
pass_id_col = 'passer_id' if 'passer_id' in pbp.columns else ('passer_player_id' if 'passer_player_id' in pbp.columns else None)

# team attempts (offense only, pass plays)
team_pass_att = pbp[pbp['pass_attempt'] == 1].groupby('posteam').size().reset_index(name='team_pass_att')

# team air yards (sum on pass attempts)
air_col = 'air_yards' if 'air_yards' in pbp.columns else None
if air_col is not None:
    team_air_yards = pbp[pbp['pass_attempt'] == 1].groupby('posteam')[air_col].sum(min_count=1).reset_index(name='team_air_yards')
else:
    team_air_yards = pd.DataFrame(columns=['posteam','team_air_yards'])

# receiving aggregates
if recv_id_col is not None:
    # some dumps also have 'targeted_receiver'; keep simple count of pass attempts where a receiver_id exists
    rec_mask = (pbp['pass_attempt'] == 1) & (pbp[recv_id_col].notna())
    rec_df = pbp[rec_mask].groupby(recv_id_col).agg(
        targets=('play_id', 'count'),
        air_yards=(air_col, 'sum') if air_col else ('play_id','size'),
        rec_yards=('receiving_yards', 'sum')
    ).reset_index()
    rec_df.rename(columns={recv_id_col: 'player_id'}, inplace=True)
else:
    rec_df = pd.DataFrame(columns=['player_id','targets','air_yards','rec_yards'])

# normalize NaNs
if 'air_yards' in rec_df.columns:
    rec_df['air_yards'] = rec_df['air_yards'].astype('float64')

# RB rushing aggregates
if rush_id_col is not None:
    rush_df = pbp[pbp['rush_attempt'] == 1].groupby(rush_id_col).agg(
        rush_att=('play_id', 'count'),
        expl_rushes=('rushing_yards', lambda x: (x >= 10).sum())
    ).reset_index()
    rush_df.rename(columns={rush_id_col: 'player_id'}, inplace=True)
    rush_df['rush_expl_10p'] = np.where(rush_df['rush_att'] > 0, rush_df['expl_rushes'] / rush_df['rush_att'], np.nan)
else:
    rush_df = pd.DataFrame(columns=['player_id','rush_att','expl_rushes','rush_expl_10p'])

# QB aggregates
if pass_id_col is not None:
    qb_df = pbp[pbp['pass_attempt'] == 1].groupby(pass_id_col).agg(
        att=('play_id', 'count'),
        pass_yards=('passing_yards', 'sum'),
        pass_tds=('pass_touchdown', 'sum'),
        ints=('interception', 'sum'),
        epa_total=('epa', 'sum')
    ).reset_index()
    qb_df.rename(columns={pass_id_col: 'player_id'}, inplace=True)
    qb_df['aypa'] = np.where(qb_df['att'] > 0, (qb_df['pass_yards'] + 20 * qb_df['pass_tds'] - 45 * qb_df['ints']) / qb_df['att'], np.nan)
    qb_df['epa_per_play'] = np.where(qb_df['att'] > 0, qb_df['epa_total'] / qb_df['att'], np.nan)
else:
    qb_df = pd.DataFrame(columns=['player_id','att','pass_yards','pass_tds','ints','epa_total','aypa','epa_per_play'])

# merge team aggregates into receiver table
rec_df = pd.merge(rec_df, base_df[['player_id','team','position']], on='player_id', how='left')
rec_df = pd.merge(rec_df, team_pass_att, left_on='team', right_on='posteam', how='left').drop(columns=['posteam'])
rec_df = pd.merge(rec_df, team_air_yards, left_on='team', right_on='posteam', how='left').drop(columns=['posteam'])

# compute receiving metrics with safe division
rec_df['target_share'] = np.where(rec_df['team_pass_att'] > 0, rec_df['targets'] / rec_df['team_pass_att'], np.nan)
rec_df['air_yards_share'] = np.where(rec_df['team_air_yards'] > 0, rec_df['air_yards'] / rec_df['team_air_yards'], np.nan)
rec_df['adot'] = np.where(rec_df['targets'] > 0, rec_df['air_yards'] / rec_df['targets'], np.nan)
rec_df['racr'] = np.where((rec_df['air_yards'].notna()) & (rec_df['air_yards'] != 0), rec_df['rec_yards'] / rec_df['air_yards'], np.nan)
rec_df['wopr'] = 1.5 * rec_df['target_share'] + 0.7 * rec_df['air_yards_share']

# Combine into advanced_df
advanced_df = base_df.copy()
advanced_df['yprr'] = np.nan  # Set to null as routes not available in PBP

# Merge receiving metrics
advanced_df = pd.merge(advanced_df, rec_df[['player_id', 'adot', 'racr', 'target_share', 'wopr']], on='player_id', how='left')

# Merge rushing metrics
advanced_df = pd.merge(advanced_df, rush_df[['player_id', 'rush_expl_10p']], on='player_id', how='left')

# Merge QB metrics
advanced_df = pd.merge(advanced_df, qb_df[['player_id', 'aypa', 'epa_per_play']], on='player_id', how='left')

# Reorder columns to match schema
schema_columns = [
    'player_id', 'player_name', 'team', 'position', 'games',
    'adot', 'yprr', 'racr', 'target_share', 'wopr',
    'rush_expl_10p', 'aypa', 'epa_per_play'
]
advanced_df = advanced_df.reindex(columns=schema_columns, fill_value=np.nan)

# Save to CSV
advanced_df.to_csv('data/player_advanced_2024.csv', index=False)

print("2024 player advanced data computed and saved to data/player_advanced_2024.csv")
print(f"Generated {len(advanced_df)} player records")