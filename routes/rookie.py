"""
Rookie Routes - Flask Blueprint for Rookie Analysis
On The Clock Fantasy Football Analytics Platform

Handles rookie-specific analysis including breakout detection and draft class evaluation.
"""

from flask import Blueprint, request, jsonify
from modules.vorp_engine import batch_assign_vorp
from modules.intake_module import get_all_players
try:
    from modules.rookie_database import RookieDatabase
    rookie_db = RookieDatabase()
except ImportError:
    rookie_db = None
import random

rookie_bp = Blueprint('rookie_analysis', __name__)


def load_rookie_class():
    """
    Load rookie class with breakout metrics.
    
    Returns:
        List of rookies with snap_share_proj, yds_per_route, and breakout indicators
    """
    try:
        # Try to load from consolidated rookie database
        if rookie_db:
            rookies = rookie_db.get_rookies()
        else:
            rookies = None
        
        if rookies:
            # Add projection metrics to database rookies
            for rookie in rookies:
                position = rookie.get('position', 'WR')
                
                # Calculate snap share projection based on draft capital and situation
                draft_round = rookie.get('draft_round', 3)
                base_snap_share = {
                    1: 0.75,  # 1st round
                    2: 0.65,  # 2nd round
                    3: 0.50,  # 3rd round
                    4: 0.40,  # 4th round
                    5: 0.30,  # 5th round
                    6: 0.25,  # 6th round
                    7: 0.20   # 7th round
                }.get(draft_round, 0.15)
                
                # Position adjustments
                if position == 'QB':
                    base_snap_share *= 0.8  # QBs less likely to start immediately
                elif position == 'RB':
                    base_snap_share *= 1.1  # RBs more likely to contribute early
                elif position == 'TE':
                    base_snap_share *= 0.9  # TEs take time to develop
                
                rookie['snap_share_proj'] = round(min(0.95, base_snap_share), 2)
                
                # Calculate yards per route projection
                if position in ['WR', 'TE']:
                    # Base on college production and draft capital
                    base_ypr = 1.4 + (6 - draft_round) * 0.1
                    rookie['yds_per_route'] = round(base_ypr + random.uniform(-0.3, 0.3), 2)
                else:
                    rookie['yds_per_route'] = 0  # Not applicable for QB/RB
                
                # Add breakout indicators
                rookie['target_share_proj'] = random.uniform(0.10, 0.25) if position in ['WR', 'TE'] else 0
                rookie['red_zone_opportunities'] = random.randint(8, 25)
                rookie['college_dominator'] = random.uniform(0.25, 0.45)
        else:
            # Fallback to sample rookie data
            rookies = _get_sample_rookies()
            
    except ImportError:
        # Fallback if rookie database module not available
        rookies = _get_sample_rookies()
    
    return rookies


def _get_sample_rookies():
    """Sample rookie data for demonstration"""
    return [
        {
            'name': 'Caleb Williams', 'position': 'QB', 'team': 'CHI', 'draft_round': 1,
            'snap_share_proj': 0.85, 'yds_per_route': 0, 'target_share_proj': 0,
            'red_zone_opportunities': 20, 'college_dominator': 0.35
        },
        {
            'name': 'Jayden Daniels', 'position': 'QB', 'team': 'WAS', 'draft_round': 1,
            'snap_share_proj': 0.80, 'yds_per_route': 0, 'target_share_proj': 0,
            'red_zone_opportunities': 18, 'college_dominator': 0.40
        },
        {
            'name': 'Marvin Harrison Jr', 'position': 'WR', 'team': 'ARI', 'draft_round': 1,
            'snap_share_proj': 0.75, 'yds_per_route': 2.1, 'target_share_proj': 0.22,
            'red_zone_opportunities': 15, 'college_dominator': 0.42
        },
        {
            'name': 'Rome Odunze', 'position': 'WR', 'team': 'CHI', 'draft_round': 1,
            'snap_share_proj': 0.65, 'yds_per_route': 1.9, 'target_share_proj': 0.18,
            'red_zone_opportunities': 12, 'college_dominator': 0.38
        },
        {
            'name': 'Malik Nabers', 'position': 'WR', 'team': 'NYG', 'draft_round': 1,
            'snap_share_proj': 0.70, 'yds_per_route': 2.0, 'target_share_proj': 0.20,
            'red_zone_opportunities': 14, 'college_dominator': 0.40
        },
        {
            'name': 'Brock Bowers', 'position': 'TE', 'team': 'LV', 'draft_round': 1,
            'snap_share_proj': 0.80, 'yds_per_route': 1.8, 'target_share_proj': 0.16,
            'red_zone_opportunities': 10, 'college_dominator': 0.35
        },
        {
            'name': 'Jonathon Brooks', 'position': 'RB', 'team': 'CAR', 'draft_round': 2,
            'snap_share_proj': 0.55, 'yds_per_route': 0, 'target_share_proj': 0,
            'red_zone_opportunities': 12, 'college_dominator': 0.30
        },
        {
            'name': 'Trey Benson', 'position': 'RB', 'team': 'ARI', 'draft_round': 3,
            'snap_share_proj': 0.45, 'yds_per_route': 0, 'target_share_proj': 0,
            'red_zone_opportunities': 8, 'college_dominator': 0.28
        }
    ]


