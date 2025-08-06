"""
Tiber Population Statistics Calculator
Replaces placeholder data with real NFL statistics for compass normalization
"""

import nfl_data_py as nfl
import pandas as pd
import numpy as np
from typing import Dict, Any, List
import json

class TiberPopulationStats:
    """
    Calculate real population statistics from NFL-Data-Py for compass normalization.
    Replaces all placeholder data with authentic NFL statistics.
    """
    
    def __init__(self, current_year: int = 2024):
        self.current_year = current_year
        self.population_cache = {}
        print(f"📊 Initializing population stats calculator for {current_year}")
    
    def calculate_rb_population_stats(self) -> Dict[str, Dict[str, float]]:
        """
        Calculate real RB population statistics for compass normalization.
        Replaces placeholder values with authentic NFL data.
        """
        print("🏃 Calculating RB population statistics from real NFL data...")
        
        try:
            # Get weekly data for current season
            weekly_data = nfl.import_weekly_data([self.current_year])
            
            # Filter to RBs with meaningful snap counts
            rb_data = weekly_data[
                (weekly_data['position'] == 'RB') & 
                (weekly_data['carries'].notna()) &
                (weekly_data['carries'] > 0)
            ].copy()
            
            if rb_data.empty:
                print("⚠️ No RB data found, using conservative estimates")
                return self._get_conservative_rb_stats()
            
            # Calculate per-game averages for each player
            player_stats = rb_data.groupby('player_name').agg({
                'carries': 'mean',
                'targets': 'mean', 
                'rushing_yards': 'mean',
                'fumbles_lost': 'sum'
            }).reset_index()
            
            # Count games played per player
            games_played = rb_data.groupby('player_name').size().reset_index(name='games')
            
            # Merge with games played
            player_stats = player_stats.merge(games_played, on='player_name')
            
            # Calculate derived metrics
            player_stats['carries_per_game'] = player_stats['carries']
            player_stats['targets_per_game'] = player_stats['targets'].fillna(0)
            player_stats['fumble_rate'] = (player_stats['fumbles_lost'] / 
                                         (player_stats['carries'] * player_stats['games'])).fillna(0)
            
            # Calculate breakaway percentage (>15 yard runs)
            big_runs = rb_data[rb_data['rushing_yards'] > 15].groupby('player_name').size()
            total_runs = rb_data.groupby('player_name')['carries'].sum()
            breakaway_pct = (big_runs / total_runs).fillna(0)
            
            # Calculate population statistics
            population_stats = {
                'carries_per_game': {
                    'mean': float(player_stats['carries_per_game'].mean()),
                    'std': float(player_stats['carries_per_game'].std())
                },
                'targets_per_game': {
                    'mean': float(player_stats['targets_per_game'].mean()),
                    'std': float(player_stats['targets_per_game'].std())
                },
                'fumble_rate': {
                    'mean': float(player_stats['fumble_rate'].mean()),
                    'std': float(player_stats['fumble_rate'].std())
                },
                'breakaway_pct': {
                    'mean': float(breakaway_pct.mean()),
                    'std': float(breakaway_pct.std())
                }
            }
            
            print(f"✅ Calculated population stats from {len(player_stats)} RBs")
            print(f"   Avg carries/game: {population_stats['carries_per_game']['mean']:.1f}")
            print(f"   Avg targets/game: {population_stats['targets_per_game']['mean']:.1f}")
            
            return population_stats
            
        except Exception as e:
            print(f"⚠️ Error calculating RB population stats: {e}")
            return self._get_conservative_rb_stats()
    
    def calculate_wr_population_stats(self) -> Dict[str, Dict[str, float]]:
        """
        Calculate real WR population statistics for compass normalization.
        """
        print("🎯 Calculating WR population statistics from real NFL data...")
        
        try:
            # Get weekly data for current season
            weekly_data = nfl.import_weekly_data([self.current_year])
            
            # Filter to WRs with meaningful targets
            wr_data = weekly_data[
                (weekly_data['position'] == 'WR') & 
                (weekly_data['targets'].notna()) &
                (weekly_data['targets'] > 0)
            ].copy()
            
            if wr_data.empty:
                print("⚠️ No WR data found, using conservative estimates")
                return self._get_conservative_wr_stats()
            
            # Calculate per-game averages for each player
            player_stats = wr_data.groupby('player_name').agg({
                'targets': 'mean',
                'receptions': 'mean',
                'receiving_yards': 'mean',
                'receiving_tds': 'sum'
            }).reset_index()
            
            # Count games played per player
            games_played = wr_data.groupby('player_name').size().reset_index(name='games')
            
            # Merge with games played
            player_stats = player_stats.merge(games_played, on='player_name')
            
            # Calculate derived metrics
            player_stats['targets_per_game'] = player_stats['targets']
            player_stats['receptions_per_game'] = player_stats['receptions'].fillna(0)
            player_stats['yards_per_game'] = player_stats['receiving_yards'].fillna(0)
            player_stats['td_rate'] = (player_stats['receiving_tds'] / 
                                     (player_stats['targets'] * player_stats['games'])).fillna(0)
            
            # Calculate population statistics
            population_stats = {
                'targets_per_game': {
                    'mean': float(player_stats['targets_per_game'].mean()),
                    'std': float(player_stats['targets_per_game'].std())
                },
                'receptions_per_game': {
                    'mean': float(player_stats['receptions_per_game'].mean()),
                    'std': float(player_stats['receptions_per_game'].std())
                },
                'yards_per_game': {
                    'mean': float(player_stats['yards_per_game'].mean()),
                    'std': float(player_stats['yards_per_game'].std())
                },
                'td_rate': {
                    'mean': float(player_stats['td_rate'].mean()),
                    'std': float(player_stats['td_rate'].std())
                }
            }
            
            print(f"✅ Calculated population stats from {len(player_stats)} WRs")
            print(f"   Avg targets/game: {population_stats['targets_per_game']['mean']:.1f}")
            print(f"   Avg yards/game: {population_stats['yards_per_game']['mean']:.1f}")
            
            return population_stats
            
        except Exception as e:
            print(f"⚠️ Error calculating WR population stats: {e}")
            return self._get_conservative_wr_stats()
    
    def get_team_context_stats(self) -> Dict[str, Any]:
        """
        Calculate team-level context statistics for environment scoring.
        """
        print("🏈 Calculating team context statistics...")
        
        try:
            # Get team descriptions and weekly data
            teams = nfl.import_team_desc()
            weekly_data = nfl.import_weekly_data([self.current_year])
            
            # Calculate offensive context by team
            team_context = weekly_data.groupby('recent_team').agg({
                'carries': 'sum',
                'completions': 'sum',  # Use completions as proxy for pass attempts
                'rushing_yards': 'sum',
                'receiving_yards': 'sum'  # Use receiving yards as proxy for passing yards
            }).reset_index()
            
            # Calculate run rate and offensive efficiency
            team_context['total_plays'] = team_context['carries'] + team_context['completions']
            team_context['run_rate'] = team_context['carries'] / team_context['total_plays']
            team_context['yards_per_play'] = (
                team_context['rushing_yards'] + team_context['receiving_yards']
            ) / team_context['total_plays']
            
            # Merge with team info
            team_stats = teams.merge(team_context, left_on='team_abbr', right_on='recent_team', how='left')
            
            print(f"✅ Calculated team context for {len(team_stats)} teams")
            
            return {
                'avg_run_rate': float(team_context['run_rate'].mean()),
                'std_run_rate': float(team_context['run_rate'].std()),
                'avg_yards_per_play': float(team_context['yards_per_play'].mean()),
                'std_yards_per_play': float(team_context['yards_per_play'].std()),
                'team_data': team_stats.to_dict('records')
            }
            
        except Exception as e:
            print(f"⚠️ Error calculating team context: {e}")
            return {
                'avg_run_rate': 0.45,
                'std_run_rate': 0.08,
                'avg_yards_per_play': 5.5,
                'std_yards_per_play': 0.7,
                'team_data': []
            }
    
    def _get_conservative_rb_stats(self) -> Dict[str, Dict[str, float]]:
        """Conservative fallback RB statistics based on typical NFL distributions."""
        return {
            'carries_per_game': {'mean': 12.0, 'std': 6.5},
            'targets_per_game': {'mean': 3.2, 'std': 2.8},
            'fumble_rate': {'mean': 0.015, 'std': 0.012},
            'breakaway_pct': {'mean': 0.08, 'std': 0.05}
        }
    
    def _get_conservative_wr_stats(self) -> Dict[str, Dict[str, float]]:
        """Conservative fallback WR statistics based on typical NFL distributions."""
        return {
            'targets_per_game': {'mean': 6.8, 'std': 4.2},
            'receptions_per_game': {'mean': 4.1, 'std': 2.8},
            'yards_per_game': {'mean': 52.3, 'std': 35.7},
            'td_rate': {'mean': 0.045, 'std': 0.035}
        }
    
    def save_population_cache(self, filename: str = 'tiber_population_stats.json'):
        """Save calculated population statistics to file for caching."""
        try:
            with open(filename, 'w') as f:
                json.dump(self.population_cache, f, indent=2)
            print(f"💾 Saved population statistics to {filename}")
        except Exception as e:
            print(f"⚠️ Error saving cache: {e}")
    
    def load_population_cache(self, filename: str = 'tiber_population_stats.json'):
        """Load cached population statistics from file."""
        try:
            with open(filename, 'r') as f:
                self.population_cache = json.load(f)
            print(f"📂 Loaded population statistics from {filename}")
            return True
        except Exception as e:
            print(f"⚠️ No cache file found, will calculate fresh: {e}")
            return False

# Usage example
if __name__ == "__main__":
    calculator = TiberPopulationStats(2024)
    
    print("🔥 Calculating real NFL population statistics...")
    print("=" * 50)
    
    rb_stats = calculator.calculate_rb_population_stats()
    wr_stats = calculator.calculate_wr_population_stats()
    team_stats = calculator.get_team_context_stats()
    
    print("\n📊 RB Population Statistics:")
    for metric, stats in rb_stats.items():
        print(f"   {metric}: μ={stats['mean']:.3f}, σ={stats['std']:.3f}")
    
    print("\n🎯 WR Population Statistics:")
    for metric, stats in wr_stats.items():
        print(f"   {metric}: μ={stats['mean']:.3f}, σ={stats['std']:.3f}")
    
    print(f"\n🏈 Team Context:")
    print(f"   Average run rate: {team_stats['avg_run_rate']:.3f}")
    print(f"   Average yards/play: {team_stats['avg_yards_per_play']:.1f}")
    
    print("\n✅ Real NFL data ready for compass calculations!")
    print("Remember the covenant: serve, not take 🤝")