"""
VORP (Value Over Replacement Player)

Definition:
Value Over Replacement Player estimates how much more fantasy value a player provides compared to a baseline replacement-level player at their position.

Baseline Defaults (PPR, redraft/dynasty hybrid):
- QB: QB24 (approx. 15.0 PPG)
- RB: RB36 (approx. 10.5 PPG)
- WR: WR48 (approx. 10.0 PPG)
- TE: TE12 (approx. 8.5 PPG)

Formula:
VORP = Projected Points - Replacement Baseline
* Dynasty Adjustments:
    - Age penalty (older players lose 0.5–1.0 pts/year after age 28–30)
    - Position scarcity weighting is inherent in the baseline
"""

from typing import List, Dict, Any, Optional
import math

def get_replacement_baseline(position: str) -> float:
    baselines = {
        "QB": 240.0,
        "RB": 168.0,
        "WR": 160.0,
        "TE": 136.0
    }
    return baselines.get(position.upper(), 0.0)

def calculate_vorp(projected_points: float, position: str, age: int) -> float:
    baseline = get_replacement_baseline(position)
    vorp = projected_points - baseline

    # Dynasty Age Penalty
    if position.upper() in ["RB", "WR"] and age >= 29:
        vorp -= (age - 28) * 1.0
    elif position.upper() == "QB" and age >= 31:
        vorp -= (age - 30) * 0.5

    return round(vorp, 2)

class VORPCalculator:
    def __init__(self):
        # Use the new baseline system
        pass
    
    def calculate_vorp(self, players: List[Dict[str, Any]], 
                      mode: str = 'redraft', num_teams: int = 12) -> List[Dict[str, Any]]:
        """
        Calculate VORP for all players using new baseline system
        
        Args:
            players: List of player dictionaries
            mode: 'redraft' or 'dynasty'
            num_teams: League size for baseline calculation
            
        Returns:
            Players with VORP scores added
        """
        for player in players:
            pos = player['position'].split(',')[0].strip()
            projected_points = player.get('fantasy_points', 0) * 17  # Convert to season total
            age = player.get('age', 25)  # Default age if not provided
            
            # Calculate VORP using new formula
            vorp_score = calculate_vorp(projected_points, pos, age)
            
            player['vorp'] = vorp_score
            player['baseline'] = get_replacement_baseline(pos)
            player['projected_season_points'] = projected_points
            
        return players
    
    def get_vorp_tier_breakpoints(self, vorp_scores: List[float]) -> Dict[int, float]:
        """Calculate tier breakpoints based on VORP distribution"""
        if not vorp_scores:
            return {}
            
        sorted_scores = sorted(vorp_scores, reverse=True)
        
        # Define tier breakpoints based on VORP ranges
        tier_breakpoints = {
            1: 80.0,   # Elite (80+ VORP)
            2: 50.0,   # Premium (50-79 VORP)
            3: 20.0,   # Strong (20-49 VORP)
            4: 0.0,    # Solid (0-19 VORP)
            5: -20.0   # Depth (negative VORP)
        }
        
        return tier_breakpoints
    
    def calculate_player_vorp(self, projected_points: float, position: str, age: int = 25) -> Dict[str, Any]:
        """
        Calculate individual player VORP with detailed breakdown
        
        Args:
            projected_points: Season projected fantasy points
            position: Player position (QB, RB, WR, TE)
            age: Player age for dynasty adjustments
            
        Returns:
            Dictionary with VORP calculation details
        """
        baseline = get_replacement_baseline(position)
        raw_vorp = projected_points - baseline
        
        # Apply age penalty for dynasty evaluation
        age_penalty = 0.0
        if position.upper() in ["RB", "WR"] and age >= 29:
            age_penalty = (age - 28) * 1.0
        elif position.upper() == "QB" and age >= 31:
            age_penalty = (age - 30) * 0.5
            
        final_vorp = raw_vorp - age_penalty
        
        return {
            'vorp': round(final_vorp, 2),
            'baseline': baseline,
            'raw_vorp': round(raw_vorp, 2),
            'age_penalty': round(age_penalty, 2),
            'projected_points': projected_points,
            'position': position.upper(),
            'age': age
        }