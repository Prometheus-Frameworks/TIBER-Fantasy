#!/usr/bin/env python3
"""
Filter depth chart data by fantasy vs IDP positions.
Input: raw/2024/depth_weekly.jsonl
Outputs: depth_charts_fantasy.jsonl, depth_charts_idp.jsonl
"""

import json

# Positions to keep for offensive/standard fantasy
FANTASY_POSITIONS = {"QB", "RB", "WR", "TE", "K", "DST"}

# Positions to keep if you want a separate IDP table
IDP_POSITIONS = {"LB", "CB", "S", "DL", "DE", "DT", "EDGE"}

def filter_depth_charts():
    """Filter depth chart data by position type."""
    
    print("🔍 Filtering depth chart data by position...")
    
    filtered_fantasy = []
    filtered_idp = []

    try:
        with open("raw/2024/depth_weekly.jsonl", "r") as infile:
            for line in infile:
                record = json.loads(line)
                pos = record.get("position", "").upper()
                depth = record.get("depth_rank", record.get("position_depth", 99))

                # Convert depth to int if it's a string
                if isinstance(depth, str):
                    try:
                        depth = int(depth)
                    except ValueError:
                        depth = 99

                # Ignore practice squad & inactives
                if depth is None or depth == 0 or "PRACTICE" in pos or "INACTIVE" in pos:
                    continue

                # Keep fantasy players
                if pos in FANTASY_POSITIONS:
                    filtered_fantasy.append(record)
                
                # Keep IDP players separately
                elif pos in IDP_POSITIONS:
                    filtered_idp.append(record)

        # Write outputs
        with open("depth_charts_fantasy.jsonl", "w") as ff:
            for rec in filtered_fantasy:
                ff.write(json.dumps(rec) + "\n")

        with open("depth_charts_idp.jsonl", "w") as fi:
            for rec in filtered_idp:
                fi.write(json.dumps(rec) + "\n")

        print(f"✅ Fantasy players: {len(filtered_fantasy):,}")
        print(f"✅ IDP players: {len(filtered_idp):,}")
        
        return len(filtered_fantasy), len(filtered_idp)
        
    except Exception as e:
        print(f"❌ Error filtering depth charts: {e}")
        return 0, 0

if __name__ == "__main__":
    filter_depth_charts()