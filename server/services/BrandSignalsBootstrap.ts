/**
 * Brand Signals Bootstrap Service
 * 
 * Handles initialization and integration of the Brand Signals Brain with the UPH system.
 * Patches existing services to trigger brand signal events when appropriate.
 * Now integrated with IntelligentScheduler for event-driven, state-aware processing.
 */

import { brandSignalsIntegration } from './BrandSignalsIntegration';

// Forward declaration to avoid circular dependency
declare class IntelligentScheduler {
  initialize(): Promise<void>;
  addScheduleConfig(config: any): void;
  onDatasetChange(dataset: string, season: number, week: number): Promise<void>;
  getSchedulerStatus(): Promise<any>;
}

// Intelligent scheduler instance (lazy loaded)
let intelligentScheduler: IntelligentScheduler | null = null;

/**
 * Bootstrap the Brand Signals Brain system with Intelligent Scheduling
 * Call this during application startup to initialize brand signal processing
 */
export async function bootstrapBrandSignals(): Promise<void> {
  console.log('🚀 [BrandSignalsBootstrap] Starting Brand Signals Brain bootstrap with Intelligent Scheduling...');

  try {
    // Initialize the brand signals integration system
    await brandSignalsIntegration.initialize();

    // Initialize intelligent scheduling
    await initializeIntelligentScheduling();

    // Set up intelligent scheduling for brand signals instead of fixed intervals
    await setupIntelligentBrandScheduling();

    console.log('✅ [BrandSignalsBootstrap] Brand Signals Brain bootstrap completed with Intelligent Scheduling');

  } catch (error) {
    console.error('❌ [BrandSignalsBootstrap] Brand Signals Brain bootstrap failed:', error);
    throw error;
  }
}

/**
 * Initialize intelligent scheduling integration
 */
async function initializeIntelligentScheduling(): Promise<void> {
  try {
    // Lazy load the IntelligentScheduler to avoid circular dependency
    if (!intelligentScheduler) {
      const { intelligentScheduler: scheduler } = await import('./IntelligentScheduler');
      intelligentScheduler = scheduler;
      
      // Initialize the intelligent scheduler
      await intelligentScheduler.initialize();
      
      console.log('🧠 [BrandSignalsBootstrap] Intelligent scheduling initialized');
    }
  } catch (error) {
    console.warn('⚠️ [BrandSignalsBootstrap] Failed to initialize intelligent scheduling, falling back to fixed intervals:', error);
    
    // Fallback to fixed interval if intelligent scheduling fails
    await setupFallbackScheduling();
  }
}

/**
 * Set up intelligent, event-driven scheduling for brand signals
 */
async function setupIntelligentBrandScheduling(): Promise<void> {
  if (!intelligentScheduler) {
    console.warn('⚠️ [BrandSignalsBootstrap] Intelligent scheduler not available, using fallback');
    await setupFallbackScheduling();
    return;
  }

  try {
    console.log('🧠 [BrandSignalsBootstrap] Setting up intelligent brand signal scheduling...');

    // Configure intelligent week rollover detection
    intelligentScheduler.addScheduleConfig({
      scheduleKey: 'brand_week_rollover',
      baseFrequencyMs: 15 * 60 * 1000, // 15 minutes base frequency
      minFrequencyMs: 5 * 60 * 1000,   // 5 minutes minimum when detecting rollover
      maxFrequencyMs: 60 * 60 * 1000,  // 1 hour maximum when stable
      freshnessThresholdMs: 30 * 60 * 1000, // 30 minutes freshness threshold
      slaTargets: {
        targetProcessingTime: 2 * 60 * 1000, // 2 minutes
        actualProcessingTime: 0,
        targetErrorRate: 0.01, // 1%
        actualErrorRate: 0,
        targetFreshness: 15, // 15 minutes
        actualFreshness: 0,
        slaCompliance: 1.0
      },
      enabled: true
    });

    // Configure intelligent brand signal refresh schedule  
    intelligentScheduler.addScheduleConfig({
      scheduleKey: 'brand_signal_refresh',
      baseFrequencyMs: 30 * 60 * 1000, // 30 minutes base frequency
      minFrequencyMs: 10 * 60 * 1000,  // 10 minutes minimum when data is fresh
      maxFrequencyMs: 2 * 60 * 60 * 1000, // 2 hours maximum when data is stale
      freshnessThresholdMs: 45 * 60 * 1000, // 45 minutes freshness threshold
      slaTargets: {
        targetProcessingTime: 5 * 60 * 1000, // 5 minutes
        actualProcessingTime: 0,
        targetErrorRate: 0.02, // 2%
        actualErrorRate: 0,
        targetFreshness: 30, // 30 minutes
        actualFreshness: 0,
        slaCompliance: 1.0
      },
      enabled: true
    });

    console.log('✅ [BrandSignalsBootstrap] Intelligent brand signal scheduling configured');

  } catch (error) {
    console.error('❌ [BrandSignalsBootstrap] Failed to setup intelligent scheduling, using fallback:', error);
    await setupFallbackScheduling();
  }
}

