/**
 * Gold Layer API Routes - Analytics and Processing Endpoints
 * 
 * Comprehensive API routes for Gold Layer analytics processing and consumption.
 * Provides endpoints for Silver-to-Gold transformation, analytics retrieval,
 * quality reporting, and multi-format fantasy football insights.
 * 
 * Core Endpoints:
 * - Silver-to-Gold processing and orchestration
 * - Weekly, season, market, and composite analytics retrieval
 * - Quality gates validation and confidence scoring
 * - Data lineage tracking and transformation history
 * - Multi-format fantasy analytics (dynasty, redraft, bestball, trade value)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { goldLayerService, GoldLayerService } from '../services/GoldLayerService';
import { qualityGateValidator } from '../services/quality/QualityGateValidator';
import { dataLineageTracker } from '../services/quality/DataLineageTracker';
import { confidenceScorer } from '../services/quality/ConfidenceScorer';

const router = Router();

// ========================================
// VALIDATION SCHEMAS
// ========================================

const ProcessGoldLayerSchema = z.object({
  players: z.array(z.string()).optional(),
  season: z.number().int().min(2020).max(2030).default(2025),
  weeks: z.array(z.number().int().min(1).max(18)).optional(),
  positions: z.array(z.string()).optional(),
  forceRefresh: z.boolean().default(false),
  skipQualityGates: z.boolean().default(false),
  includeMarketFacts: z.boolean().default(true),
  includeCompositeFacts: z.boolean().default(true),
  batchSize: z.number().int().min(1).max(100).default(50)
});

const AnalyticsRequestSchema = z.object({
  type: z.enum(['weekly', 'season', 'market', 'composite', 'all']),
  players: z.array(z.string()),
  season: z.number().int().min(2020).max(2030),
  week: z.number().int().min(1).max(18).optional(),
  format: z.enum(['dynasty', 'redraft', 'bestball', 'trade_value']).optional(),
  qualityThreshold: z.number().min(0).max(1).optional()
});

const QualityReportSchema = z.object({
  season: z.number().int().min(2020).max(2030),
  week: z.number().int().min(1).max(18).optional(),
  players: z.array(z.string()).optional(),
  includeRecommendations: z.boolean().default(true)
});

const LineageQuerySchema = z.object({
  recordId: z.string().optional(),
  tableName: z.string().optional(),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional(),
  includeUpstream: z.boolean().default(true),
  includeDownstream: z.boolean().default(true),
  maxDepth: z.number().int().min(1).max(10).default(5)
});

// ========================================
// SILVER-TO-GOLD PROCESSING ENDPOINTS
// ========================================

/**
 * Process Silver data into Gold analytics facts
 * Main orchestration endpoint for transforming Silver layer data
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    console.log('🔄 [GoldLayerAPI] Processing Silver-to-Gold request');

    const filters = ProcessGoldLayerSchema.parse(req.body);
    const jobId = `api_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log('📊 [GoldLayerAPI] Processing with filters:', filters);

    const result = await goldLayerService.processSilverToGold(filters, {
      batchSize: filters.batchSize
    });

    res.json({
      success: true,
      jobId,
      result,
      message: `Processed ${result.processed} players in ${result.duration}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Processing failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown processing error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Process specific players with custom options
 */
router.post('/process/players', async (req: Request, res: Response) => {
  try {
    const { players, ...options } = ProcessGoldLayerSchema.parse(req.body);

    if (!players || players.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Players array is required and cannot be empty'
      });
    }

    const filters = { players, ...options };
    const jobId = `api_players_${Date.now()}`;

    console.log(`🎯 [GoldLayerAPI] Processing ${players.length} specific players`);

    const result = await goldLayerService.processSilverToGold(filters);

    res.json({
      success: true,
      jobId,
      result,
      playersProcessed: players,
      message: `Successfully processed ${result.success} of ${players.length} players`
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Player processing failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Player processing failed'
    });
  }
});

// ========================================
// ANALYTICS RETRIEVAL ENDPOINTS
// ========================================

/**
 * Get analytics data for specific players and formats
 */
router.post('/analytics', async (req: Request, res: Response) => {
  try {
    console.log('📊 [GoldLayerAPI] Analytics request received');

    const analyticsRequest = AnalyticsRequestSchema.parse(req.body);

    console.log('🎯 [GoldLayerAPI] Analytics request:', analyticsRequest);

    const analytics = await goldLayerService.processAnalyticsRequest(analyticsRequest);

    res.json({
      success: true,
      type: analyticsRequest.type,
      players: analyticsRequest.players,
      season: analyticsRequest.season,
      week: analyticsRequest.week,
      format: analyticsRequest.format,
      analytics,
      count: analytics.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Analytics request failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analytics request failed'
    });
  }
});

