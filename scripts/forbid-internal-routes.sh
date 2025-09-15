#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-client/src}"
PATTERN="/api-test|/api-demo|/api-comprehensive|/te-evaluation-test|/batch-evaluation-test|/prometheus-stress-test|/projections-test|/adaptive-consensus-demo|/curves-demo|/injury-profiles-demo"

if command -v rg >/dev/null 2>&1; then
  if rg -n --no-ignore -S "$PATTERN" "$ROOT"; then
    echo "❌ Internal demo/test routes detected. Disable before commit (or guard by NODE_ENV)."
    exit 1
  fi
else
  echo "⚠️ ripgrep (rg) not installed; skipping route check."
fi

echo "✅ No internal routes detected."