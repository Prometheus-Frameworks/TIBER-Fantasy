import sys
import os
from flask import Blueprint, render_template, jsonify
from typing import Dict, List, Any

# Add utils to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'utils'))

from load_player_data import load_tier_data, group_players_by_position, sort_players_by_tier

tiers_bp = Blueprint("tiers", __name__, template_folder="../templates")

@tiers_bp.route("/tiers")
def show_tiers():
    """Display 2025 tier data grouped by position"""
    data = load_tier_data("2025_tiers.json")
    grouped = group_players_by_position(data)
    return render_template("tiers.html", grouped=grouped)

@tiers_bp.route("/api/tiers/2025")
def api_tiers_2025():
    """API endpoint for 2025 tier data"""
    data = load_tier_data("2025_tiers.json")
    grouped = group_players_by_position(data)

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
    position_players = sort_players_by_tier(position_players)
    
    return jsonify({
        'success': True,
        'position': position.upper(),
        'players': position_players,
        'count': len(position_players)
    })

@tiers_bp.route("/api/tiers/tier/<tier_grade>")
def api_tiers_by_tier(tier_grade: str):
    """API endpoint for all players in a specific tier (S/A/B/C/D)"""
    data = load_tier_data("2025_tiers.json")
    tier_players = [p for p in data if p.get("tier", "").upper() == tier_grade.upper()]
    tier_players = sort_players_by_tier(tier_players)
    
    return jsonify({
        'success': True,
        'tier': tier_grade.upper(),
        'players': tier_players,
        'count': len(tier_players)
    })