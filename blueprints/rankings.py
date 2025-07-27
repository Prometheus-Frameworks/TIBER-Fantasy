"""
Rankings Blueprint - Flask Blueprint for VORP Rankings
On The Clock Fantasy Football Analytics Platform

Handles all ranking-related routes with modular Flask Blueprint architecture.
"""

from flask import Blueprint, render_template, request, jsonify
import sys
import os

# Add modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'modules'))

from modules.vorp_engine import batch_assign_vorp, batch_assign_vorp_with_age, load_sample_players, get_positional_baselines, filter_players_by_position

rankings_bp = Blueprint("rankings", __name__)


def load_players():
    """
    Load player data for rankings.
    In production, this would connect to your database or data source.
    """
    return load_sample_players()


@rankings_bp.route("/rankings")
def show_rankings():
    """Main rankings page with VORP calculations"""
    # Get query parameters
    mode = request.args.get('mode', 'redraft')
    position = request.args.get('position', 'all')
    format_type = request.args.get('format', 'standard')
    
    # Load player data
    player_list = load_players()
    
    # Get format-specific baselines
    positional_baselines = get_positional_baselines(format_type)
    
    # Apply VORP calculations based on mode
    if mode == 'dynasty':
        player_list = batch_assign_vorp_with_age(player_list, positional_baselines)
    else:
        player_list = batch_assign_vorp(player_list, positional_baselines)
    
    # Filter by position if specified
    player_list = filter_players_by_position(player_list, position)
    
    # Sort by VORP descending
    sorted_list = sorted(player_list, key=lambda x: x.get("vorp", 0), reverse=True)
    
    return render_template("rankings.html", 
                         players=sorted_list,
                         mode=mode,
                         position=position,
                         format=format_type)


@rankings_bp.route("/api/rankings")
def api_rankings():
    """JSON API endpoint for rankings data"""
    # Get query parameters
    mode = request.args.get('mode', 'redraft')
    position = request.args.get('position', 'all')
    format_type = request.args.get('format', 'standard')
    
    try:
        # Load player data
        player_list = load_players()
        
        # Get format-specific baselines
        positional_baselines = get_positional_baselines(format_type)
        
        # Apply VORP calculations based on mode
        if mode == 'dynasty':
            player_list = batch_assign_vorp_with_age(player_list, positional_baselines)
        else:
            player_list = batch_assign_vorp(player_list, positional_baselines)
        
        # Filter by position if specified
        player_list = filter_players_by_position(player_list, position)
        
        # Sort by VORP descending
        sorted_list = sorted(player_list, key=lambda x: x.get("vorp", 0), reverse=True)
        
        return jsonify({
            'success': True,
            'data': sorted_list,
            'mode': mode,
            'position': position,
            'format': format_type,
            'total': len(sorted_list),
            'baselines': positional_baselines
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@rankings_bp.route("/api/rankings/tiers")
def api_ranking_tiers():
    """API endpoint for tier-based rankings breakdown"""
    # Get query parameters
    mode = request.args.get('mode', 'redraft')
    format_type = request.args.get('format', 'standard')
    
    try:
        # Load and process player data
        player_list = load_players()
        positional_baselines = get_positional_baselines(format_type)
        
        if mode == 'dynasty':
            player_list = batch_assign_vorp_with_age(player_list, positional_baselines)
        else:
            player_list = batch_assign_vorp(player_list, positional_baselines)
        
        # Sort by VORP
        sorted_list = sorted(player_list, key=lambda x: x.get("vorp", 0), reverse=True)
        
        # Organize into tiers
        tiers = {
            'Elite (80+)': [],
            'Premium (60-79)': [],
            'Solid (40-59)': [],
            'Depth (20-39)': [],
            'Replacement (0-19)': [],
            'Below Replacement (<0)': []
        }
        
        for player in sorted_list:
            vorp = player.get('vorp', 0)
            
            if vorp >= 80:
                tiers['Elite (80+)'].append(player)
            elif vorp >= 60:
                tiers['Premium (60-79)'].append(player)
            elif vorp >= 40:
                tiers['Solid (40-59)'].append(player)
            elif vorp >= 20:
                tiers['Depth (20-39)'].append(player)
            elif vorp >= 0:
                tiers['Replacement (0-19)'].append(player)
            else:
                tiers['Below Replacement (<0)'].append(player)
        
        return jsonify({
            'success': True,
            'tiers': tiers,
            'mode': mode,
            'format': format_type,
            'total_players': len(sorted_list)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@rankings_bp.route("/player/<player_name>")
def player_profile(player_name):
    """Individual player profile page"""
    # Get query parameters
    mode = request.args.get('mode', 'redraft')
    format_type = request.args.get('format', 'standard')
    
    # Load player data
    player_list = load_players()
    
    # Find the requested player
    player = None
    for p in player_list:
        if p['name'].lower().replace(' ', '-') == player_name.lower().replace('-', ' ') or \
           p['name'].lower() == player_name.lower().replace('-', ' '):
            player = p.copy()
            break
    
    if not player:
        return "Player not found", 404
    
    # Get format-specific baselines and calculate VORP
    positional_baselines = get_positional_baselines(format_type)
    
    if mode == 'dynasty':
        player_list_with_vorp = batch_assign_vorp_with_age([player], positional_baselines)
    else:
        player_list_with_vorp = batch_assign_vorp([player], positional_baselines)
    
    if player_list_with_vorp:
        player = player_list_with_vorp[0]
    
    # Calculate rank by processing all players
    all_players = load_players()
    if mode == 'dynasty':
        all_rankings = batch_assign_vorp_with_age(all_players, positional_baselines)
    else:
        all_rankings = batch_assign_vorp(all_players, positional_baselines)
    
    sorted_rankings = sorted(all_rankings, key=lambda x: x.get("vorp", 0), reverse=True)
    
    for i, p in enumerate(sorted_rankings, 1):
        if p['name'] == player['name']:
            player['rank'] = i
            break
    
    # Add analysis based on VORP score
    vorp = player.get('vorp', 0)
    if vorp >= 80:
        player['analysis'] = f"<p><strong>{player['name']}</strong> is an elite fantasy asset with exceptional value over replacement. This level of VORP indicates a player who should be prioritized in all draft formats.</p>"
    elif vorp >= 60:
        player['analysis'] = f"<p><strong>{player['name']}</strong> provides premium value with strong weekly consistency. Players in this tier offer excellent risk-adjusted returns.</p>"
    elif vorp >= 40:
        player['analysis'] = f"<p><strong>{player['name']}</strong> is a solid fantasy starter with reliable production. This VORP level suggests consistent weekly contributions.</p>"
    elif vorp >= 20:
        player['analysis'] = f"<p><strong>{player['name']}</strong> provides quality depth with streaming upside. Consider as a bench asset with spot-start potential.</p>"
    else:
        player['analysis'] = f"<p><strong>{player['name']}</strong> is at or below replacement level. Limited fantasy value except in deep leagues or emergency situations.</p>"
    
    return render_template('player_profile.html', 
                         player=player, 
                         mode=mode, 
                         format=format_type)