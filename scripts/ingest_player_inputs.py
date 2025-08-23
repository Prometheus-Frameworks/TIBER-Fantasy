import nfl_data_py as nfl
import pandas as pd
import numpy as np
import argparse
import os

def percentile_scale(values, v):
    if len(values) == 0 or pd.isna(v): return 50
    sorted_vals = np.sort([x for x in values if not pd.isna(x)])
    if len(sorted_vals) == 0: return 50
    rank = np.searchsorted(sorted_vals, v, side='right')
    return (rank / len(sorted_vals)) * 100

def compute_sos_ctx(df_schedule, df_context, position, team, week, window=3):
    # Simplified v2 SOS compute for next window weeks
    upcoming_weeks = list(range(week, min(week + window, 19)))  # Cap at week 18
    opponents = []
    
    for w in upcoming_weeks:
        if w > 18: continue  # No games beyond week 18
        game = df_schedule[(df_schedule['week'] == w) & 
                          ((df_schedule['home'] == team) | (df_schedule['away'] == team))]
        if not game.empty:
            home_team = game['home'].values[0]
            away_team = game['away'].values[0] 
            opp = away_team if home_team == team else home_team
            opponents.append((w, opp))
    
    if not opponents: return 50  # Default neutral
    
    scores = []
    default_weights = [0.55, 0.2, 0.15, 0.1]  # fpa, epa, pace, rz
    
    for w, opp in opponents:
        ctx = df_context[(df_context['week'] == w) & (df_context['def_team'] == opp)]
        if ctx.empty: 
            scores.append(50)  # Default neutral
            continue
            
        # Get defensive context stats (higher = easier for offense)
        try:
            epa_list = df_context['epa_per_play_allowed'].dropna().values
            pace_list = df_context['plays_allowed_per_game'].dropna().values
            rz_list = df_context['rz_td_rate_allowed'].dropna().values
            
            # Use actual values or defaults
            epa_allowed = ctx['epa_per_play_allowed'].values[0] if not ctx['epa_per_play_allowed'].isna().any() else 0
            pace_allowed = ctx['plays_allowed_per_game'].values[0] if not ctx['plays_allowed_per_game'].isna().any() else 65
            rz_allowed = ctx['rz_td_rate_allowed'].values[0] if not ctx['rz_td_rate_allowed'].isna().any() else 0.5
            
            # Placeholder for fpa (fantasy points allowed) - would need external data
            fpa = np.random.uniform(15, 25)  # Placeholder; load from defense_dvp.csv if available
            
            fpa_p = percentile_scale(np.array([10, 30]), fpa)
            epa_p = percentile_scale(epa_list, epa_allowed) 
            pace_p = percentile_scale(pace_list, pace_allowed)
            rz_p = percentile_scale(rz_list, rz_allowed)
            
            score = np.dot(default_weights, [fpa_p, epa_p, pace_p, rz_p])
            
            # Home/away adjustment (small)
            home_adj = ctx.get('home_def_adj', pd.Series([0])).values[0] if 'home_def_adj' in ctx.columns else 0
            away_adj = ctx.get('away_def_adj', pd.Series([0])).values[0] if 'away_def_adj' in ctx.columns else 0
            
            # Determine if team is home or away for this game
            game_info = df_schedule[(df_schedule['week'] == w) & 
                                   ((df_schedule['home'] == team) | (df_schedule['away'] == team))]
            if not game_info.empty:
                is_home = game_info['home'].values[0] == team
                adj = home_adj if is_home else away_adj
                score += adj * 2  # Small adjustment
            
            scores.append(np.clip(score, 0, 100))
        except Exception as e:
            print(f"Warning: SOS computation failed for {team} vs {opp} week {w}: {e}")
            scores.append(50)
    
    return np.mean(scores) if scores else 50