@rookie_bp.route('/rookie-watch', methods=['GET'])
def rookie_breakouts():
    rookies = load_rookie_class()
    breakouts = []

    for r in rookies:
        if r['snap_share_proj'] > 0.6 and r['yds_per_route'] > 1.8:
            r['breakout_signal'] = True
            breakouts.append(r)

    return jsonify(breakouts)


@rookie_bp.route('/rookie-rankings', methods=['GET'])
def get_rookie_rankings():
    """Rookie rankings with projection-based scoring"""
    position_filter = request.args.get('position', None)
    format_type = request.args.get('format', 'dynasty')
    
    rookies = load_rookie_class()
    
    # Calculate rookie scores based on projections
    for rookie in rookies:
        position = rookie['position']
        snap_proj = rookie['snap_share_proj']
        
        # Base scoring by position
        if position == 'QB':
            base_score = snap_proj * 85 + rookie.get('red_zone_opportunities', 0) * 2
        elif position == 'RB':
            base_score = snap_proj * 75 + rookie.get('red_zone_opportunities', 0) * 3
        elif position == 'WR':
            ypr = rookie.get('yds_per_route', 0)
            base_score = snap_proj * 70 + ypr * 25 + rookie.get('target_share_proj', 0) * 150
        else:  # TE
            ypr = rookie.get('yds_per_route', 0)
            base_score = snap_proj * 65 + ypr * 20 + rookie.get('target_share_proj', 0) * 100
        
        # Draft capital bonus
        draft_round = rookie.get('draft_round', 4)
        draft_bonus = max(0, (5 - draft_round) * 5)
        
        rookie['rookie_score'] = round(base_score + draft_bonus, 1)
    
    # Filter by position if specified
    if position_filter:
        rookies = [r for r in rookies if r['position'] == position_filter.upper()]
    
    # Sort by rookie score
    sorted_rookies = sorted(rookies, key=lambda x: x['rookie_score'], reverse=True)
    
    return jsonify(sorted_rookies)


@rookie_bp.route('/rookie-comparison', methods=['GET'])
def rookie_comparison():
    """Compare rookies across multiple metrics"""
    rookies = load_rookie_class()
    
    comparison_data = {
        'by_position': {},
        'breakout_candidates': [],
        'sleeper_picks': [],
        'immediate_impact': []
    }
    
    # Group by position
    for rookie in rookies:
        position = rookie['position']
        if position not in comparison_data['by_position']:
            comparison_data['by_position'][position] = []
        comparison_data['by_position'][position].append(rookie)
    
    # Identify categories
    for rookie in rookies:
        position = rookie['position']
        snap_proj = rookie['snap_share_proj']
        
        # Breakout candidates (your exact criteria)
        if snap_proj > 0.6 and rookie.get('yds_per_route', 0) > 1.8:
            comparison_data['breakout_candidates'].append(rookie)
        
        # Sleeper picks (later round with good metrics)
        if rookie.get('draft_round', 4) >= 3 and snap_proj > 0.4:
            comparison_data['sleeper_picks'].append(rookie)
        
        # Immediate impact (high snap share projection)
        if snap_proj > 0.7:
            comparison_data['immediate_impact'].append(rookie)
    
    # Sort each category
    for category in ['breakout_candidates', 'sleeper_picks', 'immediate_impact']:
        comparison_data[category].sort(key=lambda x: x['snap_share_proj'], reverse=True)
    
    return jsonify(comparison_data)


