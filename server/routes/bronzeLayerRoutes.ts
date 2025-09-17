/**
 * Bronze Layer API Routes - Raw Data Storage System
 * 
 * RESTful endpoints for managing raw data ingestion and operations
 * Provides comprehensive CRUD operations and monitoring capabilities
 * 
 * Endpoints:
 * - Data Ingestion: Trigger data collection from various sources
 * - Payload Management: CRUD operations for stored raw data
 * - Status Monitoring: Health checks and statistics
 * - Data Management: Cleanup and maintenance operations
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAdminAuth } from '../middleware/adminAuth';
import { bronzeLayerService, type PayloadQueryFilters } from '../services/BronzeLayerService';
import { sleeperAdapter, type SleeperIngestionOptions } from '../adapters/SleeperAdapter';
import { nflDataPyAdapter, type NFLDataPyIngestionOptions } from '../adapters/NFLDataPyAdapter';
import { ecrAdapter, type ECRIngestionOptions } from '../adapters/ECRAdapter';
import { mySportsFeedsAdapter, type MySportsFeedsIngestionOptions } from '../adapters/MySportsFeedsAdapter';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';
import { dataSourceEnum, ingestStatusEnum } from '@shared/schema';

// ========================================
// VALIDATION SCHEMAS
// ========================================

const SleeperIngestionSchema = z.object({
  season: z.number().int().min(2020).max(2030).optional(),
  week: z.number().int().min(1).max(18).optional(),
  positions: z.array(z.string()).optional(),
  includeTrending: z.boolean().default(true),
  includeStats: z.boolean().default(true),
  fullCycle: z.boolean().default(true)
});

const NFLDataPyIngestionSchema = z.object({
  season: z.number().int().min(2020).max(2030).optional(),
  week: z.number().int().min(1).max(18).optional(),
  positions: z.array(z.string()).optional(),
  includeAdvanced: z.boolean().default(true),
  mockData: z.boolean().default(false)
});

const ECRIngestionSchema = z.object({
  season: z.number().int().min(2020).max(2030).optional(),
  week: z.number().int().min(1).max(18).optional(),
  positions: z.array(z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DST'])).default(['QB', 'RB', 'WR', 'TE']),
  formats: z.array(z.enum(['ppr', 'half-ppr', 'standard'])).default(['ppr']),
  leagueTypes: z.array(z.enum(['redraft', 'dynasty', 'bestball'])).default(['redraft']),
  includeADP: z.boolean().default(true),
  mockData: z.boolean().default(false)
});

const MySportsFeedsIngestionSchema = z.object({
  season: z.number().int().min(2020).max(2030).optional(),
  week: z.number().int().min(1).max(18).optional(),
  positions: z.array(z.string()).optional(),
  teams: z.array(z.string()).optional(),
  includeInjuries: z.boolean().default(true),
  includeGameLogs: z.boolean().default(true),
  includeRosters: z.boolean().default(true),
  mockData: z.boolean().default(false),
  apiKey: z.string().optional()
});

const PayloadQuerySchema = z.object({
  source: z.enum(dataSourceEnum.enumValues).optional(),
  status: z.enum(ingestStatusEnum.enumValues).optional(),
  season: z.number().int().min(2020).max(2030).optional(),
  week: z.number().int().min(1).max(18).optional(),
  jobId: z.string().optional(),
  endpoint: z.string().optional(),
  fromDate: z.string().transform((str) => new Date(str)).optional(),
  toDate: z.string().transform((str) => new Date(str)).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0)
});

const router = Router();

// Apply admin authentication to all Bronze Layer routes
router.use(requireAdminAuth);

// ========================================
// DATA INGESTION ENDPOINTS
// ========================================

/**
 * POST /api/bronze/ingest/sleeper
 * Trigger raw data ingestion from Sleeper API
 * Stores complete player roster, stats, and trending data
 */
