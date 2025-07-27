"""
Rankings Routes - Flask Blueprint for VORP Rankings
On The Clock Fantasy Football Analytics Platform

Handles all ranking-related routes with modular Flask Blueprint architecture.
"""

from flask import Blueprint, request, jsonify
from modules.vorp_engine import batch_assign_vorp
from modules.intake_module import get_all_players

rankings_bp = Blueprint('rankings_bp', __name__)


@rankings_bp.route('/rankings', methods=['GET'])
def get_rankings():
    format_type = request.args.get('format', 'dynasty')
    position_filter = request.args.get('position', None)
    sort_by = request.args.get('sort_by', 'vorp')

    players = get_all_players(format_type)
    players_with_vorp = batch_assign_vorp(players, format_type)

    if position_filter:
        players_with_vorp = [p for p in players_with_vorp if p['position'] == position_filter.upper()]

    sorted_players = sorted(players_with_vorp, key=lambda x: x.get(sort_by, 0), reverse=True)

    return jsonify(sorted_players)


# Additional endpoints removed per user specification - focusing on main JSON API