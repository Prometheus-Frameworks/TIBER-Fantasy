import nfl_data_py as nfl
import pandas as pd
import argparse
from datetime import datetime

def main(year=2024):
    rosters = nfl.import_rosters([year])
    rosters = rosters[['gsis_id', 'first_name', 'last_name', 'position', 'team', 'birth_date', 'draft_round', 'draft_number']]
    rosters['player_id'] = rosters['gsis_id']
    rosters['name'] = rosters['first_name'] + ' ' + rosters['last_name']
    rosters['draft_round'] = rosters['draft_round'].fillna(0).astype(int)
    rosters['draft_pick'] = rosters['draft_number'].fillna(0).astype(int)
    rosters['age'] = ((datetime(year, 9, 1) - pd.to_datetime(rosters['birth_date'])).dt.days / 365).astype(int)
    rosters['contract_yrs_left'] = 0  # Placeholder; merge from external contract CSV if available
    rosters['guarantees_usd'] = 0  # Placeholder
    rosters = rosters.drop_duplicates(subset='player_id')
    rosters = rosters[rosters['position'].isin(['QB', 'RB', 'WR', 'TE'])]
    path = f'player_profile_{year}.csv'
    rosters.to_csv(path, index=False, columns=['player_id', 'name', 'position', 'team', 'age', 'draft_round', 'draft_pick', 'contract_yrs_left', 'guarantees_usd'])
    print(f'Saved player_profile to {path} with {len(rosters)} rows')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, default=2024)
    args = parser.parse_args()
    main(args.year)