import { Router } from 'express';
import { weeklyTakesService } from '../services/weeklyTakesService';

const router = Router();

/**
 * GET /api/weekly-takes
 * Get weekly fantasy football takes based on matchup and performance data
 */
router.get('/', async (req, res) => {
  try {
    const week = parseInt(req.query.week as string) || 7;
    const season = parseInt(req.query.season as string) || 2025;

    console.log(`📝 [API] Fetching weekly takes for Week ${week}, ${season}`);

    const takes = await weeklyTakesService.generateWeeklyTakes(week, season);

    res.json({
      success: true,
      data: {
        week,
        season,
        takes,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [API] Error fetching weekly takes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate weekly takes'
    });
  }
});

export default router;
