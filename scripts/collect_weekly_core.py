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
        df = nfl.import_weekly_data([2024], columns=[
            'player_id', 'season', 'week', 'recent_team', 'position', 
            'targets', 'receptions', 'receiving_yards', 'receiving_tds',
            'rushing_attempts', 'rushing_yards', 'rushing_tds', 
            'fantasy_points_ppr'
        ])
        
        print(f"✅ Loaded {len(df):,} weekly stat records for 2024")
        
        # Standardize column names and team codes
        df = df.rename(columns={
            'recent_team': 'team',
            'rushing_attempts': 'rushing_att',
            'fantasy_points_ppr': 'fantasy_ppr'
        })
        
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