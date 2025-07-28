#!/usr/bin/env python3
"""
Rookie Crosscheck Analyzer - BTJ vs Nabers Foundation Protocol
Analyzes discrepancies between draft capital, hype, and actual output.
"""

import json
from typing import Dict, List, Any, Optional
from pathlib import Path

class RookieCrosscheckAnalyzer:
    """
    Analyzes 2024 rookie data to identify patterns and discrepancies.
    Focuses on BTJ vs Nabers case study for hype vs output analysis.
    """
    
    def __init__(self):
        self.case_studies = []
        self.crosscheck_insights = {}
        self.load_case_studies()
        self.analyze_crosscheck_patterns()
    
    def load_case_studies(self):
        """Load updated case studies with actual 2024 data"""
        case_studies_path = Path("data/rookie_success_case_studies_2024.json")
        
        if case_studies_path.exists():
            try:
                with open(case_studies_path, 'r') as f:
                    self.case_studies = json.load(f)
                print(f"📊 Loaded {len(self.case_studies)} case studies for crosscheck analysis")
            except Exception as e:
                print(f"⚠️ Failed to load case studies: {e}")
                self.case_studies = []
    
    def analyze_crosscheck_patterns(self):
        """Analyze patterns and discrepancies from 2024 data"""
        if not self.case_studies:
            return
        
        self.crosscheck_insights = {
            'draft_capital_vs_output': self._analyze_capital_vs_output(),
            'hype_vs_reality': self._analyze_hype_vs_reality(),
            'context_vs_performance': self._analyze_context_vs_performance(),
            'consistency_vs_spikes': self._analyze_consistency_patterns(),
            'btj_vs_nabers_lessons': self._analyze_btj_nabers_case()
        }
        
        print(f"🧪 Built {len(self.crosscheck_insights)} crosscheck analysis categories")
    
    def _analyze_capital_vs_output(self) -> Dict[str, Any]:
        """Analyze draft capital vs actual fantasy output"""
        analysis = {
            'overperformers': [],
            'underperformers': [],
            'met_expectations': [],
            'key_insights': []
        }
        
        for case in self.case_studies:
            draft_capital = case.get('draft_capital', '')
            actual_stats = case.get('actual_2024_stats', {})
            fantasy_finish = actual_stats.get('fantasy_finish', '')
            
            player_data = {
                'name': case['player_name'],
                'draft_capital': draft_capital,
                'fantasy_finish': fantasy_finish,
                'context': case.get('context_notes', '')
            }
            
            # BTJ: Late R1 → WR12 (overperformed)
            if 'Brian Thomas' in case['player_name']:
                analysis['overperformers'].append(player_data)
                analysis['key_insights'].append({
                    'insight': 'Late R1 picks can outproduce Top 10 picks',
                    'example': 'BTJ (Late R1) finished WR12 vs Nabers (Top 10) WR6-7',
                    'implication': 'Don\'t auto-penalize late draft capital'
                })
            
            # Nabers: Top 10 → WR6-7 (met expectations but context dependent)
            elif 'Malik Nabers' in case['player_name']:
                analysis['met_expectations'].append(player_data)
                analysis['key_insights'].append({
                    'insight': 'Top 10 picks get volume but context affects efficiency',
                    'example': 'Nabers had 170 targets but only 7 TDs due to QB play',
                    'implication': 'High draft capital ≠ automatic TD upside'
                })
        
        return analysis
    
    def _analyze_hype_vs_reality(self) -> Dict[str, Any]:
        """Analyze pre-draft hype vs actual rookie performance"""
        analysis = {
            'hype_justified': [],
            'hype_exceeded': [],
            'context_dependent': [],
            'lessons': []
        }
        
        for case in self.case_studies:
            player_name = case['player_name']
            rookie_projection = case.get('rookie_projection', '')
            actual_outcome = case.get('actual_outcome', '')
            
            if 'Brian Thomas' in player_name:
                analysis['hype_exceeded'].append({
                    'name': player_name,
                    'projection': rookie_projection,
                    'outcome': actual_outcome,
                    'note': 'Set franchise rookie records despite lower hype'
                })
                
            elif 'Malik Nabers' in player_name:
                analysis['context_dependent'].append({
                    'name': player_name,
                    'projection': rookie_projection,
                    'outcome': actual_outcome,
                    'note': 'Met volume expectations but TDs limited by context'
                })
        
        analysis['lessons'] = [
            'Draft capital doesn\'t always predict rookie year output ranking',
            'Context (QB play, offensive system) significantly affects efficiency',
            'Late R1 picks can have cleaner paths to targets than Top 10 picks'
        ]
        
        return analysis
    
    def _analyze_context_vs_performance(self) -> Dict[str, Any]:
        """Analyze how context affected performance vs projections"""
        analysis = {
            'overcame_poor_context': [],
            'context_limited': [],
            'context_helped': [],
            'insights': []
        }
        
        for case in self.case_studies:
            context_notes = case.get('context_notes', '')
            actual_outcome = case.get('actual_outcome', '')
            player_name = case['player_name']
            
            if 'Brian Thomas' in player_name and 'QB instability' in context_notes:
                analysis['overcame_poor_context'].append({
                    'name': player_name,
                    'poor_context': 'QB instability with Mac Jones',
                    'outcome': 'Still set franchise records',
                    'lesson': 'Elite talent can overcome poor QB play'
                })
                
            elif 'Malik Nabers' in player_name and 'poor QB' in context_notes:
                analysis['context_limited'].append({
                    'name': player_name,
                    'limiting_context': 'Poor QB play limited TDs',
                    'outcome': 'Elite volume but efficiency suffered',
                    'lesson': 'Context affects ceiling more than floor'
                })
        
        analysis['insights'] = [
            'Poor context affects TD production more than target volume',
            'Elite route runners (Nabers) get targets regardless of QB',
            'Athletic freaks (BTJ) can make contested catches with any QB'
        ]
        
        return analysis
    
    def _analyze_consistency_patterns(self) -> Dict[str, Any]:
        """Analyze consistency vs spike week patterns"""
        analysis = {
            'consistent_performers': [],
            'spike_dependent': [],
            'volume_vs_efficiency': []
        }
        
        for case in self.case_studies:
            actual_stats = case.get('actual_2024_stats', {})
            context_notes = case.get('context_notes', '')
            player_name = case['player_name']
            
            if 'Brian Thomas' in player_name:
                analysis['consistent_performers'].append({
                    'name': player_name,
                    'pattern': '6 straight games with 10+ targets',
                    'note': 'Consistency despite QB changes'
                })
                
            elif 'Malik Nabers' in player_name:
                analysis['volume_vs_efficiency'].append({
                    'name': player_name,
                    'volume': '170 targets (2nd in NFL)',
                    'efficiency': 'Only 7 TDs due to red zone context',
                    'note': 'High floor, context-dependent ceiling'
                })
        
        return analysis
    
    def _analyze_btj_nabers_case(self) -> Dict[str, Any]:
        """Specific BTJ vs Nabers case study analysis"""
        btj_data = None
        nabers_data = None
        
        for case in self.case_studies:
            if 'Brian Thomas' in case['player_name']:
                btj_data = case
            elif 'Malik Nabers' in case['player_name']:
                nabers_data = case
        
        if not btj_data or not nabers_data:
            return {'error': 'Missing BTJ or Nabers data'}
        
        return {
            'draft_capital_comparison': {
                'btj': btj_data['draft_capital'],
                'nabers': nabers_data['draft_capital'],
                'insight': 'Late R1 vs Top 10 - BTJ outproduced despite lower capital'
            },
            'actual_output_comparison': {
                'btj_stats': btj_data['actual_2024_stats'],
                'nabers_stats': nabers_data['actual_2024_stats'],
                'key_difference': 'BTJ: 1282 yards, 10 TDs vs Nabers: 1204 yards, 7 TDs'
            },
            'context_analysis': {
                'btj_context': btj_data['context_notes'],
                'nabers_context': nabers_data['context_notes'],
                'lesson': 'Both overcame poor QB play differently - BTJ with big plays, Nabers with volume'
            },
            'projection_implications': {
                'for_late_r1': 'Don\'t auto-penalize - can have cleaner target paths',
                'for_top_10': 'Volume guaranteed but efficiency context-dependent',
                'for_evaluators': 'Draft capital informs opportunity, not output ceiling'
            }
        }
    
    def get_crosscheck_summary(self) -> Dict[str, Any]:
        """Get comprehensive crosscheck analysis summary"""
        return {
            'total_insights': len(self.crosscheck_insights),
            'key_lessons': [
                'Draft capital ≠ fantasy output ranking',
                'Context affects efficiency more than volume',
                'Athletic traits can overcome poor QB play',
                'Late R1 picks often have cleaner paths than Top 10'
            ],
            'btj_vs_nabers_key_takeaway': 'Use draft capital for opportunity assessment, not output prediction',
            'crosscheck_insights': self.crosscheck_insights
        }
    
    def apply_crosscheck_to_2025_prospect(self, prospect_data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply crosscheck insights to evaluate 2025 prospect"""
        analysis = {
            'crosscheck_flags': [],
            'btj_nabers_context': [],
            'projection_adjustments': [],
            'confidence_modifiers': []
        }
        
        draft_capital = prospect_data.get('draft_capital', '')
        context_notes = prospect_data.get('context_notes', '')
        
        # Apply BTJ vs Nabers lessons
        if 'Round 1' in draft_capital and 'Late' in draft_capital:
            analysis['btj_nabers_context'].append('Late R1 pattern - BTJ showed these can outproduce Top 10')
            analysis['projection_adjustments'].append('No draft capital penalty - focus on opportunity')
            
        elif 'Round 2' in draft_capital:
            analysis['btj_nabers_context'].append('Round 2 pattern - McConkey showed role-dependent success')
            analysis['projection_adjustments'].append('Context and landing spot critical for R2 picks')
        
        # Context analysis
        if 'poor' in context_notes.lower():
            analysis['crosscheck_flags'].append('Poor context flag - but BTJ showed this can be overcome')
            analysis['confidence_modifiers'].append('Slight caution but not major penalty (BTJ lesson)')
        
        return analysis

# Global crosscheck analyzer instance
rookie_crosscheck_analyzer = RookieCrosscheckAnalyzer()

def get_rookie_crosscheck_analyzer() -> RookieCrosscheckAnalyzer:
    """Get global rookie crosscheck analyzer instance"""
    return rookie_crosscheck_analyzer

if __name__ == "__main__":
    # Test crosscheck analyzer
    analyzer = RookieCrosscheckAnalyzer()
    
    print("🧪 ROOKIE CROSSCHECK ANALYZER TEST")
    print("=" * 50)
    
    summary = analyzer.get_crosscheck_summary()
    print(f"Total Insights: {summary['total_insights']}")
    print(f"Key Lessons: {summary['key_lessons']}")
    print(f"BTJ vs Nabers Takeaway: {summary['btj_vs_nabers_key_takeaway']}")
    
    # Show BTJ vs Nabers specific analysis
    btj_nabers = summary['crosscheck_insights']['btj_vs_nabers_lessons']
    print(f"\nBTJ vs Nabers Case Study:")
    print(f"Draft Capital: {btj_nabers['draft_capital_comparison']}")
    print(f"Key Difference: {btj_nabers['actual_output_comparison']['key_difference']}")
    print(f"Lesson: {btj_nabers['context_analysis']['lesson']}")