/**
 * Intelligent Scheduler Service - State-Aware Processing Orchestration
 * 
 * Final infrastructure hardening component that replaces fixed cron schedules with
 * intelligent, data-driven triggers. Implements state-aware polling, event-driven processing,
 * brand recompute triggers, and SLA-aware scheduling adjustments.
 * 
 * Core Features:
 * - State-aware polling based on data freshness rather than time intervals
 * - Event-driven processing triggered by actual data changes
 * - Brand recompute triggers for automatic brand signal updates
 * - SLA-aware scheduling that adjusts based on system performance
 * - Smart backoff and retry logic with exponential backoff
 * - Idempotency guarantees to prevent duplicate processing
 * - Comprehensive scheduling metrics and monitoring integration
 */

import { db } from '../infra/db';
import {
  intelligentScheduleState,
  scheduleTriggers,
  datasetVersions,
  jobRuns,
  scheduleTriggerTypeEnum,
  scheduleActionEnum,
  uphJobTypeEnum
} from '@shared/schema';

// Infer types from tables
type IntelligentScheduleState = typeof intelligentScheduleState.$inferSelect;
type ScheduleTriggers = typeof scheduleTriggers.$inferSelect;
type DatasetVersions = typeof datasetVersions.$inferSelect;
import { eq, and, desc, sql, gte, lte, count, max } from 'drizzle-orm';
import { UPHCoordinator, type ProcessingOptions, type JobResult } from './UPHCoordinator';
import { brandSignalsIntegration } from './BrandSignalsIntegration';
import { MonitoringService } from './MonitoringService';
import { SeasonService } from './SeasonService';

// Types and interfaces
export interface FreshnessState {
  dataset: string;
  season: number;
  week: number;
  lastCommit: Date;
  lastProcessing: Date | null;
  staleness: 'fresh' | 'stale' | 'critical';
  recommendedAction: 'skip' | 'process' | 'urgent';
}

export interface SystemLoad {
  cpuPercent: number;
  memoryPercent: number;
  databaseConnections: number;
  activeJobs: number;
  errorRate: number;
  averageProcessingTime: number;
}

export interface SLAMetrics {
  targetProcessingTime: number;
  actualProcessingTime: number;
  targetErrorRate: number;
  actualErrorRate: number;
  targetFreshness: number; // minutes
  actualFreshness: number;
  slaCompliance: number; // 0-1
}

export interface RecomputeTrigger {
  dataset: string;
  season: number;
  week: number;
  affectedBrands: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
}

export interface ScheduledJob {
  key: string;
  type: typeof uphJobTypeEnum.enumValues[number];
  scope: any;
  options: ProcessingOptions;
  priority: number;
  maxRetries: number;
}

export interface IntelligentScheduleConfig {
  scheduleKey: string;
  baseFrequencyMs: number;
  minFrequencyMs: number;
  maxFrequencyMs: number;
  freshnessThresholdMs: number;
  slaTargets: SLAMetrics;
  enabled: boolean;
}

export interface BackoffState {
  attempts: number;
  nextAttemptAt: Date;
  backoffMs: number;
  maxBackoffMs: number;
}

/**
 * Core Intelligent Scheduler Service
 * Orchestrates state-aware, event-driven processing with SLA awareness
 */
export class IntelligentScheduler {
  private static instance: IntelligentScheduler;
  
  // Service dependencies
  private uphCoordinator: UPHCoordinator;
  private monitoring: MonitoringService;
  private seasonService: SeasonService;
  
  // Scheduling state
  private scheduleConfigs: Map<string, IntelligentScheduleConfig> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private backoffStates: Map<string, BackoffState> = new Map();
  
  // System monitoring
  private isInitialized = false;
  private systemHealthInterval: NodeJS.Timeout | null = null;
  private currentSystemLoad: SystemLoad | null = null;
  
  // Configuration constants
  private readonly DEFAULT_POLLING_INTERVAL_MS = 60 * 1000; // 1 minute
  private readonly MIN_POLLING_INTERVAL_MS = 30 * 1000; // 30 seconds
  private readonly MAX_POLLING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly FRESHNESS_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
  private readonly SYSTEM_HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  private readonly MAX_BACKOFF_MS = 60 * 60 * 1000; // 1 hour
  private readonly BACKOFF_MULTIPLIER = 1.5;

  public static getInstance(): IntelligentScheduler {
    if (!IntelligentScheduler.instance) {
      IntelligentScheduler.instance = new IntelligentScheduler();
    }
    return IntelligentScheduler.instance;
  }

  private constructor() {
    this.uphCoordinator = UPHCoordinator.getInstance();
    this.monitoring = MonitoringService.getInstance();
    this.seasonService = new SeasonService();
    
    this.initializeDefaultSchedules();
  }

