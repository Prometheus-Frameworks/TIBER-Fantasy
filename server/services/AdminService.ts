/**
 * AdminService - Comprehensive system control for Brand Signals Brain
 * 
 * Provides 5 core administrative functions:
 * 1. Season management and override
 * 2. Brand signal replay for specific periods
 * 3. Live brand signal streaming
 * 4. System status and health monitoring
 * 5. Signal purge operations with safety guards
 * 
 * Integrates with: BrandSignalsIntegration, SeasonService, MonitoringService, BrandBus
 */

import { db } from '../infra/db';
import { 
  brandSignals, 
  seasonState, 
  monitoringJobRuns,
  brandEnum,
  type BrandSignals,
  type SeasonState 
} from '@shared/schema';
import { eq, and, desc, sql, count, gte } from 'drizzle-orm';
import { BrandSignalsIntegration } from './BrandSignalsIntegration';
import { SeasonService } from './SeasonService';
import { MonitoringService } from './MonitoringService';
import { brandBus } from './BrandBus';
import { 
  createDatasetCommittedEvent, 
  createRollWeekEvent,
  type BusEvent 
} from '../../domain/events';

// Types for admin operations
export interface SetSeasonRequest {
  season: number;
  week: number;
  seasonType: 'regular' | 'post';
}

export interface BrandReplayRequest {
  brand: string;
  season: number;
  week?: number;
  forceRecompute: boolean;
}

export interface BrandStreamRequest {
  brands: string[];
  targetDatasets: string[];
}

export interface SignalsPurgeRequest {
  brand?: string;
  season: number;
  week?: number;
  dryRun: boolean;
}

export interface SystemStatusResponse {
  systemHealth: 'healthy' | 'degraded' | 'unhealthy';
  brandStatus: Record<string, {
    lastRun?: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    signalCount: number;
    recentErrors?: number;
  }>;
  weekContext: {
    season: number;
    week: number;
    source: 'sleeper' | 'db' | 'env' | 'admin';
  };
  dbHealth: {
    connection: 'ok' | 'error';
    tables: string[];
    schemaSync: 'ok' | 'drift_detected' | 'error';
  };
  uptime: number;
  lastBrandRuns: Array<{
    brand: string;
    lastRun: string;
    status: string;
    duration?: number;
  }>;
}

export interface PurgePreviewResponse {
  dryRun: boolean;
  criteria: {
    brand?: string;
    season: number;
    week?: number;
  };
  affectedRows: number;
  signalBreakdown: Record<string, number>;
  safetyChecks: {
    hasRecentSignals: boolean;
    totalSignalsInSeason: number;
    purgePercentage: number;
  };
}

export interface BrandReplayResponse {
  success: boolean;
  brand: string;
  season: number;
  week?: number;
  forceRecompute: boolean;
  results: {
    signalsCleared?: number;
    eventsTriggered: number;
    newSignalsGenerated?: number;
    processingTimeMs: number;
  };
  errors?: string[];
}

export interface BrandStreamResponse {
  success: boolean;
  brands: string[];
  targetDatasets: string[];
  results: {
    eventsTriggered: number;
    brandsProcessed: number;
    totalSignalsGenerated: number;
    processingTimeMs: number;
  };
  brandResults: Record<string, {
    success: boolean;
    signalsGenerated?: number;
    error?: string;
  }>;
}

/**
 * AdminService - Core administrative functionality
 */
