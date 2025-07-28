#!/usr/bin/env python3
"""
Rookie Database Management Module
Handles loading, validation, and processing of 2025 rookie class data.
Integrates with standardized JSON template for comprehensive prospect evaluation.
"""

import json
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from pathlib import Path

@dataclass
class RookiePlayer:
    """Standardized rookie player data structure"""
    player_name: str
    position: str
    nfl_team: str
    draft_capital: str
    college_stats: Dict[str, Dict[str, int]]
    athleticism: str
    context_notes: str
    star_rating: float
    dynasty_tier: str
    rookie_flag: bool
    future_ceiling_summary: str
    
    def __post_init__(self):
        """Validate data after initialization"""
        if self.position not in ['WR', 'RB', 'QB', 'TE']:
            raise ValueError(f"Invalid position: {self.position}")
        
        if not (1.0 <= self.star_rating <= 5.0):
            raise ValueError(f"Star rating must be between 1.0-5.0: {self.star_rating}")
        
        if self.athleticism not in ['Unknown', 'Below Average', 'Average', 'Above Average', 'Elite']:
            raise ValueError(f"Invalid athleticism rating: {self.athleticism}")

class RookieDatabase:
    """
    Manages 2025 rookie class data with comprehensive loading and filtering capabilities.
    Supports position-specific queries, tier filtering, and dynasty evaluation integration.
    """
    
    def __init__(self, data_directory: str = "backend/data/rookies/2025"):
        self.data_directory = Path(data_directory)
        self.rookies: Dict[str, RookiePlayer] = {}
        self._load_all_rookies()
    
    def _load_all_rookies(self) -> None:
        """Load all rookie JSON files from the data directory"""
        if not self.data_directory.exists():
            print(f"⚠️ Rookie data directory not found: {self.data_directory}")
            return
        
        json_files = list(self.data_directory.glob("*.json"))
        
        for json_file in json_files:
            try:
                with open(json_file, 'r') as f:
                    data = json.load(f)
                
                rookie = RookiePlayer(**data)
                player_key = self._create_player_key(rookie.player_name)
                self.rookies[player_key] = rookie
                
            except Exception as e:
                print(f"❌ Failed to load {json_file.name}: {e}")
        
        print(f"✅ Loaded {len(self.rookies)} rookies from 2025 draft class")
    
    def _create_player_key(self, player_name: str) -> str:
        """Create standardized key from player name"""
        return player_name.lower().replace(" ", "_").replace(".", "")
    
    def get_rookie_by_name(self, player_name: str) -> Optional[RookiePlayer]:
        """Get specific rookie by name"""
        key = self._create_player_key(player_name)
        return self.rookies.get(key)
    
    def get_rookies_by_position(self, position: str) -> List[RookiePlayer]:
        """Get all rookies at specific position"""
        if position not in ['WR', 'RB', 'QB', 'TE']:
            return []
        
        return [rookie for rookie in self.rookies.values() 
                if rookie.position == position]
    
    def get_rookies_by_tier(self, dynasty_tier: str) -> List[RookiePlayer]:
        """Get all rookies in specific dynasty tier"""
        return [rookie for rookie in self.rookies.values() 
                if rookie.dynasty_tier == dynasty_tier]
    
    def get_top_prospects(self, limit: int = 10) -> List[RookiePlayer]:
        """Get top prospects by star rating"""
        sorted_rookies = sorted(self.rookies.values(), 
                              key=lambda x: x.star_rating, reverse=True)
        return sorted_rookies[:limit]
    
    def get_all_rookies(self) -> List[RookiePlayer]:
        """Get all loaded rookies"""
        return list(self.rookies.values())
    
    def add_rookie(self, rookie_data: Dict[str, Any]) -> bool:
        """Add new rookie to database and save to JSON file"""
        try:
            rookie = RookiePlayer(**rookie_data)
            player_key = self._create_player_key(rookie.player_name)
            
            # Add to in-memory database
            self.rookies[player_key] = rookie
            
            # Save to JSON file
            filename = f"{player_key}.json"
            file_path = self.data_directory / filename
            
            with open(file_path, 'w') as f:
                json.dump(rookie_data, f, indent=2)
            
            print(f"✅ Added rookie: {rookie.player_name} to database")
            return True
            
        except Exception as e:
            print(f"❌ Failed to add rookie: {e}")
            return False
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Get comprehensive database statistics"""
        if not self.rookies:
            return {"total_rookies": 0}
        
        position_counts = {}
        tier_counts = {}
        athleticism_counts = {}
        
        for rookie in self.rookies.values():
            # Position distribution
            position_counts[rookie.position] = position_counts.get(rookie.position, 0) + 1
            
            # Tier distribution
            tier_counts[rookie.dynasty_tier] = tier_counts.get(rookie.dynasty_tier, 0) + 1
            
            # Athleticism distribution
            athleticism_counts[rookie.athleticism] = athleticism_counts.get(rookie.athleticism, 0) + 1
        
        avg_star_rating = sum(r.star_rating for r in self.rookies.values()) / len(self.rookies)
        
        return {
            "total_rookies": len(self.rookies),
            "position_distribution": position_counts,
            "tier_distribution": tier_counts,
            "athleticism_distribution": athleticism_counts,
            "average_star_rating": round(avg_star_rating, 2),
            "top_prospect": max(self.rookies.values(), key=lambda x: x.star_rating).player_name
        }

def get_all_rookies_for_vorp(format_type: str = "dynasty") -> List[Dict[str, Any]]:
    """
    Integration function for VORP calculator.
    Returns rookie data in format compatible with existing VORP system.
    """
    db = RookieDatabase()
    rookies = db.get_all_rookies()
    
    vorp_format_rookies = []
    
    for rookie in rookies:
        # Convert to VORP-compatible format
        vorp_rookie = {
            "player_id": f"rookie_{rookie.player_name.lower().replace(' ', '_')}",
            "name": rookie.player_name,
            "position": rookie.position,
            "team": rookie.nfl_team if rookie.nfl_team != "TBD" else "FA",
            "projected_fpts": _estimate_rookie_projection(rookie),
            "age": 22,  # Standard rookie age
            "dynasty_tier": rookie.dynasty_tier,
            "star_rating": rookie.star_rating,
            "rookie_flag": True
        }
        vorp_format_rookies.append(vorp_rookie)
    
    return vorp_format_rookies

def _estimate_rookie_projection(rookie: RookiePlayer) -> float:
    """
    Estimate fantasy projection based on star rating and position.
    Conservative estimates for rookie fantasy points.
    """
    position_baselines = {
        "QB": {"base": 180, "multiplier": 40},  # QB12-QB1 range
        "RB": {"base": 120, "multiplier": 30},  # RB24-RB6 range  
        "WR": {"base": 100, "multiplier": 25},  # WR36-WR12 range
        "TE": {"base": 80, "multiplier": 20}    # TE12-TE6 range
    }
    
    if rookie.position not in position_baselines:
        return 50.0
    
    baseline = position_baselines[rookie.position]
    projection = baseline["base"] + (rookie.star_rating * baseline["multiplier"])
    
    return round(projection, 1)

# Global database instance
rookie_db = RookieDatabase()

if __name__ == "__main__":
    # Test database functionality
    db = RookieDatabase()
    stats = db.get_database_stats()
    
    print("🏈 2025 ROOKIE DATABASE STATS")
    print("=" * 40)
    print(f"Total Rookies: {stats['total_rookies']}")
    print(f"Top Prospect: {stats.get('top_prospect', 'None')}")
    print(f"Average Star Rating: {stats.get('average_star_rating', 0)}")
    
    if stats['total_rookies'] > 0:
        print("\n📊 Position Distribution:")
        for pos, count in stats['position_distribution'].items():
            print(f"  {pos}: {count}")
        
        print("\n🏆 Dynasty Tier Distribution:")
        for tier, count in stats['tier_distribution'].items():
            print(f"  {tier}: {count}")
        
        print("\n⚡ Top 3 Prospects:")
        top_prospects = db.get_top_prospects(3)
        for i, prospect in enumerate(top_prospects, 1):
            print(f"  {i}. {prospect.player_name} ({prospect.position}) - {prospect.star_rating}⭐")