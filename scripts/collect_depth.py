#!/usr/bin/env python3
"""
Collect weekly depth chart data from nflverse for 2024 season.
Outputs: raw/2024/depth_weekly.jsonl
"""

import pandas as pd
import json
import nfl_data_py as nfl
from pathlib import Path

def collect_depth_charts():
    """Fetch 2024 weekly depth charts from nflverse and save as JSONL."""
    
    print("📈 Fetching 2024 depth charts from nflverse...")
    
    try:
        # Use nfl-data-py to get depth charts for 2024
        df = nfl.import_depth_charts([2024])
        
        print(f"✅ Loaded {len(df):,} depth chart records for 2024")
        
        # Standardize team codes (JAX → JAC)
        team_mapping = {'JAX': 'JAC'}
        df['team'] = df['team'].replace(team_mapping)
        
        # Handle gsis_id mapping if present
        if 'gsis_id' in df.columns and 'player_id' not in df.columns:
            df = df.rename(columns={'gsis_id': 'player_id'})
        
        # Convert to JSONL
        output_path = Path('raw/2024/depth_weekly.jsonl')
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w') as f:
            for _, row in df.iterrows():
                # Convert pandas nulls to None for JSON
                record = row.where(pd.notnull(row), None).to_dict()
                f.write(json.dumps(record) + '\n')
        
        print(f"📁 Saved {len(df):,} records to {output_path}")
        return len(df)
        
    except Exception as e:
        print(f"❌ Error fetching depth charts: {e}")
        return 0

if __name__ == "__main__":
    collect_depth_charts()