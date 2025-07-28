#!/usr/bin/env python3
"""
Flask routes for Rookie Rankings Page
Dynamic sortable table displaying all rookies ranked by dynasty tier, star rating, and draft capital.
"""

from flask import Blueprint, request, jsonify, render_template
from modules.rookie_pipeline import get_rookie_pipeline
import json

# Create blueprint for rookie rankings
rookie_rankings_bp = Blueprint('rookie_rankings', __name__)

@rookie_rankings_bp.route('/api/rookie-rankings/all', methods=['GET'])
def get_all_rookie_rankings():
    """
    Get all rookies formatted for rankings display.
    Supports year, position, and sorting parameters.
    """
    try:
        pipeline = get_rookie_pipeline()
        
        # Get query parameters
        year = request.args.get('year', pipeline.current_year)
        position = request.args.get('position', None)
        sort_by = request.args.get('sort_by', 'tier_weight')
        include_notes = request.args.get('include_notes', 'false').lower() == 'true'
        include_ceiling = request.args.get('include_ceiling', 'false').lower() == 'true'
        
        # Poll for updates in dev mode
        updates = pipeline.poll_for_updates(dev_mode=True)
        
        # Get rookies for rankings
        rookies = pipeline.get_rookies_for_rankings(year=year, position=position)
        
        # Apply sorting
        if sort_by == 'star_rating':
            rookies.sort(key=lambda x: x['star_rating'], reverse=True)
        elif sort_by == 'draft_capital':
            rookies.sort(key=lambda x: pipeline._get_draft_capital_weight(x['draft_capital']), reverse=True)
        elif sort_by == 'dynasty_tier':
            # Sort by tier (Tier 1 = best)
            tier_order = {'Tier 1': 5, 'Tier 2': 4, 'Tier 3': 3, 'Tier 4': 2, 'Tier 5': 1}
            rookies.sort(key=lambda x: tier_order.get(x['dynasty_tier'], 0), reverse=True)
        elif sort_by == 'name':
            rookies.sort(key=lambda x: x['name'])
        # Default: tier_weight (already sorted)
        
        # Conditionally include optional fields
        for rookie in rookies:
            if not include_notes:
                rookie.pop('context_notes', None)
            if not include_ceiling:
                rookie.pop('ceiling_summary', None)
        
        response = {
            'success': True,
            'year': year,
            'position_filter': position,
            'sort_by': sort_by,
            'total_rookies': len(rookies),
            'rookies': rookies,
            'recent_updates': updates,
            'available_years': pipeline.get_all_available_years()
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({'error': f'Failed to get rookie rankings: {str(e)}'}), 500

@rookie_rankings_bp.route('/api/rookie-rankings/stats', methods=['GET'])
def get_rookie_rankings_stats():
    """Get comprehensive stats for rookie rankings page"""
    try:
        pipeline = get_rookie_pipeline()
        stats = pipeline.get_pipeline_stats()
        
        # Add ranking-specific stats
        current_rookies = pipeline.get_rookies_for_rankings()
        
        position_breakdown = {}
        tier_breakdown = {}
        
        for rookie in current_rookies:
            # Position breakdown
            pos = rookie['position']
            position_breakdown[pos] = position_breakdown.get(pos, 0) + 1
            
            # Tier breakdown
            tier = rookie['dynasty_tier']
            tier_breakdown[tier] = tier_breakdown.get(tier, 0) + 1
        
        stats['ranking_stats'] = {
            'position_breakdown': position_breakdown,
            'tier_breakdown': tier_breakdown,
            'top_prospect': current_rookies[0]['name'] if current_rookies else None,
            'avg_star_rating': round(sum(r['star_rating'] for r in current_rookies) / len(current_rookies), 2) if current_rookies else 0
        }
        
        return jsonify({
            'success': True,
            'stats': stats
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to get ranking stats: {str(e)}'}), 500

@rookie_rankings_bp.route('/api/rookie-rankings/position/<position>', methods=['GET'])
def get_rookies_by_position_rankings(position):
    """Get rookies filtered by position for rankings"""
    try:
        pipeline = get_rookie_pipeline()
        year = request.args.get('year', pipeline.current_year)
        
        rookies = pipeline.get_rookies_for_rankings(year=year, position=position.upper())
        
        return jsonify({
            'success': True,
            'position': position.upper(),
            'year': year,
            'total_rookies': len(rookies),
            'rookies': rookies
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to get {position} rankings: {str(e)}'}), 500

@rookie_rankings_bp.route('/api/rookie-rankings/tiers', methods=['GET'])
def get_rookie_tier_analysis():
    """Get comprehensive tier analysis for rankings display"""
    try:
        pipeline = get_rookie_pipeline()
        year = request.args.get('year', pipeline.current_year)
        
        rookies = pipeline.get_rookies_for_rankings(year=year)
        
        # Group by tiers
        tier_groups = {}
        for rookie in rookies:
            tier = rookie['dynasty_tier']
            if tier not in tier_groups:
                tier_groups[tier] = []
            tier_groups[tier].append(rookie)
        
        # Calculate tier stats
        tier_analysis = {}
        for tier, tier_rookies in tier_groups.items():
            tier_analysis[tier] = {
                'count': len(tier_rookies),
                'avg_star_rating': round(sum(r['star_rating'] for r in tier_rookies) / len(tier_rookies), 2),
                'top_prospect': max(tier_rookies, key=lambda x: x['tier_weight'])['name'],
                'positions': list(set(r['position'] for r in tier_rookies)),
                'rookies': tier_rookies
            }
        
        return jsonify({
            'success': True,
            'year': year,
            'tier_analysis': tier_analysis,
            'total_tiers': len(tier_groups)
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to get tier analysis: {str(e)}'}), 500

@rookie_rankings_bp.route('/api/rookie-rankings/compare-years', methods=['GET'])
def compare_rookie_years():
    """Compare rookies across different years"""
    try:
        pipeline = get_rookie_pipeline()
        available_years = pipeline.get_all_available_years()
        
        comparison = {}
        
        for year in available_years:
            rookies = pipeline.get_rookies_for_rankings(year=year)
            
            if rookies:
                comparison[year] = {
                    'total_rookies': len(rookies),
                    'avg_star_rating': round(sum(r['star_rating'] for r in rookies) / len(rookies), 2),
                    'top_prospect': rookies[0]['name'],
                    'tier_1_count': len([r for r in rookies if r['dynasty_tier'] == 'Tier 1']),
                    'positions': list(set(r['position'] for r in rookies))
                }
        
        return jsonify({
            'success': True,
            'year_comparison': comparison,
            'available_years': available_years
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to compare years: {str(e)}'}), 500

@rookie_rankings_bp.route('/api/rookie-rankings/live-updates', methods=['GET'])
def get_live_updates():
    """Check for live file updates (dev mode polling)"""
    try:
        pipeline = get_rookie_pipeline()
        updates = pipeline.poll_for_updates(dev_mode=True)
        
        return jsonify({
            'success': True,
            'updates_found': len(updates) > 0,
            'updated_files': updates,
            'timestamp': pipeline.get_pipeline_stats()['last_update']
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to check updates: {str(e)}'}), 500

# HTML page route
@rookie_rankings_bp.route('/rookie-rankings')
def rookie_rankings_page():
    """Serve the rookie rankings HTML page"""
    try:
        pipeline = get_rookie_pipeline()
        stats = pipeline.get_pipeline_stats()
        
        return render_template('rookie_rankings.html', 
                             available_years=stats['available_years'],
                             current_year=pipeline.current_year)
    except Exception as e:
        return f"Error loading rookie rankings page: {str(e)}", 500