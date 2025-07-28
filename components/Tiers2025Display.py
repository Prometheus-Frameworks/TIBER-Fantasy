import json
import os
from flask import Blueprint, render_template, jsonify
from typing import Dict, List, Any

tiers_bp = Blueprint("tiers", __name__, template_folder="templates")

def load_tier_data(filename: str = "2025_tiers.json") -> List[Dict[str, Any]]:
    """Load tier data from JSON file with fallback to sample data"""
    try:
        # Try to load from data directory first
        data_path = os.path.join("data", filename)
        if os.path.exists(data_path):
            with open(data_path, 'r') as f:
                return json.load(f)
        
        # Try root directory
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                return json.load(f)
        
        # Create sample tier data if file doesn't exist
        sample_data = [
            {"name": "Travis Hunter", "position": "WR", "tier": 1, "team": "JAX", "dynasty_score": 95},
            {"name": "Luther Burden III", "position": "WR", "tier": 2, "team": "CHI", "dynasty_score": 88},
            {"name": "Tetairoa McMillan", "position": "WR", "tier": 2, "team": "ARI", "dynasty_score": 85},
            {"name": "Cam Ward", "position": "QB", "tier": 2, "team": "MIA", "dynasty_score": 82},
            {"name": "Dylan Sampson", "position": "RB", "tier": 3, "team": "TEN", "dynasty_score": 78},
            {"name": "Colston Loveland", "position": "TE", "tier": 2, "team": "CHI", "dynasty_score": 80},
            {"name": "Emeka Egbuka", "position": "WR", "tier": 2, "team": "TB", "dynasty_score": 83},
            {"name": "Will Campbell", "position": "RB", "tier": 3, "team": "HOU", "dynasty_score": 75}
        ]
        
        # Save sample data for future use
        os.makedirs("data", exist_ok=True)
        with open(data_path, 'w') as f:
            json.dump(sample_data, f, indent=4)
        
        return sample_data
        
    except Exception as e:
        print(f"[TIERS_DISPLAY] Error loading tier data: {e}")
        return []

@tiers_bp.route("/tiers")
def show_tiers():
    """Display 2025 tier data grouped by position"""
    data = load_tier_data("2025_tiers.json")
    grouped = {}

    # Group players by position
    for player in data:
        pos = player.get("position", "UNKNOWN")
        if pos not in grouped:
            grouped[pos] = []
        grouped[pos].append(player)
    
    # Sort players within each position by tier, then by dynasty score
    for pos in grouped:
        grouped[pos].sort(key=lambda x: (x.get("tier", 99), -x.get("dynasty_score", 0)))

    return render_template("tiers.html", grouped=grouped)

@tiers_bp.route("/api/tiers/2025")
def api_tiers_2025():
    """API endpoint for 2025 tier data"""
    data = load_tier_data("2025_tiers.json")
    grouped = {}

    for player in data:
        pos = player.get("position", "UNKNOWN")
        if pos not in grouped:
            grouped[pos] = []
        grouped[pos].append(player)
    
    # Sort within each position
    for pos in grouped:
        grouped[pos].sort(key=lambda x: (x.get("tier", 99), -x.get("dynasty_score", 0)))

    return jsonify({
        'success': True,
        'data': grouped,
        'total_players': len(data),
        'positions': list(grouped.keys())
    })

@tiers_bp.route("/api/tiers/position/<position>")
def api_tiers_by_position(position: str):
    """API endpoint for tier data by specific position"""
    data = load_tier_data("2025_tiers.json")
    position_players = [p for p in data if p.get("position", "").upper() == position.upper()]
    
    # Sort by tier, then dynasty score
    position_players.sort(key=lambda x: (x.get("tier", 99), -x.get("dynasty_score", 0)))
    
    return jsonify({
        'success': True,
        'position': position.upper(),
        'players': position_players,
        'count': len(position_players)
    })

@tiers_bp.route("/api/tiers/tier/<int:tier_num>")
def api_tiers_by_tier(tier_num: int):
    """API endpoint for all players in a specific tier"""
    data = load_tier_data("2025_tiers.json")
    tier_players = [p for p in data if p.get("tier") == tier_num]
    
    # Sort by dynasty score descending
    tier_players.sort(key=lambda x: -x.get("dynasty_score", 0))
    
    return jsonify({
        'success': True,
        'tier': tier_num,
        'players': tier_players,
        'count': len(tier_players)
    })