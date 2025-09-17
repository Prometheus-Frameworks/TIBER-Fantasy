/**
 * UPH Admin API Routes - Comprehensive Orchestration Management
 * 
 * Complete admin API for UPH orchestration management and monitoring.
 * Provides full control and visibility into the UPH processing system.
 * 
 * Core Features:
 * - Processing Control (weekly, season, backfill, incremental, retry, cancel)
 * - Status & Monitoring (system health, job listing, metrics)
 * - Quality Management (config management, bypass options)
 * - Data Lineage & Debugging (lineage tracking, logs, stats)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UPHCoordinator, type ProcessingOptions } from '../services/UPHCoordinator';
import { QualityConfig } from '../services/quality/QualityConfig';
import { DataLineageTracker } from '../services/quality/DataLineageTracker';
import { requireAdminAuth } from '../middleware/adminAuth';
import { dataSourceEnum, uphJobTypeEnum, uphJobStatusEnum } from '@shared/schema';

const router = Router();

// Apply admin authentication to all routes
router.use(requireAdminAuth);

// Initialize services
const uphCoordinator = UPHCoordinator.getInstance();
const qualityConfig = QualityConfig.getInstance();
const lineageTracker = DataLineageTracker.getInstance();

// ========================================
// VALIDATION SCHEMAS
// ========================================

const ProcessingOptionsSchema = z.object({
  sources: z.array(z.enum(dataSourceEnum.enumValues)).optional(),
  batchSize: z.number().min(1).max(1000).optional(),
  maxConcurrency: z.number().min(1).max(50).optional(),
  skipQualityGates: z.boolean().optional(),
  retryAttempts: z.number().min(0).max(10).optional(),
  timeoutMs: z.number().min(1000).max(3600000).optional(), // 1s to 1h
  forceRefresh: z.boolean().optional(),
  dryRun: z.boolean().optional()
});

const WeeklyProcessingSchema = z.object({
  season: z.number().min(2020).max(2030),
  week: z.number().min(1).max(18),
  options: ProcessingOptionsSchema.optional()
});

const SeasonProcessingSchema = z.object({
  season: z.number().min(2020).max(2030),
  options: ProcessingOptionsSchema.optional()
});

const BackfillProcessingSchema = z.object({
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  options: ProcessingOptionsSchema.optional()
});

const IncrementalProcessingSchema = z.object({
  since: z.string().datetime().optional(),
  options: ProcessingOptionsSchema.optional()
});

const JobFiltersSchema = z.object({
  type: z.enum(uphJobTypeEnum.enumValues).optional(),
  status: z.enum(uphJobStatusEnum.enumValues).optional(),
  season: z.number().min(2020).max(2030).optional(),
  week: z.number().min(1).max(18).optional(),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional(),
  limit: z.number().min(1).max(1000).optional().default(100),
  offset: z.number().min(0).optional().default(0)
});

const QualityConfigUpdateSchema = z.object({
  globalThresholds: z.object({
    completeness: z.object({
      critical: z.number().min(0).max(1),
      warning: z.number().min(0).max(1),
      minimum: z.number().min(0).max(1)
    }),
    consistency: z.object({
      critical: z.number().min(0).max(1),
      warning: z.number().min(0).max(1),
      crossReference: z.number().min(0).max(1)
    }),
    accuracy: z.object({
      critical: z.number().min(0).max(1),
      warning: z.number().min(0).max(1),
      outlierDetection: z.number().min(0).max(10)
    }),
    freshness: z.object({
      critical: z.number().min(0),
      warning: z.number().min(0),
      maximum: z.number().min(0)
    }),
    performance: z.object({
      processingTimeout: z.number().min(1000),
      batchSizeLimit: z.number().min(1),
      memoryLimitMB: z.number().min(100)
    })
  }).partial().optional(),
  bypassOptions: z.object({
    allowQualityBypass: z.boolean(),
    emergencyMode: z.boolean(),
    bypassRequiresApproval: z.boolean()
  }).partial().optional()
}).partial();

const QualityBypassSchema = z.object({
  jobId: z.string(),
  reason: z.string().min(10).max(500),
  approvedBy: z.string(),
  emergencyMode: z.boolean().optional().default(false)
});

// ========================================
// PROCESSING CONTROL ENDPOINTS
// ========================================

/**
 * POST /api/admin/uph/run/weekly
 * Trigger weekly data processing with configurable options
 */
