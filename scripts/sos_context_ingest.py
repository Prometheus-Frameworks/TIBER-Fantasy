#!/usr/bin/env python3
"""
SOS Context Data Generator
Generates defense_context CSV data for SOSv2 contextual analysis
"""

import argparse
import csv
import os
import random

# NFL teams
NFL_TEAMS = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
    'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
    'LA', 'LAC', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
]

def generate_defense_metrics():
    """Generate realistic defense metrics"""
    # EPA per play allowed (elite: -0.20, bad: +0.25)
    epa_per_play = round(random.uniform(-0.25, 0.30), 4)
    
    # Plays allowed per game (good defenses: 55-65, bad: 65-75)
    plays_per_game = round(random.uniform(52.0, 72.0), 2)
    
    # Red zone TD rate allowed (good: 0.35-0.45, bad: 0.65-0.75)
    rz_td_rate = round(random.uniform(0.30, 0.75), 3)
    
    # Home/Away adjustments (small venue effects)
    home_adj = round(random.uniform(-0.05, 0.05), 3)
    away_adj = round(random.uniform(-0.05, 0.05), 3)
    
    return epa_per_play, plays_per_game, rz_td_rate, home_adj, away_adj

def main():
    parser = argparse.ArgumentParser(description='Generate SOS context data')
    parser.add_argument('--season', type=int, default=2024, help='Season year')
    parser.add_argument('--weeks', type=str, default='1,2', help='Comma-separated weeks')
    
    args = parser.parse_args()
    weeks = [int(w.strip()) for w in args.weeks.split(',')]
    
    output_file = f'defense_context_{args.season}.csv'
    
    print(f"🏈 Generating defense context data for {args.season} season, weeks {weeks}")
    
    with open(output_file, 'w', newline='') as csvfile:
        fieldnames = [
            'season', 'week', 'def_team', 'epa_per_play_allowed',
            'plays_allowed_per_game', 'rz_td_rate_allowed',
            'home_def_adj', 'away_def_adj'
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        rows_written = 0
        for week in weeks:
            for team in NFL_TEAMS:
                epa, plays, rz_rate, home_adj, away_adj = generate_defense_metrics()
                
                writer.writerow({
                    'season': args.season,
                    'week': week,
                    'def_team': team,
                    'epa_per_play_allowed': epa,
                    'plays_allowed_per_game': plays,
                    'rz_td_rate_allowed': rz_rate,
                    'home_def_adj': home_adj,
                    'away_def_adj': away_adj
                })
                rows_written += 1
        
        print(f"✅ Generated {rows_written} defense context records")
        print(f"📄 Output saved to: {output_file}")
        
        # Show sample data
        print(f"\n📊 Sample data for week {weeks[0]}:")
        print("Team | EPA/play | Plays/G | RZ TD% | Home | Away")
        print("-" * 50)
        
        # Reset file pointer to read sample
        csvfile.seek(0)
        reader = csv.DictReader(csvfile)
        next(reader)  # Skip header
        
        sample_count = 0
        for row in reader:
            if int(row['week']) == weeks[0] and sample_count < 5:
                print(f"{row['def_team']:4} | {float(row['epa_per_play_allowed']):+.3f}    | {float(row['plays_allowed_per_game']):5.1f}  | {float(row['rz_td_rate_allowed']):.3f}  | {float(row['home_def_adj']):+.3f} | {float(row['away_def_adj']):+.3f}")
                sample_count += 1

if __name__ == '__main__':
    main()