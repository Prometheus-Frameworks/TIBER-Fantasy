import nfl_data_py as nfl
import pandas as pd
import numpy as np
import os
import psycopg2
from urllib.parse import urlparse

# Get database connection from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ DATABASE_URL environment variable not found")
    exit(1)

# Parse database URL
db_params = urlparse(DATABASE_URL)

print("🔄 Loading existing player data from database...")

# Connect to database and get base player data
try:
    conn = psycopg2.connect(
        host=db_params.hostname,
        port=db_params.port,
        database=db_params.path[1:],  # Remove leading slash
        user=db_params.username,
        password=db_params.password
    )
    
    # Get player base data from our existing table
    query = """
    SELECT player_id, player_name, team, position, games 
    FROM player_season_2024 
    WHERE position IN ('QB', 'RB', 'WR', 'TE')
    ORDER BY player_name
    """
    
    base_df = pd.read_sql(query, conn)
    conn.close()
    
    print(f"✅ Loaded {len(base_df)} players from database")
    
except Exception as e:
    print(f"❌ Database error: {e}")
    exit(1)

# Load PBP data for advanced metrics
year = 2024
print("🔄 Loading play-by-play data for advanced metrics...")

pbp = nfl.import_pbp_data([year])
pbp = pbp[pbp['season_type'] == 'REG']
print(f"✅ Loaded {len(pbp)} PBP records")

# Team-level aggregates for share calculations
print("📊 Computing team-level aggregates...")
team_pass_att = pbp[pbp['pass_attempt'] == 1].groupby('posteam').size().reset_index(name='team_pass_att')

# Team air yards
air_col = 'air_yards'
if air_col in pbp.columns:
    team_air_yards = pbp[pbp['pass_attempt'] == 1].groupby('posteam')[air_col].sum(min_count=1).reset_index(name='team_air_yards')
else:
    team_air_yards = pd.DataFrame(columns=['posteam', 'team_air_yards'])

# Player receiving metrics
print("🎯 Computing receiving metrics...")

# Check available columns first
print(f"  Available PBP columns: {sorted([col for col in pbp.columns if any(x in col.lower() for x in ['receiver', 'receiving', 'air', 'target'])])}")

recv_id_col = None
if 'receiver_id' in pbp.columns:
    recv_id_col = 'receiver_id'
elif 'receiver_player_id' in pbp.columns:
    recv_id_col = 'receiver_player_id'

receiving_yards_col = None
if 'receiving_yards' in pbp.columns:
    receiving_yards_col = 'receiving_yards'
elif 'yards_gained' in pbp.columns:
    receiving_yards_col = 'yards_gained'

if recv_id_col and recv_id_col in pbp.columns:
    rec_mask = (pbp['pass_attempt'] == 1) & (pbp[recv_id_col].notna())
    
    # Use the actual PBP data structure
    rec_df = pbp[rec_mask].groupby(recv_id_col).agg({
        'play_id': 'count',  # This will be targets
        'receiving_yards': 'sum',  # Receiving yards
        'air_yards': 'sum' if air_col in pbp.columns else lambda x: 0  # Air yards
    }).reset_index()
    
    rec_df.rename(columns={
        recv_id_col: 'player_id',
        'play_id': 'targets',
        'receiving_yards': 'rec_yards'
    }, inplace=True)
    
    # Handle case where air_yards column doesn't exist
    if air_col not in pbp.columns:
        rec_df['air_yards'] = 0
    
    # Merge with base data for team info
    rec_df = pd.merge(rec_df, base_df[['player_id', 'team']], on='player_id', how='inner')
    
    # Add team aggregates
    rec_df = pd.merge(rec_df, team_pass_att, left_on='team', right_on='posteam', how='left')
    if not team_air_yards.empty:
        rec_df = pd.merge(rec_df, team_air_yards, left_on='team', right_on='posteam', how='left')
    
    # Calculate metrics with safe division
    rec_df['target_share'] = np.where(rec_df['team_pass_att'] > 0,
                                     rec_df['targets'] / rec_df['team_pass_att'], np.nan)
    
    if 'air_yards' in rec_df.columns:
        rec_df['air_yards_share'] = np.where((rec_df['team_air_yards'] > 0) & (rec_df['team_air_yards'].notna()),
                                           rec_df['air_yards'] / rec_df['team_air_yards'], np.nan)
        rec_df['adot'] = np.where(rec_df['targets'] > 0,
                                rec_df['air_yards'] / rec_df['targets'], np.nan)
        
        # Safe RACR calculation - handle air_yards = 0 and missing rec_yards
        if 'rec_yards' in rec_df.columns:
            rec_df['racr'] = np.where((rec_df['air_yards'] > 0) & (rec_df['air_yards'].notna()),
                                    rec_df['rec_yards'] / rec_df['air_yards'], np.nan)
        else:
            rec_df['racr'] = np.nan
            
        rec_df['wopr'] = np.where((rec_df['target_share'].notna()) & (rec_df['air_yards_share'].notna()),
                                1.5 * rec_df['target_share'] + 0.7 * rec_df['air_yards_share'], np.nan)
    else:
        # No air yards data available
        rec_df['air_yards_share'] = np.nan
        rec_df['adot'] = np.nan
        rec_df['racr'] = np.nan
        rec_df['wopr'] = np.nan
    
    print(f"  Computed receiving metrics for {len(rec_df)} players")
else:
    rec_df = pd.DataFrame()
    print("  ⚠️ No receiver ID column found in PBP data")

