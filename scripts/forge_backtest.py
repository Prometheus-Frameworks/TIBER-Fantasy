#!/usr/bin/env python3
"""
FORGE Backtest Framework
========================
Tests whether FORGE-style metrics predict next-week fantasy performance
better than simple baselines.

Tests:
1. Monotonicity: Do higher Alpha-like scores map to higher next-week fpts?
2. Calibration: Do score buckets match expected outcome distributions?
3. Lift vs Baselines: Does FORGE beat naive predictors?

Baselines:
- Naive: Last week's fpts
- Rolling: 3-week average fpts
- Volume (WR/TE): targets * coefficient
- Volume (RB): rush_attempts + targets

Usage:
  python scripts/forge_backtest.py [season] [position]
  python scripts/forge_backtest.py 2025 WR
  python scripts/forge_backtest.py 2025        # All positions
"""

import os
import sys
import psycopg2
import pandas as pd
import numpy as np
from scipy import stats

DATABASE_URL = os.environ.get('DATABASE_URL')

def get_connection():
    return psycopg2.connect(DATABASE_URL)

def load_gold_data(season: int, position: str = None) -> pd.DataFrame:
    """Load Gold layer data for backtest analysis."""
    conn = get_connection()
    
    position_filter = f"AND position = '{position}'" if position else "AND position IN ('QB', 'RB', 'WR', 'TE')"
    
    query = f"""
    SELECT 
        player_id,
        player_name,
        position,
        team_id,
        season,
        week,
        -- Fantasy points (outcome)
        fpts_ppr,
        fpts_half,
        fpts_std,
        -- Volume metrics
        snaps,
        snap_share,
        targets,
        target_share,
        routes,
        route_rate,
        rush_attempts,
        -- Efficiency metrics
        epa_per_play,
        epa_per_target,
        success_rate,
        yards_per_carry,
        yards_per_target,
        catch_rate,
        tprr,
        yprr,
        -- RZ/Situational
        rz_snaps,
        rz_targets,
        third_down_snaps,
        third_down_conversion_rate,
        two_minute_snaps,
        two_minute_success_rate
    FROM datadive_snapshot_player_week
    WHERE season = {season}
      {position_filter}
      AND fpts_ppr IS NOT NULL
    ORDER BY player_id, week
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    return df

def compute_forge_style_score(row: pd.Series, position: str) -> float:
    """
    Compute a FORGE-style composite score using Gold layer metrics.
    This mimics the FORGE pillar weights without needing the full engine.
    """
    volume_score = 0
    efficiency_score = 0
    
    if position == 'WR' or position == 'TE':
        # WR/TE: V=0.55, E=0.15, T=0.18, S=0.12 (updated based on correlation analysis)
        target_share = row.get('target_share', 0) or 0
        route_rate = row.get('route_rate', 0) or 0
        snap_share = row.get('snap_share', 0) or 0
        
        # Volume (normalize to 0-100 scale) - heavily weighted now
        volume_score = (target_share * 100 * 0.5 + route_rate * 100 * 0.3 + snap_share * 100 * 0.2)
        
        # Efficiency - reduced weight since correlations show it hurts prediction
        yprr = row.get('yprr', 0) or 0
        catch_rate = row.get('catch_rate', 0) or 0
        epa_per_target = row.get('epa_per_target', 0) or 0
        efficiency_score = min(100, max(0, yprr * 30 + catch_rate * 50 + (epa_per_target + 0.5) * 40))
        
        return volume_score * 0.55 + efficiency_score * 0.15
        
    elif position == 'RB':
        # RB: V=0.50, E=0.25 (volume dominates, but efficiency helps separate bellcows from backups)
        snap_share = row.get('snap_share', 0) or 0
        rush_attempts = row.get('rush_attempts', 0) or 0
        targets = row.get('targets', 0) or 0
        
        # Volume - touches based (rush_attempts r=0.515 is strongest predictor)
        touches = rush_attempts + targets
        volume_score = min(100, snap_share * 100 * 0.4 + touches * 2.5)
        
        # Efficiency - keep some weight to separate quality from garbage time
        ypc = row.get('yards_per_carry', 0) or 0
        success_rate = row.get('success_rate', 0) or 0
        efficiency_score = min(100, max(0, ypc * 12 + success_rate * 80))
        
        return volume_score * 0.50 + efficiency_score * 0.25
        
    elif position == 'QB':
        # QB: V=0.25, E=0.45 (efficiency matters for QBs - yprr r=0.685)
        snap_share = row.get('snap_share', 0) or 0
        epa_per_play = row.get('epa_per_play', 0) or 0
        success_rate = row.get('success_rate', 0) or 0
        yprr = row.get('yprr', 0) or 0
        
        volume_score = snap_share * 100
        # Enhanced efficiency using yprr which had strong correlation
        efficiency_score = min(100, max(0, (epa_per_play + 0.3) * 80 + success_rate * 40 + yprr * 20))
        
        return volume_score * 0.25 + efficiency_score * 0.45
    
    return 50  # Default

def create_backtest_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create Week N -> Week N+1 prediction dataset.
    Each row has Week N metrics and Week N+1 fpts as target.
    """
    df = df.sort_values(['player_id', 'week'])
    
    # Create next week's fpts as target
    df['next_week_fpts'] = df.groupby('player_id')['fpts_ppr'].shift(-1)
    df['next_week'] = df.groupby('player_id')['week'].shift(-1)
    
    # Drop rows where next week doesn't exist (last week of season)
    df = df.dropna(subset=['next_week_fpts'])
    
    # Ensure consecutive weeks
    df = df[df['next_week'] == df['week'] + 1]
    
    return df

