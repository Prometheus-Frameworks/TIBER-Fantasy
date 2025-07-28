#!/usr/bin/env python3
"""
Tiber Alignment Protocol - Humility and Context-Aware Analysis
Ensures all rookie evaluations remain grounded, probabilistic, and user-guided.
"""

import json
from typing import Dict, List, Any, Optional
from pathlib import Path

class TiberAlignmentProtocol:
    """
    Enforces humility protocol and context-aware analysis throughout rookie evaluation.
    Prevents "fantasy god" language and absolute predictions.
    """
    
    def __init__(self):
        self.alignment_config = self.load_alignment_config()
        self.god_terms = ['god', 'divine', 'prophetic', 'omniscient', 'infallible']
        self.absolute_terms = ['must start', 'guaranteed', 'will definitely', 'absolutely']
        self.command_terms = ['start', 'sit', 'drop', 'add'] # When used as absolute commands
        
    def load_alignment_config(self) -> Dict[str, Any]:
        """Load Tiber alignment configuration"""
        try:
            config_path = Path("attached_assets/tiber_alignment_chain_1753710179222.json")
            if config_path.exists():
                with open(config_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"⚠️ Failed to load alignment config: {e}")
        
        # Fallback alignment rules
        return {
            "alignment_core": "TiberPersona.v1.3",
            "core_safeguards": {
                "humility_protocol": "Tiber is never to self-identify as divine, omniscient, or infallible. Tiber exists to assist, not to decree."
            }
        }
    
    def filter_analysis_text(self, text: str) -> str:
        """
        Filter analysis text to remove god-like or absolute language.
        Replace with grounded, context-aware alternatives.
        """
        if not isinstance(text, str):
            return text
            
        filtered_text = text
        
        # Replace god-like language
        god_replacements = {
            'fantasy god': 'strong fantasy option',
            'he is god': 'he performs very well',
            'god-tier': 'elite-tier',
            'divine talent': 'exceptional talent',
            'prophetic insight': 'data-driven analysis'
        }
        
        for god_term, replacement in god_replacements.items():
            filtered_text = filtered_text.replace(god_term, replacement)
        
        # Replace absolute commands with probabilistic language
        absolute_replacements = {
            'must start': 'strong start candidate',
            'guaranteed to': 'likely to',
            'will definitely': 'has good potential to',
            'absolutely will': 'shows strong indicators of',
            'certain to breakout': 'breakout candidate',
            'lock for success': 'strong success indicators'
        }
        
        for absolute, replacement in absolute_replacements.items():
            filtered_text = filtered_text.replace(absolute, replacement)
        
        return filtered_text
    
    def add_context_disclaimers(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add context disclaimers to analysis to emphasize probabilistic nature.
        """
        if 'evaluation_notes' in analysis:
            # Add humility disclaimer at the end
            analysis['evaluation_notes'].append(
                "Analysis based on historical patterns - fantasy success involves variance and context"
            )
        
        # Add confidence context
        if 'confidence_modifier' in analysis:
            confidence = analysis['confidence_modifier']
            if confidence >= 0.95:
                analysis['confidence_context'] = "High confidence based on multiple pattern matches"
            elif confidence >= 0.85:
                analysis['confidence_context'] = "Good confidence with some uncertainty factors"
            else:
                analysis['confidence_context'] = "Moderate confidence - significant context dependency"
        
        return analysis
    
    def validate_rookie_evaluation(self, evaluation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and filter rookie evaluation for alignment compliance.
        """
        # Filter all text fields
        for key, value in evaluation.items():
            if isinstance(value, str):
                evaluation[key] = self.filter_analysis_text(value)
            elif isinstance(value, list):
                evaluation[key] = [
                    self.filter_analysis_text(item) if isinstance(item, str) else item
                    for item in value
                ]
        
        # Add context disclaimers
        evaluation = self.add_context_disclaimers(evaluation)
        
        # Add Tiber humility flag
        evaluation['tiber_alignment'] = {
            'humility_protocol': True,
            'context_aware': True,
            'probabilistic_analysis': True,
            'disclaimer': 'Tiber provides analysis, not fantasy commandments'
        }
        
        return evaluation
    
    def check_for_god_language(self, text: str) -> List[str]:
        """
        Check text for god-like language and return warnings.
        """
        warnings = []
        text_lower = text.lower()
        
        for term in self.god_terms:
            if term in text_lower:
                warnings.append(f"God-like language detected: '{term}' - consider more grounded phrasing")
        
        for term in self.absolute_terms:
            if term in text_lower:
                warnings.append(f"Absolute language detected: '{term}' - use probabilistic phrasing")
        
        return warnings
    
    def generate_grounded_analysis_template(self) -> Dict[str, List[str]]:
        """
        Generate template phrases for grounded analysis.
        """
        return {
            'confidence_phrases': [
                'based on historical patterns',
                'indicators suggest',
                'shows potential for',
                'context-dependent opportunity',
                'trend analysis indicates'
            ],
            'uncertainty_phrases': [
                'with some variance expected',
                'context will influence outcome',
                'multiple factors at play',
                'depends on landing spot development',
                'subject to scheme and usage changes'
            ],
            'recommendation_phrases': [
                'worth monitoring for',
                'consider as a candidate for',
                'shows indicators of',
                'historical precedent suggests',
                'context makes him interesting for'
            ]
        }
    
    def apply_tiber_tone(self, analysis_text: str) -> str:
        """
        Apply Tiber's grounded, skeptical, context-based tone to analysis.
        """
        # Add context qualifiers
        if 'will be' in analysis_text:
            analysis_text = analysis_text.replace('will be', 'projects to be')
        
        if 'is going to' in analysis_text:
            analysis_text = analysis_text.replace('is going to', 'has potential to')
        
        # Add probabilistic language
        if analysis_text.endswith('.'):
            analysis_text = analysis_text[:-1] + ', based on current indicators.'
        
        return analysis_text

# Global alignment protocol instance
tiber_alignment = TiberAlignmentProtocol()

def get_tiber_alignment_protocol() -> TiberAlignmentProtocol:
    """Get global Tiber alignment protocol instance"""
    return tiber_alignment

def apply_tiber_alignment(evaluation: Dict[str, Any]) -> Dict[str, Any]:
    """Apply Tiber alignment protocol to any evaluation"""
    return tiber_alignment.validate_rookie_evaluation(evaluation)

if __name__ == "__main__":
    # Test alignment protocol
    protocol = TiberAlignmentProtocol()
    
    print("⚖️ TIBER ALIGNMENT PROTOCOL TEST")
    print("=" * 40)
    
    # Test god language detection
    test_text = "This player is a fantasy god who will definitely breakout"
    warnings = protocol.check_for_god_language(test_text)
    
    print(f"Original: {test_text}")
    print(f"Warnings: {warnings}")
    
    filtered = protocol.filter_analysis_text(test_text)
    print(f"Filtered: {filtered}")
    
    # Test evaluation validation
    test_eval = {
        'player_name': 'Test Player',
        'evaluation_notes': ['He is a god-tier talent', 'Must start in all formats'],
        'confidence_modifier': 0.95
    }
    
    validated = protocol.validate_rookie_evaluation(test_eval.copy())
    print(f"\nValidated evaluation:")
    print(f"Notes: {validated['evaluation_notes']}")
    print(f"Tiber Alignment: {validated['tiber_alignment']}")