@rookie_bp.route('/rookie-profile/<player_name>', methods=['GET'])
def rookie_profile(player_name):
    """Detailed rookie profile analysis"""
    rookies = load_rookie_class()
    
    # Find the requested rookie
    rookie = None
    for r in rookies:
        if r['name'].lower().replace(' ', '-') == player_name.lower() or \
           r['name'].lower() == player_name.lower().replace('-', ' '):
            rookie = r.copy()
            break
    
    if not rookie:
        return jsonify({'error': 'Rookie not found'}), 404
    
    position = rookie['position']
    
    # Build comprehensive profile
    profile = {
        'basic_info': {
            'name': rookie['name'],
            'position': position,
            'team': rookie['team'],
            'draft_round': rookie.get('draft_round', 'Undrafted')
        },
        'projections': {
            'snap_share': rookie['snap_share_proj'],
            'yards_per_route': rookie.get('yds_per_route', 0),
            'target_share': rookie.get('target_share_proj', 0),
            'red_zone_opps': rookie.get('red_zone_opportunities', 0)
        },
        'breakout_analysis': {},
        'dynasty_outlook': {},
        'risk_factors': []
    }
    
    # Breakout analysis
    snap_proj = rookie['snap_share_proj']
    ypr = rookie.get('yds_per_route', 0)
    
    if position in ['WR', 'TE']:
        if snap_proj > 0.6 and ypr > 1.8:
            profile['breakout_analysis']['status'] = 'High breakout potential'
            profile['breakout_analysis']['confidence'] = 'High'
        elif snap_proj > 0.5 and ypr > 1.5:
            profile['breakout_analysis']['status'] = 'Moderate breakout potential'
            profile['breakout_analysis']['confidence'] = 'Medium'
        else:
            profile['breakout_analysis']['status'] = 'Developmental prospect'
            profile['breakout_analysis']['confidence'] = 'Low'
    else:
        if snap_proj > 0.7:
            profile['breakout_analysis']['status'] = 'Immediate impact expected'
            profile['breakout_analysis']['confidence'] = 'High'
        elif snap_proj > 0.5:
            profile['breakout_analysis']['status'] = 'Solid contributor potential'
            profile['breakout_analysis']['confidence'] = 'Medium'
        else:
            profile['breakout_analysis']['status'] = 'Backup/developmental role'
            profile['breakout_analysis']['confidence'] = 'Low'
    
    # Dynasty outlook
    draft_round = rookie.get('draft_round', 4)
    if draft_round <= 2:
        profile['dynasty_outlook']['timeline'] = 'Year 1-2 impact expected'
        profile['dynasty_outlook']['ceiling'] = 'Elite potential'
    elif draft_round <= 4:
        profile['dynasty_outlook']['timeline'] = 'Year 2-3 development'
        profile['dynasty_outlook']['ceiling'] = 'Solid starter potential'
    else:
        profile['dynasty_outlook']['timeline'] = 'Long-term development'
        profile['dynasty_outlook']['ceiling'] = 'Depth/role player'
    
    # Risk factors
    if snap_proj < 0.4:
        profile['risk_factors'].append('Limited immediate opportunity')
    if position == 'RB' and rookie.get('college_dominator', 0) < 0.3:
        profile['risk_factors'].append('Modest college production')
    if position in ['WR', 'TE'] and ypr < 1.5:
        profile['risk_factors'].append('Efficiency concerns')
    if draft_round >= 5:
        profile['risk_factors'].append('Late draft capital')
    
    return jsonify(profile)


@rookie_bp.route('/rookie-draft-guide', methods=['GET'])
def rookie_draft_guide():
    """Dynasty rookie draft guide with tiers"""
    rookies = load_rookie_class()
    
    # Calculate comprehensive rookie scores
    for rookie in rookies:
        rookie['rookie_score'] = _calculate_rookie_score(rookie)
    
    # Sort by score
    sorted_rookies = sorted(rookies, key=lambda x: x['rookie_score'], reverse=True)
    
    # Create tiers
    tiers = {
        'Tier 1 (Elite)': [],
        'Tier 2 (High Upside)': [],
        'Tier 3 (Solid)': [],
        'Tier 4 (Developmental)': [],
        'Tier 5 (Deep Stash)': []
    }
    
    for i, rookie in enumerate(sorted_rookies):
        if i < 3:
            tiers['Tier 1 (Elite)'].append(rookie)
        elif i < 8:
            tiers['Tier 2 (High Upside)'].append(rookie)
        elif i < 15:
            tiers['Tier 3 (Solid)'].append(rookie)
        elif i < 25:
            tiers['Tier 4 (Developmental)'].append(rookie)
        else:
            tiers['Tier 5 (Deep Stash)'].append(rookie)
    
    return jsonify({
        'tiers': tiers,
        'total_rookies': len(sorted_rookies),
        'methodology': 'Scoring based on snap projection, efficiency metrics, draft capital, and positional value'
    })


def _calculate_rookie_score(rookie):
    """Calculate comprehensive rookie score"""
    position = rookie['position']
    snap_proj = rookie['snap_share_proj']
    draft_round = rookie.get('draft_round', 4)
    
    # Position-specific base scoring
    if position == 'QB':
        base_score = snap_proj * 80
    elif position == 'RB':
        base_score = snap_proj * 85
    elif position == 'WR':
        ypr = rookie.get('yds_per_route', 0)
        base_score = snap_proj * 75 + ypr * 20
    else:  # TE
        ypr = rookie.get('yds_per_route', 0)
        base_score = snap_proj * 70 + ypr * 15
    
    # Draft capital adjustment
    draft_bonus = max(0, (6 - draft_round) * 8)
    
    # Opportunity adjustment
    red_zone = rookie.get('red_zone_opportunities', 0)
    opportunity_bonus = red_zone * 1.5
    
    return round(base_score + draft_bonus + opportunity_bonus, 1)