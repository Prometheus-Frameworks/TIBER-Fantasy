/**
 * API endpoints for nightly processing management and monitoring
 * 
 * Security Features:
 * - Admin authentication required for manual triggers (POST endpoints)
 * - Rate limiting to prevent abuse of heavy operations
 * - Public health/status endpoints with light rate limiting for monitoring
 */
import { Router } from 'express';
import { nightlyBuysSellsETL } from '../etl/nightlyBuysSellsUpdate';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';
import { requireAdminAuth } from '../middleware/adminAuth';
import { rateLimiters } from '../middleware/rateLimit';

const router = Router();

/**
 * Manual trigger for nightly Buys/Sells processing
 * POST /api/nightly/buys-sells/process
 * 
 * Security: Requires admin authentication + heavy operation rate limiting
 */
router.post('/buys-sells/process', requireAdminAuth, rateLimiters.heavyOperation, async (req, res) => {
  try {
    console.log('🎯 Manual trigger: Starting nightly Buys/Sells processing...');
    
    const result = await nightlyBuysSellsETL.processNightlyBuysSells();
    
    res.json({
      success: true,
      message: 'Nightly Buys/Sells processing completed successfully',
      data: {
        week: result.week,
        season: result.season,
        totalRecords: result.totalRecords,
        positionsProcessed: result.positionsProcessed,
        formatsProcessed: result.formatsProcessed,
        duration: result.duration,
        errors: result.errors
      }
    });
    
  } catch (error) {
    console.error('❌ Manual nightly processing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Nightly processing failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Process specific week
 * POST /api/nightly/buys-sells/process/:week
 * 
 * Security: Requires admin authentication + heavy operation rate limiting
 */
router.post('/buys-sells/process/:week', requireAdminAuth, rateLimiters.heavyOperation, async (req, res) => {
  try {
    const week = parseInt(req.params.week);
    const season = parseInt(req.query.season as string) || 2025;
    
    if (isNaN(week) || week < 1 || week > 18) {
      return res.status(400).json({
        success: false,
        message: 'Invalid week number. Must be between 1 and 18.'
      });
    }
    
    console.log(`🎯 Manual trigger: Processing Week ${week}, Season ${season}...`);
    
    const result = await nightlyBuysSellsETL.processSpecificWeek(week, season);
    
    res.json({
      success: true,
      message: `Processing completed for Week ${week}, Season ${season}`,
      data: {
        week: result.week,
        season: result.season,
        totalRecords: result.totalRecords,
        positionsProcessed: result.positionsProcessed,
        formatsProcessed: result.formatsProcessed,
        duration: result.duration,
        errors: result.errors
      }
    });
    
  } catch (error) {
    console.error(`❌ Week-specific processing failed:`, error);
    res.status(500).json({
      success: false,
      message: 'Week-specific processing failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check for nightly processing system
 * GET /api/nightly/buys-sells/health
 * 
 * Security: Public endpoint with light rate limiting for monitoring
 */
router.get('/buys-sells/health', rateLimiters.statusCheck, async (req, res) => {
  try {
    console.log('🏥 Running nightly processing health check...');
    
    const healthCheck = await nightlyBuysSellsETL.healthCheck();
    const currentWeek = getCurrentNFLWeek();
    
    res.json({
      success: true,
      message: 'Health check completed',
      data: {
        systemStatus: healthCheck.status,
        currentWeek: parseInt(currentWeek),
        season: 2025,
        timestamp: new Date().toISOString(),
        details: healthCheck.details
      }
    });
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get processing status and statistics
 * GET /api/nightly/buys-sells/status
 * 
 * Security: Public endpoint with light rate limiting for monitoring
 */
router.get('/buys-sells/status', rateLimiters.statusCheck, async (req, res) => {
  try {
    const currentWeek = parseInt(getCurrentNFLWeek());
    const season = 2025;
    
    // Get recent processing statistics
    const { buysSells } = await import('@shared/schema');
    const { db } = await import('../db');
    const { count, avg } = await import('drizzle-orm');
    const { eq, and, gte } = await import('drizzle-orm');
    
    // Get total recommendations for current week
    const currentWeekQuery = await db
      .select({ count: count() })
      .from(buysSells)
      .where(
        and(
          eq(buysSells.season, season),
          eq(buysSells.week, currentWeek)
        )
      );
    
    // Get total recommendations for recent weeks
    const recentWeeksQuery = await db
      .select({ count: count() })
      .from(buysSells)
      .where(
        and(
          eq(buysSells.season, season),
          gte(buysSells.week, currentWeek - 2)
        )
      );
    
    // Get average confidence for current week
    const avgConfidenceQuery = await db
      .select({ avgConfidence: avg(buysSells.confidence) })
      .from(buysSells)
      .where(
        and(
          eq(buysSells.season, season),
          eq(buysSells.week, currentWeek)
        )
      );
    
    // Get verdict distribution for current week
    const verdictDistQuery = await db
      .select({
        verdict: buysSells.verdict,
        count: count()
      })
      .from(buysSells)
      .where(
        and(
          eq(buysSells.season, season),
          eq(buysSells.week, currentWeek)
        )
      )
      .groupBy(buysSells.verdict);
    
    const currentWeekCount = currentWeekQuery[0]?.count || 0;
    const recentWeeksCount = recentWeeksQuery[0]?.count || 0;
    const avgConfidence = avgConfidenceQuery[0]?.avgConfidence || 0;
    
    const verdictDistribution: Record<string, number> = {};
    for (const row of verdictDistQuery) {
      verdictDistribution[row.verdict] = row.count;
    }
    
    res.json({
      success: true,
      message: 'Status retrieved successfully',
      data: {
        currentWeek,
        season,
        timestamp: new Date().toISOString(),
        statistics: {
          currentWeekRecommendations: currentWeekCount,
          recentWeeksRecommendations: recentWeeksCount,
          averageConfidence: Number(avgConfidence).toFixed(3),
          verdictDistribution
        },
        systemInfo: {
          positions: ['QB', 'RB', 'WR', 'TE'],
          formats: ['redraft', 'dynasty'],
          pprSettings: ['ppr', 'half', 'standard'],
          totalCombinations: 4 * 2 * 3 // positions * formats * ppr
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Status check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Status check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get recent processing logs (simplified version)
 * GET /api/nightly/buys-sells/logs
 * 
 * Security: Public endpoint with light rate limiting for monitoring
 */
router.get('/buys-sells/logs', rateLimiters.statusCheck, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const currentWeek = getCurrentNFLWeek();
    
    // Return basic log information
    // In a production system, you'd want to read from actual log files
    res.json({
      success: true,
      message: 'Logs retrieved successfully',
      data: {
        currentWeek: parseInt(currentWeek),
        season: 2025,
        timestamp: new Date().toISOString(),
        recentActivity: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Nightly processing system is active and monitoring'
          }
        ],
        cronSchedule: {
          nightly: '0 3 * * * (Every day at 3 AM ET)',
          weekly: '0 4 * * 2 (Tuesdays at 4 AM ET)',
          hotList: '0 2 * * 2 (Tuesdays at 2 AM ET)'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Logs retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Logs retrieval failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as nightlyProcessingRoutes };