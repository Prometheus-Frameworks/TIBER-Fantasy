#!/usr/bin/env python3
"""
Flask routes for Enhanced Rookie Evaluation with Tiber Heuristics
Provides API endpoints for heuristics-enhanced rookie evaluation.
"""

from flask import Blueprint, request, jsonify
from modules.enhanced_rookie_evaluator import get_enhanced_rookie_evaluator
from modules.rookie_pipeline import get_rookie_pipeline

# Create blueprint for enhanced rookie evaluation
enhanced_rookie_bp = Blueprint('enhanced_rookie', __name__)

@enhanced_rookie_bp.route('/api/enhanced-rookie/evaluate', methods=['POST'])
def evaluate_single_rookie():
    """Evaluate a single rookie with Tiber heuristics"""
    try:
        evaluator = get_enhanced_rookie_evaluator()
        request_data = request.get_json()
        
        if not request_data:
            return jsonify({'error': 'No rookie data provided'}), 400
        
        enhanced_eval = evaluator.evaluate_rookie_with_heuristics(request_data)
        
        return jsonify({
            'success': True,
            'player_name': request_data.get('player_name', 'Unknown'),
            'enhanced_evaluation': enhanced_eval,
            'heuristics_applied': True
        })
        
    except Exception as e:
        return jsonify({'error': f'Enhanced evaluation failed: {str(e)}'}), 500

@enhanced_rookie_bp.route('/api/enhanced-rookie/evaluate-all', methods=['GET'])
def evaluate_all_rookies_enhanced():
    """Evaluate all rookies with enhanced heuristics"""
    try:
        pipeline = get_rookie_pipeline()
        evaluator = get_enhanced_rookie_evaluator()
        
        year = request.args.get('year', '2025')
        position = request.args.get('position', None)
        
        # Get base rookies
        rookies = pipeline.get_rookies_for_rankings(year=year, position=position)
        
        # Apply enhanced evaluation
        enhanced_rookies = evaluator.evaluate_all_rookies_enhanced(rookies)
        
        return jsonify({
            'success': True,
            'year': year,
            'position_filter': position,
            'total_rookies': len(enhanced_rookies),
            'enhanced_rookies': enhanced_rookies,
            'heuristics_engine_status': 'active'
        })
        
    except Exception as e:
        return jsonify({'error': f'Enhanced evaluation failed: {str(e)}'}), 500

