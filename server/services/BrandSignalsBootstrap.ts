/**
 * Brand Signals Bootstrap Service
 * 
 * Handles initialization and integration of the Brand Signals Brain with the UPH system.
 * Patches existing services to trigger brand signal events when appropriate.
 */

import { brandSignalsIntegration } from './BrandSignalsIntegration';

/**
 * Bootstrap the Brand Signals Brain system
 * Call this during application startup to initialize brand signal processing
 */
export async function bootstrapBrandSignals(): Promise<void> {
  console.log('🚀 [BrandSignalsBootstrap] Starting Brand Signals Brain bootstrap...');

  try {
    // Initialize the brand signals integration system
    await brandSignalsIntegration.initialize();

    // Set up periodic week rollover checks (every 15 minutes)
    setInterval(async () => {
      try {
        await brandSignalsIntegration.checkWeekRollover();
      } catch (error) {
        console.error('❌ [BrandSignalsBootstrap] Week rollover check failed:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    console.log('✅ [BrandSignalsBootstrap] Brand Signals Brain bootstrap completed successfully');

  } catch (error) {
    console.error('❌ [BrandSignalsBootstrap] Brand Signals Brain bootstrap failed:', error);
    throw error;
  }
}

/**
 * Hook to trigger dataset committed events from UPH processing
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
    await brandSignalsIntegration.triggerDatasetCommitted(
      dataset,
      season,
      week,
      rowCount,
      source,
      jobId
    );
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
 * Get health status of brand signals system for monitoring endpoints
 */
export async function getBrandSignalsHealth(): Promise<any> {
  try {
    return await brandSignalsIntegration.getHealthStatus();
  } catch (error) {
    return {
      healthy: false,
      error: (error as Error).message,
      plugins: {},
      busStatus: 'error',
      lastWeekCheck: null
    };
  }
}

/**
 * Get brand signals metrics for monitoring endpoints
 */
export async function getBrandSignalsMetrics(): Promise<any> {
  try {
    return await brandSignalsIntegration.getMetrics();
  } catch (error) {
    return {
      pluginsRegistered: 0,
      eventsProcessed: 0,
      lastEventTime: null,
      averageProcessingTime: 0,
      error: (error as Error).message
    };
  }
}