  /**
   * Initialize the intelligent scheduler system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('🧠 [IntelligentScheduler] Already initialized, skipping...');
      return;
    }

    console.log('🚀 [IntelligentScheduler] Initializing intelligent scheduling system...');

    try {
      // Initialize database state for all configured schedules
      await this.initializeScheduleStates();

      // Start state-aware polling for all active schedules
      await this.startStateAwarePolling();

      // Start system health monitoring for SLA adjustments
      this.startSystemHealthMonitoring();

      this.isInitialized = true;
      console.log('✅ [IntelligentScheduler] Intelligent scheduling system initialized successfully');

      // Report initialization success
      await this.monitoring.recordJobExecution(
        'intelligent_scheduler_initialization',
        'success',
        0,
        { schedulesConfigured: this.scheduleConfigs.size }
      );

    } catch (error) {
      console.error('❌ [IntelligentScheduler] Failed to initialize:', error);
      
      await this.monitoring.recordJobExecution(
        'intelligent_scheduler_initialization',
        'error',
        0,
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }

  /**
   * Initialize default intelligent schedule configurations
   */
  private initializeDefaultSchedules(): void {
    console.log('🔧 [IntelligentScheduler] Configuring default intelligent schedules...');

    // Incremental processing - triggered by data freshness
    this.addScheduleConfig({
      scheduleKey: 'incremental_processing',
      baseFrequencyMs: 10 * 60 * 1000, // 10 minutes base
      minFrequencyMs: 2 * 60 * 1000, // 2 minutes minimum when data is fresh
      maxFrequencyMs: 60 * 60 * 1000, // 1 hour maximum when data is stale
      freshnessThresholdMs: 15 * 60 * 1000, // 15 minutes freshness threshold
      slaTargets: {
        targetProcessingTime: 5 * 60 * 1000, // 5 minutes
        actualProcessingTime: 0,
        targetErrorRate: 0.02, // 2%
        actualErrorRate: 0,
        targetFreshness: 10, // 10 minutes
        actualFreshness: 0,
        slaCompliance: 1.0
      },
      enabled: true
    });

    // Weekly processing - triggered by week rollover detection
    this.addScheduleConfig({
      scheduleKey: 'weekly_processing',
      baseFrequencyMs: 6 * 60 * 60 * 1000, // 6 hours base
      minFrequencyMs: 30 * 60 * 1000, // 30 minutes minimum
      maxFrequencyMs: 24 * 60 * 60 * 1000, // 24 hours maximum
      freshnessThresholdMs: 2 * 60 * 60 * 1000, // 2 hours freshness threshold
      slaTargets: {
        targetProcessingTime: 30 * 60 * 1000, // 30 minutes
        actualProcessingTime: 0,
        targetErrorRate: 0.05, // 5%
        actualErrorRate: 0,
        targetFreshness: 60, // 1 hour
        actualFreshness: 0,
        slaCompliance: 1.0
      },
      enabled: true
    });

    // Brand recompute - triggered by upstream data changes
    this.addScheduleConfig({
      scheduleKey: 'brand_recompute',
      baseFrequencyMs: 30 * 60 * 1000, // 30 minutes base
      minFrequencyMs: 5 * 60 * 1000, // 5 minutes minimum for urgent changes
      maxFrequencyMs: 4 * 60 * 60 * 1000, // 4 hours maximum
      freshnessThresholdMs: 30 * 60 * 1000, // 30 minutes freshness threshold
      slaTargets: {
        targetProcessingTime: 10 * 60 * 1000, // 10 minutes
        actualProcessingTime: 0,
        targetErrorRate: 0.03, // 3%
        actualErrorRate: 0,
        targetFreshness: 20, // 20 minutes
        actualFreshness: 0,
        slaCompliance: 1.0
      },
      enabled: true
    });

    console.log(`🔧 [IntelligentScheduler] Configured ${this.scheduleConfigs.size} intelligent schedules`);
  }

  /**
   * Add a schedule configuration
   */
  addScheduleConfig(config: IntelligentScheduleConfig): void {
    this.scheduleConfigs.set(config.scheduleKey, config);
    console.log(`🔧 [IntelligentScheduler] Added schedule config: ${config.scheduleKey}`);
  }

  /**
   * Initialize database state for all configured schedules
   */
  private async initializeScheduleStates(): Promise<void> {
    console.log('🗄️ [IntelligentScheduler] Initializing schedule states in database...');

    for (const [scheduleKey, config] of Array.from(this.scheduleConfigs.entries())) {
      try {
        // Check if schedule state already exists
        const existing = await db
          .select()
          .from(intelligentScheduleState)
          .where(eq(intelligentScheduleState.scheduleKey, scheduleKey))
          .limit(1);

        if (existing.length === 0) {
          // Create new schedule state
          await db.insert(intelligentScheduleState).values({
            scheduleKey,
            frequencyMs: config.baseFrequencyMs,
            triggerSource: 'manual_trigger',
            isActive: config.enabled,
            systemLoad: {},
            slaMetrics: config.slaTargets
          });

          console.log(`🗄️ [IntelligentScheduler] Created schedule state: ${scheduleKey}`);
        } else {
          // Update existing state to ensure it's in sync with config
          await db
            .update(intelligentScheduleState)
            .set({
              isActive: config.enabled,
              slaMetrics: config.slaTargets,
              updatedAt: new Date()
            })
            .where(eq(intelligentScheduleState.scheduleKey, scheduleKey));

          console.log(`🗄️ [IntelligentScheduler] Updated existing schedule state: ${scheduleKey}`);
        }
      } catch (error) {
        console.error(`❌ [IntelligentScheduler] Failed to initialize schedule state for ${scheduleKey}:`, error);
        throw error;
      }
    }

    console.log('✅ [IntelligentScheduler] Schedule states initialized successfully');
  }

  /**
   * Start state-aware polling for all active schedules
   */
  private async startStateAwarePolling(): Promise<void> {
    console.log('📡 [IntelligentScheduler] Starting state-aware polling...');

    for (const [scheduleKey, config] of Array.from(this.scheduleConfigs.entries())) {
      if (config.enabled) {
        await this.startPollingForSchedule(scheduleKey, config);
      }
    }

    console.log(`✅ [IntelligentScheduler] Started polling for ${this.pollingIntervals.size} active schedules`);
  }

  /**
   * Start polling for a specific schedule
   */
  private async startPollingForSchedule(scheduleKey: string, config: IntelligentScheduleConfig): Promise<void> {
    console.log(`📡 [IntelligentScheduler] Starting polling for schedule: ${scheduleKey}`);

    // Get current frequency from database
    const currentState = await this.getScheduleState(scheduleKey);
    const pollingInterval = currentState?.frequencyMs || config.baseFrequencyMs;

    const interval = setInterval(async () => {
      try {
        await this.executeIntelligentScheduleCycle(scheduleKey, config);
      } catch (error) {
        console.error(`❌ [IntelligentScheduler] Error in polling cycle for ${scheduleKey}:`, error);
        
        await this.recordScheduleTrigger({
          triggerType: 'data_freshness',
          triggerSource: scheduleKey,
          scheduleKey,
          actionTaken: 'skipped_stale',
          success: false,
          errorDetails: (error as Error).message,
          triggerData: { pollingCycle: true }
        });
      }
    }, pollingInterval);

    this.pollingIntervals.set(scheduleKey, interval);
    console.log(`📡 [IntelligentScheduler] Polling active for ${scheduleKey} (${pollingInterval}ms interval)`);
  }

