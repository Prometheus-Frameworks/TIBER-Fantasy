#!/usr/bin/env bash
# forge-player.sh — Fetch full FORGE breakdown for a single player
# Usage: ./forge-player.sh <gsis_id> [mode: redraft|dynasty|bestball]
# Example: ./forge-player.sh 00-0036900 dynasty

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/../config.json"

if [[ ! -f "$CONFIG" ]]; then
  echo '{"error":"config.json not found. Copy config.example.json and fill in your api_base_url and api_key."}' >&2
  exit 1
fi

API_BASE=$(jq -r '.api_base_url' "$CONFIG")
API_KEY=$(jq -r '.api_key' "$CONFIG")
DEFAULT_MODE=$(jq -r '.default_mode // "redraft"' "$CONFIG")

GSIS_ID="${1:-}"
MODE="${2:-$DEFAULT_MODE}"

if [[ -z "$GSIS_ID" ]]; then
  echo '{"error":"Usage: forge-player.sh <gsis_id> [mode: redraft|dynasty|bestball]"}' >&2
  exit 1
fi

curl -sf \
  -H "x-tiber-key: $API_KEY" \
  -H "Accept: application/json" \
  "${API_BASE}/api/v1/forge/player/${GSIS_ID}?mode=${MODE}" \
  | jq '.'
