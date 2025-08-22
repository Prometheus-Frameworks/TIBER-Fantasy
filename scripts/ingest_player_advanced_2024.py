import nfl_data_py as nfl
import pandas as pd
import numpy as np
import os

# Define the year
year = 2024

print(f"🔄 Loading seasonal data for {year}...")

# Load seasonal player data for base information
seasonal_df = nfl.import_seasonal_data([year])

print(f"✅ Loaded {len(seasonal_df)} seasonal records")

# Filter to regular season if season_type exists
if 'season_type' in seasonal_df.columns:
    seasonal_df = seasonal_df[seasonal_df['season_type'] == 'REG']
    print(f"📋 After regular season filter: {len(seasonal_df)} records")

# Load roster data to get position information
print("🔄 Loading roster data for position mapping...")
rosters_df = nfl.import_rosters([year])

# Create player ID to position mapping
if 'gsis_id' in rosters_df.columns and 'position' in rosters_df.columns:
    position_map = rosters_df.set_index('gsis_id')['position'].to_dict()
    seasonal_df['position'] = seasonal_df['player_id'].map(position_map)
    print(f"📋 Mapped positions for players")

# Filter for skill positions only
skill_positions = ['QB', 'RB', 'WR', 'TE']
seasonal_df = seasonal_df[seasonal_df['position'].isin(skill_positions)]
print(f"📋 After position filter: {len(seasonal_df)} skill position players")

# Handle team mapping - use most recent team
if 'recent_team' not in seasonal_df.columns:
    # If no recent_team, try to get team from rosters
    team_map = rosters_df.set_index('gsis_id')['team'].to_dict() if 'team' in rosters_df.columns else {}
    seasonal_df['recent_team'] = seasonal_df['player_id'].map(team_map)

# Create base dataframe
base_df = seasonal_df[['player_id', 'season', 'games']].copy()

# Add player names from rosters
if 'full_name' in rosters_df.columns:
    name_map = rosters_df.set_index('gsis_id')['full_name'].to_dict()
    base_df['player_name'] = base_df['player_id'].map(name_map)
elif 'display_name' in rosters_df.columns:
    name_map = rosters_df.set_index('gsis_id')['display_name'].to_dict()
    base_df['player_name'] = base_df['player_id'].map(name_map)

# Add team and position
base_df['team'] = seasonal_df['recent_team'].values
base_df['position'] = seasonal_df['position'].values

print(f"📊 Base dataframe: {len(base_df)} records")

# Load PBP data for advanced metrics
print("🔄 Loading play-by-play data...")
pbp = nfl.import_pbp_data([year])
pbp = pbp[pbp['season_type'] == 'REG']
print(f"✅ Loaded {len(pbp)} PBP records")

# Identify robust ID columns for PBP
recv_id_col = 'receiver_id' if 'receiver_id' in pbp.columns else 'receiver_player_id'
rush_id_col = 'rusher_id' if 'rusher_id' in pbp.columns else 'rusher_player_id'  
pass_id_col = 'passer_id' if 'passer_id' in pbp.columns else 'passer_player_id'

print(f"📋 Using ID columns: receiver={recv_id_col}, rusher={rush_id_col}, passer={pass_id_col}")

# Team-level aggregates for target share calculations
team_pass_att = pbp[pbp['pass_attempt'] == 1].groupby('posteam').size().reset_index(name='team_pass_att')

# Team air yards for air yards share
air_col = 'air_yards' if 'air_yards' in pbp.columns else None
if air_col:
    team_air_yards = pbp[pbp['pass_attempt'] == 1].groupby('posteam')[air_col].sum(min_count=1).reset_index(name='team_air_yards')
else:
    team_air_yards = pd.DataFrame(columns=['posteam', 'team_air_yards'])

# Receiving metrics aggregation
if recv_id_col in pbp.columns:
    rec_mask = (pbp['pass_attempt'] == 1) & (pbp[recv_id_col].notna())
    rec_agg = {
        'targets': ('play_id', 'count'),
        'rec_yards': ('receiving_yards', 'sum')
    }
    if air_col:
        rec_agg['air_yards'] = (air_col, 'sum')
    
    rec_df = pbp[rec_mask].groupby(recv_id_col).agg(rec_agg).reset_index()
    rec_df.rename(columns={recv_id_col: 'player_id'}, inplace=True)
    
    # Add team info for shares calculation
    rec_df = pd.merge(rec_df, base_df[['player_id', 'team']], on='player_id', how='left')
    rec_df = pd.merge(rec_df, team_pass_att, left_on='team', right_on='posteam', how='left')
    if not team_air_yards.empty:
        rec_df = pd.merge(rec_df, team_air_yards, left_on='team', right_on='posteam', how='left')
    
    # Calculate advanced receiving metrics with safe division
    rec_df['target_share'] = np.where(rec_df['team_pass_att'] > 0, 
                                     rec_df['targets'] / rec_df['team_pass_att'], np.nan)
    
    if air_col:
        rec_df['air_yards_share'] = np.where(rec_df['team_air_yards'] > 0,
                                           rec_df['air_yards'] / rec_df['team_air_yards'], np.nan)
        rec_df['adot'] = np.where(rec_df['targets'] > 0,
                                rec_df['air_yards'] / rec_df['targets'], np.nan)
        rec_df['racr'] = np.where((rec_df['air_yards'] > 0) & (rec_df['air_yards'].notna()),
                                rec_df['rec_yards'] / rec_df['air_yards'], np.nan)
        rec_df['wopr'] = 1.5 * rec_df['target_share'] + 0.7 * rec_df['air_yards_share']
    else:
        rec_df[['air_yards_share', 'adot', 'racr', 'wopr']] = np.nan
        
