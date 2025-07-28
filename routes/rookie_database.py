#!/usr/bin/env python3
"""
Flask routes for 2025 Rookie Database Management
Provides API endpoints for rookie data management, filtering, and integration.
"""

from flask import Blueprint, request, jsonify
from modules.rookie_database import RookieDatabase, get_all_rookies_for_vorp
import json

# Create blueprint for rookie database routes
rookie_db_bp = Blueprint('rookie_database', __name__)

# Initialize database instance
rookie_db = RookieDatabase()

@rookie_db_bp.route('/api/rookies/stats', methods=['GET'])
def get_rookie_database_stats():
    """Get comprehensive database statistics"""
    try:
        stats = rookie_db.get_database_stats()
        return jsonify({
            'success': True,
            'data': stats,
            'system_version': 'v1.0'
        })
    except Exception as e:
        return jsonify({'error': f'Failed to get stats: {str(e)}'}), 500

@rookie_db_bp.route('/api/rookies/all', methods=['GET'])
def get_all_rookies():
    """Get all rookies in database"""
    try:
        rookies = rookie_db.get_all_rookies()
        rookie_data = []
        
        for rookie in rookies:
            rookie_data.append({
                'player_name': rookie.player_name,
                'position': rookie.position,
                'nfl_team': rookie.nfl_team,
                'draft_capital': rookie.draft_capital,
                'star_rating': rookie.star_rating,
                'dynasty_tier': rookie.dynasty_tier,
                'athleticism': rookie.athleticism,
                'future_ceiling_summary': rookie.future_ceiling_summary,
                'context_notes': rookie.context_notes
            })
        
        return jsonify({
            'success': True,
            'total_rookies': len(rookie_data),
            'rookies': rookie_data
        })
    except Exception as e:
        return jsonify({'error': f'Failed to get rookies: {str(e)}'}), 500

@rookie_db_bp.route('/api/rookies/position/<position>', methods=['GET'])
def get_rookies_by_position(position):
    """Get rookies filtered by position"""
    try:
        position = position.upper()
        if position not in ['WR', 'RB', 'QB', 'TE']:
            return jsonify({'error': 'Invalid position. Use WR, RB, QB, or TE'}), 400
        
        rookies = rookie_db.get_rookies_by_position(position)
        rookie_data = []
        
        for rookie in rookies:
            rookie_data.append({
                'player_name': rookie.player_name,
                'position': rookie.position,
                'nfl_team': rookie.nfl_team,
                'draft_capital': rookie.draft_capital,
                'star_rating': rookie.star_rating,
                'dynasty_tier': rookie.dynasty_tier,
                'college_stats': rookie.college_stats,
                'athleticism': rookie.athleticism,
                'future_ceiling_summary': rookie.future_ceiling_summary
            })
        
        return jsonify({
            'success': True,
            'position': position,
            'total_rookies': len(rookie_data),
            'rookies': rookie_data
        })
    except Exception as e:
        return jsonify({'error': f'Failed to get rookies by position: {str(e)}'}), 500

@rookie_db_bp.route('/api/rookies/tier/<tier>', methods=['GET'])
def get_rookies_by_tier(tier):
    """Get rookies filtered by dynasty tier"""
    try:
        rookies = rookie_db.get_rookies_by_tier(tier)
        rookie_data = []
        
        for rookie in rookies:
            rookie_data.append({
                'player_name': rookie.player_name,
                'position': rookie.position,
                'star_rating': rookie.star_rating,
                'dynasty_tier': rookie.dynasty_tier,
                'future_ceiling_summary': rookie.future_ceiling_summary
            })
        
        return jsonify({
            'success': True,
            'dynasty_tier': tier,
            'total_rookies': len(rookie_data),
            'rookies': rookie_data
        })
    except Exception as e:
        return jsonify({'error': f'Failed to get rookies by tier: {str(e)}'}), 500

