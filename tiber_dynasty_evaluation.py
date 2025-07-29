#!/usr/bin/env python3
"""
Tiber Dynasty Player Evaluation
Comprehensive analysis framework for dynasty investment decisions
"""

import json
from typing import Dict, Any, Tuple
from tiber_identity import evaluate_request_with_intent_filter

class TiberDynastyEvaluator:
    def __init__(self):
        self.evaluation_criteria = {
            'opportunity': 0.35,  # Role clarity, target competition, depth chart
            'talent': 0.30,      # Athletic profile, college production, draft capital
            'viability': 0.25,   # Age, contract, injury history
            'insulation': 0.10   # Production floor, scheme fit, QB stability
        }
    
    def evaluate_player(self, player_name: str, position: str, team: str, 
                       opportunity_score: int, talent_score: int, 
                       viability_score: int, insulation_score: int,
                       context_notes: str, draft_capital: str = None,
                       positional_history: str = None) -> Dict[str, Any]:
        """
        Evaluate a player using Tiber's dynasty framework
        
        Args:
            player_name: Full player name
            position: Player position (RB, WR, etc.)
            team: NFL team
            opportunity_score: 1-10 score for role opportunity
            talent_score: 1-10 score for talent evaluation
            viability_score: 1-10 score for long-term viability
            insulation_score: 1-10 score for production insulation
            context_notes: Contextual analysis notes
            
        Returns:
            Dictionary with comprehensive evaluation
        """
        
        # Calculate weighted dynasty score
        dynasty_score = (
            opportunity_score * self.evaluation_criteria['opportunity'] +
            talent_score * self.evaluation_criteria['talent'] +
            viability_score * self.evaluation_criteria['viability'] +
            insulation_score * self.evaluation_criteria['insulation']
        )
        
        # Determine tier based on dynasty score
        if dynasty_score >= 8.5:
            tier = "S"
        elif dynasty_score >= 7.5:
            tier = "A"
        elif dynasty_score >= 6.5:
            tier = "B"
        elif dynasty_score >= 5.5:
            tier = "C"
        else:
            tier = "D"
        
        return {
            'player_name': player_name,
            'position': position,
            'team': team,
            'dynasty_score': round(dynasty_score, 1),
            'tier': tier,
            'component_scores': {
                'opportunity': opportunity_score,
                'talent': talent_score,
                'viability': viability_score,
                'insulation': insulation_score
            },
            'context_notes': context_notes,
            'draft_capital': draft_capital,
            'positional_history': positional_history,
            'evaluation_timestamp': '2025-01-29'
        }
    
    def compare_players(self, player1: Dict[str, Any], player2: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compare two player evaluations and provide recommendation
        
        Args:
            player1: First player evaluation
            player2: Second player evaluation
            
        Returns:
            Comparison analysis with recommendation
        """
        
        score_diff = player1['dynasty_score'] - player2['dynasty_score']
        
        if abs(score_diff) < 0.5:
            confidence = 6
            recommendation = f"Close evaluation - slight edge to {player1['player_name'] if score_diff > 0 else player2['player_name']}"
        elif abs(score_diff) < 1.0:
            confidence = 7
            recommendation = f"Moderate preference for {player1['player_name'] if score_diff > 0 else player2['player_name']}"
        elif abs(score_diff) < 1.5:
            confidence = 8
            recommendation = f"Clear preference for {player1['player_name'] if score_diff > 0 else player2['player_name']}"
        else:
            confidence = 9
            recommendation = f"Strong preference for {player1['player_name'] if score_diff > 0 else player2['player_name']}"
        
        winner = player1 if score_diff > 0 else player2
        
        # Format draft capital comparison if available
        draft_comparison = ""
        if player1.get('draft_capital') and player2.get('draft_capital'):
            draft_comparison = f"Draft Capital: {player1['player_name']} - {player1['draft_capital']} | {player2['player_name']} - {player2['draft_capital']}"
        
        return {
            'recommendation': winner['player_name'],
            'confidence_rating': confidence,
            'score_difference': abs(score_diff),
            'explanation': recommendation,
            'key_differentiators': self._identify_differentiators(player1, player2),
            'tier_comparison': f"{player1['player_name']}: {player1['tier']} | {player2['player_name']}: {player2['tier']}",
            'draft_capital_comparison': draft_comparison
        }
    
    def _identify_differentiators(self, player1: Dict[str, Any], player2: Dict[str, Any]) -> str:
        """Identify key differentiating factors between players"""
        p1_scores = player1['component_scores']
        p2_scores = player2['component_scores']
        
        differences = []
        for category in p1_scores:
            diff = p1_scores[category] - p2_scores[category]
            if abs(diff) >= 2:
                better_player = player1['player_name'] if diff > 0 else player2['player_name']
                differences.append(f"{category} advantage: {better_player}")
        
        return "; ".join(differences) if differences else "Similar across all categories"

def evaluate_tyrone_tracy_vs_cam_skattebo_corrected():
    """
    Tiber evaluation: Tyrone Tracy Jr. vs Cam Skattebo dynasty comparison - CORRECTED
    Both players are on the New York Giants
    """
    
    # Validate request through INTENT_FILTER
    request_status = evaluate_request_with_intent_filter(
        "dynasty player comparison analysis within fantasy football domain - corrected evaluation",
        "evaluate"
    )
    
    if not request_status.get('should_proceed', False):
        return {"error": "Request blocked by INTENT_FILTER", "status": request_status}
    
    evaluator = TiberDynastyEvaluator()
    
    # Tyrone Tracy Jr. (NYG RB) - 2025 Dynasty Evaluation - CORRECTED
    tracy_evaluation = evaluator.evaluate_player(
        player_name="Tyrone Tracy Jr.",
        position="RB",
        team="NYG",
        opportunity_score=6,  # Established role but now has competition from Skattebo
        talent_score=5,      # Undrafted, emerged through opportunity more than elite talent
        viability_score=8,   # Young (23), proven NFL production, contract security
        insulation_score=5,  # Limited pass-catching, TD-dependent in Giants offense
        context_notes="2024 breakout with 914 rushing yards as undrafted rookie. Established NFL track record but faces 2025 competition from higher draft capital investment in Skattebo. Role may shift to 1A/1B situation.",
        draft_capital="Undrafted Free Agent (2024)",
        positional_history="College WR converted to RB - affects pass-catching development curve and route-running ability"
    )
    
    # Cam Skattebo (NYG RB) - 2025 Dynasty Evaluation - CORRECTED
    skattebo_evaluation = evaluator.evaluate_player(
        player_name="Cam Skattebo",
        position="RB",
        team="NYG",
        opportunity_score=7,  # Higher draft investment suggests planned significant role
        talent_score=8,      # Elite college production, higher draft capital indicates NFL belief
        viability_score=6,   # Rookie durability unknown, needs to prove NFL transition
        insulation_score=7,  # Versatile skillset, pass-catching ability, size for goal line
        context_notes="Explosive college back (1,398 rushing yards, 19 TDs in 2024) drafted ahead of Tracy Jr. in 2025. Higher draft capital suggests Giants plan significant role. Versatile skillset with pass-catching upside but must prove NFL durability and transition.",
        draft_capital="Round 3, Pick 82 (2025)",
        positional_history="Traditional college RB with consistent backfield experience"
    )
    
    # Generate comparison
    comparison = evaluator.compare_players(tracy_evaluation, skattebo_evaluation)
    
    return {
        'tracy_evaluation': tracy_evaluation,
        'skattebo_evaluation': skattebo_evaluation,
        'comparison': comparison,
        'tiber_analysis': "CORRECTED ANALYSIS - Both players on NYG, accounting for same-team competition",
        'evaluation_framework': evaluator.evaluation_criteria,
        'correction_notes': "Previous analysis incorrectly placed Skattebo on ARI. Both players compete for Giants backfield touches."
    }

if __name__ == "__main__":
    result = evaluate_tyrone_tracy_vs_cam_skattebo_corrected()
    print(json.dumps(result, indent=2))