def main(year=2024, weeks=list(range(1,18))):
    print(f"🏈 Ingesting player inputs for {year}, weeks {min(weeks)}-{max(weeks)}...")
    
    # Check if defense context exists
    defense_context_file = 'defense_context_2024.csv'
    if not os.path.exists(defense_context_file):
        print(f"⚠️  Warning: {defense_context_file} not found. Creating placeholder defense context...")
        # Create minimal defense context for SOS computation
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
                    'home_def_adj': np.random.normal(0, 0.02),
                    'away_def_adj': np.random.normal(0, 0.02)
                })
        pd.DataFrame(defense_data).to_csv(defense_context_file, index=False)
        print(f"✅ Created placeholder {defense_context_file}")
    
    # Load prerequisites
    print("📊 Loading NFL data...")
    df_schedule = nfl.import_schedules([year])[['season', 'week', 'home_team', 'away_team']].rename(
        columns={'home_team': 'home', 'away_team': 'away'})
    df_context = pd.read_csv(defense_context_file)
    
    # Load snap counts
    try:
        snaps = nfl.import_snap_counts([year])
    except Exception as e:
        print(f"⚠️  Snap counts not available: {e}")
        snaps = pd.DataFrame()
    snaps = snaps[snaps['week'].isin(weeks)]
    snaps = snaps[snaps['position'].isin(['QB', 'RB', 'WR', 'TE'])]
    
    # Load weekly stats
    try:
        weekly = nfl.import_weekly_data([year])
    except Exception as e:
        print(f"⚠️  Weekly data not available: {e}")
        weekly = pd.DataFrame()
    weekly = weekly[weekly['week'].isin(weeks)]
    
    # Load play-by-play for EPA
    print("📊 Loading play-by-play data (this may take a moment)...")
    try:
        pbp = nfl.import_pbp_data([year])
    except Exception as e:
        print(f"⚠️  Play-by-play data not available: {e}")
        pbp = pd.DataFrame()
    pbp = pbp[pbp['week'].isin(weeks)]
    
    # Load injury data
    try:
        injuries = nfl.import_injuries([year])
        injuries = injuries[injuries['week'].isin(weeks)]
    except:
        print("⚠️  Injury data not available, using placeholders...")
        injuries = pd.DataFrame()
    
    # Start building main dataframe from snaps
    if not snaps.empty:
        # Check available columns and map appropriately
        snap_cols = snaps.columns.tolist()
        print(f"Snap count columns: {snap_cols[:10]}...")
        
        # Use available ID column
        id_col = 'player' if 'player' in snap_cols else 'pfr_player_id' if 'pfr_player_id' in snap_cols else 'player_id'
        pct_col = 'offense_pct' if 'offense_pct' in snap_cols else 'pct_snaps_offense'
        snap_col = 'offense_snaps' if 'offense_snaps' in snap_cols else 'snaps_offense'
        
        df = snaps[[id_col, 'week', 'position', 'team', snap_col, pct_col]].rename(
            columns={id_col: 'player_id', pct_col: 'snap_pct', snap_col: 'offense_snaps'})
    else:
        # Create empty dataframe with required columns
        df = pd.DataFrame(columns=['player_id', 'week', 'position', 'team', 'snap_pct', 'offense_snaps'])
    
    df['season'] = year
    
    # Merge weekly stats
    df = df.merge(weekly[['player_id', 'week', 'carries', 'rushing_yards', 'receptions', 
                         'receiving_yards', 'targets', 'success_rate']].fillna(0), 
                  on=['player_id', 'week'], how='left')
    
    # Calculate team totals for share calculations
    weekly_team = weekly.groupby(['recent_team', 'week']).agg({
        'carries': 'sum',
        'targets': 'sum'
    }).reset_index()
    
    df = df.merge(weekly_team, left_on=['team', 'week'], right_on=['recent_team', 'week'], 
                  how='left', suffixes=('', '_team'))
    
    # Calculate shares
    df['rush_share'] = (df['carries'] / df['carries_team'].replace(0, np.nan)) * 100
    df['target_share'] = (df['targets'] / df['targets_team'].replace(0, np.nan)) * 100
    
    # Placeholders for premium metrics (would need PFF/NGS data)
    df['routes'] = np.where(df['position'].isin(['WR', 'TE']), 
                           df['targets'] * np.random.uniform(1.5, 2.5), np.nan)
    df['tprr'] = np.where(df['position'].isin(['WR', 'TE']), 
                         df['targets'] / df['routes'].replace(0, np.nan), np.nan)
    
    # Situational usage (placeholders)
    df['goalline_share'] = np.where(df['position'] == 'RB', 
                                   df['carries'] / 20 * np.random.uniform(0.8, 1.2), 
                                   df['targets'] / 40 * np.random.uniform(0.5, 1.5))
    df['two_min_share'] = df['goalline_share'] * np.random.uniform(0.7, 1.3)
    
    # Efficiency metrics
    df['yprr'] = np.where(df['position'].isin(['WR', 'TE']), 
                         df['receiving_yards'] / df['routes'].replace(0, np.nan), np.nan)
    df['yac_per_rec'] = df['receiving_yards'] / df['receptions'].replace(0, np.nan)
    df['mtf'] = np.random.uniform(0, 5) * df['carries'].fillna(0) / 20  # Placeholder
    df['succ_rate'] = df['success_rate'].fillna(0.4)
    
    # QB EPA
    qb_epa = pbp[pbp['passer_player_id'].notna()].groupby(['passer_player_id', 'week'])['epa'].mean().reset_index()
    qb_epa.columns = ['player_id', 'week', 'epa_per_play_qb']
    df = df.merge(qb_epa, on=['player_id', 'week'], how='left')
    
    # Team environment
    team_epa = pbp.groupby(['posteam', 'week'])['epa'].mean().reset_index()
    team_epa.columns = ['team', 'week', 'team_epa_play']
    df = df.merge(team_epa, on=['team', 'week'], how='left')
    
    team_pace = pbp.groupby(['posteam', 'week'])['play_id'].count().reset_index()
    team_pace.columns = ['team', 'week', 'team_pace']
    df = df.merge(team_pace, on=['team', 'week'], how='left')
    
    team_rz = pbp[pbp['yardline_100'] <= 20].groupby(['posteam', 'week'])['play_id'].count().reset_index()
    team_rz.columns = ['team', 'week', 'team_rz_plays']
    df = df.merge(team_rz, on=['team', 'week'], how='left')
    
    # Health/injury status
    if not injuries.empty:
        injury_status = injuries.groupby(['gsis_id', 'week'])['practice_status'].last().reset_index()
        injury_status.columns = ['player_id', 'week', 'injury_status']
        df = df.merge(injury_status, on=['player_id', 'week'], how='left')
        
        # DNP weeks rolling (simplified)
        dnp_counts = injuries[injuries['game_status'] == 'Out'].groupby('gsis_id')['week'].count().reset_index()
        dnp_counts.columns = ['player_id', 'dnp_weeks_rolling']
        df = df.merge(dnp_counts, on='player_id', how='left')
    else:
        df['injury_status'] = 'healthy'
        df['dnp_weeks_rolling'] = 0
    
    df['injury_status'] = df['injury_status'].fillna('healthy')
    df['dnp_weeks_rolling'] = df['dnp_weeks_rolling'].fillna(0)
    
    # Compute SOS context
    print("🎯 Computing SOS context...")
    df['sos_ctx'] = df.apply(lambda row: compute_sos_ctx(df_schedule, df_context, 
                                                        row['position'], row['team'], row['week']), axis=1)
    
    # Fill NaN values with reasonable defaults
    df = df.fillna({
        'rush_share': 0,
        'target_share': 0,
        'goalline_share': 0,
        'two_min_share': 0,
        'routes': 0,
        'tprr': 0,
        'yprr': 0,
        'yac_per_rec': 0,
        'mtf': 0,
        'epa_per_play_qb': 0,
        'team_epa_play': 0,
        'team_pace': 65,
        'team_rz_plays': 10,
        'sos_ctx': 50
    })
    
    # Select final columns
    final_columns = [
        'player_id', 'season', 'week', 'position', 'team',
        'snap_pct', 'routes', 'tprr', 'rush_share', 'target_share',
        'goalline_share', 'two_min_share', 'yprr', 'yac_per_rec', 'mtf',
        'succ_rate', 'epa_per_play_qb', 'team_epa_play', 'team_pace', 'team_rz_plays',
        'injury_status', 'dnp_weeks_rolling', 'sos_ctx'
    ]
    
    df_final = df[final_columns].copy()
    
    path = f'player_inputs_{year}.csv'
    df_final.to_csv(path, index=False)
    print(f'✅ Saved player inputs to {path} with {len(df_final)} rows')
    print(f"📊 Position breakdown: {df_final['position'].value_counts().to_dict()}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, default=2024)
    parser.add_argument('--weeks', type=str, default='1-17')
    args = parser.parse_args()
    
    start, end = map(int, args.weeks.split('-'))
    weeks = list(range(start, end + 1))
    main(args.year, weeks)