@rookie_db_bp.route('/api/rookies/top-prospects', methods=['GET'])
def get_top_prospects():
    """Get top prospects by star rating"""
    try:
        limit = request.args.get('limit', 10, type=int)
        if limit > 50:
            limit = 50  # Cap at 50 for API response size
        
        rookies = rookie_db.get_top_prospects(limit)
        rookie_data = []
        
        for i, rookie in enumerate(rookies, 1):
            rookie_data.append({
                'rank': i,
                'player_name': rookie.player_name,
                'position': rookie.position,
                'star_rating': rookie.star_rating,
                'dynasty_tier': rookie.dynasty_tier,
                'athleticism': rookie.athleticism,
                'future_ceiling_summary': rookie.future_ceiling_summary
            })
        
        return jsonify({
            'success': True,
            'limit': limit,
            'top_prospects': rookie_data
        })
    except Exception as e:
        return jsonify({'error': f'Failed to get top prospects: {str(e)}'}), 500

@rookie_db_bp.route('/api/rookies/vorp-format', methods=['GET'])
def get_rookies_vorp_format():
    """Get rookies in VORP-compatible format for rankings integration"""
    try:
        format_type = request.args.get('format', 'dynasty')
        rookies = get_all_rookies_for_vorp(format_type)
        
        return jsonify({
            'success': True,
            'format_type': format_type,
            'total_rookies': len(rookies),
            'rookies': rookies,
            'integration_note': 'Ready for VORP calculator integration'
        })
    except Exception as e:
        return jsonify({'error': f'Failed to get VORP format: {str(e)}'}), 500

@rookie_db_bp.route('/api/rookies/add', methods=['POST'])
def add_rookie():
    """Add new rookie to database"""
    try:
        rookie_data = request.get_json()
        
        if not rookie_data:
            return jsonify({'error': 'No rookie data provided'}), 400
        
        # Validate required fields
        required_fields = ['player_name', 'position', 'star_rating', 'dynasty_tier', 'rookie_flag']
        for field in required_fields:
            if field not in rookie_data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        success = rookie_db.add_rookie(rookie_data)
        
        if success:
            return jsonify({
                'success': True,
                'message': f"Added rookie: {rookie_data['player_name']}",
                'rookie_data': rookie_data
            })
        else:
            return jsonify({'error': 'Failed to add rookie to database'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Failed to add rookie: {str(e)}'}), 500

@rookie_db_bp.route('/api/rookies/search/<player_name>', methods=['GET'])
def search_rookie_by_name(player_name):
    """Search for specific rookie by name"""
    try:
        rookie = rookie_db.get_rookie_by_name(player_name)
        
        if not rookie:
            return jsonify({
                'success': False,
                'message': f'Rookie not found: {player_name}'
            }), 404
        
        rookie_data = {
            'player_name': rookie.player_name,
            'position': rookie.position,
            'nfl_team': rookie.nfl_team,
            'draft_capital': rookie.draft_capital,
            'college_stats': rookie.college_stats,
            'athleticism': rookie.athleticism,
            'context_notes': rookie.context_notes,
            'star_rating': rookie.star_rating,
            'dynasty_tier': rookie.dynasty_tier,
            'future_ceiling_summary': rookie.future_ceiling_summary
        }
        
        return jsonify({
            'success': True,
            'rookie': rookie_data
        })
        
    except Exception as e:
        return jsonify({'error': f'Search failed: {str(e)}'}), 500

# Integration endpoint for other modules
@rookie_db_bp.route('/api/rookies/integration/batch-assign-vorp', methods=['POST'])
def batch_assign_vorp_rookies():
    """
    Integration endpoint for VORP assignment to rookies.
    Compatible with existing blueprint architecture.
    """
    try:
        request_data = request.get_json()
        format_type = request_data.get('format_type', 'dynasty')
        
        # Get rookies in VORP format
        rookies = get_all_rookies_for_vorp(format_type)
        
        # Simulate VORP assignment (would integrate with actual VORP module)
        for rookie in rookies:
            # Add mock VORP calculation for demonstration
            base_vorp = rookie['projected_fpts'] * 0.8  # Conservative rookie VORP
            rookie['vorp_score'] = round(base_vorp, 1)
            rookie['tier'] = 'Rookie' if rookie['star_rating'] >= 4.0 else 'Deep Rookie'
        
        return jsonify({
            'success': True,
            'format_type': format_type,
            'rookies_processed': len(rookies),
            'rookies': rookies,
            'integration_status': 'VORP assignment complete'
        })
        
    except Exception as e:
        return jsonify({'error': f'VORP integration failed: {str(e)}'}), 500