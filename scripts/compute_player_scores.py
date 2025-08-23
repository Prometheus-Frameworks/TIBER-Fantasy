import pandas as pd
import numpy as np
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import pdist
import argparse

DEFAULT_WEIGHTS = {
    'redraft': {
        'RB': {'opp': 0.45, 'eff': 0.20, 'role': 0.15, 'team': 0.10, 'health': 0.05, 'sos': 0.05},
        'WR': {'opp': 0.30, 'eff': 0.30, 'role': 0.15, 'team': 0.15, 'health': 0.05, 'sos': 0.05},
        'TE': {'opp': 0.32, 'eff': 0.23, 'role': 0.20, 'team': 0.15, 'health': 0.05, 'sos': 0.05},
        'QB': {'opp': 0.25, 'eff': 0.35, 'role': 0.15, 'team': 0.20, 'health': 0.03, 'sos': 0.02}
    },
    'dynasty': {
        'RB': {'proj3': 0.40, 'age': 0.20, 'role': 0.15, 'eff': 0.10, 'team': 0.10, 'ped': 0.05},
        'WR': {'proj3': 0.40, 'age': 0.20, 'role': 0.15, 'eff': 0.15, 'team': 0.07, 'ped': 0.03},
        'TE': {'proj3': 0.40, 'age': 0.20, 'role': 0.15, 'eff': 0.10, 'team': 0.10, 'ped': 0.05},
        'QB': {'proj3': 0.40, 'age': 0.20, 'role': 0.15, 'eff': 0.15, 'team': 0.10, 'ped': 0.00}
    }
}

REPLACEMENT_LINES = {'RB': 40, 'WR': 48, 'TE': 16, 'QB': 12}

def percentile_rank(series, value):
    """Convert value to percentile rank within series"""
    if pd.isna(value) or len(series) == 0:
        return 50
    series_clean = series.dropna()
    if len(series_clean) == 0:
        return 50
    return (series_clean < value).sum() / len(series_clean) * 100

