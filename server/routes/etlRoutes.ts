/**
 * ETL Routes - Admin endpoints for data ingestion and processing
 * Provides manual triggers for ETL operations with proper authentication
 */

import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth';
import { coreWeekIngestETL } from '../etl/CoreWeekIngest';
import { nightlyBuysSellsETL } from '../etl/nightlyBuysSellsUpdate';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';
import { playerIdentityService } from '../services/PlayerIdentityService';
import { playerIdentityMigration } from '../services/PlayerIdentityMigration';

const router = Router();

// Apply admin authentication to all ETL routes
router.use(requireAdminAuth);

/**
 * POST /api/etl/ingest-week
 * Manual trigger for Core Week Ingest ETL pipeline
 * Populates player_week_facts table with weekly player statistics
 */
router.post('/ingest-week', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [ETL] Manual Core Week Ingest triggered by admin from ${req.ip}`);
    
    // Extract parameters from request
    const { week, season, force = false } = req.body;
    
    // Validate parameters
    const targetWeek = week || parseInt(getCurrentNFLWeek());
    const targetSeason = season || 2025;
    
    if (targetWeek < 1 || targetWeek > 18) {
      return res.status(400).json({
        success: false,
        message: 'Invalid week number',
        error: 'Week must be between 1 and 18'
      });
    }
    
    if (targetSeason < 2020 || targetSeason > 2030) {
      return res.status(400).json({
        success: false,
        message: 'Invalid season',
        error: 'Season must be between 2020 and 2030'
      });
    }
    
    console.log(`📊 Processing Week ${targetWeek}, Season ${targetSeason} (force: ${force})`);
    
    // Check if data already exists unless force flag is set
    if (!force) {
      const { db } = await import('../db');
      const { playerWeekFacts } = await import('@shared/schema');
      const { eq, and, count } = await import('drizzle-orm');
      
      const existingDataQuery = await db
        .select({ count: count() })
        .from(playerWeekFacts)
        .where(
          and(
            eq(playerWeekFacts.season, targetSeason),
            eq(playerWeekFacts.week, targetWeek)
          )
        );
      
      const existingCount = existingDataQuery[0]?.count || 0;
      
      if (existingCount > 0) {
        console.log(`⚠️ Data already exists for Week ${targetWeek}, Season ${targetSeason}: ${existingCount} records`);
        return res.status(409).json({
          success: false,
          message: 'Data already exists for this week',
          error: `Found ${existingCount} existing records. Use force=true to overwrite`,
          data: {
            week: targetWeek,
            season: targetSeason,
            existingRecords: existingCount
          }
        });
      }
    }
    
    // Run the ingest process
    const result = await coreWeekIngestETL.ingestWeeklyData(targetWeek, targetSeason);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [ETL] Core Week Ingest completed successfully in ${duration}ms`);
    console.log(`   📊 Processed ${result.playersProcessed} players`);
    console.log(`   📈 Position coverage: QB:${result.positionCoverage.QB}, RB:${result.positionCoverage.RB}, WR:${result.positionCoverage.WR}, TE:${result.positionCoverage.TE}`);
    
    res.status(200).json({
      success: true,
      message: 'Core Week Ingest completed successfully',
      data: {
        ...result,
        duration: duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [ETL] Core Week Ingest failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Core Week Ingest failed',
      error: errorMessage,
      duration: duration
    });
  }
});

/**
 * POST /api/etl/buys-sells
 * Manual trigger for Buys/Sells computation
 * Generates trade recommendations based on player_week_facts data
 */