def compute_baselines(df: pd.DataFrame) -> pd.DataFrame:
    """Add baseline predictions to the dataset."""
    df = df.copy()
    
    # Baseline 1: Naive (last week's fpts)
    df['pred_naive'] = df['fpts_ppr']
    
    # Baseline 2: 3-week rolling average
    df['pred_rolling3'] = df.groupby('player_id')['fpts_ppr'].transform(
        lambda x: x.rolling(window=3, min_periods=1).mean()
    )
    
    # Baseline 3: Volume-only (position-specific)
    def volume_pred(row):
        if row['position'] in ['WR', 'TE']:
            targets = row.get('targets', 0) or 0
            return targets * 1.5  # ~1.5 fpts per target as rough estimate
        elif row['position'] == 'RB':
            rushes = row.get('rush_attempts', 0) or 0
            targets = row.get('targets', 0) or 0
            return rushes * 0.5 + targets * 1.2
        elif row['position'] == 'QB':
            return row.get('fpts_ppr', 15) or 15  # QB baseline
        return 10
    
    df['pred_volume'] = df.apply(volume_pred, axis=1)
    
    # FORGE-style score (our test subject)
    df['forge_score'] = df.apply(
        lambda row: compute_forge_style_score(row, row['position']), axis=1
    )
    
    # Scale FORGE score to fpts prediction using position-specific coefficients
    # This converts the 0-100 quality score to a fpts prediction
    def scale_forge_to_fpts(row):
        score = row['forge_score']
        if pd.isna(score):
            return None
        pos = row['position']
        # Rough scaling based on typical fpts ranges
        if pos == 'QB':
            return score * 0.35  # QB avg ~17 fpts, top score 60 -> 21 fpts
        elif pos == 'RB':
            return score * 0.25  # RB avg ~10 fpts, top score 60 -> 15 fpts
        elif pos == 'WR':
            return score * 0.25  # WR avg ~10 fpts
        elif pos == 'TE':
            return score * 0.20  # TE avg ~7 fpts
        return score * 0.25
    
    df['pred_forge'] = df.apply(scale_forge_to_fpts, axis=1)
    
    return df

def evaluate_predictions(df: pd.DataFrame, pred_col: str, name: str) -> dict:
    """Evaluate prediction quality."""
    valid = df.dropna(subset=[pred_col, 'next_week_fpts'])
    
    if len(valid) < 10:
        return {'name': name, 'n': len(valid), 'error': 'Insufficient data'}
    
    actual = valid['next_week_fpts'].values
    predicted = valid[pred_col].values
    
    # Mean Absolute Error
    mae = np.mean(np.abs(actual - predicted))
    
    # Correlation
    corr, p_value = stats.pearsonr(predicted, actual)
    
    # Spearman (rank correlation - monotonicity)
    spearman, spearman_p = stats.spearmanr(predicted, actual)
    
    # RMSE
    rmse = np.sqrt(np.mean((actual - predicted) ** 2))
    
    return {
        'name': name,
        'n': len(valid),
        'mae': round(mae, 2),
        'rmse': round(rmse, 2),
        'pearson_r': round(corr, 3),
        'pearson_p': round(p_value, 4),
        'spearman_r': round(spearman, 3),
        'spearman_p': round(spearman_p, 4)
    }

def bucket_analysis(df: pd.DataFrame, score_col: str, buckets: int = 5) -> pd.DataFrame:
    """Analyze outcomes by score bucket (calibration test)."""
    valid = df.dropna(subset=[score_col, 'next_week_fpts'])
    
    if len(valid) < buckets * 5:
        return pd.DataFrame()
    
    # Create score buckets
    valid['bucket'] = pd.qcut(valid[score_col], q=buckets, labels=False, duplicates='drop')
    
    # Aggregate by bucket
    result = valid.groupby('bucket').agg({
        'next_week_fpts': ['mean', 'median', 'std', 'count'],
        score_col: ['mean', 'min', 'max']
    }).round(2)
    
    result.columns = ['fpts_mean', 'fpts_median', 'fpts_std', 'count', 
                      'score_mean', 'score_min', 'score_max']
    
    return result

