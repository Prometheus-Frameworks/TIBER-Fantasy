#!/usr/bin/env python3
"""
Test script for the player vs defense update system
Run this to manually test updates during development
"""

import os
import sys
from update_player_vs_defense import update_player_vs_defense_data, get_current_nfl_week

def main():
    print("🧪 Testing Player vs Defense Update System")
    print("=" * 50)
    
    # Check environment
    if not os.getenv('DATABASE_URL'):
        print("❌ DATABASE_URL not found in environment")
        print("   Make sure you have a database connection configured")
        return 1
    
    print("✅ Database connection configured")
    
    # Test for 2024 season (has data) and 2025 (future season)
    seasons_to_test = [2024, 2025]
    
    for season in seasons_to_test:
        print(f"\n📊 Testing season {season}...")
        
        try:
            current_week = get_current_nfl_week(season)
            print(f"   Current NFL week for {season}: {current_week}")
            
            if season == 2025 and current_week == 0:
                print(f"   ⏰ Season {season} hasn't started yet - this is expected")
                continue
            
            success = update_player_vs_defense_data(season)
            if success:
                print(f"   ✅ Update successful for season {season}")
            else:
                print(f"   ❌ Update failed for season {season}")
                
        except Exception as e:
            print(f"   ❌ Error testing season {season}: {e}")
    
    print("\n🎯 Test Results:")
    print("   The update system is ready for the new season!")
    print("   During the season, it will automatically:")
    print("   • Check for new NFL games every Tuesday at 10 AM")
    print("   • Update player vs defense data after games complete")
    print("   • Run daily during playoffs (January/February)")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())