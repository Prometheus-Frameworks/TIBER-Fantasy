"""
WR Ratings Processor - Handles WR 2024 ratings from CSV
Direct CSV processing without inference or calculation
"""

import pandas as pd
import os
from typing import List, Dict, Any

class WRRatingsProcessor:
    def __init__(self):
        self.csv_path = os.path.join('data', 'WR_2024_Ratings_With_Tags.csv')
        self._wr_data = None
        
    def get_wr_ratings(self) -> List[Dict[str, Any]]:
        """
        Load and return WR ratings from CSV file
        Uses ONLY fields present in CSV - no inference or calculation
        """
        if self._wr_data is None:
            self._load_wr_data()
            
        return self._wr_data
    
    def _load_wr_data(self):
        """Load WR data from CSV file"""
        try:
            df = pd.read_csv(self.csv_path)
            
            # Convert to list of dictionaries using only CSV fields
            self._wr_data = df.to_dict('records') 
            
            print(f"✅ Loaded {len(self._wr_data)} WR players from CSV")
            print(f"🏆 Top 5 WRs by adjusted_rating:")
            
            # Sort by adjusted_rating for display
            sorted_wrs = sorted(self._wr_data, key=lambda x: x.get('adjusted_rating', 0), reverse=True)
            
            for i, wr in enumerate(sorted_wrs[:5], 1):
                name = wr.get('player_name', 'Unknown')
                team = wr.get('team', 'UNK')
                rating = wr.get('adjusted_rating', 0)
                fpg = wr.get('fantasy_points_per_game', 0)
                print(f"  {i}. {name} ({team}) - Rating: {rating}, FPG: {fpg}")
                
        except FileNotFoundError:
            print(f"❌ WR CSV file not found: {self.csv_path}")
            self._wr_data = []
        except Exception as e:
            print(f"❌ Error loading WR CSV: {str(e)}")
            self._wr_data = []
    
    def get_wr_by_name(self, player_name: str) -> Dict[str, Any]:
        """Get specific WR by name"""
        if self._wr_data is None:
            self._load_wr_data()
            
        for wr in self._wr_data:
            if wr.get('player_name', '').lower() == player_name.lower():
                return wr
                
        return {}
    
    def get_top_wrs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get top WRs by adjusted rating"""
        if self._wr_data is None:
            self._load_wr_data()
            
        sorted_wrs = sorted(self._wr_data, key=lambda x: x.get('adjusted_rating', 0), reverse=True)
        return sorted_wrs[:limit]
    
    def get_wr_fields(self) -> List[str]:
        """Get list of available fields in WR data"""
        if self._wr_data is None:
            self._load_wr_data()
            
        if self._wr_data:
            return list(self._wr_data[0].keys())
        return []