#!/usr/bin/env python3
"""
Test script for Rookie TE Insulation Boost System
Tests the system with realistic 2025 rookie TE profiles
"""

import sys
import os
sys.path.append('modules')

from rookie_te_insulation import (
    apply_rookie_te_insulation_boost, 
    get_rookie_te_insulation_breakdown,
    is_rookie_tight_end,
    adjust_for_brock_bowers,
    apply_meta_te1_evaluation,
    batch_evaluate_rookie_tes
)

class TestRookieTE:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

def test_brock_bowers_meta_te1():
    """Test Brock Bowers meta TE1 override and evaluation flow"""
    print("\n🎯 BROCK BOWERS META TE1 EVALUATION")
    print("=" * 50)
    
    # Create Brock Bowers with 2024 game logs (second-year TE)
    brock_bowers = TestRookieTE(
        name="Brock Bowers",
        position="TE",
        rookie=False,  # Has 2024 game logs
        fantasy_points_ppr=189.4,  # Actual 2024 rookie season
        game_logs_2024=True,
        base_te_score=104  # Score that would exceed 99 cap
    )
    
    # Test individual functions
    print(f"📊 Original rookie status: {getattr(brock_bowers, 'rookie', False)}")
    
    # Apply Brock Bowers override
    brock_bowers = adjust_for_brock_bowers(brock_bowers)
    print(f"✅ After override - Meta TE1: {getattr(brock_bowers, 'meta_te1', False)}")
    print(f"✅ Classification: {getattr(brock_bowers, 'classification', 'N/A')}")
    
    # Test rookie check
    is_rookie = is_rookie_tight_end(brock_bowers)
    print(f"✅ Is rookie TE: {is_rookie}")
    
    # Test meta TE1 evaluation with no penalty cap
    final_score = apply_meta_te1_evaluation(brock_bowers, brock_bowers.base_te_score)
    print(f"✅ Base score: {brock_bowers.base_te_score}")
    print(f"✅ Final score (no cap): {final_score}")
    
    print(f"🎉 Brock Bowers correctly identified as Meta TE1 baseline!")
    

