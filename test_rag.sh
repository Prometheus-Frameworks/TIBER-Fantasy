#!/bin/bash

# RAG Endpoint Stress Test - Bash Edition
# Usage: ./test_rag.sh http://localhost:5000

BASE_URL=${1:-"http://localhost:5000"}
RAG_BASE="$BASE_URL/rag"

echo "🔥 RAG Endpoint Stress Test"
echo "📡 Testing against: $RAG_BASE"
echo "================================================"

# Test cases: Player Name -> Topic
declare -A test_cases=(
    ["Josh Downs"]="qb-change"
    ["Anthony Richardson"]="qb-change"
    ["Puka Nacua"]="injury"
    ["Saquon Barkley"]="contract"
    ["Daniel Jones"]="camp"
    ["Michael Pittman"]="depth-chart"
)

test_player() {
    local player_name="$1"
    local topic="$2"
    
    echo "🎯 Testing: $player_name ($topic)"
    
    # Step 1: Search for player ID
    search_result=$(curl -s -H "Accept: application/json" \
        "$RAG_BASE/api/players/search?name=$(echo "$player_name" | sed 's/ /%20/g')" 2>/dev/null)
    
    if [[ -z "$search_result" ]] || echo "$search_result" | grep -q "DOCTYPE html"; then
        echo "❌ Search failed or returned HTML"
        return 1
    fi
    
    # Extract player_id (assuming first result)  
    player_id=$(echo "$search_result" | jq -r '.results[0].player_id // ""' 2>/dev/null)
    
    if [[ -z "$player_id" ]] || [[ "$player_id" == "null" ]]; then
        echo "❌ Player ID not found for: $player_name"
        echo "   Search response: $search_result"
        return 1
    fi
    
    echo "✅ Found player_id: $player_id"
    
    # Step 2: Generate take
    take_result=$(curl -s -H "Accept: application/json" \
        "$RAG_BASE/api/take?player_id=$player_id&topic=$(echo "$topic" | sed 's/-/%20/g')" 2>/dev/null)
    
    if [[ -z "$take_result" ]] || echo "$take_result" | grep -q "DOCTYPE html"; then
        echo "❌ Take generation failed or returned HTML"
        return 1
    fi
    
    # Extract take data
    headline=$(echo "$take_result" | jq -r '.headline // "N/A"' 2>/dev/null)
    verdict=$(echo "$take_result" | jq -r '.verdict // "N/A"' 2>/dev/null)  
    confidence=$(echo "$take_result" | jq -r '.confidence // "N/A"' 2>/dev/null)
    citation_count=$(echo "$take_result" | jq -r '.citations | length // 0' 2>/dev/null)
    
    echo "📰 Headline: $headline"
    echo "⚖️  Verdict: $verdict"
    echo "🎯 Confidence: $confidence"
    echo "📚 Citations: $citation_count"
    echo
}

# Run all test cases
for player in "${!test_cases[@]}"; do
    test_player "$player" "${test_cases[$player]}"
    sleep 0.5  # Brief pause between requests
done

echo "================================================"
echo "✅ RAG stress test complete!"