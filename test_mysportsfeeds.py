#!/usr/bin/env python3
"""
MySportsFeeds Connection Test
Quick test script to verify API credentials and connection
"""

import os
import sys

# Add modules to path
sys.path.append('modules')

from modules.mysportsfeeds_service import get_mysportsfeeds_service

def main():
    print("🔍 Testing MySportsFeeds API Connection...")
    print("=" * 50)
    
    # Get service instance
    service = get_mysportsfeeds_service()
    
    # Test connection
    result = service.test_connection()
    
    if result['success']:
        print("✅ CONNECTION SUCCESSFUL!")
        print(f"   Message: {result['message']}")
        print(f"   API Version: {result.get('api_version', 'Unknown')}")
        print(f"   Season: {result.get('season', 'Unknown')}")
        print(f"   Games Available: {result.get('games_available', 'Unknown')}")
        
        # Test injury reports
        print("\n🏥 Testing Injury Reports...")
        injuries = service.get_injury_reports()
        print(f"   Found {len(injuries)} active injuries")
        
        if injuries:
            print("   Sample injuries:")
            for injury in injuries[:3]:  # Show first 3
                print(f"   • {injury['player_name']} ({injury['team']}) - {injury['injury_description']}")
        
        # Test player stats for a few positions
        print("\n📊 Testing Player Stats...")
        qb_stats = service.get_player_stats(position='QB')
        print(f"   Found stats for {len(qb_stats)} QBs")
        
        wr_stats = service.get_player_stats(position='WR')
        print(f"   Found stats for {len(wr_stats)} WRs")
        
        if qb_stats:
            sample_qb = qb_stats[0]
            print(f"   Sample QB: {sample_qb['player_name']} ({sample_qb['team']}) - {sample_qb['games_played']} games played")
        
        print("\n🎯 MySportsFeeds integration is READY!")
        
    else:
        print("❌ CONNECTION FAILED!")
        print(f"   Error: {result.get('error', 'Unknown error')}")
        print("\n🔧 Troubleshooting:")
        print("   1. Check that MSF_USERNAME is set in environment variables")
        print("   2. Verify your MySportsFeeds account is active")
        print("   3. Confirm you have NFL data access permissions")
        print("   4. Try logging into mysportsfeeds.com to verify account status")

if __name__ == "__main__":
    main()