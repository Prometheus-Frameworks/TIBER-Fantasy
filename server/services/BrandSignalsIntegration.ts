/**
 * Brand Signals Integration Service
 * 
 * Integration layer that hooks the BrandBus into the UPH processing pipeline.
 * Triggers brand signal events when data commits complete and week changes occur.
 */

import { brandBus } from './BrandBus';
import { SeasonService } from './SeasonService';
import { MonitoringService } from './MonitoringService';
import { 
  createDatasetCommittedEvent, 
  createRollWeekEvent,
  createPlayerIdentityEvent,
  type BusEvent 
} from '../../domain/events';

// Import example plugins
import { RookieRisersPlugin } from '../plugins/rookieRisers';
import { RedraftBuySellPlugin } from '../plugins/redraftBuySell';

/**
 * Integration service for connecting BrandBus to UPH pipeline
 */
export class BrandSignalsIntegration {
  private static instance: BrandSignalsIntegration;
  private seasonService = new SeasonService();
  private monitoring = MonitoringService.getInstance();
  private isInitialized = false;
  private lastKnownWeek: number | null = null;

  public static getInstance(): BrandSignalsIntegration {
    if (!BrandSignalsIntegration.instance) {
      BrandSignalsIntegration.instance = new BrandSignalsIntegration();
    }
    return BrandSignalsIntegration.instance;
  }

  /**
   * Initialize the brand signals system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('🧠 [BrandSignalsIntegration] Already initialized, skipping...');
      return;
    }

    console.log('🧠 [BrandSignalsIntegration] Initializing Brand Signals Brain...');

    try {
      // Register all brand plugins
      await this.registerPlugins();

      // Set up week rollover monitoring
      await this.initializeWeekMonitoring();

      this.isInitialized = true;
      console.log('✅ [BrandSignalsIntegration] Brand Signals Brain initialized successfully');

      // Record initialization success
      await this.monitoring.recordJobExecution(
        'brand_signals_initialization',
        'success',
        0,
        { pluginsRegistered: brandBus.getPluginsInfo().length }
      );

    } catch (error) {
      console.error('❌ [BrandSignalsIntegration] Failed to initialize Brand Signals Brain:', error);
      
      await this.monitoring.recordJobExecution(
        'brand_signals_initialization',
        'error',
        0,
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }

  /**
   * Register all brand plugins with the bus
   */
  private async registerPlugins(): Promise<void> {
    console.log('🔌 [BrandSignalsIntegration] Registering brand plugins...');

    const plugins = [
      RookieRisersPlugin,
      RedraftBuySellPlugin
    ];

    for (const plugin of plugins) {
      await brandBus.register(plugin);
    }

    console.log(`🔌 [BrandSignalsIntegration] Registered ${plugins.length} brand plugins successfully`);
  }

  /**
   * Initialize week rollover monitoring
   */
  private async initializeWeekMonitoring(): Promise<void> {
    try {
      const currentSeason = await this.seasonService.current();
      this.lastKnownWeek = currentSeason.week;
      
      console.log(`📅 [BrandSignalsIntegration] Week monitoring initialized - Current: ${currentSeason.season} Week ${currentSeason.week}`);
    } catch (error) {
      console.warn('⚠️ [BrandSignalsIntegration] Failed to initialize week monitoring:', error);
      // Non-critical error, continue with initialization
    }
  }

  /**
   * Trigger dataset committed event from UPH processing
   * Called by UPH services when data commits complete
   */
  async triggerDatasetCommitted(
    dataset: string,
    season: number,
    week: number,
    rowCount: number,
    source?: string,
    jobId?: string
  ): Promise<void> {
    if (!this.isInitialized) {
      console.warn('🧠 [BrandSignalsIntegration] Not initialized, skipping dataset committed event');
      return;
    }

    console.log(`📡 [BrandSignalsIntegration] Triggering DATASET.COMMITTED event: ${dataset} (${rowCount} rows)`);

    try {
      const event = createDatasetCommittedEvent(dataset, season, week, rowCount, source, jobId);
      await brandBus.emit(event);

      console.log(`✅ [BrandSignalsIntegration] DATASET.COMMITTED event processed successfully`);

    } catch (error) {
      console.error(`❌ [BrandSignalsIntegration] Failed to process DATASET.COMMITTED event:`, error);
      
      await this.monitoring.recordJobExecution(
        'brand_signals_dataset_committed',
        'error',
        0,
        { 
          dataset, 
          season, 
          week, 
          error: (error as Error).message 
        }
      );
      
      // Don't re-throw - UPH processing should continue even if brand signals fail
    }
  }

