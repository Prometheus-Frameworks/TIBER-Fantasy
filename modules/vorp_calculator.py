"""
VORP Calculator - Dynasty-Aware Value Over Replacement Player Engine
On The Clock Fantasy Football Analytics Platform

Calculates VORP with position-specific baselines and age-based penalties
for accurate dynasty player valuations.
"""

from typing import Dict, Tuple, Optional, Union


# Position-specific replacement baselines (16-week season)
POSITION_BASELINES = {
    'QB': 240.0,  # 15.0 PPG × 16 weeks
    'RB': 168.0,  # 10.5 PPG × 16 weeks
    'WR': 160.0,  # 10.0 PPG × 16 weeks
    'TE': 136.0   #  8.5 PPG × 16 weeks
}

# Age penalty thresholds and rates
AGE_PENALTY_CONFIG = {
    'QB': {'threshold': 30, 'rate': 0.5},   # -0.5 per year after 30
    'RB': {'threshold': 28, 'rate': 1.0},   # -1.0 per year after 28
    'WR': {'threshold': 28, 'rate': 1.0},   # -1.0 per year after 28
    'TE': {'threshold': None, 'rate': 0.0}  # No age penalties for TE
}


def get_replacement_baseline(position: str) -> float:
    """
    Get the replacement-level baseline for a given position.
    
    Args:
        position: Player position ('QB', 'RB', 'WR', 'TE')
        
    Returns:
        Replacement baseline fantasy points for the position
    """
    return POSITION_BASELINES.get(position.upper(), 0.0)


def calculate_age_penalty(position: str, age: int) -> float:
    """
    Calculate age-based dynasty penalty for a player.
    
    Args:
        position: Player position ('QB', 'RB', 'WR', 'TE')
        age: Player age in years
        
    Returns:
        Age penalty in VORP points (negative value)
    """
    config = AGE_PENALTY_CONFIG.get(position.upper(), {'threshold': None, 'rate': 0.0})
    
    if config['threshold'] is None or age <= config['threshold']:
        return 0.0
    
    years_over = age - config['threshold']
    return years_over * config['rate']


def calculate_vorp(player_points: float, baseline_points: float) -> float:
    """
    Calculate Value Over Replacement Player (VORP) - simplified version.
    
    Args:
        player_points: Player's projected fantasy points
        baseline_points: Replacement baseline for comparison
        
    Returns:
        VORP score rounded to 2 decimal places
    """
    return round(player_points - baseline_points, 2)


def calculate_vorp_with_age(projected_points: float, position: str, age: int) -> float:
    """
    Calculate VORP with dynasty age adjustments.
    
    Formula: VORP = Projected Points - Replacement Baseline - Age Penalty
    
    Args:
        projected_points: Player's projected fantasy points
        position: Player position ('QB', 'RB', 'WR', 'TE')
        age: Player age for dynasty penalty calculation
        
    Returns:
        VORP score (can be negative for below-replacement players)
    """
    baseline = get_replacement_baseline(position)
    age_penalty = calculate_age_penalty(position, age)
    
    return projected_points - baseline - age_penalty


def batch_assign_vorp(player_list: list, baseline_dict: dict) -> list:
    """
    Batch assign VORP scores to a list of players.
    
    Args:
        player_list: List of player dictionaries with 'position' and 'projected_points'
        baseline_dict: Dictionary mapping positions to baseline values
        
    Returns:
        Updated player list with 'vorp' field added to each player
    """
    for player in player_list:
        position = player.get("position")
        baseline = baseline_dict.get(position, 0)
        player["vorp"] = calculate_vorp(player.get("projected_points", 0), baseline)
    return player_list


def calculate_player_vorp(player_data: Dict) -> Dict:
    """
    Calculate comprehensive VORP analysis for a player.
    
    Args:
        player_data: Dictionary with 'projected_points', 'position', 'age' keys
        
    Returns:
        Dictionary with VORP breakdown and analysis
    """
    projected_points = player_data.get('projected_points', 0.0)
    position = player_data.get('position', 'WR')
    age = player_data.get('age', 25)
    
    baseline = get_replacement_baseline(position)
    age_penalty = calculate_age_penalty(position, age)
    vorp = calculate_vorp_with_age(projected_points, position, age)
    
    return {
        'vorp': round(vorp, 1),
        'projected_points': projected_points,
        'replacement_baseline': baseline,
        'age_penalty': age_penalty,
        'raw_vorp': projected_points - baseline,
        'position': position.upper(),
        'age': age,
        'tier': get_vorp_tier(vorp)
    }


def get_vorp_tier(vorp: float) -> str:
    """
    Classify player into VORP-based tiers.
    
    Args:
        vorp: Player's VORP score
        
    Returns:
        Tier classification string
    """
    if vorp >= 80:
        return 'Elite'
    elif vorp >= 60:
        return 'Premium'
    elif vorp >= 40:
        return 'Solid'
    elif vorp >= 20:
        return 'Depth'
    elif vorp >= 0:
        return 'Replacement'
    else:
        return 'Below Replacement'


class VORPCalculator:
    """
    Dynasty-aware VORP calculation engine for fantasy football player analysis.
    """
    
    def __init__(self):
        self.baselines = POSITION_BASELINES.copy()
        self.age_config = AGE_PENALTY_CONFIG.copy()
    
    def set_custom_baseline(self, position: str, baseline: float) -> None:
        """Set custom replacement baseline for a position."""
        self.baselines[position.upper()] = baseline
    
    def calculate(self, projected_points: float, position: str, age: Optional[int] = None) -> float:
        """Calculate VORP score for a player using instance baselines."""
        baseline = self.baselines.get(position.upper(), 0.0)
        if age is not None:
            age_penalty = calculate_age_penalty(position, age)
            return projected_points - baseline - age_penalty
        else:
            return calculate_vorp(projected_points, baseline)
    
    def batch_process(self, player_list: list) -> list:
        """
        Batch process VORP scores for multiple players using instance baselines.
        
        Args:
            player_list: List of player dictionaries
            
        Returns:
            Updated player list with VORP scores
        """
        return batch_assign_vorp(player_list, self.baselines)
    
    def analyze_player(self, player_data: Dict) -> Dict:
        """Get comprehensive VORP analysis for a player."""
        return calculate_player_vorp(player_data)
    
    def compare_players(self, players: list) -> list:
        """
        Compare multiple players by VORP score.
        
        Args:
            players: List of player dictionaries
            
        Returns:
            List of players sorted by VORP (descending)
        """
        analyzed_players = []
        
        for player in players:
            analysis = self.analyze_player(player)
            analysis['name'] = player.get('name', 'Unknown')
            analyzed_players.append(analysis)
        
        return sorted(analyzed_players, key=lambda x: x['vorp'], reverse=True)
    
    def get_position_rankings(self, players: list, position: str) -> list:
        """
        Get VORP rankings for a specific position.
        
        Args:
            players: List of player dictionaries
            position: Position to filter ('QB', 'RB', 'WR', 'TE')
            
        Returns:
            List of players at the position sorted by VORP
        """
        position_players = [p for p in players if p.get('position', '').upper() == position.upper()]
        return self.compare_players(position_players)