def compute_tiers(scores, max_tiers=4):
    """Compute tiers using hierarchical clustering"""
    if len(scores) < 3:
        return [1] * len(scores)
    
    scores_array = np.array(scores).reshape(-1, 1)
    
    try:
        # Compute linkage
        distances = pdist(scores_array)
        if len(distances) == 0:
            return [1] * len(scores)
            
        linkage_matrix = linkage(distances, method='ward')
        
        # Find optimal number of clusters (2 to max_tiers)
        n_clusters = min(max_tiers, max(2, len(scores) // 3))
        clusters = fcluster(linkage_matrix, n_clusters, criterion='maxclust')
        
        # Map cluster numbers to tiers (highest scores = tier 1)
        score_cluster_pairs = list(zip(scores, clusters))
        score_cluster_pairs.sort(reverse=True)  # Sort by score descending
        
        tier_mapping = {}
        current_tier = 1
        for _, cluster in score_cluster_pairs:
            if cluster not in tier_mapping:
                tier_mapping[cluster] = current_tier
                current_tier += 1
        
        return [tier_mapping[cluster] for cluster in clusters]
    
    except Exception as e:
        print(f"Warning: Tier computation failed: {e}")
        # Fallback to simple quartile-based tiers
        quartiles = np.percentile(scores, [75, 50, 25])
        tiers = []
        for score in scores:
            if score >= quartiles[0]:
                tiers.append(1)
            elif score >= quartiles[1]:
                tiers.append(2)
            elif score >= quartiles[2]:
                tiers.append(3)
            else:
                tiers.append(4)
        return tiers

def compute_components(df_inputs, df_profile, format_type, position, weights=None):
    """Compute rating components for a position"""
    df = df_inputs[df_inputs['position'] == position].copy()
    
    if len(df) == 0:
        return pd.DataFrame()
    
    df = df.merge(df_profile[['player_id', 'name', 'age', 'contract_yrs_left']], 
                  on='player_id', how='left')
    
    if weights is None:
        weights = DEFAULT_WEIGHTS[format_type][position]
    
    # Opportunity component
    opp_metrics = ['snap_pct', 'routes', 'rush_share', 'target_share']
    opp_values = []
    for metric in opp_metrics:
        if metric in df.columns:
            opp_values.append([percentile_rank(df[metric], val) for val in df[metric]])
    
    if opp_values:
        df['opp'] = np.mean(opp_values, axis=0)
    else:
        df['opp'] = 50
    
    # Efficiency component  
    eff_metrics = ['succ_rate', 'yac_per_rec', 'yprr', 'epa_per_play_qb']
    eff_values = []
    for metric in eff_metrics:
        if metric in df.columns:
            eff_values.append([percentile_rank(df[metric], val) for val in df[metric]])
    
    if eff_values:
        df['eff'] = np.mean(eff_values, axis=0)
    else:
        df['eff'] = 50
    
    # Role security component
    role_metrics = ['goalline_share', 'two_min_share']
    role_values = []
    for metric in role_metrics:
        if metric in df.columns:
            role_values.append([percentile_rank(df[metric], val) for val in df[metric]])
    
    # Add contract component if available
    if 'contract_yrs_left' in df.columns:
        role_values.append([percentile_rank(df['contract_yrs_left'], val) for val in df['contract_yrs_left']])
    
    if role_values:
        df['role'] = np.mean(role_values, axis=0)
    else:
        df['role'] = 50
    
    # Team environment component
    team_metrics = ['team_epa_play', 'team_pace', 'team_rz_plays']
    team_values = []
    for metric in team_metrics:
        if metric in df.columns:
            team_values.append([percentile_rank(df[metric], val) for val in df[metric]])
    
    if team_values:
        df['team'] = np.mean(team_values, axis=0)
    else:
        df['team'] = 50
    
    # Health component (penalty-based)
    df['health'] = (df['dnp_weeks_rolling'] * -3 + 
                   (df['injury_status'] == 'questionable').astype(int) * -5 +
                   (df['injury_status'] == 'out').astype(int) * -10)
    df['health'] = np.clip(df['health'], -20, 5)
    
    # SOS component  
    df['sos'] = df['sos_ctx'] - 50  # Center around 0
    
    if format_type == 'redraft':
        # Redraft scoring
        df['score'] = (
            weights['opp'] * df['opp'] +
            weights['eff'] * df['eff'] + 
            weights['role'] * df['role'] +
            weights['team'] * df['team'] +
            weights['sos'] * df['sos'] +
            df['health']  # Health as additive penalty/bonus
        )
        
        debug_components = ['opp', 'eff', 'role', 'team', 'health', 'sos']
        
    else:
        # Dynasty scoring - need 3-year projections
        # Simplified: use current metrics as projection base
        df['proj3'] = (df['opp'] + df['eff']) / 2  # Simplified projection
        
        # Age curve (simplified)
        age_peaks = {'RB': 24, 'WR': 26, 'TE': 27, 'QB': 28}
        peak_age = age_peaks.get(position, 26)
        df['age_score'] = 100 - np.abs(df['age'] - peak_age) * 5
        df['age_score'] = np.clip(df['age_score'], 0, 100)
        
        # Pedigree (draft capital)
        df['ped'] = 100 - (df_profile['draft_pick'].fillna(250) / 250 * 100)
        df['ped'] = np.clip(df['ped'], 0, 100)
        
        df['score'] = (
            weights['proj3'] * df['proj3'] +
            weights['age'] * df['age_score'] +
            weights['role'] * df['role'] +
            weights['eff'] * df['eff'] +
            weights['team'] * df['team'] +
            weights['ped'] * df['ped']
        )
        
        debug_components = ['proj3', 'age_score', 'role', 'eff', 'team', 'ped']
    
    # Ensure scores are in 0-100 range
    df['score'] = np.clip(df['score'], 0, 100)
    
    # Calculate VOR (Value Over Replacement)
    replacement_line = REPLACEMENT_LINES.get(position, 20)
    if len(df) >= replacement_line:
        sorted_scores = df['score'].sort_values(ascending=False)
        replacement_score = sorted_scores.iloc[replacement_line - 1]
    else:
        replacement_score = df['score'].min() if len(df) > 0 else 0
    
    df['vor'] = df['score'] - replacement_score
    
    # Calculate tiers
    df['tier'] = compute_tiers(df['score'].tolist())
    
    # Create debug components dictionary
    df['debug_components'] = df[debug_components].apply(
        lambda row: dict(zip(debug_components, row)), axis=1)
    
    return df

def main(year=2024, weeks=list(range(1, 18))):
    print(f"🔢 Computing player scores for {year}, weeks {min(weeks)}-{max(weeks)}...")
    
    # Load data
    try:
        df_profile = pd.read_csv(f'player_profile_{year}.csv')
        df_inputs = pd.read_csv(f'player_inputs_{year}.csv')
        df_inputs = df_inputs[df_inputs['week'].isin(weeks)]
    except FileNotFoundError as e:
        print(f"❌ Required CSV file not found: {e}")
        print("Please run ingest_player_profile.py and ingest_player_inputs.py first")
        return
    
    results = []
    positions = ['QB', 'RB', 'WR', 'TE']
    formats = ['redraft', 'dynasty']
    
    for format_type in formats:
        print(f"\n📊 Computing {format_type} scores...")
        
        for position in positions:
            print(f"  Processing {position}...")
            
            if format_type == 'redraft':
                # For redraft, compute scores for each week
                for week in weeks:
                    week_inputs = df_inputs[df_inputs['week'] == week]
                    if len(week_inputs) == 0:
                        continue
                        
                    pos_scores = compute_components(week_inputs, df_profile, format_type, position)
                    
                    if len(pos_scores) > 0:
                        pos_scores['format'] = format_type
                        pos_scores['week'] = week
                        pos_scores['season'] = year
                        results.append(pos_scores)
            else:
                # For dynasty, aggregate across all weeks
                pos_inputs = df_inputs[df_inputs['position'] == position].groupby('player_id').agg({
                    'snap_pct': 'mean',
                    'routes': 'mean',
                    'rush_share': 'mean',
                    'target_share': 'mean',
                    'goalline_share': 'mean',
                    'two_min_share': 'mean',
                    'yprr': 'mean',
                    'yac_per_rec': 'mean',
                    'succ_rate': 'mean',
                    'epa_per_play_qb': 'mean',
                    'team_epa_play': 'mean',
                    'team_pace': 'mean',
                    'team_rz_plays': 'mean',
                    'dnp_weeks_rolling': 'max',
                    'sos_ctx': 'mean',
                    'position': 'first',
                    'injury_status': 'last'
                }).reset_index()
                
                if len(pos_inputs) > 0:
                    pos_scores = compute_components(pos_inputs, df_profile, format_type, position)
                    
                    if len(pos_scores) > 0:
                        pos_scores['format'] = format_type  
                        pos_scores['week'] = None  # Dynasty is season-long
                        pos_scores['season'] = year
                        results.append(pos_scores)
    
    if results:
        # Combine all results
        df_all = pd.concat(results, ignore_index=True)
        
        # Select final columns
        final_columns = [
            'player_id', 'season', 'week', 'format', 'position',
            'score', 'vor', 'tier', 'debug_components'
        ]
        
        df_final = df_all[final_columns].copy()
        
        path = f'player_scores_{year}.csv' 
        df_final.to_csv(path, index=False)
        print(f'✅ Saved player scores to {path} with {len(df_final)} rows')
        
        # Summary stats
        summary = df_final.groupby(['format', 'position']).agg({
            'score': ['count', 'mean', 'min', 'max'],
            'vor': 'mean'
        }).round(1)
        print(f"\n📊 Summary stats:")
        print(summary)
        
    else:
        print("❌ No scores computed - check input data")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, default=2024)
    parser.add_argument('--weeks', type=str, default='1-17')
    args = parser.parse_args()
    
    start, end = map(int, args.weeks.split('-'))
    weeks = list(range(start, end + 1))
    main(args.year, weeks)