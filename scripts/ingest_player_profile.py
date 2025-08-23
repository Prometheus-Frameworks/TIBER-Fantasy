import nfl_data_py as nfl
import pandas as pd
import argparse
from datetime import datetime

def main(year=2024):
    print(f"🏈 Ingesting player profiles for {year}...")
    
    rosters = nfl.import_seasonal_rosters([year])
    
    # Filter to skill positions only
    rosters = rosters[rosters['position'].isin(['QB', 'RB', 'WR', 'TE'])]
    
    # Remove duplicates by player_id
    rosters = rosters.drop_duplicates(subset='player_id')
    
    # Create final dataframe with required columns
    profile_data = pd.DataFrame({
        'player_id': rosters['player_id'],
        'name': rosters['player_name'],
        'position': rosters['position'],
        'team': rosters['team'],
        'age': rosters['age'].fillna(25),  # Use provided age or default to 25
        'draft_round': rosters['draft_number'].fillna(0).apply(lambda x: min(7, max(1, int(x / 32) + 1)) if pd.notna(x) and x > 0 else 0),  # Convert draft number to round
        'draft_pick': rosters['draft_number'].fillna(0).astype(int),
        'contract_yrs_left': 0,  # Placeholder
        'guarantees_usd': 0      # Placeholder
    })
    
    # Remove any rows with missing essential data
    profile_data = profile_data.dropna(subset=['player_id', 'name', 'position'])
    
    path = f'player_profile_{year}.csv'
    profile_data.to_csv(path, index=False)
    print(f'✅ Saved player_profile to {path} with {len(profile_data)} rows')
    print(f"📊 Position breakdown: {profile_data['position'].value_counts().to_dict()}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, default=2024)
    args = parser.parse_args()
    main(args.year)