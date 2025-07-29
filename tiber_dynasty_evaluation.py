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

def evaluate_dynasty_startup_wr_comparison_final():
    """
    Tiber evaluation: Dynasty startup WR comparison - FINAL CALIBRATED ANALYSIS
    Nico Collins vs Ladd McConkey vs Jaxon Smith-Njigba
    Incorporating 2024 rookie performance data, injury volatility, and accurate depth charts
    """
    
    # Validate request through INTENT_FILTER
    request_status = evaluate_request_with_intent_filter(
        "dynasty startup WR comparison for 3rd round draft selection - final calibrated evaluation",
        "evaluate"
    )
    
    if not request_status.get('should_proceed', False):
        return {"error": "Request blocked by INTENT_FILTER", "status": request_status}
    
    evaluator = TiberDynastyEvaluator()
    
    # Nico Collins (HOU WR) - Dynasty Evaluation - FINAL
    collins_evaluation = evaluator.evaluate_player(
        player_name="Nico Collins",
        position="WR",
        team="HOU",
        opportunity_score=9,  # Proven WR1 with 2,000-yard pace, clear alpha role in HOU
        talent_score=9,      # Elite ceiling validated through actual NFL production
        viability_score=6,   # Age 25 + hamstring injury creates ceiling volatility concerns
        insulation_score=8,  # C.J. Stroud connection established, minimal WR competition
        context_notes="Validated elite ceiling with 2,000-yard pace before hamstring injury. Soft tissue injury not structural but could create future volatility. Age 25 in prime window but shorter dynasty runway than younger options.",
        draft_capital="Round 3, Pick 89 (2021) - Irrelevant after elite production validation",
        positional_history="Traditional college WR with proven NFL trajectory"
    )
    
    # Ladd McConkey (LAC WR) - Dynasty Evaluation - FINAL
    mcconkey_evaluation = evaluator.evaluate_player(
        player_name="Ladd McConkey",
        position="WR",
        team="LAC",
        opportunity_score=8,  # 2024 rookie breakout with 82 receptions, 1,149 yards - proven role
        talent_score=8,      # Validated through actual 2024 performance (82/1149/7), elite route-running
        viability_score=9,   # Age 23, rookie contract, maximum dynasty runway
        insulation_score=7,  # Slot specialist with established target share, though Herbert connection still developing
        context_notes="Successful 2024 rookie season (82 rec, 1,149 yards, 7 TDs) validates draft capital. Slot role provides consistent target floor. Herbert connection still developing - no guarantee of elite chemistry yet.",
        draft_capital="Round 2, Pick 34 (2024) - Validated by 2024 rookie production",
        positional_history="Georgia SEC route-running pedigree translating to NFL slot success"
    )
    
    # Jaxon Smith-Njigba (SEA WR) - Dynasty Evaluation - FINAL
    jsn_evaluation = evaluator.evaluate_player(
        player_name="Jaxon Smith-Njigba",
        position="WR",
        team="SEA",
        opportunity_score=6,  # Clearer opportunity in SEA after DK/Lockett departures, but still developing role
        talent_score=8,      # Elite college production, first-round pedigree, route-running ability
        viability_score=9,   # Age 22, massive upside if opportunity crystallizes
        insulation_score=5,  # Geno Smith QB uncertainty, still establishing role in SEA offense
        context_notes="No longer competing with DK Metcalf/Tyler Lockett in 2025. Elite talent with improved opportunity path but still needs to establish consistent role. Age 22 provides maximum upside if situation develops.",
        draft_capital="Round 1, Pick 20 (2023) - High pedigree awaiting opportunity validation",
        positional_history="Ohio State elite route-runner with proven Big Ten production"
    )
    
    # Three-way comparison logic
    players = [collins_evaluation, mcconkey_evaluation, jsn_evaluation]
    players_sorted = sorted(players, key=lambda x: x['dynasty_score'], reverse=True)
    
    winner = players_sorted[0]
    runner_up = players_sorted[1]
    third_place = players_sorted[2]
    
    # Draft capital comparison
    draft_comparison = f"Draft Capital: Collins - {collins_evaluation['draft_capital']} | McConkey - {mcconkey_evaluation['draft_capital']} | Smith-Njigba - {jsn_evaluation['draft_capital']}"
    
    # Counter-case analysis for balanced perspective
    counter_case = {
        'mcconkey_case': "Younger (23 vs 25), proven 2024 rookie production, safer target share in slot role, Justin Herbert longer-term QB stability, less injury volatility risk",
        'jsn_case': "Youngest option (22), highest draft capital pedigree, improved opportunity with DK/Lockett gone, massive ceiling if role crystallizes",
        'collins_concerns': "Age 25 shortens dynasty window, hamstring injury could recur creating volatility, reliance on staying healthy for elite ceiling"
    }
    
    # Alternative position recommendation analysis
    alternative_analysis = {
        'rb_tier_available': "Tier 2 RBs like Kenneth Walker, Najee Harris likely available - more scarcity",
        'qb_superflex_value': "QB2 options like Tua, Dak Prescott provide positional advantage in Superflex",
        'wr_depth_note': "WR position has depth - can find value in rounds 4-6 with upside plays"
    }
    
    return {
        'collins_evaluation': collins_evaluation,
        'mcconkey_evaluation': mcconkey_evaluation,
        'jsn_evaluation': jsn_evaluation,
        'recommendation': {
            'first_choice': winner['player_name'],
            'runner_up': runner_up['player_name'],
            'third_place': third_place['player_name'],
            'score_gap': round(winner['dynasty_score'] - runner_up['dynasty_score'], 1),
            'reasoning': f"Elite ceiling production validated trumps age advantage in dynasty startup context"
        },
        'counter_cases': counter_case,
        'draft_capital_comparison': draft_comparison,
        'dynasty_context': "3rd round Superflex startup - balancing proven ceiling vs dynasty runway",
        'alternative_positions': alternative_analysis,
        'tiber_analysis': "FINAL CALIBRATED ANALYSIS - 2024 rookie production anchored, injury volatility flagged, depth charts verified",
        'calibration_notes': "McConkey 2024 production (82/1149/7) integrated. Herbert connection flagged as developing. JSN depth chart corrected for 2025."
    }

if __name__ == "__main__":
    result = evaluate_dynasty_startup_wr_comparison_final()
    print(json.dumps(result, indent=2))