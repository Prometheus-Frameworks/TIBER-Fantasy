#!/usr/bin/env python3
"""
Test the comprehensive Python rookie evaluation system
"""

import sys
import os
sys.path.append('modules')

from rookie_evaluator import evaluate_rookie, RookieBatch

def test_comprehensive_system():
    print("=" * 60)
    print("TESTING COMPREHENSIVE ROOKIE EVALUATION SYSTEM")
    print("=" * 60)
    
    # Test single player evaluation as requested
    print("\n🔍 Testing Single Player Evaluation:")
    player_data = {
        "name": "Malik Nabers",
        "position": "WR",
        "yprr": 2.8,
        "receptions": 89,
        "receiving_grade": 85.4,
        "breakout_age": 20.5,
        "dominator_rating": 0.32,
        "draft_round": "1",
        "age": 21,
        "target_share": 0.28
    }
    
    print(f"Player Data: {player_data['name']} ({player_data['position']})")
    result = evaluate_rookie(player_data)
    
    print(f"✅ Evaluation Complete:")
    print(f"   Name: {result['name']}")
    print(f"   Tier: {result['tier']} (Score: {result['score']})")
    print(f"   Traits: {', '.join(result['traits'])}")
    print(f"   Flags: {', '.join(result['flags'])}")
    print(f"   Notes: {result['notes']}")
    
    # Test batch processing as requested
    print(f"\n📦 Testing Batch Processing:")
    batch = RookieBatch()
    
    # Add rookies to batch (as shown in request)
    test_rookies = [
        player_data,  # Malik Nabers
        {
            "name": "A. Jeanty", 
            "position": "RB",
            "receiving_grade": 72,
            "yards_per_carry": 5.8,
            "receptions": 43,
            "missed_tackles_forced": 85,
            "pass_protection_grade": 68,
            "draft_round": "1",
            "age": 21
        },
        {
            "name": "T. McMillan",
            "position": "WR", 
            "yprr": 2.4,
            "receptions": 77,
            "receiving_grade": 82.1,
            "breakout_age": 21.2,
            "dominator_rating": 0.26,
            "draft_round": "1",
            "age": 22
        }
    ]
    
    for rookie_data in test_rookies:
        batch.add_rookie(rookie_data)
    
    # Export as JSON for database (as requested)
    print(f"\n💾 Exporting batch as JSON for database...")
    json_output = batch.export_json()
    
    print(f"✅ JSON Export Complete ({len(json_output)} characters)")
    print(f"📊 Batch Summary:")
    print(batch.export_summary())
    
    print(f"\n🎯 Testing Special Cases:")
    
    # Test Travis Hunter special case
    travis_data = {
        "name": "Travis Hunter",
        "position": "WR",
        "yprr": 2.8,
        "receptions": 60,
        "receiving_grade": 90,
        "breakout_age": 18,
        "dominator_rating": 0.35,
        "draft_round": "1"
    }
    
    travis_result = evaluate_rookie(travis_data)
    print(f"Special Case - {travis_result['name']}: Tier {travis_result['tier']} (Score: {travis_result['score']})")
    
    print(f"\n✅ COMPREHENSIVE SYSTEM OPERATIONAL")
    print(f"🤝 Covenant maintained: Serve, not take")
    return True

if __name__ == "__main__":
    test_comprehensive_system()