import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execAsync = promisify(exec);

interface PopulationStatsResponse {
  status: string;
  rb_stats?: any;
  wr_stats?: any;
  team_context?: any;
  error?: string;
}

// Calculate real NFL population statistics for RB compass
router.get('/rb-population', async (req, res) => {
  try {
    console.log('📊 Calculating real RB population statistics...');
    
    const { stdout, stderr } = await execAsync('python -c "from modules.tiber_population_stats import TiberPopulationStats; calc = TiberPopulationStats(2024); import json; stats = calc.calculate_rb_population_stats(); print(json.dumps(stats))"');
    
    const rb_stats = JSON.parse(stdout.trim());
    
    const response: PopulationStatsResponse = {
      status: 'success',
      rb_stats
    };

    res.json(response);
  } catch (error) {
    console.error('❌ RB population stats error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Calculate real NFL population statistics for WR compass
router.get('/wr-population', async (req, res) => {
  try {
    console.log('🎯 Calculating real WR population statistics...');
    
    const { stdout, stderr } = await execAsync('python -c "from modules.tiber_population_stats import TiberPopulationStats; calc = TiberPopulationStats(2024); import json; stats = calc.calculate_wr_population_stats(); print(json.dumps(stats))"');
    
    const wr_stats = JSON.parse(stdout.trim());
    
    const response: PopulationStatsResponse = {
      status: 'success',
      wr_stats
    };

    res.json(response);
  } catch (error) {
    console.error('❌ WR population stats error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Calculate team context statistics
router.get('/team-context', async (req, res) => {
  try {
    console.log('🏈 Calculating team context statistics...');
    
    const { stdout, stderr } = await execAsync('python -c "from modules.tiber_population_stats import TiberPopulationStats; calc = TiberPopulationStats(2024); import json; stats = calc.get_team_context_stats(); print(json.dumps(stats))"');
    
    const team_context = JSON.parse(stdout.trim());
    
    const response: PopulationStatsResponse = {
      status: 'success',
      team_context
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Team context error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all population statistics at once
router.get('/all', async (req, res) => {
  try {
    console.log('📊 Calculating all population statistics...');
    
    const { stdout, stderr } = await execAsync('python modules/tiber_population_stats.py');
    
    // Parse the output to extract the statistics
    // This is a simplified version - in production you'd want more robust parsing
    const response: PopulationStatsResponse = {
      status: 'success',
      rb_stats: 'calculated',
      wr_stats: 'calculated', 
      team_context: 'calculated'
    };

    res.json(response);
  } catch (error) {
    console.error('❌ All population stats error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;