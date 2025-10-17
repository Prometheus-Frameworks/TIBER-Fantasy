#!/usr/bin/env python3
"""
EPA Weight Calibration Tool
Uses linear regression to find optimal adjustment weights that minimize RMSE against Baldwin's reference
"""

import sys
import json
import numpy as np
from sklearn.linear_model import LinearRegression, RidgeCV
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score

def calibrate_epa_weights(context_data: list, baldwin_data: list):
    """
    Fit optimal EPA adjustment weights using linear regression
    
    Args:
        context_data: List of QB context metrics (drop rate, pressure rate, etc.)
        baldwin_data: List of Baldwin's reference data with raw/adjusted EPA
    
    Returns:
        Optimal weights and performance metrics
    """
    
    # Build training dataset
    X = []  # Features: deviations from league average
    y = []  # Target: Baldwin's implied adjustments (Adj EPA - Raw EPA)
    qb_names = []
    
    # Calculate league averages from Baldwin's QBs
    total_attempts = sum(qb['pass_attempts'] for qb in context_data)
    
    league_avg_drop = sum(qb['drop_rate'] * qb['pass_attempts'] for qb in context_data) / total_attempts
    league_avg_pressure = sum(qb['pressure_rate'] * qb['pass_attempts'] for qb in context_data) / total_attempts
    league_avg_yac = sum((qb['yac_delta'] / qb['pass_attempts']) * qb['pass_attempts'] for qb in context_data) / total_attempts
    league_avg_def = sum(qb['avg_def_epa_faced'] * qb['pass_attempts'] for qb in context_data) / total_attempts
    
    print(f"📊 League averages from {len(context_data)} QBs:", file=sys.stderr)
    print(f"   Drop Rate: {league_avg_drop:.4f}", file=sys.stderr)
    print(f"   Pressure Rate: {league_avg_pressure:.4f}", file=sys.stderr)
    print(f"   YAC/Play: {league_avg_yac:.4f}", file=sys.stderr)
    print(f"   Def EPA: {league_avg_def:.4f}", file=sys.stderr)
    
    # Build feature matrix and target vector
    for context_qb in context_data:
        # Find matching Baldwin QB
        player_id = context_qb['player_id']
        baldwin_qb = next((b for b in baldwin_data if b.get('player_id') == player_id), None)
        
        if not baldwin_qb:
            continue
        
        # Calculate deviations from league average
        yac_per_play = context_qb['yac_delta'] / context_qb['pass_attempts']
        
        drop_dev = context_qb['drop_rate'] - league_avg_drop
        pressure_dev = context_qb['pressure_rate'] - league_avg_pressure
        yac_dev = yac_per_play - league_avg_yac
        def_dev = context_qb['avg_def_epa_faced'] - league_avg_def
        
        # Baldwin's implied adjustment (what we're trying to predict)
        baldwin_adj = baldwin_qb['adj_epa_per_play'] - baldwin_qb['raw_epa_per_play']
        
        X.append([drop_dev, pressure_dev, yac_dev, def_dev])
        y.append(baldwin_adj)
        qb_names.append(context_qb['player_name'])
    
    X = np.array(X)
    y = np.array(y)
    
    print(f"\n🔬 Training on {len(X)} QBs with complete data", file=sys.stderr)
    
    # === Method 1: Ordinary Least Squares (OLS) Regression ===
    print("\n📈 Method 1: OLS Linear Regression", file=sys.stderr)
    model_ols = LinearRegression(fit_intercept=True)
    model_ols.fit(X, y)
    
    y_pred_ols = model_ols.predict(X)
    rmse_ols = np.sqrt(mean_squared_error(y, y_pred_ols))
    r2_ols = r2_score(y, y_pred_ols)
    
    print(f"   Weights: Drop={model_ols.coef_[0]:.3f}, Pressure={model_ols.coef_[1]:.3f}, YAC={model_ols.coef_[2]:.3f}, Def={model_ols.coef_[3]:.3f}", file=sys.stderr)
    print(f"   Intercept: {model_ols.intercept_:.4f} (systematic bias)", file=sys.stderr)
    print(f"   R² Score: {r2_ols:.3f}", file=sys.stderr)
    print(f"   RMSE: {rmse_ols:.4f}", file=sys.stderr)
    
    # === Method 2: Ridge Regression (with regularization to prevent overfitting) ===
    print("\n📈 Method 2: Ridge Regression (regularized)", file=sys.stderr)
    alphas = [0.001, 0.01, 0.1, 1.0, 10.0]
    model_ridge = RidgeCV(alphas=alphas, cv=5)
    model_ridge.fit(X, y)
    
    y_pred_ridge = model_ridge.predict(X)
    rmse_ridge = np.sqrt(mean_squared_error(y, y_pred_ridge))
    r2_ridge = r2_score(y, y_pred_ridge)
    
    print(f"   Best alpha: {model_ridge.alpha_}", file=sys.stderr)
    print(f"   Weights: Drop={model_ridge.coef_[0]:.3f}, Pressure={model_ridge.coef_[1]:.3f}, YAC={model_ridge.coef_[2]:.3f}, Def={model_ridge.coef_[3]:.3f}", file=sys.stderr)
    print(f"   R² Score: {r2_ridge:.3f}", file=sys.stderr)
    print(f"   RMSE: {rmse_ridge:.4f}", file=sys.stderr)
    
    # === Cross-validation for generalization check ===
    print("\n🔄 Cross-validation (5-fold):", file=sys.stderr)
    cv_scores = cross_val_score(model_ols, X, y, cv=5, scoring='neg_mean_squared_error')
    cv_rmse = np.sqrt(-cv_scores.mean())
    print(f"   CV RMSE: {cv_rmse:.4f} (generalization estimate)", file=sys.stderr)
    
    # === Per-QB predictions (for diagnostics) ===
    per_qb_results = []
    for i, name in enumerate(qb_names):
        per_qb_results.append({
            'qb_name': name,
            'baldwin_adjustment': float(y[i]),
            'predicted_ols': float(y_pred_ols[i]),
            'predicted_ridge': float(y_pred_ridge[i]),
            'error_ols': float(y[i] - y_pred_ols[i]),
            'error_ridge': float(y[i] - y_pred_ridge[i])
        })
    
    # Return results as JSON
    return {
        'success': True,
        'calibration': {
            'ols': {
                'weights': {
                    'drop': float(model_ols.coef_[0]),
                    'pressure': float(model_ols.coef_[1]),
                    'yac': float(model_ols.coef_[2]),
                    'defense': float(model_ols.coef_[3])
                },
                'intercept': float(model_ols.intercept_),
                'r2': float(r2_ols),
                'rmse': float(rmse_ols)
            },
            'ridge': {
                'weights': {
                    'drop': float(model_ridge.coef_[0]),
                    'pressure': float(model_ridge.coef_[1]),
                    'yac': float(model_ridge.coef_[2]),
                    'defense': float(model_ridge.coef_[3])
                },
                'alpha': float(model_ridge.alpha_),
                'r2': float(r2_ridge),
                'rmse': float(rmse_ridge)
            },
            'cross_validation': {
                'rmse': float(cv_rmse),
                'folds': 5
            }
        },
        'per_qb_predictions': per_qb_results,
        'metadata': {
            'sample_size': len(X),
            'league_averages': {
                'drop_rate': float(league_avg_drop),
                'pressure_rate': float(league_avg_pressure),
                'yac_per_play': float(league_avg_yac),
                'def_epa': float(league_avg_def)
            }
        }
    }

if __name__ == '__main__':
    try:
        # Read input from stdin (context and Baldwin data passed from TypeScript)
        input_data = json.loads(sys.stdin.read())
        
        context_data = input_data['context_data']
        baldwin_data = input_data['baldwin_data']
        
        # Run calibration
        result = calibrate_epa_weights(context_data, baldwin_data)
        
        # Output JSON result to stdout
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)
