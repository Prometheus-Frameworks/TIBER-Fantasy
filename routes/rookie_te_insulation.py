#!/usr/bin/env python3
"""
Flask routes for Rookie TE Insulation Boost System
Integrates with the comprehensive Flask platform for TE evaluation and scoring.
"""

from flask import Blueprint, request, jsonify
import json
import os
from modules.rookie_te_insulation import (
    apply_rookie_te_insulation_boost, 
    get_rookie_te_insulation_breakdown
)

# Create blueprint for rookie TE insulation routes
rookie_te_bp = Blueprint('rookie_te_insulation', __name__)

class RookieTEPlayer:
    """Player class for rookie TE insulation evaluation"""
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

@rookie_te_bp.route('/api/rookie-te/insulation/evaluate', methods=['POST'])
def evaluate_rookie_te_insulation():
    """
    Evaluate rookie TE insulation boost for a given player profile.
    Expects JSON payload with player data.
    """
    try:
        player_data = request.get_json()
        
        if not player_data:
            return jsonify({'error': 'No player data provided'}), 400
        
        # Create player object
        player = RookieTEPlayer(**player_data)
        
        # Calculate insulation boost and get breakdown
        insulation_boost = apply_rookie_te_insulation_boost(player)
        breakdown = get_rookie_te_insulation_breakdown(player)
        
        response = {
            'player_name': getattr(player, 'name', 'Unknown'),
            'insulation_boost': insulation_boost,
            'eligible_for_boost': breakdown['eligible_for_boost'],
            'detailed_breakdown': breakdown,
            'evaluation_timestamp': 'live',
            'system_version': 'v1.0'
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({'error': f'Evaluation failed: {str(e)}'}), 500

@rookie_te_bp.route('/api/rookie-te/insulation/test-samples', methods=['GET'])
def get_test_samples():
    """
    Return test sample rookie TE profiles for insulation evaluation.
    """
    test_samples = [
        {
            'name': 'Elite Rookie TE Profile',
            'draft_round': 1,
            'college_receiving_yards': 1050,
            'college_target_share': 0.28,
            'college_receptions': 75,
            'yards_per_reception': 14.0,
            'blocking_grade': 'plus',
            'snap_alignment_count': 5,
            'team_qb': 'Patrick Mahomes',
            'team_prefers_tes': True,
            'te_depth_chart_rank': 1,
            'profile_type': 'high_insulation'
        },
        {
            'name': 'Mid-Round Rookie TE',
            'draft_round': 3,
            'college_receiving_yards': 820,
            'college_target_share': 0.18,
            'college_receptions': 68,
            'yards_per_reception': 12.1,
            'blocking_grade': 'solid',
            'snap_alignment_count': 3,
            'team_qb': 'Justin Herbert',
            'team_prefers_tes': False,
            'te_depth_chart_rank': 2,
            'profile_type': 'medium_insulation'
        },
        {
            'name': 'Late-Round Developmental TE',
            'draft_round': 6,
            'college_receiving_yards': 540,
            'college_target_share': 0.12,
            'college_receptions': 35,
            'yards_per_reception': 15.4,
            'blocking_grade': 'average',
            'snap_alignment_count': 2,
            'team_qb': 'Daniel Jones',
            'team_prefers_tes': False,
            'te_depth_chart_rank': 3,
            'profile_type': 'low_insulation'
        }
    ]
    
    return jsonify({
        'test_samples': test_samples,
        'total_samples': len(test_samples),
        'system_info': {
            'version': 'v1.0',
            'criteria': [
                'Draft Capital (1st round = 10 pts)',
                'Production (800+ yards + target share = 8-10 pts)',
                'Scheme Traits (YPR, blocking, alignments = up to 10 pts)',
                'Landing Spot (stable QB, TE-friendly team = up to 3 pts)'
            ],
            'max_boost': 12
        }
    })

@rookie_te_bp.route('/api/rookie-te/insulation/batch-evaluate', methods=['POST'])
def batch_evaluate_rookie_tes():
    """
    Evaluate multiple rookie TEs for insulation boost in batch.
    Expects JSON array of player objects.
    """
    try:
        players_data = request.get_json()
        
        if not players_data or not isinstance(players_data, list):
            return jsonify({'error': 'Expected array of player data'}), 400
        
        results = []
        
        for player_data in players_data:
            player = RookieTEPlayer(**player_data)
            insulation_boost = apply_rookie_te_insulation_boost(player)
            breakdown = get_rookie_te_insulation_breakdown(player)
            
            result = {
                'player_name': getattr(player, 'name', 'Unknown'),
                'insulation_boost': insulation_boost,
                'eligible_for_boost': breakdown['eligible_for_boost'],
                'summary_scores': {
                    'draft_capital': breakdown['draft_capital_score'],
                    'production': breakdown['production_score'],
                    'scheme_traits': breakdown['scheme_score'],
                    'landing_spot': breakdown['team_stability_score']
                }
            }
            results.append(result)
        
        # Summary statistics
        total_evaluated = len(results)
        eligible_count = len([r for r in results if r['eligible_for_boost']])
        avg_boost = sum([r['insulation_boost'] for r in results]) / total_evaluated if total_evaluated > 0 else 0
        
        response = {
            'batch_results': results,
            'summary': {
                'total_evaluated': total_evaluated,
                'eligible_for_boost': eligible_count,
                'eligibility_rate': round(eligible_count / total_evaluated, 3) if total_evaluated > 0 else 0,
                'average_boost': round(avg_boost, 1)
            },
            'evaluation_timestamp': 'live'
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({'error': f'Batch evaluation failed: {str(e)}'}), 500

@rookie_te_bp.route('/api/rookie-te/insulation/criteria', methods=['GET'])
def get_insulation_criteria():
    """
    Return detailed criteria for rookie TE insulation boost evaluation.
    """
    criteria = {
        'system_name': 'Rookie TE Insulation Boost System v1.0',
        'max_boost_points': 12,
        'requirements': {
            'all_criteria_must_be_met': True,
            'minimum_thresholds': {
                'draft_capital': 10,
                'production': 8,
                'scheme_traits': 8,
                'landing_spot': 2
            }
        },
        'scoring_breakdown': {
            'draft_capital': {
                'max_points': 10,
                'criteria': '1st round draft pick only',
                'threshold': 'draft_round == 1'
            },
            'production': {
                'max_points': 10,
                'criteria': '800+ college receiving yards + target dominance',
                'thresholds': {
                    'college_yards': 800,
                    'target_share_preferred': 0.20,
                    'receptions_fallback': 60
                }
            },
            'scheme_traits': {
                'max_points': 10,
                'components': {
                    'yards_per_reception': {
                        'points': 3,
                        'threshold': 12.0,
                        'description': 'RAC ability proxy'
                    },
                    'blocking_grade': {
                        'points': 3,
                        'threshold': 'solid or plus',
                        'description': 'Inline blocking ability'
                    },
                    'snap_alignments': {
                        'points': 4,
                        'threshold': 3,
                        'description': 'Positional versatility'
                    }
                }
            },
            'landing_spot': {
                'max_points': 3,
                'components': {
                    'stable_qb': {
                        'points': 1,
                        'list': ['Patrick Mahomes', 'Josh Allen', 'Joe Burrow', 'Justin Herbert', 'Jalen Hurts', 'Lamar Jackson', 'CJ Stroud']
                    },
                    'te_friendly_team': {
                        'points': 1,
                        'description': 'Team emphasizes TE usage'
                    },
                    'depth_chart_position': {
                        'points': 1,
                        'threshold': 'TE1 on depth chart'
                    }
                }
            }
        },
        'evaluation_philosophy': 'High-insulation rookies have multiple factors reducing bust risk and increasing floor/ceiling outcomes in fantasy football.'
    }
    
    return jsonify(criteria)

# Health check endpoint
@rookie_te_bp.route('/api/rookie-te/insulation/health', methods=['GET'])
def health_check():
    """Health check for rookie TE insulation system."""
    return jsonify({
        'status': 'operational',
        'system': 'Rookie TE Insulation Boost System',
        'version': 'v1.0',
        'endpoints_available': [
            '/api/rookie-te/insulation/evaluate',
            '/api/rookie-te/insulation/test-samples',
            '/api/rookie-te/insulation/batch-evaluate',
            '/api/rookie-te/insulation/criteria'
        ]
    })