"""
Trade Routes - Flask Blueprint for Trade Evaluation
On The Clock Fantasy Football Analytics Platform

Handles trade evaluation with VORP-based scoring.
"""

from flask import Blueprint, request, jsonify
from modules.vorp_engine import batch_assign_vorp
from modules.intake_module import get_all_players

trade_bp = Blueprint('trade_bp', __name__)


def evaluate_package(player_names, format_type='dynasty'):
    """
    Evaluate a package of players and return total VORP score.
    
    Args:
        player_names: List of player names
        format_type: Format for VORP calculation
        
    Returns:
        Total VORP score for the package
    """
    if not player_names:
        return 0
    
    # Get all players and calculate VORP
    all_players = get_all_players(format_type)
    players_with_vorp = batch_assign_vorp(all_players, format_type)
    
    # Find requested players and sum their VORP
    total_score = 0
    for name in player_names:
        for player in players_with_vorp:
            if player['name'].lower() == name.lower():
                total_score += player.get('vorp', 0)
                break
    
    return round(total_score, 1)


@trade_bp.route('/trade-eval', methods=['POST'])
def evaluate_trade():
    data = request.get_json()
    players_sent = data.get('players_sent', [])
    players_received = data.get('players_received', [])
    format_type = data.get('format', 'dynasty')

    score_sent = evaluate_package(players_sent, format_type)
    score_received = evaluate_package(players_received, format_type)

    verdict = "Fair" if abs(score_sent - score_received) < 10 else ("Overpay" if score_sent > score_received else "Underpay")

    return jsonify({
        "sent_score": score_sent,
        "received_score": score_received,
        "verdict": verdict,
        "format": format_type,
        "difference": round(abs(score_sent - score_received), 1)
    })


@trade_bp.route('/trade-eval/players', methods=['GET'])
def get_available_players():
    """Get list of available players for trade evaluation"""
    format_type = request.args.get('format', 'dynasty')
    position = request.args.get('position', None)
    
    players = get_all_players(format_type)
    players_with_vorp = batch_assign_vorp(players, format_type)
    
    if position:
        players_with_vorp = [p for p in players_with_vorp if p['position'] == position.upper()]
    
    # Sort by VORP for easy selection
    sorted_players = sorted(players_with_vorp, key=lambda x: x.get('vorp', 0), reverse=True)
    
    return jsonify({
        'players': sorted_players,
        'count': len(sorted_players),
        'format': format_type
    })


@trade_bp.route('/trade-eval/analyze', methods=['POST'])
def analyze_trade_details():
    """Detailed trade analysis with player breakdowns"""
    data = request.get_json()
    players_sent = data.get('players_sent', [])
    players_received = data.get('players_received', [])
    format_type = data.get('format', 'dynasty')
    
    # Get all players with VORP
    all_players = get_all_players(format_type)
    players_with_vorp = batch_assign_vorp(all_players, format_type)
    
    # Build detailed breakdown
    sent_details = []
    received_details = []
    
    for name in players_sent:
        for player in players_with_vorp:
            if player['name'].lower() == name.lower():
                sent_details.append({
                    'name': player['name'],
                    'position': player['position'],
                    'team': player['team'],
                    'vorp': player['vorp'],
                    'projected_points': player['projected_points']
                })
                break
    
    for name in players_received:
        for player in players_with_vorp:
            if player['name'].lower() == name.lower():
                received_details.append({
                    'name': player['name'],
                    'position': player['position'],
                    'team': player['team'],
                    'vorp': player['vorp'],
                    'projected_points': player['projected_points']
                })
                break
    
    sent_total = sum(p['vorp'] for p in sent_details)
    received_total = sum(p['vorp'] for p in received_details)
    difference = received_total - sent_total
    
    # Generate recommendation
    if abs(difference) < 5:
        recommendation = "Very fair trade - minimal value difference"
    elif abs(difference) < 10:
        recommendation = "Fair trade with slight advantage to one side"
    elif abs(difference) < 20:
        recommendation = "Moderate advantage - consider adding/removing a player"
    else:
        recommendation = "Significant imbalance - major adjustment needed"
    
    return jsonify({
        'sent_players': sent_details,
        'received_players': received_details,
        'sent_total': round(sent_total, 1),
        'received_total': round(received_total, 1),
        'difference': round(difference, 1),
        'verdict': "Fair" if abs(difference) < 10 else ("Underpay" if difference > 0 else "Overpay"),
        'recommendation': recommendation,
        'format': format_type
    })