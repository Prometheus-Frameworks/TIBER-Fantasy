
import sys
import os
sys.path.append('/home/runner/workspace/modules')

from rookie_evaluator import evaluate_rookie
import json

# Read input data
with open('/home/runner/workspace/temp/rookie_input_1754526679916.json', 'r') as f:
    player_data = json.load(f)

# Evaluate rookie
result = evaluate_rookie(player_data)

# Output result
print(json.dumps(result))
