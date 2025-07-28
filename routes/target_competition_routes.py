#!/usr/bin/env python3
"""
Target Competition Evaluator Routes
API endpoints for target share and competition context analysis
"""

from flask import Blueprint, jsonify, request
from typing import Dict, Any
from modules.target_competition_evaluator import get_target_competition_evaluator
from modules.rookie_pipeline import get_rookie_pipeline

# Create blueprint for target competition routes
target_competition_bp = Blueprint('target_competition_bp', __name__)

@target_competition_bp.route('/api/target-competition/evaluate/<player_name>', methods=['GET'])
def evaluate_player_target_competition(player_name: str):
    """Evaluate target competition for a specific player"""
    try:
        evaluator = get_target_competition_evaluator()
        pipeline = get_rookie_pipeline()
        
        # Find player in rookie pipeline
        rookies = pipeline.get_rookies_for_rankings()
        player_data = None
        
        for rookie in rookies:
            if rookie['name'].lower() == player_name.lower():
                player_data = rookie
                break
        
        if not player_data:
            return jsonify({'error': f'Player {player_name} not found in rookie database'}), 404
        
        # Evaluate target competition
        evaluation = evaluator.evaluate_target_competition(player_data)
        
        return jsonify({
            'success': True,
            'evaluation': evaluation,
            'player_found': True,
            'evaluation_type': 'target_competition_v1.0'
        })
        
    except Exception as e:
        return jsonify({'error': f'Target competition evaluation failed: {str(e)}'}), 500

@target_competition_bp.route('/api/target-competition/team/<team_code>', methods=['GET'])
def evaluate_team_target_competition(team_code: str):
    """Evaluate target competition context for an entire team"""
    try:
        evaluator = get_target_competition_evaluator()
        pipeline = get_rookie_pipeline()
        
        # Find all rookies for the specified team
        rookies = pipeline.get_rookies_for_rankings()
        team_rookies = [r for r in rookies if r.get('team', '').upper() == team_code.upper()]
        
        if not team_rookies:
            return jsonify({'error': f'No rookies found for team {team_code}'}), 404
        
        team_evaluations = []
        for rookie in team_rookies:
            evaluation = evaluator.evaluate_target_competition(rookie)
            team_evaluations.append(evaluation)
        
        # Generate team summary
        team_summary = {
            'team': team_code.upper(),
            'rookie_count': len(team_rookies),
            'high_opportunity_players': len([e for e in team_evaluations 
                                           if e['competition_context']['target_range_adjustment'] == 'high_opportunity']),
            'low_competition_scenarios': len([e for e in team_evaluations 
                                            if not e['competition_context']['high_competition']]),
            'average_target_projection': sum(e['competition_context'].get('expected_targets', [0,0])[0] 
                                           for e in team_evaluations) // len(team_evaluations) if team_evaluations else 0
        }
        
        return jsonify({
            'success': True,
            'team_summary': team_summary,
            'individual_evaluations': team_evaluations,
            'evaluation_type': 'team_target_competition_v1.0'
        })
        
    except Exception as e:
        return jsonify({'error': f'Team target evaluation failed: {str(e)}'}), 500

@target_competition_bp.route('/api/target-competition/logic-chain/<player_name>', methods=['GET'])
def get_target_competition_logic_chain(player_name: str):
    """Get detailed 5-step logic chain for target competition evaluation"""
    try:
        evaluator = get_target_competition_evaluator()
        pipeline = get_rookie_pipeline()
        
        # Find player
        rookies = pipeline.get_rookies_for_rankings()
        player_data = None
        
        for rookie in rookies:
            if rookie['name'].lower() == player_name.lower():
                player_data = rookie
                break
        
        if not player_data:
            return jsonify({'error': f'Player {player_name} not found'}), 404
        
        # Get evaluation with detailed logic chain
        evaluation = evaluator.evaluate_target_competition(player_data)
        logic_chain = evaluation['logic_chain_steps']
        
        return jsonify({
            'success': True,
            'player_name': player_data['name'],
            'team': player_data.get('team', 'TBD'),
            'logic_chain': logic_chain,
            'final_assessment': evaluation['competition_context'],
            'chain_summary': {
                'total_steps': len(logic_chain),
                'key_findings': [step['impact'] for step in logic_chain.values()],
                'final_target_range': evaluation['competition_context'].get('expected_targets', 'TBD')
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'Logic chain retrieval failed: {str(e)}'}), 500

@target_competition_bp.route('/api/target-competition/cross-reference', methods=['GET'])
def cross_reference_target_data():
    """Cross-reference target competition data with game logs validation"""
    try:
        evaluator = get_target_competition_evaluator()
        
        # Get team-level departure/arrival data for validation
        teams_to_validate = ['CHI', 'JAX', 'NYG']
        validation_results = {}
        
        for team in teams_to_validate:
            team_departures = evaluator._get_team_departures(team)
            team_arrivals = evaluator._get_team_arrivals(team)
            team_rbs = evaluator._get_team_rbs(team)
            
            validation_results[team] = {
                'departures': {
                    'count': len(team_departures),
                    'total_targets': sum(d['targets'] for d in team_departures),
                    'high_volume_departures': len([d for d in team_departures if d['targets'] >= 50])
                },
                'arrivals': {
                    'count': len(team_arrivals),
                    'high_threat_count': len([a for a in team_arrivals 
                                            if a.get('career_high_targets', 0) >= 40 or a.get('draft_round', 7) <= 2])
                },
                'rb_competition': {
                    'receiving_rbs': len([rb for rb in team_rbs if rb.get('targets', 0) >= 30]),
                    'slot_competition': len([rb for rb in team_rbs 
                                           if rb.get('slot_usage_rate', 0) >= 0.15])
                }
            }
        
        return jsonify({
            'success': True,
            'validation_results': validation_results,
            'data_sources': {
                'departures': 'Previous season target counts (50+ threshold)',
                'arrivals': 'Team additions with proven history or draft capital',
                'rb_overlap': 'RB slot usage rates and target volumes'
            },
            'cross_reference_status': 'Sample data - production would validate against game logs'
        })
        
    except Exception as e:
        return jsonify({'error': f'Cross-reference validation failed: {str(e)}'}), 500

@target_competition_bp.route('/api/target-competition/test', methods=['GET'])
def test_target_competition_system():
    """Test endpoint to validate target competition evaluator"""
    try:
        evaluator = get_target_competition_evaluator()
        
        # Test with sample data
        test_player = {
            'name': 'Luther Burden',
            'team': 'CHI',
            'position': 'WR',
            'draft_capital': 'Round 2',
            'star_rating': 4.5
        }
        
        evaluation = evaluator.evaluate_target_competition(test_player)
        
        return jsonify({
            'success': True,
            'test_player': test_player['name'],
            'evaluation_complete': True,
            'logic_chain_steps': len(evaluation['logic_chain_steps']),
            'target_assessment': evaluation['competition_context']['target_range_adjustment'],
            'expected_targets': evaluation['competition_context'].get('expected_targets', 'TBD'),
            'high_competition': evaluation['competition_context']['high_competition'],
            'system_status': 'Target Competition Evaluator v1.0 operational'
        })
        
    except Exception as e:
        return jsonify({'error': f'System test failed: {str(e)}'}), 500

# Register blueprint function
def register_target_competition_routes(app):
    """Register target competition routes with Flask app"""
    app.register_blueprint(target_competition_bp)
    print("✅ Target Competition Evaluator v1.0 Blueprint registered successfully")