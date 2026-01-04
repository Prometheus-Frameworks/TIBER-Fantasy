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
// Bronze Layer integrations
import { bronzeLayerService } from '../services/BronzeLayerService';
import { sleeperAdapter } from '../adapters/SleeperAdapter';
import { ecrAdapter } from '../adapters/ECRAdapter';
// Silver Layer integration
import { silverLayerService } from '../services/SilverLayerService';

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

// ========================================
// BRONZE LAYER ETL INTEGRATION ENDPOINTS
// ========================================

/**
 * POST /api/etl/bronze-ingest
 * Trigger Bronze Layer raw data ingestion as part of ETL pipeline
 * Integrates raw data collection with downstream processing
 */
router.post('/bronze-ingest', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [ETL-Bronze] Raw data ingestion triggered by admin from ${req.ip}`);
    
    const { 
      sources = ['sleeper'], // Default to safe source
      season, 
      week,
      mockData = false,
      jobId
    } = req.body;

    const targetSeason = season || new Date().getFullYear();
    const targetWeek = week || parseInt(getCurrentNFLWeek());
    const etlJobId = jobId || `etl_bronze_${targetSeason}_w${targetWeek}_${Date.now()}`;

    console.log(`📊 Processing Bronze Layer ingestion: Sources [${sources.join(', ')}], Season ${targetSeason}, Week ${targetWeek}`);

    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // Ingest from Sleeper if requested
    if (sources.includes('sleeper')) {
      try {
        console.log(`🔄 Ingesting Sleeper data...`);
        const sleeperResult = await sleeperAdapter.ingestFullCycle({
          season: targetSeason,
          week: targetWeek,
          jobId: `${etlJobId}_sleeper`,
          includeTrending: true,
          includeStats: true
        });
        results.sleeper = sleeperResult;
        
        // Mark payloads as processing in ETL context
        await bronzeLayerService.updatePayloadStatus(sleeperResult.playerPayloadId, 'PROCESSING');
        if (sleeperResult.trendingPayloadId) {
          await bronzeLayerService.updatePayloadStatus(sleeperResult.trendingPayloadId, 'PROCESSING');
        }
        
        console.log(`✅ Sleeper ingestion completed: Player payload ${sleeperResult.playerPayloadId}`);
      } catch (error) {
        errors.sleeper = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Sleeper ingestion failed:`, error);
      }
    }

    // Ingest from ECR if requested
    if (sources.includes('ecr')) {
      try {
        console.log(`🔄 Ingesting ECR data...`);
        const ecrResult = await ecrAdapter.ingestFullCycle({
          season: targetSeason,
          week: targetWeek,
          jobId: `${etlJobId}_ecr`,
          mockData,
          positions: ['QB', 'RB', 'WR', 'TE'],
          includeADP: true
        });
        results.ecr = ecrResult;
        
        // Mark ECR payloads as processing
        for (const payloadId of ecrResult.rankingsPayloadIds) {
          await bronzeLayerService.updatePayloadStatus(payloadId, 'PROCESSING');
        }
        
        console.log(`✅ ECR ingestion completed: ${ecrResult.rankingsPayloadIds.length} ranking payloads`);
      } catch (error) {
        errors.ecr = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ ECR ingestion failed:`, error);
      }
    }

    const duration = Date.now() - startTime;
    const successCount = Object.keys(results).length;
    const errorCount = Object.keys(errors).length;

    console.log(`✅ [ETL-Bronze] Raw data ingestion completed in ${duration}ms`);
    console.log(`   📊 Successful sources: ${successCount} | Failed sources: ${errorCount}`);

    res.status(200).json({
      success: successCount > 0,
      message: `Bronze Layer ingestion completed: ${successCount} successful, ${errorCount} failed`,
      data: {
        results,
        errors,
        etlJobId,
        season: targetSeason,
        week: targetWeek,
        duration,
        summary: {
          sourcesRequested: sources.length,
          sourcesSuccessful: successCount,
          sourcesFailed: errorCount
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [ETL-Bronze] Raw data ingestion failed:`, error);

    res.status(500).json({
      success: false,
      message: 'Bronze Layer ingestion failed',
      error: errorMessage,
      duration
    });
  }
});