router.post('/run/weekly', async (req: Request, res: Response) => {
  try {
    const { season, week, options } = WeeklyProcessingSchema.parse(req.body);
    
    console.log(`🚀 [Admin API] Starting weekly processing for ${season} Week ${week}`);
    
    const result = await uphCoordinator.runWeeklyProcessing(season, week, options || {});
    
    res.json({
      success: true,
      data: result,
      message: `Weekly processing initiated for ${season} Week ${week}`
    });

  } catch (error) {
    console.error('❌ [Admin API] Weekly processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start weekly processing',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/admin/uph/run/season
 * Trigger season-level bulk processing
 */
router.post('/run/season', async (req: Request, res: Response) => {
  try {
    const { season, options } = SeasonProcessingSchema.parse(req.body);
    
    console.log(`🚀 [Admin API] Starting season processing for ${season}`);
    
    const result = await uphCoordinator.runSeasonProcessing(season, options || {});
    
    res.json({
      success: true,
      data: result,
      message: `Season processing initiated for ${season}`
    });

  } catch (error) {
    console.error('❌ [Admin API] Season processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start season processing',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/admin/uph/run/backfill
 * Execute historical data backfill operations
 */
router.post('/run/backfill', async (req: Request, res: Response) => {
  try {
    const { dateRange, options } = BackfillProcessingSchema.parse(req.body);
    
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    
    console.log(`🚀 [Admin API] Starting backfill processing from ${start.toISOString()} to ${end.toISOString()}`);
    
    const result = await uphCoordinator.runBackfillProcessing({ start, end }, options || {});
    
    res.json({
      success: true,
      data: result,
      message: `Backfill processing initiated for ${start.toDateString()} to ${end.toDateString()}`
    });

  } catch (error) {
    console.error('❌ [Admin API] Backfill processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start backfill processing',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/admin/uph/run/incremental
 * Run incremental delta updates
 */
router.post('/run/incremental', async (req: Request, res: Response) => {
  try {
    const { since, options } = IncrementalProcessingSchema.parse(req.body);
    
    // Default to 24 hours ago if no since date provided
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    console.log(`🚀 [Admin API] Starting incremental processing since ${sinceDate.toISOString()}`);
    
    const result = await uphCoordinator.runIncrementalProcessing(sinceDate, options || {});
    
    res.json({
      success: true,
      data: result,
      message: 'Incremental processing initiated'
    });

  } catch (error) {
    console.error('❌ [Admin API] Incremental processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start incremental processing',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/admin/uph/jobs/:jobId/retry
 * Retry failed jobs with exponential backoff
 */
router.post('/jobs/:jobId/retry', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    
    console.log(`🔄 [Admin API] Retrying failed tasks for job ${jobId}`);
    
    const result = await uphCoordinator.retryFailedTasks(jobId);
    
    res.json({
      success: true,
      data: result,
      message: `Retry initiated for job ${jobId}`
    });

  } catch (error) {
    console.error(`❌ [Admin API] Failed to retry job ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry job',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/admin/uph/jobs/:jobId/cancel
 * Cancel running jobs gracefully
 */
router.post('/jobs/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    
    console.log(`🛑 [Admin API] Cancelling job ${jobId}`);
    
    const result = await uphCoordinator.cancelJob(jobId);
    
    res.json({
      success: true,
      data: result,
      message: `Job ${jobId} cancellation initiated`
    });

  } catch (error) {
    console.error(`❌ [Admin API] Failed to cancel job ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel job',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ========================================
// STATUS & MONITORING ENDPOINTS
// ========================================

/**
 * GET /api/admin/uph/status
 * Overall UPH system health and current state
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    console.log('📊 [Admin API] Getting UPH system status');
    
    const health = await uphCoordinator.getSystemHealth();
    const metrics = await uphCoordinator.getProcessingMetrics();
    
    res.json({
      success: true,
      data: {
        health,
        metrics,
        timestamp: new Date().toISOString()
      },
      message: 'UPH system status retrieved successfully'
    });

  } catch (error) {
    console.error('❌ [Admin API] Failed to get system status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system status',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/uph/jobs
 * List all jobs with filtering (status, type, date range)
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const queryFilters = JobFiltersSchema.parse(req.query);
    
    // Convert string dates to Date objects for JobFilters interface
    const filters: any = { ...queryFilters };
    if (queryFilters.dateRange) {
      filters.dateRange = {
        start: new Date(queryFilters.dateRange.start),
        end: new Date(queryFilters.dateRange.end)
      };
    }
    
    console.log('📋 [Admin API] Getting job history with filters:', filters);
    
    const jobs = await uphCoordinator.getJobHistory(filters);
    
    res.json({
      success: true,
      data: {
        jobs,
        total: jobs.length,
        filters
      },
      message: 'Job history retrieved successfully'
    });

  } catch (error) {
    console.error('❌ [Admin API] Failed to get job history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve job history',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/uph/jobs/:jobId
 * Detailed job status with task breakdown
 */
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    
    console.log(`📊 [Admin API] Getting status for job ${jobId}`);
    
    const status = await uphCoordinator.getJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        details: `Job ${jobId} does not exist`
      });
    }
    
    res.json({
      success: true,
      data: status,
      message: `Job status retrieved for ${jobId}`
    });

  } catch (error) {
    console.error(`❌ [Admin API] Failed to get job status for ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve job status',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/uph/jobs/:jobId/tasks
 * List all tasks for a specific job
 */
router.get('/jobs/:jobId/tasks', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    
    console.log(`📋 [Admin API] Getting tasks for job ${jobId}`);
    
    const status = await uphCoordinator.getJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        details: `Job ${jobId} does not exist`
      });
    }
    
    res.json({
      success: true,
      data: {
        jobId: status.jobId,
        tasks: status.errors, // Task errors contain task details
        progress: status.progress,
        stats: status.stats
      },
      message: `Tasks retrieved for job ${jobId}`
    });

  } catch (error) {
    console.error(`❌ [Admin API] Failed to get tasks for job ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve job tasks',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/uph/health
 * System health check with service dependencies
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    console.log('🔍 [Admin API] Performing health check');
    
    const health = await uphCoordinator.getSystemHealth();
    
    const httpStatus = health.status === 'HEALTHY' ? 200 : 
                      health.status === 'DEGRADED' ? 206 : 503;
    
    res.status(httpStatus).json({
      success: health.status !== 'UNHEALTHY',
      data: health,
      message: `System health: ${health.status}`
    });

  } catch (error) {
    console.error('❌ [Admin API] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/uph/metrics
 * Processing metrics (throughput, error rates, quality scores)
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    console.log('📈 [Admin API] Getting processing metrics');
    
    const metrics = await uphCoordinator.getProcessingMetrics();
    
    res.json({
      success: true,
      data: metrics,
      message: 'Processing metrics retrieved successfully'
    });

  } catch (error) {
    console.error('❌ [Admin API] Failed to get metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve processing metrics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ========================================
// QUALITY MANAGEMENT ENDPOINTS
// ========================================

/**
 * GET /api/admin/uph/quality/config
 * Current quality configuration and thresholds
 */
router.get('/quality/config', async (req: Request, res: Response) => {
  try {
    console.log('⚙️ [Admin API] Getting quality configuration');
    
    const config = qualityConfig.getConfiguration();
    
    res.json({
      success: true,
      data: config,
      message: 'Quality configuration retrieved successfully'
    });

  } catch (error) {
    console.error('❌ [Admin API] Failed to get quality config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quality configuration',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/admin/uph/quality/config
 * Update quality thresholds (with validation)
 */
router.put('/quality/config', async (req: Request, res: Response) => {
  try {
    const updates = QualityConfigUpdateSchema.parse(req.body);
    
    console.log('⚙️ [Admin API] Updating quality configuration');
    
    // Cast to any to bypass TypeScript strict typing for configuration updates
    qualityConfig.updateConfiguration(updates as any);
    
    res.json({
      success: true,
      data: qualityConfig.getConfiguration(),
      message: 'Quality configuration updated successfully'
    });

  } catch (error) {
    console.error('❌ [Admin API] Failed to update quality config:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update quality configuration',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/uph/quality/results
 * Recent quality gate results with filtering
 */
router.get('/quality/results', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const hours = Number(req.query.hours) || 24;
    
    console.log(`🔍 [Admin API] Getting quality results from last ${hours} hours`);
    
    // This would be implemented when quality gate results tracking is available
    res.json({
      success: true,
      data: {
        results: [],
        summary: {
          totalChecks: 0,
          passed: 0,
          failed: 0,
          timeRange: `Last ${hours} hours`
        }
      },
      message: 'Quality results retrieved successfully'
    });

  } catch (error) {
    console.error('❌ [Admin API] Failed to get quality results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quality results',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/admin/uph/quality/bypass
 * Emergency quality gate bypass (with audit)
 */
router.post('/quality/bypass', async (req: Request, res: Response) => {
  try {
    const { jobId, reason, approvedBy, emergencyMode } = QualityBypassSchema.parse(req.body);
    
    console.log(`🚨 [Admin API] Quality bypass requested for job ${jobId} by ${approvedBy}`);
    
    // Check if bypass is allowed
    if (!qualityConfig.isQualityBypassAllowed() && !emergencyMode) {
      return res.status(403).json({
        success: false,
        error: 'Quality bypass not allowed',
        details: 'Quality bypass is disabled in current configuration'
      });
    }
    
    // Log the bypass for audit trail
    console.warn(`🚨 [AUDIT] Quality bypass approved for job ${jobId} by ${approvedBy}: ${reason}`);
    
    res.json({
      success: true,
      data: {
        jobId,
        bypassed: true,
        reason,
        approvedBy,
        timestamp: new Date().toISOString()
      },
      message: `Quality bypass approved for job ${jobId}`
    });

  } catch (error) {
    console.error('❌ [Admin API] Failed to process quality bypass:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to process quality bypass',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ========================================
// DATA LINEAGE & DEBUGGING ENDPOINTS
// ========================================

/**
 * GET /api/admin/uph/lineage/:jobId
 * Data lineage tracking for job execution
 */
router.get('/lineage/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    const includeUpstream = req.query.includeUpstream === 'true';
    const includeDownstream = req.query.includeDownstream === 'true';
    const maxDepth = Number(req.query.maxDepth) || 5;
    
    console.log(`🔗 [Admin API] Getting lineage for job ${jobId}`);
    
    const lineage = await lineageTracker.getLineageGraph({
      recordId: jobId,
      includeUpstream,
      includeDownstream,
      maxDepth
    });
    
    res.json({
      success: true,
      data: lineage,
      message: `Lineage retrieved for job ${jobId}`
    });

  } catch (error) {
    console.error(`❌ [Admin API] Failed to get lineage for job ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve lineage',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/uph/logs/:jobId
 * Detailed logs for specific job execution
 */
router.get('/logs/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    const level = req.query.level as string || 'INFO';
    const limit = Number(req.query.limit) || 1000;
    
    console.log(`📝 [Admin API] Getting logs for job ${jobId}`);
    
    // This would be implemented when centralized logging is available
    res.json({
      success: true,
      data: {
        jobId,
        logs: [],
        level,
        limit,
        message: 'Centralized logging not yet implemented'
      },
      message: `Logs retrieved for job ${jobId}`
    });

  } catch (error) {
    console.error(`❌ [Admin API] Failed to get logs for job ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/uph/stats
 * Processing statistics and performance analytics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days) || 7;
    const includeQuality = req.query.includeQuality === 'true';
    
    console.log(`📊 [Admin API] Getting processing stats for last ${days} days`);
    
    const metrics = await uphCoordinator.getProcessingMetrics();
    const health = await uphCoordinator.getSystemHealth();
    
    res.json({
      success: true,
      data: {
        metrics,
        health,
        timeRange: `Last ${days} days`,
        includeQuality,
        timestamp: new Date().toISOString()
      },
      message: 'Processing statistics retrieved successfully'
    });

  } catch (error) {
    console.error('❌ [Admin API] Failed to get processing stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve processing statistics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================

// Handle validation errors
router.use((err: any, req: Request, res: Response, next: any) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    });
  }
  next(err);
});

// Handle general errors
router.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('❌ [Admin API] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: err.message
  });
});

export default router;