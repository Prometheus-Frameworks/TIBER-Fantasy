#!/usr/bin/env python3
"""
Generate NFL Data for Prometheus Rankings
Creates JSON files with authentic 2024 NFL data
"""

import nfl_data_py as nfl
import json
import warnings
warnings.filterwarnings('ignore')

def generate_position_data(position):
    """Generate data for a specific position"""
    print(f"Processing {position}...")
    
    # Get 2023-2024 data for deeper player pool
    weekly = nfl.import_weekly_data([2023, 2024])
    pos_data = weekly[weekly['position'] == position]

    # Aggregate by player
    if position == 'QB':
        player_totals = pos_data.groupby(['player_id', 'player_name', 'recent_team']).agg({
            'passing_yards': 'sum',
            'passing_tds': 'sum',
            'fantasy_points_ppr': 'sum',
            'week': 'count'
        }).reset_index()
        
        # Very inclusive filter for QB to get close to 175
        relevant = player_totals[
            (player_totals['fantasy_points_ppr'] >= 0.1)
        ]
    else:
        player_totals = pos_data.groupby(['player_id', 'player_name', 'recent_team']).agg({
            'targets': 'sum',
            'receptions': 'sum', 
            'receiving_yards': 'sum',
            'receiving_tds': 'sum',
            'fantasy_points_ppr': 'sum',
            'week': 'count'
        }).reset_index()

        # Very inclusive filters to get close to 175 players each
        if position == 'WR':
            relevant = player_totals[
                (player_totals['fantasy_points_ppr'] >= 0.1)
            ]
        elif position == 'RB':
            relevant = player_totals[
                (player_totals['fantasy_points_ppr'] >= 0.1)
            ]
        elif position == 'TE':
            relevant = player_totals[
                (player_totals['fantasy_points_ppr'] >= 0.1)
            ]

    # Sort by fantasy points and take top 175 (or all available if less than 175)
    num_to_take = min(175, len(relevant))
    top_players = relevant.nlargest(num_to_take, 'fantasy_points_ppr')

    # Convert to clean format
    result = []
    for idx, row in top_players.iterrows():
        player = {
            'player_id': str(row['player_id']),
            'player_name': str(row['player_name']),
            'recent_team': str(row['recent_team']),
            'games': int(row['week']),
            'fantasy_points_ppr': float(row['fantasy_points_ppr'])
        }
        
        # Add position-specific stats
        if position == 'QB':
            player.update({
                'passing_yards': int(row.get('passing_yards', 0)),
                'passing_tds': int(row.get('passing_tds', 0)),
                'targets': 0,
                'receptions': 0,
                'receiving_yards': 0,
                'receiving_tds': 0
            })
        else:
            player.update({
                'targets': int(row.get('targets', 0)),
                'receptions': int(row.get('receptions', 0)),
                'receiving_yards': int(row.get('receiving_yards', 0)),
                'receiving_tds': int(row.get('receiving_tds', 0)),
                'passing_yards': 0,
                'passing_tds': 0
            })
        
        result.append(player)

    return result

def main():
    """Generate data for all positions"""
    all_data = {}
    
    for position in ['QB', 'RB', 'WR', 'TE']:
        try:
            all_data[position] = generate_position_data(position)
            print(f"✅ {position}: {len(all_data[position])} players")
        except Exception as e:
            print(f"❌ Error processing {position}: {e}")
            all_data[position] = []
    
    # Save to file
    output_file = 'server/nfl_data_2024.json'
    with open(output_file, 'w') as f:
        json.dump(all_data, f, indent=2)
    
    print(f"\n📁 Data saved to {output_file}")
    print(f"Total players: {sum(len(players) for players in all_data.values())}")

if __name__ == "__main__":
    main()