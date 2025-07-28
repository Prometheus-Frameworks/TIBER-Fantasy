#!/usr/bin/env python3
"""
Target Competition 2025 Routes
API endpoints for the Target Competition 2025 Class module
"""

from flask import Blueprint, jsonify

# Create blueprint for Target Competition 2025 routes
target_competition_2025_bp = Blueprint('target_competition_2025', __name__)

# Target Competition 2025 data
target_competition_data = {
    "players": [
        {
            "player_name": "Luther Burden",
            "team": "CHI",
            "position": "WR",
            "draft_capital": "Round 2",
            "competition_overview": {
                "WR1": "Rome Odunze (Top 10 Pick, underwhelming 2024 season)",
                "WR2": "DJ Moore (Established Vet)",
                "TE1": "Colston Loveland (Top 10 Pick)"
            },
            "target_competition_tier": "A",
            "vacated_targets": "Minimal",
            "summary": "Burden enters a crowded WR room featuring high-capital players. Breakout depends on how Ben Johnson deploys him."
        },
        {
            "player_name": "Travis Hunter",
            "team": "JAX",
            "position": "WR",
            "draft_capital": "2nd Overall Pick",
            "competition_overview": {
                "WR1": "Travis Hunter",
                "WR2": "Dyami Brown (Mid-tier FA)",
                "TE1": "Noah Fant / Rookie Depth"
            },
            "target_competition_tier": "S",
            "vacated_targets": "High (Kirk, Engram, Davis all gone)",
            "summary": "Hunter walks into a wide-open WR room with heavy draft investment. Potential for WR1 usage in year one."
        },
        {
            "player_name": "Chris Godwin",
            "team": "TB",
            "position": "WR",
            "draft_capital": "Day 2",
            "competition_overview": {
                "WR1": "Emeka Egbuka (1st Round Rookie)",
                "WR2": "Chris Godwin",
                "TE1": "Cade Otton"
            },
            "target_competition_tier": "B",
            "vacated_targets": "Moderate",
            "summary": "Godwin returns from IR into a reshuffled offense. Former OC Liam Coen is gone, replaced by a rookie-first look."
        }
    ]
}

@target_competition_2025_bp.route('/api/target-competition', methods=['GET'])
def get_target_competition():
    """Get Target Competition 2025 Class data"""
    try:
        return jsonify(target_competition_data)
    except Exception as e:
        return jsonify({
            'error': f'Failed to get target competition data: {str(e)}'
        }), 500

@target_competition_2025_bp.route('/api/target-competition/player/<player_name>', methods=['GET'])
def get_target_competition_player(player_name: str):
    """Get specific player from Target Competition 2025 data"""
    try:
        # Find player in data
        player_data = None
        for player in target_competition_data['players']:
            if player['player_name'].lower() == player_name.lower():
                player_data = player
                break
        
        if not player_data:
            return jsonify({
                'error': f'Player {player_name} not found in Target Competition 2025 data'
            }), 404
        
        return jsonify({
            'success': True,
            'player': player_data
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to get player data: {str(e)}'
        }), 500

@target_competition_2025_bp.route('/api/target-competition/tiers', methods=['GET'])
def get_target_competition_tiers():
    """Get players grouped by competition tier"""
    try:
        tiers = {'S': [], 'A': [], 'B': [], 'C': [], 'D': []}
        
        for player in target_competition_data['players']:
            tier = player['target_competition_tier']
            if tier in tiers:
                tiers[tier].append(player)
        
        return jsonify({
            'success': True,
            'tiers': tiers,
            'tier_counts': {tier: len(players) for tier, players in tiers.items() if players}
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to get tier data: {str(e)}'
        }), 500

# Register blueprint function
def register_target_competition_2025_routes(app):
    """Register Target Competition 2025 routes with Flask app"""
    app.register_blueprint(target_competition_2025_bp)
    print("✅ Target Competition 2025 Class Blueprint registered successfully")