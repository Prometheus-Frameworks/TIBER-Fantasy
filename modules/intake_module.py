"""
Intake Module - Player Data Sourcing for On The Clock
Fantasy Football Analytics Platform

Provides centralized player data loading with format-aware processing.
"""

from typing import List, Dict
from modules.rookie_database import get_all_rookies_for_vorp


def get_all_players(format_type: str = 'dynasty') -> List[Dict]:
    """
    Load all players for rankings with format-specific adjustments.
    
    Args:
        format_type: Format type ('dynasty', 'redraft', 'ppr', 'superflex')
        
    Returns:
        List of player dictionaries with required fields
    """
    # Load 2025 rookie class for dynasty format
    rookies = []
    if format_type == 'dynasty':
        try:
            rookies = get_all_rookies_for_vorp(format_type)
            print(f"✅ Loaded {len(rookies)} rookies from 2025 draft class")
        except Exception as e:
            print(f"⚠️ Failed to load rookies: {e}")
    
    # Base established player dataset
    base_players = [
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
        {'name': 'Mark Andrews', 'position': 'TE', 'team': 'BAL', 'projected_points': 175.0, 'age': 29},
        {'name': 'Patrick Mahomes', 'position': 'QB', 'team': 'KC', 'projected_points': 270.0, 'age': 29},
        {'name': 'Ja\'Marr Chase', 'position': 'WR', 'team': 'CIN', 'projected_points': 225.0, 'age': 24},
        {'name': 'Bijan Robinson', 'position': 'RB', 'team': 'ATL', 'projected_points': 210.0, 'age': 22},
        {'name': 'Puka Nacua', 'position': 'WR', 'team': 'LAR', 'projected_points': 195.0, 'age': 23},
        {'name': 'Tee Higgins', 'position': 'WR', 'team': 'CIN', 'projected_points': 190.0, 'age': 25},
        {'name': 'Tony Pollard', 'position': 'RB', 'team': 'TEN', 'projected_points': 180.0, 'age': 27},
        {'name': 'George Kittle', 'position': 'TE', 'team': 'SF', 'projected_points': 170.0, 'age': 31},
        {'name': 'Jayden Daniels', 'position': 'QB', 'team': 'WAS', 'projected_points': 255.0, 'age': 24}
    ]
    
    # Combine established players with rookies for dynasty
    all_players = base_players + rookies
    
    # Apply format-specific adjustments
    if format_type == 'dynasty':
        # Dynasty format - no immediate adjustments, age will factor into VORP
        return all_players
    
    elif format_type == 'ppr':
        # PPR format - boost pass-catching players
        for player in base_players:
            if player['position'] in ['WR', 'TE']:
                player['projected_points'] *= 1.15  # 15% boost for pass catchers
            elif player['position'] == 'RB':
                player['projected_points'] *= 1.08  # 8% boost for pass-catching RBs
        return base_players
    
    elif format_type == 'superflex':
        # Superflex format - boost QB projections
        for player in base_players:
            if player['position'] == 'QB':
                player['projected_points'] *= 1.2  # 20% boost for QBs in superflex
        return base_players
    
    elif format_type == 'redraft':
        # Redraft format - slight penalty for older players
        for player in base_players:
            if player['age'] > 30:
                player['projected_points'] *= 0.95  # 5% penalty for aging players
        return base_players
    
    # Default return
    return base_players


def get_players_by_position(position: str, format_type: str = 'dynasty') -> List[Dict]:
    """
    Get players filtered by position.
    
    Args:
        position: Position to filter by ('QB', 'RB', 'WR', 'TE')
        format_type: Format type for adjustments
        
    Returns:
        Filtered list of players
    """
    all_players = get_all_players(format_type)
    return [p for p in all_players if p['position'].upper() == position.upper()]


def get_player_count() -> Dict[str, int]:
    """
    Get count of players by position.
    
    Returns:
        Dictionary with position counts
    """
    players = get_all_players()
    counts = {'QB': 0, 'RB': 0, 'WR': 0, 'TE': 0}
    
    for player in players:
        position = player.get('position', '').upper()
        if position in counts:
            counts[position] += 1
    
    return counts