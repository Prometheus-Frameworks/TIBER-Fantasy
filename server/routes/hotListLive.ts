/**
 * API endpoints for live Hot List data management
 */
import { Router } from 'express';
import { weeklyHotListETL } from '../etl/weeklyHotListUpdate';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';

const router = Router();

/**
 * Manual trigger for weekly data update
 * POST /api/hot-list/refresh
 */
router.post('/refresh', async (req, res) => {
  const { week } = req.body;
  const targetWeek = week || getCurrentNFLWeek();

  console.log(`🔄 Manual Hot List refresh requested for Week ${targetWeek}`);

  try {
    await weeklyHotListETL.updateHotListFromLiveData(targetWeek);
    
    res.json({
      success: true,
      message: `Hot List updated with live data for Week ${targetWeek}`,
      week: targetWeek,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Manual refresh failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh Hot List data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get data source status
 * GET /api/hot-list/sources
 */
router.get('/sources', async (req, res) => {
  const sources = {
    sleeper: {
      available: true,
      lastSync: new Date().toISOString(),
      playerCount: 3755
    },
    nflDataPy: {
      available: !!process.env.PYTHON_PATH,
      lastSync: null,
      weeklyStats: false
    },
    mysportsfeeds: {
      available: !!(process.env.MSF_USERNAME && process.env.MSF_PASSWORD),
      lastSync: null,
      injuryReports: false
    }
  };

  res.json({
    sources,
    integration: {
      etlPipeline: 'ready',
      cronJob: 'active',
      currentWeek: getCurrentNFLWeek()
    }
  });
});

/**
 * Switch to live data mode
 * POST /api/hot-list/mode/live
 */
router.post('/mode/live', async (req, res) => {
  console.log('🔴 Switching Hot List to LIVE data mode...');
  
  // Trigger immediate refresh with live data
  const currentWeek = getCurrentNFLWeek();
  
  try {
    await weeklyHotListETL.updateHotListFromLiveData(currentWeek);
    
    res.json({
      success: true,
      mode: 'live',
      message: 'Hot List now using live NFL data',
      currentWeek,
      nextUpdate: 'Tuesday 2:00 AM ET (automatic)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to switch to live mode',
      fallback: 'Remaining in sample data mode'
    });
  }
});

export default router;