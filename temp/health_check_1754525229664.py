
import sys
import os
sys.path.append('/home/runner/workspace/modules')

try:
    from rookie_evaluator import evaluate_rookie, RookieBatch, TIER_THRESHOLDS
    print("✅ Module import successful")
    print(f"Supported positions: {list(TIER_THRESHOLDS.keys())}")
except Exception as e:
    print(f"❌ Module import failed: {e}")
    sys.exit(1)
