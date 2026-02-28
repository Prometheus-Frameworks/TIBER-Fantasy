#!/usr/bin/env bash
# player-gamelogs.sh — Fetch per-week game log for a single player
# Usage: ./player-gamelogs.sh <gsis_id> [season]
# Example: ./player-gamelogs.sh 00-0039064 2025

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/../config.json"

if [[ ! -f "$CONFIG" ]]; then
  echo '{"error":"config.json not found. Copy config.example.json and fill in your api_base_url and api_key."}' >&2
  exit 1
fi

API_BASE=$(jq -r '.api_base_url' "$CONFIG")
API_KEY=$(jq -r '.api_key' "$CONFIG")

GSIS_ID="${1:-}"
SEASON="${2:-2025}"

if [[ -z "$GSIS_ID" ]]; then
  echo '{"error":"Usage: player-gamelogs.sh <gsis_id> [season]"}' >&2
  exit 1
fi

curl -sfL \
  -H "x-tiber-key: $API_KEY" \
  -H "Accept: application/json" \
  "${API_BASE}/api/data-lab/gamelogs/${GSIS_ID}?season=${SEASON}" \
  | jq '.'
