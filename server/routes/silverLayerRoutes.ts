/**
 * Silver Layer Routes - API endpoints for normalized data processing
 * 
 * Provides admin endpoints for transforming Bronze data into clean, standardized
 * canonical tables with cross-platform data integration and quality validation.
 */

import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth';
import { silverLayerService } from '../services/SilverLayerService';
import { bronzeLayerService } from '../services/BronzeLayerService';

const router = Router();

// Apply admin authentication to all Silver Layer routes
router.use(requireAdminAuth);

/**
 * POST /api/silver/process-payloads
 * Process specific Bronze payloads into normalized Silver tables
 */
router.post('/process-payloads', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [SilverLayer] Manual processing triggered by admin from ${req.ip}`);
    
    const { payloadIds, force = false, validateOnly = false } = req.body;
    
    // Validate input
    if (!payloadIds || !Array.isArray(payloadIds) || payloadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload IDs',
        error: 'payloadIds must be a non-empty array of numbers'
      });
    }

    // Validate payload IDs are numbers
    const invalidIds = payloadIds.filter(id => typeof id !== 'number' || id <= 0);
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload IDs',
        error: `Invalid IDs: ${invalidIds.join(', ')}`
      });
    }

    console.log(`📊 Processing ${payloadIds.length} Bronze payloads (force: ${force}, validateOnly: ${validateOnly})`);
    
    // Process the payloads
    const result = await silverLayerService.processBronzeToSilver(payloadIds, { force, validateOnly });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [SilverLayer] Processing completed in ${duration}ms`);
    console.log(`   📊 Success: ${result.success} | Errors: ${result.errors} | Skipped: ${result.skipped}`);
    console.log(`   📈 Table Results:`, result.tableResults);

    res.status(200).json({
      success: true,
      message: 'Silver Layer processing completed',
      data: {
        ...result,
        processingDuration: duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [SilverLayer] Processing failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Silver Layer processing failed',
      error: errorMessage,
      duration: duration
    });
  }
});

/**
 * POST /api/silver/process-by-filters
 * Process Bronze payloads by filter criteria (source, timeframe, etc.)
 */
router.post('/process-by-filters', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 [SilverLayer] Filter-based processing triggered by admin from ${req.ip}`);
    
    const { 
      sources, 
      endpoints, 
      season, 
      week, 
      maxAge,
      onlyPending = true,
      force = false,
      validateOnly = false
    } = req.body;
    
    console.log(`📊 Processing with filters:`, {
      sources, endpoints, season, week, maxAge, onlyPending, force, validateOnly
    });
    
    // Build filters
    const filters: any = {};
    if (sources) filters.sources = sources;
    if (endpoints) filters.endpoints = endpoints;
    if (season) filters.season = season;
    if (week !== undefined) filters.week = week;
    if (maxAge) filters.maxAge = maxAge;
    if (onlyPending) filters.onlyPending = onlyPending;
    
    // Process by filters
    const result = await silverLayerService.processBronzeByFilters(filters);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [SilverLayer] Filter processing completed in ${duration}ms`);
    console.log(`   📊 Success: ${result.success} | Errors: ${result.errors} | Skipped: ${result.skipped}`);

    res.status(200).json({
      success: true,
      message: 'Filter-based Silver Layer processing completed',
      data: {
        ...result,
        processingDuration: duration,
        filters
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [SilverLayer] Filter processing failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Filter-based Silver Layer processing failed',
      error: errorMessage,
      duration: duration,
      filters: req.body
    });
  }
});

/**
 * GET /api/silver/data-quality-report
 * Generate comprehensive data quality report for Silver Layer tables
 */
router.get('/data-quality-report', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`📊 [SilverLayer] Data quality report requested by admin from ${req.ip}`);
    
    const report = await silverLayerService.generateDataQualityReport();
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [SilverLayer] Data quality report generated in ${duration}ms`);
    console.log(`   📊 Total Records: ${report.totalRecords}`);
    console.log(`   📈 Quality Distribution:`, report.qualityDistribution);

    res.status(200).json({
      success: true,
      message: 'Data quality report generated successfully',
      data: {
        report,
        generatedAt: new Date(),
        duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [SilverLayer] Data quality report failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Data quality report failed',
      error: errorMessage,
      duration: duration
    });
  }
});

/**
 * GET /api/silver/bronze-payloads
 * List Bronze payloads available for Silver processing
 */
router.get('/bronze-payloads', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`📋 [SilverLayer] Bronze payloads list requested by admin from ${req.ip}`);
    
    const { 
      source, 
      status = 'PENDING', 
      season, 
      week, 
      limit = 50, 
      offset = 0 
    } = req.query;
    
    // Build query filters
    const filters: any = {};
    if (source) filters.source = source;
    if (status) filters.status = status;
    if (season) filters.season = parseInt(season as string);
    if (week !== undefined) filters.week = parseInt(week as string);
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);
    
    const payloads = await bronzeLayerService.getRawPayloads(filters);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [SilverLayer] Found ${payloads.length} Bronze payloads in ${duration}ms`);

    res.status(200).json({
      success: true,
      message: 'Bronze payloads retrieved successfully',
      data: {
        payloads: payloads.map(p => ({
          id: p.id,
          source: p.source,
          endpoint: p.endpoint,
          season: p.season,
          week: p.week,
          status: p.status,
          recordCount: p.recordCount,
          ingestedAt: p.ingestedAt,
          processedAt: p.processedAt
        })),
        count: payloads.length,
        filters,
        duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [SilverLayer] Bronze payloads list failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Bronze payloads list failed',
      error: errorMessage,
      duration: duration
    });
  }
});

