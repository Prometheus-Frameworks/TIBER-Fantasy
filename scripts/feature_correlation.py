#!/usr/bin/env python3
"""
Feature Correlation Analysis for FORGE
Identifies which Gold layer metrics best predict next-week fantasy points per position.
"""

import os
import sys
import pandas as pd
import numpy as np
from scipy import stats
import psycopg2

DB_URL = os.environ.get('DATABASE_URL')

NUMERIC_FEATURES = [
    'snaps', 'snap_share', 'routes', 'route_rate', 
    'targets', 'target_share', 'receptions', 'rec_yards', 'rec_tds',
    'adot', 'air_yards', 'yac', 'tprr', 'yprr',
    'epa_per_play', 'epa_per_target', 'success_rate',
    'rush_attempts', 'rush_yards', 'rush_tds', 'yards_per_carry', 'rush_epa_per_play',
    'fpts_ppr',
    'stuffed', 'stuff_rate', 'rush_first_downs', 'rush_first_down_rate',
    'rz_rush_attempts', 'yac_per_rec', 'rec_first_downs', 'first_downs_per_route',
    'fpts_per_route', 'cpoe', 'catch_rate', 'yards_per_target', 'racr', 'wopr',
    'slot_rate', 'inline_rate', 'x_yac', 'yac_over_expected',
    'shotgun_rate', 'no_huddle_rate', 'shotgun_success_rate',
    'inside_run_rate', 'outside_run_rate', 'inside_success_rate', 'outside_success_rate',
    'deep_target_rate', 'intermediate_target_rate', 'short_target_rate',
    'rz_snaps', 'rz_snap_rate', 'rz_success_rate', 'rz_pass_attempts', 'rz_pass_tds',
    'rz_td_rate', 'rz_rush_tds', 'rz_rush_td_rate',
    'rz_targets', 'rz_receptions', 'rz_rec_tds', 'rz_target_share', 'rz_catch_rate',
    'third_down_snaps', 'third_down_conversions', 'third_down_conversion_rate',
    'early_down_success_rate', 'late_down_success_rate',
    'short_yardage_attempts', 'short_yardage_conversions', 'short_yardage_rate',
    'third_down_targets', 'third_down_receptions', 'third_down_rec_conversions',
    'two_minute_snaps', 'two_minute_successful', 'two_minute_success_rate',
    'hurry_up_snaps', 'hurry_up_successful', 'hurry_up_success_rate',
    'two_minute_targets', 'two_minute_receptions'
]

