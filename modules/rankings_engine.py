"""
Rankings Engine - VORP-based Fantasy Football Player Rankings
On The Clock Fantasy Football Analytics Platform

Generates comprehensive rankings using VORP calculations with format-aware scaling
and dynasty adjustments.
"""

from typing import List, Dict, Optional
from .vorp_calculator import VORPCalculator, POSITION_BASELINES, batch_assign_vorp


class RankingsEngine:
    """
    Advanced rankings engine for fantasy football player analysis.
    """
    
    def __init__(self):
        self.vorp_calculator = VORPCalculator()
        self.format_multipliers = {
            'standard': {'QB': 1.0, 'RB': 1.0, 'WR': 1.0, 'TE': 1.0},
            'ppr': {'QB': 1.0, 'RB': 1.1, 'WR': 1.2, 'TE': 1.1},
            'superflex': {'QB': 1.4, 'RB': 1.0, 'WR': 1.1, 'TE': 1.0}
        }
    
    def generate_rankings(self, players: List[Dict], 
                         mode: str = 'redraft', 
                         position: str = 'all',
                         format_type: str = 'standard') -> List[Dict]:
        """
        Generate comprehensive VORP-based rankings.
        
        Args:
            players: List of player dictionaries with name, position, team, projected_points
            mode: 'redraft' or 'dynasty' (affects age penalties)
            position: 'all', 'QB', 'RB', 'WR', 'TE' (filter by position)
            format_type: 'standard', 'ppr', 'superflex' (affects scoring multipliers)
            
        Returns:
            List of players sorted by VORP score (descending)
        """
        # Apply format-specific multipliers to projected points
        formatted_players = self._apply_format_multipliers(players, format_type)
        
        # Calculate VORP scores
        if mode == 'dynasty':
            ranked_players = self._calculate_dynasty_vorp(formatted_players)
        else:
            ranked_players = self._calculate_redraft_vorp(formatted_players)
        
        # Filter by position if specified
        if position != 'all':
            ranked_players = [p for p in ranked_players if p.get('position', '').upper() == position.upper()]
        
        # Sort by VORP score (descending)
        ranked_players.sort(key=lambda x: x.get('vorp', 0), reverse=True)
        
        return ranked_players
    
    def _apply_format_multipliers(self, players: List[Dict], format_type: str) -> List[Dict]:
        """Apply format-specific scoring multipliers to projected points."""
        multipliers = self.format_multipliers.get(format_type, self.format_multipliers['standard'])
        
        formatted_players = []
        for player in players:
            player_copy = player.copy()
            position = player_copy.get('position', 'WR').upper()
            multiplier = multipliers.get(position, 1.0)
            
            original_points = player_copy.get('projected_points', 0)
            player_copy['projected_points'] = original_points * multiplier
            
            formatted_players.append(player_copy)
        
        return formatted_players
    
    def _calculate_redraft_vorp(self, players: List[Dict]) -> List[Dict]:
        """Calculate VORP scores for redraft format (no age penalties)."""
        return batch_assign_vorp(players, POSITION_BASELINES)
    
    def _calculate_dynasty_vorp(self, players: List[Dict]) -> List[Dict]:
        """Calculate VORP scores for dynasty format (with age penalties)."""
        dynasty_players = []
        
        for player in players:
            # Use age if available, otherwise assume prime age (25)
            age = player.get('age', 25)
            position = player.get('position', 'WR')
            projected_points = player.get('projected_points', 0)
            
            # Calculate dynasty VORP with age penalties
            vorp = self.vorp_calculator.calculate(projected_points, position, age)
            
            player_copy = player.copy()
            player_copy['vorp'] = round(vorp, 1)
            dynasty_players.append(player_copy)
        
        return dynasty_players
    
    def get_position_rankings(self, players: List[Dict], position: str, 
                            mode: str = 'redraft', format_type: str = 'standard') -> List[Dict]:
        """Get rankings for a specific position."""
        return self.generate_rankings(players, mode, position, format_type)
    
    def get_tier_breakdown(self, players: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Organize players into VORP-based tiers.
        
        Returns:
            Dictionary with tier names as keys and player lists as values
        """
        tiers = {
            'Elite (80+)': [],
            'Premium (60-79)': [],
            'Solid (40-59)': [],
            'Depth (20-39)': [],
            'Replacement (0-19)': [],
            'Below Replacement (<0)': []
        }
        
        for player in players:
            vorp = player.get('vorp', 0)
            
            if vorp >= 80:
                tiers['Elite (80+)'].append(player)
            elif vorp >= 60:
                tiers['Premium (60-79)'].append(player)
            elif vorp >= 40:
                tiers['Solid (40-59)'].append(player)
            elif vorp >= 20:
                tiers['Depth (20-39)'].append(player)
            elif vorp >= 0:
                tiers['Replacement (0-19)'].append(player)
            else:
                tiers['Below Replacement (<0)'].append(player)
        
        return tiers
    
    def get_rankings_summary(self, players: List[Dict]) -> Dict:
        """
        Generate summary statistics for rankings.
        
        Returns:
            Dictionary with summary statistics
        """
        if not players:
            return {
                'total_players': 0,
                'above_replacement': 0,
                'elite_tier': 0,
                'highest_vorp': 0.0,
                'lowest_vorp': 0.0,
                'average_vorp': 0.0,
                'position_breakdown': {}
            }
        
        vorp_scores = [p.get('vorp', 0) for p in players]
        positions = [p.get('position', 'Unknown') for p in players]
        
        # Position breakdown
        position_counts = {}
        for pos in positions:
            position_counts[pos] = position_counts.get(pos, 0) + 1
        
        return {
            'total_players': len(players),
            'above_replacement': len([p for p in players if p.get('vorp', 0) > 0]),
            'elite_tier': len([p for p in players if p.get('vorp', 0) >= 80]),
            'highest_vorp': max(vorp_scores),
            'lowest_vorp': min(vorp_scores),
            'average_vorp': sum(vorp_scores) / len(vorp_scores),
            'position_breakdown': position_counts
        }