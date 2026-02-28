#!/usr/bin/env bash
# search-player.sh — Search for a player by name and return their GSIS ID + metadata
# Usage: ./search-player.sh "Ja'Marr Chase"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/../config.json"

if [[ ! -f "$CONFIG" ]]; then
  echo '{"error":"config.json not found. Copy config.example.json and fill in your api_base_url and api_key."}' >&2
  exit 1
fi

API_BASE=$(jq -r '.api_base_url' "$CONFIG")
API_KEY=$(jq -r '.api_key' "$CONFIG")
NAME="${1:-}"

if [[ -z "$NAME" ]]; then
  echo '{"error":"Usage: search-player.sh \"<player name>\""}' >&2
  exit 1
fi

ENCODED=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$NAME")

curl -sf \
  -H "x-tiber-key: $API_KEY" \
  -H "Accept: application/json" \
  "${API_BASE}/api/v1/players/search?name=${ENCODED}" \
  | jq '.'