router.post('/buys-sells', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [ETL] Manual Buys/Sells computation triggered by admin from ${req.ip}`);
    
    const { week, season } = req.body;
    const targetWeek = week || parseInt(getCurrentNFLWeek());
    const targetSeason = season || 2025;
    
    console.log(`💡 Processing Buys/Sells for Week ${targetWeek}, Season ${targetSeason}`);
    
    // Check if we have player_week_facts data first
    const { db } = await import('../db');
    const { playerWeekFacts } = await import('@shared/schema');
    const { eq, and, count } = await import('drizzle-orm');
    
    const playerFactsQuery = await db
      .select({ count: count() })
      .from(playerWeekFacts)
      .where(
        and(
          eq(playerWeekFacts.season, targetSeason),
          eq(playerWeekFacts.week, targetWeek)
        )
      );
    
    const playerFactsCount = playerFactsQuery[0]?.count || 0;
    
    if (playerFactsCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'No player week facts data found',
        error: `Run /api/etl/ingest-week first to populate data for Week ${targetWeek}, Season ${targetSeason}`,
        data: {
          week: targetWeek,
          season: targetSeason,
          playerFactsFound: playerFactsCount
        }
      });
    }
    
    // Run the Buys/Sells computation
    let result;
    if (week && season) {
      result = await nightlyBuysSellsETL.processSpecificWeek(targetWeek, targetSeason);
    } else {
      result = await nightlyBuysSellsETL.processNightlyBuysSells();
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [ETL] Buys/Sells computation completed successfully in ${duration}ms`);
    console.log(`   📊 Generated ${result.totalRecords} recommendations`);
    console.log(`   🎯 Positions processed: ${result.positionsProcessed.join(', ')}`);
    
    res.status(200).json({
      success: true,
      message: 'Buys/Sells computation completed successfully',
      data: {
        ...result,
        duration: duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [ETL] Buys/Sells computation failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Buys/Sells computation failed',
      error: errorMessage,
      duration: duration
    });
  }
});

/**
 * POST /api/etl/populate-identity-map
 * Populate Player Identity Map with existing Sleeper players
 * Should be run once to migrate existing data
 */
router.post('/populate-identity-map', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [ETL] Player Identity Map population triggered by admin from ${req.ip}`);
    
    const { force = false, dryRun = false } = req.body;
    
    // Check if migration is needed
    if (!force && !dryRun) {
      const status = await playerIdentityMigration.getMigrationStatus();
      if (status.isComplete) {
        return res.status(409).json({
          success: false,
          message: 'Player Identity Map already populated',
          data: {
            playerCount: status.playerCount,
            sleeperCount: status.sleeperCount,
            lastMigration: status.lastMigration
          }
        });
      }
    }
    
    console.log(`📊 Starting Player Identity Map population (force: ${force}, dryRun: ${dryRun})`);
    
    const result = await playerIdentityMigration.runMigration({ force, dryRun });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [ETL] Player Identity Map population completed successfully in ${duration}ms`);
    console.log(`   📊 Processed ${result.totalProcessed} players`);
    console.log(`   ✅ Imported ${result.imported}, ⏭️ Skipped ${result.skipped}, ❌ Errors ${result.errors}`);
    
    res.status(200).json({
      success: true,
      message: dryRun ? 'Dry run completed successfully' : 'Player Identity Map populated successfully',
      data: {
        ...result,
        duration: duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [ETL] Player Identity Map population failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Player Identity Map population failed',
      error: errorMessage,
      duration: duration
    });
  }
});

/**
 * GET /api/etl/identity-map-status
 * Check Player Identity Map population status
 */
