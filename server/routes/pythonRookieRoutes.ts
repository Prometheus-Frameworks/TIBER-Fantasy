/**
 * Python Rookie Evaluator Integration Routes
 * Bridges the comprehensive Python evaluation system with Express API
 */

import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const router = Router();

interface PythonRookieData {
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  yprr?: number;
  receptions?: number;
  receiving_grade?: number;
  breakout_age?: number;
  dominator_rating?: number;
  draft_round?: string;
  yards_per_carry?: number;
  missed_tackles_forced?: number;
  yards_per_attempt?: number;
  td_int_ratio?: number;
  rush_yards?: number;
  age?: number;
  target_share?: number;
}

/**
 * POST /api/python-rookie/evaluate
 * Single player evaluation using comprehensive Python system
 */
router.post('/evaluate', async (req, res) => {
  try {
    const playerData: PythonRookieData = req.body;
    
    // Validation
    if (!playerData.name || !playerData.position) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, position'
      });
    }
    
    console.log(`🐍 Python evaluation request: ${playerData.name} (${playerData.position})`);
    
    // Create temporary file for Python script input
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const inputFile = path.join(tempDir, `rookie_input_${Date.now()}.json`);
    await fs.writeFile(inputFile, JSON.stringify(playerData, null, 2));
    
    try {
      // Execute Python evaluation
      const pythonScript = `
import sys
import os
sys.path.append('${path.join(process.cwd(), 'modules')}')

from rookie_evaluator import evaluate_rookie
import json

# Read input data
with open('${inputFile}', 'r') as f:
    player_data = json.load(f)

# Evaluate rookie
result = evaluate_rookie(player_data)

# Output result
print(json.dumps(result))
`;
      
      const scriptFile = path.join(tempDir, `evaluate_${Date.now()}.py`);
      await fs.writeFile(scriptFile, pythonScript);
      
      const { stdout, stderr } = await execAsync(`python ${scriptFile}`, {
        timeout: 30000,
        cwd: process.cwd()
      });
      
      if (stderr && !stderr.includes('Warning')) {
        console.error('Python stderr:', stderr);
      }
      
      const evaluation = JSON.parse(stdout.trim());
      
      // Cleanup temp files
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(scriptFile).catch(() => {});
      
      res.json({
        success: true,
        evaluation,
        engine: 'python_comprehensive',
        timestamp: new Date().toISOString()
      });
      
    } catch (pythonError) {
      console.error('Python execution error:', pythonError);
      
      // Cleanup on error
      await fs.unlink(inputFile).catch(() => {});
      
      res.status(500).json({
        success: false,
        error: 'Python evaluation failed',
        message: pythonError instanceof Error ? pythonError.message : 'Unknown Python error'
      });
    }
    
  } catch (error) {
    console.error('❌ Error in Python rookie evaluation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate rookie with Python engine',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/python-rookie/batch
 * Batch evaluation using Python RookieBatch class
 */
router.post('/batch', async (req, res) => {
  try {
    const { rookies }: { rookies: PythonRookieData[] } = req.body;
    
    if (!Array.isArray(rookies) || rookies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. Expected array of rookies.'
      });
    }
    
    if (rookies.length > 25) {
      return res.status(400).json({
        success: false,
        error: 'Batch size too large. Maximum 25 rookies per batch.'
      });
    }
    
    console.log(`🐍 Python batch evaluation: ${rookies.length} rookies`);
    
    // Create temporary files
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const inputFile = path.join(tempDir, `batch_input_${Date.now()}.json`);
    await fs.writeFile(inputFile, JSON.stringify(rookies, null, 2));
    
    try {
      const pythonScript = `
import sys
import os
sys.path.append('${path.join(process.cwd(), 'modules')}')

from rookie_evaluator import RookieBatch
import json

# Read input data
with open('${inputFile}', 'r') as f:
    rookies_data = json.load(f)

# Create batch and process
batch = RookieBatch()
for player_data in rookies_data:
    batch.add_rookie(player_data)

# Export results
json_output = batch.export_json()
print(json_output)
`;
      
      const scriptFile = path.join(tempDir, `batch_${Date.now()}.py`);
      await fs.writeFile(scriptFile, pythonScript);
      
      const { stdout, stderr } = await execAsync(`python ${scriptFile}`, {
        timeout: 60000,
        cwd: process.cwd()
      });
      
      if (stderr && !stderr.includes('Warning')) {
        console.error('Python stderr:', stderr);
      }
      
      const batchResult = JSON.parse(stdout.trim());
      
      // Cleanup
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(scriptFile).catch(() => {});
      
      res.json({
        success: true,
        batch_result: batchResult,
        engine: 'python_comprehensive',
        timestamp: new Date().toISOString()
      });
      
    } catch (pythonError) {
      console.error('Python batch error:', pythonError);
      
      await fs.unlink(inputFile).catch(() => {});
      
      res.status(500).json({
        success: false,
        error: 'Python batch evaluation failed',
        message: pythonError instanceof Error ? pythonError.message : 'Unknown Python error'
      });
    }
    
  } catch (error) {
    console.error('❌ Error in Python batch evaluation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch with Python engine',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/python-rookie/malik-nabers-test
 * Test the comprehensive system with Malik Nabers
 */
router.post('/malik-nabers-test', async (req, res) => {
  try {
    console.log('🐍 Testing comprehensive Python system with Malik Nabers');
    
    const malikNabers: PythonRookieData = {
      name: "Malik Nabers",
      position: "WR",
      yprr: 2.8,
      receptions: 89,
      receiving_grade: 85.4,
      breakout_age: 20.5,
      dominator_rating: 0.32,
      draft_round: "1",
      age: 21,
      target_share: 0.28,
      ...req.body // Allow override
    };
    
    // Create temp files
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const inputFile = path.join(tempDir, `malik_test_${Date.now()}.json`);
    await fs.writeFile(inputFile, JSON.stringify(malikNabers, null, 2));
    
    try {
      const pythonScript = `
import sys
import os
sys.path.append('${path.join(process.cwd(), 'modules')}')

from rookie_evaluator import evaluate_rookie
import json

# Test data for Malik Nabers
with open('${inputFile}', 'r') as f:
    malik_data = json.load(f)

result = evaluate_rookie(malik_data)
print(json.dumps(result, indent=2))
`;
      
      const scriptFile = path.join(tempDir, `malik_test_${Date.now()}.py`);
      await fs.writeFile(scriptFile, pythonScript);
      
      const { stdout, stderr } = await execAsync(`python ${scriptFile}`, {
        timeout: 30000,
        cwd: process.cwd()
      });
      
      if (stderr && !stderr.includes('Warning')) {
        console.error('Python stderr:', stderr);
      }
      
      const evaluation = JSON.parse(stdout.trim());
      
      // Cleanup
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(scriptFile).catch(() => {});
      
      res.json({
        success: true,
        player: "Malik Nabers",
        evaluation,
        engine: 'python_comprehensive',
        test_case: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (pythonError) {
      console.error('Malik Nabers Python test error:', pythonError);
      
      await fs.unlink(inputFile).catch(() => {});
      
      res.status(500).json({
        success: false,
        error: 'Python test failed',
        message: pythonError instanceof Error ? pythonError.message : 'Unknown Python error'
      });
    }
    
  } catch (error) {
    console.error('❌ Error in Malik Nabers Python test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Python system',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/python-rookie/health
 * Check if Python system is working
 */
router.get('/health', async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync('python -c "import sys; print(sys.version)"', {
      timeout: 10000
    });
    
    // Test import of our module
    const testScript = `
import sys
import os
sys.path.append('${path.join(process.cwd(), 'modules')}')

try:
    from rookie_evaluator import evaluate_rookie, RookieBatch, TIER_THRESHOLDS
    print("✅ Module import successful")
    print(f"Supported positions: {list(TIER_THRESHOLDS.keys())}")
except Exception as e:
    print(f"❌ Module import failed: {e}")
    sys.exit(1)
`;
    
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const testFile = path.join(tempDir, `health_check_${Date.now()}.py`);
    await fs.writeFile(testFile, testScript);
    
    const { stdout: testOutput } = await execAsync(`python ${testFile}`, {
      timeout: 10000,
      cwd: process.cwd()
    });
    
    await fs.unlink(testFile).catch(() => {});
    
    res.json({
      success: true,
      python_version: stdout.trim(),
      module_status: testOutput.trim(),
      engine: 'python_comprehensive',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Python health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Python system not available',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;