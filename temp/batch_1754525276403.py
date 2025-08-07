
import sys
import os
sys.path.append('/home/runner/workspace/modules')

from rookie_evaluator import RookieBatch
import json

# Read input data
with open('/home/runner/workspace/temp/batch_input_1754525276403.json', 'r') as f:
    rookies_data = json.load(f)

# Create batch and process
batch = RookieBatch()
for player_data in rookies_data:
    batch.add_rookie(player_data)

# Export results
json_output = batch.export_json()
print(json_output)
