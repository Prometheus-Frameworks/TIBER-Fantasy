#!/usr/bin/env python3
"""
Flask routes for Draft Room Evaluator
Enables automatic evaluation of rookies in startup or rookie drafts.
"""

from flask import Blueprint, request, jsonify
from modules.draft_room_evaluator import get_draft_evaluator

# Create blueprint for draft room routes
draft_room_bp = Blueprint('draft_room', __name__)

@draft_room_bp.route('/api/draft-room/evaluate-pick', methods=['POST'])
def evaluate_single_pick():
    """Evaluate a single draft pick against consensus"""
    try:
        evaluator = get_draft_evaluator()
        request_data = request.get_json()
        
        if not request_data:
            return jsonify({'error': 'No pick data provided'}), 400
        
        required_fields = ['player_name', 'actual_pick']
        for field in required_fields:
            if field not in request_data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        evaluation = evaluator.evaluate_pick(
            player_name=request_data['player_name'],
            actual_pick=request_data['actual_pick'],
            draft_type=request_data.get('draft_type', 'startup'),
            year=request_data.get('year', None)
        )
        
        return jsonify({
            'success': True,
            'evaluation': evaluation
        })
        
    except Exception as e:
        return jsonify({'error': f'Pick evaluation failed: {str(e)}'}), 500

@draft_room_bp.route('/api/draft-room/evaluate-sequence', methods=['POST'])
def evaluate_draft_sequence():
    """Evaluate a sequence of draft picks"""
    try:
        evaluator = get_draft_evaluator()
        request_data = request.get_json()
        
        if not request_data or 'picks' not in request_data:
            return jsonify({'error': 'No picks data provided'}), 400
        
        picks = request_data['picks']
        if not isinstance(picks, list):
            return jsonify({'error': 'Picks must be a list'}), 400
        
        draft_type = request_data.get('draft_type', 'startup')
        year = request_data.get('year', None)
        
        evaluation = evaluator.evaluate_draft_sequence(picks, draft_type, year)
        
        return jsonify(evaluation)
        
    except Exception as e:
        return jsonify({'error': f'Draft sequence evaluation failed: {str(e)}'}), 500

@draft_room_bp.route('/api/draft-room/available-rookies', methods=['GET'])
def get_available_rookies():
    """Get available rookies for draft selection"""
    try:
        evaluator = get_draft_evaluator()
        
        year = request.args.get('year', None)
        position = request.args.get('position', None)
        
        rookies = evaluator.get_available_rookies(year=year, position=position)
        
        return jsonify({
            'success': True,
            'year': year,
            'position_filter': position,
            'available_rookies': rookies,
            'total_available': len(rookies)
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to get available rookies: {str(e)}'}), 500

@draft_room_bp.route('/api/draft-room/rookie-filter', methods=['POST'])
def filter_rookies():
    """Filter players to show only rookies"""
    try:
        evaluator = get_draft_evaluator()
        request_data = request.get_json()
        
        if not request_data or 'players' not in request_data:
            return jsonify({'error': 'No players data provided'}), 400
        
        players = request_data['players']
        rookie_only = request_data.get('rookie_only', False)
        
        filtered_players = evaluator.filter_rookies_by_flags(players, rookie_only)
        
        return jsonify({
            'success': True,
            'rookie_only_filter': rookie_only,
            'filtered_players': filtered_players,
            'total_filtered': len(filtered_players)
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to filter rookies: {str(e)}'}), 500

@draft_room_bp.route('/api/draft-room/live-highlighting', methods=['POST'])
def get_live_highlighting():
    """Get live highlighting data for draft picks"""
    try:
        evaluator = get_draft_evaluator()
        request_data = request.get_json()
        
        if not request_data:
            return jsonify({'error': 'No highlighting data provided'}), 400
        
        picks_to_highlight = request_data.get('picks', [])
        draft_type = request_data.get('draft_type', 'startup')
        year = request_data.get('year', None)
        
        highlighting_data = []
        
        for pick_info in picks_to_highlight:
            if 'player_name' in pick_info and 'pick_number' in pick_info:
                evaluation = evaluator.evaluate_pick(
                    pick_info['player_name'],
                    pick_info['pick_number'],
                    draft_type,
                    year
                )
                
                if evaluation.get('found'):
                    highlight_info = {
                        'player_name': evaluation['player_name'],
                        'pick_number': pick_info['pick_number'],
                        'grade': evaluation['grade'],
                        'grade_color': evaluation['grade_color'],
                        'value_score': evaluation['value_score'],
                        'highlight_type': 'value' if evaluation['pick_differential'] > 0 else 'reach',
                        'rookie_flag': evaluation.get('rookie_flag', False)
                    }
                    highlighting_data.append(highlight_info)
        
        return jsonify({
            'success': True,
            'highlighting_data': highlighting_data,
            'total_highlighted': len(highlighting_data)
        })
        
    except Exception as e:
        return jsonify({'error': f'Live highlighting failed: {str(e)}'}), 500