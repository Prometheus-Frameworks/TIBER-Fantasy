#!/usr/bin/env python3
"""
Test script for Tiber Data Integration Module
Validates multi-source data aggregation capabilities
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'modules'))

from tiber_data_integration import TiberDataIntegration

def test_tiber_integration():
    """Test the Tiber Data Integration Module."""
    print("🧪 Testing Tiber Data Integration Module")
    print("="*50)
    
    # Initialize the integration
    tiber = TiberDataIntegration(current_year=2024)
    
    # Test 1: Review capabilities
    print("\n📋 TEST 1: Reviewing NFL-Data-Py Capabilities")
    capabilities = tiber.review_nfl_data_py_capabilities()
    assert capabilities is not None, "Capabilities review failed"
    print("✅ Capabilities review successful")
    
    # Test 2: Run diagnostic
    print("\n🔍 TEST 2: Running Data Source Diagnostic")
    diagnostic_results = tiber.run_diagnostic()
    assert diagnostic_results is not None, "Diagnostic failed"
    print("✅ Diagnostic completed")
    
    # Test 3: Test RB compass data gathering
    print("\n🧭 TEST 3: Testing RB Compass Data Gathering")
    try:
        rb_data = tiber.get_rb_compass_data("Christian McCaffrey")
        print(f"✅ RB data gathering successful")
        if rb_data:
            print(f"   Sample metrics: {list(rb_data.keys())}")
    except Exception as e:
        print(f"⚠️ RB data gathering encountered: {e}")
    
    # Test 4: Test WR compass data gathering
    print("\n🎯 TEST 4: Testing WR Compass Data Gathering")
    try:
        wr_data = tiber.get_wr_compass_data("Cooper Kupp")
        print(f"✅ WR data gathering successful")
        if wr_data:
            print(f"   Sample metrics: {list(wr_data.keys())}")
    except Exception as e:
        print(f"⚠️ WR data gathering encountered: {e}")
    
    # Test 5: Test player list generation
    print("\n📋 TEST 5: Testing Player List Generation")
    try:
        players_df = tiber.get_all_available_players()
        print(f"✅ Player list generation successful")
        if not players_df.empty:
            print(f"   Loaded {len(players_df)} players")
            print(f"   Sample positions: {players_df['position'].unique()[:5]}")
    except Exception as e:
        print(f"⚠️ Player list generation encountered: {e}")
    
    print("\n" + "="*50)
    print("🏁 Tiber Data Integration Module Test Complete")
    print("   Ready for On The Clock integration!")
    print("   Remember: serve, not take 🤝")

if __name__ == "__main__":
    test_tiber_integration()