#!/usr/bin/env python3
"""
Rookie Tight End Insulation Boost System – v1.0
Applies a boost to rookie TE ratings if they meet high-insulation thresholds 
based on draft capital, production, traits, and landing spot.

Integration ready for Flask platform with TE scoring module compatibility.
"""

def is_rookie_tight_end(player):
    """
    Definition: What is a Rookie TE?
    
    A "Rookie TE" is defined as a tight end who:
    – Is in their FIRST NFL season (rookie == True),
    – Has NOT played any prior NFL games (no 2024 game log present),
    – Was drafted in the current rookie class (e.g., 2025 if processing pre-season rankings for 2025).
    
    If a TE already has valid 2024 NFL game logs, they are NOT a rookie for 2025 ratings.
    These players should be classified as "Second-Year TEs" and graded using full production scoring, not projection insulation.
    """
    return (
        getattr(player, 'position', '') == "TE" and 
        getattr(player, 'rookie', False) is True and 
        not hasattr(player, 'game_logs_2024')
    )


def adjust_for_brock_bowers(player):
    """
    Brock Bowers Override
    
    Brock Bowers is NOT a rookie anymore if 2024 game logs exist.
    However, he IS the current meta TE1 and must be evaluated as the ceiling TE profile.
    """
    player_name = getattr(player, 'name', '')
    
    if player_name == "Brock Bowers":
        player.meta_te1 = True
        player.is_rookie = False
        player.scouting_report = "Represents elite TE ceiling: 1st-round capital, RAC monster, high-volume usage, matchup nightmare."
        player.rating_ceiling_tag = True  # For frontend UI badge if needed
        player.rookie = False  # Override any rookie flag
        
        # Add 2024 context if game logs exist
        if hasattr(player, 'game_logs_2024') or hasattr(player, 'fantasy_points_ppr'):
            player.second_year_te = True
            player.classification = "Elite Second-Year TE (Meta TE1)"
        
        return player
    
    return player


def apply_meta_te1_evaluation(player, base_score):
    """
    Handle meta TE1 evaluation with no penalty cap.
    
    If player.meta_te1 is True, apply no penalty cap even if score exceeds 99
    — this represents the baseline top tier for TE evaluation.
    """
    if getattr(player, 'meta_te1', False):
        # No penalty cap for meta TE1 - represents elite ceiling
        player.evaluation_notes = getattr(player, 'evaluation_notes', [])
        player.evaluation_notes.append("Meta TE1: No penalty cap applied - elite ceiling baseline")
        return base_score  # Return uncapped score
    
    # Standard penalty cap for non-meta TE1 players
    return min(base_score, 99)


def batch_evaluate_rookie_tes(players):
    """
    Batch evaluation function that properly applies the evaluation flow:
    1. Apply Brock Bowers override to all players
    2. Check rookie TE status
    3. Apply insulation boost for qualifying rookies
    4. Handle meta TE1 scoring with no penalty cap
    """
    results = []
    
    for player in players:
        # Step 1: Apply Brock Bowers override first
        player = adjust_for_brock_bowers(player)
        
        # Step 2: Get evaluation breakdown
        breakdown = get_rookie_te_insulation_breakdown(player)
        
        # Step 3: Apply meta TE1 evaluation if applicable
        if hasattr(player, 'base_te_score'):
            final_score = apply_meta_te1_evaluation(player, player.base_te_score)
            breakdown['final_score'] = final_score
            breakdown['meta_te1_applied'] = getattr(player, 'meta_te1', False)
        
        results.append(breakdown)
    
    return results


