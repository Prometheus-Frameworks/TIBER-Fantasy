#!/usr/bin/env python3
"""
NFL Offensive Player Rankings System
Uses nfl-data-py to fetch authentic 2024 season data and calculate advanced metrics
Integrates with the fantasy football app's database for real-time rankings
"""

import nfl_data_py as nfl
import pandas as pd
import numpy as np
import json
import sys
import os
from datetime import datetime

# Database connection setup
import psycopg2
from psycopg2.extras import RealDictCursor

class NFLOffenseRankings:
    def __init__(self):
        self.season = 2024
        self.min_snaps = 100  # Minimum snaps for ranking eligibility
        self.min_games = 8    # Minimum games played
        
        # Position-specific weights for composite scoring
        self.weights = {
            'QB': {
                'epa_per_play': 0.40,
                'cpoe': 0.30,
                'deep_pass_rate': 0.20,
                'pressure_rate': 0.10
            },
            'RB': {
                'yac_per_carry': 0.35,
                'rush_epa': 0.25,
                'receiving_yprr': 0.25,
                'broken_tackles': 0.15
            },
            'WR': {
                'yards_per_route': 0.40,
                'target_share': 0.30,
                'air_yards_share': 0.20,
                'contested_catch_rate': 0.10
            },
            'TE': {
                'yards_per_route': 0.35,
                'red_zone_targets': 0.25,
                'blocking_snaps': 0.25,
                'catch_rate_over_expected': 0.15
            }
        }
    
    def fetch_data(self):
        """Fetch 2024 NFL data from nflverse"""
        print(f"Fetching {self.season} NFL data...")
        
        try:
            # Weekly player stats
            self.weekly_data = nfl.import_weekly_data(
                years=[self.season],
                columns=[
                    'player_id', 'player_name', 'position', 'team', 'week',
                    'completions', 'attempts', 'passing_yards', 'passing_tds',
                    'carries', 'rushing_yards', 'rushing_tds',
                    'targets', 'receptions', 'receiving_yards', 'receiving_tds',
                    'fantasy_points', 'fantasy_points_ppr'
                ]
            )
            
            # Play-by-play data for advanced metrics
            self.pbp_data = nfl.import_pbp_data([self.season])
            
            # Next Gen Stats
            self.ngs_receiving = nfl.import_ngs_data('receiving', [self.season])
            self.ngs_rushing = nfl.import_ngs_data('rushing', [self.season])
            self.ngs_passing = nfl.import_ngs_data('passing', [self.season])
            
            print("Data fetch complete!")
            
        except Exception as e:
            print(f"Error fetching data: {e}")
            sys.exit(1)
    
    def calculate_qb_metrics(self):
        """Calculate QB-specific advanced metrics"""
        print("Calculating QB metrics...")
        
        qb_data = self.weekly_data[self.weekly_data['position'] == 'QB'].copy()
        
        # Group by player for season totals
        qb_season = qb_data.groupby(['player_id', 'player_name', 'team']).agg({
            'completions': 'sum',
            'attempts': 'sum',
            'passing_yards': 'sum',
            'passing_tds': 'sum',
            'fantasy_points_ppr': 'sum',
            'week': 'count'  # games played
        }).reset_index()
        
        qb_season.rename(columns={'week': 'games_played'}, inplace=True)
        
        # Filter by minimum games
        qb_season = qb_season[qb_season['games_played'] >= self.min_games]
        
        # Calculate basic efficiency metrics
        qb_season['completion_pct'] = qb_season['completions'] / qb_season['attempts']
        qb_season['yards_per_attempt'] = qb_season['passing_yards'] / qb_season['attempts']
        qb_season['td_rate'] = qb_season['passing_tds'] / qb_season['attempts']
        
        # Add Next Gen Stats if available
        if not self.ngs_passing.empty:
            ngs_qb = self.ngs_passing[self.ngs_passing['season'] == self.season]
            qb_season = qb_season.merge(
                ngs_qb[['player_gsis_id', 'avg_time_to_throw', 'avg_completed_air_yards', 
                       'avg_intended_air_yards', 'completion_percentage_above_expectation']],
                left_on='player_id',
                right_on='player_gsis_id',
                how='left'
            )
        
        # Calculate composite score
        qb_season['composite_score'] = self._calculate_composite_score(qb_season, 'QB')
        
        # Rank players
        qb_season['rank'] = qb_season['composite_score'].rank(ascending=False, method='min')
        
        return qb_season.sort_values('rank').head(25)
    
    def calculate_rb_metrics(self):
        """Calculate RB-specific advanced metrics"""
        print("Calculating RB metrics...")
        
        rb_data = self.weekly_data[self.weekly_data['position'] == 'RB'].copy()
        
        # Group by player for season totals
        rb_season = rb_data.groupby(['player_id', 'player_name', 'team']).agg({
            'carries': 'sum',
            'rushing_yards': 'sum',
            'rushing_tds': 'sum',
            'targets': 'sum',
            'receptions': 'sum',
            'receiving_yards': 'sum',
            'receiving_tds': 'sum',
            'fantasy_points_ppr': 'sum',
            'week': 'count'
        }).reset_index()
        
        rb_season.rename(columns={'week': 'games_played'}, inplace=True)
        
        # Filter by minimum games and carries
        rb_season = rb_season[
            (rb_season['games_played'] >= self.min_games) & 
            (rb_season['carries'] >= 50)
        ]
        
        # Calculate efficiency metrics
        rb_season['yards_per_carry'] = rb_season['rushing_yards'] / rb_season['carries']
        rb_season['yards_per_target'] = rb_season['receiving_yards'] / rb_season['targets'].replace(0, 1)
        rb_season['touch_efficiency'] = (rb_season['rushing_yards'] + rb_season['receiving_yards']) / \
                                       (rb_season['carries'] + rb_season['targets'])
        
        # Add Next Gen Stats if available
        if not self.ngs_rushing.empty:
            ngs_rb = self.ngs_rushing[self.ngs_rushing['season'] == self.season]
            rb_season = rb_season.merge(
                ngs_rb[['player_gsis_id', 'avg_yards_after_contact', 'percent_attempts_gte_eight_defenders',
                       'avg_time_to_los']],
                left_on='player_id',
                right_on='player_gsis_id',
                how='left'
            )
        
        # Calculate composite score
        rb_season['composite_score'] = self._calculate_composite_score(rb_season, 'RB')
        rb_season['rank'] = rb_season['composite_score'].rank(ascending=False, method='min')
        
        return rb_season.sort_values('rank').head(25)
    
    def calculate_wr_metrics(self):
        """Calculate WR-specific advanced metrics"""
        print("Calculating WR metrics...")
        
        wr_data = self.weekly_data[self.weekly_data['position'] == 'WR'].copy()
        
        # Group by player for season totals
        wr_season = wr_data.groupby(['player_id', 'player_name', 'team']).agg({
            'targets': 'sum',
            'receptions': 'sum',
            'receiving_yards': 'sum',
            'receiving_tds': 'sum',
            'fantasy_points_ppr': 'sum',
            'week': 'count'
        }).reset_index()
        
        wr_season.rename(columns={'week': 'games_played'}, inplace=True)
        
        # Filter by minimum games and targets
        wr_season = wr_season[
            (wr_season['games_played'] >= self.min_games) & 
            (wr_season['targets'] >= 30)
        ]
        
        # Calculate efficiency metrics
        wr_season['catch_rate'] = wr_season['receptions'] / wr_season['targets']
        wr_season['yards_per_target'] = wr_season['receiving_yards'] / wr_season['targets']
        wr_season['yards_per_reception'] = wr_season['receiving_yards'] / wr_season['receptions']
        
        # Add Next Gen Stats if available
        if not self.ngs_receiving.empty:
            ngs_wr = self.ngs_receiving[self.ngs_receiving['season'] == self.season]
            wr_season = wr_season.merge(
                ngs_wr[['player_gsis_id', 'avg_cushion', 'avg_separation', 'avg_intended_air_yards',
                       'catch_percentage_above_expectation']],
                left_on='player_id',
                right_on='player_gsis_id',
                how='left'
            )
        
        # Calculate composite score
        wr_season['composite_score'] = self._calculate_composite_score(wr_season, 'WR')
        wr_season['rank'] = wr_season['composite_score'].rank(ascending=False, method='min')
        
        return wr_season.sort_values('rank').head(25)
    
    def calculate_te_metrics(self):
        """Calculate TE-specific advanced metrics"""
        print("Calculating TE metrics...")
        
        te_data = self.weekly_data[self.weekly_data['position'] == 'TE'].copy()
        
        # Group by player for season totals
        te_season = te_data.groupby(['player_id', 'player_name', 'team']).agg({
            'targets': 'sum',
            'receptions': 'sum',
            'receiving_yards': 'sum',
            'receiving_tds': 'sum',
            'fantasy_points_ppr': 'sum',
            'week': 'count'
        }).reset_index()
        
        te_season.rename(columns={'week': 'games_played'}, inplace=True)
        
        # Filter by minimum games and targets
        te_season = te_season[
            (te_season['games_played'] >= self.min_games) & 
            (te_season['targets'] >= 20)
        ]
        
        # Calculate efficiency metrics
        te_season['catch_rate'] = te_season['receptions'] / te_season['targets']
        te_season['yards_per_target'] = te_season['receiving_yards'] / te_season['targets']
        te_season['yards_per_reception'] = te_season['receiving_yards'] / te_season['receptions']
        
        # Add Next Gen Stats if available
        if not self.ngs_receiving.empty:
            ngs_te = self.ngs_receiving[
                (self.ngs_receiving['season'] == self.season) & 
                (self.ngs_receiving['position'] == 'TE')
            ]
            te_season = te_season.merge(
                ngs_te[['player_gsis_id', 'avg_cushion', 'avg_separation', 'avg_intended_air_yards']],
                left_on='player_id',
                right_on='player_gsis_id',
                how='left'
            )
        
        # Calculate composite score
        te_season['composite_score'] = self._calculate_composite_score(te_season, 'TE')
        te_season['rank'] = te_season['composite_score'].rank(ascending=False, method='min')
        
        return te_season.sort_values('rank').head(25)
    
    def _calculate_composite_score(self, df, position):
        """Calculate weighted composite score for position"""
        scores = []
        
        for _, player in df.iterrows():
            score = 0
            
            if position == 'QB':
                # QB scoring based on efficiency and volume
                if player['attempts'] > 0:
                    score += player['completion_pct'] * 30
                    score += player['yards_per_attempt'] * 8
                    score += player['td_rate'] * 100
                    score += (player['fantasy_points_ppr'] / player['games_played']) * 2
                
            elif position == 'RB':
                # RB scoring based on efficiency and usage
                if player['carries'] > 0:
                    score += player['yards_per_carry'] * 15
                    score += (player['fantasy_points_ppr'] / player['games_played']) * 3
                    score += player['touch_efficiency'] * 10
                
            elif position == 'WR':
                # WR scoring based on targets and efficiency
                if player['targets'] > 0:
                    score += player['catch_rate'] * 40
                    score += player['yards_per_target'] * 8
                    score += (player['fantasy_points_ppr'] / player['games_played']) * 3
                    score += (player['targets'] / player['games_played']) * 2
                
            elif position == 'TE':
                # TE scoring similar to WR but adjusted for position
                if player['targets'] > 0:
                    score += player['catch_rate'] * 35
                    score += player['yards_per_target'] * 10
                    score += (player['fantasy_points_ppr'] / player['games_played']) * 4
                    score += (player['targets'] / player['games_played']) * 2.5
            
            scores.append(max(0, score))  # Ensure non-negative scores
        
        return scores
    
    def generate_rankings(self):
        """Generate rankings for all positions"""
        print("Generating comprehensive NFL offensive rankings...")
        
        rankings = {
            'QB': self.calculate_qb_metrics(),
            'RB': self.calculate_rb_metrics(),
            'WR': self.calculate_wr_metrics(),
            'TE': self.calculate_te_metrics()
        }
        
        return rankings
    
    def export_rankings(self, rankings):
        """Export rankings to JSON and database"""
        print("Exporting rankings...")
        
        # Convert to JSON format
        json_output = {}
        for position, df in rankings.items():
            json_output[position] = df.to_dict('records')
        
        # Export to JSON file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"offense_rankings_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(json_output, f, indent=2, default=str)
        
        print(f"Rankings exported to {filename}")
        
        # Store in database if connection available
        try:
            self.store_in_database(rankings)
        except Exception as e:
            print(f"Database storage failed: {e}")
        
        return json_output
    
    def store_in_database(self, rankings):
        """Store rankings in PostgreSQL database"""
        db_url = os.environ.get('DATABASE_URL')
        if not db_url:
            print("No DATABASE_URL found, skipping database storage")
            return
        
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        try:
            # Update player rankings in database
            for position, df in rankings.items():
                for _, player in df.iterrows():
                    cursor.execute("""
                        UPDATE players 
                        SET 
                            advanced_rank = %s,
                            composite_score = %s,
                            updated_at = NOW()
                        WHERE name ILIKE %s AND position = %s
                    """, (
                        int(player['rank']),
                        float(player['composite_score']),
                        player['player_name'],
                        position
                    ))
            
            conn.commit()
            print("Database updated successfully")
            
        except Exception as e:
            conn.rollback()
            print(f"Database update failed: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def print_top_players(self, rankings):
        """Print top 10 players per position"""
        print("\n" + "="*60)
        print("TOP 10 NFL OFFENSIVE PLAYERS BY POSITION (2024)")
        print("="*60)
        
        for position, df in rankings.items():
            print(f"\n{position} RANKINGS:")
            print("-" * 40)
            
            for i, (_, player) in enumerate(df.head(10).iterrows(), 1):
                print(f"{i:2d}. {player['player_name']:<20} ({player['team']}) - "
                      f"Score: {player['composite_score']:.1f}, "
                      f"Fantasy: {player['fantasy_points_ppr']:.1f}")

def main():
    """Main execution function"""
    try:
        rankings_system = NFLOffenseRankings()
        
        # Fetch data
        rankings_system.fetch_data()
        
        # Generate rankings
        rankings = rankings_system.generate_rankings()
        
        # Export results
        json_output = rankings_system.export_rankings(rankings)
        
        # Print top players
        rankings_system.print_top_players(rankings)
        
        print(f"\nRankings generation complete!")
        print(f"Total players ranked:")
        for position, df in rankings.items():
            print(f"  {position}: {len(df)} players")
        
        return json_output
        
    except Exception as e:
        print(f"Error in main execution: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()