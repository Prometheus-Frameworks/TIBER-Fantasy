#!/usr/bin/env python3
"""
NFL Refined Rankings System
Removes artificially inflated rankings and ensures rankings reflect true fantasy value
Based on consistent, fantasy-relevant analytics with minimum thresholds
"""

import nfl_data_py as nfl
import pandas as pd
import numpy as np
import json
import sys
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class NFLRefinedRankings:
    def __init__(self):
        self.exclusion_log = []
        self.season = 2024
        self.position_thresholds = {
            'QB': {'min_games': 8, 'min_attempts': 150, 'min_ppg': 12.0},
            'RB': {'min_games': 8, 'min_carries': 50, 'min_ppg': 8.0},
            'WR': {'min_games': 8, 'min_targets': 40, 'min_ppg': 6.0},
            'TE': {'min_games': 8, 'min_targets': 30, 'min_ppg': 5.0}
        }
        
    def load_nfl_data(self):
        """Load comprehensive NFL data for 2024 season"""
        print("🏈 Loading 2024 NFL data...")
        
        try:
            # Load core datasets
            self.rosters = nfl.import_rosters([self.season])
            self.stats = nfl.import_weekly_data([self.season])
            self.pbp = nfl.import_pbp_data([self.season])
            
            print(f"✅ Loaded {len(self.rosters)} roster entries")
            print(f"✅ Loaded {len(self.stats)} weekly stat entries")
            print(f"✅ Loaded {len(self.pbp)} play-by-play entries")
            
            return True
            
        except Exception as e:
            print(f"❌ Data loading failed: {e}")
            return False
    
    def calculate_advanced_metrics(self):
        """Calculate advanced fantasy-relevant metrics"""
        print("📊 Calculating advanced metrics...")
        
        # Aggregate season stats
        season_stats = self.stats.groupby(['player_id', 'position']).agg({
            'fantasy_points_ppr': ['sum', 'mean', 'count'],
            'targets': 'sum',
            'receptions': 'sum',
            'receiving_yards': 'sum',
            'receiving_tds': 'sum',
            'carries': 'sum',
            'rushing_yards': 'sum',
            'rushing_tds': 'sum',
            'passing_yards': 'sum',
            'passing_tds': 'sum',
            'interceptions': 'sum',
            'completions': 'sum',
            'attempts': 'sum'
        }).round(1)
        
        # Flatten column names
        season_stats.columns = [f"{col[0]}_{col[1]}" if col[1] else col[0] for col in season_stats.columns]
        season_stats = season_stats.reset_index()
        
        # Merge with roster data for names
        self.player_stats = season_stats.merge(
            self.rosters[['player_id', 'player_name', 'team', 'position']].drop_duplicates(),
            on='player_id',
            how='left'
        )
        
        # Calculate key metrics
        self.player_stats['games_played'] = self.player_stats['fantasy_points_ppr_count']
        self.player_stats['ppg'] = self.player_stats['fantasy_points_ppr_mean']
        self.player_stats['total_fantasy_points'] = self.player_stats['fantasy_points_ppr_sum']
        
        print(f"✅ Processed {len(self.player_stats)} player stat records")
        
    def identify_artificially_inflated_players(self):
        """Identify players with artificially inflated rankings"""
        print("🔍 Identifying artificially inflated rankings...")
        
        refined_players = []
        excluded_count = 0
        
        for position in ['QB', 'RB', 'WR', 'TE']:
            pos_players = self.player_stats[
                self.player_stats['position'] == position
            ].copy()
            
            if pos_players.empty:
                continue
                
            thresholds = self.position_thresholds[position]
            
            print(f"\n📋 Processing {position} players ({len(pos_players)} total)")
            
            for _, player in pos_players.iterrows():
                exclude_reasons = []
                
                # Check minimum games threshold
                if player['games_played'] < thresholds['min_games']:
                    exclude_reasons.append(f"Only {player['games_played']} games played (min: {thresholds['min_games']})")
                
                # Check PPG threshold
                if player['ppg'] < thresholds['min_ppg']:
                    exclude_reasons.append(f"PPG {player['ppg']:.1f} below minimum {thresholds['min_ppg']}")
                
                # Position-specific volume checks
                if position == 'QB':
                    if player['attempts_sum'] < thresholds['min_attempts']:
                        exclude_reasons.append(f"Only {player['attempts_sum']} pass attempts (min: {thresholds['min_attempts']})")
                
                elif position in ['RB']:
                    if player['carries_sum'] < thresholds['min_carries']:
                        exclude_reasons.append(f"Only {player['carries_sum']} carries (min: {thresholds['min_carries']})")
                
                elif position in ['WR', 'TE']:
                    if player['targets_sum'] < thresholds['min_targets']:
                        exclude_reasons.append(f"Only {player['targets_sum']} targets (min: {thresholds['min_targets']})")
                
                # Check for statistical anomalies
                if player['ppg'] > 0:
                    # Flag extremely low efficiency players
                    if position in ['WR', 'TE'] and player['targets_sum'] > 0:
                        catch_rate = player['receptions_sum'] / player['targets_sum']
                        if catch_rate < 0.40:  # Less than 40% catch rate
                            exclude_reasons.append(f"Poor catch rate: {catch_rate:.1%}")
                    
                    # Flag one-game wonders (high total but few games)
                    if player['games_played'] < 6 and player['total_fantasy_points'] > 100:
                        exclude_reasons.append("Potential one-game outlier with limited sample")
                
                # Exclude or include player
                if exclude_reasons:
                    excluded_count += 1
                    exclusion_reason = "; ".join(exclude_reasons)
                    self.exclusion_log.append({
                        'player_name': player['player_name'],
                        'position': position,
                        'ppg': player['ppg'],
                        'games_played': player['games_played'],
                        'reason': exclusion_reason
                    })
                    print(f"❌ EXCLUDED: {player['player_name']} - {exclusion_reason}")
                else:
                    refined_players.append(player)
        
        self.refined_players = pd.DataFrame(refined_players)
        print(f"\n✅ Refinement complete: {len(self.refined_players)} players retained, {excluded_count} excluded")
        
    def calculate_composite_scores(self):
        """Calculate composite fantasy scores for refined player set"""
        print("🧮 Calculating composite fantasy scores...")
        
        position_scores = {}
        
        for position in ['QB', 'RB', 'WR', 'TE']:
            pos_players = self.refined_players[
                self.refined_players['position'] == position
            ].copy()
            
            if pos_players.empty:
                continue
            
            # Position-specific scoring weights
            if position == 'QB':
                # QB scoring: Passing volume (40%) + Efficiency (30%) + Rushing (20%) + Consistency (10%)
                pos_players['passing_score'] = (
                    pos_players['passing_yards_sum'] * 0.04 + 
                    pos_players['passing_tds_sum'] * 4 - 
                    pos_players['interceptions_sum'] * 2
                )
                pos_players['efficiency_score'] = np.where(
                    pos_players['attempts_sum'] > 0,
                    (pos_players['completions_sum'] / pos_players['attempts_sum']) * 100,
                    0
                )
                pos_players['rushing_score'] = pos_players['rushing_yards_sum'] * 0.1 + pos_players['rushing_tds_sum'] * 6
                pos_players['consistency_score'] = 100 - (pos_players['ppg'] * 2)  # Lower variance = higher score
                
                pos_players['composite_score'] = (
                    pos_players['passing_score'] * 0.4 +
                    pos_players['efficiency_score'] * 0.3 +
                    pos_players['rushing_score'] * 0.2 +
                    pos_players['consistency_score'] * 0.1
                )
                
            elif position == 'RB':
                # RB scoring: Rushing (50%) + Receiving (30%) + TD upside (15%) + Efficiency (5%)
                pos_players['rushing_score'] = pos_players['rushing_yards_sum'] * 0.1 + pos_players['carries_sum'] * 0.5
                pos_players['receiving_score'] = pos_players['receiving_yards_sum'] * 0.1 + pos_players['receptions_sum'] * 1
                pos_players['td_score'] = (pos_players['rushing_tds_sum'] + pos_players['receiving_tds_sum']) * 6
                pos_players['efficiency_score'] = np.where(
                    pos_players['carries_sum'] > 0,
                    (pos_players['rushing_yards_sum'] / pos_players['carries_sum']) * 10,
                    0
                )
                
                pos_players['composite_score'] = (
                    pos_players['rushing_score'] * 0.5 +
                    pos_players['receiving_score'] * 0.3 +
                    pos_players['td_score'] * 0.15 +
                    pos_players['efficiency_score'] * 0.05
                )
                
            else:  # WR/TE
                # WR/TE scoring: Volume (40%) + Efficiency (30%) + TD production (20%) + Target share (10%)
                pos_players['volume_score'] = pos_players['targets_sum'] * 0.5 + pos_players['receptions_sum'] * 1
                pos_players['efficiency_score'] = np.where(
                    pos_players['targets_sum'] > 0,
                    (pos_players['receptions_sum'] / pos_players['targets_sum']) * 50,
                    0
                )
                pos_players['yards_score'] = pos_players['receiving_yards_sum'] * 0.1
                pos_players['td_score'] = pos_players['receiving_tds_sum'] * 6
                
                pos_players['composite_score'] = (
                    pos_players['volume_score'] * 0.4 +
                    pos_players['efficiency_score'] * 0.3 +
                    pos_players['yards_score'] * 0.2 +
                    pos_players['td_score'] * 0.1
                )
            
            # Normalize scores to 0-100 scale
            if len(pos_players) > 0:
                max_score = pos_players['composite_score'].max()
                if max_score > 0:
                    pos_players['normalized_score'] = (pos_players['composite_score'] / max_score * 100).round(1)
                else:
                    pos_players['normalized_score'] = 0
            
            # Rank players
            pos_players = pos_players.sort_values('normalized_score', ascending=False).reset_index(drop=True)
            pos_players['rank'] = range(1, len(pos_players) + 1)
            
            position_scores[position] = pos_players
            print(f"✅ {position}: {len(pos_players)} players ranked")
        
        self.position_rankings = position_scores
        
    def export_results(self):
        """Export refined rankings to JSON and console"""
        print("\n📤 Exporting refined rankings...")
        
        # Prepare export data
        export_data = {
            'metadata': {
                'season': self.season,
                'generated_at': datetime.now().isoformat(),
                'total_players_processed': len(self.player_stats),
                'total_players_retained': len(self.refined_players),
                'total_excluded': len(self.exclusion_log)
            },
            'rankings': {},
            'exclusions': self.exclusion_log
        }
        
        # Export top players by position
        for position in ['QB', 'RB', 'WR', 'TE']:
            if position in self.position_rankings:
                top_players = self.position_rankings[position].head(25)  # Top 25 per position
                
                export_data['rankings'][position] = []
                
                print(f"\n🏆 TOP 10 {position}s (Refined Rankings):")
                print("=" * 60)
                
                for _, player in top_players.head(10).iterrows():
                    player_data = {
                        'rank': int(player['rank']),
                        'player_name': player['player_name'],
                        'team': player['team'],
                        'ppg': float(player['ppg']),
                        'games_played': int(player['games_played']),
                        'total_fantasy_points': float(player['total_fantasy_points']),
                        'composite_score': float(player['normalized_score'])
                    }
                    
                    # Add position-specific stats
                    if position == 'QB':
                        player_data.update({
                            'passing_yards': int(player['passing_yards_sum']),
                            'passing_tds': int(player['passing_tds_sum']),
                            'interceptions': int(player['interceptions_sum'])
                        })
                    elif position == 'RB':
                        player_data.update({
                            'rushing_yards': int(player['rushing_yards_sum']),
                            'rushing_tds': int(player['rushing_tds_sum']),
                            'receptions': int(player['receptions_sum'])
                        })
                    else:  # WR/TE
                        player_data.update({
                            'targets': int(player['targets_sum']),
                            'receptions': int(player['receptions_sum']),
                            'receiving_yards': int(player['receiving_yards_sum']),
                            'receiving_tds': int(player['receiving_tds_sum'])
                        })
                    
                    export_data['rankings'][position].append(player_data)
                    
                    # Console output
                    print(f"{player['rank']:2d}. {player['player_name']:25s} {player['team']:3s} "
                          f"| {player['ppg']:5.1f} PPG | {player['games_played']:2d} GP | "
                          f"Score: {player['normalized_score']:5.1f}")
        
        # Save to JSON
        with open('/tmp/refined_rankings_2024.json', 'w') as f:
            json.dump(export_data, f, indent=2)
        
        # Print exclusion summary
        if self.exclusion_log:
            print(f"\n🚫 EXCLUSION LOG ({len(self.exclusion_log)} players):")
            print("=" * 80)
            for exclusion in self.exclusion_log[:20]:  # Show first 20
                print(f"❌ {exclusion['player_name']:25s} {exclusion['position']:2s} "
                      f"| {exclusion['ppg']:5.1f} PPG | {exclusion['games_played']:2d} GP")
                print(f"   Reason: {exclusion['reason']}")
        
        print(f"\n✅ Rankings exported to: /tmp/refined_rankings_2024.json")
        return export_data

def main():
    """Main execution function"""
    print("🚀 Starting NFL Refined Rankings System")
    print("=" * 60)
    
    rankings = NFLRefinedRankings()
    
    # Execute ranking pipeline
    if not rankings.load_nfl_data():
        print("❌ Failed to load NFL data")
        sys.exit(1)
    
    rankings.calculate_advanced_metrics()
    rankings.identify_artificially_inflated_players()
    rankings.calculate_composite_scores()
    results = rankings.export_results()
    
    print("\n🎯 Refined Rankings Complete!")
    print(f"📊 Players retained: {len(rankings.refined_players)}")
    print(f"🚫 Players excluded: {len(rankings.exclusion_log)}")
    print("✅ Rankings reflect true fantasy value based on consistent analytics")

if __name__ == "__main__":
    main()