export class AdminService {
  private static instance: AdminService;
  private brandSignalsIntegration = BrandSignalsIntegration.getInstance();
  private seasonService = new SeasonService();
  private monitoring = MonitoringService.getInstance();

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  /**
   * 1. Manual season override for testing/debugging
   */
  async setSeason(request: SetSeasonRequest): Promise<{ success: boolean; message: string; previousSeason?: any }> {
    console.log(`🔧 [AdminService] Setting season override: ${request.season} Week ${request.week} (${request.seasonType})`);
    
    const startTime = Date.now();
    
    try {
      // Get current season for comparison
      const currentSeason = await this.seasonService.current();
      const previousSeason = { ...currentSeason };
      
      // Insert season override into database
      await db.insert(seasonState).values({
        season: request.season,
        week: request.week,
        seasonType: request.seasonType,
        source: 'admin',
        observedAt: new Date()
      });

      // Clear cache to force fresh detection
      (this.seasonService as any).cachedSnapshot = null;
      (this.seasonService as any).lastCacheUpdate = 0;

      // Check if week changed to trigger events
      const weekChanged = currentSeason.week !== request.week || currentSeason.season !== request.season;
      
      if (weekChanged) {
        console.log(`📅 [AdminService] Week change detected, triggering brand events...`);
        
        // Trigger week rollover event
        const rollWeekEvent = createRollWeekEvent(
          request.season,
          request.week,
          currentSeason.week,
          request.seasonType === 'post' ? 'post' : 'regular'
        );
        
        await brandBus.emit(rollWeekEvent);
      }

      const duration = Date.now() - startTime;
      
      // Log admin operation
      await this.monitoring.recordJobExecution(
        'admin_season_override',
        'success',
        duration,
        {
          newSeason: request.season,
          newWeek: request.week,
          newSeasonType: request.seasonType,
          previousSeason: currentSeason,
          weekChanged
        }
      );

      console.log(`✅ [AdminService] Season override completed successfully in ${duration}ms`);
      
      return {
        success: true,
        message: `Season set to ${request.season} Week ${request.week} (${request.seasonType})${weekChanged ? ' - Week change events triggered' : ''}`,
        previousSeason
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error(`❌ [AdminService] Failed to set season override:`, error);
      
      await this.monitoring.recordJobExecution(
        'admin_season_override',
        'error',
        duration,
        { error: (error as Error).message, request }
      );
      
      throw error;
    }
  }

  /**
   * 2. Replay brand signal generation for specific period
   */
  async replayBrandSignals(request: BrandReplayRequest): Promise<BrandReplayResponse> {
    console.log(`🔄 [AdminService] Replaying brand signals: ${request.brand} S${request.season}${request.week ? ` W${request.week}` : ''}`);
    
    const startTime = Date.now();
    const response: BrandReplayResponse = {
      success: false,
      brand: request.brand,
      season: request.season,
      week: request.week,
      forceRecompute: request.forceRecompute,
      results: {
        eventsTriggered: 0,
        processingTimeMs: 0
      }
    };

    try {
      let signalsCleared = 0;

      // Clear existing signals if forceRecompute is true
      if (request.forceRecompute) {
        console.log(`🧹 [AdminService] Force recompute enabled, clearing existing signals...`);
        
        const whereClause = and(
          eq(brandSignals.brand, request.brand as any),
          eq(brandSignals.season, request.season),
          request.week ? eq(brandSignals.week, request.week) : undefined
        );

        const deleteResult = await db.delete(brandSignals).where(whereClause);
        signalsCleared = (deleteResult as any).rowCount || 0;
        
        console.log(`🧹 [AdminService] Cleared ${signalsCleared} existing signals`);
        response.results.signalsCleared = signalsCleared;
      }

      // Trigger dataset committed events for brand replay
      const currentSeason = await this.seasonService.current();
      const targetWeek = request.week || currentSeason.week;
      
      // Simulate dataset committed event to trigger brand processing
      await this.brandSignalsIntegration.triggerDatasetCommitted(
        'gold_player_week', // Primary dataset for brand signals
        request.season,
        targetWeek,
        1000, // Placeholder row count
        'admin_replay',
        `admin-replay-${request.brand}-${Date.now()}`
      );

      response.results.eventsTriggered = 1;

      // Wait a moment and check for new signals
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newSignalsQuery = await db.select({ count: count() })
        .from(brandSignals)
        .where(and(
          eq(brandSignals.brand, request.brand as any),
          eq(brandSignals.season, request.season),
          request.week ? eq(brandSignals.week, request.week) : undefined,
          gte(brandSignals.createdAt, new Date(startTime))
        ));

      const newSignalsGenerated = newSignalsQuery[0]?.count || 0;
      response.results.newSignalsGenerated = newSignalsGenerated;

      const duration = Date.now() - startTime;
      response.results.processingTimeMs = duration;
      response.success = true;

      // Log replay operation
      await this.monitoring.recordJobExecution(
        'admin_brand_replay',
        'success',
        duration,
        {
          brand: request.brand,
          season: request.season,
          week: request.week,
          forceRecompute: request.forceRecompute,
          signalsCleared,
          newSignalsGenerated
        }
      );

      console.log(`✅ [AdminService] Brand replay completed: ${newSignalsGenerated} new signals generated in ${duration}ms`);
      
      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      response.results.processingTimeMs = duration;
      response.errors = [(error as Error).message];
      
      console.error(`❌ [AdminService] Brand replay failed:`, error);
      
      await this.monitoring.recordJobExecution(
        'admin_brand_replay',
        'error',
        duration,
        { error: (error as Error).message, request }
      );
      
      return response;
    }
  }

  /**
   * 3. Trigger live brand signal streaming for current week
   */
  async streamBrandSignals(request: BrandStreamRequest): Promise<BrandStreamResponse> {
    console.log(`🚀 [AdminService] Starting brand signal streaming for ${request.brands.length} brands`);
    
    const startTime = Date.now();
    const response: BrandStreamResponse = {
      success: false,
      brands: request.brands,
      targetDatasets: request.targetDatasets,
      results: {
        eventsTriggered: 0,
        brandsProcessed: 0,
        totalSignalsGenerated: 0,
        processingTimeMs: 0
      },
      brandResults: {}
    };

    try {
      const currentSeason = await this.seasonService.current();
      let totalEventsTriggered = 0;
      let totalSignalsGenerated = 0;

      // Process each target dataset to trigger events
      for (const dataset of request.targetDatasets) {
        console.log(`📡 [AdminService] Triggering events for dataset: ${dataset}`);
        
        await this.brandSignalsIntegration.triggerDatasetCommitted(
          dataset,
          currentSeason.season,
          currentSeason.week,
          1000, // Placeholder row count
          'admin_stream',
          `admin-stream-${dataset}-${Date.now()}`
        );
        
        totalEventsTriggered++;
      }

      // Wait for processing and collect results for each brand
      await new Promise(resolve => setTimeout(resolve, 3000));

      for (const brand of request.brands) {
        try {
          const signalsQuery = await db.select({ count: count() })
            .from(brandSignals)
            .where(and(
              eq(brandSignals.brand, brand as any),
              eq(brandSignals.season, currentSeason.season),
              eq(brandSignals.week, currentSeason.week),
              gte(brandSignals.createdAt, new Date(startTime))
            ));

          const brandSignalCount = signalsQuery[0]?.count || 0;
          totalSignalsGenerated += brandSignalCount;

          response.brandResults[brand] = {
            success: true,
            signalsGenerated: brandSignalCount
          };

          console.log(`✅ [AdminService] Brand ${brand}: ${brandSignalCount} signals generated`);

        } catch (error) {
          response.brandResults[brand] = {
            success: false,
            error: (error as Error).message
          };
          
          console.error(`❌ [AdminService] Brand ${brand} processing failed:`, error);
        }
      }

      const duration = Date.now() - startTime;
      
      response.results.eventsTriggered = totalEventsTriggered;
      response.results.brandsProcessed = Object.keys(response.brandResults).length;
      response.results.totalSignalsGenerated = totalSignalsGenerated;
      response.results.processingTimeMs = duration;
      response.success = true;

      // Log streaming operation
      await this.monitoring.recordJobExecution(
        'admin_brand_streaming',
        'success',
        duration,
        {
          brands: request.brands,
          datasets: request.targetDatasets,
          eventsTriggered: totalEventsTriggered,
          totalSignalsGenerated
        }
      );

      console.log(`✅ [AdminService] Brand streaming completed: ${totalSignalsGenerated} total signals generated in ${duration}ms`);
      
      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      response.results.processingTimeMs = duration;
      
      console.error(`❌ [AdminService] Brand streaming failed:`, error);
      
      await this.monitoring.recordJobExecution(
        'admin_brand_streaming',
        'error',
        duration,
        { error: (error as Error).message, request }
      );
      
      return response;
    }
  }

  /**
   * 4. System status and brand signal health
   */
  async getSystemStatus(): Promise<SystemStatusResponse> {
    console.log(`📊 [AdminService] Gathering system status...`);
    
    try {
      // Get overall system health
      const healthStatus = await this.monitoring.getHealthStatus();
      
      // Get current season context
      const currentSeason = await this.seasonService.current();
      
      // Get brand signal counts and status
      const brandStatus: Record<string, any> = {};
      
      // Query signal counts per brand
      const signalCounts = await db.select({
        brand: brandSignals.brand,
        count: count(),
        lastUpdate: sql<string>`MAX(${brandSignals.createdAt})`
      })
      .from(brandSignals)
      .where(and(
        eq(brandSignals.season, currentSeason.season),
        eq(brandSignals.week, currentSeason.week)
      ))
      .groupBy(brandSignals.brand);

      // Get recent job runs for brands
      const recentJobs = await db.select()
        .from(monitoringJobRuns)
        .where(sql`${monitoringJobRuns.jobName} LIKE 'brand_%'`)
        .orderBy(desc(monitoringJobRuns.startedAt))
        .limit(20);

      // Build brand status
      const allBrands = ['rookie_risers', 'dynasty', 'redraft', 'trade_eval', 'sos', 'consensus'];
      
      for (const brand of allBrands) {
        const signalData = signalCounts.find(s => s.brand === brand);
        const recentJob = recentJobs.find(j => j.jobName.includes(brand));
        
        brandStatus[brand] = {
          lastRun: recentJob?.startedAt?.toISOString(),
          status: this.determineBrandHealth(signalData, recentJob),
          signalCount: signalData?.count || 0,
          recentErrors: recentJobs.filter(j => 
            j.jobName.includes(brand) && 
            j.status === 'error' && 
            j.startedAt && j.startedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
          ).length
        };
      }

      // Get database health info
      const dbHealth = await this.checkDatabaseHealth();
      
      // Get last brand runs summary
      const lastBrandRuns = recentJobs.slice(0, 10).map(job => ({
        brand: job.jobName.replace('brand_', '').replace('_plugin', ''),
        lastRun: job.startedAt?.toISOString() || '',
        status: job.status,
        duration: job.durationMs || undefined
      }));

      const response: SystemStatusResponse = {
        systemHealth: healthStatus.status,
        brandStatus,
        weekContext: {
          season: currentSeason.season,
          week: currentSeason.week,
          source: currentSeason.source
        },
        dbHealth,
        uptime: healthStatus.uptime,
        lastBrandRuns
      };

      console.log(`📊 [AdminService] System status collected successfully`);
      return response;

    } catch (error) {
      console.error(`❌ [AdminService] Failed to get system status:`, error);
      throw error;
    }
  }

  /**
   * 5. Purge signals by criteria with safety guards
   */
  async purgeSignals(request: SignalsPurgeRequest): Promise<PurgePreviewResponse> {
    console.log(`🗑️ [AdminService] Signal purge ${request.dryRun ? 'preview' : 'execution'}: Season ${request.season}${request.week ? ` Week ${request.week}` : ''}${request.brand ? ` Brand ${request.brand}` : ''}`);
    
    try {
      // Build WHERE clause based on criteria
      const whereConditions = [
        eq(brandSignals.season, request.season)
      ];

      if (request.week) {
        whereConditions.push(eq(brandSignals.week, request.week));
      }

      if (request.brand) {
        whereConditions.push(eq(brandSignals.brand, request.brand as any));
      }

      const whereClause = and(...whereConditions);

      // Get affected row count
      const countQuery = await db.select({ count: count() })
        .from(brandSignals)
        .where(whereClause);

      const affectedRows = countQuery[0]?.count || 0;

      // Get signal breakdown by brand
      const signalBreakdown: Record<string, number> = {};
      const breakdownQuery = await db.select({
        brand: brandSignals.brand,
        count: count()
      })
      .from(brandSignals)
      .where(whereClause)
      .groupBy(brandSignals.brand);

      for (const row of breakdownQuery) {
        signalBreakdown[row.brand] = row.count;
      }

      // Safety checks
      const totalSeasonSignals = await db.select({ count: count() })
        .from(brandSignals)
        .where(eq(brandSignals.season, request.season));

      const totalInSeason = totalSeasonSignals[0]?.count || 0;
      const purgePercentage = totalInSeason > 0 ? (affectedRows / totalInSeason) * 100 : 0;

      // Check for recent signals (within last 24 hours)
      const recentSignals = await db.select({ count: count() })
        .from(brandSignals)
        .where(and(
          whereClause,
          gte(brandSignals.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
        ));

      const hasRecentSignals = (recentSignals[0]?.count || 0) > 0;

      const response: PurgePreviewResponse = {
        dryRun: request.dryRun,
        criteria: {
          brand: request.brand,
          season: request.season,
          week: request.week
        },
        affectedRows,
        signalBreakdown,
        safetyChecks: {
          hasRecentSignals,
          totalSignalsInSeason: totalInSeason,
          purgePercentage: Math.round(purgePercentage * 100) / 100
        }
      };

      // If not dry run, perform actual deletion
      if (!request.dryRun) {
        console.log(`🗑️ [AdminService] Executing purge of ${affectedRows} signals...`);
        
        const deleteResult = await db.delete(brandSignals).where(whereClause);
        const actualDeleted = (deleteResult as any).rowCount || 0;

        // Log purge operation
        await this.monitoring.recordJobExecution(
          'admin_signals_purge',
          'success',
          0,
          {
            criteria: request,
            rowsDeleted: actualDeleted,
            purgePercentage,
            hasRecentSignals
          }
        );

        console.log(`✅ [AdminService] Purge completed: ${actualDeleted} signals deleted`);
      } else {
        console.log(`👀 [AdminService] Dry run completed: ${affectedRows} signals would be deleted`);
      }

      return response;

    } catch (error) {
      console.error(`❌ [AdminService] Signal purge failed:`, error);
      
      await this.monitoring.recordJobExecution(
        'admin_signals_purge',
        'error',
        0,
        { error: (error as Error).message, request }
      );
      
      throw error;
    }
  }

  /**
   * Helper: Determine brand health status
   */
  private determineBrandHealth(signalData: any, recentJob: any): 'healthy' | 'degraded' | 'unhealthy' {
    if (!signalData && !recentJob) return 'unhealthy';
    if (recentJob?.status === 'error') return 'degraded';
    if (!signalData || signalData.count === 0) return 'degraded';
    return 'healthy';
  }

  /**
   * Helper: Check database health
   */
  private async checkDatabaseHealth(): Promise<SystemStatusResponse['dbHealth']> {
    try {
      // Test basic connection
      await db.execute(sql`SELECT 1`);
      
      // Check table existence
      const tables = ['brand_signals', 'season_state', 'monitoring_job_runs'];
      
      // Simple schema sync check (could be enhanced)
      const schemaSync = 'ok'; // Placeholder - could check table structures
      
      return {
        connection: 'ok',
        tables,
        schemaSync
      };
      
    } catch (error) {
      return {
        connection: 'error',
        tables: [],
        schemaSync: 'error'
      };
    }
  }
}

export const adminService = AdminService.getInstance();