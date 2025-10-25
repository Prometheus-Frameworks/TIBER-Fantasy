#!/usr/bin/env python3
"""
TCIP (Target Competition Inference Pipeline) Routes
API endpoints for target competition tier evaluation and dynasty integration
"""

from flask import Blueprint, jsonify, request
from typing import Dict, Any
import math
import re
from modules.tcip_pipeline import get_tcip_pipeline
from modules.rookie_pipeline import get_rookie_pipeline

# Create blueprint for TCIP routes
tcip_bp = Blueprint('tcip_bp', __name__)

# Strict numeric matcher (blocks nan, inf, and non-numeric strings)
_NUMERIC_RE = re.compile(r'^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$', re.IGNORECASE)

def parse_strict_float(value_str: str, param_name: str, min_val: float, max_val: float) -> float:
    """
    Parse and validate a float from user input with strict guards against NaN/Inf injection.
    
    Args:
        value_str: The string value to parse
        param_name: Name of the parameter (for error messages)
        min_val: Minimum allowed value (exclusive)
        max_val: Maximum allowed value (inclusive)
    
    Returns:
        Validated float value
    
    Raises:
        ValueError: If value is invalid, non-finite, or out of range
    """
    if not value_str:
        raise ValueError(f"{param_name} cannot be empty")
    
    s = value_str.strip().lower()
    
    # Block known poison values before casting
    poison_values = {"nan", "+nan", "-nan", "inf", "+inf", "-inf", "infinity", "+infinity", "-infinity"}
    if s in poison_values:
        raise ValueError(f"{param_name} cannot be NaN or Infinity")
    
    # Only allow canonical numeric strings
    if not _NUMERIC_RE.match(s):
        raise ValueError(f"{param_name} must be a valid number")
    
    # Safe cast and final finiteness check
    val = float(s)
    if not math.isfinite(val):
        raise ValueError(f"{param_name} must be a finite number")
    
    # Enforce domain range
    if not (min_val < val <= max_val):
        raise ValueError(f"{param_name} must be between {min_val} and {max_val}")
    
    return val

@tcip_bp.route('/api/tcip/evaluate/<player_name>', methods=['GET'])
def evaluate_player_tcip(player_name: str):
    """Evaluate target competition tier for a specific player using TCIP"""
    try:
        tcip = get_tcip_pipeline()
        pipeline = get_rookie_pipeline()
        
        # Find player in rookie pipeline or use provided data
        rookies = pipeline.get_rookies_for_rankings()
        player_data = None
        
        for rookie in rookies:
            if rookie['name'].lower() == player_name.lower():
                player_data = rookie
                break
        
        # If not found in rookies, create basic player data from name
        if not player_data:
            # Check for known veterans from TCIP examples
            veteran_players = {
                'chris godwin': {'name': 'Chris Godwin', 'team': 'TB', 'position': 'WR'},
                'jaylen waddle': {'name': 'Jaylen Waddle', 'team': 'MIA', 'position': 'WR'}
            }
            
            player_data = veteran_players.get(player_name.lower())
            
        if not player_data:
            return jsonify({'error': f'Player {player_name} not found in database'}), 404
        
        # Run TCIP evaluation
        tcip_result = tcip.evaluate_target_competition_tier(player_data)
        
        return jsonify({
            'success': True,
            'player_found': True,
            'tcip_evaluation': tcip_result,
            'evaluation_type': 'TCIP_v1.0',
            'tier_definitions': tcip.tier_definitions
        })
        
    except Exception as e:
        return jsonify({'error': f'TCIP evaluation failed: {str(e)}'}), 500

@tcip_bp.route('/api/tcip/dynasty-integration/<player_name>', methods=['GET'])
def integrate_tcip_dynasty(player_name: str):
    """Integrate TCIP results with dynasty tier scoring"""
    try:
        tcip = get_tcip_pipeline()
        pipeline = get_rookie_pipeline()
        
        # Get base dynasty tier weight (would normally come from dynasty tier engine)
        base_tier_input = request.args.get('base_tier', '85.0')
        try:
            base_tier_weight = parse_strict_float(base_tier_input, 'base_tier', 0, 1000)
        except ValueError as e:
            return jsonify({'error': f'Invalid base_tier parameter: {str(e)}'}), 400
        
        # Find player data
        rookies = pipeline.get_rookies_for_rankings()
        player_data = None
        
        for rookie in rookies:
            if rookie['name'].lower() == player_name.lower():
                player_data = rookie
                break
                
        if not player_data:
            # Check veterans
            veteran_players = {
                'chris godwin': {'name': 'Chris Godwin', 'team': 'TB', 'position': 'WR'},
                'jaylen waddle': {'name': 'Jaylen Waddle', 'team': 'MIA', 'position': 'WR'}
            }
            player_data = veteran_players.get(player_name.lower())
        
        if not player_data:
            return jsonify({'error': f'Player {player_name} not found for dynasty integration'}), 404
        
        # Run dynasty integration
        dynasty_result = tcip.integrate_with_dynasty_tier(player_data, base_tier_weight)
        
        return jsonify({
            'success': True,
            'dynasty_integration': dynasty_result,
            'player_name': player_data['name'],
            'team': player_data.get('team', 'TBD'),
            'integration_type': 'TCIP_Dynasty_v1.0'
        })
        
    except Exception as e:
        return jsonify({'error': f'Dynasty integration failed: {str(e)}'}), 500