def load_gold_data(season: int = 2025) -> pd.DataFrame:
    """Load Gold layer data with week-over-week joins."""
    conn = psycopg2.connect(DB_URL)
    
    cols = ', '.join([f'curr.{f} as {f}' for f in NUMERIC_FEATURES])
    
    query = f"""
    SELECT 
        curr.player_id,
        curr.player_name,
        curr.position,
        curr.season,
        curr.week,
        curr.team_id,
        {cols},
        next_week.fpts_ppr as next_week_fpts
    FROM datadive_snapshot_player_week curr
    JOIN datadive_snapshot_player_week next_week 
        ON curr.player_id = next_week.player_id 
        AND curr.season = next_week.season 
        AND curr.week = next_week.week - 1
    WHERE curr.season = {season}
        AND curr.position IN ('QB', 'RB', 'WR', 'TE')
        AND curr.fpts_ppr > 0
        AND next_week.fpts_ppr IS NOT NULL
    ORDER BY curr.player_id, curr.week
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    return df


def calculate_correlations(df: pd.DataFrame, position: str) -> pd.DataFrame:
    """Calculate Pearson and Spearman correlations for each feature."""
    pos_df = df[df['position'] == position].copy()
    
    if len(pos_df) < 30:
        return pd.DataFrame()
    
    results = []
    for feature in NUMERIC_FEATURES:
        if feature == 'fpts_ppr':
            continue
            
        valid = pos_df.dropna(subset=[feature, 'next_week_fpts'])
        if len(valid) < 30:
            continue
            
        x = valid[feature].values
        y = valid['next_week_fpts'].values
        
        if np.std(x) == 0:
            continue
        
        pearson_r, pearson_p = stats.pearsonr(x, y)
        spearman_r, spearman_p = stats.spearmanr(x, y)
        
        results.append({
            'feature': feature,
            'pearson_r': pearson_r,
            'pearson_p': pearson_p,
            'spearman_r': spearman_r,
            'spearman_p': spearman_p,
            'n': len(valid),
            'mean': np.mean(x),
            'std': np.std(x)
        })
    
    results_df = pd.DataFrame(results)
    results_df = results_df.sort_values('spearman_r', ascending=False)
    return results_df


def print_top_features(results_df: pd.DataFrame, position: str, top_n: int = 15):
    """Print top predictive features for a position."""
    print(f"\n{'='*70}")
    print(f"{position} TOP {top_n} PREDICTIVE FEATURES (sorted by Spearman r)")
    print(f"{'='*70}")
    print(f"{'Feature':<35} {'Spearman':>10} {'Pearson':>10} {'N':>8}")
    print("-" * 70)
    
    for _, row in results_df.head(top_n).iterrows():
        sig = '***' if row['spearman_p'] < 0.001 else '**' if row['spearman_p'] < 0.01 else '*' if row['spearman_p'] < 0.05 else ''
        print(f"{row['feature']:<35} {row['spearman_r']:>8.3f}{sig:<2} {row['pearson_r']:>10.3f} {row['n']:>8}")


def print_feature_comparison(all_results: dict):
    """Compare top features across positions."""
    print(f"\n{'='*70}")
    print("CROSS-POSITION FEATURE COMPARISON")
    print(f"{'='*70}")
    
    all_features = set()
    for pos, df in all_results.items():
        if len(df) > 0:
            all_features.update(df.head(10)['feature'].tolist())
    
    print(f"\n{'Feature':<30} {'RB':>10} {'WR':>10} {'TE':>10} {'QB':>10}")
    print("-" * 70)
    
    for feature in sorted(all_features):
        row = f"{feature:<30}"
        for pos in ['RB', 'WR', 'TE', 'QB']:
            if pos in all_results and len(all_results[pos]) > 0:
                feat_row = all_results[pos][all_results[pos]['feature'] == feature]
                if len(feat_row) > 0:
                    r = feat_row.iloc[0]['spearman_r']
                    row += f" {r:>10.3f}"
                else:
                    row += f" {'--':>10}"
            else:
                row += f" {'--':>10}"
        print(row)


def categorize_features():
    """Categorize features into FORGE pillar types."""
    categories = {
        'VOLUME': ['snaps', 'snap_share', 'routes', 'route_rate', 'targets', 'target_share', 
                   'receptions', 'rush_attempts', 'rz_snaps', 'rz_targets', 'rz_rush_attempts',
                   'third_down_snaps', 'third_down_targets', 'two_minute_snaps', 'two_minute_targets'],
        'EFFICIENCY': ['epa_per_play', 'epa_per_target', 'success_rate', 'yards_per_carry', 
                       'rush_epa_per_play', 'yprr', 'tprr', 'catch_rate', 'cpoe', 'yards_per_target',
                       'racr', 'fpts_per_route', 'yac_per_rec', 'first_downs_per_route'],
        'PRODUCTION': ['rec_yards', 'rec_tds', 'rush_yards', 'rush_tds', 'fpts_ppr', 
                       'rec_first_downs', 'rush_first_downs', 'yac', 'air_yards'],
        'CONTEXT': ['rz_snap_rate', 'rz_target_share', 'rz_td_rate', 'rz_rush_td_rate',
                    'third_down_conversion_rate', 'two_minute_success_rate', 'wopr',
                    'slot_rate', 'inline_rate', 'deep_target_rate', 'inside_run_rate'],
        'STABILITY_PROXY': ['stuff_rate', 'adot', 'shotgun_rate', 'no_huddle_rate']
    }
    return categories


def analyze_by_category(results_df: pd.DataFrame, position: str):
    """Analyze average predictive power by feature category."""
    categories = categorize_features()
    
    print(f"\n{position} - AVERAGE SPEARMAN r BY CATEGORY:")
    print("-" * 40)
    
    for cat_name, features in categories.items():
        cat_results = results_df[results_df['feature'].isin(features)]
        if len(cat_results) > 0:
            avg_r = cat_results['spearman_r'].mean()
            max_r = cat_results['spearman_r'].max()
            best_feat = cat_results.loc[cat_results['spearman_r'].idxmax(), 'feature'] if len(cat_results) > 0 else 'N/A'
            print(f"  {cat_name:<15}: avg={avg_r:.3f}, max={max_r:.3f} ({best_feat})")


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    
    print(f"\n{'='*70}")
    print(f"FEATURE CORRELATION ANALYSIS")
    print(f"Season: {season}")
    print(f"{'='*70}")
    
    print("\nLoading Gold layer data with Week N → Week N+1 joins...")
    df = load_gold_data(season)
    print(f"  Loaded {len(df):,} player-week prediction samples")
    
    all_results = {}
    for position in ['RB', 'WR', 'TE', 'QB']:
        results_df = calculate_correlations(df, position)
        all_results[position] = results_df
        
        if len(results_df) > 0:
            print_top_features(results_df, position)
            analyze_by_category(results_df, position)
    
    print_feature_comparison(all_results)
    
    print(f"\n{'='*70}")
    print("ANALYSIS COMPLETE")
    print(f"{'='*70}")


if __name__ == '__main__':
    main()
