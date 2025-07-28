#!/usr/bin/env python3
"""
Target Competition Context Generator Routes
API endpoints for dynamic target competition evaluation using team data and context factors
"""

from flask import Blueprint, jsonify, request
from modules.target_competition_context import get_target_competition_context

# Create blueprint for Target Competition Generator routes
generator_bp = Blueprint('target_competition_generator', __name__)

@generator_bp.route('/api/target-competition-generator/evaluate', methods=['POST'])
def evaluate_target_competition_dynamic():
    """Dynamically evaluate target competition using team data and context factors"""
    try:
        context_module = get_target_competition_context()
        
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request body required with player and team data'
            }), 400
        
        # Extract required fields
        player_name = data.get('player_name')
        team_data = data.get('team_data', {})
        vacated_targets = data.get('vacated_targets', 0)
        oc_change = data.get('oc_change', False)
        
        if not player_name:
            return jsonify({
                'success': False,
                'error': 'player_name is required'
            }), 400
        
        # Generate dynamic context
        context_result = context_module.target_competition_context_generator(
            player_name, team_data, vacated_targets, oc_change
        )
        
        return jsonify({
            'success': True,
            'player_name': player_name,
            'dynamic_context': context_result,
            'generator_version': '1.0',
            'tier_mapping': context_module.tier_mapping
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Dynamic evaluation failed: {str(e)}'
        }), 500

@generator_bp.route('/api/target-competition-generator/batch-evaluate', methods=['POST'])
def batch_evaluate_target_competition():
    """Batch evaluate multiple players with team data"""
    try:
        context_module = get_target_competition_context()
        
        # Get request data
        data = request.get_json()
        
        if not data or 'players' not in data:
            return jsonify({
                'success': False,
                'error': 'Request body required with players array'
            }), 400
        
        players_data = data['players']
        results = []
        
        for player_data in players_data:
            try:
                player_name = player_data.get('player_name')
                team_data = player_data.get('team_data', {})
                vacated_targets = player_data.get('vacated_targets', 0)
                oc_change = player_data.get('oc_change', False)
                
                if not player_name:
                    results.append({
                        'player_name': 'Unknown',
                        'success': False,
                        'error': 'player_name missing'
                    })
                    continue
                
                # Generate context
                context_result = context_module.target_competition_context_generator(
                    player_name, team_data, vacated_targets, oc_change
                )
                
                results.append({
                    'player_name': player_name,
                    'success': True,
                    'context': context_result
                })
                
            except Exception as e:
                results.append({
                    'player_name': player_data.get('player_name', 'Unknown'),
                    'success': False,
                    'error': str(e)
                })
        
        return jsonify({
            'success': True,
            'batch_results': results,
            'processed_count': len(results),
            'generator_version': '1.0'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Batch evaluation failed: {str(e)}'
        }), 500

@generator_bp.route('/api/target-competition-generator/examples', methods=['GET'])
def get_generator_examples():
    """Get example input formats for the target competition generator"""
    try:
        examples = {
            'single_player_example': {
                'player_name': 'Luther Burden',
                'team_data': {
                    'team': 'CHI',
                    'teammates': [
                        {
                            'name': 'DJ Moore',
                            'projected_targets': 130,
                            'prometheus_tier': 'Tier 1',
                            'note': 'Proven WR1 with heavy usage history'
                        },
                        {
                            'name': 'Rome Odunze',
                            'projected_targets': 95,
                            'prometheus_tier': 'Tier 2',
                            'note': 'Top 10 pick, projected alpha role'
                        },
                        {
                            'name': 'Colston Loveland',
                            'projected_targets': 75,
                            'prometheus_tier': 'Tier 2',
                            'note': 'Elite TE rookie with red zone upside'
                        }
                    ]
                },
                'vacated_targets': 45,
                'oc_change': False
            },
            'batch_example': {
                'players': [
                    {
                        'player_name': 'Travis Hunter',
                        'team_data': {
                            'team': 'JAX',
                            'teammates': [
                                {
                                    'name': 'Brian Thomas Jr.',
                                    'projected_targets': 120,
                                    'prometheus_tier': 'Tier 2',
                                    'note': 'Proven rookie alpha'
                                }
                            ]
                        },
                        'vacated_targets': 180,
                        'oc_change': True
                    }
                ]
            },
            'tier_mapping': {
                'S': '3+ elite or high-volume target earners',
                'A': '2 elite target earners or one elite + 1 fringe Tier 2',
                'B': '1 major target threat',
                'C': 'No threats but moderate target floor expected',
                'D': 'Vacated room and little to no current threat'
            }
        }
        
        return jsonify({
            'success': True,
            'examples': examples,
            'usage_notes': [
                'Cross-reference game logs to verify scoring and usage claims',
                'Use contextNotes module if OC change, injury, or depth chart anomaly is flagged',
                'If conflict between modules, defer to Prometheus tiering unless manually overridden'
            ]
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get examples: {str(e)}'
        }), 500

@generator_bp.route('/api/target-competition-generator/test', methods=['GET'])
def test_generator():
    """Test the target competition generator with example data"""
    try:
        context_module = get_target_competition_context()
        
        # Test data for Luther Burden
        test_data = {
            'player_name': 'Luther Burden',
            'team_data': {
                'team': 'CHI',
                'teammates': [
                    {
                        'name': 'DJ Moore',
                        'projected_targets': 130,
                        'prometheus_tier': 'Tier 1',
                        'note': 'Proven WR1 with heavy usage history'
                    },
                    {
                        'name': 'Rome Odunze',
                        'projected_targets': 95,
                        'prometheus_tier': 'Tier 2',
                        'note': 'Top 10 pick, projected alpha role'
                    },
                    {
                        'name': 'Colston Loveland',
                        'projected_targets': 75,
                        'prometheus_tier': 'Tier 2',
                        'note': 'Elite TE rookie with red zone upside'
                    }
                ]
            },
            'vacated_targets': 45,
            'oc_change': False
        }
        
        # Generate context
        result = context_module.target_competition_context_generator(
            test_data['player_name'],
            test_data['team_data'],
            test_data['vacated_targets'],
            test_data['oc_change']
        )
        
        return jsonify({
            'success': True,
            'test_input': test_data,
            'generated_context': result,
            'validation': {
                'tier_assigned': result['competition_tier'],
                'threat_count': result['threat_count'],
                'has_context_note': bool(result['context_note']),
                'generated_by_confirmed': result['generated_by'] == 'targetCompetitionContextGenerator'
            },
            'generator_status': 'Target Competition Context Generator operational'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Generator test failed: {str(e)}'
        }), 500

# Register blueprint function
def register_target_competition_generator_routes(app):
    """Register Target Competition Generator routes with Flask app"""
    app.register_blueprint(generator_bp)
    print("✅ Target Competition Context Generator v1.0 Blueprint registered successfully")