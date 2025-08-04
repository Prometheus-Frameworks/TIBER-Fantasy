#!/usr/bin/env python3
"""
MySportsFeeds Routes
Flask Blueprint for MySportsFeeds API integration
"""

from flask import Blueprint, jsonify, request
import sys
import os

# Add modules to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from modules.mysportsfeeds_service import get_mysportsfeeds_service

# Create blueprint for MySportsFeeds routes
mysportsfeeds_bp = Blueprint('mysportsfeeds', __name__)

@mysportsfeeds_bp.route('/api/mysportsfeeds/test', methods=['GET'])
def test_mysportsfeeds_connection():
    """Test MySportsFeeds API connection"""
    try:
        service = get_mysportsfeeds_service()
        result = service.test_connection()
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': result,
                'message': 'MySportsFeeds connection successful'
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Connection test failed')
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@mysportsfeeds_bp.route('/api/mysportsfeeds/injuries', methods=['GET'])
def get_injury_reports():
    """Get current NFL injury reports"""
    try:
        team = request.args.get('team')
        service = get_mysportsfeeds_service()
        injuries = service.get_injury_reports(team=team)
        
        return jsonify({
            'success': True,
            'data': injuries,
            'count': len(injuries),
            'filtered_by_team': team if team else None
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@mysportsfeeds_bp.route('/api/mysportsfeeds/roster', methods=['GET'])
def get_roster_updates():
    """Get roster updates and player movements"""
    try:
        team = request.args.get('team')
        service = get_mysportsfeeds_service()
        roster_updates = service.get_roster_updates(team=team)
        
        return jsonify({
            'success': True,
            'data': roster_updates,
            'count': len(roster_updates),
            'filtered_by_team': team if team else None
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@mysportsfeeds_bp.route('/api/mysportsfeeds/stats', methods=['GET'])
def get_player_stats():
    """Get player statistics"""
    try:
        player_name = request.args.get('player')
        position = request.args.get('position')
        
        service = get_mysportsfeeds_service()
        stats = service.get_player_stats(player_name=player_name, position=position)
        
        return jsonify({
            'success': True,
            'data': stats,
            'count': len(stats),
            'filters': {
                'player_name': player_name,
                'position': position
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@mysportsfeeds_bp.route('/api/mysportsfeeds/gamelogs/<int:week>', methods=['GET'])
def get_weekly_game_logs(week):
    """Get weekly game logs for specified week"""
    try:
        player_name = request.args.get('player')
        
        service = get_mysportsfeeds_service()
        game_logs = service.get_weekly_game_logs(week=week, player_name=player_name)
        
        return jsonify({
            'success': True,
            'data': game_logs,
            'count': len(game_logs),
            'week': week,
            'filtered_by_player': player_name if player_name else None
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@mysportsfeeds_bp.route('/api/mysportsfeeds/comprehensive', methods=['GET'])
def get_comprehensive_update():
    """Get comprehensive MySportsFeeds data update"""
    try:
        service = get_mysportsfeeds_service()
        comprehensive_data = service.get_comprehensive_update()
        
        if 'error' in comprehensive_data:
            return jsonify({
                'success': False,
                'error': comprehensive_data['error']
            }), 400
        
        return jsonify({
            'success': True,
            'data': comprehensive_data,
            'summary': comprehensive_data.get('summary', {})
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Register blueprint function
def register_mysportsfeeds_routes(app):
    """Register MySportsFeeds routes with Flask app"""
    app.register_blueprint(mysportsfeeds_bp)
    print("✅ MySportsFeeds Blueprint registered successfully")