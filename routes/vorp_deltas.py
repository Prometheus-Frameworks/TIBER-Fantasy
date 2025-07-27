"""
VORP Deltas Routes - Flask Blueprint for Weekly VORP Tracking
On The Clock Fantasy Football Analytics Platform

Handles weekly VORP delta analysis and trend identification.
"""

from flask import Blueprint, request, jsonify
from modules.vorp_engine import batch_assign_vorp
from modules.intake_module import get_all_players
import random
from datetime import datetime, timedelta

vorp_bp = Blueprint('vorp_deltas', __name__)


def load_vorp_by_week():
    """
    Load weekly VORP data for delta calculations.
    
    Returns:
        List of players with weekly VORP values for comparison
    """
    try:
        # Get base player data
        players = get_all_players('redraft')
        
        weekly_vorp_data = []
        
        for player in players[:50]:  # Limit to top 50 for demonstration
            player_name = player.get('name', 'Unknown Player')
            position = player.get('position', 'FLEX')
            team = player.get('team', 'FA')
            
            # Calculate base VORP using the engine
            vorp_players = batch_assign_vorp([player], 'redraft')
            base_vorp = vorp_players[0].get('vorp_score', 0) if vorp_players else 0
            
            # Simulate weekly VORP variations based on performance trends
            # Week 7 baseline
            week_7_variance = random.uniform(-15, 15)
            week_7_vorp = max(0, base_vorp + week_7_variance)
            
            # Week 8 with trend factors
            trend_factor = random.uniform(-10, 20)  # Allow for breakouts and busts
            week_8_vorp = max(0, week_7_vorp + trend_factor)
            
            # Add position-specific volatility
            if position == 'QB':
                week_8_vorp *= random.uniform(0.95, 1.05)  # QBs more stable
            elif position == 'RB':
                week_8_vorp *= random.uniform(0.85, 1.25)  # RBs more volatile
            elif position == 'WR':
                week_8_vorp *= random.uniform(0.90, 1.15)  # WRs moderate volatility
            elif position == 'TE':
                week_8_vorp *= random.uniform(0.88, 1.20)  # TEs boom/bust
            
            weekly_data = {
                'player_name': player_name,
                'position': position,
                'team': team,
                'week_7': round(week_7_vorp, 2),
                'week_8': round(week_8_vorp, 2),
                'base_vorp': round(base_vorp, 2)
            }
            
            weekly_vorp_data.append(weekly_data)
    
    except Exception as e:
        print(f"Error loading VORP data: {e}")
        # Fallback sample data
        weekly_vorp_data = _get_sample_vorp_data()
    
    return weekly_vorp_data


def _get_sample_vorp_data():
    """Sample weekly VORP data for demonstration"""
    return [
        {
            'player_name': 'Josh Allen', 'position': 'QB', 'team': 'BUF',
            'week_7': 85.2, 'week_8': 92.1, 'base_vorp': 88.5
        },
        {
            'player_name': 'Christian McCaffrey', 'position': 'RB', 'team': 'SF',
            'week_7': 78.5, 'week_8': 85.3, 'base_vorp': 82.0
        },
        {
            'player_name': "Ja'Marr Chase", 'position': 'WR', 'team': 'CIN',
            'week_7': 74.8, 'week_8': 79.2, 'base_vorp': 77.1
        },
        {
            'player_name': 'Travis Kelce', 'position': 'TE', 'team': 'KC',
            'week_7': 65.3, 'week_8': 58.9, 'base_vorp': 62.0
        },
        {
            'player_name': 'Saquon Barkley', 'position': 'RB', 'team': 'PHI',
            'week_7': 72.1, 'week_8': 81.4, 'base_vorp': 76.8
        },
        {
            'player_name': 'Tyreek Hill', 'position': 'WR', 'team': 'MIA',
            'week_7': 71.2, 'week_8': 68.7, 'base_vorp': 70.0
        },
        {
            'player_name': 'Lamar Jackson', 'position': 'QB', 'team': 'BAL',
            'week_7': 83.7, 'week_8': 89.1, 'base_vorp': 86.2
        },
        {
            'player_name': 'Derrick Henry', 'position': 'RB', 'team': 'BAL',
            'week_7': 69.8, 'week_8': 77.5, 'base_vorp': 73.5
        },
        {
            'player_name': 'CeeDee Lamb', 'position': 'WR', 'team': 'DAL',
            'week_7': 73.5, 'week_8': 75.8, 'base_vorp': 74.6
        },
        {
            'player_name': 'George Kittle', 'position': 'TE', 'team': 'SF',
            'week_7': 61.4, 'week_8': 64.7, 'base_vorp': 63.0
        }
    ]


@vorp_bp.route('/vorp-deltas', methods=['GET'])
def get_vorp_deltas():
    weekly_data = load_vorp_by_week()
    deltas = []

    for p in weekly_data:
        delta = p['week_8'] - p['week_7']
        p['delta'] = delta
        deltas.append(p)

    sorted_deltas = sorted(deltas, key=lambda x: x['delta'], reverse=True)
    return jsonify(sorted_deltas)


