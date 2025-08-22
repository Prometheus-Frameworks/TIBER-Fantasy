import pandas as pd
import numpy as np

# Create sample advanced metrics data for testing infrastructure
# This will be replaced with real PBP-derived data later

sample_data = [
    # Sample RBs
    {'player_id': '00-0031237', 'player_name': 'Saquon Barkley', 'team': 'PHI', 'position': 'RB', 'games': 17, 
     'adot': None, 'yprr': None, 'racr': None, 'target_share': 0.08, 'wopr': 0.15, 'rush_expl_10p': 0.12, 'aypa': None, 'epa_per_play': None},
    {'player_id': '00-0033077', 'player_name': 'Derrick Henry', 'team': 'BAL', 'position': 'RB', 'games': 17,
     'adot': None, 'yprr': None, 'racr': None, 'target_share': 0.06, 'wopr': 0.10, 'rush_expl_10p': 0.09, 'aypa': None, 'epa_per_play': None},
    
    # Sample WRs
    {'player_id': '00-0035676', 'player_name': 'Ja\'Marr Chase', 'team': 'CIN', 'position': 'WR', 'games': 17,
     'adot': 12.4, 'yprr': 2.8, 'racr': 1.15, 'target_share': 0.28, 'wopr': 0.45, 'rush_expl_10p': None, 'aypa': None, 'epa_per_play': None},
    {'player_id': '00-0033040', 'player_name': 'Justin Jefferson', 'team': 'MIN', 'position': 'WR', 'games': 14,
     'adot': 11.8, 'yprr': 2.6, 'racr': 1.08, 'target_share': 0.24, 'wopr': 0.38, 'rush_expl_10p': None, 'aypa': None, 'epa_per_play': None},
    
    # Sample TEs
    {'player_id': '00-0037013', 'player_name': 'Brock Bowers', 'team': 'LV', 'position': 'TE', 'games': 17,
     'adot': 8.2, 'yprr': 1.9, 'racr': 0.95, 'target_share': 0.22, 'wopr': 0.28, 'rush_expl_10p': None, 'aypa': None, 'epa_per_play': None},
    {'player_id': '00-0034869', 'player_name': 'Trey McBride', 'team': 'ARI', 'position': 'TE', 'games': 17,
     'adot': 7.8, 'yprr': 1.7, 'racr': 0.88, 'target_share': 0.18, 'wopr': 0.22, 'rush_expl_10p': None, 'aypa': None, 'epa_per_play': None},
    
    # Sample QBs
    {'player_id': '00-0033873', 'player_name': 'Lamar Jackson', 'team': 'BAL', 'position': 'QB', 'games': 17,
     'adot': None, 'yprr': None, 'racr': None, 'target_share': None, 'wopr': None, 'rush_expl_10p': None, 'aypa': 7.8, 'epa_per_play': 0.28},
    {'player_id': '00-0033873', 'player_name': 'Josh Allen', 'team': 'BUF', 'position': 'QB', 'games': 17,
     'adot': None, 'yprr': None, 'racr': None, 'target_share': None, 'wopr': None, 'rush_expl_10p': None, 'aypa': 7.2, 'epa_per_play': 0.24},
]

# Create DataFrame
df = pd.DataFrame(sample_data)

# Ensure columns match schema
schema_columns = [
    'player_id', 'player_name', 'team', 'position', 'games',
    'adot', 'yprr', 'racr', 'target_share', 'wopr',
    'rush_expl_10p', 'aypa', 'epa_per_play'
]
df = df.reindex(columns=schema_columns)

# Save to CSV
df.to_csv('data/player_advanced_2024.csv', index=False)

print(f"Created sample advanced metrics CSV with {len(df)} players")
print("CSV saved to data/player_advanced_2024.csv")