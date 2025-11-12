#!/usr/bin/env python3
"""
NFLfastR Data Query Script
Queries play-by-play data to validate pattern observation metrics
"""
import sys
import json
import nfl_data_py as nfl

def query_route_depth(player_name, season=2025):
    """
    Calculate average route depth (air yards) for a receiver
    Handles abbreviated names like "A.Pierce" by checking if receiver_player_name contains the name
    """
    try:
        pbp = nfl.import_pbp_data([season])
        
        # Handle abbreviated names (A.Pierce) by doing partial match
        if '.' in player_name:
            player_data = pbp[
                (pbp['receiver_player_name'].str.contains(player_name, na=False, case=False)) & 
                (pbp['air_yards'].notna())
            ]
        else:
            player_data = pbp[
                (pbp['receiver_player_name'] == player_name) & 
                (pbp['air_yards'].notna())
            ]
        
        if len(player_data) == 0:
            return None
            
        avg_route_depth = player_data['air_yards'].mean()
        target_count = len(player_data)
        
        return {
            'metric': 'route_depth',
            'value': round(avg_route_depth, 2),
            'sample_size': target_count,
            'player': player_name,
            'season': season
        }
    except Exception as e:
        return {'error': str(e)}

def query_chunk_yardage_rate(player_name, season=2025, thresholds=[10, 15, 20, 30]):
    """
    Calculate percentage of runs hitting chunk yardage thresholds
    Handles abbreviated names like "D.Achane" by checking if rusher_player_name contains the name
    """
    try:
        pbp = nfl.import_pbp_data([season])
        
        # Handle abbreviated names (D.Achane) by doing partial match
        if '.' in player_name:
            player_data = pbp[
                (pbp['rusher_player_name'].str.contains(player_name, na=False, case=False)) &
                (pbp['yards_gained'].notna())
            ]
        else:
            player_data = pbp[
                (pbp['rusher_player_name'] == player_name) &
                (pbp['yards_gained'].notna())
            ]
        
        if len(player_data) == 0:
            return None
            
        total_runs = len(player_data)
        rates = {}
        
        for threshold in thresholds:
            chunk_runs = len(player_data[player_data['yards_gained'] >= threshold])
            rates[f'{threshold}+'] = round((chunk_runs / total_runs) * 100, 2)
        
        return {
            'metric': 'chunk_yardage_rate',
            'value': rates,
            'sample_size': total_runs,
            'player': player_name,
            'season': season
        }
    except Exception as e:
        return {'error': str(e)}

def query_success_rate(player_name, season=2025):
    """
    Calculate success rate for RB (plays meeting down/distance thresholds)
    Handles abbreviated names by doing partial match
    """
    try:
        pbp = nfl.import_pbp_data([season])
        
        # Handle abbreviated names by doing partial match
        if '.' in player_name:
            player_data = pbp[
                (pbp['rusher_player_name'].str.contains(player_name, na=False, case=False)) &
                (pbp['success'].notna())
            ]
        else:
            player_data = pbp[
                (pbp['rusher_player_name'] == player_name) &
                (pbp['success'].notna())
            ]
        
        if len(player_data) == 0:
            return None
            
        total_plays = len(player_data)
        successful_plays = len(player_data[player_data['success'] == 1])
        success_rate = (successful_plays / total_plays) * 100
        
        return {
            'metric': 'success_rate',
            'value': round(success_rate, 2),
            'sample_size': total_plays,
            'player': player_name,
            'season': season
        }
    except Exception as e:
        return {'error': str(e)}

def query_dropback_rate_trailing(team_abbr, season=2025):
    """
    Calculate team's dropback rate when trailing (game script indicator)
    """
    try:
        pbp = nfl.import_pbp_data([season])
        
        team_data = pbp[pbp['posteam'] == team_abbr]
        trailing_data = team_data[team_data['score_differential'] < 0]
        
        if len(trailing_data) == 0:
            return None
            
        total_plays_trailing = len(trailing_data)
        pass_plays_trailing = len(trailing_data[trailing_data['play_type'] == 'pass'])
        dropback_rate = (pass_plays_trailing / total_plays_trailing) * 100
        
        return {
            'metric': 'dropback_rate_while_trailing',
            'value': round(dropback_rate, 2),
            'sample_size': total_plays_trailing,
            'team': team_abbr,
            'season': season
        }
    except Exception as e:
        return {'error': str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: query_nflfastr.py <metric> <player_name|team_abbr> [season]'}))
        sys.exit(1)
    
    metric = sys.argv[1]
    identifier = sys.argv[2]
    season = int(sys.argv[3]) if len(sys.argv) > 3 else 2025
    
    result = None
    
    if metric == 'route_depth':
        result = query_route_depth(identifier, season)
    elif metric == 'chunk_yardage_rate':
        result = query_chunk_yardage_rate(identifier, season)
    elif metric == 'success_rate':
        result = query_success_rate(identifier, season)
    elif metric == 'dropback_rate_while_trailing':
        result = query_dropback_rate_trailing(identifier, season)
    else:
        result = {'error': f'Unknown metric: {metric}'}
    
    print(json.dumps(result))