@enhanced_rookie_bp.route('/api/enhanced-rookie/heuristics-summary', methods=['GET'])
def get_heuristics_summary():
    """Get summary of Tiber heuristics engine"""
    try:
        evaluator = get_enhanced_rookie_evaluator()
        summary = evaluator.get_heuristics_summary()
        
        return jsonify({
            'success': True,
            'heuristics_summary': summary,
            'case_studies_loaded': summary.get('case_studies_loaded', 0),
            'patterns_learned': summary.get('heuristics_built', [])
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to get heuristics summary: {str(e)}'}), 500

@enhanced_rookie_bp.route('/api/enhanced-rookie/luther-burden-analysis', methods=['GET'])
def analyze_luther_burden():
    """Specific analysis of Luther Burden with heuristics"""
    try:
        evaluator = get_enhanced_rookie_evaluator()
        
        luther_data = {
            "player_name": "Luther Burden",
            "position": "WR",
            "nfl_team": "CHI",
            "draft_capital": "Round 2",
            "college_stats": {
                "2024": {
                    "receptions": 59,
                    "receiving_yards": 850,
                    "touchdowns": 6
                }
            },
            "athleticism": "Above Average",
            "context_notes": "Poor QB play and scheme in 2024. Dip in production not a red flag.",
            "star_rating": 4.5,
            "dynasty_tier": "Tier 2",
            "rookie_flag": True
        }
        
        enhanced_eval = evaluator.evaluate_rookie_with_heuristics(luther_data)
        
        return jsonify({
            'success': True,
            'player_analysis': {
                'name': 'Luther Burden',
                'team': 'CHI',
                'base_tier_weight': enhanced_eval['base_tier_weight'],
                'heuristic_adjustment': enhanced_eval['heuristic_adjustment'],
                'final_tier_weight': enhanced_eval['final_tier_weight'],
                'confidence_modifier': enhanced_eval['confidence_modifier'],
                'pattern_matches': enhanced_eval['pattern_matches'],
                'evaluation_notes': enhanced_eval['evaluation_notes']
            },
            'heuristics_impact': {
                'boost_applied': enhanced_eval['heuristic_adjustment'] > 0,
                'patterns_found': len(enhanced_eval['pattern_matches']),
                'precedent_examples': [
                    'Ladd McConkey (2024) - Round 2 WR success',
                    'CHI rebuilding WR corps opportunity',
                    'Above Average athleticism matches patterns'
                ]
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'Luther Burden analysis failed: {str(e)}'}), 500

@enhanced_rookie_bp.route('/api/enhanced-rookie/tiber-training-data', methods=['GET'])
def get_tiber_training_data():
    """Get the 2024 case studies used for Tiber training"""
    try:
        import json
        from pathlib import Path
        
        case_studies_path = Path("data/rookie_success_case_studies_2024.json")
        
        if case_studies_path.exists():
            with open(case_studies_path, 'r') as f:
                case_studies = json.load(f)
            
            return jsonify({
                'success': True,
                'training_data': case_studies,
                'total_cases': len(case_studies),
                'positions_covered': list(set(case['position'] for case in case_studies)),
                'data_source': 'rookie_success_case_studies_2024.json'
            })
        else:
            return jsonify({'error': 'Training data file not found'}), 404
            
    except Exception as e:
        return jsonify({'error': f'Failed to load training data: {str(e)}'}), 500

@enhanced_rookie_bp.route('/api/enhanced-rookie/pattern-matches/<player_name>', methods=['GET'])
def get_pattern_matches(player_name):
    """Get specific pattern matches for a rookie"""
    try:
        pipeline = get_rookie_pipeline()
        evaluator = get_enhanced_rookie_evaluator()
        
        # Find rookie in pipeline
        rookies = pipeline.get_rookies_for_rankings()
        rookie_data = None
        
        for rookie in rookies:
            if rookie['name'].lower() == player_name.lower():
                rookie_data = rookie
                break
        
        if not rookie_data:
            return jsonify({'error': f'Rookie {player_name} not found'}), 404
        
        # Get enhanced evaluation
        enhanced_eval = evaluator.evaluate_rookie_with_heuristics(rookie_data)
        
        return jsonify({
            'success': True,
            'player_name': rookie_data['name'],
            'pattern_matches': enhanced_eval['pattern_matches'],
            'edge_case_flags': enhanced_eval['edge_case_flags'],
            'heuristic_boost': enhanced_eval['heuristic_adjustment'],
            'confidence_level': enhanced_eval['confidence_modifier'],
            'btj_vs_nabers_context': enhanced_eval.get('btj_vs_nabers_context', []),
            'crosscheck_flags': enhanced_eval.get('crosscheck_flags', []),
            'precedent_analysis': enhanced_eval['evaluation_notes']
        })
        
    except Exception as e:
        return jsonify({'error': f'Pattern matching failed: {str(e)}'}), 500

@enhanced_rookie_bp.route('/api/enhanced-rookie/btj-vs-nabers-analysis', methods=['GET'])
def get_btj_vs_nabers_analysis():
    """Get comprehensive BTJ vs Nabers crosscheck analysis"""
    try:
        from modules.rookie_crosscheck_analyzer import get_rookie_crosscheck_analyzer
        analyzer = get_rookie_crosscheck_analyzer()
        
        summary = analyzer.get_crosscheck_summary()
        btj_nabers = summary['crosscheck_insights']['btj_vs_nabers_lessons']
        
        return jsonify({
            'success': True,
            'btj_vs_nabers_analysis': btj_nabers,
            'key_insights': {
                'draft_capital_lesson': 'Late R1 vs Top 10 - BTJ outproduced despite lower capital',
                'performance_comparison': 'BTJ: 1282 yards, 10 TDs vs Nabers: 1204 yards, 7 TDs',
                'context_analysis': 'Both overcame poor QB play differently - BTJ with big plays, Nabers with volume',
                'projection_implications': btj_nabers['projection_implications']
            },
            'crosscheck_lessons': summary['key_lessons'],
            'evaluator_guidance': summary['btj_vs_nabers_key_takeaway']
        })
        
    except Exception as e:
        return jsonify({'error': f'BTJ vs Nabers analysis failed: {str(e)}'}), 500

@enhanced_rookie_bp.route('/api/enhanced-rookie/crosscheck-summary', methods=['GET'])
def get_crosscheck_summary():
    """Get complete crosscheck analysis summary"""
    try:
        from modules.rookie_crosscheck_analyzer import get_rookie_crosscheck_analyzer
        analyzer = get_rookie_crosscheck_analyzer()
        
        summary = analyzer.get_crosscheck_summary()
        
        return jsonify({
            'success': True,
            'crosscheck_summary': summary,
            'foundation_protocol_status': 'active',
            'case_studies_analyzed': 3,
            'patterns_identified': len(summary['crosscheck_insights'])
        })
        
    except Exception as e:
        return jsonify({'error': f'Crosscheck summary failed: {str(e)}'}), 500