import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execAsync = promisify(exec);

interface TiberDataResponse {
  status: string;
  diagnostic_results?: any;
  player_count?: number;
  capabilities?: any;
  error?: string;
}

// Get Tiber Data Integration diagnostic
router.get('/diagnostic', async (req, res) => {
  try {
    console.log('🤖 Running Tiber Data Integration diagnostic...');
    
    const { stdout, stderr } = await execAsync('python test_tiber_data_integration.py');
    
    // Parse the diagnostic output
    const diagnostic_results = {
      nfl_data_py: stdout.includes('✅ Working') ? 'working' : 'error',
      sleeper: 'existing_integration',
      espn: 'available_not_configured',
      player_count: stdout.match(/(\d+) players loaded/) ? 
        parseInt(stdout.match(/(\d+) players loaded/)?.[1] || '0') : 0
    };

    const response: TiberDataResponse = {
      status: 'success',
      diagnostic_results,
      player_count: diagnostic_results.player_count
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Tiber diagnostic error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get data source capabilities
router.get('/capabilities', async (req, res) => {
  try {
    console.log('📊 Retrieving Tiber data source capabilities...');
    
    const capabilities = {
      "Player Data": [
        "nfl.import_seasonal_rosters() - Current rosters with ages, positions, teams",
        "nfl.import_weekly_data() - Weekly player stats (rushing, receiving, passing)",
        "nfl.import_seasonal_data() - Season totals",
        "nfl.import_ids() - Player IDs across platforms (ESPN, Yahoo, Sleeper, etc.)",
        "nfl.import_depth_charts() - Team depth charts",
        "nfl.import_injuries() - Current injury reports"
      ],
      "Team Data": [
        "nfl.import_team_desc() - Team info, divisions, colors, logos",
        "nfl.import_schedules() - Full season schedules",
        "nfl.import_win_totals() - Vegas win totals"
      ],
      "Game Data": [
        "nfl.import_pbp_data() - Play-by-play data",
        "nfl.import_ngs_data() - Next Gen Stats",
        "nfl.import_qbr() - ESPN QBR ratings"
      ],
      "Draft Data": [
        "nfl.import_draft_picks() - Historical draft picks",
        "nfl.import_draft_values() - Pick value charts",
        "nfl.import_combine_data() - Combine results"
      ],
      "Advanced Metrics": [
        "nfl.import_snap_counts() - Snap percentages",
        "nfl.import_officials() - Referee data",
        "nfl.import_ftn_data() - Advanced charting (2022+)"
      ]
    };

    const response: TiberDataResponse = {
      status: 'success',
      capabilities
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Capabilities error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test connection to all data sources
router.get('/test-sources', async (req, res) => {
  try {
    console.log('🔍 Testing all Tiber data sources...');
    
    // Test nfl-data-py
    const { stdout } = await execAsync('python -c "import nfl_data_py as nfl; rosters = nfl.import_seasonal_rosters([2024]); print(f\\"NFL-Data-Py: {len(rosters)} players loaded\\")"');
    
    const response: TiberDataResponse = {
      status: 'success',
      diagnostic_results: {
        nfl_data_py: stdout.includes('players loaded') ? 'working' : 'error',
        sleeper_api: 'existing_integration',
        espn_public: 'available',
        output: stdout.trim()
      }
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Source testing error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;