#!/usr/bin/env python3
"""
NFLfastR weekly data fetcher using nflreadpy (nfl_data_py was archived Sept 2025).
Fetches a single week of player statistics and returns JSON.
"""

import sys
import json
import warnings
import pandas as pd
import nflreadpy as nfl

# Suppress ALL warnings to keep JSON output clean
warnings.simplefilter(action='ignore', category=FutureWarning)
warnings.simplefilter(action='ignore', category=UserWarning)
pd.options.mode.chained_assignment = None

def fetch_weekly_stats(season: int, week: int):
    """
    Fetch weekly player statistics from NFLfastR via nflreadpy.
    
    Args:
        season: NFL season year (e.g., 2025)
        week: Week number (1-18)
    
    Returns:
        JSON array of player stats for the specified week
    """
    try:
        # Fetch player stats from nflreadpy (returns Polars DataFrame)
        df_polars = nfl.load_player_stats([season])
        
        # Convert to pandas for easier manipulation
        df = df_polars.to_pandas()
        
        # Filter to the specific week
        week_df = df[df['week'] == week].copy()
        
        # If no data, return empty array
        if week_df.empty:
            return []
        
        # Fetch snap counts for route estimation
        snap_counts = {}
        try:
            snaps_polars = nfl.load_snap_counts([season])
            snaps_df = snaps_polars.to_pandas()
            week_snaps = snaps_df[snaps_df['week'] == week]
            # Create lookup by player name (fallback to pfr_player_id if needed)
            for _, row in week_snaps.iterrows():
                player_key = row.get('player', '')
                if player_key and pd.notna(row.get('offense_snaps')):
                    snap_counts[player_key] = {
                        'snaps': int(row['offense_snaps']),
                        'snap_pct': float(row['offense_pct']) if pd.notna(row.get('offense_pct')) else None
                    }
        except Exception as e:
            print(f"Warning: Could not load snap counts: {e}", file=sys.stderr)
        
        # Calculate total fumbles (sack + rush + rec fumbles lost)
        week_df['fumbles'] = (
            week_df.get('sack_fumbles_lost', 0).fillna(0) +
            week_df.get('rushing_fumbles_lost', 0).fillna(0) +
            week_df.get('receiving_fumbles_lost', 0).fillna(0)
        ).astype(int)
        
        # Calculate total 2pt conversions
        week_df['two_pt'] = (
            week_df.get('passing_2pt_conversions', 0).fillna(0) +
            week_df.get('rushing_2pt_conversions', 0).fillna(0) +
            week_df.get('receiving_2pt_conversions', 0).fillna(0)
        ).astype(int)
        
        # Map nflreadpy columns to our WeeklyRow interface
        # Note: original data has player_name (short) and player_display_name (full)
        # Drop the short player_name and use full player_display_name instead
        if 'player_name' in week_df.columns:
            week_df = week_df.drop(columns=['player_name'])
        week_df = week_df.rename(columns={
            'player_display_name': 'player_name',
            'carries': 'rush_att',
            'rushing_yards': 'rush_yd',
            'rushing_tds': 'rush_td',
            'receptions': 'rec',
            'receiving_yards': 'rec_yd',
            'receiving_tds': 'rec_td',
            'passing_yards': 'pass_yd',
            'passing_tds': 'pass_td',
            'passing_interceptions': 'int',
            'sacks_suffered': 'sacks',
        })
        
        # Add snaps and routes from snap counts lookup
        # Routes estimated as snaps * 0.70 for WR, 0.55 for TE, 0.40 for RB
        route_rates = {'WR': 0.70, 'TE': 0.55, 'RB': 0.40, 'QB': 0.0}
        
        # Build snaps and routes columns using vectorized operations
        snaps_list = []
        routes_list = []
        for idx, row in week_df.iterrows():
            player_name = row['player_name']
            position = row['position']
            info = snap_counts.get(str(player_name), {})
            snaps = info.get('snaps')
            if snaps and snaps > 0 and position in route_rates and route_rates[position] > 0:
                routes = int(snaps * route_rates[position])
                snaps_list.append(snaps)
                routes_list.append(routes)
            else:
                snaps_list.append(snaps)
                routes_list.append(None)
        
        week_df['snaps'] = snaps_list
        week_df['routes_run'] = routes_list
        
        # Select final columns
        output_cols = [
            'season', 'week', 'player_id', 'player_name', 'team', 'position',
            'snaps', 'routes_run', 'targets', 'rush_att', 'rec', 'rec_yd', 'rec_td',
            'rush_yd', 'rush_td', 'pass_yd', 'pass_td', 'int',
            'fumbles', 'two_pt'
        ]
        
        # Ensure all columns exist (fill missing with None)
        for col in output_cols:
            if col not in week_df.columns:
                week_df[col] = None
        
        # Filter to only rows with actual production
        week_df = week_df[
            (week_df['rush_att'].fillna(0) > 0) |
            (week_df['targets'].fillna(0) > 0) |
            (week_df['rec'].fillna(0) > 0) |
            (week_df['pass_yd'].fillna(0) > 0)
        ]
        
        # Convert to dict - use replace instead of fillna to avoid downcasting messages
        result = week_df[output_cols].replace({pd.NA: 0, pd.NaT: None}).to_dict('records')
        
        # Convert numpy types to native Python types for JSON serialization
        for row in result:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
                elif hasattr(value, 'item'):  # numpy type
                    row[key] = value.item()
        
        return result
        
    except Exception as e:
        print(f"Error fetching weekly data: {str(e)}", file=sys.stderr)
        raise


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: fetch-weekly.py <season> <week>", file=sys.stderr)
        sys.exit(1)
    
    season = int(sys.argv[1])
    week = int(sys.argv[2])
    
    # Guardrail: Prevent full-season fetches
    if week < 1 or week > 18:
        print(f"Error: Week must be between 1 and 18, got {week}", file=sys.stderr)
        sys.exit(1)
    
    stats = fetch_weekly_stats(season, week)
    print(json.dumps(stats, indent=2))
