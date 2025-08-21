import nfl_data_py as nfl
import pandas as pd
import argparse

def main(season=2024, weeks=None):
    """Generate NFL schedule data for specified weeks"""
    
    if weeks is None:
        weeks = list(range(1, 18))  # Default to weeks 1-17
    
    # Import schedule data
    schedule_df = nfl.import_schedules([season])
    
    # Filter to regular season games
    schedule_df = schedule_df[schedule_df['game_type'] == 'REG']
    
    # Filter to specified weeks
    if isinstance(weeks, str):
        if '-' in weeks:
            # Handle range format like "1-17"
            start, end = map(int, weeks.split('-'))
            weeks = list(range(start, end + 1))
        else:
            # Handle comma-separated format like "1,2,3"
            weeks = [int(w.strip()) for w in weeks.split(',')]
    
    schedule_df = schedule_df[schedule_df['week'].isin(weeks)]
    
    # Select and rename columns to match expected format
    final_df = schedule_df[['season', 'week', 'home_team', 'away_team']].copy()
    final_df = final_df.rename(columns={
        'home_team': 'home',
        'away_team': 'away'
    })
    
    # Sort by week and then by game
    final_df = final_df.sort_values(['week', 'home', 'away'])
    
    # Save to CSV
    csv_path = f'schedule_{season}.csv'
    final_df.to_csv(csv_path, index=False)
    print(f'Schedule data saved to {csv_path}')
    print(f'Total games: {len(final_df)} (weeks {min(weeks)}-{max(weeks)})')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate NFL schedule data.')
    parser.add_argument('--season', type=int, default=2024, help='Season year')
    parser.add_argument('--weeks', type=str, default='1-17', help='Week range (e.g., "1-17" or "1,2,3")')
    args = parser.parse_args()
    
    main(season=args.season, weeks=args.weeks)