router.post('/ingest/sleeper', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [BronzeAPI] Sleeper ingestion triggered by admin from ${req.ip}`);
    
    // Validate input with Zod schema
    const validationResult = SleeperIngestionSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error(`❌ [BronzeAPI] Invalid Sleeper ingestion request:`, validationResult.error);
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
        errors: validationResult.error.errors,
        duration: Date.now() - startTime
      });
    }

    const {
      season,
      week,
      positions,
      includeTrending,
      includeStats,
      fullCycle
    } = validationResult.data;

    const options: SleeperIngestionOptions = {
      season: season || new Date().getFullYear(),
      week: week,
      positions: positions,
      includeTrending,
      includeStats,
      jobId: `sleeper_api_${Date.now()}`
    };

    console.log(`📊 Processing Sleeper ingestion:`, options);

    let result;
    if (fullCycle) {
      result = await sleeperAdapter.ingestFullCycle(options);
    } else {
      // Individual ingestion
      const playerPayloadId = await sleeperAdapter.ingestAllPlayers(options);
      result = { playerPayloadId };
    }

    const duration = Date.now() - startTime;

    console.log(`✅ [BronzeAPI] Sleeper ingestion completed in ${duration}ms`);

    res.status(200).json({
      success: true,
      message: 'Sleeper data ingestion completed successfully',
      data: {
        ...result,
        duration,
        options
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [BronzeAPI] Sleeper ingestion failed:`, error);

    res.status(500).json({
      success: false,
      message: 'Sleeper data ingestion failed',
      error: errorMessage,
      duration
    });
  }
});

/**
 * POST /api/bronze/ingest/nfl-data-py
 * Trigger raw data ingestion from NFL-Data-Py (deprecated service)
 * Includes mock data option for testing
 */
router.post('/ingest/nfl-data-py', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [BronzeAPI] NFL-Data-Py ingestion triggered by admin from ${req.ip}`);
    
    // Validate input with Zod schema
    const validationResult = NFLDataPyIngestionSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error(`❌ [BronzeAPI] Invalid NFL-Data-Py ingestion request:`, validationResult.error);
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
        errors: validationResult.error.errors,
        duration: Date.now() - startTime
      });
    }

    const {
      season,
      week,
      positions,
      includeAdvanced,
      mockData
    } = validationResult.data;

    const options: NFLDataPyIngestionOptions = {
      season: season || new Date().getFullYear(),
      week: week || parseInt(getCurrentNFLWeek()),
      positions: positions,
      includeAdvanced,
      mockData,
      jobId: `nfl_data_py_api_${Date.now()}`
    };

    console.log(`📊 Processing NFL-Data-Py ingestion (deprecated):`, options);

    const result = await nflDataPyAdapter.ingestFullCycle(options);
    const serviceStatus = nflDataPyAdapter.getServiceStatus();

    const duration = Date.now() - startTime;

    console.log(`⚠️ [BronzeAPI] NFL-Data-Py ingestion completed in ${duration}ms (deprecated)`);

    res.status(200).json({
      success: true,
      message: 'NFL-Data-Py data ingestion completed',
      warning: 'Service is deprecated - data stored as placeholders/mock',
      data: {
        ...result,
        serviceStatus,
        duration,
        options
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [BronzeAPI] NFL-Data-Py ingestion failed:`, error);

    res.status(500).json({
      success: false,
      message: 'NFL-Data-Py data ingestion failed',
      error: errorMessage,
      duration
    });
  }
});

/**
 * POST /api/bronze/ingest/ecr
 * Trigger raw data ingestion from Expert Consensus Rankings
 * Supports multiple formats and league types
 */
router.post('/ingest/ecr', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [BronzeAPI] ECR ingestion triggered by admin from ${req.ip}`);
    
    // Validate input with Zod schema
    const validationResult = ECRIngestionSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error(`❌ [BronzeAPI] Invalid ECR ingestion request:`, validationResult.error);
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
        errors: validationResult.error.errors,
        duration: Date.now() - startTime
      });
    }

    const {
      season,
      week,
      positions,
      formats,
      leagueTypes,
      includeADP,
      mockData
    } = validationResult.data;

    const options: ECRIngestionOptions = {
      season: season || new Date().getFullYear(),
      week: week,
      positions,
      formats,
      leagueTypes,
      includeADP,
      mockData,
      jobId: `ecr_api_${Date.now()}`
    };

    console.log(`📊 Processing ECR ingestion:`, options);

    const result = await ecrAdapter.ingestFullCycle(options);

    const duration = Date.now() - startTime;

    console.log(`✅ [BronzeAPI] ECR ingestion completed in ${duration}ms`);

    res.status(200).json({
      success: true,
      message: 'ECR data ingestion completed successfully',
      data: {
        ...result,
        duration,
        options
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [BronzeAPI] ECR ingestion failed:`, error);

    res.status(500).json({
      success: false,
      message: 'ECR data ingestion failed',
      error: errorMessage,
      duration
    });
  }
});

