#!/usr/bin/env python3
"""
Tiber Rookie Evaluation Heuristics Engine
Uses historical success patterns to refine rookie WR evaluation logic.
"""

import json
import os
from typing import Dict, List, Any, Optional
from pathlib import Path

class RookieHeuristicsEngine:
    """
    Learns from historical rookie success patterns to improve evaluation accuracy.
    Does not directly affect rankings but informs weighting logic for edge cases.
    """
    
    def __init__(self):
        self.case_studies = []
        self.heuristics = {}
        self.load_case_studies()
        self.build_heuristics()
    
    def load_case_studies(self):
        """Load historical rookie success case studies"""
        case_studies_path = Path("data/rookie_success_case_studies_2024.json")
        
        if case_studies_path.exists():
            try:
                with open(case_studies_path, 'r') as f:
                    self.case_studies = json.load(f)
                print(f"📚 Loaded {len(self.case_studies)} rookie case studies for Tiber analysis")
            except Exception as e:
                print(f"⚠️ Failed to load case studies: {e}")
                self.case_studies = []
        else:
            print("⚠️ No rookie case studies found - using baseline evaluation")
            self.case_studies = []
    
    def build_heuristics(self):
        """Build heuristics from case study patterns"""
        if not self.case_studies:
            return
        
        # Draft capital vs production patterns
        self.heuristics['draft_capital_patterns'] = self._analyze_draft_capital_patterns()
        
        # College production thresholds
        self.heuristics['production_thresholds'] = self._analyze_production_thresholds()
        
        # Trait combinations
        self.heuristics['trait_combinations'] = self._analyze_trait_combinations()
        
        # Landing spot contexts
        self.heuristics['landing_spot_contexts'] = self._analyze_landing_spot_contexts()
        
        print(f"🧠 Built {len(self.heuristics)} heuristic patterns from case studies")
    
    def _analyze_draft_capital_patterns(self) -> Dict[str, Any]:
        """Analyze how draft capital correlated with success"""
        patterns = {
            'top_10_picks': [],
            'late_first_picks': [],
            'second_round_picks': [],
            'capital_vs_output_insights': []
        }
        
        for case in self.case_studies:
            draft_capital = case.get('draft_capital', '')
            actual_stats = case.get('actual_2024_stats', {})
            context_notes = case.get('context_notes', '')
            
            case_data = {
                'name': case['player_name'],
                'impact': case['rookie_impact'],
                'tier': case['dynasty_tier'],
                'actual_output': actual_stats.get('fantasy_finish', 'Unknown'),
                'context': context_notes
            }
            
            if 'Top 10' in draft_capital:
                patterns['top_10_picks'].append(case_data)
                # Analyze if high draft capital matched performance
                if actual_stats and 'WR6' in actual_stats.get('fantasy_finish', ''):
                    patterns['capital_vs_output_insights'].append({
                        'pattern': 'top_10_met_expectations',
                        'example': case['player_name'],
                        'note': 'High draft capital justified by elite volume metrics'
                    })
            elif 'Late' in draft_capital:
                patterns['late_first_picks'].append(case_data)
                # BTJ outperformed draft position
                if actual_stats and 'WR12' in actual_stats.get('fantasy_finish', ''):
                    patterns['capital_vs_output_insights'].append({
                        'pattern': 'late_first_overperformed',
                        'example': case['player_name'],
                        'note': 'Lower draft capital but higher fantasy output than Top 10 picks'
                    })
            elif 'Round 2' in draft_capital:
                patterns['second_round_picks'].append(case_data)
        
        return patterns
    
    def _analyze_production_thresholds(self) -> Dict[str, Any]:
        """Analyze college production vs success patterns"""
        thresholds = {
            'high_volume': [],  # 80+ receptions
            'moderate_volume': [],  # 50-79 receptions
            'low_volume': []  # <50 receptions
        }
        
        for case in self.case_studies:
            college_stats = case.get('college_stats', {}).get('2023', {})
            receptions = college_stats.get('receptions', 0)
            
            if receptions >= 80:
                thresholds['high_volume'].append({
                    'name': case['player_name'],
                    'receptions': receptions,
                    'yards': college_stats.get('receiving_yards', 0),
                    'impact': case['rookie_impact'],
                    'traits': case.get('traits', [])
                })
            elif receptions >= 50:
                thresholds['moderate_volume'].append({
                    'name': case['player_name'],
                    'receptions': receptions,
                    'yards': college_stats.get('receiving_yards', 0),
                    'impact': case['rookie_impact'],
                    'traits': case.get('traits', [])
                })
            else:
                thresholds['low_volume'].append({
                    'name': case['player_name'],
                    'receptions': receptions,
                    'yards': college_stats.get('receiving_yards', 0),
                    'impact': case['rookie_impact'],
                    'traits': case.get('traits', [])
                })
        
        return thresholds
    
    def _analyze_trait_combinations(self) -> Dict[str, Any]:
        """Analyze which trait combinations led to success"""
        trait_success = {}
        
        for case in self.case_studies:
            traits = case.get('traits', [])
            impact = case['rookie_impact']
            tier = case['dynasty_tier']
            
            for trait in traits:
                if trait not in trait_success:
                    trait_success[trait] = {
                        'high_impact': 0,
                        'moderate_impact': 0,
                        'examples': []
                    }
                
                if 'High-end' in impact or 'Tier 1' in tier:
                    trait_success[trait]['high_impact'] += 1
                else:
                    trait_success[trait]['moderate_impact'] += 1
                
                trait_success[trait]['examples'].append({
                    'name': case['player_name'],
                    'impact': impact,
                    'tier': tier
                })
        
        return trait_success
    
    def _analyze_landing_spot_contexts(self) -> Dict[str, Any]:
        """Analyze how landing spot affected rookie success"""
        contexts = {
            'weak_wr_corps': [],
            'competition_scenarios': [],
            'offensive_systems': []
        }
        
        for case in self.case_studies:
            projection = case.get('rookie_projection', '')
            
            if 'weak' in projection.lower() or 'rebuilding' in projection.lower():
                contexts['weak_wr_corps'].append({
                    'name': case['player_name'],
                    'projection': projection,
                    'impact': case['rookie_impact']
                })
            
            if 'competes' in projection.lower() or 'usage' in projection.lower():
                contexts['competition_scenarios'].append({
                    'name': case['player_name'],
                    'projection': projection,
                    'impact': case['rookie_impact']
                })
        
        return contexts
    
    def evaluate_2025_wr_with_heuristics(self, wr_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply learned heuristics to evaluate a 2025 WR prospect.
        Returns refined evaluation with confidence adjustments based on 2024 case studies.
        """
        if not self.heuristics:
            return {
                'heuristic_adjustment': 0,
                'confidence_modifier': 1.0,
                'pattern_matches': [],
                'edge_case_flags': [],
                'btj_vs_nabers_context': []
            }
        
        evaluation = {
            'heuristic_adjustment': 0,
            'confidence_modifier': 1.0,
            'pattern_matches': [],
            'edge_case_flags': [],
            'btj_vs_nabers_context': []
        }
        
        # BTJ vs Nabers lesson: Don't auto-rank by draft capital alone
        draft_capital = wr_data.get('draft_capital', '')
        context_notes = wr_data.get('context_notes', '')
        
        # Analyze draft capital with BTJ/Nabers context
        if 'Round 1' in draft_capital and 'Late' in draft_capital:
            # Late first round - BTJ pattern (outperformed expectations)
            evaluation['pattern_matches'].append('late_first_overperform_pattern')
            evaluation['btj_vs_nabers_context'].append('BTJ showed late R1 picks can outproduce Top 10')
            evaluation['heuristic_adjustment'] += 3  # Don't penalize late R1
            
        elif 'Round 1' in draft_capital and ('Top' in draft_capital or 'Pick' in draft_capital):
            # Top 10 pick - Nabers pattern (high volume, context dependent)
            evaluation['pattern_matches'].append('top_10_volume_expectation')
            evaluation['btj_vs_nabers_context'].append('Nabers had elite volume but context matters for TDs')
            # Don't auto-boost - need context analysis
            
        elif 'Round 2' in draft_capital:
            # Round 2 - McConkey pattern (role-dependent success)
            round2_patterns = self.heuristics['draft_capital_patterns']['second_round_picks']
            if round2_patterns:
                evaluation['pattern_matches'].append('round_2_context_dependent')
                evaluation['heuristic_adjustment'] += 2
        
        # Context-aware evaluation (BTJ thrived despite QB issues)
        if 'poor' in context_notes.lower() or 'scheme' in context_notes.lower():
            evaluation['edge_case_flags'].append('context_excuse_flag')
            # BTJ lesson: players can overcome poor context
            evaluation['btj_vs_nabers_context'].append('BTJ overcame QB instability - context not always limiting')
            evaluation['confidence_modifier'] = 0.95  # Slight caution but not major penalty
        
        # Athleticism with performance correlation
        athleticism = wr_data.get('athleticism', '')
        if 'Above Average' in athleticism:
            trait_patterns = self.heuristics.get('trait_combinations', {})
            if 'athletic' in trait_patterns:
                evaluation['pattern_matches'].append('athletic_upside_precedent')
                # BTJ showed athletic traits translate to production
                evaluation['heuristic_adjustment'] += 1
        
        # Landing spot analysis with volume expectations
        team = wr_data.get('nfl_team', '')
        if team == 'CHI':
            evaluation['pattern_matches'].append('weak_wr_corps_opportunity')
            # Nabers pattern: weak WR corps = guaranteed volume
            evaluation['btj_vs_nabers_context'].append('CHI similar to NYG - weak WR room guarantees targets')
            evaluation['heuristic_adjustment'] += 3
        
        return evaluation
    
    def get_heuristics_summary(self) -> Dict[str, Any]:
        """Get summary of learned heuristics for debugging"""
        return {
            'case_studies_loaded': len(self.case_studies),
            'heuristics_built': list(self.heuristics.keys()) if self.heuristics else [],
            'draft_capital_insights': self._summarize_draft_insights(),
            'production_insights': self._summarize_production_insights(),
            'trait_insights': self._summarize_trait_insights()
        }
    
    def _summarize_draft_insights(self) -> Dict[str, str]:
        """Summarize draft capital insights"""
        if 'draft_capital_patterns' not in self.heuristics:
            return {}
        
        patterns = self.heuristics['draft_capital_patterns']
        insights = {}
        
        if patterns['top_10_picks']:
            insights['top_10'] = f"{len(patterns['top_10_picks'])} examples of high success"
        
        if patterns['second_round_picks']:
            insights['round_2'] = f"{len(patterns['second_round_picks'])} examples show R2 can succeed"
        
        return insights
    
    def _summarize_production_insights(self) -> Dict[str, str]:
        """Summarize production threshold insights"""
        if 'production_thresholds' not in self.heuristics:
            return {}
        
        thresholds = self.heuristics['production_thresholds']
        insights = {}
        
        if thresholds['low_volume']:
            low_vol = thresholds['low_volume'][0]  # McConkey example
            insights['low_volume'] = f"Success possible even with {low_vol['receptions']} receptions if traits align"
        
        return insights
    
    def _summarize_trait_insights(self) -> Dict[str, str]:
        """Summarize trait combination insights"""
        if 'trait_combinations' not in self.heuristics:
            return {}
        
        traits = self.heuristics['trait_combinations']
        insights = {}
        
        for trait, data in traits.items():
            total_examples = data['high_impact'] + data['moderate_impact']
            success_rate = data['high_impact'] / total_examples if total_examples > 0 else 0
            insights[trait] = f"{success_rate:.1%} high impact rate ({total_examples} examples)"
        
        return insights

# Global heuristics engine instance
rookie_heuristics_engine = RookieHeuristicsEngine()

def get_rookie_heuristics_engine() -> RookieHeuristicsEngine:
    """Get global rookie heuristics engine instance"""
    return rookie_heuristics_engine

if __name__ == "__main__":
    # Test heuristics engine
    engine = RookieHeuristicsEngine()
    
    print("🧠 ROOKIE HEURISTICS ENGINE TEST")
    print("=" * 50)
    
    # Show summary
    summary = engine.get_heuristics_summary()
    print(f"Case Studies: {summary['case_studies_loaded']}")
    print(f"Heuristics Built: {summary['heuristics_built']}")
    
    # Test Luther Burden evaluation
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
        "context_notes": "Poor QB play and scheme in 2024. Dip in production not a red flag."
    }
    
    evaluation = engine.evaluate_2025_wr_with_heuristics(luther_data)
    print(f"\nLuther Burden Heuristics Evaluation:")
    print(f"Adjustment: +{evaluation['heuristic_adjustment']}")
    print(f"Confidence: {evaluation['confidence_modifier']:.1%}")
    print(f"Pattern Matches: {evaluation['pattern_matches']}")
    print(f"Edge Case Flags: {evaluation['edge_case_flags']}")