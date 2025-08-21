import nfl_data_py as nfl
import pandas as pd
import argparse

def main(year=2024, ppr=True):
    """Generate defense vs position fantasy points allowed data"""
    
    # Import weekly data for the season
    weekly_df = nfl.import_weekly_data([year])
    weekly_df = weekly_df[weekly_df['season_type'] == 'REG']
    
    # Use existing fantasy points columns from nfl_data_py
    if ppr:
        weekly_df['fantasy_points'] = weekly_df['fantasy_points_ppr'].fillna(0)
    else:
        weekly_df['fantasy_points'] = weekly_df['fantasy_points'].fillna(0)
    
    # Get schedule to map teams to opponents for each week
    schedule_df = nfl.import_schedules([year])
    schedule_df = schedule_df[schedule_df['game_type'] == 'REG']
    
    # Create opponent mapping
    home_games = schedule_df[['week', 'home_team', 'away_team']].rename(
        columns={'home_team': 'team', 'away_team': 'opponent'}
    )
    away_games = schedule_df[['week', 'away_team', 'home_team']].rename(
        columns={'away_team': 'team', 'home_team': 'opponent'}
    )
    opponent_map = pd.concat([home_games, away_games])
    
    # Merge weekly stats with opponent info
    weekly_df = weekly_df.merge(
        opponent_map, 
        left_on=['week', 'recent_team'], 
        right_on=['week', 'team'], 
        how='left'
    )
    
    # Calculate fantasy points allowed by defense and position
    # Group by defending team (opponent), week, and position
    defense_stats = weekly_df.groupby(['opponent', 'week', 'position'])['fantasy_points'].mean().reset_index()
    defense_stats = defense_stats.rename(columns={
        'opponent': 'def_team',
        'fantasy_points': 'fp_allowed'
    })
    
    # Filter to skill positions only
    skill_positions = ['QB', 'RB', 'WR', 'TE']
    defense_stats = defense_stats[defense_stats['position'].isin(skill_positions)]
    
    # Add season column
    defense_stats['season'] = year
    
    # Reorder columns
    defense_stats = defense_stats[['season', 'week', 'def_team', 'position', 'fp_allowed']]
    
    # Fill missing data with league average for each position/week
    all_teams = list(weekly_df['recent_team'].unique())
    all_weeks = list(range(1, 18))  # Weeks 1-17
    all_positions = skill_positions
    
    # Create complete grid
    complete_grid = []
    for team in all_teams:
        for week in all_weeks:
            for pos in all_positions:
                complete_grid.append({
                    'season': year,
                    'week': week,
                    'def_team': team,
                    'position': pos
                })
    
    complete_df = pd.DataFrame(complete_grid)
    
    # Merge with actual data
    final_df = complete_df.merge(
        defense_stats, 
        on=['season', 'week', 'def_team', 'position'], 
        how='left'
    )
    
    # Fill missing values with position/week averages
    for pos in skill_positions:
        for week in all_weeks:
            mask = (final_df['position'] == pos) & (final_df['week'] == week)
            pos_week_avg = final_df.loc[mask, 'fp_allowed'].mean()
            if pd.isna(pos_week_avg):
                # Use overall position average if week average is NaN
                pos_avg = final_df.loc[final_df['position'] == pos, 'fp_allowed'].mean()
                final_df.loc[mask & final_df['fp_allowed'].isna(), 'fp_allowed'] = pos_avg or 15.0
            else:
                final_df.loc[mask & final_df['fp_allowed'].isna(), 'fp_allowed'] = pos_week_avg
    
    # Remove any remaining NaN values with position defaults
    position_defaults = {'QB': 18.0, 'RB': 12.0, 'WR': 10.0, 'TE': 8.0}
    for pos, default_pts in position_defaults.items():
        mask = (final_df['position'] == pos) & final_df['fp_allowed'].isna()
        final_df.loc[mask, 'fp_allowed'] = default_pts
    
    # Round to 2 decimal places
    final_df['fp_allowed'] = final_df['fp_allowed'].round(2)
    
    # Save to CSV
    csv_path = f'defense_dvp_{year}.csv'
    final_df.to_csv(csv_path, index=False)
    print(f'Defense vs Position data saved to {csv_path}')
    print(f'Total rows: {len(final_df)}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate NFL defense vs position fantasy points data.')
    parser.add_argument('--year', type=int, default=2024, help='Season year')
    parser.add_argument('--ppr', action='store_true', help='Use PPR scoring (default)')
    parser.add_argument('--standard', action='store_true', help='Use standard scoring')
    args = parser.parse_args()
    
    # Default to PPR unless --standard is specified
    use_ppr = not args.standard
    main(year=args.year, ppr=use_ppr)