def run_backtest(season: int, position: str = None):
    """Run full backtest analysis."""
    print(f"\n{'='*60}")
    print(f"FORGE BACKTEST REPORT")
    print(f"Season: {season}, Position: {position or 'ALL'}")
    print(f"{'='*60}\n")
    
    # Load data
    print("Loading Gold layer data...")
    df = load_gold_data(season, position)
    print(f"  Loaded {len(df):,} player-week records")
    
    if len(df) < 100:
        print("ERROR: Insufficient data for backtest")
        return
    
    # Create backtest dataset
    print("Creating Week N -> Week N+1 dataset...")
    bt_df = create_backtest_dataset(df)
    print(f"  Created {len(bt_df):,} prediction samples")
    
    # Compute baselines
    print("Computing baselines and FORGE score...")
    bt_df = compute_baselines(bt_df)
    
    # Split by position for analysis
    positions = [position] if position else ['QB', 'RB', 'WR', 'TE']
    
    for pos in positions:
        pos_df = bt_df[bt_df['position'] == pos] if position is None else bt_df
        
        if len(pos_df) < 50:
            print(f"\n{pos}: Insufficient data ({len(pos_df)} samples)")
            continue
        
        print(f"\n{'='*60}")
        print(f"{pos} ANALYSIS ({len(pos_df):,} samples)")
        print(f"{'='*60}")
        
        # Evaluate all predictors
        results = []
        results.append(evaluate_predictions(pos_df, 'pred_naive', 'Naive (Last Week)'))
        results.append(evaluate_predictions(pos_df, 'pred_rolling3', 'Rolling 3-Week Avg'))
        results.append(evaluate_predictions(pos_df, 'pred_volume', 'Volume Only'))
        results.append(evaluate_predictions(pos_df, 'pred_forge', 'FORGE-Style Pred'))
        
        # Print comparison table
        print("\n1. BASELINE COMPARISON")
        print("-" * 70)
        print(f"{'Predictor':<25} {'N':>6} {'MAE':>8} {'RMSE':>8} {'Pearson':>10} {'Spearman':>10}")
        print("-" * 70)
        for r in results:
            if 'error' not in r:
                print(f"{r['name']:<25} {r['n']:>6} {r['mae']:>8} {r['rmse']:>8} {r['pearson_r']:>10} {r['spearman_r']:>10}")
        
        # Bucket analysis (monotonicity/calibration)
        print("\n2. FORGE SCORE BUCKET ANALYSIS (Monotonicity Test)")
        print("-" * 70)
        buckets = bucket_analysis(pos_df, 'forge_score', 5)
        if not buckets.empty:
            print(buckets.to_string())
            
            # Check monotonicity
            fpts_means = buckets['fpts_mean'].values
            is_monotonic = all(fpts_means[i] <= fpts_means[i+1] for i in range(len(fpts_means)-1))
            print(f"\nMonotonic (higher bucket = higher fpts)? {'YES ✓' if is_monotonic else 'NO ✗'}")
        
        # Win rate vs baselines
        print("\n3. HEAD-TO-HEAD WIN RATE")
        print("-" * 70)
        
        def win_rate(pred1, pred2, actual):
            """How often does pred1 beat pred2 in predicting actual?"""
            err1 = np.abs(pred1 - actual)
            err2 = np.abs(pred2 - actual)
            wins = np.sum(err1 < err2)
            ties = np.sum(err1 == err2)
            total = len(actual)
            return wins / total if total > 0 else 0
        
        for baseline in ['pred_naive', 'pred_rolling3', 'pred_volume']:
            valid = pos_df.dropna(subset=['pred_forge', baseline, 'next_week_fpts'])
            if len(valid) > 0:
                wr = win_rate(
                    valid['pred_forge'].values,
                    valid[baseline].values,
                    valid['next_week_fpts'].values
                )
                baseline_name = baseline.replace('pred_', '').replace('_', ' ').title()
                print(f"FORGE vs {baseline_name:<15}: {wr*100:.1f}% win rate")
    
    print(f"\n{'='*60}")
    print("BACKTEST COMPLETE")
    print(f"{'='*60}\n")

if __name__ == '__main__':
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    position = sys.argv[2].upper() if len(sys.argv) > 2 else None
    
    run_backtest(season, position)