@tcip_bp.route('/api/tcip/team/<team_code>', methods=['GET'])
def evaluate_team_tcip(team_code: str):
    """Evaluate target competition for all players on a team"""
    try:
        tcip = get_tcip_pipeline()
        pipeline = get_rookie_pipeline()
        
        # Find all rookies for the specified team
        rookies = pipeline.get_rookies_for_rankings()
        team_players = [r for r in rookies if r.get('team', '').upper() == team_code.upper()]
        
        # Add known veterans for specific teams
        veteran_additions = {
            'TB': [{'name': 'Chris Godwin', 'team': 'TB', 'position': 'WR'}],
            'MIA': [{'name': 'Jaylen Waddle', 'team': 'MIA', 'position': 'WR'}]
        }
        
        if team_code.upper() in veteran_additions:
            team_players.extend(veteran_additions[team_code.upper()])
        
        if not team_players:
            return jsonify({'error': f'No players found for team {team_code}'}), 404
        
        team_evaluations = []
        tier_summary = {'S': 0, 'A': 0, 'B': 0, 'D': 0}
        
        for player in team_players:
            tcip_result = tcip.evaluate_target_competition_tier(player)
            team_evaluations.append(tcip_result)
            tier_summary[tcip_result['competition_tier']] += 1
        
        return jsonify({
            'success': True,
            'team': team_code.upper(),
            'player_count': len(team_players),
            'tier_summary': tier_summary,
            'team_evaluations': team_evaluations,
            'evaluation_type': 'TCIP_Team_v1.0'
        })
        
    except Exception as e:
        return jsonify({'error': f'Team TCIP evaluation failed: {str(e)}'}), 500

@tcip_bp.route('/api/tcip/tier-definitions', methods=['GET'])
def get_tier_definitions():
    """Get TCIP tier definitions and scoring methodology"""
    try:
        tcip = get_tcip_pipeline()
        
        return jsonify({
            'success': True,
            'tier_definitions': tcip.tier_definitions,
            'scoring_rules': tcip.scoring_rules,
            'tier_brackets': tcip.tier_brackets,
            'methodology': {
                'rule_1': 'Add +3 if teammate is top 10 or round 1 pick',
                'rule_2': 'Add +2 if teammate had over 80 targets last season',
                'rule_3': 'Add +1 if teammate is Dynasty Tier 1 or 2',
                'scoring_brackets': {
                    '6+': 'S-tier',
                    '3-5': 'A-tier', 
                    '1-2': 'B-tier',
                    '0': 'D-tier'
                }
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to get tier definitions: {str(e)}'}), 500

@tcip_bp.route('/api/tcip/update-competition/<player_id>', methods=['POST'])
def update_target_competition(player_id: str):
    """Trigger update for depth chart, injury, or trade changes"""
    try:
        tcip = get_tcip_pipeline()
        
        # Trigger update
        update_result = tcip.update_target_competition(player_id)
        
        return jsonify({
            'success': True,
            'update_result': update_result,
            'message': f'Target competition update triggered for player {player_id}',
            'next_action': 'Re-evaluate target competition tier and adjust dynasty scoring'
        })
        
    except Exception as e:
        return jsonify({'error': f'Update trigger failed: {str(e)}'}), 500

@tcip_bp.route('/api/tcip/test', methods=['GET'])
def test_tcip_system():
    """Test endpoint to validate TCIP system"""
    try:
        tcip = get_tcip_pipeline()
        
        # Test with Luther Burden example
        test_player = {
            'name': 'Luther Burden',
            'team': 'CHI',
            'position': 'WR'
        }
        
        tcip_result = tcip.evaluate_target_competition_tier(test_player)
        dynasty_result = tcip.integrate_with_dynasty_tier(test_player, 85.0)
        
        return jsonify({
            'success': True,
            'test_player': test_player['name'],
            'tcip_tier': tcip_result['competition_tier'],
            'competition_score': tcip_result['competition_score'],
            'dynasty_adjustment': dynasty_result['tier_adjustment'],
            'adjusted_dynasty_weight': dynasty_result['adjusted_tier_weight'],
            'teammates_analyzed': len(tcip_result['teammates_analyzed']),
            'system_status': 'TCIP Pipeline operational',
            'methodology_confirmed': 'D-S tier classification with +3/+2/+1 scoring rules'
        })
        
    except Exception as e:
        return jsonify({'error': f'TCIP system test failed: {str(e)}'}), 500

# Register blueprint function
def register_tcip_routes(app):
    """Register TCIP routes with Flask app"""
    app.register_blueprint(tcip_bp)
    print("✅ TCIP (Target Competition Inference Pipeline) v1.0 Blueprint registered successfully")