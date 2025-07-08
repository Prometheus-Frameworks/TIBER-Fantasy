#!/usr/bin/env python3
"""
Wrapper for Weekly Spike Analysis - handles pandas warnings and ensures clean JSON output
"""

import os
import sys
import subprocess
import json

def run_analysis():
    """Run the weekly analysis and return clean JSON"""
    try:
        # Set environment variables to suppress warnings
        env = os.environ.copy()
        env['PYTHONWARNINGS'] = 'ignore'
        
        # Run the analysis script
        result = subprocess.run(
            [sys.executable, 'simpleWeeklyAnalysis.py'],
            capture_output=True,
            text=True,
            env=env,
            cwd='server'
        )
        
        if result.returncode != 0:
            return {"error": f"Analysis script failed: {result.stderr}"}
        
        # Parse the JSON output
        try:
            data = json.loads(result.stdout)
            return data
        except json.JSONDecodeError as e:
            # Clean output by extracting JSON from stdout
            lines = result.stdout.split('\n')
            json_lines = []
            capturing = False
            
            for line in lines:
                if line.strip().startswith('{'):
                    capturing = True
                if capturing:
                    json_lines.append(line)
                if line.strip().endswith('}') and capturing:
                    break
            
            if json_lines:
                try:
                    clean_json = '\n'.join(json_lines)
                    return json.loads(clean_json)
                except:
                    pass
            
            return {"error": f"JSON parsing failed: {str(e)}"}
            
    except Exception as e:
        return {"error": f"Wrapper failed: {str(e)}"}

if __name__ == "__main__":
    result = run_analysis()
    print(json.dumps(result, indent=2))