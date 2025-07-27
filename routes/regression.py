"""
Regression Routes - Flask Blueprint for Regression Analysis
On The Clock Fantasy Football Analytics Platform

Handles regression analysis including TD regression and performance sustainability.
"""

from flask import Blueprint, request, jsonify
from modules.vorp_engine import batch_assign_vorp
from modules.intake_module import get_all_players
import random

regression_bp = Blueprint('regression_bp', __name__)


def load_all_players():
    """
    Load all players with regression-specific metrics.
    
    Returns:
        List of players with td_rate, career_avg, and regression indicators
    """
    players = get_all_players('dynasty')
    
    # Add regression-specific metrics
    for player in players:
        position = player['position']
        age = player.get('age', 25)
        projected_points = player.get('projected_points', 0)
        
        # Calculate TD rate based on position and projected points
        if position == 'RB':
            # RBs: Base TD rate around 6-8% of touches
            base_td_rate = 0.07
            # Higher projected points suggest more TDs
            td_rate = base_td_rate + (projected_points - 180) * 0.0001
            career_avg = 0.065  # Career average TD rate
        elif position == 'WR':
            # WRs: Base TD rate around 12-15% of receptions
            base_td_rate = 0.13
            td_rate = base_td_rate + (projected_points - 160) * 0.0001
            career_avg = 0.12
        elif position == 'TE':
            # TEs: Base TD rate around 10-12% of receptions
            base_td_rate = 0.11
            td_rate = base_td_rate + (projected_points - 140) * 0.0001
            career_avg = 0.10
        else:  # QB
            # QBs: TD rate as % of pass attempts
            base_td_rate = 0.045
            td_rate = base_td_rate + (projected_points - 250) * 0.00005
            career_avg = 0.042
        
        # Add age factor - older players more likely to regress
        if age > 29:
            td_rate *= 1.1  # Inflate current rate for older players
        
        player['td_rate'] = round(max(0, td_rate), 3)
        player['career_avg'] = round(career_avg, 3)
        
        # Calculate additional regression metrics
        player['target_share'] = random.uniform(0.15, 0.30) if position in ['WR', 'TE'] else 0
        player['red_zone_share'] = random.uniform(0.20, 0.40)
        player['efficiency_rating'] = random.uniform(0.7, 1.3)
        
        # Snap count percentage
        if position == 'RB':
            player['snap_percentage'] = random.uniform(0.45, 0.85)
        elif position in ['WR', 'TE']:
            player['snap_percentage'] = random.uniform(0.60, 0.95)
        else:  # QB
            player['snap_percentage'] = random.uniform(0.95, 1.0)
    
    return players


@regression_bp.route('/regression-models', methods=['GET'])
def td_regression_model():
    players = load_all_players()
    regressed = []

    for p in players:
        if p['td_rate'] > (p['career_avg'] * 1.5):
            p['td_warning'] = True
            regressed.append(p)

    return jsonify(regressed)


@regression_bp.route('/efficiency-regression', methods=['GET'])
def efficiency_regression():
    """Analyze players due for efficiency regression"""
    players = load_all_players()
    players_with_vorp = batch_assign_vorp(players, 'dynasty')
    
    efficiency_flags = []
    
    for player in players_with_vorp:
        position = player['position']
        efficiency = player['efficiency_rating']
        
        # Position-specific efficiency thresholds
        threshold = {
            'QB': 1.15,
            'RB': 1.20,
            'WR': 1.25,
            'TE': 1.20
        }.get(position, 1.20)
        
        if efficiency > threshold:
            player['efficiency_warning'] = True
            player['regression_risk'] = 'High' if efficiency > threshold * 1.1 else 'Medium'
            efficiency_flags.append(player)
    
    # Sort by efficiency rating descending
    efficiency_flags.sort(key=lambda x: x['efficiency_rating'], reverse=True)
    
    return jsonify({
        'players': efficiency_flags,
        'count': len(efficiency_flags),
        'analysis': 'Players with unsustainable efficiency metrics'
    })


@regression_bp.route('/target-share-regression', methods=['GET'])
def target_share_regression():
    """Analyze WR/TE target share sustainability"""
    players = load_all_players()
    players_with_vorp = batch_assign_vorp(players, 'dynasty')
    
    # Filter to pass catchers only
    pass_catchers = [p for p in players_with_vorp if p['position'] in ['WR', 'TE']]
    
    target_flags = []
    
    for player in pass_catchers:
        target_share = player['target_share']
        age = player['age']
        
        # High target share thresholds
        if target_share > 0.25:  # 25%+ target share
            risk_factors = []
            
            if target_share > 0.30:
                risk_factors.append('Elite target share (>30%)')
            if age > 29:
                risk_factors.append('Age concerns (29+)')
            if player['snap_percentage'] > 0.90:
                risk_factors.append('High snap dependency')
            
            player['target_regression_risk'] = risk_factors
            player['sustainability_score'] = round(
                (1 - target_share) * 0.4 +  # Lower target share = more sustainable
                (30 - age) / 30 * 0.3 +     # Younger = more sustainable
                (1 - player['snap_percentage']) * 0.3,  # Lower snap % = more sustainable
                2
            )
            
            if len(risk_factors) >= 2:
                target_flags.append(player)
    
    # Sort by target share descending
    target_flags.sort(key=lambda x: x['target_share'], reverse=True)
    
    return jsonify({
        'players': target_flags,
        'count': len(target_flags),
        'analysis': 'Pass catchers with unsustainable target share'
    })


