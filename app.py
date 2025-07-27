#!/usr/bin/env python3
"""
On The Clock - Fantasy Football Analytics Platform
Flask-based modular application for VORP rankings and player analysis
"""

from flask import Flask, render_template, jsonify, request
import os
import sys

# Add modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'modules'))

from modules.rankings_engine import RankingsEngine
from modules.wr_ratings_processor import WRRatingsProcessor
from modules.rookie_database import RookieDatabase
from modules.vorp_calculator import VORPCalculator

app = Flask(__name__)

# Initialize core modules
rankings_engine = RankingsEngine()
wr_processor = WRRatingsProcessor()
rookie_db = RookieDatabase()
vorp_calc = VORPCalculator()

@app.route('/')
def home():
    """Main homepage"""
    return render_template('index.html')

@app.route('/rankings')
def rankings():
    """Rankings page with VORP calculations"""
    # Get query parameters
    mode = request.args.get('mode', 'redraft')
    position = request.args.get('position', 'all')
    format_type = request.args.get('format', 'standard')
    
    # Sample player data for demonstration
    sample_players = [
        {'name': 'Josh Allen', 'position': 'QB', 'team': 'BUF', 'projected_points': 285.5, 'age': 28},
        {'name': 'Christian McCaffrey', 'position': 'RB', 'team': 'SF', 'projected_points': 245.2, 'age': 28},
        {'name': 'Justin Jefferson', 'position': 'WR', 'team': 'MIN', 'projected_points': 220.8, 'age': 25},
        {'name': 'Travis Kelce', 'position': 'TE', 'team': 'KC', 'projected_points': 185.3, 'age': 35},
        {'name': 'Lamar Jackson', 'position': 'QB', 'team': 'BAL', 'projected_points': 275.0, 'age': 27},
        {'name': 'Tyreek Hill', 'position': 'WR', 'team': 'MIA', 'projected_points': 210.5, 'age': 30},
        {'name': 'Derrick Henry', 'position': 'RB', 'team': 'BAL', 'projected_points': 195.0, 'age': 31},
        {'name': 'Davante Adams', 'position': 'WR', 'team': 'LV', 'projected_points': 200.0, 'age': 32}
    ]
    
    # Generate rankings using the engine
    ranked_players = rankings_engine.generate_rankings(
        sample_players, mode, position, format_type
    )
    
    return render_template('rankings.html', 
                         players=ranked_players,
                         mode=mode,
                         position=position,
                         format=format_type)

