#!/usr/bin/env python3
"""
On The Clock - Fantasy Football Analytics Platform
Flask-based modular application for VORP rankings and player analysis
"""

from flask import Flask, render_template, jsonify, request
import os
import sys
from tiber_scope import tiber_scope_middleware, log_access_attempt, validate_environment
from tiber_identity import get_tiber_identity, get_doctrine, validate_request_domain, get_founder_identity, get_tiber_context, get_public_declaration

# Add modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'modules'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'routes'))

# Import routes  
from routes.rankings import rankings_bp
from routes.trade import trade_bp
from routes.dynasty import dynasty_bp
from routes.regression import regression_bp

# Import modules for legacy endpoints
from modules.wr_ratings_processor import WRRatingsProcessor
from modules.rookie_database import RookieDatabase
from modules.vorp_calculator import VORPCalculator

from tiber_identity import boot_log

# Tiber Boot Sequence
boot_log()

# Lock to our system
validate_environment(domain="on-the-clock.app", context="fantasy_football")

app = Flask(__name__)

# Tiber Scope Security Middleware
@app.before_request
def apply_tiber_scope():
    """Apply Tiber scope boundaries to all requests"""
    try:
        # Get request domain (fallback to localhost for development)
        domain = request.headers.get('Host', 'localhost').split(':')[0]
        
        # Default to fantasy_football context for all app requests
        context = "fantasy_football"
        
        # Apply Tiber scope validation
        tiber_scope_middleware(domain, context)
        
    except PermissionError as e:
        return jsonify({
            'error': 'Access Denied',
            'message': str(e),
            'tiber_scope': 'VIOLATION'
        }), 403

# Register blueprints
app.register_blueprint(rankings_bp)
app.register_blueprint(trade_bp)
app.register_blueprint(dynasty_bp)
app.register_blueprint(regression_bp)

# Import and register rookie blueprint with unique name
try:
    from routes.rookie import rookie_bp
    app.register_blueprint(rookie_bp, name='rookie_watch_bp')
    print("✅ Rookie Blueprint registered successfully")
except Exception as e:
    print(f"❌ Rookie Blueprint registration failed: {e}")

# Import and register VORP deltas blueprint
try:
    from routes.vorp_deltas import vorp_bp
    app.register_blueprint(vorp_bp)
    print("✅ VORP Deltas Blueprint registered successfully")
except Exception as e:
    print(f"❌ VORP Deltas Blueprint registration failed: {e}")

# Import and register rookie TE insulation blueprint
try:
    from routes.rookie_te_insulation import rookie_te_bp
    app.register_blueprint(rookie_te_bp)
    print("✅ Rookie TE Insulation Blueprint registered successfully")
except Exception as e:
    print(f"❌ Rookie TE Insulation Blueprint registration failed: {e}")

# Import and register rookie pipeline blueprints
try:
    from routes.rookie_rankings import rookie_rankings_bp
    app.register_blueprint(rookie_rankings_bp)
    print("✅ Rookie Rankings Blueprint registered successfully")
except Exception as e:
    print(f"❌ Rookie Rankings Blueprint registration failed: {e}")

try:
    from routes.draft_room import draft_room_bp
    app.register_blueprint(draft_room_bp)
    print("✅ Draft Room Blueprint registered successfully")
except Exception as e:
    print(f"❌ Draft Room Blueprint registration failed: {e}")

try:
    from routes.future_rookies import future_rookies_bp
    app.register_blueprint(future_rookies_bp)
    print("✅ Future Rookies Blueprint registered successfully")
except Exception as e:
    print(f"❌ Future Rookies Blueprint registration failed: {e}")

try:
    from routes.enhanced_rookie_evaluation import enhanced_rookie_bp
    from routes.target_competition_routes import register_target_competition_routes
    from routes.tcip_routes import register_tcip_routes
    from routes.target_competition_context_routes import register_target_competition_context_routes
    from routes.target_competition_generator_routes import register_target_competition_generator_routes
    from routes.target_competition_2025_routes import register_target_competition_2025_routes
    from routes.roster_shift_routes import register_roster_shift_routes
    from routes.player_usage_context_routes import register_player_usage_context_routes
    app.register_blueprint(enhanced_rookie_bp)
    register_target_competition_routes(app)
    register_tcip_routes(app)
    register_target_competition_context_routes(app)
    register_target_competition_generator_routes(app)
    register_target_competition_2025_routes(app)
    register_roster_shift_routes(app)
    register_player_usage_context_routes(app)
    print("✅ Enhanced Rookie Evaluation Blueprint registered successfully")
    print("✅ Target Competition Evaluator v1.0 Blueprint registered successfully")
    print("✅ TCIP (Target Competition Inference Pipeline) v1.0 Blueprint registered successfully")
    print("✅ Target Competition Context Module v1.0 Blueprint registered successfully")
    print("✅ Target Competition Context Generator v1.0 Blueprint registered successfully")
    print("✅ Target Competition 2025 Class Blueprint registered successfully")
    print("✅ Roster Shift Listener v1.0 Blueprint registered successfully")
    print("✅ Player Usage Context Module Blueprint registered successfully")
except Exception as e:
    print(f"❌ Enhanced Rookie Evaluation Blueprint registration failed: {e}")

# Initialize core modules for legacy endpoints
wr_processor = WRRatingsProcessor()
rookie_db = RookieDatabase()
vorp_calc = VORPCalculator()

@app.route('/')
def home():
    """Main homepage"""
    return render_template('index.html')

@app.route('/target-competition-2025')
def target_competition_2025():
    """Target Competition 2025 Class page"""
    return render_template('target_competition_2025.html')

@app.route('/roster-moves')
def roster_moves():
    """NFL Roster Moves page"""
    return render_template('roster_moves.html')

@app.route('/2025-tier-view')
def tier_view_2025():
    """2025 Dynasty Tier View page"""
    return render_template('tier_view_2025.html')

@app.route('/api/tiber/identity')
def tiber_identity_status():
    """Tiber identity and system status endpoint"""
    identity = get_tiber_identity()
    doctrine = get_doctrine()
    founder = get_founder_identity(public=True)  # Use public name
    context = get_tiber_context()
    declaration = get_public_declaration()
    
    return jsonify({
        'success': True,
        'tiber_identity': identity,
        'doctrine': doctrine,
        'founder': founder,
        'context': context,
        'public_declaration': declaration,
        'ecosystem_status': 'OPERATIONAL',
        'security_boundaries': 'ACTIVE',
        'alignment_protocol': 'ENGAGED'
    })

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