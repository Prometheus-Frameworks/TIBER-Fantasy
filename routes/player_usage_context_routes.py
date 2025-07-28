#!/usr/bin/env python3
"""
Player Usage Context Routes
API endpoints for dynasty tier analysis and player usage scoring
"""

from flask import Blueprint, jsonify, request
import sys
import os

# Add modules to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from modules.player_usage_context import get_player_usage_context

# Create blueprint for player usage context routes
player_usage_context_bp = Blueprint('player_usage_context', __name__)

@player_usage_context_bp.route('/api/player-usage-context', methods=['GET'])
def get_all_player_contexts():
    """Get all players with usage context"""
    try:
        context = get_player_usage_context()
        players = context.get_all_players()
        
        return jsonify({
            'success': True,
            'data': players,
            'count': len(players)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@player_usage_context_bp.route('/api/player-usage-context/player/<player_name>', methods=['GET'])
def get_player_context(player_name: str):
    """Get specific player context by name"""
    try:
        context = get_player_usage_context()
        player = context.get_player_by_name(player_name)
        
        if not player:
            return jsonify({
                'success': False,
                'error': f'Player {player_name} not found'
            }), 404
        
        return jsonify({
            'success': True,
            'player': player
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@player_usage_context_bp.route('/api/player-usage-context/tiers', methods=['GET'])
def get_tier_breakdown():
    """Get players organized by tier"""
    try:
        context = get_player_usage_context()
        tiers = context.get_tier_breakdown()
        
        return jsonify({
            'success': True,
            'tiers': tiers
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@player_usage_context_bp.route('/api/player-usage-context/position/<position>', methods=['GET'])
def get_players_by_position(position: str):
    """Get players by position"""
    try:
        context = get_player_usage_context()
        players = context.get_players_by_position(position)
        
        return jsonify({
            'success': True,
            'data': players,
            'count': len(players),
            'position': position.upper()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@player_usage_context_bp.route('/api/player-usage-context/summary', methods=['GET'])
def get_context_summary():
    """Get summary of usage context data"""
    try:
        context = get_player_usage_context()
        summary = context.get_context_summary()
        
        return jsonify({
            'success': True,
            'summary': summary
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@player_usage_context_bp.route('/api/player-usage-context/update/<player_name>', methods=['POST'])
def update_player_context(player_name: str):
    """Update player context data"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No update data provided'
            }), 400
        
        context = get_player_usage_context()
        success = context.update_player_context(player_name, data)
        
        if not success:
            return jsonify({
                'success': False,
                'error': f'Player {player_name} not found'
            }), 404
        
        return jsonify({
            'success': True,
            'message': f'{player_name} context updated successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@player_usage_context_bp.route('/api/player-usage-context/add', methods=['POST'])
def add_player_context():
    """Add new player to usage context"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No player data provided'
            }), 400
        
        context = get_player_usage_context()
        success = context.add_player_context(data)
        
        if not success:
            return jsonify({
                'success': False,
                'error': 'Failed to add player - check required fields'
            }), 400
        
        return jsonify({
            'success': True,
            'message': f"{data.get('player_name', 'Player')} added successfully"
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@player_usage_context_bp.route('/api/player-usage-context/recalculate-tier/<player_name>', methods=['POST'])
def recalculate_player_tier(player_name: str):
    """Recalculate player tier based on alpha usage score"""
    try:
        context = get_player_usage_context()
        new_tier = context.recalculate_tier(player_name)
        
        if not new_tier:
            return jsonify({
                'success': False,
                'error': f'Player {player_name} not found'
            }), 404
        
        return jsonify({
            'success': True,
            'player_name': player_name,
            'new_tier': new_tier,
            'message': f'{player_name} tier recalculated'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@player_usage_context_bp.route('/api/player-usage-context/process-roster-shift', methods=['POST'])
def process_roster_shift():
    """Process roster shift impact on player usage context"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No roster shift data provided'
            }), 400
        
        context = get_player_usage_context()
        context.process_roster_shift_impact(data)
        
        return jsonify({
            'success': True,
            'message': 'Roster shift impact processed successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Register blueprint function
def register_player_usage_context_routes(app):
    """Register player usage context routes with Flask app"""
    app.register_blueprint(player_usage_context_bp)
    print("✅ Player Usage Context Blueprint registered successfully")