/**
 * Get weekly analytics for players
 */
router.get('/analytics/weekly/:season/:week', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.params.season);
    const week = parseInt(req.params.week);
    const players = req.query.players as string[] | string | undefined;
    
    let playerArray: string[] = [];
    if (typeof players === 'string') {
      playerArray = players.split(',');
    } else if (Array.isArray(players)) {
      playerArray = players;
    }

    if (playerArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Players parameter is required (comma-separated list or array)'
      });
    }

    const analytics = await goldLayerService.processAnalyticsRequest({
      type: 'weekly',
      players: playerArray,
      season,
      week
    });

    res.json({
      success: true,
      type: 'weekly',
      season,
      week,
      players: playerArray,
      analytics,
      count: analytics.length
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Weekly analytics failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Weekly analytics failed'
    });
  }
});

/**
 * Get season analytics for players
 */
router.get('/analytics/season/:season', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.params.season);
    const players = req.query.players as string[] | string | undefined;
    const format = req.query.format as string | undefined;
    
    let playerArray: string[] = [];
    if (typeof players === 'string') {
      playerArray = players.split(',');
    } else if (Array.isArray(players)) {
      playerArray = players;
    }

    if (playerArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Players parameter is required'
      });
    }

    const analytics = await goldLayerService.processAnalyticsRequest({
      type: 'season',
      players: playerArray,
      season,
      format: format as any
    });

    res.json({
      success: true,
      type: 'season',
      season,
      format,
      players: playerArray,
      analytics,
      count: analytics.length
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Season analytics failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Season analytics failed'
    });
  }
});

/**
 * Get market analytics for players
 */
router.get('/analytics/market/:season', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.params.season);
    const week = req.query.week ? parseInt(req.query.week as string) : undefined;
    const players = req.query.players as string[] | string | undefined;
    
    let playerArray: string[] = [];
    if (typeof players === 'string') {
      playerArray = players.split(',');
    } else if (Array.isArray(players)) {
      playerArray = players;
    }

    if (playerArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Players parameter is required'
      });
    }

    const analytics = await goldLayerService.processAnalyticsRequest({
      type: 'market',
      players: playerArray,
      season,
      week
    });

    res.json({
      success: true,
      type: 'market',
      season,
      week,
      players: playerArray,
      analytics,
      count: analytics.length
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Market analytics failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Market analytics failed'
    });
  }
});

/**
 * Get composite analytics for players (cross-format profiles)
 */
router.get('/analytics/composite/:season', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.params.season);
    const format = req.query.format as string | undefined;
    const players = req.query.players as string[] | string | undefined;
    
    let playerArray: string[] = [];
    if (typeof players === 'string') {
      playerArray = players.split(',');
    } else if (Array.isArray(players)) {
      playerArray = players;
    }

    if (playerArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Players parameter is required'
      });
    }

    const analytics = await goldLayerService.processAnalyticsRequest({
      type: 'composite',
      players: playerArray,
      season,
      format: format as any
    });

    res.json({
      success: true,
      type: 'composite',
      season,
      format,
      players: playerArray,
      analytics,
      count: analytics.length
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Composite analytics failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Composite analytics failed'
    });
  }
});

/**
 * Get comprehensive analytics (all types) for players
 */
router.get('/analytics/comprehensive/:season', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.params.season);
    const week = req.query.week ? parseInt(req.query.week as string) : undefined;
    const format = req.query.format as string | undefined;
    const players = req.query.players as string[] | string | undefined;
    
    let playerArray: string[] = [];
    if (typeof players === 'string') {
      playerArray = players.split(',');
    } else if (Array.isArray(players)) {
      playerArray = players;
    }

    if (playerArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Players parameter is required'
      });
    }

    console.log(`📊 [GoldLayerAPI] Comprehensive analytics for ${playerArray.length} players`);

    const analytics = await goldLayerService.processAnalyticsRequest({
      type: 'all',
      players: playerArray,
      season,
      week,
      format: format as any
    });

    res.json({
      success: true,
      type: 'comprehensive',
      season,
      week,
      format,
      players: playerArray,
      analytics,
      count: analytics.length,
      message: `Comprehensive analytics for ${playerArray.length} players`
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Comprehensive analytics failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Comprehensive analytics failed'
    });
  }
});