/**
 * Fallback to fixed interval scheduling if intelligent scheduling fails
 */
async function setupFallbackScheduling(): Promise<void> {
  console.log('⚠️ [BrandSignalsBootstrap] Using fallback fixed interval scheduling');
  
  // Set up periodic week rollover checks (every 15 minutes) - FALLBACK ONLY
  setInterval(async () => {
    try {
      await brandSignalsIntegration.checkWeekRollover();
    } catch (error) {
      console.error('❌ [BrandSignalsBootstrap] Week rollover check failed:', error);
    }
  }, 15 * 60 * 1000); // 15 minutes

  console.log('⚠️ [BrandSignalsBootstrap] Fallback scheduling active (fixed 15-minute intervals)');
}

/**
 * Hook to trigger dataset committed events from UPH processing with Intelligent Scheduling integration
 * This should be called by UPH services when data processing completes
 */
export async function triggerDatasetCommitted(
  dataset: string,
  season: number,
  week: number,
  rowCount: number,
  source?: string,
  jobId?: string
): Promise<void> {
  try {
    // Trigger brand signals integration as before
    await brandSignalsIntegration.triggerDatasetCommitted(
      dataset,
      season,
      week,
      rowCount,
      source,
      jobId
    );

    // Notify intelligent scheduler of dataset change for event-driven processing
    if (intelligentScheduler) {
      try {
        await intelligentScheduler.onDatasetChange(dataset, season, week);
        console.log(`🧠 [BrandSignalsBootstrap] Notified intelligent scheduler of dataset change: ${dataset}`);
      } catch (error) {
        console.warn('⚠️ [BrandSignalsBootstrap] Failed to notify intelligent scheduler:', error);
        // Don't fail the main process - this is a notification enhancement
      }
    }

  } catch (error) {
    // Log but don't throw - brand signal failures shouldn't break UPH processing
    console.error('❌ [BrandSignalsBootstrap] Failed to trigger dataset committed event:', error);
  }
}

/**
 * Hook to trigger player identity resolved events
 */
export async function triggerPlayerIdentityResolved(
  season: number,
  week: number,
  resolvedCount: number,
  newMappings: Array<{ sourcePlayerId: string; canonicalPlayerId: string }>
): Promise<void> {
  try {
    await brandSignalsIntegration.triggerPlayerIdentityResolved(
      season,
      week,
      resolvedCount,
      newMappings
    );
  } catch (error) {
    console.error('❌ [BrandSignalsBootstrap] Failed to trigger player identity resolved event:', error);
  }
}

/**
 * Get health status of brand signals system with intelligent scheduling for monitoring endpoints
 */
export async function getBrandSignalsHealth(): Promise<any> {
  try {
    const brandHealth = await brandSignalsIntegration.getHealthStatus();
    
    // Get intelligent scheduling health if available
    let schedulerHealth = null;
    if (intelligentScheduler) {
      try {
        schedulerHealth = await intelligentScheduler.getSchedulerStatus();
      } catch (error) {
        console.warn('⚠️ [BrandSignalsBootstrap] Failed to get scheduler health:', error);
      }
    }

    return {
      ...brandHealth,
      intelligentScheduling: {
        enabled: intelligentScheduler !== null,
        health: schedulerHealth,
        mode: intelligentScheduler ? 'intelligent' : 'fallback'
      }
    };
    
  } catch (error) {
    return {
      healthy: false,
      error: (error as Error).message,
      plugins: {},
      busStatus: 'error',
      lastWeekCheck: null,
      intelligentScheduling: {
        enabled: false,
        health: null,
        mode: 'fallback',
        error: 'Failed to get health status'
      }
    };
  }
}

