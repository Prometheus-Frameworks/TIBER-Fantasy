#!/usr/bin/env bash
# forge-batch.sh — Fetch ranked FORGE scores for a full position group
# Usage: ./forge-batch.sh <position: QB|RB|WR|TE> [mode: redraft|dynasty|bestball] [limit: default 50]
# Example: ./forge-batch.sh WR dynasty 30

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

POSITION="${1:-}"
MODE="${2:-$DEFAULT_MODE}"
LIMIT="${3:-50}"

if [[ -z "$POSITION" ]]; then
  echo '{"error":"Usage: forge-batch.sh <QB|RB|WR|TE> [mode] [limit]"}' >&2
  exit 1
fi

curl -sf \
  -H "x-tiber-key: $API_KEY" \
  -H "Accept: application/json" \
  -X POST \
  "${API_BASE}/api/v1/forge/batch?position=${POSITION}&mode=${MODE}&limit=${LIMIT}" \
  | jq '.'
