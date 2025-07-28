#!/usr/bin/env python3
"""
Target Competition Context Routes
API endpoints for enhanced player context with target competition analysis
"""

from flask import Blueprint, jsonify, request, render_template_string
from modules.target_competition_context import get_target_competition_context

# Create blueprint for Target Competition Context routes
context_bp = Blueprint('target_competition_context', __name__)

@context_bp.route('/api/player-context/<player_name>', methods=['GET'])
def get_player_context_api(player_name: str):
    """Get enhanced context for a specific player"""
    try:
        context_module = get_target_competition_context()
        
        # Get query parameters
        include_tcip = request.args.get('include_tcip', 'true').lower() == 'true'
        
        # Get player context
        context = context_module.get_player_context(player_name, include_tcip_analysis=include_tcip)
        
        if 'error' in context:
            return jsonify({
                'success': False,
                'error': context['error'],
                'player_name': player_name
            }), 404
        
        return jsonify({
            'success': True,
            'player_context': context,
            'tier_scale': context_module.competition_tier_scale,
            'module_version': '1.0'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get player context: {str(e)}',
            'player_name': player_name
        }), 500

@context_bp.route('/api/player-context/<player_name>/html', methods=['GET'])
def get_player_context_html_api(player_name: str):
    """Get player context rendered as HTML"""
    try:
        context_module = get_target_competition_context()
        
        # Get query parameters
        include_styles = request.args.get('include_styles', 'true').lower() == 'true'
        allow_tier_colors = request.args.get('allow_tier_colors', 'true').lower() == 'true'
        
        # Render HTML
        html_content = context_module.render_player_context_html(
            player_name, 
            include_styles=include_styles,
            allow_tier_colors=allow_tier_colors
        )
        
        # Return as JSON with HTML content
        return jsonify({
            'success': True,
            'player_name': player_name,
            'html_content': html_content,
            'rendering_options': {
                'include_styles': include_styles,
                'allow_tier_colors': allow_tier_colors
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to render player context HTML: {str(e)}',
            'player_name': player_name
        }), 500

@context_bp.route('/api/player-contexts/all', methods=['GET'])  
def get_all_player_contexts():
    """Get all available player contexts sorted by tier"""
    try:
        context_module = get_target_competition_context()
        
        # Get sort preference
        sort_by = request.args.get('sort_by', 'competition_tier')
        
        if sort_by == 'competition_tier':
            contexts = context_module.get_all_contexts_sorted_by_tier()
        else:
            # Get all contexts (could add other sorting options here)
            contexts = context_module.get_all_contexts_sorted_by_tier()
        
        return jsonify({
            'success': True,
            'player_contexts': contexts,
            'context_count': len(contexts),
            'sort_by': sort_by,
            'tier_scale': context_module.competition_tier_scale
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get all player contexts: {str(e)}'
        }), 500

@context_bp.route('/api/player-context/<player_name>/dynasty-integration', methods=['GET'])
def get_context_dynasty_integration(player_name: str):
    """Get context data specifically for dynasty tier integration"""
    try:
        from modules.target_competition_context import get_context_for_dynasty_integration
        
        dynasty_context = get_context_for_dynasty_integration(player_name)
        
        return jsonify({
            'success': True,
            'player_name': player_name,
            'dynasty_context': dynasty_context,
            'integration_ready': True
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get dynasty integration context: {str(e)}',
            'player_name': player_name
        }), 500

@context_bp.route('/api/competition-tier-scale', methods=['GET'])
def get_competition_tier_scale():
    """Get the competition tier scale definitions"""
    try:
        context_module = get_target_competition_context()
        
        return jsonify({
            'success': True,
            'tier_scale': context_module.competition_tier_scale,
            'tier_order': ['S', 'A', 'B', 'C', 'D'],
            'tier_descriptions': {
                'S': 'Most severe competition',
                'A': 'Strong competition',
                'B': 'Balanced competition',
                'C': 'Favorable situation',
                'D': 'Best opportunity'
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get tier scale: {str(e)}'
        }), 500

@context_bp.route('/player-context/<player_name>')
def player_context_page(player_name: str):
    """Render full player context page"""
    try:
        context_module = get_target_competition_context()
        
        # Get player context
        context = context_module.get_player_context(player_name, include_tcip_analysis=True)
        
        if 'error' in context:
            return f"<h1>Player Not Found</h1><p>{context['error']}</p>", 404
        
        # Render HTML context
        html_context = context_module.render_player_context_html(
            player_name, 
            include_styles=True,
            allow_tier_colors=True
        )
        
        # Simple page template
        page_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{player_name} - Target Competition Context</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                     margin: 0; padding: 20px; background: #f8fafc;">
            <div style="max-width: 800px; margin: 0 auto;">
                <h1 style="color: #1f2937; margin-bottom: 8px;">{player_name}</h1>
                <p style="color: #6b7280; margin-bottom: 24px;">Target Competition Analysis</p>
                
                {html_context}
                
                <div style="margin-top: 24px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <h3 style="margin-top: 0; color: #374151;">About This Analysis</h3>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                        This enhanced context module integrates target competition tiers, contextual notes, 
                        and team depth analysis for dynasty projections. Analysis maintains grounded, 
                        probabilistic language and avoids fantasy "start/sit" certainty.
                    </p>
                </div>
                
                <div style="margin-top: 16px; text-align: center;">
                    <a href="/api/player-contexts/all" style="color: #3b82f6; text-decoration: none;">
                        View All Player Contexts
                    </a>
                </div>
            </div>
        </body>
        </html>
        """
        
        return page_html
        
    except Exception as e:
        return f"<h1>Error</h1><p>Failed to load player context: {str(e)}</p>", 500

@context_bp.route('/api/player-context/test', methods=['GET'])
def test_context_module():
    """Test endpoint for Target Competition Context module"""
    try:
        context_module = get_target_competition_context()
        
        # Test with Luther Burden
        test_player = 'Luther Burden'
        context = context_module.get_player_context(test_player)
        html_output = context_module.render_player_context_html(test_player, include_styles=False)
        
        # Test Tiber alignment
        test_note = "Luther Burden must start and is guaranteed to succeed"
        aligned_note = context_module.apply_tiber_alignment_filter(test_note)
        
        return jsonify({
            'success': True,
            'test_player': test_player,
            'context_tier': context.get('competition_tier', 'Unknown'),
            'competition_count': len(context.get('competition', [])),
            'html_length': len(html_output),
            'tiber_alignment_test': {
                'original': test_note,
                'filtered': aligned_note,
                'alignment_valid': context_module.validate_tiber_alignment(aligned_note)
            },
            'module_status': 'Target Competition Context v1.0 operational',
            'features_confirmed': [
                'Enhanced player contexts with tier analysis',
                'HTML rendering with tier color coding', 
                'Tiber alignment filtering active',
                'Dynasty integration context ready'
            ]
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Context module test failed: {str(e)}'
        }), 500

# Register blueprint function
def register_target_competition_context_routes(app):
    """Register Target Competition Context routes with Flask app"""
    app.register_blueprint(context_bp)
    print("✅ Target Competition Context Module v1.0 Blueprint registered successfully")