else:
    rec_df = pd.DataFrame()

# Rushing metrics (explosive rush percentage)
if rush_id_col in pbp.columns:
    rush_df = pbp[pbp['rush_attempt'] == 1].groupby(rush_id_col).agg(
        rush_att=('play_id', 'count'),
        expl_rushes=('rushing_yards', lambda x: (x >= 10).sum())
    ).reset_index()
    rush_df.rename(columns={rush_id_col: 'player_id'}, inplace=True)
    rush_df['rush_expl_10p'] = np.where(rush_df['rush_att'] > 0,
                                      rush_df['expl_rushes'] / rush_df['rush_att'], np.nan)
else:
    rush_df = pd.DataFrame()

# QB metrics (AYPA and EPA per play)
if pass_id_col in pbp.columns:
    qb_df = pbp[pbp['pass_attempt'] == 1].groupby(pass_id_col).agg(
        att=('play_id', 'count'),
        pass_yards=('passing_yards', 'sum'),
        pass_tds=('pass_touchdown', 'sum'),
        ints=('interception', 'sum'),
        epa_total=('epa', 'sum')
    ).reset_index()
    qb_df.rename(columns={pass_id_col: 'player_id'}, inplace=True)
    
    # Calculate AYPA (Adjusted Yards Per Attempt)
    qb_df['aypa'] = np.where(qb_df['att'] > 0,
                           (qb_df['pass_yards'] + 20 * qb_df['pass_tds'] - 45 * qb_df['ints']) / qb_df['att'], 
                           np.nan)
    
    # Calculate EPA per play
    qb_df['epa_per_play'] = np.where(qb_df['att'] > 0,
                                   qb_df['epa_total'] / qb_df['att'], np.nan)
else:
    qb_df = pd.DataFrame()

# Combine all advanced metrics
print("🔄 Combining advanced metrics...")
advanced_df = base_df.copy()

# Initialize all advanced columns with NaN
advanced_cols = ['adot', 'yprr', 'racr', 'target_share', 'wopr', 'rush_expl_10p', 'aypa', 'epa_per_play']
for col in advanced_cols:
    advanced_df[col] = np.nan

# Set yprr to null explicitly (routes not available in public PBP)
advanced_df['yprr'] = np.nan

# Merge receiving metrics
if not rec_df.empty:
    merge_cols = ['player_id'] + [col for col in ['adot', 'racr', 'target_share', 'wopr'] if col in rec_df.columns]
    advanced_df = pd.merge(advanced_df, rec_df[merge_cols], on='player_id', how='left', suffixes=('', '_new'))
    
    # Update columns with new values where available
    for col in ['adot', 'racr', 'target_share', 'wopr']:
        if f'{col}_new' in advanced_df.columns:
            advanced_df[col] = advanced_df[f'{col}_new']
            advanced_df.drop(columns=[f'{col}_new'], inplace=True)

# Merge rushing metrics
if not rush_df.empty:
    advanced_df = pd.merge(advanced_df, rush_df[['player_id', 'rush_expl_10p']], on='player_id', how='left', suffixes=('', '_new'))
    if 'rush_expl_10p_new' in advanced_df.columns:
        advanced_df['rush_expl_10p'] = advanced_df['rush_expl_10p_new']
        advanced_df.drop(columns=['rush_expl_10p_new'], inplace=True)

# Merge QB metrics
if not qb_df.empty:
    advanced_df = pd.merge(advanced_df, qb_df[['player_id', 'aypa', 'epa_per_play']], on='player_id', how='left', suffixes=('', '_new'))
    for col in ['aypa', 'epa_per_play']:
        if f'{col}_new' in advanced_df.columns:
            advanced_df[col] = advanced_df[f'{col}_new']
            advanced_df.drop(columns=[f'{col}_new'], inplace=True)

# Final schema ordering
schema_columns = [
    'player_id', 'player_name', 'team', 'position', 'games',
    'adot', 'yprr', 'racr', 'target_share', 'wopr',
    'rush_expl_10p', 'aypa', 'epa_per_play'
]

# Ensure all columns exist and reorder
for col in schema_columns:
    if col not in advanced_df.columns:
        advanced_df[col] = np.nan

advanced_df = advanced_df[schema_columns]

# Create data directory if it doesn't exist
os.makedirs('data', exist_ok=True)

# Save to CSV
csv_path = 'data/player_advanced_2024.csv'
advanced_df.to_csv(csv_path, index=False)

print(f"✅ Generated advanced metrics for {len(advanced_df)} players")
print(f"📁 Saved to {csv_path}")

# Show some sample metrics
print("\n📊 Sample advanced metrics:")
sample_players = advanced_df[advanced_df['target_share'].notna()].head(3)
for _, player in sample_players.iterrows():
    print(f"  {player['player_name']} ({player['position']}) - Target Share: {player['target_share']:.3f}, ADOT: {player['adot']:.1f}")

print(f"\n🎯 Metrics summary:")
print(f"  Players with target_share: {advanced_df['target_share'].notna().sum()}")
print(f"  Players with rush_expl_10p: {advanced_df['rush_expl_10p'].notna().sum()}")
print(f"  Players with epa_per_play: {advanced_df['epa_per_play'].notna().sum()}")
print("\n✅ Advanced metrics ingest complete!")