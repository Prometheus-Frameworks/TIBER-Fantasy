import nfl_data_py as nfl
import pandas as pd

print("=" * 60)
print("TESTING: NFLfastR 2025 Data Availability")
print("=" * 60)

try:
    # Attempt to fetch 2025 play-by-play data
    print("\n1. Fetching 2025 play-by-play data...")
    pbp_2025 = nfl.import_pbp_data([2025])
    
    if pbp_2025 is None or len(pbp_2025) == 0:
        print("❌ No 2025 data returned from NFLfastR")
        print("This might mean:")
        print("  - NFLfastR hasn't updated for 2025 yet")
        print("  - Network issue")
        print("  - Library needs update: pip install nfl-data-py --upgrade --break-system-packages")
    else:
        print(f"✅ Successfully fetched {len(pbp_2025)} plays from 2025")
        
        # Check which weeks are available
        print("\n2. Available weeks in 2025 data:")
        weeks = sorted(pbp_2025['week'].unique())
        print(f"   Weeks: {weeks}")
        print(f"   Total weeks: {len(weeks)}")
        
        # Sample a few plays from Week 11
        print("\n3. Sample plays from Week 11:")
        week_11 = pbp_2025[pbp_2025['week'] == 11]
        if len(week_11) > 0:
            print(f"   Total Week 11 plays: {len(week_11)}")
            print("\n   Sample play:")
            sample = week_11.iloc[0]
            print(f"   Game: {sample['home_team']} vs {sample['away_team']}")
            print(f"   Date: {sample['game_date']}")
        else:
            print("   ⚠️ No Week 11 data found")
        
        # Check for player stats
        print("\n4. Sample player stats from Week 11:")
        if len(week_11) > 0:
            # Get rushers
            rushers = week_11[week_11['rusher_player_name'].notna()]['rusher_player_name'].value_counts().head(5)
            print("\n   Top 5 rushers by attempts:")
            print(rushers)
            
            # Get receivers
            receivers = week_11[week_11['receiver_player_name'].notna()]['receiver_player_name'].value_counts().head(5)
            print("\n   Top 5 receivers by targets:")
            print(receivers)
        
        print("\n" + "=" * 60)
        print("✅ RESULT: 2025 data IS available from NFLfastR")
        print("=" * 60)

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print("\nTroubleshooting:")
    print("1. Install/upgrade nfl-data-py:")
    print("   pip install nfl-data-py --upgrade --break-system-packages")
    print("2. Check internet connection")
    print("3. Try fetching 2024 data as a test:")
    print("   nfl.import_pbp_data([2024])")
