"""
VORP Engine - Batch VORP Assignment for Fantasy Football Rankings
On The Clock Fantasy Football Analytics Platform

Provides batch processing capabilities for VORP calculations across player lists.
"""

from typing import List, Dict
from .vorp_calculator import calculate_vorp, VORPCalculator


def batch_assign_vorp(player_list: List[Dict], positional_baselines: Dict[str, float]) -> List[Dict]:
    """
    Assign VORP scores to a list of players using batch processing.
    
    Args:
        player_list: List of player dictionaries with 'projected_points' and 'position'
        positional_baselines: Dictionary mapping positions to baseline point values
        
    Returns:
        List of players with 'vorp' field added
    """
    processed_players = []
    
    for player in player_list:
        player_copy = player.copy()
        
        # Extract required fields
        projected_points = player_copy.get('projected_points', 0)
        position = player_copy.get('position', 'WR').upper()
        
        # Get baseline for position
        baseline = positional_baselines.get(position, 160)  # Default to WR baseline
        
        # Calculate VORP using simplified method
        vorp = projected_points - baseline
        player_copy['vorp'] = round(vorp, 1)
        
        processed_players.append(player_copy)
    
    return processed_players


def batch_assign_vorp_with_age(player_list: List[Dict], positional_baselines: Dict[str, float]) -> List[Dict]:
    """
    Assign VORP scores with dynasty age adjustments for batch processing.
    
    Args:
        player_list: List of player dictionaries with 'projected_points', 'position', and 'age'
        positional_baselines: Dictionary mapping positions to baseline point values
        
    Returns:
        List of players with dynasty-adjusted 'vorp' field added
    """
    vorp_calculator = VORPCalculator()
    processed_players = []
    
    for player in player_list:
        player_copy = player.copy()
        
        # Extract required fields
        projected_points = player_copy.get('projected_points', 0)
        position = player_copy.get('position', 'WR')
        age = player_copy.get('age', 25)  # Default to prime age
        
        # Calculate dynasty VORP with age penalties
        vorp = vorp_calculator.calculate(projected_points, position, age)
        player_copy['vorp'] = round(vorp, 1)
        
        processed_players.append(player_copy)
    
    return processed_players


def load_sample_players() -> List[Dict]:
    """
    Load sample player data for testing and demonstration.
    In production, this would connect to your data source.
    
    Returns:
        List of sample players with fantasy football data
    """
    return [
        {'name': 'Josh Allen', 'position': 'QB', 'team': 'BUF', 'projected_points': 285.5, 'age': 28},
        {'name': 'Christian McCaffrey', 'position': 'RB', 'team': 'SF', 'projected_points': 245.2, 'age': 28},
        {'name': 'Justin Jefferson', 'position': 'WR', 'team': 'MIN', 'projected_points': 220.8, 'age': 25},
        {'name': 'Travis Kelce', 'position': 'TE', 'team': 'KC', 'projected_points': 185.3, 'age': 35},
        {'name': 'Lamar Jackson', 'position': 'QB', 'team': 'BAL', 'projected_points': 275.0, 'age': 27},
        {'name': 'Tyreek Hill', 'position': 'WR', 'team': 'MIA', 'projected_points': 210.5, 'age': 30},
        {'name': 'Derrick Henry', 'position': 'RB', 'team': 'BAL', 'projected_points': 195.0, 'age': 31},
        {'name': 'Davante Adams', 'position': 'WR', 'team': 'LV', 'projected_points': 200.0, 'age': 32},
        {'name': 'Dak Prescott', 'position': 'QB', 'team': 'DAL', 'projected_points': 265.0, 'age': 31},
        {'name': 'Saquon Barkley', 'position': 'RB', 'team': 'PHI', 'projected_points': 235.0, 'age': 27},
        {'name': 'CeeDee Lamb', 'position': 'WR', 'team': 'DAL', 'projected_points': 215.0, 'age': 25},
        {'name': 'Mark Andrews', 'position': 'TE', 'team': 'BAL', 'projected_points': 175.0, 'age': 29}
    ]


def get_positional_baselines(format_type: str = 'standard') -> Dict[str, float]:
    """
    Get positional baselines adjusted for league format.
    
    Args:
        format_type: 'standard', 'ppr', or 'superflex'
        
    Returns:
        Dictionary of position baselines
    """
    base_baselines = {
        "QB": 220.0,
        "RB": 160.0, 
        "WR": 170.0,
        "TE": 130.0
    }
    
    if format_type == 'ppr':
        # PPR boosts skill positions
        return {
            "QB": 220.0,
            "RB": 175.0,
            "WR": 185.0,
            "TE": 145.0
        }
    elif format_type == 'superflex':
        # Superflex dramatically increases QB value
        return {
            "QB": 180.0,  # Lower baseline = higher VORP
            "RB": 160.0,
            "WR": 170.0,
            "TE": 130.0
        }
    
    return base_baselines


def filter_players_by_position(player_list: List[Dict], position: str) -> List[Dict]:
    """
    Filter player list by position.
    
    Args:
        player_list: List of players to filter
        position: Position to filter by ('QB', 'RB', 'WR', 'TE', or 'all')
        
    Returns:
        Filtered list of players
    """
    if position.lower() == 'all':
        return player_list
    
    return [p for p in player_list if p.get('position', '').upper() == position.upper()]