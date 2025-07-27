"""
Dynasty Routes - Flask Blueprint for Dynasty Analysis
On The Clock Fantasy Football Analytics Platform

Handles dynasty-specific analysis including decline detection and risk assessment.
"""

from flask import Blueprint, request, jsonify
from modules.vorp_engine import batch_assign_vorp
from modules.intake_module import get_all_players
import random

dynasty_bp = Blueprint('dynasty_bp', __name__)


def load_all_players():
    """
    Load all players with dynasty-specific risk metrics.
    
    Returns:
        List of players with injury_risk, insulation, and target_share_trend
    """
    players = get_all_players('dynasty')
    
    # Add dynasty-specific risk metrics
    for player in players:
        position = player['position']
        age = player.get('age', 25)
        
        # Calculate injury risk based on position and age
        base_injury_risk = {
            'QB': 0.1,
            'RB': 0.4,
            'WR': 0.25,
            'TE': 0.2
        }.get(position, 0.25)
        
        # Age factor for injury risk
        age_factor = max(0, (age - 25) * 0.05)
        player['injury_risk'] = min(1.0, base_injury_risk + age_factor)
        
        # Calculate insulation (team dependence)
        # Higher age = lower insulation, RBs have lower insulation
        base_insulation = {
            'QB': 0.7,
            'RB': 0.3,
            'WR': 0.6,
            'TE': 0.5
        }.get(position, 0.5)
        
        age_penalty = max(0, (age - 28) * 0.03)
        player['insulation'] = max(0.1, base_insulation - age_penalty)
        
        # Calculate target share trend (simulated based on age and position)
        if position in ['WR', 'TE']:
            if age < 26:
                player['target_share_trend'] = random.uniform(2, 8)  # Young players trending up
            elif age > 30:
                player['target_share_trend'] = random.uniform(-15, -5)  # Older players declining
            else:
                player['target_share_trend'] = random.uniform(-3, 5)  # Prime years stable
        else:
            player['target_share_trend'] = 0  # Not applicable for QB/RB
    
    return players


@dynasty_bp.route('/dynasty-decline', methods=['GET'])
def get_decline_flags():
    players = load_all_players()
    flagged = []

    for p in players:
        if p['injury_risk'] > 0.8 or p['insulation'] < 0.2 or p['target_share_trend'] < -10:
            p['red_flag'] = True
            flagged.append(p)

    return jsonify(flagged)


@dynasty_bp.route('/dynasty-analysis', methods=['GET'])
def get_dynasty_analysis():
    """Comprehensive dynasty analysis with risk categorization"""
    players = load_all_players()
    players_with_vorp = batch_assign_vorp(players, 'dynasty')
    
    # Categorize players by risk level
    analysis = {
        'high_risk': [],
        'medium_risk': [],
        'low_risk': [],
        'buy_candidates': [],
        'sell_candidates': []
    }
    
    for player in players_with_vorp:
        risk_score = (
            player['injury_risk'] * 0.4 +
            (1 - player['insulation']) * 0.3 +
            max(0, -player['target_share_trend'] / 20) * 0.3
        )
        
        player['risk_score'] = round(risk_score, 2)
        
        if risk_score > 0.7:
            analysis['high_risk'].append(player)
            analysis['sell_candidates'].append(player)
        elif risk_score > 0.4:
            analysis['medium_risk'].append(player)
        else:
            analysis['low_risk'].append(player)
            if player['age'] < 26:
                analysis['buy_candidates'].append(player)
    
    # Sort each category by VORP
    for category in analysis:
        analysis[category] = sorted(analysis[category], 
                                  key=lambda x: x.get('vorp', 0), 
                                  reverse=True)
    
    return jsonify({
        'analysis': analysis,
        'summary': {
            'total_players': len(players_with_vorp),
            'high_risk_count': len(analysis['high_risk']),
            'buy_candidates_count': len(analysis['buy_candidates']),
            'sell_candidates_count': len(analysis['sell_candidates'])
        }
    })


