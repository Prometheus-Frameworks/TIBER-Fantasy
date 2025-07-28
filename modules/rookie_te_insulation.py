#!/usr/bin/env python3
"""
Rookie Tight End Insulation Boost System – v1.0
Applies a boost to rookie TE ratings if they meet high-insulation thresholds 
based on draft capital, production, traits, and landing spot.

Integration ready for Flask platform with TE scoring module compatibility.
"""

def apply_rookie_te_insulation_boost(player):
    """
    Calculate insulation boost for rookie TEs based on four core criteria:
    1. Draft Capital (1st round = 10 pts)
    2. Production (800+ yards + target share/receptions = 8-10 pts)
    3. Scheme-Versatile Traits (YPR, blocking, alignments = up to 10 pts)
    4. Landing Spot Stability (stable QB, TE-friendly team, depth position = up to 3 pts)
    
    Returns insulation_boost (0-12 points) if all core criteria met.
    """
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
    """
    # Calculate each component
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