router.get('/identity-map-status', async (req: Request, res: Response) => {
  try {
    const [migrationStatus, systemStats] = await Promise.all([
      playerIdentityMigration.getMigrationStatus(),
      playerIdentityService.getSystemStats()
    ]);
    
    res.json({
      success: true,
      data: {
        migration: migrationStatus,
        system: systemStats
      }
    });
  } catch (error) {
    console.error('[ETL] Error getting identity map status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get identity map status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/etl/full-pipeline
 * Run complete ETL pipeline: ingest-week followed by buys-sells
 * Convenient endpoint for full data refresh
 */
router.post('/full-pipeline', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [ETL] Full pipeline triggered by admin from ${req.ip}`);
    
    const { week, season, force = false } = req.body;
    const targetWeek = week || parseInt(getCurrentNFLWeek());
    const targetSeason = season || 2025;
    
    console.log(`🚀 Running full ETL pipeline for Week ${targetWeek}, Season ${targetSeason}`);
    
    // Step 1: Run Core Week Ingest
    console.log(`📊 Step 1: Running Core Week Ingest...`);
    const ingestResult = await coreWeekIngestETL.ingestWeeklyData(targetWeek, targetSeason);
    
    // Step 2: Run Buys/Sells computation
    console.log(`💡 Step 2: Running Buys/Sells computation...`);
    const buysSellsResult = await nightlyBuysSellsETL.processSpecificWeek(targetWeek, targetSeason);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [ETL] Full pipeline completed successfully in ${duration}ms`);
    console.log(`   📊 Ingested ${ingestResult.playersProcessed} players`);
    console.log(`   💡 Generated ${buysSellsResult.totalRecords} trade recommendations`);
    
    res.status(200).json({
      success: true,
      message: 'Full ETL pipeline completed successfully',
      data: {
        week: targetWeek,
        season: targetSeason,
        ingestResult,
        buysSellsResult,
        totalDuration: duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [ETL] Full pipeline failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Full ETL pipeline failed',
      error: errorMessage,
      duration: duration
    });
  }
});

/**
 * GET /api/etl/status
 * Get status of ETL systems and recent data
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    console.log(`📊 [ETL] Status check requested by admin from ${req.ip}`);
    
    const currentWeek = parseInt(getCurrentNFLWeek());
    const currentSeason = 2025;
    
    // Check Core Week Ingest health
    const ingestHealth = await coreWeekIngestETL.healthCheck();
    
    // Check Buys/Sells system health  
    const buysSellsHealth = await nightlyBuysSellsETL.healthCheck();
    
    // Get recent data counts
    const { db } = await import('../db');
    const { playerWeekFacts, buysSells } = await import('@shared/schema');
    const { eq, and, count, gte } = await import('drizzle-orm');
    
    // Recent player week facts
    const recentPlayerFactsQuery = await db
      .select({ count: count() })
      .from(playerWeekFacts)
      .where(
        and(
          eq(playerWeekFacts.season, currentSeason),
          gte(playerWeekFacts.week, currentWeek - 1)
        )
      );
    
    // Recent buys/sells recommendations
    const recentBuysSellsQuery = await db
      .select({ count: count() })
      .from(buysSells)
      .where(
        and(
          eq(buysSells.season, currentSeason),
          gte(buysSells.week, currentWeek - 1)
        )
      );
    
    const recentPlayerFacts = recentPlayerFactsQuery[0]?.count || 0;
    const recentBuysSells = recentBuysSellsQuery[0]?.count || 0;
    
    // Overall system status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (ingestHealth.status === 'unhealthy' || buysSellsHealth.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (ingestHealth.status === 'degraded' || buysSellsHealth.status === 'degraded') {
      overallStatus = 'degraded';
    }
    
    const statusData = {
      status: overallStatus,
      currentWeek,
      currentSeason,
      systems: {
        coreWeekIngest: ingestHealth,
        buysSells: buysSellsHealth,
      },
      dataCount: {
        recentPlayerFacts,
        recentBuysSells,
      },
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`📊 ETL system status: ${overallStatus}`);
    console.log(`   Player facts: ${recentPlayerFacts}, Buys/Sells: ${recentBuysSells}`);
    
    res.status(200).json({
      success: true,
      data: statusData
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [ETL] Status check failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'ETL status check failed',
      error: errorMessage
    });
  }
});

/**
 * DELETE /api/etl/clear-week
 * Clear data for a specific week (for testing/reprocessing)
 */
router.delete('/clear-week', async (req: Request, res: Response) => {
  try {
    console.log(`🗑️ [ETL] Clear week data requested by admin from ${req.ip}`);
    
    const { week, season, tables = ['player_week_facts', 'buys_sells'] } = req.body;
    
    if (!week || !season) {
      return res.status(400).json({
        success: false,
        message: 'Week and season are required',
        error: 'Provide week and season parameters'
      });
    }
    
    const { db } = await import('../db');
    const { playerWeekFacts, buysSells } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    let deletedCounts: Record<string, number> = {};
    
    // Clear player_week_facts if requested
    if (tables.includes('player_week_facts')) {
      const deletedPlayerFacts = await db
        .delete(playerWeekFacts)
        .where(
          and(
            eq(playerWeekFacts.season, season),
            eq(playerWeekFacts.week, week)
          )
        );
      
      deletedCounts.player_week_facts = deletedPlayerFacts.rowCount || 0;
    }
    
    // Clear buys_sells if requested
    if (tables.includes('buys_sells')) {
      const deletedBuysSells = await db
        .delete(buysSells)
        .where(
          and(
            eq(buysSells.season, season),
            eq(buysSells.week, week)
          )
        );
      
      deletedCounts.buys_sells = deletedBuysSells.rowCount || 0;
    }
    
    console.log(`✅ [ETL] Cleared Week ${week}, Season ${season}:`, deletedCounts);
    
    res.status(200).json({
      success: true,
      message: `Cleared data for Week ${week}, Season ${season}`,
      data: {
        week,
        season,
        tablesCleared: tables,
        deletedCounts
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [ETL] Clear week data failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Clear week data failed',
      error: errorMessage
    });
  }
});

export default router;