#!/usr/bin/env bash
# data-lab.sh — Fetch raw Data Lab metrics (117 fields per player)
# Usage: ./data-lab.sh <position: QB|RB|WR|TE> [week_start] [week_end] [season]
# Example: ./data-lab.sh WR 1 17 2025

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

POSITION="${1:-}"
WEEK_START="${2:-1}"
WEEK_END="${3:-17}"
SEASON="${4:-$DEFAULT_SEASON}"

if [[ -z "$POSITION" ]]; then
  echo '{"error":"Usage: data-lab.sh <QB|RB|WR|TE> [week_start] [week_end] [season]"}' >&2
  exit 1
fi

curl -sf \
  -H "x-tiber-key: $API_KEY" \
  -H "Accept: application/json" \
  "${API_BASE}/api/data-lab/lab-agg?position=${POSITION}&weekStart=${WEEK_START}&weekEnd=${WEEK_END}&season=${SEASON}" \
  | jq '.'