/**
 * Get brand signals metrics with intelligent scheduling data for monitoring endpoints
 */
export async function getBrandSignalsMetrics(): Promise<any> {
  try {
    const brandMetrics = await brandSignalsIntegration.getMetrics();
    
    // Get intelligent scheduling metrics if available
    let schedulerMetrics = null;
    if (intelligentScheduler) {
      try {
        schedulerMetrics = await intelligentScheduler.getSchedulerStatus();
      } catch (error) {
        console.warn('⚠️ [BrandSignalsBootstrap] Failed to get scheduler metrics:', error);
      }
    }

    return {
      ...brandMetrics,
      intelligentScheduling: {
        enabled: intelligentScheduler !== null,
        metrics: schedulerMetrics,
        schedules: schedulerMetrics?.schedules || [],
        totalTriggers: schedulerMetrics?.totalTriggers || 0,
        recentFailures: schedulerMetrics?.recentFailures || 0,
        mode: intelligentScheduler ? 'intelligent' : 'fallback'
      }
    };
    
  } catch (error) {
    return {
      pluginsRegistered: 0,
      eventsProcessed: 0,
      lastEventTime: null,
      averageProcessingTime: 0,
      error: (error as Error).message,
      intelligentScheduling: {
        enabled: false,
        metrics: null,
        schedules: [],
        totalTriggers: 0,
        recentFailures: 0,
        mode: 'fallback'
      }
    };
  }
}

/**
 * Get intelligent scheduling status for administrative monitoring
 */
export async function getIntelligentSchedulingStatus(): Promise<{
  enabled: boolean;
  mode: 'intelligent' | 'fallback';
  health?: any;
  schedules?: any[];
  performance?: any;
}> {
  try {
    if (!intelligentScheduler) {
      return {
        enabled: false,
        mode: 'fallback'
      };
    }

    const status = await intelligentScheduler.getSchedulerStatus();
    
    return {
      enabled: true,
      mode: 'intelligent',
      health: {
        initialized: status.initialized,
        activeSchedules: status.activeSchedules,
        recentFailures: status.recentFailures,
        systemLoad: status.systemLoad
      },
      schedules: status.schedules,
      performance: {
        totalTriggers: status.totalTriggers,
        successRate: status.schedules?.reduce((acc: number, s: any) => acc + s.successRate, 0) / Math.max(status.schedules?.length || 1, 1),
        averageFrequency: status.schedules?.reduce((acc: number, s: any) => acc + s.frequency, 0) / Math.max(status.schedules?.length || 1, 1)
      }
    };
    
  } catch (error) {
    console.error('❌ [BrandSignalsBootstrap] Failed to get intelligent scheduling status:', error);
    return {
      enabled: false,
      mode: 'fallback'
    };
  }
}

/**
 * Manually trigger intelligent processing for specific schedules (for debugging/admin use)
 */
export async function triggerIntelligentProcessing(scheduleKey: string): Promise<{ success: boolean; message: string }> {
  if (!intelligentScheduler) {
    return {
      success: false,
      message: 'Intelligent scheduler is not available - running in fallback mode'
    };
  }

  try {
    // This would trigger a manual execution of a specific schedule
    // The actual implementation would depend on the IntelligentScheduler API
    console.log(`🔧 [BrandSignalsBootstrap] Manual trigger requested for schedule: ${scheduleKey}`);
    
    // For brand signals, we can trigger specific actions
    if (scheduleKey === 'brand_week_rollover') {
      await brandSignalsIntegration.checkWeekRollover();
      return {
        success: true,
        message: 'Week rollover check triggered manually'
      };
    }

    return {
      success: false,
      message: `Unknown schedule key: ${scheduleKey}`
    };
    
  } catch (error) {
    console.error(`❌ [BrandSignalsBootstrap] Manual trigger failed for ${scheduleKey}:`, error);
    return {
      success: false,
      message: `Manual trigger failed: ${(error as Error).message}`
    };
  }
}