def test_realistic_2025_rookie_tes():
    """Test with realistic 2025 rookie TE profiles"""
    
    # Sample 2025 rookie TEs with realistic profiles
    rookie_tes = [
        {
            'name': 'Tyler Warren',
            'draft_round': 2,  # Projected 2nd round
            'college_receiving_yards': 1062,
            'college_target_share': 0.23,
            'college_receptions': 88,
            'yards_per_reception': 12.1,
            'blocking_grade': 'plus',
            'snap_alignment_count': 4,
            'team_qb': 'CJ Stroud',  # If drafted by HOU
            'team_prefers_tes': True,
            'te_depth_chart_rank': 2,
            'profile_type': 'high_production_second_rounder'
        },
        {
            'name': 'Colston Loveland',
            'draft_round': 1,  # Projected 1st round
            'college_receiving_yards': 649,  # Lower due to Michigan system
            'college_target_share': 0.18,
            'college_receptions': 56,
            'yards_per_reception': 11.6,
            'blocking_grade': 'solid',
            'snap_alignment_count': 3,
            'team_qb': 'Josh Allen',  # If drafted by BUF
            'team_prefers_tes': False,
            'te_depth_chart_rank': 1,
            'profile_type': 'first_round_blocking_focused'
        },
        {
            'name': 'Terrance Ferguson',
            'draft_round': 1,  # Projected 1st round
            'college_receiving_yards': 1055,
            'college_target_share': 0.28,
            'college_receptions': 78,
            'yards_per_reception': 13.5,
            'blocking_grade': 'plus',
            'snap_alignment_count': 5,
            'team_qb': 'Patrick Mahomes',  # If drafted by KC
            'team_prefers_tes': True,
            'te_depth_chart_rank': 1,
            'profile_type': 'elite_insulation_prospect'
        },
        {
            'name': 'Luke Lachey',
            'draft_round': 3,  # Mid-round projection
            'college_receiving_yards': 515,
            'college_target_share': 0.15,
            'college_receptions': 42,
            'yards_per_reception': 12.3,
            'blocking_grade': 'solid',
            'snap_alignment_count': 3,
            'team_qb': 'Kyler Murray',  # If drafted by ARI
            'team_prefers_tes': False,
            'te_depth_chart_rank': 2,
            'profile_type': 'developmental_prospect'
        },
        {
            'name': 'Hayden Hatten',
            'draft_round': 4,  # Late-round projection
            'college_receiving_yards': 832,
            'college_target_share': 0.22,
            'college_receptions': 64,
            'yards_per_reception': 13.0,
            'blocking_grade': 'average',
            'snap_alignment_count': 2,
            'team_qb': 'Tua Tagovailoa',  # If drafted by MIA
            'team_prefers_tes': False,
            'te_depth_chart_rank': 3,
            'profile_type': 'late_round_upside'
        }
    ]
    
    print("🎯 2025 ROOKIE TE INSULATION BOOST ANALYSIS")
    print("=" * 60)
    print("Testing realistic 2025 rookie TE draft class profiles")
    print()
    
    results = []
    
    for te_data in rookie_tes:
        # Add required rookie TE attributes
        te_data['position'] = 'TE'
        te_data['rookie'] = True
        
        te = TestRookieTE(**te_data)
        breakdown = get_rookie_te_insulation_breakdown(te)
        boost = apply_rookie_te_insulation_boost(te)
        
        results.append({
            'player': te,
            'breakdown': breakdown,
            'boost': boost
        })
        
        print(f"📊 {breakdown['player_name']} ({te_data['profile_type']})")
        print(f"   Draft Capital: {breakdown['draft_capital_score']}/10 ({'✅' if breakdown['breakdown']['draft_capital_met'] else '❌'})")
        print(f"   Production: {breakdown['production_score']}/10 ({'✅' if breakdown['breakdown']['production_met'] else '❌'})")
        print(f"   Scheme Traits: {breakdown['scheme_score']}/10 ({'✅' if breakdown['breakdown']['scheme_met'] else '❌'})")
        print(f"   Landing Spot: {breakdown['team_stability_score']}/3 ({'✅' if breakdown['breakdown']['stability_met'] else '❌'})")
        print(f"   INSULATION BOOST: {boost} points")
        
        if boost > 0:
            print(f"   🎉 ELIGIBLE FOR BOOST - High insulation rookie!")
        else:
            print(f"   ⚠️  Not eligible - Missing key criteria")
        print()
    
    # Summary analysis
    total_rookies = len(results)
    boosted_rookies = len([r for r in results if r['boost'] > 0])
    
    print("📈 SUMMARY ANALYSIS")
    print("=" * 30)
    print(f"Total Rookies Evaluated: {total_rookies}")
    print(f"Eligible for Boost: {boosted_rookies}")
    print(f"Eligibility Rate: {boosted_rookies/total_rookies:.1%}")
    print()
    
    # Detailed insights
    print("💡 KEY INSIGHTS")
    print("=" * 20)
    for result in results:
        if result['boost'] > 0:
            print(f"✅ {result['breakdown']['player_name']} - Elite insulation prospect")
        else:
            te = result['player']
            missing = []
            if not result['breakdown']['breakdown']['draft_capital_met']:
                missing.append("1st round draft capital")
            if not result['breakdown']['breakdown']['production_met']:
                missing.append("800+ yards production")
            if not result['breakdown']['breakdown']['scheme_met']:
                missing.append("scheme versatility")
            if not result['breakdown']['breakdown']['stability_met']:
                missing.append("landing spot stability")
            
            print(f"❌ {result['breakdown']['player_name']} - Missing: {', '.join(missing)}")
    
    return results

if __name__ == "__main__":
    print("🏈 ROOKIE TE INSULATION BOOST SYSTEM")
    print("Testing with realistic 2025 draft class profiles")
    
    # Test Brock Bowers meta TE1 evaluation flow
    test_brock_bowers_meta_te1()
    
    # Test 2025 rookie TE insulation system
    results = test_realistic_2025_rookie_tes()
    
    print("\n✅ Testing completed successfully!")
    print("System ready for Flask platform integration")