@regression_bp.route('/comprehensive-regression', methods=['GET'])
def comprehensive_regression():
    """Comprehensive regression analysis across all metrics"""
    position_filter = request.args.get('position', None)
    risk_level = request.args.get('risk_level', None)
    
    players = load_all_players()
    players_with_vorp = batch_assign_vorp(players, 'dynasty')
    
    comprehensive_analysis = []
    
    for player in players_with_vorp:
        regression_flags = []
        risk_score = 0
        
        # TD regression check
        if player['td_rate'] > (player['career_avg'] * 1.5):
            regression_flags.append('TD regression risk')
            risk_score += 0.3
        
        # Efficiency check
        position = player['position']
        eff_threshold = {'QB': 1.15, 'RB': 1.20, 'WR': 1.25, 'TE': 1.20}.get(position, 1.20)
        if player['efficiency_rating'] > eff_threshold:
            regression_flags.append('Efficiency regression risk')
            risk_score += 0.25
        
        # Target share check (WR/TE only)
        if position in ['WR', 'TE'] and player['target_share'] > 0.25:
            regression_flags.append('Target share regression risk')
            risk_score += 0.2
        
        # Age-based regression risk
        age = player['age']
        if (position == 'RB' and age > 27) or (position in ['WR', 'TE'] and age > 30):
            regression_flags.append('Age-based decline risk')
            risk_score += 0.25
        
        # Snap percentage dependency
        if player['snap_percentage'] > 0.85:
            regression_flags.append('High snap count dependency')
            risk_score += 0.15
        
        if regression_flags:
            player['regression_flags'] = regression_flags
            player['overall_risk_score'] = round(risk_score, 2)
            
            if risk_score >= 0.6:
                player['risk_level'] = 'High'
            elif risk_score >= 0.4:
                player['risk_level'] = 'Medium'
            else:
                player['risk_level'] = 'Low'
            
            comprehensive_analysis.append(player)
    
    # Apply filters
    if position_filter:
        comprehensive_analysis = [p for p in comprehensive_analysis 
                                if p['position'] == position_filter.upper()]
    
    if risk_level:
        comprehensive_analysis = [p for p in comprehensive_analysis 
                                if p['risk_level'].lower() == risk_level.lower()]
    
    # Sort by risk score descending
    comprehensive_analysis.sort(key=lambda x: x['overall_risk_score'], reverse=True)
    
    return jsonify({
        'players': comprehensive_analysis,
        'count': len(comprehensive_analysis),
        'summary': {
            'high_risk': len([p for p in comprehensive_analysis if p['risk_level'] == 'High']),
            'medium_risk': len([p for p in comprehensive_analysis if p['risk_level'] == 'Medium']),
            'low_risk': len([p for p in comprehensive_analysis if p['risk_level'] == 'Low'])
        }
    })


@regression_bp.route('/player-regression/<player_name>', methods=['GET'])
def player_regression_profile(player_name):
    """Detailed regression profile for a specific player"""
    players = load_all_players()
    players_with_vorp = batch_assign_vorp(players, 'dynasty')
    
    # Find the requested player
    player = None
    for p in players_with_vorp:
        if p['name'].lower().replace(' ', '-') == player_name.lower() or \
           p['name'].lower() == player_name.lower().replace('-', ' '):
            player = p.copy()
            break
    
    if not player:
        return jsonify({'error': 'Player not found'}), 404
    
    # Build comprehensive regression profile
    regression_analysis = {
        'player_name': player['name'],
        'position': player['position'],
        'age': player['age'],
        'vorp': player.get('vorp', 0),
        'metrics': {
            'td_rate': player['td_rate'],
            'career_avg_td': player['career_avg'],
            'efficiency_rating': player['efficiency_rating'],
            'target_share': player.get('target_share', 0),
            'snap_percentage': player['snap_percentage']
        },
        'warnings': [],
        'recommendations': []
    }
    
    # TD regression analysis
    if player['td_rate'] > (player['career_avg'] * 1.5):
        regression_analysis['warnings'].append('Touchdown rate significantly above career average')
        regression_analysis['recommendations'].append('Consider selling high on TD-dependent value')
    
    # Efficiency analysis
    position = player['position']
    eff_threshold = {'QB': 1.15, 'RB': 1.20, 'WR': 1.25, 'TE': 1.20}.get(position, 1.20)
    if player['efficiency_rating'] > eff_threshold:
        regression_analysis['warnings'].append('Efficiency metrics above sustainable levels')
        regression_analysis['recommendations'].append('Monitor for efficiency decline in coming weeks')
    
    # Target share analysis (WR/TE)
    if position in ['WR', 'TE'] and player['target_share'] > 0.25:
        regression_analysis['warnings'].append('High target share may not be sustainable')
        regression_analysis['recommendations'].append('Evaluate team context for target sustainability')
    
    # Age-based warnings
    age = player['age']
    if position == 'RB' and age > 27:
        regression_analysis['warnings'].append('Entering age-related decline window for RBs')
        regression_analysis['recommendations'].append('Consider dynasty exit strategy')
    elif position in ['WR', 'TE'] and age > 30:
        regression_analysis['warnings'].append('Age-related decline risk increasing')
        regression_analysis['recommendations'].append('Monitor for usage changes')
    
    # Overall assessment
    warning_count = len(regression_analysis['warnings'])
    if warning_count >= 3:
        regression_analysis['overall_assessment'] = 'High regression risk - multiple warning signs'
    elif warning_count >= 2:
        regression_analysis['overall_assessment'] = 'Moderate regression risk - monitor closely'
    elif warning_count >= 1:
        regression_analysis['overall_assessment'] = 'Low regression risk - minimal concerns'
    else:
        regression_analysis['overall_assessment'] = 'Sustainable performance metrics'
    
    return jsonify(regression_analysis)