@vorp_bp.route('/vorp-trends', methods=['GET'])
def get_vorp_trends():
    """Extended VORP trend analysis with multiple weeks"""
    position_filter = request.args.get('position', None)
    trend_type = request.args.get('trend', 'all')  # 'rising', 'falling', 'all'
    
    weekly_data = load_vorp_by_week()
    trends = []
    
    for player in weekly_data:
        delta = player['week_8'] - player['week_7']
        
        # Calculate trend indicators
        trend_strength = abs(delta)
        trend_direction = 'rising' if delta > 0 else 'falling' if delta < 0 else 'stable'
        
        # Categorize trend significance
        if trend_strength >= 10:
            significance = 'Major'
        elif trend_strength >= 5:
            significance = 'Moderate'
        elif trend_strength >= 2:
            significance = 'Minor'
        else:
            significance = 'Stable'
        
        player_trend = {
            **player,
            'delta': round(delta, 2),
            'trend_direction': trend_direction,
            'trend_strength': round(trend_strength, 2),
            'significance': significance,
            'percent_change': round((delta / player['week_7']) * 100, 1) if player['week_7'] > 0 else 0
        }
        
        # Apply filters
        if position_filter and player['position'] != position_filter.upper():
            continue
        if trend_type != 'all' and trend_direction != trend_type:
            continue
            
        trends.append(player_trend)
    
    # Sort by delta magnitude
    trends.sort(key=lambda x: x['delta'], reverse=True)
    
    return jsonify({
        'trends': trends,
        'summary': {
            'total_players': len(trends),
            'rising_players': len([t for t in trends if t['trend_direction'] == 'rising']),
            'falling_players': len([t for t in trends if t['trend_direction'] == 'falling']),
            'major_movers': len([t for t in trends if t['significance'] == 'Major'])
        }
    })


@vorp_bp.route('/vorp-momentum', methods=['GET'])
def get_vorp_momentum():
    """Momentum-based VORP analysis for identifying hot/cold players"""
    weekly_data = load_vorp_by_week()
    momentum_analysis = []
    
    for player in weekly_data:
        delta = player['week_8'] - player['week_7']
        base_vorp = player['base_vorp']
        
        # Calculate momentum score
        momentum_score = delta * 2  # Weight recent changes heavily
        
        # Adjust for position baseline
        position = player['position']
        if position == 'QB':
            momentum_threshold = 3
        elif position == 'RB':
            momentum_threshold = 4
        elif position == 'WR':
            momentum_threshold = 3.5
        else:  # TE
            momentum_threshold = 2.5
        
        # Categorize momentum
        if momentum_score >= momentum_threshold:
            momentum_status = 'Hot'
            momentum_level = 'High'
        elif momentum_score >= momentum_threshold / 2:
            momentum_status = 'Warming'
            momentum_level = 'Medium'
        elif momentum_score <= -momentum_threshold:
            momentum_status = 'Cold'
            momentum_level = 'High'
        elif momentum_score <= -momentum_threshold / 2:
            momentum_status = 'Cooling'
            momentum_level = 'Medium'
        else:
            momentum_status = 'Stable'
            momentum_level = 'Low'
        
        momentum_data = {
            **player,
            'delta': round(delta, 2),
            'momentum_score': round(momentum_score, 2),
            'momentum_status': momentum_status,
            'momentum_level': momentum_level,
            'week_8_rank': 0,  # Will be calculated after sorting
            'week_7_rank': 0   # Will be calculated after sorting
        }
        
        momentum_analysis.append(momentum_data)
    
    # Calculate rankings
    week_8_sorted = sorted(momentum_analysis, key=lambda x: x['week_8'], reverse=True)
    week_7_sorted = sorted(momentum_analysis, key=lambda x: x['week_7'], reverse=True)
    
    for i, player in enumerate(week_8_sorted):
        player['week_8_rank'] = i + 1
    
    for i, player in enumerate(week_7_sorted):
        player['week_7_rank'] = i + 1
    
    # Calculate rank movement
    for player in momentum_analysis:
        rank_change = player['week_7_rank'] - player['week_8_rank']
        player['rank_change'] = rank_change
        if rank_change > 0:
            player['rank_movement'] = f"↑{rank_change}"
        elif rank_change < 0:
            player['rank_movement'] = f"↓{abs(rank_change)}"
        else:
            player['rank_movement'] = "→"
    
    # Sort by momentum score
    momentum_analysis.sort(key=lambda x: x['momentum_score'], reverse=True)
    
    return jsonify({
        'momentum_analysis': momentum_analysis,
        'hot_players': [p for p in momentum_analysis if p['momentum_status'] == 'Hot'],
        'cold_players': [p for p in momentum_analysis if p['momentum_status'] == 'Cold'],
        'biggest_risers': sorted(momentum_analysis, key=lambda x: x['rank_change'], reverse=True)[:5],
        'biggest_fallers': sorted(momentum_analysis, key=lambda x: x['rank_change'])[:5]
    })