/**
 * POST /api/bronze/ingest/mysportsfeeds
 * Trigger raw data ingestion from MySportsFeeds API
 * Comprehensive game logs, rosters, and injury data
 */
router.post('/ingest/mysportsfeeds', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [BronzeAPI] MySportsFeeds ingestion triggered by admin from ${req.ip}`);
    
    // Validate input with Zod schema
    const validationResult = MySportsFeedsIngestionSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error(`❌ [BronzeAPI] Invalid MySportsFeeds ingestion request:`, validationResult.error);
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
        errors: validationResult.error.errors,
        duration: Date.now() - startTime
      });
    }

    const {
      season,
      week,
      positions,
      teams,
      includeInjuries,
      includeGameLogs,
      includeRosters,
      mockData,
      apiKey
    } = validationResult.data;

    // Set API key if provided
    if (apiKey) {
      mySportsFeedsAdapter.setApiKey(apiKey);
    }

    const options: MySportsFeedsIngestionOptions = {
      season: season || new Date().getFullYear(),
      week: week || parseInt(getCurrentNFLWeek()),
      positions,
      teams,
      includeInjuries,
      includeGameLogs,
      includeRosters,
      mockData,
      jobId: `msf_api_${Date.now()}`
    };

    console.log(`📊 Processing MySportsFeeds ingestion:`, options);

    const result = await mySportsFeedsAdapter.ingestFullCycle(options);
    const hasApiKey = mySportsFeedsAdapter.hasApiKey();

    const duration = Date.now() - startTime;

    console.log(`✅ [BronzeAPI] MySportsFeeds ingestion completed in ${duration}ms`);

    res.status(200).json({
      success: true,
      message: 'MySportsFeeds data ingestion completed successfully',
      data: {
        ...result,
        hasApiKey,
        duration,
        options
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [BronzeAPI] MySportsFeeds ingestion failed:`, error);

    res.status(500).json({
      success: false,
      message: 'MySportsFeeds data ingestion failed',
      error: errorMessage,
      duration
    });
  }
});

/**
 * POST /api/bronze/ingest/all
 * Trigger comprehensive ingestion from all available sources
 * Orchestrated data collection across all adapters
 */
router.post('/ingest/all', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [BronzeAPI] Full ingestion cycle triggered by admin from ${req.ip}`);
    
    const {
      season,
      week,
      enabledSources = ['sleeper', 'ecr'], // Safe defaults
      mockData = false
    } = req.body;

    const jobId = `full_ingestion_${Date.now()}`;
    const results: Record<string, any> = {};
    const errors: Record<string, any> = {};

    console.log(`📊 Processing full ingestion cycle: ${enabledSources.join(', ')}`);

    // Sleeper ingestion
    if (enabledSources.includes('sleeper')) {
      try {
        results.sleeper = await sleeperAdapter.ingestFullCycle({
          season: season || new Date().getFullYear(),
          week,
          jobId: `${jobId}_sleeper`
        });
        console.log(`✅ Sleeper ingestion completed`);
      } catch (error) {
        errors.sleeper = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Sleeper ingestion failed:`, error);
      }
    }

    // ECR ingestion
    if (enabledSources.includes('ecr')) {
      try {
        results.ecr = await ecrAdapter.ingestFullCycle({
          season: season || new Date().getFullYear(),
          week,
          mockData,
          jobId: `${jobId}_ecr`
        });
        console.log(`✅ ECR ingestion completed`);
      } catch (error) {
        errors.ecr = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ ECR ingestion failed:`, error);
      }
    }

    // NFL-Data-Py ingestion (deprecated)
    if (enabledSources.includes('nfl-data-py')) {
      try {
        results.nflDataPy = await nflDataPyAdapter.ingestFullCycle({
          season: season || new Date().getFullYear(),
          week,
          mockData: true, // Always mock for deprecated service
          jobId: `${jobId}_nfl_data_py`
        });
        console.log(`⚠️ NFL-Data-Py ingestion completed (deprecated)`);
      } catch (error) {
        errors.nflDataPy = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ NFL-Data-Py ingestion failed:`, error);
      }
    }

    // MySportsFeeds ingestion
    if (enabledSources.includes('mysportsfeeds')) {
      try {
        results.mySportsFeeds = await mySportsFeedsAdapter.ingestFullCycle({
          season: season || new Date().getFullYear(),
          week,
          mockData,
          jobId: `${jobId}_msf`
        });
        console.log(`✅ MySportsFeeds ingestion completed`);
      } catch (error) {
        errors.mySportsFeeds = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ MySportsFeeds ingestion failed:`, error);
      }
    }

    const duration = Date.now() - startTime;
    const successCount = Object.keys(results).length;
    const errorCount = Object.keys(errors).length;

    console.log(`🏁 [BronzeAPI] Full ingestion cycle completed in ${duration}ms`);
    console.log(`   ✅ Successful: ${successCount} | ❌ Errors: ${errorCount}`);

    res.status(200).json({
      success: successCount > 0,
      message: `Full ingestion cycle completed: ${successCount} successful, ${errorCount} errors`,
      data: {
        results,
        errors,
        summary: {
          successCount,
          errorCount,
          totalSources: enabledSources.length,
          enabledSources,
          duration
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [BronzeAPI] Full ingestion cycle failed:`, error);

    res.status(500).json({
      success: false,
      message: 'Full ingestion cycle failed',
      error: errorMessage,
      duration
    });
  }
});

