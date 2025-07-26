"""
Rankings Engine - Core VORP ranking system
Handles player rankings with format-aware scaling and tier groupings
"""

import json
import pandas as pd
from typing import Dict, List, Any, Optional
from vorp_calculator import VORPCalculator
from wr_ratings_processor import WRRatingsProcessor
from rookie_database import RookieDatabase

class RankingsEngine:
    def __init__(self):
        self.vorp_calc = VORPCalculator()
        self.wr_processor = WRRatingsProcessor()
        self.rookie_db = RookieDatabase()
        
    def get_rankings(self, mode: str = 'redraft', position: str = 'all', 
                    format_type: str = '1qb') -> List[Dict[str, Any]]:
        """
        Generate comprehensive player rankings with VORP calculations
        
        Args:
            mode: 'redraft' or 'dynasty'
            position: 'QB', 'RB', 'WR', 'TE', or 'all'
            format_type: '1qb' or 'superflex'
            
        Returns:
            List of ranked players with scores and tiers
        """
        # Get base player data
        players = self._get_base_players()
        
        # Apply VORP calculations
        vorp_players = self.vorp_calc.calculate_vorp(players, mode=mode)
        
        # Apply format-specific adjustments
        formatted_players = self._apply_format_scaling(vorp_players, format_type)
        
        # Filter by position if specified
        if position != 'all':
            formatted_players = [p for p in formatted_players if p['position'] == position]
            
        # Sort by final rating and add tier information
        ranked_players = sorted(formatted_players, key=lambda x: x['final_rating'], reverse=True)
        
        # Add tier groupings
        tiered_players = self._add_tier_groupings(ranked_players)
        
        return tiered_players
    
    def _get_base_players(self) -> List[Dict[str, Any]]:
        """Combine WR ratings and rookie data into base player dataset"""
        players = []
        
        # Add WR ratings from CSV
        wr_ratings = self.wr_processor.get_wr_ratings()
        for wr in wr_ratings:
            players.append({
                'name': wr['player_name'],
                'position': 'WR',
                'team': wr['team'],
                'base_rating': wr['adjusted_rating'],
                'fantasy_points': wr['fantasy_points_per_game'],
                'source': 'wr_csv'
            })
            
        # Add rookies
        rookies = self.rookie_db.get_rookies()
        for rookie in rookies:
            # Normalize field names
            name = rookie.get('name') or rookie.get('player_name')
            points = rookie.get('projected_points') or rookie.get('proj_points') or rookie.get('points', 0)
            
            players.append({
                'name': name,
                'position': rookie['position'],
                'team': rookie['team'],
                'base_rating': min(points / 15, 99),  # Scale to 1-99
                'fantasy_points': points / 17,  # Convert to per-game
                'source': 'rookie_db',
                'adp': rookie.get('adp', 999)
            })
            
        return players
    
    def _apply_format_scaling(self, players: List[Dict[str, Any]], 
                            format_type: str) -> List[Dict[str, Any]]:
        """Apply superflex vs 1QB scaling adjustments"""
        scaling_factors = {
            'superflex': {
                'QB': 1.3,
                'RB': 1.1, 
                'WR': 1.1,
                'TE': 1.0
            },
            '1qb': {
                'QB': 0.7,
                'RB': 1.2,
                'WR': 1.3,
                'TE': 1.1
            }
        }
        
        factors = scaling_factors.get(format_type, scaling_factors['1qb'])
        
        for player in players:
            pos = player['position'].split(',')[0].strip()  # Handle multi-position
            multiplier = factors.get(pos, 1.0)
            player['final_rating'] = min(player['base_rating'] * multiplier, 99)
            player['format_multiplier'] = multiplier
            
        return players
    
    def _add_tier_groupings(self, players: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add tier classifications based on rating gaps"""
        if not players:
            return players
            
        tiers = []
        current_tier = 1
        tier_threshold = 5.0  # Rating gap to trigger new tier
        
        for i, player in enumerate(players):
            if i == 0:
                player['tier'] = current_tier
                continue
                
            rating_gap = players[i-1]['final_rating'] - player['final_rating']
            
            if rating_gap >= tier_threshold:
                current_tier += 1
                
            player['tier'] = current_tier
            
        # Add tier labels
        tier_labels = {
            1: 'Elite',
            2: 'Premium', 
            3: 'Strong',
            4: 'Solid',
            5: 'Depth'
        }
        
        for player in players:
            tier_num = min(player['tier'], 5)
            player['tier_label'] = tier_labels.get(tier_num, 'Bench')
            
        return players