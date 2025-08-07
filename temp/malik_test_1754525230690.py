
import sys
import os
sys.path.append('/home/runner/workspace/modules')

from rookie_evaluator import evaluate_rookie
import json

# Test data for Malik Nabers
with open('/home/runner/workspace/temp/malik_test_1754525230689.json', 'r') as f:
    malik_data = json.load(f)

result = evaluate_rookie(malik_data)
print(json.dumps(result, indent=2))