# Rushing metrics
print("🏃 Computing rushing metrics...")
rush_id_col = 'rusher_id' if 'rusher_id' in pbp.columns else 'rusher_player_id'

if rush_id_col in pbp.columns:
    rush_df = pbp[pbp['rush_attempt'] == 1].groupby(rush_id_col).agg(
        rush_att=('play_id', 'count'),
        expl_rushes=('rushing_yards', lambda x: (x >= 10).sum())
    ).reset_index()
    rush_df.rename(columns={rush_id_col: 'player_id'}, inplace=True)
    rush_df['rush_expl_10p'] = np.where(rush_df['rush_att'] > 0,
                                      rush_df['expl_rushes'] / rush_df['rush_att'], np.nan)
    print(f"  Computed rushing metrics for {len(rush_df)} players")
else:
    rush_df = pd.DataFrame()
    print("  ⚠️ No rusher ID column found in PBP data")

# QB metrics
print("🎯 Computing QB metrics...")
pass_id_col = 'passer_id' if 'passer_id' in pbp.columns else 'passer_player_id'

if pass_id_col in pbp.columns:
    qb_df = pbp[pbp['pass_attempt'] == 1].groupby(pass_id_col).agg(
        att=('play_id', 'count'),
        pass_yards=('passing_yards', 'sum'),
        pass_tds=('pass_touchdown', 'sum'),
        ints=('interception', 'sum'),
        epa_total=('epa', 'sum')
    ).reset_index()
    qb_df.rename(columns={pass_id_col: 'player_id'}, inplace=True)
    
    # Calculate AYPA and EPA per play
    qb_df['aypa'] = np.where(qb_df['att'] > 0,
                           (qb_df['pass_yards'] + 20 * qb_df['pass_tds'] - 45 * qb_df['ints']) / qb_df['att'],
                           np.nan)
    qb_df['epa_per_play'] = np.where(qb_df['att'] > 0,
                                   qb_df['epa_total'] / qb_df['att'], np.nan)
    print(f"  Computed QB metrics for {len(qb_df)} players")
else:
    qb_df = pd.DataFrame()
    print("  ⚠️ No passer ID column found in PBP data")

# Combine all metrics
print("🔄 Combining advanced metrics...")
advanced_df = base_df.copy()

# Initialize advanced columns
advanced_cols = ['adot', 'yprr', 'racr', 'target_share', 'wopr', 'rush_expl_10p', 'aypa', 'epa_per_play']
for col in advanced_cols:
    advanced_df[col] = np.nan

# Set yprr to null (routes not available in public PBP data)
advanced_df['yprr'] = np.nan

# Merge receiving metrics
if not rec_df.empty:
    merge_cols = ['player_id']
    for col in ['adot', 'racr', 'target_share', 'wopr']:
        if col in rec_df.columns:
            merge_cols.append(col)
    
    if len(merge_cols) > 1:  # Only merge if we have metrics to merge
        advanced_df = pd.merge(advanced_df, rec_df[merge_cols], on='player_id', how='left', suffixes=('', '_new'))
        
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

# Final schema columns
schema_columns = [
    'player_id', 'player_name', 'team', 'position', 'games',
    'adot', 'yprr', 'racr', 'target_share', 'wopr',
    'rush_expl_10p', 'aypa', 'epa_per_play'
]

advanced_df = advanced_df[schema_columns]

# Create data directory
os.makedirs('data', exist_ok=True)

# Save to CSV
csv_path = 'data/player_advanced_2024.csv'
advanced_df.to_csv(csv_path, index=False)

print(f"✅ Generated advanced metrics for {len(advanced_df)} players")
print(f"📁 Saved to {csv_path}")

# Show sample data
print("\n📊 Sample advanced metrics:")
if not rec_df.empty:
    sample_wr = advanced_df[(advanced_df['position'] == 'WR') & (advanced_df['target_share'].notna())].head(2)
    for _, player in sample_wr.iterrows():
        print(f"  {player['player_name']} (WR): Target Share={player['target_share']:.3f}, ADOT={player['adot']:.1f}, RACR={player['racr']:.2f}")

if not rush_df.empty:
    sample_rb = advanced_df[(advanced_df['position'] == 'RB') & (advanced_df['rush_expl_10p'].notna())].head(2)  
    for _, player in sample_rb.iterrows():
        print(f"  {player['player_name']} (RB): Explosive Rush %={player['rush_expl_10p']:.3f}")

if not qb_df.empty:
    sample_qb = advanced_df[(advanced_df['position'] == 'QB') & (advanced_df['epa_per_play'].notna())].head(2)
    for _, player in sample_qb.iterrows():
        print(f"  {player['player_name']} (QB): AYPA={player['aypa']:.2f}, EPA/Play={player['epa_per_play']:.3f}")

print(f"\n🎯 Metrics summary:")
print(f"  Target share data: {advanced_df['target_share'].notna().sum()} players")
print(f"  ADOT data: {advanced_df['adot'].notna().sum()} players")
print(f"  RACR data: {advanced_df['racr'].notna().sum()} players")
print(f"  Explosive rush data: {advanced_df['rush_expl_10p'].notna().sum()} players")
print(f"  QB AYPA data: {advanced_df['aypa'].notna().sum()} players")
print(f"  EPA per play data: {advanced_df['epa_per_play'].notna().sum()} players")
print("\n✅ Advanced metrics ingest complete!")