#!/usr/bin/env python3
"""
Stage and merge weekly stats + depth charts for 2024.
Outputs: staging/weekly_staging.jsonl, warehouse/2024_weekly.jsonl
"""

import json
import pandas as pd
from pathlib import Path

def load_jsonl(filepath):
    """Load JSONL file into list of dictionaries."""
    records = []
    if Path(filepath).exists():
        with open(filepath, 'r') as f:
            for line in f:
                records.append(json.loads(line.strip()))
    return records

def save_jsonl(records, filepath):
    """Save records as JSONL file."""
    Path(filepath).parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w') as f:
        for record in records:
            f.write(json.dumps(record) + '\n')

def normalize_and_merge():
    """Normalize stats and depth data, then merge into warehouse format."""
    
    print("🔄 Loading raw data files...")
    
    # Load raw data
    stats_records = load_jsonl('raw/2024/stats_weekly.jsonl')
    depth_records = load_jsonl('raw/2024/depth_weekly.jsonl')
    
    print(f"📊 Loaded {len(stats_records):,} stats records")
    print(f"📈 Loaded {len(depth_records):,} depth records")
    
    # Convert to DataFrames for easier merging
    df_stats = pd.DataFrame(stats_records) if stats_records else pd.DataFrame()
    df_depth = pd.DataFrame(depth_records) if depth_records else pd.DataFrame()
    
    # Create staging data (normalized stats)
    staging_records = []
    
    if not df_stats.empty:
        for _, row in df_stats.iterrows():
            record = {
                'player_id': row.get('player_id'),
                'season': row.get('season'),
                'week': row.get('week'),
                'team': row.get('team'),
                'position': row.get('position'),
                'routes': row.get('routes'),
                'targets': row.get('targets'),
                'air_yards': row.get('air_yards'),
                'receptions': row.get('receptions'),
                'receiving_yards': row.get('receiving_yards'),
                'receiving_tds': row.get('receiving_tds'),
                'rushing_att': row.get('rushing_att'),
                'rushing_yards': row.get('rushing_yards'),
                'rushing_tds': row.get('rushing_tds'),
                'fantasy_ppr': row.get('fantasy_ppr'),
                'data_source': 'nflfastR'
            }
            staging_records.append(record)
    
    # Save staging
    save_jsonl(staging_records, 'staging/weekly_staging.jsonl')
    print(f"📁 Saved {len(staging_records):,} records to staging/weekly_staging.jsonl")
    
    # Merge with depth charts
    warehouse_records = []
    
    if not df_stats.empty and not df_depth.empty:
        # Merge on player_id, season, week, team
        merged_df = df_stats.merge(
            df_depth,
            on=['player_id', 'season', 'week', 'team'],
            how='left',
            suffixes=('', '_depth')
        )
        
        for _, row in merged_df.iterrows():
            record = {
                'player_id': row.get('player_id'),
                'season': row.get('season'),
                'week': row.get('week'),
                'team': row.get('team'),
                'position': row.get('position') or row.get('position_depth'),
                'routes': row.get('routes'),
                'targets': row.get('targets'),
                'air_yards': row.get('air_yards'),
                'receptions': row.get('receptions'),
                'receiving_yards': row.get('receiving_yards'),
                'receiving_tds': row.get('receiving_tds'),
                'rushing_att': row.get('rushing_att'),
                'rushing_yards': row.get('rushing_yards'),
                'rushing_tds': row.get('rushing_tds'),
                'fantasy_ppr': row.get('fantasy_ppr'),
                'depth_rank': row.get('depth_rank'),
                'formation': row.get('formation')
            }
            # Remove None values and convert to null in JSON
            warehouse_records.append(record)
    
    elif not df_stats.empty:
        # No depth data, use stats only
        warehouse_records = staging_records.copy()
        for record in warehouse_records:
            record['depth_rank'] = None
    
    # Save warehouse
    save_jsonl(warehouse_records, 'warehouse/2024_weekly.jsonl')
    print(f"📁 Saved {len(warehouse_records):,} records to warehouse/2024_weekly.jsonl")
    
    # Preview first 5 rows
    if warehouse_records:
        print("\n🔍 First 5 warehouse records:")
        for i, record in enumerate(warehouse_records[:5]):
            print(f"  {i+1}. {record}")
    
    # Report anomalies
    anomalies = []
    if not df_stats.empty:
        null_player_ids = df_stats['player_id'].isnull().sum()
        if null_player_ids > 0:
            anomalies.append(f"{null_player_ids} records with null player_id")
    
    if anomalies:
        print(f"\n⚠️  Anomalies normalized: {', '.join(anomalies)}")
    else:
        print("\n✅ No anomalies detected")
    
    return len(warehouse_records)

if __name__ == "__main__":
    normalize_and_merge()