// ========================================
// PAYLOAD MANAGEMENT ENDPOINTS
// ========================================

/**
 * GET /api/bronze/payloads
 * Retrieve stored raw payloads with filtering and pagination
 */
router.get('/payloads', async (req: Request, res: Response) => {
  try {
    const {
      source,
      status,
      season,
      week,
      jobId,
      endpoint,
      fromDate,
      toDate,
      limit = 50,
      offset = 0
    } = req.query;

    const filters: PayloadQueryFilters = {
      source: source as typeof dataSourceEnum.enumValues[number],
      status: status as typeof ingestStatusEnum.enumValues[number],
      season: season ? parseInt(season as string) : undefined,
      week: week ? parseInt(week as string) : undefined,
      jobId: jobId as string,
      endpoint: endpoint as string,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    console.log(`📊 [BronzeAPI] Retrieving payloads with filters:`, filters);

    const payloads = await bronzeLayerService.getRawPayloads(filters);

    res.status(200).json({
      success: true,
      data: {
        payloads,
        count: payloads.length,
        filters,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          hasMore: payloads.length === filters.limit
        }
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [BronzeAPI] Error retrieving payloads:`, error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payloads',
      error: errorMessage
    });
  }
});

/**
 * GET /api/bronze/payloads/:id
 * Retrieve specific payload by ID
 */
router.get('/payloads/:id', async (req: Request, res: Response) => {
  try {
    const payloadId = parseInt(req.params.id);

    if (isNaN(payloadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload ID',
        error: 'Payload ID must be a valid number'
      });
    }

    console.log(`📊 [BronzeAPI] Retrieving payload ${payloadId}`);

    const payload = await bronzeLayerService.getRawPayload(payloadId);

    if (!payload) {
      return res.status(404).json({
        success: false,
        message: 'Payload not found',
        error: `No payload found with ID ${payloadId}`
      });
    }

    res.status(200).json({
      success: true,
      data: { payload }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [BronzeAPI] Error retrieving payload:`, error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payload',
      error: errorMessage
    });
  }
});

/**
 * PUT /api/bronze/payloads/:id/status
 * Update payload processing status
 */
router.put('/payloads/:id/status', async (req: Request, res: Response) => {
  try {
    const payloadId = parseInt(req.params.id);
    const { status, errorMessage } = req.body;

    if (isNaN(payloadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload ID',
        error: 'Payload ID must be a valid number'
      });
    }

    if (!status || !ingestStatusEnum.enumValues.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
        error: `Status must be one of: ${ingestStatusEnum.enumValues.join(', ')}`
      });
    }

    console.log(`📝 [BronzeAPI] Updating payload ${payloadId} status to ${status}`);

    await bronzeLayerService.updatePayloadStatus(payloadId, status, errorMessage);

    res.status(200).json({
      success: true,
      message: `Payload ${payloadId} status updated to ${status}`,
      data: {
        payloadId,
        status,
        errorMessage: errorMessage || null
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [BronzeAPI] Error updating payload status:`, error);

    res.status(500).json({
      success: false,
      message: 'Failed to update payload status',
      error: errorMessage
    });
  }
});

// ========================================
// MONITORING AND STATISTICS ENDPOINTS
// ========================================

/**
 * GET /api/bronze/stats
 * Get comprehensive statistics for all data sources
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { source } = req.query;

    console.log(`📈 [BronzeAPI] Retrieving data source statistics`);

    const stats = await bronzeLayerService.getDataSourceStats(
      source as typeof dataSourceEnum.enumValues[number]
    );

    res.status(200).json({
      success: true,
      data: {
        stats,
        generatedAt: new Date().toISOString(),
        source: source || 'all'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [BronzeAPI] Error retrieving stats:`, error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics',
      error: errorMessage
    });
  }
});

