/**
 * BrandBus - Event-Driven Brand Intelligence Hub
 * 
 * Core orchestration service that distributes data events to brand-specific plugins.
 * Transforms raw data commits into actionable brand intelligence through isolated plugin architecture.
 * 
 * Architecture:
 * - Event-driven: Plugins react to DATASET.COMMITTED and DATASET.ROLL_WEEK events
 * - Plugin isolation: Each brand operates independently with error boundaries
 * - Centralized storage: All signals stored in unified brand_signals table
 * - Performance monitoring: Full metrics tracking for each brand plugin
 */

import { db } from '../infra/db';
import { brandSignals, insertBrandSignalsSchema, type InsertBrandSignals } from '@shared/schema';
import { MonitoringService } from './MonitoringService';
import { SeasonService } from './SeasonService';
import type { 
  BrandPlugin, 
  BrandContext, 
  BusEvent, 
  SignalValue,
  SignalMeta 
} from '../../domain/events';

// Forward declaration to avoid circular dependency
declare class IntelligentScheduler {
  onDatasetChange(dataset: string, season: number, week: number): Promise<void>;
  triggerBrandRecompute(triggers: Array<{
    dataset: string;
    season: number;
    week: number;
    affectedBrands: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
  }>): Promise<void>;
}

/**
 * BrandBus - Central event distribution and plugin management
 */
export class BrandBus {
  private plugins: Map<string, BrandPlugin> = new Map();
  private monitoring = MonitoringService.getInstance();
  private seasonService = new SeasonService();
  
  // Intelligent scheduling integration (lazy loaded to avoid circular dependency)
  private intelligentScheduler: IntelligentScheduler | null = null;
  
  // Configuration
  private readonly MAX_CONCURRENT_PLUGINS = parseInt(process.env.BRAND_MAX_CONCURRENT || '5', 10);
  private readonly PLUGIN_TIMEOUT_MS = parseInt(process.env.BRAND_PLUGIN_TIMEOUT_MS || '30000', 10);
  
  constructor() {
    this.setupDefaultLogger();
  }

