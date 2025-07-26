"""
VORP Calculator - Value Over Replacement Player
Advanced VORP calculations with dynasty mode and format-aware scaling
"""

from typing import List, Dict, Any, Optional
import math

class VORPCalculator:
    def __init__(self):
        self.position_baselines = {
            'redraft': {
                'QB': 12,  # QB12 baseline for 12-team league
                'RB': 24,  # RB24
                'WR': 36,  # WR36  
                'TE': 12   # TE12
            },
            'dynasty': {
                'QB': 15,  # Deeper dynasty benches
                'RB': 30,
                'WR': 45,
                'TE': 15
            }
        }
        
        self.scarcity_weights = {
            'QB': 1.1,
            'RB': 1.3,  # Most scarce position
            'WR': 1.2,
            'TE': 1.1
        }
        
        self.age_penalties = {
            'dynasty': {
                'RB': {'threshold': 25, 'penalty_per_year': 0.01},
                'WR': {'threshold': 28, 'penalty_per_year': 0.01}, 
                'QB': {'threshold': 30, 'penalty_per_year': 0.005},
                'TE': {'threshold': 30, 'penalty_per_year': 0.005}
            }
        }
    
    def calculate_vorp(self, players: List[Dict[str, Any]], 
                      mode: str = 'redraft', num_teams: int = 12) -> List[Dict[str, Any]]:
        """
        Calculate VORP for all players
        
        Args:
            players: List of player dictionaries
            mode: 'redraft' or 'dynasty'
            num_teams: League size for baseline calculation
            
        Returns:
            Players with VORP scores added
        """
        # Group players by position
        position_groups = {}
        for player in players:
            pos = player['position'].split(',')[0].strip()
            if pos not in position_groups:
                position_groups[pos] = []
            position_groups[pos].append(player)
        
        # Calculate baselines for each position
        baselines = self._calculate_baselines(position_groups, mode, num_teams)
        
        # Calculate VORP for each player
        for player in players:
            pos = player['position'].split(',')[0].strip()
            baseline = baselines.get(pos, 0)
            
            # Base VORP calculation
            fantasy_points = player.get('fantasy_points', 0)
            base_vorp = max(0, fantasy_points - baseline)
            
            # Apply scarcity weighting
            scarcity_weight = self.scarcity_weights.get(pos, 1.0)
            weighted_vorp = base_vorp * scarcity_weight
            
            # Apply dynasty age penalties if applicable
            if mode == 'dynasty':
                age_multiplier = self._calculate_age_multiplier(player, pos)
                weighted_vorp *= age_multiplier
                player['age_penalty'] = 1.0 - age_multiplier
            
            # Cap VORP at reasonable maximum
            final_vorp = min(weighted_vorp, 100)
            
            player['vorp'] = round(final_vorp, 1)
            player['baseline'] = baseline
            player['scarcity_weight'] = scarcity_weight
            
        return players
    
    def _calculate_baselines(self, position_groups: Dict[str, List], 
                           mode: str, num_teams: int) -> Dict[str, float]:
        """Calculate replacement level baselines for each position"""
        baselines = {}
        base_positions = self.position_baselines[mode]
        
        for pos, players in position_groups.items():
            if not players:
                baselines[pos] = 0
                continue
                
            # Sort players by fantasy points
            sorted_players = sorted(players, 
                                  key=lambda x: x.get('fantasy_points', 0), 
                                  reverse=True)
            
            # Find replacement level (scale to league size)
            baseline_rank = base_positions.get(pos, 12)
            scaled_baseline_rank = int(baseline_rank * (num_teams / 12))
            
            if len(sorted_players) > scaled_baseline_rank:
                baseline_player = sorted_players[scaled_baseline_rank - 1]
                baselines[pos] = baseline_player.get('fantasy_points', 0)
            else:
                # If not enough players, use minimum viable starter
                min_points = min(p.get('fantasy_points', 0) for p in sorted_players)
                baselines[pos] = max(min_points * 0.8, 5)  # 80% of worst starter
                
        return baselines
    
    def _calculate_age_multiplier(self, player: Dict[str, Any], position: str) -> float:
        """Calculate age-based multiplier for dynasty mode"""
        if position not in self.age_penalties['dynasty']:
            return 1.0
            
        age = player.get('age')
        if not age:
            return 1.0  # No penalty if age unknown
            
        age_config = self.age_penalties['dynasty'][position]
        threshold = age_config['threshold']
        penalty_per_year = age_config['penalty_per_year']
        
        if age <= threshold:
            return 1.0
            
        years_over = age - threshold
        penalty = years_over * penalty_per_year
        
        # Cap penalty at 20% maximum
        penalty = min(penalty, 0.2)
        
        return 1.0 - penalty
    
    def get_tier_breakpoints(self, vorp_scores: List[float]) -> Dict[int, float]:
        """Calculate tier breakpoints based on VORP distribution"""
        if not vorp_scores:
            return {}
            
        sorted_scores = sorted(vorp_scores, reverse=True)
        
        # Define tier breakpoints as percentiles
        tier_percentiles = {
            1: 0.1,   # Top 10% = Elite
            2: 0.25,  # Top 25% = Premium  
            3: 0.5,   # Top 50% = Strong
            4: 0.75,  # Top 75% = Solid
            5: 1.0    # Rest = Depth
        }
        
        breakpoints = {}
        for tier, percentile in tier_percentiles.items():
            index = int(len(sorted_scores) * percentile) - 1
            index = max(0, min(index, len(sorted_scores) - 1))
            breakpoints[tier] = sorted_scores[index]
            
        return breakpoints