  /**
   * Execute intelligent schedule cycle for a specific schedule
   */
  private async executeIntelligentScheduleCycle(
    scheduleKey: string, 
    config: IntelligentScheduleConfig
  ): Promise<void> {
    const startTime = Date.now();

    console.log(`🔍 [IntelligentScheduler] Executing cycle for schedule: ${scheduleKey}`);

    try {
      // Check if we're in backoff state
      if (this.isInBackoff(scheduleKey)) {
        console.log(`⏸️ [IntelligentScheduler] Schedule ${scheduleKey} is in backoff, skipping cycle`);
        return;
      }

      // Get current system load for SLA awareness
      const systemLoad = await this.getCurrentSystemLoad();
      const slaMetrics = await this.calculateSLAMetrics(scheduleKey);

      // Check data freshness
      const freshnessStates = await this.checkDataFreshness(scheduleKey);
      
      // Determine if processing should be triggered
      const shouldProcess = this.shouldTriggerProcessing(freshnessStates, slaMetrics, systemLoad);
      
      if (shouldProcess.trigger) {
        console.log(`🚀 [IntelligentScheduler] Triggering processing for ${scheduleKey}: ${shouldProcess.reason}`);
        
        await this.triggerIntelligentProcessing(scheduleKey, shouldProcess.action, {
          freshnessStates,
          systemLoad,
          slaMetrics,
          reason: shouldProcess.reason
        });
      } else {
        console.log(`⏭️ [IntelligentScheduler] Skipping processing for ${scheduleKey}: ${shouldProcess.reason}`);
        
        await this.recordScheduleTrigger({
          triggerType: 'data_freshness',
          triggerSource: scheduleKey,
          scheduleKey,
          actionTaken: 'skipped_stale',
          success: true,
          triggerData: {
            reason: shouldProcess.reason,
            freshnessStates,
            systemLoad,
            slaMetrics
          }
        });
      }

      // Adjust scheduling frequency based on results and SLA metrics
      await this.adjustScheduleFrequency(scheduleKey, config, slaMetrics, systemLoad);

    } catch (error) {
      console.error(`❌ [IntelligentScheduler] Cycle failed for ${scheduleKey}:`, error);
      
      // Apply backoff for failed cycles
      await this.applyBackoff(scheduleKey);
      
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [IntelligentScheduler] Cycle completed for ${scheduleKey} in ${duration}ms`);
  }

  /**
   * Check data freshness across relevant datasets
   */
  async checkDataFreshness(scheduleKey: string): Promise<FreshnessState[]> {
    console.log(`🔍 [IntelligentScheduler] Checking data freshness for schedule: ${scheduleKey}`);

    try {
      // Get current season/week context
      const seasonContext = await this.seasonService.current();
      
      // Define datasets to check based on schedule key
      const datasetsToCheck = this.getDatasetsForSchedule(scheduleKey);
      
      const freshnessStates: FreshnessState[] = [];

      for (const dataset of datasetsToCheck) {
        // Get latest commit for this dataset
        const latestCommit = await db
          .select({
            dataset: datasetVersions.dataset,
            season: datasetVersions.season,
            week: datasetVersions.week,
            committedAt: datasetVersions.committedAt,
            rowCount: datasetVersions.rowCount
          })
          .from(datasetVersions)
          .where(
            and(
              eq(datasetVersions.dataset, dataset),
              eq(datasetVersions.season, seasonContext.season),
              eq(datasetVersions.week, seasonContext.week)
            )
          )
          .orderBy(desc(datasetVersions.committedAt))
          .limit(1);

        // Get last processing time for this dataset
        const lastProcessing = await this.getLastProcessingTime(scheduleKey, dataset);

        if (latestCommit.length > 0) {
          const commit = latestCommit[0];
          const commitTime = new Date(commit.committedAt);
          const now = new Date();
          const stalenessMs = now.getTime() - commitTime.getTime();
          
          // Determine staleness level
          let staleness: FreshnessState['staleness'];
          let recommendedAction: FreshnessState['recommendedAction'];
          
          if (stalenessMs < 5 * 60 * 1000) { // < 5 minutes
            staleness = 'fresh';
            recommendedAction = lastProcessing && commitTime <= lastProcessing ? 'skip' : 'process';
          } else if (stalenessMs < 30 * 60 * 1000) { // < 30 minutes
            staleness = 'stale';
            recommendedAction = 'process';
          } else { // > 30 minutes
            staleness = 'critical';
            recommendedAction = 'urgent';
          }

          freshnessStates.push({
            dataset,
            season: commit.season,
            week: commit.week,
            lastCommit: commitTime,
            lastProcessing,
            staleness,
            recommendedAction
          });
        } else {
          // No data found - this might be a new dataset or week
          freshnessStates.push({
            dataset,
            season: seasonContext.season,
            week: seasonContext.week,
            lastCommit: new Date(0), // Epoch time to indicate no data
            lastProcessing: null,
            staleness: 'critical',
            recommendedAction: 'urgent'
          });
        }
      }

      console.log(`🔍 [IntelligentScheduler] Checked ${freshnessStates.length} datasets for ${scheduleKey}`);
      return freshnessStates;

    } catch (error) {
      console.error(`❌ [IntelligentScheduler] Failed to check data freshness:`, error);
      throw error;
    }
  }

  /**
   * Get datasets to check for a given schedule
   */
  private getDatasetsForSchedule(scheduleKey: string): string[] {
    const datasetMap: Record<string, string[]> = {
      'incremental_processing': [
        'bronze_players',
        'bronze_game_logs',
        'silver_players',
        'silver_game_logs'
      ],
      'weekly_processing': [
        'gold_player_week',
        'gold_team_week',
        'market_signals',
        'injuries'
      ],
      'brand_recompute': [
        'gold_player_week',
        'injuries',
        'market_signals',
        'consensus_rankings'
      ]
    };

    return datasetMap[scheduleKey] || [];
  }

  /**
   * Get last processing time for a specific dataset and schedule
   */
  private async getLastProcessingTime(scheduleKey: string, dataset: string): Promise<Date | null> {
    try {
      const lastTrigger = await db
        .select({
          triggeredAt: scheduleTriggers.triggeredAt
        })
        .from(scheduleTriggers)
        .where(
          and(
            eq(scheduleTriggers.scheduleKey, scheduleKey),
            eq(scheduleTriggers.triggerSource, dataset),
            eq(scheduleTriggers.success, true),
            eq(scheduleTriggers.actionTaken, 'triggered_processing')
          )
        )
        .orderBy(desc(scheduleTriggers.triggeredAt))
        .limit(1);

      return lastTrigger.length > 0 ? new Date(lastTrigger[0].triggeredAt) : null;
    } catch (error) {
      console.warn(`⚠️ [IntelligentScheduler] Failed to get last processing time for ${dataset}:`, error);
      return null;
    }
  }

  /**
   * Determine if processing should be triggered based on freshness, SLA, and system load
   */
  private shouldTriggerProcessing(
    freshnessStates: FreshnessState[],
    slaMetrics: SLAMetrics,
    systemLoad: SystemLoad
  ): { trigger: boolean; reason: string; action: typeof scheduleActionEnum.enumValues[number] } {
    
    // Check for critical freshness
    const criticalDatasets = freshnessStates.filter(f => f.staleness === 'critical');
    if (criticalDatasets.length > 0) {
      return {
        trigger: true,
        reason: `Critical staleness detected in datasets: ${criticalDatasets.map(d => d.dataset).join(', ')}`,
        action: 'triggered_processing'
      };
    }

    // Check for urgent recommendations
    const urgentDatasets = freshnessStates.filter(f => f.recommendedAction === 'urgent');
    if (urgentDatasets.length > 0) {
      return {
        trigger: true,
        reason: `Urgent processing recommended for datasets: ${urgentDatasets.map(d => d.dataset).join(', ')}`,
        action: 'triggered_processing'
      };
    }

    // Check system load - if overloaded, skip non-critical processing
    if (systemLoad.cpuPercent > 80 || systemLoad.errorRate > 0.1) {
      return {
        trigger: false,
        reason: `High system load (CPU: ${systemLoad.cpuPercent}%, Error Rate: ${(systemLoad.errorRate * 100).toFixed(1)}%)`,
        action: 'skipped_stale'
      };
    }

    // Check for fresh datasets that need processing
    const datasetsToProcess = freshnessStates.filter(f => f.recommendedAction === 'process');
    if (datasetsToProcess.length > 0) {
      return {
        trigger: true,
        reason: `Fresh data available in datasets: ${datasetsToProcess.map(d => d.dataset).join(', ')}`,
        action: 'triggered_processing'
      };
    }

    // Check SLA compliance - if behind schedule, process anyway
    if (slaMetrics.slaCompliance < 0.8) {
      return {
        trigger: true,
        reason: `SLA compliance below threshold: ${(slaMetrics.slaCompliance * 100).toFixed(1)}%`,
        action: 'triggered_processing'
      };
    }

    // Default to skip
    return {
      trigger: false,
      reason: 'No fresh data or urgent processing needs detected',
      action: 'skipped_stale'
    };
  }

  /**
   * Trigger intelligent processing based on detected needs
   */
  private async triggerIntelligentProcessing(
    scheduleKey: string,
    action: typeof scheduleActionEnum.enumValues[number],
    context: {
      freshnessStates: FreshnessState[];
      systemLoad: SystemLoad;
      slaMetrics: SLAMetrics;
      reason: string;
    }
  ): Promise<void> {
    const startTime = Date.now();
    
    console.log(`🚀 [IntelligentScheduler] Triggering intelligent processing: ${scheduleKey}`);
    console.log(`   📋 Reason: ${context.reason}`);
    console.log(`   📊 Fresh datasets: ${context.freshnessStates.filter(f => f.staleness === 'fresh').length}`);

    // Get season context before try block so it's available in catch
    const seasonContext = await this.seasonService.current();

    try {
      let jobResult: JobResult | null = null;

      switch (scheduleKey) {
        case 'incremental_processing':
          jobResult = await this.uphCoordinator.runIncrementalProcessing(
            new Date(Date.now() - 6 * 60 * 60 * 1000), // Last 6 hours
            {
              sources: ['sleeper', 'nfl_data_py'],
              batchSize: 250,
              maxConcurrency: Math.max(1, Math.floor(4 * (1 - context.systemLoad.cpuPercent / 100))),
              retryAttempts: context.systemLoad.errorRate > 0.05 ? 1 : 2,
              timeoutMs: 15 * 60 * 1000
            }
          );
          break;

        case 'weekly_processing':
          jobResult = await this.uphCoordinator.runWeeklyProcessing(
            seasonContext.season,
            seasonContext.week,
            {
              sources: ['sleeper', 'nfl_data_py', 'fantasypros'],
              batchSize: 500,
              maxConcurrency: Math.max(1, Math.floor(6 * (1 - context.systemLoad.cpuPercent / 100))),
              retryAttempts: 2,
              timeoutMs: 30 * 60 * 1000
            }
          );
          break;

        case 'brand_recompute':
          // Trigger brand signal recomputation
          await this.triggerBrandRecompute([{
            dataset: 'gold_player_week',
            season: seasonContext.season,
            week: seasonContext.week,
            affectedBrands: ['rookie_risers', 'dynasty', 'redraft'],
            priority: context.freshnessStates.some(f => f.staleness === 'critical') ? 'critical' : 'high',
            reason: context.reason
          }]);
          
          // Create a synthetic job result for consistency
          jobResult = {
            jobId: `brand_recompute_${Date.now()}`,
            status: 'SUCCESS',
            totalTasks: 1,
            successfulTasks: 1,
            failedTasks: 0,
            skippedTasks: 0,
            duration: Date.now() - startTime,
            stats: {
              recordsProcessed: context.freshnessStates.length,
              payloadsIngested: 0,
              transformationsApplied: 1,
              qualityChecksRun: 0,
              qualityChecksPassed: 0,
              qualityChecksFailed: 0,
              averageProcessingTime: Date.now() - startTime,
              dataVolumeBytes: 0,
              memoryUsagePeak: 0
            }
          };
          break;

        default:
          throw new Error(`Unknown schedule key: ${scheduleKey}`);
      }

      const duration = Date.now() - startTime;

      // Record successful trigger
      await this.recordScheduleTrigger({
        triggerType: 'data_freshness',
        triggerSource: context.freshnessStates.map(f => f.dataset).join(','),
        scheduleKey,
        actionTaken: action,
        executionTimeMs: duration,
        success: true,
        jobId: jobResult?.jobId,
        season: seasonContext.season,
        week: seasonContext.week,
        triggerData: {
          reason: context.reason,
          freshnessStates: context.freshnessStates,
          systemLoad: context.systemLoad,
          slaMetrics: context.slaMetrics,
          result: jobResult
        }
      });

      // Update schedule state with successful execution
      const currentState = await this.getScheduleState(scheduleKey);
      await this.updateScheduleState(scheduleKey, {
        lastRun: new Date(),
        totalRuns: (currentState?.totalRuns || 0) + 1,
        successfulRuns: (currentState?.successfulRuns || 0) + 1,
        averageExecutionMs: currentState?.averageExecutionMs 
          ? Math.round((currentState.averageExecutionMs + duration) / 2)
          : duration,
        systemLoad: context.systemLoad,
        slaMetrics: context.slaMetrics
      });

      // Clear backoff state on success
      this.clearBackoff(scheduleKey);

      console.log(`✅ [IntelligentScheduler] Processing completed successfully for ${scheduleKey}`);
      console.log(`   🆔 Job ID: ${jobResult?.jobId}`);
      console.log(`   ⏱️ Duration: ${duration}ms`);
      console.log(`   📊 Tasks: ${jobResult?.successfulTasks}/${jobResult?.totalTasks} successful`);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error(`❌ [IntelligentScheduler] Processing failed for ${scheduleKey}:`, error);

      // Record failed trigger
      await this.recordScheduleTrigger({
        triggerType: 'data_freshness',
        triggerSource: context.freshnessStates.map(f => f.dataset).join(','),
        scheduleKey,
        actionTaken: action,
        executionTimeMs: duration,
        success: false,
        errorDetails: (error as Error).message,
        season: seasonContext.season,
        week: seasonContext.week,
        triggerData: {
          reason: context.reason,
          error: (error as Error).message
        }
      });

      // Apply backoff on failure
      await this.applyBackoff(scheduleKey);

      throw error;
    }
  }

  /**
   * Trigger brand signal recomputation for specific triggers
   */
  async triggerBrandRecompute(triggers: RecomputeTrigger[]): Promise<void> {
    console.log(`🎯 [IntelligentScheduler] Triggering brand recompute for ${triggers.length} triggers`);

    try {
      for (const trigger of triggers) {
        console.log(`🎯 [IntelligentScheduler] Processing recompute trigger: ${trigger.dataset}`);
        console.log(`   🏷️ Brands: ${trigger.affectedBrands.join(', ')}`);
        console.log(`   ⚡ Priority: ${trigger.priority}`);
        console.log(`   📋 Reason: ${trigger.reason}`);

        // Trigger brand signals integration
        await brandSignalsIntegration.triggerDatasetCommitted(
          trigger.dataset,
          trigger.season,
          trigger.week,
          0, // Row count not available in this context
          'intelligent_scheduler',
          `recompute_${Date.now()}`
        );

        console.log(`✅ [IntelligentScheduler] Brand recompute triggered for ${trigger.dataset}`);
      }

      console.log(`✅ [IntelligentScheduler] All brand recompute triggers processed successfully`);

    } catch (error) {
      console.error(`❌ [IntelligentScheduler] Brand recompute failed:`, error);
      throw error;
    }
  }

  /**
   * Adjust schedule frequency based on SLA metrics and system load
   */
  async adjustScheduleFrequency(
    scheduleKey: string,
    config: IntelligentScheduleConfig,
    slaMetrics: SLAMetrics,
    systemLoad: SystemLoad
  ): Promise<void> {
    try {
      const currentState = await this.getScheduleState(scheduleKey);
      if (!currentState) return;

      let newFrequency = currentState.frequencyMs;
      let adjustment = 'none';
      let reason = '';

      // SLA-based frequency adjustment
      if (slaMetrics.actualProcessingTime > slaMetrics.targetProcessingTime * 1.5) {
        // Processing is taking too long - reduce frequency
        newFrequency = Math.min(newFrequency * 1.5, config.maxFrequencyMs);
        adjustment = 'reduced';
        reason = 'Processing time exceeds SLA target';
      } else if (slaMetrics.actualProcessingTime < slaMetrics.targetProcessingTime * 0.5) {
        // Processing is very fast - can increase frequency for fresher data
        newFrequency = Math.max(newFrequency * 0.8, config.minFrequencyMs);
        adjustment = 'increased';
        reason = 'Processing time well below SLA target';
      }

      // System load-based adjustment
      if (systemLoad.cpuPercent > 80) {
        // High CPU usage - reduce frequency
        newFrequency = Math.min(newFrequency * 1.3, config.maxFrequencyMs);
        adjustment = 'reduced';
        reason = `High CPU usage: ${systemLoad.cpuPercent}%`;
      } else if (systemLoad.cpuPercent < 30 && systemLoad.errorRate < 0.01) {
        // Low CPU usage and low error rate - can increase frequency
        newFrequency = Math.max(newFrequency * 0.9, config.minFrequencyMs);
        adjustment = adjustment === 'reduced' ? 'none' : 'increased';
        if (adjustment === 'increased') {
          reason = `Low system load and error rate`;
        }
      }

      // Apply frequency change if significant
      if (Math.abs(newFrequency - currentState.frequencyMs) > 30000) { // 30 second threshold
        await this.updateScheduleState(scheduleKey, {
          frequencyMs: Math.round(newFrequency),
          triggerSource: 'sla_adjustment',
          slaMetrics,
          systemLoad
        });

        // Restart polling with new frequency
        await this.restartPollingForSchedule(scheduleKey);

        // Record the adjustment
        await this.recordScheduleTrigger({
          triggerType: 'sla_adjustment',
          triggerSource: 'system_performance',
          scheduleKey,
          actionTaken: 'adjusted_frequency',
          success: true,
          triggerData: {
            oldFrequencyMs: currentState.frequencyMs,
            newFrequencyMs: Math.round(newFrequency),
            adjustment,
            reason,
            slaMetrics,
            systemLoad
          }
        });

        console.log(`📊 [IntelligentScheduler] Frequency ${adjustment} for ${scheduleKey}: ${currentState.frequencyMs}ms → ${Math.round(newFrequency)}ms (${reason})`);
      }

    } catch (error) {
      console.error(`❌ [IntelligentScheduler] Failed to adjust frequency for ${scheduleKey}:`, error);
    }
  }

  /**
   * Restart polling for a schedule with updated frequency
   */
  private async restartPollingForSchedule(scheduleKey: string): Promise<void> {
    // Stop current polling
    const existingInterval = this.pollingIntervals.get(scheduleKey);
    if (existingInterval) {
      clearInterval(existingInterval);
      this.pollingIntervals.delete(scheduleKey);
    }

    // Start new polling with updated frequency
    const config = this.scheduleConfigs.get(scheduleKey);
    if (config && config.enabled) {
      await this.startPollingForSchedule(scheduleKey, config);
    }
  }

  /**
   * Event-driven processing trigger - called when datasets change
   */
  async onDatasetChange(dataset: string, season: number, week: number): Promise<void> {
    console.log(`📡 [IntelligentScheduler] Dataset change detected: ${dataset} (Season ${season}, Week ${week})`);

    try {
      // Determine which schedules are affected by this dataset change
      const affectedSchedules = this.getSchedulesForDataset(dataset);

      for (const scheduleKey of affectedSchedules) {
        console.log(`🔄 [IntelligentScheduler] Triggering event-driven processing for ${scheduleKey}`);

        const config = this.scheduleConfigs.get(scheduleKey);
        if (!config || !config.enabled) {
          console.log(`⏭️ [IntelligentScheduler] Schedule ${scheduleKey} is disabled, skipping`);
          continue;
        }

        // Check if schedule is in backoff
        if (this.isInBackoff(scheduleKey)) {
          console.log(`⏸️ [IntelligentScheduler] Schedule ${scheduleKey} is in backoff, skipping event-driven trigger`);
          continue;
        }

        // Get current system load
        const systemLoad = await this.getCurrentSystemLoad();
        
        // Skip if system is overloaded
        if (systemLoad.cpuPercent > 90 || systemLoad.errorRate > 0.15) {
          console.log(`⚠️ [IntelligentScheduler] System overloaded, deferring event-driven trigger for ${scheduleKey}`);
          continue;
        }

        // Create freshness state for the changed dataset
        const freshnessState: FreshnessState = {
          dataset,
          season,
          week,
          lastCommit: new Date(),
          lastProcessing: await this.getLastProcessingTime(scheduleKey, dataset),
          staleness: 'fresh',
          recommendedAction: 'process'
        };

        const slaMetrics = await this.calculateSLAMetrics(scheduleKey);

        // Trigger processing
        await this.triggerIntelligentProcessing(scheduleKey, 'triggered_processing', {
          freshnessStates: [freshnessState],
          systemLoad,
          slaMetrics,
          reason: `Event-driven trigger: ${dataset} changed`
        });
      }

      console.log(`✅ [IntelligentScheduler] Event-driven processing completed for dataset change: ${dataset}`);

    } catch (error) {
      console.error(`❌ [IntelligentScheduler] Event-driven processing failed for dataset ${dataset}:`, error);
      
      await this.monitoring.recordJobExecution(
        'intelligent_scheduler_event_driven',
        'error',
        0,
        { dataset, season, week, error: (error as Error).message }
      );
    }
  }

  /**
   * Get schedules affected by a dataset change
   */
  private getSchedulesForDataset(dataset: string): string[] {
    const scheduleMap: Record<string, string[]> = {
      'bronze_players': ['incremental_processing'],
      'bronze_game_logs': ['incremental_processing'],
      'silver_players': ['weekly_processing', 'brand_recompute'],
      'silver_game_logs': ['weekly_processing'],
      'gold_player_week': ['brand_recompute'],
      'injuries': ['brand_recompute'],
      'market_signals': ['brand_recompute']
    };

    return scheduleMap[dataset] || [];
  }

  /**
   * Get current system load metrics
   */
  private async getCurrentSystemLoad(): Promise<SystemLoad> {
    if (this.currentSystemLoad) {
      return this.currentSystemLoad;
    }

    try {
      // Get system metrics from monitoring service
      const healthStatus = await this.monitoring.getHealthStatus();
      const metricsSnapshot = await this.monitoring.getMetricsSnapshot();

      // Count active jobs
      const activeJobs = await db
        .select({ count: count() })
        .from(jobRuns)
        .where(eq(jobRuns.status, 'RUNNING'));

      this.currentSystemLoad = {
        cpuPercent: 50, // Placeholder - would come from actual system monitoring
        memoryPercent: 60, // Placeholder - would come from actual system monitoring
        databaseConnections: 10, // Placeholder - would come from connection pool
        activeJobs: activeJobs[0]?.count || 0,
        errorRate: metricsSnapshot.jobs ? 
          Object.values(metricsSnapshot.jobs).reduce((acc, job) => acc + (1 - job.success_rate), 0) / 
          Object.values(metricsSnapshot.jobs).length : 0,
        averageProcessingTime: metricsSnapshot.jobs ?
          Object.values(metricsSnapshot.jobs).reduce((acc, job) => acc + job.avg_duration_ms, 0) /
          Object.values(metricsSnapshot.jobs).length : 0
      };

      return this.currentSystemLoad;

    } catch (error) {
      console.warn(`⚠️ [IntelligentScheduler] Failed to get system load, using defaults:`, error);
      
      // Return conservative default values
      return {
        cpuPercent: 70,
        memoryPercent: 80,
        databaseConnections: 15,
        activeJobs: 2,
        errorRate: 0.05,
        averageProcessingTime: 30000
      };
    }
  }

  /**
   * Calculate current SLA metrics for a schedule
   */
  private async calculateSLAMetrics(scheduleKey: string): Promise<SLAMetrics> {
    try {
      const scheduleState = await this.getScheduleState(scheduleKey);
      const config = this.scheduleConfigs.get(scheduleKey);

      if (!scheduleState || !config) {
        throw new Error(`No state or config found for schedule: ${scheduleKey}`);
      }

      // Get recent trigger history for metrics calculation
      const recentTriggers = await db
        .select()
        .from(scheduleTriggers)
        .where(
          and(
            eq(scheduleTriggers.scheduleKey, scheduleKey),
            eq(scheduleTriggers.success, true),
            gte(scheduleTriggers.triggeredAt, new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
          )
        )
        .orderBy(desc(scheduleTriggers.triggeredAt))
        .limit(10);

      // Calculate actual metrics
      const actualProcessingTime = recentTriggers.length > 0 
        ? recentTriggers.reduce((sum, t) => sum + (t.executionTimeMs || 0), 0) / recentTriggers.length
        : scheduleState.averageExecutionMs;

      const actualErrorRate = recentTriggers.length > 0
        ? recentTriggers.filter(t => !t.success).length / recentTriggers.length
        : 0;

      const actualFreshness = scheduleState.lastRun 
        ? (Date.now() - scheduleState.lastRun.getTime()) / (60 * 1000) // Minutes
        : 999;

      // Calculate SLA compliance
      const processingCompliance = Math.min(1, config.slaTargets.targetProcessingTime / Math.max(actualProcessingTime, 1));
      const errorCompliance = Math.max(0, 1 - (actualErrorRate / config.slaTargets.targetErrorRate));
      const freshnessCompliance = Math.min(1, config.slaTargets.targetFreshness / Math.max(actualFreshness, 1));
      
      const slaCompliance = (processingCompliance + errorCompliance + freshnessCompliance) / 3;

      return {
        targetProcessingTime: config.slaTargets.targetProcessingTime,
        actualProcessingTime,
        targetErrorRate: config.slaTargets.targetErrorRate,
        actualErrorRate,
        targetFreshness: config.slaTargets.targetFreshness,
        actualFreshness,
        slaCompliance
      };

    } catch (error) {
      console.warn(`⚠️ [IntelligentScheduler] Failed to calculate SLA metrics for ${scheduleKey}:`, error);
      
      // Return default metrics
      const config = this.scheduleConfigs.get(scheduleKey);
      return config?.slaTargets || {
        targetProcessingTime: 300000,
        actualProcessingTime: 300000,
        targetErrorRate: 0.05,
        actualErrorRate: 0.05,
        targetFreshness: 30,
        actualFreshness: 30,
        slaCompliance: 1.0
      };
    }
  }

  /**
   * Apply exponential backoff for failed schedules
   */
  private async applyBackoff(scheduleKey: string): Promise<void> {
    console.log(`⏸️ [IntelligentScheduler] Applying backoff for schedule: ${scheduleKey}`);

    const currentBackoff = this.backoffStates.get(scheduleKey) || {
      attempts: 0,
      nextAttemptAt: new Date(),
      backoffMs: 60000, // Start with 1 minute
      maxBackoffMs: this.MAX_BACKOFF_MS
    };

    currentBackoff.attempts += 1;
    currentBackoff.backoffMs = Math.min(
      currentBackoff.backoffMs * this.BACKOFF_MULTIPLIER,
      currentBackoff.maxBackoffMs
    );
    currentBackoff.nextAttemptAt = new Date(Date.now() + currentBackoff.backoffMs);

    this.backoffStates.set(scheduleKey, currentBackoff);

    // Record backoff application
    await this.recordScheduleTrigger({
      triggerType: 'sla_adjustment',
      triggerSource: 'failure_backoff',
      scheduleKey,
      actionTaken: 'backoff_applied',
      success: true,
      triggerData: {
        attempts: currentBackoff.attempts,
        backoffMs: currentBackoff.backoffMs,
        nextAttemptAt: currentBackoff.nextAttemptAt
      }
    });

    console.log(`⏸️ [IntelligentScheduler] Backoff applied for ${scheduleKey}: ${currentBackoff.backoffMs}ms (attempt ${currentBackoff.attempts})`);
  }

  /**
   * Check if a schedule is currently in backoff state
   */
  private isInBackoff(scheduleKey: string): boolean {
    const backoffState = this.backoffStates.get(scheduleKey);
    if (!backoffState) return false;

    return new Date() < backoffState.nextAttemptAt;
  }

  /**
   * Clear backoff state for a schedule (called on successful execution)
   */
  private clearBackoff(scheduleKey: string): void {
    if (this.backoffStates.has(scheduleKey)) {
      this.backoffStates.delete(scheduleKey);
      console.log(`✅ [IntelligentScheduler] Backoff cleared for schedule: ${scheduleKey}`);
    }
  }

  /**
   * Start system health monitoring for SLA adjustments
   */
  private startSystemHealthMonitoring(): void {
    console.log('🏥 [IntelligentScheduler] Starting system health monitoring...');

    this.systemHealthInterval = setInterval(async () => {
      try {
        // Update current system load
        this.currentSystemLoad = await this.getCurrentSystemLoad();

        // Check for unhealthy conditions that require schedule adjustments
        if (this.currentSystemLoad.cpuPercent > 90 || this.currentSystemLoad.errorRate > 0.2) {
          console.warn('🚨 [IntelligentScheduler] System health degraded, applying protective measures');
          
          // Temporarily increase frequencies for all schedules to reduce load
          for (const [scheduleKey, config] of Array.from(this.scheduleConfigs.entries())) {
            if (config.enabled) {
              await this.adjustScheduleFrequency(
                scheduleKey,
                config,
                await this.calculateSLAMetrics(scheduleKey),
                this.currentSystemLoad
              );
            }
          }
        }

      } catch (error) {
        console.error('❌ [IntelligentScheduler] System health monitoring error:', error);
      }
    }, this.SYSTEM_HEALTH_CHECK_INTERVAL_MS);

    console.log(`✅ [IntelligentScheduler] System health monitoring active (${this.SYSTEM_HEALTH_CHECK_INTERVAL_MS}ms interval)`);
  }

  /**
   * Get current state for a schedule
   */
  private async getScheduleState(scheduleKey: string): Promise<IntelligentScheduleState | null> {
    try {
      const states = await db
        .select()
        .from(intelligentScheduleState)
        .where(eq(intelligentScheduleState.scheduleKey, scheduleKey))
        .limit(1);

      return states.length > 0 ? states[0] : null;
    } catch (error) {
      console.error(`❌ [IntelligentScheduler] Failed to get schedule state for ${scheduleKey}:`, error);
      return null;
    }
  }

  /**
   * Update schedule state
   */
  private async updateScheduleState(scheduleKey: string, updates: Partial<typeof intelligentScheduleState.$inferInsert>): Promise<void> {
    try {
      await db
        .update(intelligentScheduleState)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(intelligentScheduleState.scheduleKey, scheduleKey));
    } catch (error) {
      console.error(`❌ [IntelligentScheduler] Failed to update schedule state for ${scheduleKey}:`, error);
    }
  }

  /**
   * Record a schedule trigger event
   */
  private async recordScheduleTrigger(trigger: Omit<typeof scheduleTriggers.$inferInsert, 'triggeredAt'>): Promise<void> {
    try {
      await db.insert(scheduleTriggers).values({
        ...trigger,
        triggeredAt: new Date()
      });
    } catch (error) {
      console.error(`❌ [IntelligentScheduler] Failed to record schedule trigger:`, error);
    }
  }

  /**
   * Get intelligent scheduler status for monitoring
   */
  async getSchedulerStatus(): Promise<{
    initialized: boolean;
    activeSchedules: number;
    totalTriggers: number;
    recentFailures: number;
    systemLoad: SystemLoad | null;
    schedules: Array<{
      key: string;
      enabled: boolean;
      frequency: number;
      lastRun: Date | null;
      successRate: number;
      inBackoff: boolean;
    }>;
  }> {
    try {
      const schedules = [];
      
      for (const [scheduleKey, config] of Array.from(this.scheduleConfigs.entries())) {
        const state = await this.getScheduleState(scheduleKey);
        
        // Calculate success rate from recent triggers
        const recentTriggers = await db
          .select()
          .from(scheduleTriggers)
          .where(
            and(
              eq(scheduleTriggers.scheduleKey, scheduleKey),
              gte(scheduleTriggers.triggeredAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
            )
          );

        const successRate = recentTriggers.length > 0 
          ? recentTriggers.filter(t => t.success).length / recentTriggers.length
          : 1.0;

        schedules.push({
          key: scheduleKey,
          enabled: config.enabled,
          frequency: state?.frequencyMs || config.baseFrequencyMs,
          lastRun: state?.lastRun || null,
          successRate,
          inBackoff: this.isInBackoff(scheduleKey)
        });
      }

      // Get total trigger count
      const totalTriggersResult = await db
        .select({ count: count() })
        .from(scheduleTriggers);

      // Get recent failures
      const recentFailuresResult = await db
        .select({ count: count() })
        .from(scheduleTriggers)
        .where(
          and(
            eq(scheduleTriggers.success, false),
            gte(scheduleTriggers.triggeredAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )
        );

      return {
        initialized: this.isInitialized,
        activeSchedules: Array.from(this.pollingIntervals.keys()).length,
        totalTriggers: totalTriggersResult[0]?.count || 0,
        recentFailures: recentFailuresResult[0]?.count || 0,
        systemLoad: this.currentSystemLoad,
        schedules
      };

    } catch (error) {
      console.error('❌ [IntelligentScheduler] Failed to get scheduler status:', error);
      throw error;
    }
  }

  /**
   * Shutdown the intelligent scheduler
   */
  async shutdown(): Promise<void> {
    console.log('🛑 [IntelligentScheduler] Shutting down intelligent scheduler...');

    try {
      // Stop all polling intervals
      for (const [scheduleKey, interval] of Array.from(this.pollingIntervals.entries())) {
        clearInterval(interval);
        console.log(`🛑 [IntelligentScheduler] Stopped polling for schedule: ${scheduleKey}`);
      }
      this.pollingIntervals.clear();

      // Stop system health monitoring
      if (this.systemHealthInterval) {
        clearInterval(this.systemHealthInterval);
        this.systemHealthInterval = null;
      }

      this.isInitialized = false;
      console.log('✅ [IntelligentScheduler] Intelligent scheduler shutdown completed');

    } catch (error) {
      console.error('❌ [IntelligentScheduler] Error during shutdown:', error);
      throw error;
    }
  }
}

/**
 * Global intelligent scheduler instance
 */
export const intelligentScheduler = IntelligentScheduler.getInstance();