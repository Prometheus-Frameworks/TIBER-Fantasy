#!/usr/bin/env python3
"""
Roster Shift Routes
API endpoints for NFL roster shift monitoring and dynasty context analysis
"""

from flask import Blueprint, jsonify, request
import sys
import os

# Add roster_shift_listener to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from roster_shift_listener import get_roster_shift_listener

# Create blueprint for roster shift routes
roster_shift_bp = Blueprint('roster_shift', __name__)

@roster_shift_bp.route('/api/roster-shifts', methods=['GET'])
def get_roster_shifts():
    """Get all roster shift entries"""
    try:
        listener = get_roster_shift_listener()
        all_shifts = listener.load_existing_log()
        
        return jsonify({
            'success': True,
            'data': all_shifts,
            'count': len(all_shifts)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@roster_shift_bp.route('/api/roster-shifts/recent', methods=['GET'])
def get_recent_roster_shifts():
    """Get recent roster shifts (last 7 days by default)"""
    try:
        days = int(request.args.get('days', 7))
        listener = get_roster_shift_listener()
        recent_shifts = listener.get_recent_shifts(days)
        
        return jsonify({
            'success': True,
            'data': recent_shifts,
            'count': len(recent_shifts),
            'days': days
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@roster_shift_bp.route('/api/roster-shifts/team/<team_code>', methods=['GET'])
def get_team_roster_shifts(team_code: str):
    """Get roster shifts for a specific team"""
    try:
        listener = get_roster_shift_listener()
        team_shifts = listener.get_team_shifts(team_code)
        
        return jsonify({
            'success': True,
            'data': team_shifts,
            'count': len(team_shifts),
            'team': team_code.upper()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@roster_shift_bp.route('/api/roster-shifts/summary', methods=['GET'])
def get_roster_shift_summary():
    """Get summary of roster shift activity"""
    try:
        listener = get_roster_shift_listener()
        summary = listener.get_impact_summary()
        
        return jsonify({
            'success': True,
            'summary': summary
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@roster_shift_bp.route('/api/roster-shifts/log-coaching-change', methods=['POST'])
def log_coaching_change():
    """Manually log a coaching change"""
    try:
        data = request.get_json()
        
        required_fields = ['team', 'position', 'name_in']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        listener = get_roster_shift_listener()
        listener.log_coaching_change(
            team=data['team'],
            position=data['position'],
            name_in=data['name_in'],
            name_out=data.get('name_out'),
            impact_note=data.get('impact_note')
        )
        
        return jsonify({
            'success': True,
            'message': 'Coaching change logged successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@roster_shift_bp.route('/api/roster-shifts/log-player-transaction', methods=['POST'])
def log_player_transaction():
    """Manually log a player transaction"""
    try:
        data = request.get_json()
        
        required_fields = ['team', 'player_name', 'action']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        listener = get_roster_shift_listener()
        listener.log_player_transaction(
            team=data['team'],
            player_name=data['player_name'],
            action=data['action'],
            method=data.get('method'),
            note=data.get('note')
        )
        
        return jsonify({
            'success': True,
            'message': 'Player transaction logged successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@roster_shift_bp.route('/api/roster-shifts/log-injury', methods=['POST'])
def log_injury_report():
    """Manually log an injury report"""
    try:
        data = request.get_json()
        
        required_fields = ['team', 'player_name', 'injury_type', 'severity']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        listener = get_roster_shift_listener()
        listener.log_injury_report(
            team=data['team'],
            player_name=data['player_name'],
            injury_type=data['injury_type'],
            severity=data['severity'],
            expected_return=data.get('expected_return')
        )
        
        return jsonify({
            'success': True,
            'message': 'Injury report logged successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@roster_shift_bp.route('/api/roster-shifts/run-check', methods=['POST'])
def run_roster_shift_check():
    """Manually trigger roster shift check"""
    try:
        listener = get_roster_shift_listener()
        new_entries = listener.check_for_updates()
        summary = listener.get_impact_summary()
        
        return jsonify({
            'success': True,
            'message': 'Roster shift check completed',
            'new_entries_found': len(new_entries),
            'summary': summary
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Register blueprint function
def register_roster_shift_routes(app):
    """Register roster shift routes with Flask app"""
    app.register_blueprint(roster_shift_bp)
    print("✅ Roster Shift Listener Blueprint registered successfully")