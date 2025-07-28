#!/usr/bin/env python3
"""
Flask routes for Future Rookies UI Toggle
Handles toggling between current and future rookie classes via API endpoints.
"""

from flask import Blueprint, request, jsonify
from modules.future_rookies_toggle import get_future_rookies_toggle

# Create blueprint for future rookies toggle
future_rookies_bp = Blueprint('future_rookies', __name__)

@future_rookies_bp.route('/api/rookies/toggle/<year>', methods=['GET'])
def toggle_rookie_year(year):
    """Toggle to specific rookie year (current or future)"""
    try:
        toggle = get_future_rookies_toggle()
        position = request.args.get('position', None)
        
        result = toggle.toggle_rookie_class(year, position)
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'error': f'Toggle failed: {str(e)}'}), 500

@future_rookies_bp.route('/api/rookies/current', methods=['GET'])
def get_current_rookies():
    """Get current year rookies (2025)"""
    try:
        toggle = get_future_rookies_toggle()
        position = request.args.get('position', None)
        
        result = toggle.get_current_rookies(position)
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'error': f'Failed to get current rookies: {str(e)}'}), 500

@future_rookies_bp.route('/api/rookies/future', methods=['GET'])
def get_future_rookies():
    """Get future year rookies (2026+)"""
    try:
        toggle = get_future_rookies_toggle()
        year = request.args.get('year', None)
        position = request.args.get('position', None)
        
        result = toggle.get_future_rookies(year, position)
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'error': f'Failed to get future rookies: {str(e)}'}), 500

@future_rookies_bp.route('/api/rookies/available-years', methods=['GET'])
def get_available_years():
    """Get all available rookie years for toggle UI"""
    try:
        toggle = get_future_rookies_toggle()
        result = toggle.get_available_years()
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'error': f'Failed to get available years: {str(e)}'}), 500

@future_rookies_bp.route('/api/rookies/year-comparison', methods=['GET'])
def get_year_comparison():
    """Compare rookie classes across different years"""
    try:
        toggle = get_future_rookies_toggle()
        result = toggle.get_year_comparison()
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'error': f'Year comparison failed: {str(e)}'}), 500

@future_rookies_bp.route('/api/rookies/create-placeholder/<year>', methods=['POST'])
def create_future_placeholder(year):
    """Create placeholder structure for future rookie year"""
    try:
        toggle = get_future_rookies_toggle()
        result = toggle.create_future_year_placeholder(year)
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'error': f'Failed to create placeholder: {str(e)}'}), 500

@future_rookies_bp.route('/api/rookies/poll-updates', methods=['GET'])
def poll_rookie_updates():
    """Poll for updates across all rookie years (dev mode)"""
    try:
        toggle = get_future_rookies_toggle()
        
        # Re-scan for new years
        toggle._scan_available_years()
        toggle._initialize_future_databases()
        
        # Get current status
        years_info = toggle.get_available_years()
        
        # Check for updates in pipeline
        updates = toggle.pipeline.poll_for_updates(dev_mode=True)
        
        return jsonify({
            'success': True,
            'updates_found': len(updates) > 0,
            'updated_files': updates,
            'available_years': years_info.get('all_available_years', []),
            'poll_timestamp': toggle.pipeline.get_pipeline_stats()['last_update']
        })
        
    except Exception as e:
        return jsonify({'error': f'Polling failed: {str(e)}'}), 500