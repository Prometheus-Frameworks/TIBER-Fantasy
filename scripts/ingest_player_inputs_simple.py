import nfl_data_py as nfl
import pandas as pd
import numpy as np
import argparse
import os

def safe_merge_columns(df1, df2, on, columns, how='left'):
    """Safely merge DataFrames, only using columns that exist"""
    if df2.empty:
        # Add missing columns with NaN values
        for col in columns:
            if col not in on:  # Don't add join keys
                df1[col] = np.nan
        return df1
    
    # Filter to only existing columns
    available_cols = [col for col in columns if col in df2.columns]
    if not available_cols:
        # Add all missing columns with NaN
        for col in columns:
            if col not in on:
                df1[col] = np.nan
        return df1
    
    return df1.merge(df2[available_cols], on=on, how=how)

def compute_sos_ctx(team, week, year=2024):
    """Simple SOS computation - returns neutral score of 50 for now"""
    return 50.0  # Simplified for initial version

def main(year=2024, weeks=list(range(6,9))):
    print(f"🏈 Ingesting player inputs for {year}, weeks {min(weeks)}-{max(weeks)}...")
    
    # Create placeholder defense context if needed
    defense_context_file = 'defense_context_2024.csv'
    if not os.path.exists(defense_context_file):
        print(f"⚠️  Creating minimal defense context...")
        teams = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 
                'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA', 
                'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WSH']
        
        defense_data = []
        for week in range(1, 19):
            for team in teams:
                defense_data.append({
                    'week': week,
                    'def_team': team,
                    'epa_per_play_allowed': np.random.normal(0, 0.1),
                    'plays_allowed_per_game': np.random.normal(65, 5),
                    'rz_td_rate_allowed': np.random.normal(0.55, 0.1),
                })
        pd.DataFrame(defense_data).to_csv(defense_context_file, index=False)
        print(f"✅ Created placeholder {defense_context_file}")
    
    # Load NFL data
    print("📊 Loading NFL data...")
    
    # Load snap counts
    try:
        snaps = nfl.import_snap_counts([year])
        snaps = snaps[snaps['week'].isin(weeks)]
        snaps = snaps[snaps['position'].isin(['QB', 'RB', 'WR', 'TE'])]
        print(f"📊 Loaded {len(snaps)} snap count records")
    except Exception as e:
        print(f"⚠️  Snap counts failed: {e}")
        snaps = pd.DataFrame()
    
    # Load weekly stats
    try:
        weekly = nfl.import_weekly_data([year])
        weekly = weekly[weekly['week'].isin(weeks)]
        print(f"📊 Loaded {len(weekly)} weekly stat records")
    except Exception as e:
        print(f"⚠️  Weekly data failed: {e}")
        weekly = pd.DataFrame()
    
    # Load play-by-play for EPA (simplified)
    try:
        pbp = nfl.import_pbp_data([year])
        pbp = pbp[pbp['week'].isin(weeks)]
        print(f"📊 Loaded {len(pbp)} play-by-play records")
    except Exception as e:
        print(f"⚠️  Play-by-play failed: {e}")
        pbp = pd.DataFrame()
    
    # Start with snap counts as base
    if not snaps.empty:
        # Map snap count columns
        id_col = 'player' if 'player' in snaps.columns else 'pfr_player_id'
        df = snaps[[id_col, 'week', 'position', 'team', 'offense_snaps', 'offense_pct']].copy()
        df = df.rename(columns={
            id_col: 'player_id',
            'offense_pct': 'snap_pct'
        })
        
        # Convert snap_pct to percentage (0-100)
        df['snap_pct'] = df['snap_pct'] * 100
        
        print(f"📊 Base dataframe: {len(df)} records")
    else:
        print("❌ No snap count data available")
        return
    
    df['season'] = year
    
    # Merge weekly stats if available
    if not weekly.empty:
        weekly_cols = ['player_id', 'week', 'carries', 'rushing_yards', 'receptions', 'receiving_yards', 'targets']
        # Only use columns that exist
        available_weekly_cols = ['player_id', 'week'] + [col for col in weekly_cols if col in weekly.columns]
        
        df = safe_merge_columns(df, weekly, on=['player_id', 'week'], columns=available_weekly_cols)
        print(f"📊 After weekly merge: {len(df)} records")
    else:
        # Add placeholder columns
        df['carries'] = 0
        df['rushing_yards'] = 0
        df['receptions'] = 0
        df['receiving_yards'] = 0
        df['targets'] = 0
    
    # Calculate basic shares (simplified)
    if not weekly.empty:
        try:
            # Team totals for share calculations
            team_totals = weekly.groupby(['recent_team', 'week']).agg({
                'carries': 'sum',
                'targets': 'sum'
            }).reset_index()
            team_totals = team_totals.rename(columns={'recent_team': 'team'})
            
            df = df.merge(team_totals, on=['team', 'week'], how='left', suffixes=('', '_team'))
            
            # Calculate shares as percentages
            df['rush_share'] = ((df['carries'] / df['carries_team'].replace(0, np.nan)) * 100).fillna(0)
            df['target_share'] = ((df['targets'] / df['targets_team'].replace(0, np.nan)) * 100).fillna(0)
        except Exception as e:
            print(f"⚠️  Share calculation failed: {e}")
            df['rush_share'] = 0
            df['target_share'] = 0
    else:
        df['rush_share'] = 0
        df['target_share'] = 0
    
    # Add placeholder/derived metrics
    print("📊 Adding derived metrics...")
    
    # Routes (estimate based on targets for pass catchers)
    df['routes'] = np.where(
        df['position'].isin(['WR', 'TE']),
        np.maximum(df['targets'] * np.random.uniform(1.5, 2.5, len(df)), df['targets']),
        0
    )
    
    # TPRR (targets per route run)
    df['tprr'] = np.where(
        (df['position'].isin(['WR', 'TE'])) & (df['routes'] > 0),
        df['targets'] / df['routes'],
        0
    )
    
    # Situational usage (simplified estimates)
    df['goalline_share'] = np.where(
        df['position'] == 'RB',
        np.minimum(df['carries'] * 0.15, 100),  # Estimate from carries
        np.minimum(df['targets'] * 0.1, 50)     # Estimate from targets
    )
    
    df['two_min_share'] = df['goalline_share'] * np.random.uniform(0.7, 1.3, len(df))
    
    # Efficiency metrics
    df['yprr'] = np.where(
        (df['position'].isin(['WR', 'TE'])) & (df['routes'] > 0),
        df['receiving_yards'] / df['routes'],
        0
    )
    
    df['yac_per_rec'] = np.where(
        df['receptions'] > 0,
        df['receiving_yards'] / df['receptions'],
        0
    )
    
    # Placeholders for premium metrics
    df['mtf'] = np.random.uniform(0, 3, len(df))  # Missed tackles forced
    df['succ_rate'] = np.random.uniform(0.3, 0.7, len(df))  # Success rate
    df['epa_per_play_qb'] = np.where(df['position'] == 'QB', np.random.uniform(-0.1, 0.3, len(df)), 0)
    
    # Team environment (placeholders)
    df['team_epa_play'] = np.random.uniform(-0.1, 0.2, len(df))
    df['team_pace'] = np.random.uniform(55, 75, len(df))
    df['team_rz_plays'] = np.random.uniform(8, 15, len(df))
    
    # Health status
    df['injury_status'] = 'healthy'
    df['dnp_weeks_rolling'] = 0
    
    # SOS context
    df['sos_ctx'] = df.apply(lambda row: compute_sos_ctx(row['team'], row['week'], year), axis=1)
    
    # Final column selection and cleanup
    final_columns = [
        'player_id', 'season', 'week', 'position', 'team',
        'snap_pct', 'routes', 'tprr', 'rush_share', 'target_share',
        'goalline_share', 'two_min_share', 'yprr', 'yac_per_rec', 'mtf',
        'succ_rate', 'epa_per_play_qb', 'team_epa_play', 'team_pace', 'team_rz_plays',
        'injury_status', 'dnp_weeks_rolling', 'sos_ctx'
    ]
    
    df_final = df[final_columns].copy()
    
    # Fill any remaining NaN values
    df_final = df_final.fillna(0)
    
    # Ensure numeric columns are proper type
    numeric_cols = [
        'snap_pct', 'routes', 'tprr', 'rush_share', 'target_share',
        'goalline_share', 'two_min_share', 'yprr', 'yac_per_rec', 'mtf',
        'succ_rate', 'epa_per_play_qb', 'team_epa_play', 'team_pace', 'team_rz_plays',
        'dnp_weeks_rolling', 'sos_ctx'
    ]
    
    for col in numeric_cols:
        df_final[col] = pd.to_numeric(df_final[col], errors='coerce').fillna(0)
    
    path = f'player_inputs_{year}.csv'
    df_final.to_csv(path, index=False)
    print(f'✅ Saved player inputs to {path} with {len(df_final)} rows')
    print(f"📊 Position breakdown: {df_final['position'].value_counts().to_dict()}")
    print(f"📊 Week breakdown: {df_final['week'].value_counts().sort_index().to_dict()}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, default=2024)
    parser.add_argument('--weeks', type=str, default='6-8')
    args = parser.parse_args()
    
    start, end = map(int, args.weeks.split('-'))
    weeks = list(range(start, end + 1))
    main(args.year, weeks)