def apply_rookie_te_insulation_boost(player):
    """
    Calculate insulation boost for rookie TEs based on four core criteria:
    1. Draft Capital (1st round = 10 pts)
    2. Production (800+ yards + target share/receptions = 8-10 pts)
    3. Scheme-Versatile Traits (YPR, blocking, alignments = up to 10 pts)
    4. Landing Spot Stability (stable QB, TE-friendly team, depth position = up to 3 pts)
    
    Returns insulation_boost (0-12 points) if all core criteria met.
    
    IMPORTANT: Only applies to TRUE rookie TEs. Players with 2024 game logs 
    are classified as second-year TEs and use different evaluation.
    
    Evaluation Flow:
    1. Apply Brock Bowers override first
    2. Check if player is rookie TE using is_rookie_tight_end()
    3. Calculate insulation boost only for qualifying rookies
    """
    # Step 1: Apply Brock Bowers override first
    player = adjust_for_brock_bowers(player)
    
    # Step 2: Check if player is actually a rookie TE
    if not is_rookie_tight_end(player):
        return 0  # No insulation boost for non-rookies
    
    # Step 3: Calculate insulation boost for qualifying rookie TEs
    insulation_boost = 0

    # ✅ Draft Capital Score
    draft_capital_score = 10 if getattr(player, 'draft_round', None) == 1 else 0

    # ✅ Production Score (fallback to receptions if target share unavailable)
    production_score = 0
    college_yards = getattr(player, 'college_receiving_yards', 0)
    
    if college_yards >= 800:
        # Primary: Use target share if available
        college_target_share = getattr(player, 'college_target_share', None)
        if college_target_share and college_target_share >= 0.20:
            production_score = 10
        # Fallback: Use receptions
        elif getattr(player, 'college_receptions', 0) >= 60:
            production_score = 8

    # ✅ Scheme-Versatile Traits
    scheme_score = 0
    
    # YPR as RAC proxy
    yards_per_reception = getattr(player, 'yards_per_reception', None)
    if yards_per_reception and yards_per_reception >= 12:
        scheme_score += 3
    
    # Blocking ability
    blocking_grade = getattr(player, 'blocking_grade', None)
    if blocking_grade in ['solid', 'plus']:
        scheme_score += 3
    
    # Snap alignment versatility
    snap_alignment_count = getattr(player, 'snap_alignment_count', None)
    if snap_alignment_count and snap_alignment_count >= 3:
        scheme_score += 4

    # ✅ Landing Spot Stability (hardcoded until OASIS activates)
    team_stability_score = 0
    
    # Stable QB list
    STABLE_QB_LIST = [
        'Patrick Mahomes', 'Josh Allen', 'Joe Burrow', 'Justin Herbert', 
        'Jalen Hurts', 'Lamar Jackson', 'CJ Stroud'
    ]
    
    team_qb = getattr(player, 'team_qb', '')
    if team_qb in STABLE_QB_LIST:
        team_stability_score += 1
    
    # TE-friendly teams (BAL, KC, LV, etc.)
    team_prefers_tes = getattr(player, 'team_prefers_tes', False)
    if team_prefers_tes:
        team_stability_score += 1
    
    # Depth chart position
    te_depth_chart_rank = getattr(player, 'te_depth_chart_rank', None)
    if te_depth_chart_rank == 1:
        team_stability_score += 1

    # ✅ Apply Boost if All Core Insulation Traits Met
    if (
        draft_capital_score == 10 and
        production_score >= 8 and
        scheme_score >= 8 and
        team_stability_score >= 2
    ):
        insulation_boost = 12  # Max insulation multiplier

    return insulation_boost


def get_rookie_te_insulation_breakdown(player):
    """
    Detailed breakdown of insulation scoring for debugging and analysis.
    Returns dictionary with component scores and boost eligibility.
    
    Follows proper evaluation flow:
    1. Check if player is rookie TE
    2. Apply Brock Bowers override
    3. Calculate insulation components if eligible
    """
    # Apply Brock Bowers override first
    player = adjust_for_brock_bowers(player)
    
    # Check if player qualifies as rookie TE
    is_rookie = is_rookie_tight_end(player)
    
    if not is_rookie:
        return {
            'player_name': getattr(player, 'name', 'Unknown'),
            'is_rookie_te': False,
            'classification': getattr(player, 'classification', 'Non-rookie TE'),
            'meta_te1': getattr(player, 'meta_te1', False),
            'insulation_boost': 0,
            'eligible_for_boost': False,
            'reason': 'Not a rookie TE - uses production-based evaluation instead'
        }
    
    # Calculate each component for rookie TEs
    draft_capital_score = 10 if getattr(player, 'draft_round', None) == 1 else 0
    
    production_score = 0
    college_yards = getattr(player, 'college_receiving_yards', 0)
    if college_yards >= 800:
        college_target_share = getattr(player, 'college_target_share', None)
        if college_target_share and college_target_share >= 0.20:
            production_score = 10
        elif getattr(player, 'college_receptions', 0) >= 60:
            production_score = 8
    
    scheme_score = 0
    yards_per_reception = getattr(player, 'yards_per_reception', None)
    if yards_per_reception and yards_per_reception >= 12:
        scheme_score += 3
    
    blocking_grade = getattr(player, 'blocking_grade', None)
    if blocking_grade in ['solid', 'plus']:
        scheme_score += 3
    
    snap_alignment_count = getattr(player, 'snap_alignment_count', None)
    if snap_alignment_count and snap_alignment_count >= 3:
        scheme_score += 4
    
    team_stability_score = 0
    STABLE_QB_LIST = [
        'Patrick Mahomes', 'Josh Allen', 'Joe Burrow', 'Justin Herbert', 
        'Jalen Hurts', 'Lamar Jackson', 'CJ Stroud'
    ]
    
    team_qb = getattr(player, 'team_qb', '')
    if team_qb in STABLE_QB_LIST:
        team_stability_score += 1
    
    if getattr(player, 'team_prefers_tes', False):
        team_stability_score += 1
    
    if getattr(player, 'te_depth_chart_rank', None) == 1:
        team_stability_score += 1
    
    # Check eligibility
    eligible_for_boost = (
        draft_capital_score == 10 and
        production_score >= 8 and
        scheme_score >= 8 and
        team_stability_score >= 2
    )
    
    insulation_boost = 12 if eligible_for_boost else 0
    
    return {
        'player_name': getattr(player, 'name', 'Unknown'),
        'draft_capital_score': draft_capital_score,
        'production_score': production_score,
        'scheme_score': scheme_score,
        'team_stability_score': team_stability_score,
        'total_possible': 12,
        'insulation_boost': insulation_boost,
        'eligible_for_boost': eligible_for_boost,
        'breakdown': {
            'draft_capital_met': draft_capital_score == 10,
            'production_met': production_score >= 8,
            'scheme_met': scheme_score >= 8,
            'stability_met': team_stability_score >= 2
        }
    }


