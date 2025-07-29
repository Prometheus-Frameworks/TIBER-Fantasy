import json
import os
from typing import Dict, List, Any

def load_tier_data(filename: str = "2025_tiers.json") -> List[Dict[str, Any]]:
    """
    Load tier data from JSON file with fallback to sample data
    
    Args:
        filename: Name of the JSON file to load
        
    Returns:
        List of player dictionaries with tier information
    """
    try:
        # Try to load from data directory first
        data_path = os.path.join("data", filename)
        if os.path.exists(data_path):
            with open(data_path, 'r') as f:
                data = json.load(f)
                print(f"[TIER_DATA] Loaded {len(data)} players from {data_path}")
                return data
        
        # Try root directory
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                data = json.load(f)
                print(f"[TIER_DATA] Loaded {len(data)} players from {filename}")
                return data
        
        print(f"[TIER_DATA] File {filename} not found, returning empty list")
        return []
        
    except Exception as e:
        print(f"[TIER_DATA] Error loading tier data: {e}")
        return []

def sort_players_by_tier(players: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sort players by tier (S->A->B->C->D) then by dynasty score descending
    
    Args:
        players: List of player dictionaries
        
    Returns:
        Sorted list of players
    """
    tier_order = {"S": 1, "A": 2, "B": 3, "C": 4, "D": 5}
    return sorted(players, key=lambda x: (tier_order.get(x.get("tier", "C"), 3), -x.get("dynasty_score", 0)))

def group_players_by_position(players: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group players by position and sort within each position
    
    Args:
        players: List of player dictionaries
        
    Returns:
        Dictionary with position as key and sorted player list as value
    """
    grouped = {}
    
    for player in players:
        pos = player.get("position", "UNKNOWN")
        if pos not in grouped:
            grouped[pos] = []
        grouped[pos].append(player)
    
    # Sort players within each position
    for pos in grouped:
        grouped[pos] = sort_players_by_tier(grouped[pos])
    
    return grouped