// ========================================
// QUALITY AND LINEAGE ENDPOINTS
// ========================================

/**
 * Generate quality report for Gold Layer data
 */
router.post('/quality/report', async (req: Request, res: Response) => {
  try {
    console.log('📊 [GoldLayerAPI] Quality report request');

    const { season, week, players, includeRecommendations } = QualityReportSchema.parse(req.body);

    const qualityReport = await goldLayerService.generateQualityReport(season, week, players);

    res.json({
      success: true,
      season,
      week,
      players,
      qualityReport,
      includeRecommendations,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Quality report failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Quality report failed'
    });
  }
});

/**
 * Get quality statistics for a time period
 */
router.get('/quality/statistics/:tableName', async (req: Request, res: Response) => {
  try {
    const tableName = req.params.tableName;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date query parameters are required (ISO format)'
      });
    }

    const timeRange = {
      start: new Date(startDate),
      end: new Date(endDate)
    };

    const statistics = await qualityGateValidator.getQualityStatistics(
      tableName,
      timeRange
    );

    res.json({
      success: true,
      tableName,
      timeRange,
      statistics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Quality statistics failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Quality statistics failed'
    });
  }
});

/**
 * Get data lineage information
 */
router.post('/lineage/query', async (req: Request, res: Response) => {
  try {
    console.log('🔍 [GoldLayerAPI] Data lineage query');

    const parsedQuery = LineageQuerySchema.parse(req.body);
    
    // Convert datetime strings to Date objects for service interface
    const query = {
      ...parsedQuery,
      timeRange: parsedQuery.timeRange ? {
        start: new Date(parsedQuery.timeRange.start),
        end: new Date(parsedQuery.timeRange.end)
      } : undefined
    };

    const lineageGraph = await dataLineageTracker.getLineageGraph(query);

    res.json({
      success: true,
      query,
      lineageGraph,
      nodesCount: lineageGraph.nodes.length,
      edgesCount: lineageGraph.edges.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Lineage query failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Lineage query failed'
    });
  }
});

/**
 * Get record lineage for specific player/record
 */
router.get('/lineage/record/:tableName/:recordId', async (req: Request, res: Response) => {
  try {
    const { tableName, recordId } = req.params;
    const includeUpstream = req.query.upstream === 'true';
    const includeDownstream = req.query.downstream === 'true';

    console.log(`🔍 [GoldLayerAPI] Record lineage: ${tableName}:${recordId}`);

    const lineage = await dataLineageTracker.getRecordLineage(
      tableName,
      recordId,
      { includeUpstream, includeDownstream }
    );

    res.json({
      success: true,
      tableName,
      recordId,
      includeUpstream,
      includeDownstream,
      lineage,
      count: lineage.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Record lineage failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Record lineage failed'
    });
  }
});

/**
 * Analyze impact of data changes
 */
router.post('/lineage/impact', async (req: Request, res: Response) => {
  try {
    const { sourceTable, sourceRecordId, timeRange } = req.body;

    if (!sourceTable) {
      return res.status(400).json({
        success: false,
        error: 'sourceTable is required'
      });
    }

    console.log(`🔍 [GoldLayerAPI] Impact analysis: ${sourceTable}${sourceRecordId ? `:${sourceRecordId}` : ''}`);

    const impactAnalysis = await dataLineageTracker.analyzeImpact(
      sourceTable,
      sourceRecordId,
      timeRange ? {
        start: new Date(timeRange.start),
        end: new Date(timeRange.end)
      } : undefined
    );

    res.json({
      success: true,
      sourceTable,
      sourceRecordId,
      timeRange,
      impactAnalysis,
      affectedRecords: impactAnalysis.affectedRecords.length,
      downstreamTables: impactAnalysis.downstreamTables.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Impact analysis failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Impact analysis failed'
    });
  }
});

/**
 * Calculate confidence score for data
 */
router.post('/confidence/calculate', async (req: Request, res: Response) => {
  try {
    const { tableName, recordData, context } = req.body;

    if (!tableName || !recordData) {
      return res.status(400).json({
        success: false,
        error: 'tableName and recordData are required'
      });
    }

    console.log(`🎯 [GoldLayerAPI] Confidence calculation for ${tableName}`);

    const confidenceScore = await confidenceScorer.calculateConfidenceScore({
      tableName,
      recordData,
      context
    });

    res.json({
      success: true,
      tableName,
      confidenceScore,
      overallScore: confidenceScore.overallScore,
      riskLevel: confidenceScore.riskLevel,
      dataQualityGrade: confidenceScore.dataQualityGrade,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [GoldLayerAPI] Confidence calculation failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Confidence calculation failed'
    });
  }
});