/**
 * POST /api/etl/bronze-to-silver
 * Process Bronze Layer raw payloads into Silver Layer normalized data
 * Connects raw data storage to canonical data processing
 */
router.post('/bronze-to-silver', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log(`🔄 [ETL-Bronze] Bronze to Silver processing triggered by admin from ${req.ip}`);

    const {
      source,
      status = 'PENDING',
      season,
      week,
      limit = 100,
      processAll = false
    } = req.body;

    const targetSeason = season || new Date().getFullYear();
    const targetWeek = week;

    console.log(`📊 Processing Bronze to Silver: Source [${source || 'all'}], Status [${status}], Season ${targetSeason}${targetWeek ? `, Week ${targetWeek}` : ''}`);

    // Get raw payloads ready for processing
    const payloads = await bronzeLayerService.getRawPayloads({
      source,
      status: status as any,
      season: targetSeason,
      week: targetWeek,
      limit: processAll ? undefined : limit
    });

    console.log(`📊 Found ${payloads.length} payloads to process`);

    if (payloads.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No payloads found for processing',
        data: {
          processed: 0,
          source: source || 'all',
          status,
          season: targetSeason,
          week: targetWeek
        }
      });
    }

    // Use SilverLayerService to process payloads
    const payloadIds = payloads.map(p => p.id);
    const silverResult = await silverLayerService.processBronzeToSilver(payloadIds);

    // Update payload statuses based on processing results
    if (silverResult.success > 0) {
      // Mark successfully processed payloads as SUCCESS
      const successfulPayloadIds = payloadIds.filter(id =>
        !silverResult.errorDetails.some(err => err.payloadId === id)
      );
      if (successfulPayloadIds.length > 0) {
        await bronzeLayerService.updateBatchPayloadStatus(successfulPayloadIds, 'SUCCESS');
        console.log(`📝 [ETL-Bronze] Marked ${successfulPayloadIds.length} payloads as SUCCESS`);
      }
    }

    // Mark failed payloads
    if (silverResult.errorDetails.length > 0) {
      for (const error of silverResult.errorDetails) {
        await bronzeLayerService.updatePayloadStatus(error.payloadId, 'FAILED', error.error);
      }
      console.log(`📝 [ETL-Bronze] Marked ${silverResult.errorDetails.length} payloads as FAILED`);
    }

    const duration = Date.now() - startTime;

    console.log(`✅ [ETL-Bronze] Bronze to Silver processing completed in ${duration}ms`);
    console.log(`   📊 Processed: ${silverResult.processed} | Success: ${silverResult.success} | Errors: ${silverResult.errors} | Skipped: ${silverResult.skipped}`);
    console.log(`   📈 Table Results:`, silverResult.tableResults);

    res.status(200).json({
      success: silverResult.success > 0,
      message: `Bronze to Silver processing completed: ${silverResult.success} successful, ${silverResult.errors} failed, ${silverResult.skipped} skipped`,
      data: {
        ...silverResult,
        source: source || 'all',
        season: targetSeason,
        week: targetWeek,
        duration
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [ETL-Bronze] Bronze to Silver processing failed:`, error);

    res.status(500).json({
      success: false,
      message: 'Bronze to Silver processing failed',
      error: errorMessage,
      duration
    });
  }
});

/**
 * GET /api/etl/bronze-status
 * Get Bronze Layer status integrated with ETL monitoring
 * Provides comprehensive view of raw data pipeline health
 */
router.get('/bronze-status', async (req: Request, res: Response) => {
  try {
    console.log(`📊 [ETL-Bronze] Bronze Layer status requested by admin from ${req.ip}`);

    // Get Bronze Layer statistics
    const bronzeStats = await bronzeLayerService.getDataSourceStats();
    
    // Calculate overall Bronze Layer health
    const totalPayloads = bronzeStats.reduce((sum, stat) => sum + stat.totalPayloads, 0);
    const totalSuccessful = bronzeStats.reduce((sum, stat) => sum + stat.successfulPayloads, 0);
    const totalFailed = bronzeStats.reduce((sum, stat) => sum + stat.failedPayloads, 0);
    const totalPending = bronzeStats.reduce((sum, stat) => sum + stat.pendingPayloads, 0);
    
    const successRate = totalPayloads > 0 ? Math.round((totalSuccessful / totalPayloads) * 100) : 0;
    
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (successRate < 50) {
      healthStatus = 'unhealthy';
    } else if (successRate < 80 || totalPending > 10) {
      healthStatus = 'degraded';
    }

    // Get recent activity
    const currentWeek = parseInt(getCurrentNFLWeek());
    const currentSeason = new Date().getFullYear();
    
    const recentPayloads = await bronzeLayerService.getRawPayloads({
      season: currentSeason,
      fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      limit: 50
    });

    const statusData = {
      status: healthStatus,
      summary: {
        totalPayloads,
        totalSuccessful,
        totalFailed,
        totalPending,
        successRate: `${successRate}%`,
        activeSources: bronzeStats.filter(s => s.totalPayloads > 0).length
      },
      sourceStats: bronzeStats.map(stat => ({
        source: stat.source,
        status: stat.failedPayloads > stat.successfulPayloads ? 'degraded' : 'healthy',
        payloads: stat.totalPayloads,
        successRate: stat.totalPayloads > 0 
          ? Math.round((stat.successfulPayloads / stat.totalPayloads) * 100) 
          : 0,
        lastIngest: stat.lastIngestDate
      })),
      recentActivity: {
        last24Hours: recentPayloads.length,
        currentWeek,
        currentSeason
      },
      lastUpdated: new Date().toISOString()
    };

    console.log(`📊 Bronze Layer status: ${healthStatus} (${successRate}% success rate)`);

    res.status(200).json({
      success: true,
      data: statusData
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [ETL-Bronze] Bronze status check failed:`, error);

    res.status(500).json({
      success: false,
      message: 'Bronze Layer status check failed',
      error: errorMessage
    });
  }
});