/**
 * POST /api/silver/process-latest
 * Process the latest Bronze payloads from each source
 */
router.post('/process-latest', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🕒 [SilverLayer] Latest payloads processing triggered by admin from ${req.ip}`);
    
    const { 
      sources = ['sleeper', 'nfl_data_py', 'fantasypros'], 
      maxAge = 24, // hours
      force = false 
    } = req.body;
    
    console.log(`📊 Processing latest payloads from sources: ${sources.join(', ')} (maxAge: ${maxAge}h)`);
    
    // Get latest payloads from each source
    const filters = {
      sources,
      maxAge,
      onlyPending: !force
    };
    
    const result = await silverLayerService.processBronzeByFilters(filters);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [SilverLayer] Latest payloads processing completed in ${duration}ms`);

    res.status(200).json({
      success: true,
      message: 'Latest payloads processing completed',
      data: {
        ...result,
        processingDuration: duration,
        sources,
        maxAge
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [SilverLayer] Latest payloads processing failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Latest payloads processing failed',
      error: errorMessage,
      duration: duration
    });
  }
});

/**
 * GET /api/silver/stats
 * Get Silver Layer processing statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`📈 [SilverLayer] Statistics requested by admin from ${req.ip}`);
    
    // Get Bronze Layer stats for context
    const bronzeStats = await bronzeLayerService.getDataSourceStats();
    
    // Get data quality report
    const qualityReport = await silverLayerService.generateDataQualityReport();
    
    const duration = Date.now() - startTime;
    
    const stats = {
      bronzeLayer: {
        totalSources: bronzeStats.length,
        totalPayloads: bronzeStats.reduce((sum, s) => sum + s.totalPayloads, 0),
        pendingPayloads: bronzeStats.reduce((sum, s) => sum + s.pendingPayloads, 0),
        sources: bronzeStats
      },
      silverLayer: {
        totalPlayers: qualityReport.totalRecords,
        dataQuality: qualityReport.qualityDistribution,
        missingIdentities: qualityReport.missingIdentities,
        crossPlatformConflicts: qualityReport.crossPlatformConflicts
      },
      generatedAt: new Date(),
      duration
    };
    
    console.log(`✅ [SilverLayer] Statistics generated in ${duration}ms`);

    res.status(200).json({
      success: true,
      message: 'Silver Layer statistics generated',
      data: stats
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [SilverLayer] Statistics failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Silver Layer statistics failed',
      error: errorMessage,
      duration: duration
    });
  }
});

/**
 * POST /api/silver/validate-data
 * Validate Silver Layer data integrity and quality
 */
router.post('/validate-data', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 [SilverLayer] Data validation triggered by admin from ${req.ip}`);
    
    const { tables = ['all'], deep = false } = req.body;
    
    // For now, just return the data quality report
    // In a full implementation, this would check referential integrity,
    // validate cross-platform data consistency, etc.
    const qualityReport = await silverLayerService.generateDataQualityReport();
    
    const duration = Date.now() - startTime;
    
    const validation = {
      status: 'completed',
      tables: tables,
      deep: deep,
      results: {
        dataQuality: qualityReport,
        referentialIntegrity: {
          status: 'not_implemented',
          message: 'Full referential integrity checks not yet implemented'
        },
        crossPlatformConsistency: {
          status: 'partial',
          missingIdentities: qualityReport.missingIdentities,
          conflicts: qualityReport.crossPlatformConflicts
        }
      },
      duration
    };
    
    console.log(`✅ [SilverLayer] Data validation completed in ${duration}ms`);

    res.status(200).json({
      success: true,
      message: 'Silver Layer data validation completed',
      data: validation
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ [SilverLayer] Data validation failed:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Silver Layer data validation failed',
      error: errorMessage,
      duration: duration
    });
  }
});

export default router;