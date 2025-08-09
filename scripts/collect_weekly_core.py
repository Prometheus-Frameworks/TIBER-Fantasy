#!/usr/bin/env python3
"""
Collect weekly core stats from nflfastR for 2024 season.
Outputs: raw/2024/stats_weekly.jsonl
"""

import pandas as pd
import json
import nfl_data_py as nfl
from pathlib import Path

def collect_weekly_stats():
    """Fetch 2024 weekly stats from nflfastR using nfl-data-py and save as JSONL."""
    
    print("📊 Fetching 2024 weekly stats from nflfastR...")
    
    try:
        # Use nfl-data-py to get weekly stats for 2024
        df = nfl.import_weekly_data([2024])
        
        print(f"✅ Loaded {len(df):,} weekly stat records for 2024")
        
        # Standardize column names and team codes  
        column_renames = {}
        if 'recent_team' in df.columns:
            column_renames['recent_team'] = 'team'
        if 'rushing_attempts' in df.columns:
            column_renames['rushing_attempts'] = 'rushing_att'
        elif 'carries' in df.columns:
            column_renames['carries'] = 'rushing_att'
        if 'fantasy_points_ppr' in df.columns:
            column_renames['fantasy_points_ppr'] = 'fantasy_ppr'
        
        if column_renames:
            df = df.rename(columns=column_renames)
        
        # Standardize team codes (JAX → JAC)
        team_mapping = {'JAX': 'JAC'}
        df['team'] = df['team'].replace(team_mapping)
        
        # Convert to JSONL
        output_path = Path('raw/2024/stats_weekly.jsonl')
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w') as f:
            for _, row in df.iterrows():
                # Convert pandas nulls to None for JSON
                record = row.where(pd.notnull(row), None).to_dict()
                f.write(json.dumps(record) + '\n')
        
        print(f"📁 Saved {len(df):,} records to {output_path}")
        return len(df)
        
    except Exception as e:
        print(f"❌ Error fetching weekly stats: {e}")
        return 0

if __name__ == "__main__":
    collect_weekly_stats()