@app.route('/api/rankings')
def api_rankings():
    """API endpoint for player rankings"""
    mode = request.args.get('mode', 'redraft')  # redraft or dynasty
    position = request.args.get('position', 'all')  # QB, RB, WR, TE, or all
    format_type = request.args.get('format', 'standard')  # standard, ppr, superflex
    
    # Sample data - in production this would come from your data source
    sample_players = [
        {'name': 'Josh Allen', 'position': 'QB', 'team': 'BUF', 'projected_points': 285.5, 'age': 28},
        {'name': 'Christian McCaffrey', 'position': 'RB', 'team': 'SF', 'projected_points': 245.2, 'age': 28},
        {'name': 'Justin Jefferson', 'position': 'WR', 'team': 'MIN', 'projected_points': 220.8, 'age': 25},
        {'name': 'Travis Kelce', 'position': 'TE', 'team': 'KC', 'projected_points': 185.3, 'age': 35},
        {'name': 'Lamar Jackson', 'position': 'QB', 'team': 'BAL', 'projected_points': 275.0, 'age': 27},
        {'name': 'Tyreek Hill', 'position': 'WR', 'team': 'MIA', 'projected_points': 210.5, 'age': 30},
        {'name': 'Derrick Henry', 'position': 'RB', 'team': 'BAL', 'projected_points': 195.0, 'age': 31},
        {'name': 'Davante Adams', 'position': 'WR', 'team': 'LV', 'projected_points': 200.0, 'age': 32}
    ]
    
    try:
        rankings = rankings_engine.generate_rankings(
            sample_players, mode, position, format_type
        )
        
        return jsonify({
            'success': True,
            'data': rankings,
            'mode': mode,
            'position': position,
            'format': format_type,
            'total': len(rankings)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/player/<player_name>')
def player_profile(player_name):
    """Individual player profile page"""
    # Sample data - in production this would query your player database
    sample_players = [
        {'name': 'Josh Allen', 'position': 'QB', 'team': 'BUF', 'projected_points': 285.5, 'age': 28},
        {'name': 'Christian McCaffrey', 'position': 'RB', 'team': 'SF', 'projected_points': 245.2, 'age': 28},
        {'name': 'Justin Jefferson', 'position': 'WR', 'team': 'MIN', 'projected_points': 220.8, 'age': 25},
        {'name': 'Travis Kelce', 'position': 'TE', 'team': 'KC', 'projected_points': 185.3, 'age': 35},
        {'name': 'Lamar Jackson', 'position': 'QB', 'team': 'BAL', 'projected_points': 275.0, 'age': 27},
        {'name': 'Tyreek Hill', 'position': 'WR', 'team': 'MIA', 'projected_points': 210.5, 'age': 30},
        {'name': 'Derrick Henry', 'position': 'RB', 'team': 'BAL', 'projected_points': 195.0, 'age': 31},
        {'name': 'Davante Adams', 'position': 'WR', 'team': 'LV', 'projected_points': 200.0, 'age': 32}
    ]
    
    # Find the requested player
    player = None
    for p in sample_players:
        if p['name'].lower().replace(' ', '-') == player_name.lower().replace('-', ' ') or \
           p['name'].lower() == player_name.lower().replace('-', ' '):
            player = p.copy()
            break
    
    if not player:
        return "Player not found", 404
    
    # Get query parameters for VORP calculation
    mode = request.args.get('mode', 'redraft')
    format_type = request.args.get('format', 'standard')
    
    # Calculate VORP for this player
    ranked_players = rankings_engine.generate_rankings([player], mode, 'all', format_type)
    if ranked_players:
        player = ranked_players[0]
    
    # Add rank information by calculating full rankings
    all_rankings = rankings_engine.generate_rankings(sample_players, mode, 'all', format_type)
    for i, p in enumerate(all_rankings, 1):
        if p['name'] == player['name']:
            player['rank'] = i
            break
    
    # Add analysis based on VORP score
    if player['vorp'] >= 80:
        player['analysis'] = f"<p><strong>{player['name']}</strong> is an elite fantasy asset with exceptional value over replacement. This level of VORP indicates a player who should be prioritized in all draft formats.</p>"
    elif player['vorp'] >= 60:
        player['analysis'] = f"<p><strong>{player['name']}</strong> provides premium value with strong weekly consistency. Players in this tier offer excellent risk-adjusted returns.</p>"
    elif player['vorp'] >= 40:
        player['analysis'] = f"<p><strong>{player['name']}</strong> is a solid fantasy starter with reliable production. This VORP level suggests consistent weekly contributions.</p>"
    elif player['vorp'] >= 20:
        player['analysis'] = f"<p><strong>{player['name']}</strong> provides quality depth with streaming upside. Consider as a bench asset with spot-start potential.</p>"
    else:
        player['analysis'] = f"<p><strong>{player['name']}</strong> is at or below replacement level. Limited fantasy value except in deep leagues or emergency situations.</p>"
    
    return render_template('player_profile.html', player=player, mode=mode, format=format_type)

@app.route('/api/wr-ratings')
def api_wr_ratings():
    """API endpoint for WR 2024 ratings from CSV"""
    try:
        ratings = wr_processor.get_wr_ratings()
        return jsonify({
            'success': True,
            'data': ratings,
            'count': len(ratings)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/rookies')
def api_rookies():
    """API endpoint for 2025 rookie database"""
    position = request.args.get('position', 'all')
    
    try:
        rookies = rookie_db.get_rookies(position=position)
        return jsonify({
            'success': True,
            'data': rookies,
            'count': len(rookies),
            'position_filter': position
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/vorp')
def api_vorp():
    """API endpoint for VORP calculations"""
    mode = request.args.get('mode', 'redraft')
    num_teams = int(request.args.get('num_teams', 12))
    
    try:
        vorp_data = vorp_calc.calculate_vorp(mode=mode, num_teams=num_teams)
        return jsonify({
            'success': True,
            'data': vorp_data,
            'mode': mode,
            'num_teams': num_teams
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health')
def health_check():
    """System health check"""
    return jsonify({
        'status': 'healthy',
        'modules': {
            'rankings_engine': 'loaded',
            'wr_processor': 'loaded',
            'rookie_database': 'loaded',
            'vorp_calculator': 'loaded'
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    print("🚀 Starting On The Clock Fantasy Platform")
    print(f"📊 Server running on port {port}")
    print(f"🔧 Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)