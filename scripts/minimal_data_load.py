import pandas as pd
import numpy as np
import argparse

def create_minimal_inputs(year=2024, weeks=[6, 7, 8]):
    """Create minimal player inputs from profile data"""
    print(f"🔧 Creating minimal player inputs for weeks {weeks}...")
    
    # Load player profiles
    try:
        profiles = pd.read_csv(f'player_profile_{year}.csv')
        print(f"📊 Loaded {len(profiles)} player profiles")
    except FileNotFoundError:
        print("❌ player_profile_2024.csv not found. Run ingest_player_profile.py first.")
        return
    
    # Create inputs for each week
    inputs_data = []
    
    for week in weeks:
        for _, player in profiles.iterrows():
            # Base stats with some randomization for realism
            snap_pct = np.random.uniform(40, 100) if player['position'] in ['QB', 'RB'] else np.random.uniform(20, 95)
            
            if player['position'] == 'RB':
                rush_share = np.random.uniform(15, 45)
                target_share = np.random.uniform(5, 25)
                routes = target_share * 2
                goalline_share = np.random.uniform(10, 40)
            elif player['position'] == 'WR':
                rush_share = np.random.uniform(0, 5)
                target_share = np.random.uniform(10, 35)
                routes = np.random.uniform(25, 45)
                goalline_share = np.random.uniform(5, 20)
            elif player['position'] == 'TE':
                rush_share = np.random.uniform(0, 3)
                target_share = np.random.uniform(8, 25)
                routes = np.random.uniform(20, 40)
                goalline_share = np.random.uniform(10, 30)
            else:  # QB
                rush_share = np.random.uniform(5, 15)
                target_share = 0
                routes = 0
                goalline_share = np.random.uniform(0, 10)
            
            input_row = {
                'player_id': player['player_id'],
                'season': year,
                'week': week,
                'position': player['position'],
                'team': player['team'],
                'snap_pct': round(snap_pct, 1),
                'routes': round(routes, 1),
                'tprr': round(target_share / max(routes, 1) if routes > 0 else 0, 3),
                'rush_share': round(rush_share, 1),
                'target_share': round(target_share, 1),
                'goalline_share': round(goalline_share, 1),
                'two_min_share': round(goalline_share * 0.8, 1),
                'yprr': round(np.random.uniform(1.0, 3.5), 2),
                'yac_per_rec': round(np.random.uniform(3, 12), 1),
                'mtf': round(np.random.uniform(0, 4), 1),
                'succ_rate': round(np.random.uniform(0.35, 0.65), 3),
                'epa_per_play_qb': round(np.random.uniform(-0.1, 0.3), 3) if player['position'] == 'QB' else 0,
                'team_epa_play': round(np.random.uniform(-0.05, 0.15), 3),
                'team_pace': round(np.random.uniform(58, 72), 1),
                'team_rz_plays': round(np.random.uniform(8, 16), 0),
                'injury_status': 'healthy',
                'dnp_weeks_rolling': 0,
                'sos_ctx': round(np.random.uniform(35, 65), 1)
            }
            
            inputs_data.append(input_row)
    
    # Create DataFrame and save
    df_inputs = pd.DataFrame(inputs_data)
    
    path = f'player_inputs_{year}.csv'
    df_inputs.to_csv(path, index=False)
    print(f'✅ Created {path} with {len(df_inputs)} rows')
    print(f"📊 Position breakdown: {df_inputs['position'].value_counts().to_dict()}")
    print(f"📊 Week breakdown: {df_inputs['week'].value_counts().sort_index().to_dict()}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, default=2024)
    parser.add_argument('--weeks', type=str, default='6-8')
    args = parser.parse_args()
    
    start, end = map(int, args.weeks.split('-'))
    weeks = list(range(start, end + 1))
    create_minimal_inputs(args.year, weeks)