def test_rookie_te_insulation_system():
    """
    Test the insulation system with sample rookie TE profiles.
    """
    
    class TestPlayer:
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)
    
    # Test Case 1: High insulation rookie (all criteria met)
    high_insulation_te = TestPlayer(
        name="High Insulation TE",
        draft_round=1,
        college_receiving_yards=950,
        college_target_share=0.25,
        college_receptions=65,
        yards_per_reception=13.2,
        blocking_grade="solid",
        snap_alignment_count=4,
        team_qb="Patrick Mahomes",
        team_prefers_tes=True,
        te_depth_chart_rank=1
    )
    
    # Test Case 2: Medium insulation rookie (missing some criteria)
    medium_insulation_te = TestPlayer(
        name="Medium Insulation TE",
        draft_round=2,  # Not 1st round
        college_receiving_yards=850,
        college_receptions=70,
        yards_per_reception=11.5,  # Below 12 threshold
        blocking_grade="plus",
        snap_alignment_count=3,
        team_qb="Joe Burrow",
        team_prefers_tes=False,
        te_depth_chart_rank=1
    )
    
    # Test Case 3: Low insulation rookie (few criteria met)
    low_insulation_te = TestPlayer(
        name="Low Insulation TE",
        draft_round=4,
        college_receiving_yards=650,  # Below 800 threshold
        college_receptions=45,
        yards_per_reception=10.8,
        blocking_grade="average",
        snap_alignment_count=2,
        team_qb="Unknown QB",
        team_prefers_tes=False,
        te_depth_chart_rank=2
    )
    
    test_players = [high_insulation_te, medium_insulation_te, low_insulation_te]
    
    print("🎯 ROOKIE TE INSULATION BOOST SYSTEM TEST")
    print("=" * 50)
    
    for player in test_players:
        breakdown = get_rookie_te_insulation_breakdown(player)
        boost = apply_rookie_te_insulation_boost(player)
        
        print(f"\n📊 {breakdown['player_name']}")
        print(f"Draft Capital: {breakdown['draft_capital_score']}/10 ({'✅' if breakdown['breakdown']['draft_capital_met'] else '❌'})")
        print(f"Production: {breakdown['production_score']}/10 ({'✅' if breakdown['breakdown']['production_met'] else '❌'})")
        print(f"Scheme Traits: {breakdown['scheme_score']}/10 ({'✅' if breakdown['breakdown']['scheme_met'] else '❌'})")
        print(f"Landing Spot: {breakdown['team_stability_score']}/3 ({'✅' if breakdown['breakdown']['stability_met'] else '❌'})")
        print(f"INSULATION BOOST: {boost} points ({'ELIGIBLE' if breakdown['eligible_for_boost'] else 'NOT ELIGIBLE'})")
    
    return True


if __name__ == "__main__":
    # Run test if called directly
    test_rookie_te_insulation_system()