  /**
   * Register a brand plugin with the bus
   */
  async register(plugin: BrandPlugin): Promise<void> {
    try {
      // Validate plugin structure
      this.validatePlugin(plugin);
      
      // Initialize plugin if it supports initialization
      if (plugin.initialize) {
        const ctx = await this.createContext();
        await plugin.initialize(ctx);
      }
      
      // Register plugin
      this.plugins.set(plugin.key, plugin);
      
      console.log(`🧠 [BrandBus] Registered plugin: ${plugin.key} (${plugin.name} v${plugin.version})`);
      
      // Track plugin registration
      await this.monitoring.recordJobExecution(
        `brand_plugin_register_${plugin.key}`,
        'success',
        0,
        { plugin: plugin.key, name: plugin.name, version: plugin.version }
      );
      
    } catch (error) {
      console.error(`❌ [BrandBus] Failed to register plugin ${plugin.key}:`, error);
      
      await this.monitoring.recordJobExecution(
        `brand_plugin_register_${plugin.key}`,
        'error',
        0,
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }

  /**
   * Emit an event to all subscribed plugins
   */
  async emit(event: BusEvent): Promise<void> {
    const startTime = Date.now();
    
    console.log(`🚀 [BrandBus] Emitting event: ${event.type} (season ${event.season}, week ${event.week})`);
    
    // Get subscribed plugins for this event type
    const subscribedPlugins = Array.from(this.plugins.values())
      .filter(plugin => plugin.subscribedEvents.includes(event.type));
    
    if (subscribedPlugins.length === 0) {
      console.log(`📝 [BrandBus] No plugins subscribed to ${event.type}`);
      return;
    }
    
    console.log(`📡 [BrandBus] Broadcasting to ${subscribedPlugins.length} plugins: ${subscribedPlugins.map(p => p.key).join(', ')}`);
    
    try {
      // Create shared context for all plugins
      const ctx = await this.createContext();
      
      // Process plugins in batches for resource management
      const batches = this.createBatches(subscribedPlugins, this.MAX_CONCURRENT_PLUGINS);
      let totalProcessed = 0;
      
      for (const batch of batches) {
        const batchPromises = batch.map(plugin => this.processPluginSafely(plugin, event, ctx));
        const results = await Promise.allSettled(batchPromises);
        
        // Log batch results
        results.forEach((result, index) => {
          const plugin = batch[index];
          if (result.status === 'fulfilled') {
            console.log(`✅ [BrandBus] Plugin ${plugin.key} completed successfully`);
            totalProcessed++;
          } else {
            console.error(`❌ [BrandBus] Plugin ${plugin.key} failed:`, result.reason);
          }
        });
      }
      
      const duration = Date.now() - startTime;
      console.log(`🎯 [BrandBus] Event processing completed: ${totalProcessed}/${subscribedPlugins.length} plugins successful (${duration}ms)`);
      
      // Record overall event processing metrics
      await this.monitoring.recordJobExecution(
        'brand_bus_event_processing',
        totalProcessed === subscribedPlugins.length ? 'success' : 'error',
        duration,
        {
          eventType: event.type,
          pluginsTotal: subscribedPlugins.length,
          pluginsSuccessful: totalProcessed,
          season: event.season,
          week: event.week
        }
      );
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`💥 [BrandBus] Critical error during event processing:`, error);
      
      await this.monitoring.recordJobExecution(
        'brand_bus_event_processing',
        'error',
        duration,
        { error: (error as Error).message, eventType: event.type }
      );
      
      throw error;
    }
  }

  /**
   * Process a single plugin with full error isolation
   */
  private async processPluginSafely(
    plugin: BrandPlugin, 
    event: BusEvent, 
    ctx: BrandContext
  ): Promise<void> {
    const pluginTimer = ctx.metrics.begin(`brand_${plugin.key}`);
    const startTime = Date.now();
    
    try {
      // Create timeout promise for plugin execution
      const pluginPromise = plugin.onEvent(event, ctx);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Plugin timeout after ${this.PLUGIN_TIMEOUT_MS}ms`)), this.PLUGIN_TIMEOUT_MS);
      });
      
      // Race between plugin execution and timeout
      await Promise.race([pluginPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      console.log(`🔥 [BrandBus] Plugin ${plugin.key} processed ${event.type} in ${duration}ms`);
      
      pluginTimer();
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`⚠️ [BrandBus] Plugin ${plugin.key} failed:`, error);
      
      ctx.metrics.fail(`brand_${plugin.key}`, error as Error);
      
      // Record detailed plugin failure
      await this.monitoring.recordJobExecution(
        `brand_plugin_${plugin.key}`,
        'error',
        duration,
        {
          error: (error as Error).message,
          eventType: event.type,
          plugin: plugin.key,
          season: event.season,
          week: event.week
        }
      );
      
      throw error; // Re-throw for batch processing tracking
    }
  }

  /**
   * Create brand context for plugin execution
   */
  private async createContext(): Promise<BrandContext> {
    return {
      db,
      metrics: {
        begin: (job: string) => {
          const startTime = Date.now();
          return () => {
            const duration = Date.now() - startTime;
            console.log(`⏱️ [BrandBus] Metric ${job} completed in ${duration}ms`);
          };
        },
        fail: (job: string, error: Error) => {
          console.error(`❌ [BrandBus] Metric ${job} failed:`, error.message);
        },
        record: (metric: string, value: number, labels?: Record<string, string>) => {
          console.log(`📊 [BrandBus] Recording metric ${metric}: ${value}`, labels || {});
        }
      },
      season: async () => {
        const snapshot = await this.seasonService.current();
        return {
          season: snapshot.season,
          week: snapshot.week,
          seasonType: snapshot.seasonType
        };
      },
      logger: {
        info: (message: string, meta?: Record<string, any>) => {
          console.log(`ℹ️ [BrandBus] ${message}`, meta || {});
        },
        warn: (message: string, meta?: Record<string, any>) => {
          console.warn(`⚠️ [BrandBus] ${message}`, meta || {});
        },
        error: (message: string, error: any, meta?: Record<string, any>) => {
          console.error(`❌ [BrandBus] ${message}`, error, meta || {});
        }
      }
    };
  }

  /**
   * Helper method for plugins to store signals easily
   */
  async storeSignal(
    brand: string,
    season: number,
    week: number,
    playerId: string,
    signalKey: string,
    signalValue: SignalValue,
    meta?: SignalMeta
  ): Promise<void> {
    try {
      const signal: InsertBrandSignals = {
        brand: brand as any, // Type assertion for enum
        season,
        week,
        playerId,
        signalKey,
        signalValue,
        meta: meta || {}
      };

      await db.insert(brandSignals)
        .values(signal)
        .onConflictDoUpdate({
          target: [brandSignals.brand, brandSignals.season, brandSignals.week, brandSignals.playerId, brandSignals.signalKey],
          set: {
            signalValue: signal.signalValue,
            meta: signal.meta,
            updatedAt: new Date()
          }
        });
        
      console.log(`💾 [BrandBus] Stored signal ${brand}.${signalKey} = ${signalValue} for player ${playerId}`);
      
    } catch (error) {
      console.error(`❌ [BrandBus] Failed to store signal:`, error);
      throw error;
    }
  }

  /**
   * Get registered plugins info for monitoring
   */
  getPluginsInfo(): Array<{ key: string; name: string; version: string; events: string[] }> {
    return Array.from(this.plugins.values()).map(plugin => ({
      key: plugin.key,
      name: plugin.name,
      version: plugin.version,
      events: plugin.subscribedEvents
    }));
  }

  /**
   * Run health checks on all registered plugins
   */
  async healthCheck(): Promise<Record<string, { healthy: boolean; message?: string }>> {
    const results: Record<string, { healthy: boolean; message?: string }> = {};
    
    for (const [key, plugin] of this.plugins.entries()) {
      try {
        if (plugin.healthCheck) {
          results[key] = await plugin.healthCheck();
        } else {
          results[key] = { healthy: true, message: 'No health check implemented' };
        }
      } catch (error) {
        results[key] = { 
          healthy: false, 
          message: `Health check failed: ${(error as Error).message}` 
        };
      }
    }
    
    return results;
  }

  // Private helper methods
  private validatePlugin(plugin: BrandPlugin): void {
    if (!plugin.key || typeof plugin.key !== 'string') {
      throw new Error('Plugin must have a valid string key');
    }
    
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('Plugin must have a valid string name');
    }
    
    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new Error('Plugin must have a valid string version');
    }
    
    if (!Array.isArray(plugin.subscribedEvents)) {
      throw new Error('Plugin must have subscribedEvents array');
    }
    
    if (typeof plugin.onEvent !== 'function') {
      throw new Error('Plugin must implement onEvent method');
    }
    
    if (this.plugins.has(plugin.key)) {
      throw new Error(`Plugin with key '${plugin.key}' is already registered`);
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private setupDefaultLogger(): void {
    console.log('🧠 [BrandBus] Initializing Brand Intelligence Hub...');
  }

  /**
   * INTELLIGENT SCHEDULING INTEGRATION
   * Methods for connecting with the IntelligentScheduler service
   */

  /**
   * Initialize intelligent scheduling integration
   * This should be called after both BrandBus and IntelligentScheduler are initialized
   */
  async initializeIntelligentScheduling(): Promise<void> {
    try {
      // Lazy load the IntelligentScheduler to avoid circular dependency
      if (!this.intelligentScheduler) {
        const { intelligentScheduler } = await import('./IntelligentScheduler');
        this.intelligentScheduler = intelligentScheduler;
        console.log('🧠 [BrandBus] Intelligent scheduling integration initialized');
      }
    } catch (error) {
      console.warn('⚠️ [BrandBus] Failed to initialize intelligent scheduling:', error);
      // Continue without intelligent scheduling if it fails
    }
  }

  /**
   * Enhanced event emission with intelligent scheduling hooks
   * Called by intelligent scheduler to trigger brand recomputation
   */
  async emitWithIntelligentTrigger(
    event: BusEvent,
    trigger: {
      reason: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      affectedBrands?: string[];
    }
  ): Promise<void> {
    try {
      console.log(`🧠 [BrandBus] Intelligent trigger for event ${event.type}: ${trigger.reason}`);
      console.log(`   ⚡ Priority: ${trigger.priority}`);
      
      if (trigger.affectedBrands && trigger.affectedBrands.length > 0) {
        console.log(`   🎯 Affected brands: ${trigger.affectedBrands.join(', ')}`);
      }

      // Emit the event normally
      await this.emit(event);

      // Notify intelligent scheduler that processing completed
      await this.notifyIntelligentScheduler('brand_processing_completed', {
        eventType: event.type,
        season: event.season,
        week: event.week,
        trigger,
        timestamp: new Date()
      });

      console.log(`✅ [BrandBus] Intelligent trigger completed for ${event.type}`);

    } catch (error) {
      console.error(`❌ [BrandBus] Intelligent trigger failed for ${event.type}:`, error);
      
      // Notify intelligent scheduler of failure
      await this.notifyIntelligentScheduler('brand_processing_failed', {
        eventType: event.type,
        season: event.season,
        week: event.week,
        trigger,
        error: (error as Error).message,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Trigger brand recomputation for specific datasets intelligently
   * Called by IntelligentScheduler when upstream data changes
   */
  async triggerIntelligentBrandRecompute(triggers: Array<{
    dataset: string;
    season: number;
    week: number;
    affectedBrands: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
  }>): Promise<void> {
    console.log(`🎯 [BrandBus] Triggering intelligent brand recompute for ${triggers.length} triggers`);

    try {
      // Initialize intelligent scheduling if not already done
      await this.initializeIntelligentScheduling();

      // Process each trigger
      for (const trigger of triggers) {
        console.log(`🎯 [BrandBus] Processing brand recompute trigger: ${trigger.dataset}`);
        console.log(`   🏷️ Affected brands: ${trigger.affectedBrands.join(', ')}`);
        console.log(`   ⚡ Priority: ${trigger.priority}`);
        console.log(`   📋 Reason: ${trigger.reason}`);

        // Create event for brand recomputation
        const recomputeEvent: BusEvent = {
          type: 'DATASET.COMMITTED',
          source: 'intelligent_scheduler',
          dataset: trigger.dataset,
          season: trigger.season,
          week: trigger.week,
          rowCount: 0, // Will be filled by the actual processing
          timestamp: new Date()
        };

        // Emit with intelligent trigger context
        await this.emitWithIntelligentTrigger(recomputeEvent, {
          reason: trigger.reason,
          priority: trigger.priority,
          affectedBrands: trigger.affectedBrands
        });

        console.log(`✅ [BrandBus] Brand recompute trigger completed: ${trigger.dataset}`);
      }

      console.log(`🎯 [BrandBus] All intelligent brand recompute triggers completed successfully`);

    } catch (error) {
      console.error(`❌ [BrandBus] Intelligent brand recompute failed:`, error);
      throw error;
    }
  }

  /**
   * Notify intelligent scheduler of brand processing events
   */
  async notifyIntelligentScheduler(
    eventType: 'brand_processing_completed' | 'brand_processing_failed',
    data: any
  ): Promise<void> {
    try {
      // Initialize intelligent scheduling if not already done
      await this.initializeIntelligentScheduling();
      
      if (this.intelligentScheduler) {
        console.log(`📡 [BrandBus] Notifying intelligent scheduler: ${eventType}`);
        
        // For now, we don't have a direct notification method in IntelligentScheduler
        // This would be implemented as part of a more complete integration
        // await this.intelligentScheduler.onBrandProcessingEvent(eventType, data);
      }
    } catch (error) {
      console.warn('⚠️ [BrandBus] Failed to notify intelligent scheduler:', error);
      // Don't throw - notifications should not fail main processing
    }
  }

  /**
   * Get intelligent scheduling status for monitoring
   */
  async getIntelligentSchedulingStatus(): Promise<{
    enabled: boolean;
    lastBrandTrigger?: Date;
    schedulerHealth?: any;
  }> {
    try {
      await this.initializeIntelligentScheduling();

      if (this.intelligentScheduler) {
        const schedulerStatus = await this.intelligentScheduler.getSchedulerStatus();
        
        return {
          enabled: true,
          schedulerHealth: schedulerStatus
        };
      } else {
        return { enabled: false };
      }
    } catch (error) {
      console.warn('⚠️ [BrandBus] Failed to get intelligent scheduling status:', error);
      return { enabled: false };
    }
  }

  /**
   * Determine which brands are affected by a dataset change
   * This provides intelligent mapping of datasets to brand signals
   */
  getBrandsAffectedByDataset(dataset: string): string[] {
    // Mapping of datasets to the brands they affect
    const datasetBrandMap: Record<string, string[]> = {
      'gold_player_week': ['rookie_risers', 'dynasty', 'redraft', 'trade_analyzer'],
      'injuries': ['rookie_risers', 'waiver_wire', 'lineup_optimizer'],
      'market_signals': ['trade_analyzer', 'market_trends'],
      'consensus_rankings': ['redraft', 'dynasty', 'lineup_optimizer'],
      'silver_players': ['rookie_risers', 'dynasty'],
      'silver_game_logs': ['lineup_optimizer', 'performance_tracker'],
      'bronze_players': ['all'], // Bronze data affects all brands potentially
      'bronze_game_logs': ['performance_tracker', 'lineup_optimizer']
    };

    const affectedBrands = datasetBrandMap[dataset] || [];
    
    // Handle 'all' case by returning all registered plugin keys
    if (affectedBrands.includes('all')) {
      return Array.from(this.plugins.keys());
    }
    
    // Filter to only include brands that are actually registered
    return affectedBrands.filter(brand => this.plugins.has(brand));
  }

  /**
   * Get processing priority for a dataset change
   */
  getProcessingPriority(dataset: string, staleness: 'fresh' | 'stale' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
    // High-impact datasets get higher priority
    const highImpactDatasets = ['gold_player_week', 'injuries', 'consensus_rankings'];
    const mediumImpactDatasets = ['silver_players', 'market_signals'];
    
    if (staleness === 'critical') {
      return 'critical';
    }
    
    if (staleness === 'stale' && highImpactDatasets.includes(dataset)) {
      return 'high';
    }
    
    if (staleness === 'stale' && mediumImpactDatasets.includes(dataset)) {
      return 'medium';
    }
    
    return 'low';
  }
}

// Singleton instance for application-wide use
export const brandBus = new BrandBus();

// Export types for plugin development
export type { BrandPlugin, BrandContext, BusEvent } from '../../domain/events';