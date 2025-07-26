"""
Rookie Database - 2025 NFL Draft Class Management
Complete 52-player rookie database with comprehensive position coverage
"""

import json
import os
from typing import List, Dict, Any, Optional

class RookieDatabase:
    def __init__(self):
        self.json_path = os.path.join('data', 'rookies.json')
        self._rookie_data = None
        
    def get_rookies(self, position: str = 'all') -> List[Dict[str, Any]]:
        """
        Get rookies filtered by position
        
        Args:
            position: 'QB', 'RB', 'WR', 'TE', 'K', or 'all'
            
        Returns:
            List of rookie players
        """
        if self._rookie_data is None:
            self._load_rookie_data()
            
        if position == 'all':
            return self._rookie_data
            
        # Filter by position (handle multi-position players)
        filtered_rookies = []
        for rookie in self._rookie_data:
            player_positions = rookie.get('position', '').split(',')
            player_positions = [pos.strip() for pos in player_positions]
            
            if position in player_positions:
                filtered_rookies.append(rookie)
                
        return filtered_rookies
    
    def _load_rookie_data(self):
        """Load rookie data from JSON file"""
        try:
            with open(self.json_path, 'r') as f:
                self._rookie_data = json.load(f)
                
            print(f"🔥 Loaded {len(self._rookie_data)} rookies from 2025 draft class")
            
            # Show position breakdown
            position_counts = {}
            adp_range = {'min': 999, 'max': 0}
            
            for rookie in self._rookie_data:
                positions = rookie.get('position', '').split(',')
                for pos in positions:
                    pos = pos.strip()
                    position_counts[pos] = position_counts.get(pos, 0) + 1
                    
                # Track ADP range
                adp = rookie.get('adp', 999)
                if adp < adp_range['min']:
                    adp_range['min'] = adp
                if adp > adp_range['max']:
                    adp_range['max'] = adp
                    
            print(f"📊 Position breakdown: {position_counts}")
            print(f"📈 ADP range: {adp_range['min']} - {adp_range['max']}")
            
        except FileNotFoundError:
            print(f"❌ Rookie JSON file not found: {self.json_path}")
            self._rookie_data = []
        except Exception as e:
            print(f"❌ Error loading rookie JSON: {str(e)}")
            self._rookie_data = []
    
    def get_rookie_by_name(self, player_name: str) -> Dict[str, Any]:
        """Get specific rookie by name"""
        if self._rookie_data is None:
            self._load_rookie_data()
            
        for rookie in self._rookie_data:
            # Check both 'name' and 'player_name' fields
            name = rookie.get('name') or rookie.get('player_name')
            if name and name.lower() == player_name.lower():
                return rookie
                
        return {}
    
    def get_top_rookies_by_adp(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get top rookies by ADP (lowest ADP = highest draft position)"""
        if self._rookie_data is None:
            self._load_rookie_data()
            
        sorted_rookies = sorted(self._rookie_data, key=lambda x: x.get('adp', 999))
        return sorted_rookies[:limit]
    
    def get_rookies_by_position_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistical breakdown by position"""
        if self._rookie_data is None:
            self._load_rookie_data()
            
        position_stats = {}
        
        for rookie in self._rookie_data:
            positions = rookie.get('position', '').split(',')
            for pos in positions:
                pos = pos.strip()
                if pos not in position_stats:
                    position_stats[pos] = {
                        'count': 0,
                        'avg_adp': 0,
                        'top_prospect': None,
                        'adp_range': {'min': 999, 'max': 0}
                    }
                
                stats = position_stats[pos]
                stats['count'] += 1
                
                adp = rookie.get('adp', 999)
                if adp < stats['adp_range']['min']:
                    stats['adp_range']['min'] = adp
                    stats['top_prospect'] = rookie.get('name') or rookie.get('player_name')
                if adp > stats['adp_range']['max']:
                    stats['adp_range']['max'] = adp
        
        # Calculate average ADPs
        for pos in position_stats:
            pos_rookies = self.get_rookies(pos)
            if pos_rookies:
                avg_adp = sum(r.get('adp', 999) for r in pos_rookies) / len(pos_rookies)
                position_stats[pos]['avg_adp'] = round(avg_adp, 1)
                
        return position_stats