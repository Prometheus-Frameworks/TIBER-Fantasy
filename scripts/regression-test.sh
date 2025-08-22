#!/bin/bash
# Project 2024 Stats - Regression Test Suite
# Run this after any API changes to validate functionality

echo "🧪 Running Project 2024 Stats Regression Tests..."

BASE_URL="http://localhost:5000"
FAILED=0

# Test 1: Basic API health check
echo "📋 Test 1: Basic API functionality"
curl -f -s "${BASE_URL}/api/stats/2024/leaderboard?position=RB&metric=rush_yards" > /dev/null || { echo "❌ RB FAIL"; FAILED=1; }
curl -f -s "${BASE_URL}/api/stats/2024/leaderboard?position=WR&metric=targets" > /dev/null || { echo "❌ WR FAIL"; FAILED=1; }
curl -f -s "${BASE_URL}/api/stats/2024/leaderboard?position=TE&metric=receptions" > /dev/null || { echo "❌ TE FAIL"; FAILED=1; }
curl -f -s "${BASE_URL}/api/stats/2024/leaderboard?position=QB&metric=pass_tds" > /dev/null || { echo "❌ QB FAIL"; FAILED=1; }

if [ $FAILED -eq 0 ]; then
    echo "✅ Basic API tests passed"
else
    echo "❌ Basic API tests failed"
fi

# Test 2: Filter validation
echo "📋 Test 2: Filter functionality"
curl -f -s "${BASE_URL}/api/stats/2024/leaderboard?position=RB&metric=rush_ypc&min_att=100" > /dev/null || { echo "❌ FILTER FAIL"; FAILED=1; }

if [ $FAILED -eq 0 ]; then
    echo "✅ Filter tests passed"
else
    echo "❌ Filter tests failed"
fi

# Test 3: Error handling
echo "📋 Test 3: Error handling"
RESPONSE=$(curl -s "${BASE_URL}/api/stats/2024/leaderboard?position=INVALID&metric=targets")
echo "$RESPONSE" | grep -q "400\|error" || { echo "❌ ERROR HANDLING FAIL"; FAILED=1; }

if [ $FAILED -eq 0 ]; then
    echo "✅ Error handling tests passed"
else
    echo "❌ Error handling tests failed"
fi

# Test 4: Metrics endpoint
echo "📋 Test 4: Metrics endpoint"
curl -f -s "${BASE_URL}/api/stats/2024/metrics" > /dev/null || { echo "❌ METRICS FAIL"; FAILED=1; }

if [ $FAILED -eq 0 ]; then
    echo "✅ Metrics endpoint tests passed"
else
    echo "❌ Metrics endpoint tests failed"
fi

# Test 5: Response schema validation (basic check)
echo "📋 Test 5: Response schema validation"
RESPONSE=$(curl -s "${BASE_URL}/api/stats/2024/leaderboard?position=RB&metric=fpts_ppr&limit=3")
echo "$RESPONSE" | jq -e '.success' > /dev/null || { echo "❌ SCHEMA FAIL - Missing success field"; FAILED=1; }
echo "$RESPONSE" | jq -e '.data' > /dev/null || { echo "❌ SCHEMA FAIL - Missing data field"; FAILED=1; }
echo "$RESPONSE" | jq -e '.count' > /dev/null || { echo "❌ SCHEMA FAIL - Missing count field"; FAILED=1; }

if [ $FAILED -eq 0 ]; then
    echo "✅ Schema validation tests passed"
else
    echo "❌ Schema validation tests failed"
fi

# Final Results
echo ""
echo "🏁 Regression Test Results:"
if [ $FAILED -eq 0 ]; then
    echo "✅ ALL TESTS PASSED - System ready for deployment"
    exit 0
else
    echo "❌ SOME TESTS FAILED - Review errors above"
    exit 1
fi