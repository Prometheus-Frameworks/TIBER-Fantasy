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
        
        # Create sample tier data with S/A/B/C/D tier system and notes
        sample_data = [
            {"name": "Travis Hunter", "position": "WR", "tier": "S", "team": "JAX", "dynasty_score": 95, 
             "note": "Elite opportunity - minimal target competition beyond Brian Thomas Jr. Instant WR1 upside with 2nd overall draft capital."},
            {"name": "Luther Burden III", "position": "WR", "tier": "A", "team": "CHI", "dynasty_score": 88,
             "note": "Strong opportunity - battling DJ Moore, Rome Odunze for targets but has slot role clarity and elite athletic profile."},
            {"name": "Tetairoa McMillan", "position": "WR", "tier": "B", "team": "ARI", "dynasty_score": 85,
             "note": "Manageable competition - clear WR2 role available with Kyler Murray connection and red zone size advantage."},
            {"name": "Cam Ward", "position": "QB", "tier": "A", "team": "MIA", "dynasty_score": 82,
             "note": "Strong opportunity - immediate starter with elite arm talent and rushing upside in fantasy-friendly offense."},
            {"name": "Dylan Sampson", "position": "RB", "tier": "C", "team": "TEN", "dynasty_score": 78,
             "note": "Challenging competition - competing with Tony Pollard for touches but has goal-line size and college production."},
            {"name": "Colston Loveland", "position": "TE", "tier": "B", "team": "CHI", "dynasty_score": 80,
             "note": "Manageable competition - clear TE1 role with Caleb Williams connection and red zone target upside."},
            {"name": "Emeka Egbuka", "position": "WR", "tier": "D", "team": "TB", "dynasty_score": 83,
             "note": "Severe competition - entering crowded room with Mike Evans, Chris Godwin returning from injury. Volume concerns."},
            {"name": "Will Campbell", "position": "RB", "tier": "C", "team": "HOU", "dynasty_score": 75,
             "note": "Challenging competition - behind Joe Mixon and Dameon Pierce on depth chart. Special teams role likely year one."}
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
    
    # Sort players within each position by tier (S->A->B->C->D), then by dynasty score
    tier_order = {"S": 1, "A": 2, "B": 3, "C": 4, "D": 5}
    for pos in grouped:
        grouped[pos].sort(key=lambda x: (tier_order.get(x.get("tier", "C"), 3), -x.get("dynasty_score", 0)))

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
    
    # Sort within each position by tier (S->A->B->C->D), then by dynasty score
    tier_order = {"S": 1, "A": 2, "B": 3, "C": 4, "D": 5}
    for pos in grouped:
        grouped[pos].sort(key=lambda x: (tier_order.get(x.get("tier", "C"), 3), -x.get("dynasty_score", 0)))

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
    
    # Sort by tier (S->A->B->C->D), then dynasty score
    tier_order = {"S": 1, "A": 2, "B": 3, "C": 4, "D": 5}
    position_players.sort(key=lambda x: (tier_order.get(x.get("tier", "C"), 3), -x.get("dynasty_score", 0)))
    
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