// ========================================
// UTILITY AND STATUS ENDPOINTS
// ========================================

/**
 * Get Gold Layer service status and health
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Basic health check
    const status = {
      service: 'Gold Layer',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      capabilities: {
        silverToGoldProcessing: true,
        weeklyAnalytics: true,
        seasonAnalytics: true,
        marketAnalytics: true,
        compositeAnalytics: true,
        qualityGates: true,
        dataLineage: true,
        confidenceScoring: true
      },
      endpoints: {
        processing: ['/process', '/process/players'],
        analytics: ['/analytics', '/analytics/weekly/:season/:week', '/analytics/season/:season', '/analytics/market/:season', '/analytics/composite/:season', '/analytics/comprehensive/:season'],
        quality: ['/quality/report', '/quality/statistics/:tableName'],
        lineage: ['/lineage/query', '/lineage/record/:tableName/:recordId', '/lineage/impact'],
        confidence: ['/confidence/calculate'],
        utility: ['/status']
      }
    };

    res.json(status);

  } catch (error) {
    res.status(500).json({
      service: 'Gold Layer',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Status check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get API documentation/help
 */
router.get('/help', (req: Request, res: Response) => {
  const documentation = {
    service: 'Gold Layer API',
    version: '1.0.0',
    description: 'Analytics processing and retrieval API for Gold Layer facts',
    endpoints: {
      processing: {
        'POST /process': {
          description: 'Process Silver data into Gold analytics facts',
          body: 'ProcessGoldLayerSchema - processing filters and options',
          example: {
            season: 2025,
            weeks: [1, 2, 3],
            forceRefresh: false,
            includeMarketFacts: true
          }
        },
        'POST /process/players': {
          description: 'Process specific players with custom options',
          body: 'ProcessGoldLayerSchema with required players array'
        }
      },
      analytics: {
        'POST /analytics': {
          description: 'Get analytics for specific players and formats',
          body: 'AnalyticsRequestSchema - analytics request parameters'
        },
        'GET /analytics/weekly/:season/:week': {
          description: 'Get weekly analytics',
          params: 'season, week',
          query: 'players (comma-separated)'
        },
        'GET /analytics/season/:season': {
          description: 'Get season analytics',
          params: 'season',
          query: 'players, format'
        },
        'GET /analytics/market/:season': {
          description: 'Get market analytics',
          params: 'season',
          query: 'players, week'
        },
        'GET /analytics/composite/:season': {
          description: 'Get composite analytics (cross-format profiles)',
          params: 'season',
          query: 'players, format'
        },
        'GET /analytics/comprehensive/:season': {
          description: 'Get comprehensive analytics (all types)',
          params: 'season',
          query: 'players, week, format'
        }
      },
      quality: {
        'POST /quality/report': {
          description: 'Generate quality report for Gold Layer data',
          body: 'QualityReportSchema - report parameters'
        },
        'GET /quality/statistics/:tableName': {
          description: 'Get quality statistics for time period',
          params: 'tableName',
          query: 'start_date, end_date (ISO format)'
        }
      },
      lineage: {
        'POST /lineage/query': {
          description: 'Query data lineage information',
          body: 'LineageQuerySchema - lineage query parameters'
        },
        'GET /lineage/record/:tableName/:recordId': {
          description: 'Get record lineage for specific record',
          params: 'tableName, recordId',
          query: 'upstream, downstream (boolean)'
        },
        'POST /lineage/impact': {
          description: 'Analyze impact of data changes',
          body: 'sourceTable, sourceRecordId, timeRange'
        }
      },
      confidence: {
        'POST /confidence/calculate': {
          description: 'Calculate confidence score for data',
          body: 'tableName, recordData, context'
        }
      }
    },
    schemas: {
      ProcessGoldLayerSchema: 'Processing filters and options for Silver-to-Gold transformation',
      AnalyticsRequestSchema: 'Analytics request parameters for data retrieval',
      QualityReportSchema: 'Quality report generation parameters',
      LineageQuerySchema: 'Data lineage query parameters'
    }
  };

  res.json(documentation);
});

export default router;