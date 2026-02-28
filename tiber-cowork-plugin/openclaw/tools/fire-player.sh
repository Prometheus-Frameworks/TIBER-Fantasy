#!/usr/bin/env bash
# fire-player.sh — Fetch QB FIRE data (Expected Fantasy Points, opportunity delta)
# Usage: ./fire-player.sh <gsis_id> [season] [week]
# Example: ./fire-player.sh 00-0036442 2025 17

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/../config.json"

if [[ ! -f "$CONFIG" ]]; then
  echo '{"error":"config.json not found. Copy config.example.json and fill in your api_base_url and api_key."}' >&2
  exit 1
fi

API_BASE=$(jq -r '.api_base_url' "$CONFIG")
API_KEY=$(jq -r '.api_key' "$CONFIG")
DEFAULT_SEASON=$(jq -r '.default_season // 2025' "$CONFIG")

GSIS_ID="${1:-}"
SEASON="${2:-$DEFAULT_SEASON}"
WEEK="${3:-}"

if [[ -z "$GSIS_ID" ]]; then
  echo '{"error":"Usage: fire-player.sh <gsis_id> [season] [week]"}' >&2
  exit 1
fi

QUERY="season=${SEASON}"
if [[ -n "$WEEK" ]]; then
  QUERY="${QUERY}&week=${WEEK}"
fi

curl -sf \
  -H "x-tiber-key: $API_KEY" \
  -H "Accept: application/json" \
  "${API_BASE}/api/v1/fire/player/${GSIS_ID}?${QUERY}" \
  | jq '.'
