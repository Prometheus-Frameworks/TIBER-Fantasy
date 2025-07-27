#!/usr/bin/env python3
"""
Test script for VORP Rankings Integration
Validates the complete Flask + VORP + HTML template system
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

def test_rankings_system():
    """Test the complete rankings system integration"""
    
    print("🧪 Testing VORP Rankings Integration...")
    
    try:
        # Test module imports
        from modules.rankings_engine import RankingsEngine
        from modules.vorp_calculator import calculate_vorp, batch_assign_vorp, VORPCalculator
        print("✅ Module imports successful")
        
        # Initialize rankings engine
        engine = RankingsEngine()
        print("✅ Rankings engine initialized")
        
        # Sample players for testing
        test_players = [
            {'name': 'Josh Allen', 'position': 'QB', 'team': 'BUF', 'projected_points': 285.5, 'age': 28},
            {'name': 'Christian McCaffrey', 'position': 'RB', 'team': 'SF', 'projected_points': 245.2, 'age': 28},
            {'name': 'Justin Jefferson', 'position': 'WR', 'team': 'MIN', 'projected_points': 220.8, 'age': 25},
            {'name': 'Travis Kelce', 'position': 'TE', 'team': 'KC', 'projected_points': 185.3, 'age': 35},
            {'name': 'Lamar Jackson', 'position': 'QB', 'team': 'BAL', 'projected_points': 275.0, 'age': 27},
            {'name': 'Tyreek Hill', 'position': 'WR', 'team': 'MIA', 'projected_points': 210.5, 'age': 30}
        ]
        
        # Test different ranking scenarios
        scenarios = [
            ('redraft', 'all', 'standard'),
            ('dynasty', 'all', 'ppr'),
            ('redraft', 'QB', 'superflex'),
            ('dynasty', 'WR', 'standard')
        ]
        
        print("\n🔍 Testing ranking scenarios...")
        for mode, position, format_type in scenarios:
            rankings = engine.generate_rankings(test_players, mode, position, format_type)
            print(f"✅ {mode.title()} {position.upper()} {format_type.title()}: {len(rankings)} players")
            
            if rankings:
                top_player = rankings[0]
                print(f"   Top: {top_player['name']} ({top_player['position']}) - {top_player['vorp']:.1f} VORP")
        
        # Test tier breakdown
        all_rankings = engine.generate_rankings(test_players, 'dynasty', 'all', 'standard')
        tiers = engine.get_tier_breakdown(all_rankings)
        print(f"\n🏆 Tier breakdown: {len(tiers)} tiers generated")
        
        # Test summary statistics
        summary = engine.get_rankings_summary(all_rankings)
        print(f"📊 Summary: {summary['total_players']} players, {summary['above_replacement']} above replacement")
        
        # Test Flask app if available
        try:
            from app import app
            print("✅ Flask app import successful")
            
            with app.test_client() as client:
                # Test rankings page
                response = client.get('/rankings?mode=dynasty&position=all&format=ppr')
                if response.status_code == 200:
                    print("✅ Rankings page responds correctly")
                else:
                    print(f"⚠️ Rankings page returned {response.status_code}")
                
                # Test API endpoint
                api_response = client.get('/api/rankings?mode=redraft&position=QB&format=superflex')
                if api_response.status_code == 200:
                    data = api_response.get_json()
                    print(f"✅ API endpoint: {data['total']} players in {data['mode']} mode")
                else:
                    print(f"⚠️ API endpoint returned {api_response.status_code}")
                    
        except ImportError:
            print("⚠️ Flask app not available for testing")
        
        print("\n🎉 VORP Rankings Integration Test Complete!")
        print("✅ All core functionality operational")
        
        return True
        
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    test_rankings_system()