/**
 * GET /api/bronze/health
 * Health check endpoint for Bronze Layer system
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const stats = await bronzeLayerService.getDataSourceStats();
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sources: stats.map(stat => ({
        source: stat.source,
        status: stat.failedPayloads > stat.successfulPayloads ? 'warning' : 'healthy',
        totalPayloads: stat.totalPayloads,
        successRate: stat.totalPayloads > 0 
          ? Math.round((stat.successfulPayloads / stat.totalPayloads) * 100) 
          : 0,
        lastIngest: stat.lastIngestDate
      })),
      summary: {
        totalSources: stats.length,
        activeSources: stats.filter(s => s.totalPayloads > 0).length,
        totalPayloads: stats.reduce((sum, s) => sum + s.totalPayloads, 0)
      }
    };

    res.status(200).json({
      success: true,
      data: healthStatus
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [BronzeAPI] Health check failed:`, error);

    res.status(503).json({
      success: false,
      message: 'Bronze Layer health check failed',
      error: errorMessage,
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// DATA MANAGEMENT ENDPOINTS
// ========================================

/**
 * DELETE /api/bronze/payloads/purge
 * Purge old payloads based on cutoff date
 * Data retention management operation
 */
router.delete('/payloads/purge', async (req: Request, res: Response) => {
  try {
    const { source, cutoffDate, dryRun = true } = req.body;

    if (!source || !dataSourceEnum.enumValues.includes(source)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing source',
        error: `Source must be one of: ${dataSourceEnum.enumValues.join(', ')}`
      });
    }

    if (!cutoffDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing cutoff date',
        error: 'cutoffDate is required for purge operation'
      });
    }

    const cutoff = new Date(cutoffDate);
    if (isNaN(cutoff.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cutoff date',
        error: 'cutoffDate must be a valid ISO date string'
      });
    }

    console.log(`🗑️ [BronzeAPI] Purge operation ${dryRun ? '(DRY RUN)' : ''}: ${source} before ${cutoff.toISOString()}`);

    if (dryRun) {
      // For dry run, just count what would be deleted
      const payloads = await bronzeLayerService.getRawPayloads({
        source,
        toDate: cutoff,
        limit: 1000
      });

      res.status(200).json({
        success: true,
        message: 'Dry run completed - no data was deleted',
        data: {
          source,
          cutoffDate: cutoff.toISOString(),
          wouldDelete: payloads.length,
          dryRun: true
        }
      });
    } else {
      const result = await bronzeLayerService.purgeOldPayloads(source, cutoff);

      console.log(`✅ [BronzeAPI] Purged ${result.deletedCount} payloads from ${source}`);

      res.status(200).json({
        success: true,
        message: `Purged ${result.deletedCount} old payloads from ${source}`,
        data: {
          source,
          cutoffDate: cutoff.toISOString(),
          deletedCount: result.deletedCount,
          dryRun: false
        }
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [BronzeAPI] Purge operation failed:`, error);

    res.status(500).json({
      success: false,
      message: 'Purge operation failed',
      error: errorMessage
    });
  }
});

/**
 * PUT /api/bronze/payloads/batch-status
 * Update status for multiple payloads in batch
 */
router.put('/payloads/batch-status', async (req: Request, res: Response) => {
  try {
    const { payloadIds, status } = req.body;

    if (!Array.isArray(payloadIds) || payloadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload IDs',
        error: 'payloadIds must be a non-empty array of numbers'
      });
    }

    if (!status || !ingestStatusEnum.enumValues.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
        error: `Status must be one of: ${ingestStatusEnum.enumValues.join(', ')}`
      });
    }

    console.log(`📝 [BronzeAPI] Batch updating ${payloadIds.length} payloads to status ${status}`);

    await bronzeLayerService.updateBatchPayloadStatus(payloadIds, status);

    res.status(200).json({
      success: true,
      message: `Updated ${payloadIds.length} payloads to status ${status}`,
      data: {
        payloadIds,
        status,
        count: payloadIds.length
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [BronzeAPI] Batch status update failed:`, error);

    res.status(500).json({
      success: false,
      message: 'Batch status update failed',
      error: errorMessage
    });
  }
});

export default router;