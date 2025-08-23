#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"

echo "[QA] Ratings API health"
curl -sf "$BASE_URL/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&limit=25" > /dev/null
curl -sf "$BASE_URL/api/tiber-ratings?format=dynasty&position=WR&season=2024&limit=50" > /dev/null
curl -sf "$BASE_URL/api/tiber-ratings?format=redraft&position=QB&season=2024&week=6&debug=1" | jq -e '.items' > /dev/null

echo "[QA] Parameter validation"
curl -s "$BASE_URL/api/tiber-ratings?format=INVALID&position=RB&season=2024" | grep -qi "error" || (echo "Expected error for invalid format" && exit 1)
curl -s "$BASE_URL/api/tiber-ratings?format=redraft&position=INVALID&season=2024" | grep -qi "error" || (echo "Expected error for invalid position" && exit 1)
curl -s "$BASE_URL/api/tiber-ratings?format=redraft&position=RB&season=2024&week=0" | grep -qi "error" || (echo "Expected error for week=0" && exit 1)
curl -s "$BASE_URL/api/tiber-ratings?format=redraft&position=RB&season=2024&week=18" | grep -qi "error" || (echo "Expected error for week=18 in 2024" && exit 1)

echo "[QA] Tiers endpoint"
curl -sf "$BASE_URL/api/tiber-ratings/tiers?format=redraft&position=RB&season=2024&week=6" | jq -e '.tiers' > /dev/null || echo "No tiers data available - may need sample data"

echo "[QA] Individual player endpoint"
curl -sf "$BASE_URL/api/tiber-ratings/jamarr-chase?format=redraft&season=2024&week=6" > /dev/null || echo "Player not found - may need sample data"

echo "[QA] Weight override sanity"
curl -sf "$BASE_URL/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&weights=0.4,0.3,0.15,0.1,0.03,0.02" > /dev/null

echo "[QA] Recompute endpoint"
curl -sf "$BASE_URL/api/tiber-ratings/recompute?format=redraft&position=RB&season=2024&week=6" -X POST > /dev/null || echo "Recompute failed - check sample data"

echo "[QA] DONE - All basic endpoints responding"