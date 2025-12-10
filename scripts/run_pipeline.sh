#!/bin/bash
set -euo pipefail

echo "🚀 Starting TIBER Redraft 2025 MVP Pipeline..."
echo "================================================"

echo "Step 1: Collecting weekly core stats..."
python scripts/collect_weekly_core.py

echo ""
echo "Step 2: Collecting depth chart data..."
python scripts/collect_depth.py

echo ""
echo "Step 3: Staging and merging data..."
python scripts/stage_and_merge.py

echo ""
echo "Step 4: Filtering positions (optional)..."
python scripts/filter_positions.py

echo ""
echo "✅ Pipeline Complete!"
echo "================================================"
echo "📊 Main Output: warehouse/2024_weekly.jsonl"
echo "🔍 Position Filters: depth_charts_fantasy.jsonl, depth_charts_idp.jsonl"
echo "================================================"