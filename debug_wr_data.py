#!/usr/bin/env python3
"""
WR Data Diagnostic Script
Debug NFL-Data-Py raw WR data source and column structure
"""

import nfl_data_py as nfl
import pandas as pd
import json
import sys

print("=" * 80)
print("NFL-DATA-PY WR DATA DIAGNOSTIC")
print("=" * 80)

try:
    # Import 2024 weekly data
    print("1. FETCHING RAW 2024 NFL DATA...")
    weekly_df = nfl.import_weekly_data([2024])
    print(f"   Total rows in dataset: {len(weekly_df)}")
    
    # Filter for WR position only - NO OTHER FILTERS
    print("\n2. FILTERING FOR WR POSITION ONLY...")
    wr_data = weekly_df[weekly_df['position'] == 'WR'].copy()
    print(f"   WR rows found: {len(wr_data)}")
    
    # Print ALL available columns
    print("\n3. ALL AVAILABLE COLUMNS IN WR DATA:")
    print("-" * 50)
    all_columns = list(wr_data.columns)
    for i, col in enumerate(all_columns, 1):
        print(f"   {i:2d}. {col}")
    print(f"\n   Total columns: {len(all_columns)}")
    
    # Group by player WITHOUT any filtering
    print("\n4. GROUPING BY PLAYER (NO FILTERS APPLIED)...")
    wr_stats = wr_data.groupby(['player_id', 'player_name', 'recent_team']).agg({
        'targets': 'sum',
        'receptions': 'sum', 
        'receiving_yards': 'sum',
        'receiving_tds': 'sum',
        'target_share': 'mean',
        'air_yards_share': 'mean',
        'receiving_yards_after_catch': 'sum',
        'receiving_first_downs': 'sum',
        'receiving_air_yards': 'sum'
    }).reset_index()
    
    print(f"   Unique WR players: {len(wr_stats)}")
    
    # YPRR Calculation Formula
    print("\n5. YARDS PER ROUTE RUN (YPRR) CALCULATION:")
    print("-" * 50)
    print("   FORMULA USED: receiving_yards / routes_run")
    print("   NOTE: routes_run is ESTIMATED as targets * 3.5")
    print("   REASONING: Elite WRs run ~600-700 routes, average ~400-500")
    print("   CALCULATION: routes_run = max(targets * 3.5, targets)")
    print("   CAP: Maximum 750 routes per player per season")
    
    # Apply the exact calculation used in production
    wr_stats['routes_run'] = wr_stats.apply(lambda row: 
        max(int(row['targets'] * 3.5), row['targets']) if row['targets'] > 0 else 0, 
        axis=1)
    wr_stats['routes_run'] = wr_stats['routes_run'].clip(upper=750)
    
    wr_stats['yards_per_route_run'] = wr_stats.apply(lambda row: 
        round(row['receiving_yards'] / row['routes_run'], 2) if row['routes_run'] > 0 else 0, 
        axis=1)
    
    # Sort by receiving yards (production order)
    wr_stats = wr_stats.sort_values('receiving_yards', ascending=False)
    
    print("\n6. RAW WR DATA - FIRST 25 PLAYERS (NO FILTERS):")
    print("=" * 120)
    print(f"{'Rank':<4} {'Player Name':<20} {'Team':<4} {'Targets':<7} {'Rec Yds':<7} {'Routes':<7} {'YPRR':<6} {'TDs':<3} {'Target%':<8}")
    print("-" * 120)
    
    for i, (_, row) in enumerate(wr_stats.head(25).iterrows(), 1):
        player_name = str(row['player_name'])[:19]
        team = str(row['recent_team'])[:3]
        targets = int(row['targets']) if pd.notna(row['targets']) else 0
        rec_yards = int(row['receiving_yards']) if pd.notna(row['receiving_yards']) else 0
        routes = int(row['routes_run']) if pd.notna(row['routes_run']) else 0
        yprr = float(row['yards_per_route_run']) if pd.notna(row['yards_per_route_run']) else 0.0
        tds = int(row['receiving_tds']) if pd.notna(row['receiving_tds']) else 0
        target_share = round(float(row['target_share']), 1) if pd.notna(row['target_share']) and row['target_share'] > 0 else 0.0
        
        print(f"{i:<4} {player_name:<20} {team:<4} {targets:<7} {rec_yards:<7} {routes:<7} {yprr:<6} {tds:<3} {target_share:<8}")
    
    print("\n7. DATA QUALITY SUMMARY:")
    print("-" * 50)
    print(f"   Players with 0 targets: {len(wr_stats[wr_stats['targets'] == 0])}")
    print(f"   Players with 1+ targets: {len(wr_stats[wr_stats['targets'] > 0])}")
    print(f"   Players with 10+ targets: {len(wr_stats[wr_stats['targets'] >= 10])}")
    print(f"   Players with 50+ targets: {len(wr_stats[wr_stats['targets'] >= 50])}")
    print(f"   Max targets by any player: {wr_stats['targets'].max()}")
    print(f"   Max receiving yards: {wr_stats['receiving_yards'].max()}")
    
    print("\n8. YPRR CALCULATION VERIFICATION:")
    print("-" * 50)
    # Show calculation for top 3 players
    for i, (_, row) in enumerate(wr_stats.head(3).iterrows(), 1):
        targets = int(row['targets'])
        rec_yards = int(row['receiving_yards'])
        routes = int(row['routes_run'])
        yprr = float(row['yards_per_route_run'])
        calculated_yprr = round(rec_yards / routes, 2) if routes > 0 else 0
        
        print(f"   Player #{i}: {row['player_name']}")
        print(f"      Targets: {targets}")
        print(f"      Routes (targets * 3.5): {targets} * 3.5 = {routes}")
        print(f"      Receiving Yards: {rec_yards}")
        print(f"      YPRR: {rec_yards} / {routes} = {calculated_yprr}")
        print(f"      Stored YPRR: {yprr}")
        print(f"      Match: {'✓' if abs(yprr - calculated_yprr) < 0.01 else '✗'}")
        print()

    print("=" * 80)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 80)

except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)