/**
 * POST /api/etl/full-pipeline-with-bronze
 * Enhanced full pipeline that includes Bronze Layer raw data ingestion
 * Complete end-to-end ETL: Bronze -> Silver -> Gold
 */
router.post('/full-pipeline-with-bronze', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [ETL-Bronze] Full pipeline with Bronze Layer triggered by admin from ${req.ip}`);
    
    const { 
      week, 
      season, 
      force = false,
      bronzeSources = ['sleeper'],
      includeBronzeProcessing = true,
      mockData = false
    } = req.body;
    
    const targetWeek = week || parseInt(getCurrentNFLWeek());
    const targetSeason = season || new Date().getFullYear();
    const pipelineJobId = `full_bronze_pipeline_${targetSeason}_w${targetWeek}_${Date.now()}`;

    console.log(`🔄 Running full pipeline with Bronze Layer for Week ${targetWeek}, Season ${targetSeason}`);

    const pipelineResults: Record<string, any> = {};
    let currentStep = 1;

    // Step 1: Bronze Layer Raw Data Ingestion
    console.log(`📊 Step ${currentStep++}: Bronze Layer Raw Data Ingestion...`);
    try {
      const bronzeIngestionResult = {
        results: {} as Record<string, any>,
        errors: {} as Record<string, any>
      };

      // Ingest from requested sources
      if (bronzeSources.includes('sleeper')) {
        try {
          const sleeperResult = await sleeperAdapter.ingestFullCycle({
            season: targetSeason,
            week: targetWeek,
            jobId: `${pipelineJobId}_sleeper`
          });
          bronzeIngestionResult.results.sleeper = sleeperResult;
        } catch (error) {
          bronzeIngestionResult.errors.sleeper = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      if (bronzeSources.includes('ecr')) {
        try {
          const ecrResult = await ecrAdapter.ingestFullCycle({
            season: targetSeason,
            week: targetWeek,
            mockData,
            jobId: `${pipelineJobId}_ecr`
          });
          bronzeIngestionResult.results.ecr = ecrResult;
        } catch (error) {
          bronzeIngestionResult.errors.ecr = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      pipelineResults.bronzeIngestion = bronzeIngestionResult;
      console.log(`✅ Bronze Layer ingestion completed: ${Object.keys(bronzeIngestionResult.results).length} sources successful`);

    } catch (error) {
      pipelineResults.bronzeIngestion = { error: error instanceof Error ? error.message : 'Unknown error' };
      console.error(`❌ Bronze Layer ingestion failed:`, error);
    }

    // Step 2: Bronze to Silver Processing (if enabled)
    if (includeBronzeProcessing) {
      console.log(`📊 Step ${currentStep++}: Bronze to Silver Processing...`);
      try {
        // Process recent Bronze payloads
        const silverProcessingResult = {
          message: 'Bronze to Silver processing placeholder - Silver Layer implementation pending',
          processed: 0,
          note: 'This step will be fully implemented when Silver Layer is ready'
        };
        
        pipelineResults.silverProcessing = silverProcessingResult;
        console.log(`⚠️ Silver processing placeholder completed`);
        
      } catch (error) {
        pipelineResults.silverProcessing = { error: error instanceof Error ? error.message : 'Unknown error' };
        console.error(`❌ Silver processing failed:`, error);
      }
    }

    // Step 3: Existing Core Week Ingest (Silver/Gold Layer)
    console.log(`📊 Step ${currentStep++}: Core Week Ingest (Silver/Gold Layer)...`);
    try {
      const ingestResult = await coreWeekIngestETL.ingestWeeklyData(targetWeek, targetSeason);
      pipelineResults.coreIngest = ingestResult;
      console.log(`✅ Core Week Ingest completed: ${ingestResult.playersProcessed} players processed`);
    } catch (error) {
      pipelineResults.coreIngest = { error: error instanceof Error ? error.message : 'Unknown error' };
      console.error(`❌ Core Week Ingest failed:`, error);
    }

    // Step 4: Buys/Sells Computation (Gold Layer)
    console.log(`📊 Step ${currentStep++}: Buys/Sells Computation (Gold Layer)...`);
    try {
      const buysSellsResult = await nightlyBuysSellsETL.processSpecificWeek(targetWeek, targetSeason);
      pipelineResults.buysSells = buysSellsResult;
      console.log(`✅ Buys/Sells computation completed: ${buysSellsResult.totalRecords} recommendations generated`);
    } catch (error) {
      pipelineResults.buysSells = { error: error instanceof Error ? error.message : 'Unknown error' };
      console.error(`❌ Buys/Sells computation failed:`, error);
    }

    const totalDuration = Date.now() - startTime;
    const successfulSteps = Object.values(pipelineResults).filter(result => !result.error).length;
    const totalSteps = Object.keys(pipelineResults).length;

    console.log(`🏁 [ETL-Bronze] Full pipeline with Bronze Layer completed in ${totalDuration}ms`);
    console.log(`   📊 Successful steps: ${successfulSteps}/${totalSteps}`);

    res.status(200).json({
      success: successfulSteps > 0,
      message: `Full pipeline with Bronze Layer completed: ${successfulSteps}/${totalSteps} steps successful`,
      data: {
        pipelineJobId,
        week: targetWeek,
        season: targetSeason,
        results: pipelineResults,
        summary: {
          totalSteps,
          successfulSteps,
          failedSteps: totalSteps - successfulSteps,
          totalDuration,
          bronzeSources,
          includedBronzeProcessing: includeBronzeProcessing
        }
      }
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [ETL-Bronze] Full pipeline with Bronze Layer failed:`, error);

    res.status(500).json({
      success: false,
      message: 'Full pipeline with Bronze Layer failed',
      error: errorMessage,
      duration: totalDuration
    });
  }
});

export default router;