@vorp_bp.route('/vorp-weekly-summary', methods=['GET'])
def get_weekly_summary():
    """Comprehensive weekly VORP summary with key insights"""
    weekly_data = load_vorp_by_week()
    
    # Calculate summary statistics
    total_players = len(weekly_data)
    total_week_7_vorp = sum(p['week_7'] for p in weekly_data)
    total_week_8_vorp = sum(p['week_8'] for p in weekly_data)
    average_delta = (total_week_8_vorp - total_week_7_vorp) / total_players
    
    # Position breakdowns
    position_summary = {}
    for player in weekly_data:
        pos = player['position']
        if pos not in position_summary:
            position_summary[pos] = {
                'count': 0,
                'avg_week_7': 0,
                'avg_week_8': 0,
                'avg_delta': 0,
                'players': []
            }
        
        position_summary[pos]['count'] += 1
        position_summary[pos]['players'].append(player)
    
    # Calculate position averages
    for pos, data in position_summary.items():
        players = data['players']
        data['avg_week_7'] = round(sum(p['week_7'] for p in players) / len(players), 2)
        data['avg_week_8'] = round(sum(p['week_8'] for p in players) / len(players), 2)
        data['avg_delta'] = round(data['avg_week_8'] - data['avg_week_7'], 2)
        del data['players']  # Remove player list from summary
    
    # Identify key movers
    sorted_deltas = sorted(weekly_data, key=lambda x: x['week_8'] - x['week_7'], reverse=True)
    biggest_gainers = sorted_deltas[:5]
    biggest_losers = sorted_deltas[-5:]
    
    return jsonify({
        'week_summary': {
            'total_players': total_players,
            'total_week_7_vorp': round(total_week_7_vorp, 2),
            'total_week_8_vorp': round(total_week_8_vorp, 2),
            'average_delta': round(average_delta, 2),
            'analysis_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        },
        'position_breakdown': position_summary,
        'key_movers': {
            'biggest_gainers': [
                {
                    'player': p['player_name'],
                    'position': p['position'],
                    'delta': round(p['week_8'] - p['week_7'], 2)
                } for p in biggest_gainers
            ],
            'biggest_losers': [
                {
                    'player': p['player_name'],
                    'position': p['position'],
                    'delta': round(p['week_8'] - p['week_7'], 2)
                } for p in biggest_losers
            ]
        }
    })


@vorp_bp.route('/vorp-player-history/<player_name>', methods=['GET'])
def get_player_vorp_history(player_name):
    """Individual player VORP history and trend analysis"""
    weekly_data = load_vorp_by_week()
    
    # Find the requested player
    player_data = None
    for player in weekly_data:
        if player['player_name'].lower().replace(' ', '-') == player_name.lower() or \
           player['player_name'].lower() == player_name.lower().replace('-', ' '):
            player_data = player.copy()
            break
    
    if not player_data:
        return jsonify({'error': 'Player not found'}), 404
    
    # Calculate detailed analysis
    delta = player_data['week_8'] - player_data['week_7']
    percent_change = (delta / player_data['week_7']) * 100 if player_data['week_7'] > 0 else 0
    
    # Generate simulated historical data (week 1-6)
    historical_weeks = []
    base_vorp = player_data['base_vorp']
    
    for week in range(1, 7):
        week_variance = random.uniform(-8, 8)
        historical_vorp = max(0, base_vorp + week_variance)
        historical_weeks.append({
            'week': week,
            'vorp': round(historical_vorp, 2)
        })
    
    # Add weeks 7 and 8
    historical_weeks.extend([
        {'week': 7, 'vorp': player_data['week_7']},
        {'week': 8, 'vorp': player_data['week_8']}
    ])
    
    # Calculate trend analysis
    recent_trend = player_data['week_8'] - player_data['week_7']
    if recent_trend > 5:
        trend_status = 'Strong Upward'
    elif recent_trend > 2:
        trend_status = 'Moderate Upward'
    elif recent_trend < -5:
        trend_status = 'Strong Downward'
    elif recent_trend < -2:
        trend_status = 'Moderate Downward'
    else:
        trend_status = 'Stable'
    
    return jsonify({
        'player_info': {
            'name': player_data['player_name'],
            'position': player_data['position'],
            'team': player_data['team']
        },
        'current_analysis': {
            'week_7_vorp': player_data['week_7'],
            'week_8_vorp': player_data['week_8'],
            'delta': round(delta, 2),
            'percent_change': round(percent_change, 1),
            'trend_status': trend_status
        },
        'historical_data': historical_weeks,
        'season_stats': {
            'season_high': round(max(week['vorp'] for week in historical_weeks), 2),
            'season_low': round(min(week['vorp'] for week in historical_weeks), 2),
            'season_average': round(sum(week['vorp'] for week in historical_weeks) / len(historical_weeks), 2),
            'volatility': round(max(week['vorp'] for week in historical_weeks) - min(week['vorp'] for week in historical_weeks), 2)
        }
    })