  /**
   * Check for week rollover and trigger events if needed
   * Called periodically or triggered by season detection
   */
  async checkWeekRollover(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      const currentSeason = await this.seasonService.current();
      
      // Check if week has changed
      if (this.lastKnownWeek !== null && this.lastKnownWeek !== currentSeason.week) {
        console.log(`📅 [BrandSignalsIntegration] Week rollover detected: ${this.lastKnownWeek} → ${currentSeason.week}`);

        const event = createRollWeekEvent(
          currentSeason.season,
          currentSeason.week,
          this.lastKnownWeek,
          currentSeason.seasonType
        );

        await brandBus.emit(event);
        
        console.log(`✅ [BrandSignalsIntegration] DATASET.ROLL_WEEK event processed successfully`);
      }

      // Update tracking
      this.lastKnownWeek = currentSeason.week;

    } catch (error) {
      console.error(`❌ [BrandSignalsIntegration] Failed to check week rollover:`, error);
      
      await this.monitoring.recordJobExecution(
        'brand_signals_week_rollover',
        'error',
        0,
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Trigger player identity resolved event
   * Called when player identity service resolves new mappings
   */
  async triggerPlayerIdentityResolved(
    season: number,
    week: number,
    resolvedCount: number,
    newMappings: Array<{ sourcePlayerId: string; canonicalPlayerId: string }>
  ): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log(`🆔 [BrandSignalsIntegration] Triggering PLAYER.IDENTITY_RESOLVED event (${resolvedCount} resolved)`);

    try {
      const event = createPlayerIdentityEvent(season, week, resolvedCount, newMappings);
      await brandBus.emit(event);

      console.log(`✅ [BrandSignalsIntegration] PLAYER.IDENTITY_RESOLVED event processed successfully`);

    } catch (error) {
      console.error(`❌ [BrandSignalsIntegration] Failed to process PLAYER.IDENTITY_RESOLVED event:`, error);
    }
  }

  /**
   * Get health status of brand signals system
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    plugins: Record<string, { healthy: boolean; message?: string }>;
    busStatus: string;
    lastWeekCheck: number | null;
  }> {
    try {
      const pluginHealth = await brandBus.healthCheck();
      const plugins = brandBus.getPluginsInfo();
      
      const allPluginsHealthy = Object.values(pluginHealth).every(h => h.healthy);

      return {
        healthy: this.isInitialized && allPluginsHealthy,
        plugins: pluginHealth,
        busStatus: this.isInitialized ? 'initialized' : 'not_initialized',
        lastWeekCheck: this.lastKnownWeek
      };

    } catch (error) {
      return {
        healthy: false,
        plugins: {},
        busStatus: 'error',
        lastWeekCheck: this.lastKnownWeek
      };
    }
  }

  /**
   * Get brand signals metrics for monitoring
   */
  async getMetrics(): Promise<{
    pluginsRegistered: number;
    eventsProcessed: number;
    lastEventTime: Date | null;
    averageProcessingTime: number;
  }> {
    const plugins = brandBus.getPluginsInfo();
    
    // For now return basic metrics, can be enhanced with actual tracking
    return {
      pluginsRegistered: plugins.length,
      eventsProcessed: 0, // TODO: Add actual tracking
      lastEventTime: null, // TODO: Add actual tracking  
      averageProcessingTime: 0 // TODO: Add actual tracking
    };
  }
}

// Export singleton instance for easy access
export const brandSignalsIntegration = BrandSignalsIntegration.getInstance();