import nfl_data_py as nfl
import pandas as pd
import argparse

# Hardcoded HFA points from nfelo (last 5 seasons, incl. 2024)
TEAM_HFA = {
    'ARI': 1.50, 'ATL': 2.64, 'BAL': 3.06, 'BUF': 5.32, 'CAR': 1.21,
    'CHI': 2.81, 'CIN': 1.83, 'CLE': 2.67, 'DAL': 3.67, 'DEN': 5.26,
    'DET': 6.25, 'GB': 2.68, 'HOU': 1.47, 'IND': 0.98, 'JAX': 2.88,
    'KC': -4.09, 'LAC': 1.36, 'LAR': 0.82, 'LV': 2.38, 'MIA': 5.21,
    'MIN': 0.75, 'NE': 1.28, 'NO': -0.75, 'NYG': -0.30, 'NYJ': 4.64,
    'PHI': 1.71, 'PIT': 0.66, 'SEA': 0.28, 'SF': 2.35, 'TB': 1.77,
    'TEN': -0.34, 'WAS': 0.99
}

SCALE = 208.0  # Approx max abs(HFA) 6.25 / 0.03

def compute_adj(hfa):
    home_adj = - (hfa / SCALE)
    away_adj = - home_adj  # Symmetric flip
    return home_adj, away_adj

def main(season=2024, weeks=[1, 2]):
    pbp = nfl.import_pbp_data([season])
    pbp = pbp[(pbp['season_type'] == 'REG') & pbp['week'].isin(weeks)]

    # EPA per play allowed (mean EPA where not NaN)
    epa_df = pbp[pbp['epa'].notna()].groupby(['defteam', 'week'])['epa'].mean().reset_index(name='epa_per_play_allowed')

    # Plays allowed per game (count of plays with EPA)
    plays_df = pbp[pbp['epa'].notna()].groupby(['defteam', 'week']).size().reset_index(name='plays_allowed_per_game')

    # RZ TD rate allowed
    pbp['red_zone'] = pbp['yardline_100'] <= 20
    drive_groups = ['game_id', 'drive', 'defteam', 'posteam', 'week']
    rz_trip = pbp.groupby(drive_groups)['red_zone'].max().reset_index(name='is_rz_trip')
    rz_trip = rz_trip[rz_trip['is_rz_trip'] == 1]
    td_in_drive = pbp.groupby(drive_groups)['touchdown'].max().reset_index(name='had_td')
    rz_trip = rz_trip.merge(td_in_drive[['game_id', 'drive', 'defteam', 'posteam', 'week', 'had_td']], on=drive_groups)
    rz_td_df = rz_trip.groupby(['defteam', 'week'])['had_td'].mean().reset_index(name='rz_td_rate_allowed')
    rz_td_df['rz_td_rate_allowed'] = rz_td_df['rz_td_rate_allowed'].fillna(0)  # No trips -> 0

    # Merge all
    df = pd.merge(epa_df, plays_df, on=['defteam', 'week'], how='outer')
    df = pd.merge(df, rz_td_df, on=['defteam', 'week'], how='outer')
    df['season'] = season

    # Add adjs for all teams (repeat per week)
    all_teams = list(TEAM_HFA.keys())
    all_weeks = pd.DataFrame({'week': weeks})
    all_teams_df = pd.DataFrame({'def_team': all_teams})
    all_teams_df = all_teams_df.merge(all_weeks, how='cross')
    all_teams_df['season'] = season

    df = all_teams_df.merge(df, left_on=['season', 'week', 'def_team'], right_on=['season', 'week', 'defteam'], how='left')
    df.drop(columns=['defteam'], inplace=True, errors='ignore')

    # Fill adjs
    df['home_def_adj'] = df['def_team'].apply(lambda t: compute_adj(TEAM_HFA.get(t, 0))[0])
    df['away_def_adj'] = df['def_team'].apply(lambda t: compute_adj(TEAM_HFA.get(t, 0))[1])

    # Fill NaNs gracefully (e.g., bye weeks: use league avg or 0, but for early weeks, all have data)
    df['epa_per_play_allowed'] = df['epa_per_play_allowed'].fillna(0)
    df['plays_allowed_per_game'] = df['plays_allowed_per_game'].fillna(60)  # Approx league avg
    df['rz_td_rate_allowed'] = df['rz_td_rate_allowed'].fillna(0.55)  # Approx league avg

    # Reorder columns
    cols = ['season', 'week', 'def_team', 'epa_per_play_allowed', 'plays_allowed_per_game', 'rz_td_rate_allowed', 'home_def_adj', 'away_def_adj']
    df = df[cols]

    # Save
    csv_path = f'defense_context_{season}.csv'
    df.to_csv(csv_path, index=False)
    print(f'Defense context data saved to {csv_path}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Ingest NFL defense context for SOS v2.')
    parser.add_argument('--season', type=int, default=2024, help='Season year')
    parser.add_argument('--weeks', type=str, default='1,2', help='Comma-separated week range, e.g., 1,2')
    args = parser.parse_args()
    weeks = [int(w) for w in args.weeks.split(',')]
    main(season=args.season, weeks=weeks)