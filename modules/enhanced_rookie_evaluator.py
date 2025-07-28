#!/usr/bin/env python3
"""
Enhanced Rookie Evaluator with Tiber Heuristics Integration
Combines base rookie evaluation with learned patterns from 2024 success cases.
"""

from typing import Dict, List, Any, Optional
from modules.rookie_heuristics_engine import get_rookie_heuristics_engine
from modules.rookie_database import RookieDatabase
from modules.rookie_crosscheck_analyzer import get_rookie_crosscheck_analyzer
from modules.tiber_alignment_protocol import apply_tiber_alignment

class EnhancedRookieEvaluator:
    """
    Enhanced rookie evaluation that applies learned heuristics to refine assessments.
    Does not override base rankings but provides confidence adjustments.
    """
    
    def __init__(self):
        self.heuristics_engine = get_rookie_heuristics_engine()
        self.crosscheck_analyzer = get_rookie_crosscheck_analyzer()
        self.base_evaluations = {}
        
    def evaluate_rookie_with_heuristics(self, rookie_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate rookie using both base metrics and learned heuristics.
        Returns enhanced evaluation with confidence modifiers.
        """
        # Get base evaluation (original tier weight, etc.)
        base_evaluation = self._get_base_evaluation(rookie_data)
        
        # Apply heuristics if available
        if rookie_data.get('position') == 'WR':
            heuristic_eval = self.heuristics_engine.evaluate_2025_wr_with_heuristics(rookie_data)
            crosscheck_eval = self.crosscheck_analyzer.apply_crosscheck_to_2025_prospect(rookie_data)
        else:
            heuristic_eval = {
                'heuristic_adjustment': 0,
                'confidence_modifier': 1.0,
                'pattern_matches': [],
                'edge_case_flags': [],
                'btj_vs_nabers_context': []
            }
            crosscheck_eval = {
                'crosscheck_flags': [],
                'btj_nabers_context': [],
                'projection_adjustments': [],
                'confidence_modifiers': []
            }
        
        # Combine evaluations
        enhanced_evaluation = {
            **base_evaluation,
            'heuristics_applied': True,
            'heuristic_adjustment': heuristic_eval['heuristic_adjustment'],
            'confidence_modifier': heuristic_eval['confidence_modifier'],
            'pattern_matches': heuristic_eval['pattern_matches'],
            'edge_case_flags': heuristic_eval['edge_case_flags'],
            'btj_vs_nabers_context': heuristic_eval.get('btj_vs_nabers_context', []),
            'crosscheck_flags': crosscheck_eval.get('crosscheck_flags', []),
            'projection_adjustments': crosscheck_eval.get('projection_adjustments', []),
            'final_tier_weight': self._calculate_enhanced_tier_weight(
                base_evaluation, heuristic_eval
            ),
            'evaluation_notes': self._generate_evaluation_notes(
                rookie_data, heuristic_eval, crosscheck_eval
            )
        }
        
        # Apply Tiber alignment protocol to ensure grounded, humble analysis
        enhanced_evaluation = apply_tiber_alignment(enhanced_evaluation)
        
        return enhanced_evaluation
    
    def _get_base_evaluation(self, rookie_data: Dict[str, Any]) -> Dict[str, Any]:
        """Get base evaluation metrics"""
        # Calculate base tier weight (standard calculation)
        star_rating = rookie_data.get('star_rating', 3.0)
        draft_capital = rookie_data.get('draft_capital', 'Round 3')
        
        # Draft capital scoring
        if 'Round 1' in draft_capital:
            if 'Pick 2' in draft_capital or 'Top' in draft_capital:
                draft_score = 40  # Top 10 pick
            else:
                draft_score = 35  # Late first
        elif 'Round 2' in draft_capital:
            draft_score = 30
        else:
            draft_score = 20
        
        # Star rating scoring
        star_score = star_rating * 7  # Max 35 points
        
        # Dynasty tier scoring
        dynasty_tier = rookie_data.get('dynasty_tier', 'Tier 3')
        if 'Tier 1' in dynasty_tier:
            tier_score = 15
        elif 'Tier 2' in dynasty_tier:
            tier_score = 12
        elif 'Tier 3' in dynasty_tier:
            tier_score = 8
        else:
            tier_score = 5
        
        # Age factor (rookies typically 21-22)
        age_score = 10  # Standard rookie age bonus
        
        base_tier_weight = draft_score + star_score + tier_score + age_score
        
        return {
            'base_tier_weight': base_tier_weight,
            'draft_score': draft_score,
            'star_score': star_score,
            'tier_score': tier_score,
            'age_score': age_score
        }
    
    def _calculate_enhanced_tier_weight(self, base_eval: Dict[str, Any], 
                                      heuristic_eval: Dict[str, Any]) -> float:
        """Calculate final tier weight with heuristic adjustments"""
        base_weight = base_eval['base_tier_weight']
        adjustment = heuristic_eval['heuristic_adjustment']
        confidence = heuristic_eval['confidence_modifier']
        
        # Apply adjustment with confidence modifier
        enhanced_weight = (base_weight + adjustment) * confidence
        
        # Cap at reasonable bounds
        return min(max(enhanced_weight, 0), 100)
    
    def _generate_evaluation_notes(self, rookie_data: Dict[str, Any], 
                                 heuristic_eval: Dict[str, Any],
                                 crosscheck_eval: Optional[Dict[str, Any]] = None) -> List[str]:
        """Generate evaluation notes based on heuristics"""
        notes = []
        
        player_name = rookie_data.get('player_name', 'Unknown')
        
        # Pattern match notes with grounded language
        for pattern in heuristic_eval['pattern_matches']:
            if pattern == 'round_2_success_precedent':
                notes.append(f"Round 2 draft capital shows historical precedent for success (McConkey example)")
            elif pattern == 'weak_wr_corps_opportunity':
                notes.append(f"Landing spot context suggests potential path to targets based on depth chart")
            elif pattern == 'athletic_upside_precedent':
                notes.append(f"Athletic profile aligns with successful rookie development patterns")
            elif pattern == 'late_first_overperform_pattern':
                notes.append(f"Late R1 capital historically shows potential for outperforming expectations")
            elif pattern == 'top_10_volume_expectation':
                notes.append(f"Top 10 draft capital typically correlates with early target volume")
            elif pattern == 'round_2_context_dependent':
                notes.append(f"Round 2 success often depends on role clarity and opportunity context")
        
        # Edge case flags
        for flag in heuristic_eval['edge_case_flags']:
            if flag == 'low_volume_context_excuse':
                notes.append(f"Low college volume potentially explained by poor context (scheme/QB)")
        
        # BTJ vs Nabers context
        for context in heuristic_eval.get('btj_vs_nabers_context', []):
            notes.append(f"BTJ/Nabers lesson: {context}")
        
        # Crosscheck insights
        if crosscheck_eval:
            for adjustment in crosscheck_eval.get('projection_adjustments', []):
                notes.append(f"Crosscheck: {adjustment}")
            
            for flag in crosscheck_eval.get('crosscheck_flags', []):
                notes.append(f"Analysis flag: {flag}")
        
        # Adjustment explanation
        adjustment = heuristic_eval['heuristic_adjustment']
        if adjustment > 0:
            notes.append(f"Heuristics suggest +{adjustment} tier weight boost based on historical patterns")
        
        return notes
    
    def evaluate_all_rookies_enhanced(self, rookies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Evaluate all rookies with enhanced heuristics"""
        enhanced_rookies = []
        
        for rookie in rookies:
            enhanced_eval = self.evaluate_rookie_with_heuristics(rookie)
            
            # Merge enhanced evaluation with original rookie data
            enhanced_rookie = {
                **rookie,
                'enhanced_evaluation': enhanced_eval,
                'tier_weight': enhanced_eval['final_tier_weight'],
                'evaluation_notes': enhanced_eval['evaluation_notes'],
                'heuristics_confidence': enhanced_eval['confidence_modifier']
            }
            
            enhanced_rookies.append(enhanced_rookie)
        
        # Re-sort by enhanced tier weight
        enhanced_rookies.sort(key=lambda x: x['tier_weight'], reverse=True)
        
        return enhanced_rookies
    
    def get_heuristics_summary(self) -> Dict[str, Any]:
        """Get summary of heuristics engine for debugging"""
        return self.heuristics_engine.get_heuristics_summary()

# Global enhanced evaluator instance
enhanced_rookie_evaluator = EnhancedRookieEvaluator()

def get_enhanced_rookie_evaluator() -> EnhancedRookieEvaluator:
    """Get global enhanced rookie evaluator instance"""
    return enhanced_rookie_evaluator

if __name__ == "__main__":
    # Test enhanced evaluator
    evaluator = EnhancedRookieEvaluator()
    
    print("🎯 ENHANCED ROOKIE EVALUATOR TEST")
    print("=" * 50)
    
    # Test with Luther Burden
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
    
    print(f"Luther Burden Enhanced Evaluation:")
    print(f"Base Tier Weight: {enhanced_eval['base_tier_weight']}")
    print(f"Heuristic Adjustment: +{enhanced_eval['heuristic_adjustment']}")
    print(f"Final Tier Weight: {enhanced_eval['final_tier_weight']:.1f}")
    print(f"Confidence: {enhanced_eval['confidence_modifier']:.1%}")
    print(f"Pattern Matches: {enhanced_eval['pattern_matches']}")
    print(f"Evaluation Notes:")
    for note in enhanced_eval['evaluation_notes']:
        print(f"  • {note}")
    
    # Show heuristics summary
    summary = evaluator.get_heuristics_summary()
    print(f"\nHeuristics Engine Summary:")
    print(f"Case Studies: {summary['case_studies_loaded']}")
    print(f"Draft Insights: {summary.get('draft_capital_insights', {})}")
    print(f"Production Insights: {summary.get('production_insights', {})}")