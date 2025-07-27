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
sys.path.append(os.path.join(os.path.dirname(__file__), 'routes'))

# Import routes  
from routes.rankings import rankings_bp

# Import modules for legacy endpoints
from modules.wr_ratings_processor import WRRatingsProcessor
from modules.rookie_database import RookieDatabase
from modules.vorp_calculator import VORPCalculator

app = Flask(__name__)

# Register blueprints
app.register_blueprint(rankings_bp)

# Initialize core modules for legacy endpoints
wr_processor = WRRatingsProcessor()
rookie_db = RookieDatabase()
vorp_calc = VORPCalculator()

@app.route('/')
def home():
    """Main homepage"""
    return render_template('index.html')

# Rankings routes now handled by rankings_bp blueprint

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
        vorp_data = vorp_calc.calculate(250, 'QB', 25)  # Sample VORP calculation
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