@dynasty_bp.route('/dynasty-rankings', methods=['GET'])
def get_dynasty_rankings():
    """Dynasty rankings with age-adjusted VORP"""
    position_filter = request.args.get('position', None)
    sort_by = request.args.get('sort_by', 'vorp')
    
    players = load_all_players()
    players_with_vorp = batch_assign_vorp(players, 'dynasty')
    
    # Apply dynasty age adjustments
    for player in players_with_vorp:
        age = player.get('age', 25)
        position = player['position']
        vorp = player.get('vorp', 0)
        
        # Age penalties for dynasty
        if position == 'RB' and age > 25:
            age_penalty = (age - 25) * 0.01  # 1% per year over 25
            player['dynasty_vorp'] = vorp * (1 - age_penalty)
        elif position == 'WR' and age > 28:
            age_penalty = (age - 28) * 0.01  # 1% per year over 28
            player['dynasty_vorp'] = vorp * (1 - age_penalty)
        elif position in ['QB', 'TE'] and age > 30:
            age_penalty = (age - 30) * 0.005  # 0.5% per year over 30
            player['dynasty_vorp'] = vorp * (1 - age_penalty)
        else:
            player['dynasty_vorp'] = vorp
        
        player['dynasty_vorp'] = round(player['dynasty_vorp'], 1)
    
    # Filter by position if specified
    if position_filter:
        players_with_vorp = [p for p in players_with_vorp 
                           if p['position'] == position_filter.upper()]
    
    # Sort by specified metric
    if sort_by == 'dynasty_vorp':
        sorted_players = sorted(players_with_vorp, 
                              key=lambda x: x.get('dynasty_vorp', 0), 
                              reverse=True)
    else:
        sorted_players = sorted(players_with_vorp, 
                              key=lambda x: x.get(sort_by, 0), 
                              reverse=True)
    
    return jsonify(sorted_players)


@dynasty_bp.route('/dynasty-profile/<player_name>', methods=['GET'])
def get_dynasty_profile(player_name):
    """Detailed dynasty profile for a specific player"""
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
    
    # Calculate dynasty metrics
    age = player.get('age', 25)
    position = player['position']
    
    # Dynasty outlook based on age and position
    if position == 'RB':
        if age < 24:
            outlook = 'Ascending - Prime years ahead'
        elif age < 27:
            outlook = 'Prime - Peak production window'
        elif age < 30:
            outlook = 'Declining - Consider selling'
        else:
            outlook = 'Fading - Limited dynasty value'
    elif position == 'WR':
        if age < 25:
            outlook = 'Ascending - Building toward peak'
        elif age < 29:
            outlook = 'Prime - Elite production window'
        elif age < 32:
            outlook = 'Stable - Veteran reliability'
        else:
            outlook = 'Declining - Age concerns mounting'
    elif position == 'QB':
        if age < 26:
            outlook = 'Developing - Future franchise player'
        elif age < 32:
            outlook = 'Prime - Dynasty cornerstone'
        elif age < 36:
            outlook = 'Veteran - Proven but aging'
        else:
            outlook = 'Fading - Replacement needed soon'
    else:  # TE
        if age < 26:
            outlook = 'Ascending - TE premium asset'
        elif age < 30:
            outlook = 'Prime - Positional advantage'
        elif age < 33:
            outlook = 'Stable - Reliable contributor'
        else:
            outlook = 'Declining - Position scarcity fading'
    
    player['dynasty_outlook'] = outlook
    
    # Risk assessment
    risk_factors = []
    if player['injury_risk'] > 0.6:
        risk_factors.append('High injury risk')
    if player['insulation'] < 0.3:
        risk_factors.append('Team dependent')
    if player['target_share_trend'] < -5:
        risk_factors.append('Declining usage')
    if age > 30 and position == 'RB':
        risk_factors.append('Age cliff approaching')
    
    player['risk_factors'] = risk_factors
    player['risk_level'] = 'High' if len(risk_factors) >= 2 else ('Medium' if risk_factors else 'Low')
    
    return jsonify(player)