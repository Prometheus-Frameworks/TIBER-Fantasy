#!/usr/bin/env python3
"""
Test script for compass integration with Trade Analyzer
Validates the Flask-style compass calculation methodology
"""

import json
import requests
import sys

def test_flask_style_comparison():
    """Test the Flask-style compass comparison endpoint"""
    
    print("🧪 Testing Flask-style compass comparison integration")
    
    # Test cases from your Flask implementation
    test_cases = [
        {
            "player1": "Ja'Marr Chase",
            "player2": "Cooper Kupp", 
            "position": "wr",
            "description": "Elite WR comparison"
        },
        {
            "player1": "Christian McCaffrey",
            "player2": "Josh Jacobs",
            "position": "rb", 
            "description": "Top RB comparison"
        },
        {
            "player1": "Stefon Diggs",
            "player2": "Tyreek Hill",
            "position": "wr",
            "description": "Speed vs Route running"
        }
    ]
    
    base_url = "http://localhost:5000"
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n--- Test {i}: {test_case['description']} ---")
        print(f"Comparing {test_case['player1']} vs {test_case['player2']} ({test_case['position'].upper()})")
        
        try:
            # Test both endpoints
            endpoints = [
                ("/api/compass-compare/compare", "Flask-style"),
                ("/api/trade-analyzer/compare", "Enhanced Trade Analyzer")
            ]
            
            for endpoint, name in endpoints:
                response = requests.post(
                    f"{base_url}{endpoint}",
                    json=test_case,
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"\n✅ {name} Response:")
                    
                    if 'player1' in data and 'player2' in data:
                        p1 = data['player1']
                        p2 = data['player2']
                        
                        print(f"  {p1['name']}: {p1.get('score', 'N/A'):.2f}")
                        print(f"    N:{p1.get('north', 'N/A'):.2f} E:{p1.get('east', 'N/A'):.2f} S:{p1.get('south', 'N/A'):.2f} W:{p1.get('west', 'N/A'):.2f}")
                        
                        print(f"  {p2['name']}: {p2.get('score', 'N/A'):.2f}")
                        print(f"    N:{p2.get('north', 'N/A'):.2f} E:{p2.get('east', 'N/A'):.2f} S:{p2.get('south', 'N/A'):.2f} W:{p2.get('west', 'N/A'):.2f}")
                        
                        print(f"  Verdict: {data.get('verdict', 'N/A')}")
                    
                    elif 'status' in data and data['status'] == 'success':
                        # Enhanced format
                        analysis = data.get('analysis', {})
                        print(f"  Winner: {analysis.get('winner', 'N/A')}")
                        print(f"  Score Difference: {analysis.get('score_difference', 'N/A'):.2f}")
                        print(f"  Verdict: {data.get('verdict', 'N/A')}")
                    
                else:
                    print(f"❌ {name} Error: {response.status_code}")
                    try:
                        error_data = response.json()
                        print(f"   {error_data.get('error', 'Unknown error')}")
                    except:
                        print(f"   {response.text}")
        
        except requests.exceptions.RequestException as e:
            print(f"❌ Connection error: {e}")
        except Exception as e:
            print(f"❌ Test error: {e}")
    
    print(f"\n🏁 Flask-style compass integration test complete")

def test_sample_endpoints():
    """Test sample data endpoints"""
    
    print("\n🔍 Testing sample endpoints")
    
    endpoints = [
        "/api/compass-compare/sample-trades",
        "/api/trade-analyzer/sample-trades"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"http://localhost:5000{endpoint}", timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ {endpoint}: {len(data.get('sample_trades', []))} samples")
            else:
                print(f"❌ {endpoint}: {response.status_code}")
                
        except Exception as e:
            print(f"❌ {endpoint}: {e}")

if __name__ == "__main__":
    print("🚀 Starting Trade Analyzer Flask Integration Tests")
    
    try:
        test_flask_style_comparison()
        test_sample_endpoints()
        print(f"\n✅ All tests completed")
        
    except KeyboardInterrupt:
        print(f"\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        sys.exit(1)