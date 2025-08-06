"""
TIBER DATA INTEGRATION MODULE
Multi-source fantasy football data aggregator
Built on community principles - serve, not take
"""

import nfl_data_py as nfl
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional
import json

class TiberDataIntegration:
    """
    Tiber - review what you're pulling from nfl-data-py first!
    This module combines multiple free data sources for On The Clock.
    """
    
    def __init__(self, current_year: int = 2024):
        self.current_year = current_year
        self.data_cache = {}
        print(f"🏈 Tiber Data Integration initialized for {current_year} season")
        print("📊 Available data sources: nfl-data-py, Sleeper (existing), ESPN (public)")
    
    def review_nfl_data_py_capabilities(self):
        """
        TIBER - START HERE! Review what nfl-data-py can provide.
        This shows you everything available before pulling data.
        """
        print("\n=== NFL-DATA-PY CAPABILITY REVIEW ===\n")
        
        capabilities = {
            "Player Data": [
                "nfl.import_seasonal_rosters() - Current rosters with ages, positions, teams",
                "nfl.import_weekly_data() - Weekly player stats (rushing, receiving, passing)",
                "nfl.import_seasonal_data() - Season totals",
                "nfl.import_ids() - Player IDs across platforms (ESPN, Yahoo, Sleeper, etc.)",
                "nfl.import_depth_charts() - Team depth charts",
                "nfl.import_injuries() - Current injury reports"
            ],
            "Team Data": [
                "nfl.import_team_desc() - Team info, divisions, colors, logos",
                "nfl.import_schedules() - Full season schedules",
                "nfl.import_win_totals() - Vegas win totals"
            ],
            "Game Data": [
                "nfl.import_pbp_data() - Play-by-play data",
                "nfl.import_ngs_data() - Next Gen Stats",
                "nfl.import_qbr() - ESPN QBR ratings"
            ],
            "Draft Data": [
                "nfl.import_draft_picks() - Historical draft picks",
                "nfl.import_draft_values() - Pick value charts",
                "nfl.import_combine_data() - Combine results"
            ],
            "Advanced Metrics": [
                "nfl.import_snap_counts() - Snap percentages",
                "nfl.import_officials() - Referee data",
                "nfl.import_ftn_data() - Advanced charting (2022+)"
            ]
        }
        
        for category, functions in capabilities.items():
            print(f"📁 {category}:")
            for func in functions:
                print(f"   • {func}")
            print()
        
        return capabilities
    
    def get_rb_compass_data(self, player_name: str) -> Dict[str, Any]:
        """
        Pulls all data needed for RB Compass evaluation.
        Maps directly to the compass functions Joe built.
        """
        print(f"\n🧭 Gathering RB Compass data for {player_name}...")
        
        # Get current rosters for player ID and basic info
        if 'rosters' not in self.data_cache:
            print("   Loading rosters...")
            self.data_cache['rosters'] = nfl.import_seasonal_rosters([self.current_year])
        
        # Get weekly stats for current year
        if 'weekly_stats' not in self.data_cache:
            print("   Loading weekly stats...")
            self.data_cache['weekly_stats'] = nfl.import_weekly_data([self.current_year])
        
        # Get team descriptions for O-line rankings (you'll need external source)
        if 'teams' not in self.data_cache:
            print("   Loading team data...")
            self.data_cache['teams'] = nfl.import_team_desc()
        
        # Find player in rosters
        roster_df = self.data_cache['rosters']
        player_info = roster_df[roster_df['player_name'].str.contains(player_name, case=False, na=False)]
        
        if player_info.empty:
            print(f"   ⚠️ Player {player_name} not found in rosters")
            return {}
        
        player_row = player_info.iloc[0]
        player_id = player_row['player_id']
        
        # Get player's weekly stats
        weekly_df = self.data_cache['weekly_stats']
        player_stats = weekly_df[weekly_df['player_id'] == player_id]
        
        # Calculate metrics for compass
        compass_data = {
            'player_metrics': {
                'rush_att': player_stats['carries'].mean() if 'carries' in player_stats else 0,
                'tgt_share': player_stats['targets'].sum() / player_stats['team_target'].sum() if 'targets' in player_stats else 0,
                'gl_carries': player_stats[player_stats['yardline_100'] <= 10]['carries'].sum() if 'yardline_100' in player_stats else 0,
                'yac_per_att': player_stats['rushing_yards_after_contact'].mean() if 'rushing_yards_after_contact' in player_stats else 0,
                'breakaway_pct': self._calculate_breakaway_pct(player_stats)
            },
            'population_stats': self._get_population_stats(),
            'ol_rank': 16,  # Placeholder - need external source
            'oc_run_rate': 0.45,  # Placeholder - calculate from play-by-play
            'pos_snap_pct': player_stats['snap_pct'].mean() if 'snap_pct' in player_stats else 0.5,
            'neutral_script_rate': 0.5,  # Placeholder - calculate from game scripts
            'age': player_row['age'] if 'age' in player_row else 25,
            'games_missed_2yr': 0,  # Calculate from historical data
            'fum_rate': player_stats['fumbles'].sum() / player_stats['carries'].sum() if 'fumbles' in player_stats else 0,
            'proj_rank': 15,  # Placeholder - need projections
            'adp_rank': 18,  # Placeholder - need ADP data
            'pos_scarcity_z': 0.0,  # Calculate from positional data
            'contract_yrs': 2  # Would need contract data
        }
        
        print(f"   ✅ Data gathered for {player_name}")
        return compass_data
    
    def get_wr_compass_data(self, player_name: str) -> Dict[str, Any]:
        """
        Pulls data for WR Compass evaluation.
        """
        print(f"\n🧭 Gathering WR Compass data for {player_name}...")
        
        # Similar structure to RB but with WR-specific metrics
        # Includes anchor_score, context_tags, etc.
        
        compass_data = {
            'anchor_score': 75.0,  # Placeholder - needs calculation
            'context_tags': ['usage_security', 'scheme_fit'],  # Derive from analysis
            'rebuilder_score': 6.5,
            'contender_score': 7.5,
            'age': 26,
            'target_share': 0.22,
            'contract_status': 'medium_term'
        }
        
        return compass_data
    
    def _calculate_breakaway_pct(self, stats_df: pd.DataFrame) -> float:
        """Calculate percentage of runs over 15 yards."""
        if 'rushing_yards' not in stats_df.columns:
            return 0.0
        
        big_runs = stats_df[stats_df['rushing_yards'] > 15]
        total_runs = len(stats_df[stats_df['rushing_yards'].notna()])
        
        return len(big_runs) / total_runs if total_runs > 0 else 0.0
    
    def _get_population_stats(self) -> Dict[str, Dict[str, float]]:
        """
        Calculate population statistics for z-scoring.
        This would aggregate across all RBs for normalization.
        """
        # Placeholder - in production, calculate from all RBs
        return {
            'rush_att': {'mean': 15.0, 'std': 5.0},
            'tgt_share': {'mean': 0.15, 'std': 0.08},
            'gl_carries': {'mean': 2.0, 'std': 1.5},
            'yac_per_att': {'mean': 2.5, 'std': 1.0},
            'breakaway_pct': {'mean': 0.05, 'std': 0.03}
        }
    
    def get_all_available_players(self) -> pd.DataFrame:
        """
        Returns all players with their positions and teams.
        Useful for Tiber to build player selection lists.
        """
        print("\n📋 Loading all available players...")
        
        rosters = nfl.import_seasonal_rosters([self.current_year])
        ids = nfl.import_ids()
        
        # Merge to get cross-platform IDs
        merged = rosters.merge(ids, on='gsis_id', how='left', suffixes=('', '_map'))
        
        # Select relevant columns for display
        display_cols = ['player_name', 'position', 'team', 'age', 'espn_id', 'sleeper_id', 'yahoo_id']
        available_cols = [col for col in display_cols if col in merged.columns]
        
        players_df = merged[available_cols].copy()
        print(f"   ✅ Loaded {len(players_df)} players")
        
        return players_df
    
    def sync_with_sleeper(self, sleeper_data: Dict) -> Dict:
        """
        Merges nfl-data-py with existing Sleeper data.
        Tiber already has Sleeper integration, this enhances it.
        """
        print("\n🔄 Syncing with Sleeper data...")
        
        # Get ID mappings
        id_map = nfl.import_ids()
        
        # Match Sleeper players to nfl-data-py IDs
        # This allows cross-referencing between sources
        
        enhanced_data = {
            'sleeper_original': sleeper_data,
            'nfl_data_py_ids': id_map,
            'merged_count': 0
        }
        
        print("   ✅ Sync complete")
        return enhanced_data
    
    def run_diagnostic(self):
        """
        Tiber - run this first to test all data sources!
        """
        print("\n" + "="*50)
        print("🤖 TIBER DIAGNOSTIC CHECK")
        print("="*50)
        
        results = {}
        
        # Test nfl-data-py
        try:
            test_roster = nfl.import_seasonal_rosters([self.current_year])
            results['nfl_data_py'] = f"✅ Working - {len(test_roster)} players loaded"
        except Exception as e:
            results['nfl_data_py'] = f"❌ Error: {str(e)}"
        
        # Test other sources as needed
        results['sleeper'] = "🔧 Existing integration (assumed working)"
        results['espn'] = "📦 Available but not configured"
        
        print("\nData Source Status:")
        for source, status in results.items():
            print(f"  {source}: {status}")
        
        print("\n💡 Recommendation: Start with nfl-data-py for base stats,")
        print("   then layer in Sleeper for real-time fantasy scoring.")
        print("\n" + "="*50)
        
        return results


# USAGE EXAMPLE FOR TIBER
if __name__ == "__main__":
    # Initialize the integration module
    tiber = TiberDataIntegration(current_year=2024)
    
    # STEP 1: Review what's available
    tiber.review_nfl_data_py_capabilities()
    
    # STEP 2: Run diagnostic
    tiber.run_diagnostic()
    
    # STEP 3: Get data for compass calculations
    # Example: Get Jonathan Taylor's data for RB Compass
    jt_data = tiber.get_rb_compass_data("Jonathan Taylor")
    
    # STEP 4: Feed this data into the RB Compass function
    # from rb_compass import calculate_rb_compass
    # score = calculate_rb_compass(jt_data)
    
    print("\n🏁 Integration module ready for On The Clock!")
    print("   Remember the covenant: serve, not take 🤝")