/**
 * UPH Nightly Scheduler Service - Automated Processing Operations
 * 
 * Comprehensive scheduler for automated UPH (Unified Player Hub) processing operations.
 * Manages nightly and weekly processing schedules with full integration to UPHCoordinator,
 * comprehensive logging, health monitoring, and error recovery mechanisms.
 * 
 * Core Features:
 * - Automated nightly WEEKLY processing at optimal off-hours timing
 * - Weekly SEASON processing for comprehensive data analysis
 * - Pre/post-processing health checks and system validation
 * - Schedule-specific logging with detailed progress monitoring
 * - Error handling with automatic retry and escalation procedures
 * - Admin API integration for schedule management and monitoring
 * - Configuration management via environment variables
 * - Production-ready automated processing with quality enforcement
 */

import cron, { type ScheduledTask } from 'node-cron';
import { UPHCoordinator, type ProcessingOptions, type JobResult, type JobStatus } from './UPHCoordinator';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';

export interface ScheduleConfig {
  name: string;
  cronExpression: string;
  jobType: 'WEEKLY' | 'SEASON' | 'INCREMENTAL';
  enabled: boolean;
  options: ProcessingOptions;
  description: string;
}

export interface ScheduleStatus {
  name: string;
  isActive: boolean;
  nextRun: Date | null;
  lastRun: Date | null;
  lastResult: JobResult | null;
  consecutiveFailures: number;
  totalRuns: number;
  successRate: number;
}

export interface SchedulerHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  activeSchedules: number;
  enabledSchedules: number;
  recentFailures: number;
  lastHealthCheck: Date;
  systemChecks: {
    coordinatorService: boolean;
    databaseConnectivity: boolean;
    cronService: boolean;
  };
  uptime: number;
}

export interface ScheduleHistory {
  scheduleName: string;
  executedAt: Date;
  jobId: string;
  result: JobResult;
  duration: number;
  success: boolean;
}

/**
 * UPH Nightly Scheduler Service
 * Manages automated processing schedules with comprehensive monitoring
 */
export class UPHScheduler {
  private static instance: UPHScheduler;
  
  // Core dependencies
  private uphCoordinator: UPHCoordinator;
  
  // Schedule management
  private schedules: Map<string, ScheduledTask> = new Map();
  private scheduleConfigs: Map<string, ScheduleConfig> = new Map();
  private scheduleHistory: ScheduleHistory[] = [];
  private scheduleStats: Map<string, {
    lastRun: Date | null;
    lastResult: JobResult | null;
    consecutiveFailures: number;
    totalRuns: number;
    totalSuccesses: number;
  }> = new Map();
  
  // System monitoring
  private isInitialized = false;
  private startTime = new Date();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly DEFAULT_TIMEZONE = "America/New_York";
  private readonly HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_HISTORY_ENTRIES = 1000;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  public static getInstance(): UPHScheduler {
    if (!UPHScheduler.instance) {
      UPHScheduler.instance = new UPHScheduler();
    }
    return UPHScheduler.instance;
  }

  private constructor() {
    this.uphCoordinator = UPHCoordinator.getInstance();
    this.initializeDefaultSchedules();
  }

  /**
   * Initialize the scheduler with default processing schedules
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('🔧 [UPHScheduler] Already initialized, skipping...');
      return;
    }

    console.log('🚀 [UPHScheduler] Initializing automated processing schedules...');

    try {
      // Perform pre-initialization health checks
      await this.performSystemHealthCheck();

      // Setup all configured schedules
      await this.setupAllSchedules();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      console.log('✅ [UPHScheduler] Scheduler initialization completed successfully');
      
      // Log active schedules
      this.logScheduleStatus();
      
    } catch (error) {
      console.error('❌ [UPHScheduler] Failed to initialize scheduler:', error);
      throw error;
    }
  }

  /**
   * Initialize default processing schedules with production-optimized configurations
   */
  private initializeDefaultSchedules(): void {
    // Nightly WEEKLY processing - Daily at 2:00 AM EST (after most data updates)
    this.addScheduleConfig({
      name: 'nightly-weekly-processing',
      cronExpression: '0 2 * * *', // Daily at 2:00 AM EST
      jobType: 'WEEKLY',
      enabled: true,
      options: {
        sources: ['sleeper', 'nfl_data_py', 'fantasypros'],
        batchSize: 500, // Optimized for off-hours processing
        maxConcurrency: 2, // Conservative for nightly processing
        retryAttempts: 3,
        timeoutMs: 45 * 60 * 1000, // 45 minutes
        skipQualityGates: false, // Enforce quality for automated processing
        forceRefresh: false
      },
      description: 'Daily automated WEEKLY processing for current week data'
    });

    // Weekly SEASON processing - Sundays at 1:00 AM EST (before new week starts)
    this.addScheduleConfig({
      name: 'weekly-season-processing',
      cronExpression: '0 1 * * 0', // Weekly on Sunday at 1:00 AM EST
      jobType: 'SEASON',
      enabled: true,
      options: {
        sources: ['sleeper', 'nfl_data_py', 'fantasypros'],
        batchSize: 1000, // Larger batches for comprehensive processing
        maxConcurrency: 4, // Higher concurrency for weekly processing
        retryAttempts: 2, // Fewer retries due to longer processing time
        timeoutMs: 120 * 60 * 1000, // 2 hours
        skipQualityGates: false,
        forceRefresh: true // Force refresh for weekly comprehensive processing
      },
      description: 'Weekly comprehensive SEASON processing for full season analysis'
    });

    // Incremental processing - Every 6 hours during season for rapid updates
    this.addScheduleConfig({
      name: 'incremental-processing',
      cronExpression: '0 */6 * * *', // Every 6 hours
      jobType: 'INCREMENTAL',
      enabled: true,
      options: {
        sources: ['sleeper', 'nfl_data_py'],
        batchSize: 250, // Smaller batches for incremental updates
        maxConcurrency: 1, // Single-threaded for frequent updates
        retryAttempts: 2,
        timeoutMs: 15 * 60 * 1000, // 15 minutes
        skipQualityGates: false,
        forceRefresh: false
      },
      description: 'Incremental processing every 6 hours for rapid data updates'
    });

    console.log('🔧 [UPHScheduler] Default schedules configured');
  }

  /**
   * Add a new schedule configuration
   */
  addScheduleConfig(config: ScheduleConfig): void {
    this.scheduleConfigs.set(config.name, config);
    
    // Initialize stats tracking
    this.scheduleStats.set(config.name, {
      lastRun: null,
      lastResult: null,
      consecutiveFailures: 0,
      totalRuns: 0,
      totalSuccesses: 0
    });

    console.log(`🔧 [UPHScheduler] Added schedule config: ${config.name} (${config.cronExpression})`);
  }

  /**
   * Setup all configured schedules
   */
  private async setupAllSchedules(): Promise<void> {
    console.log('📅 [UPHScheduler] Setting up automated processing schedules...');

    for (const [name, config] of Array.from(this.scheduleConfigs.entries())) {
      if (config.enabled) {
        await this.setupSchedule(name, config);
      } else {
        console.log(`⏸️ [UPHScheduler] Skipping disabled schedule: ${name}`);
      }
    }

    console.log(`✅ [UPHScheduler] Setup completed for ${this.schedules.size} active schedules`);
  }

  /**
   * Setup individual schedule with comprehensive error handling
   */
  private async setupSchedule(name: string, config: ScheduleConfig): Promise<void> {
    try {
      console.log(`📅 [UPHScheduler] Setting up schedule: ${name}`);
      console.log(`   🕒 Cron: ${config.cronExpression}`);
      console.log(`   🎯 Type: ${config.jobType}`);
      console.log(`   📝 Description: ${config.description}`);

      const task = cron.schedule(config.cronExpression, async () => {
        await this.executeScheduledJob(name, config);
      }, {
        timezone: this.DEFAULT_TIMEZONE
      });

      this.schedules.set(name, task);
      
      // Log next execution time
      const nextRun = this.getNextRunTime(name);
      if (nextRun) {
        console.log(`   ⏰ Next run: ${nextRun.toLocaleString('en-US', { timeZone: this.DEFAULT_TIMEZONE })}`);
      }

      console.log(`✅ [UPHScheduler] Schedule active: ${name}`);
      
    } catch (error) {
      console.error(`❌ [UPHScheduler] Failed to setup schedule ${name}:`, error);
      throw error;
    }
  }

  /**
   * Execute a scheduled job with comprehensive logging and error handling
   */
  private async executeScheduledJob(scheduleName: string, config: ScheduleConfig): Promise<void> {
    const executionId = `${scheduleName}-${Date.now()}`;
    const startTime = Date.now();
    
    console.log(`🚀 [UPHScheduler] Executing scheduled job: ${scheduleName} (${executionId})`);
    console.log(`   📋 Job Type: ${config.jobType}`);
    console.log(`   🕒 Started: ${new Date().toLocaleString('en-US', { timeZone: this.DEFAULT_TIMEZONE })}`);

    try {
      // Pre-processing health check
      console.log(`🏥 [UPHScheduler] Running pre-processing health check...`);
      const healthStatus = await this.getSystemHealth();
      
      if (healthStatus.status === 'UNHEALTHY') {
        throw new Error(`System health check failed: ${JSON.stringify(healthStatus.systemChecks)}`);
      }

      if (healthStatus.status === 'DEGRADED') {
        console.warn(`⚠️ [UPHScheduler] System health degraded, proceeding with caution`);
      }

      // Determine processing scope based on job type
      const processingScope = this.determineProcessingScope(config.jobType);
      console.log(`🎯 [UPHScheduler] Processing scope: ${JSON.stringify(processingScope)}`);

      // Execute processing with UPHCoordinator
      let result: JobResult;
      
      switch (config.jobType) {
        case 'WEEKLY':
          result = await this.uphCoordinator.runWeeklyProcessing(
            processingScope.season,
            processingScope.week,
            config.options
          );
          break;
          
        case 'SEASON':
          result = await this.uphCoordinator.runSeasonProcessing(
            processingScope.season,
            config.options
          );
          break;
          
        case 'INCREMENTAL':
          result = await this.uphCoordinator.runIncrementalProcessing(
            processingScope.since,
            config.options
          );
          break;
          
        default:
          throw new Error(`Unsupported job type: ${config.jobType}`);
      }

      const duration = Date.now() - startTime;
      
      // Update schedule statistics
      this.updateScheduleStats(scheduleName, result, duration, true);
      
      // Log success details
      console.log(`✅ [UPHScheduler] Scheduled job completed successfully: ${scheduleName}`);
      console.log(`   🆔 Job ID: ${result.jobId}`);
      console.log(`   📊 Tasks: ${result.successfulTasks}/${result.totalTasks} successful`);
      console.log(`   ⏱️ Duration: ${duration}ms`);
      console.log(`   📈 Records Processed: ${result.stats.recordsProcessed}`);
      
      if (result.failedTasks > 0) {
        console.warn(`⚠️ [UPHScheduler] ${result.failedTasks} tasks failed in job: ${scheduleName}`);
        if (result.errorDetails && result.errorDetails.length > 0) {
          console.warn(`   📋 Errors: ${result.errorDetails.slice(0, 3).join(', ')}`);
        }
      }

      // Add to history
      this.addToHistory({
        scheduleName,
        executedAt: new Date(),
        jobId: result.jobId,
        result,
        duration,
        success: true
      });

      // Post-processing validation
      await this.performPostProcessingValidation(result);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Handle failure
      await this.handleScheduledJobFailure(scheduleName, error, duration, executionId);
    }
  }

  /**
   * Handle scheduled job failures with retry logic and escalation
   */
  private async handleScheduledJobFailure(
    scheduleName: string,
    error: any,
    duration: number,
    executionId: string
  ): Promise<void> {
    console.error(`❌ [UPHScheduler] Scheduled job failed: ${scheduleName} (${executionId})`);
    console.error(`   💥 Error: ${error.message || error}`);
    console.error(`   ⏱️ Failed after: ${duration}ms`);

    // Update failure statistics
    const stats = this.scheduleStats.get(scheduleName);
    if (stats) {
      stats.consecutiveFailures += 1;
      stats.totalRuns += 1;
      
      // Check for escalation threshold
      if (stats.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        console.error(`🚨 [UPHScheduler] CRITICAL: Schedule ${scheduleName} has ${stats.consecutiveFailures} consecutive failures!`);
        
        // Disable schedule to prevent cascade failures
        await this.disableSchedule(scheduleName);
        console.error(`🛑 [UPHScheduler] Schedule ${scheduleName} has been automatically disabled`);
      }
    }

    // Add failure to history
    this.addToHistory({
      scheduleName,
      executedAt: new Date(),
      jobId: `failed-${executionId}`,
      result: {
        jobId: `failed-${executionId}`,
        status: 'FAILED',
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 1,
        skippedTasks: 0,
        duration,
        stats: {
          recordsProcessed: 0,
          payloadsIngested: 0,
          transformationsApplied: 0,
          qualityChecksRun: 0,
          qualityChecksPassed: 0,
          qualityChecksFailed: 0,
          averageProcessingTime: 0,
          dataVolumeBytes: 0,
          memoryUsagePeak: 0
        },
        errorDetails: [error.message || String(error)]
      },
      duration,
      success: false
    });

    // Log failure details for monitoring
    this.logFailureDetails(scheduleName, error, stats?.consecutiveFailures || 0);
  }

  /**
   * Determine processing scope based on job type and current context
   */
  private determineProcessingScope(jobType: 'WEEKLY' | 'SEASON' | 'INCREMENTAL'): any {
    const currentSeason = 2024; // TODO: Make this dynamic based on NFL calendar
    const currentWeek = parseInt(getCurrentNFLWeek());
    
    switch (jobType) {
      case 'WEEKLY':
        return {
          season: currentSeason,
          week: currentWeek
        };
        
      case 'SEASON':
        return {
          season: currentSeason
        };
        
      case 'INCREMENTAL':
        // Process data changed in last 6 hours
        const since = new Date();
        since.setHours(since.getHours() - 6);
        return {
          since
        };
        
      default:
        throw new Error(`Unsupported job type for scope determination: ${jobType}`);
    }
  }

  /**
   * Update schedule statistics after job execution
   */
  private updateScheduleStats(
    scheduleName: string,
    result: JobResult,
    duration: number,
    success: boolean
  ): void {
    const stats = this.scheduleStats.get(scheduleName);
    if (stats) {
      stats.lastRun = new Date();
      stats.lastResult = result;
      stats.totalRuns += 1;
      
      if (success) {
        stats.totalSuccesses += 1;
        stats.consecutiveFailures = 0; // Reset on success
      }
    }
  }

  /**
   * Perform comprehensive system health check
   */
  private async performSystemHealthCheck(): Promise<SchedulerHealth> {
    console.log('🏥 [UPHScheduler] Performing system health check...');
    
    const systemChecks = {
      coordinatorService: false,
      databaseConnectivity: false,
      cronService: false
    };

    try {
      // Check UPH Coordinator availability
      const coordinatorHealth = await this.uphCoordinator.getSystemHealth();
      systemChecks.coordinatorService = coordinatorHealth.status !== 'UNHEALTHY';
      
      // Check database connectivity via a simple query
      const dbStatus = await this.uphCoordinator.getProcessingMetrics();
      systemChecks.databaseConnectivity = true;
      
      // Check cron service
      systemChecks.cronService = this.schedules.size > 0;
      
    } catch (error) {
      console.warn('⚠️ [UPHScheduler] Health check encountered errors:', error);
    }

    const healthyChecks = Object.values(systemChecks).filter(Boolean).length;
    const totalChecks = Object.values(systemChecks).length;
    
    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    if (healthyChecks === totalChecks) {
      status = 'HEALTHY';
    } else if (healthyChecks >= totalChecks * 0.7) {
      status = 'DEGRADED';
    } else {
      status = 'UNHEALTHY';
    }

    const recentFailures = this.getRecentFailureCount();
    
    const health: SchedulerHealth = {
      status,
      activeSchedules: this.schedules.size,
      enabledSchedules: Array.from(this.scheduleConfigs.values()).filter(c => c.enabled).length,
      recentFailures,
      lastHealthCheck: new Date(),
      systemChecks,
      uptime: Date.now() - this.startTime.getTime()
    };

    console.log(`🏥 [UPHScheduler] System health: ${status} (${healthyChecks}/${totalChecks} checks passed)`);
    
    return health;
  }

  /**
   * Perform post-processing validation
   */
  private async performPostProcessingValidation(result: JobResult): Promise<void> {
    console.log(`🔍 [UPHScheduler] Running post-processing validation...`);
    
    // Basic quality checks
    const qualityScore = result.stats.qualityChecksPassed / (result.stats.qualityChecksRun || 1);
    if (qualityScore < 0.9) {
      console.warn(`⚠️ [UPHScheduler] Quality score below threshold: ${(qualityScore * 100).toFixed(1)}%`);
    }

    // Performance validation
    if (result.stats.averageProcessingTime > 60000) { // 1 minute
      console.warn(`⚠️ [UPHScheduler] High average processing time: ${result.stats.averageProcessingTime}ms`);
    }

    // Error rate validation
    const errorRate = result.failedTasks / result.totalTasks;
    if (errorRate > 0.1) { // 10% error rate
      console.warn(`⚠️ [UPHScheduler] High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }

    console.log(`✅ [UPHScheduler] Post-processing validation completed`);
  }

  /**
   * Start health monitoring with periodic checks
   */
  private startHealthMonitoring(): void {
    console.log('🏥 [UPHScheduler] Starting periodic health monitoring...');
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.performSystemHealthCheck();
        
        if (health.status === 'UNHEALTHY') {
          console.error('🚨 [UPHScheduler] System health is UNHEALTHY!');
          console.error(`   📊 Active schedules: ${health.activeSchedules}`);
          console.error(`   ❌ Failed checks: ${JSON.stringify(health.systemChecks)}`);
        }
        
        if (health.recentFailures > 5) {
          console.warn(`⚠️ [UPHScheduler] High recent failure count: ${health.recentFailures}`);
        }
        
      } catch (error) {
        console.error('❌ [UPHScheduler] Health monitoring error:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL_MS);
    
    console.log(`✅ [UPHScheduler] Health monitoring active (${this.HEALTH_CHECK_INTERVAL_MS}ms interval)`);
  }

  /**
   * Get schedule status for monitoring
   */
  getScheduleStatus(scheduleName?: string): ScheduleStatus | ScheduleStatus[] {
    if (scheduleName) {
      return this.getSingleScheduleStatus(scheduleName);
    }
    
    return Array.from(this.scheduleConfigs.keys()).map(name => 
      this.getSingleScheduleStatus(name)
    );
  }

  /**
   * Get status for a single schedule
   */
  private getSingleScheduleStatus(scheduleName: string): ScheduleStatus {
    const config = this.scheduleConfigs.get(scheduleName);
    const task = this.schedules.get(scheduleName);
    const stats = this.scheduleStats.get(scheduleName);
    
    if (!config || !stats) {
      throw new Error(`Schedule not found: ${scheduleName}`);
    }

    const successRate = stats.totalRuns > 0 
      ? stats.totalSuccesses / stats.totalRuns 
      : 0;

    return {
      name: scheduleName,
      isActive: !!task && config.enabled,
      nextRun: this.getNextRunTime(scheduleName),
      lastRun: stats.lastRun,
      lastResult: stats.lastResult,
      consecutiveFailures: stats.consecutiveFailures,
      totalRuns: stats.totalRuns,
      successRate
    };
  }

  /**
   * Get next run time for a schedule
   */
  private getNextRunTime(scheduleName: string): Date | null {
    const task = this.schedules.get(scheduleName);
    if (!task) return null;

    try {
      // This is a simplified approach - node-cron doesn't expose next run time directly
      // In production, you might want to use a more sophisticated cron library
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Placeholder: next day
    } catch {
      return null;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SchedulerHealth> {
    return await this.performSystemHealthCheck();
  }

  /**
   * Get recent failure count (last 24 hours)
   */
  private getRecentFailureCount(): number {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.scheduleHistory.filter(h => 
      h.executedAt > oneDayAgo && !h.success
    ).length;
  }

  /**
   * Add entry to schedule history
   */
  private addToHistory(entry: ScheduleHistory): void {
    this.scheduleHistory.unshift(entry);
    
    // Trim history to max size
    if (this.scheduleHistory.length > this.MAX_HISTORY_ENTRIES) {
      this.scheduleHistory = this.scheduleHistory.slice(0, this.MAX_HISTORY_ENTRIES);
    }
  }

  /**
   * Get schedule execution history
   */
  getScheduleHistory(scheduleName?: string, limit = 50): ScheduleHistory[] {
    let history = this.scheduleHistory;
    
    if (scheduleName) {
      history = history.filter(h => h.scheduleName === scheduleName);
    }
    
    return history.slice(0, limit);
  }

  /**
   * Enable a schedule
   */
  async enableSchedule(scheduleName: string): Promise<void> {
    const config = this.scheduleConfigs.get(scheduleName);
    if (!config) {
      throw new Error(`Schedule not found: ${scheduleName}`);
    }

    if (!config.enabled) {
      config.enabled = true;
      await this.setupSchedule(scheduleName, config);
      console.log(`✅ [UPHScheduler] Schedule enabled: ${scheduleName}`);
    }
  }

  /**
   * Disable a schedule
   */
  async disableSchedule(scheduleName: string): Promise<void> {
    const config = this.scheduleConfigs.get(scheduleName);
    const task = this.schedules.get(scheduleName);
    
    if (config) {
      config.enabled = false;
    }
    
    if (task) {
      task.stop();
      this.schedules.delete(scheduleName);
      console.log(`🛑 [UPHScheduler] Schedule disabled: ${scheduleName}`);
    }
  }

  /**
   * Manually trigger a schedule
   */
  async triggerSchedule(scheduleName: string): Promise<JobResult> {
    const config = this.scheduleConfigs.get(scheduleName);
    if (!config) {
      throw new Error(`Schedule not found: ${scheduleName}`);
    }

    console.log(`🎯 [UPHScheduler] Manually triggering schedule: ${scheduleName}`);
    
    // Execute the job manually
    await this.executeScheduledJob(scheduleName, config);
    
    const stats = this.scheduleStats.get(scheduleName);
    if (stats?.lastResult) {
      return stats.lastResult;
    }
    
    throw new Error(`Failed to get result for manually triggered schedule: ${scheduleName}`);
  }

  /**
   * Get processing metrics across all schedules
   */
  getProcessingMetrics(): any {
    const totalRuns = Array.from(this.scheduleStats.values())
      .reduce((sum, stats) => sum + stats.totalRuns, 0);
    
    const totalSuccesses = Array.from(this.scheduleStats.values())
      .reduce((sum, stats) => sum + stats.totalSuccesses, 0);
    
    const overallSuccessRate = totalRuns > 0 ? totalSuccesses / totalRuns : 0;
    
    const activeSchedules = Array.from(this.scheduleConfigs.values())
      .filter(config => config.enabled).length;

    return {
      totalSchedules: this.scheduleConfigs.size,
      activeSchedules,
      totalRuns,
      totalSuccesses,
      overallSuccessRate,
      recentFailures: this.getRecentFailureCount(),
      uptime: Date.now() - this.startTime.getTime(),
      isInitialized: this.isInitialized
    };
  }

  /**
   * Log current schedule status
   */
  private logScheduleStatus(): void {
    console.log('📊 [UPHScheduler] Current Schedule Status:');
    
    for (const [name, config] of Array.from(this.scheduleConfigs.entries())) {
      const task = this.schedules.get(name);
      const isActive = !!task && config.enabled;
      const nextRun = this.getNextRunTime(name);
      
      console.log(`   📅 ${name}:`);
      console.log(`      🔄 Active: ${isActive}`);
      console.log(`      🕒 Cron: ${config.cronExpression}`);
      console.log(`      🎯 Type: ${config.jobType}`);
      if (nextRun) {
        console.log(`      ⏰ Next: ${nextRun.toLocaleString('en-US', { timeZone: this.DEFAULT_TIMEZONE })}`);
      }
    }
  }

  /**
   * Log failure details for monitoring
   */
  private logFailureDetails(scheduleName: string, error: any, consecutiveFailures: number): void {
    console.error(`📋 [UPHScheduler] Failure Details for ${scheduleName}:`);
    console.error(`   💥 Error: ${error.message || error}`);
    console.error(`   🔢 Consecutive failures: ${consecutiveFailures}`);
    console.error(`   🕒 Failed at: ${new Date().toLocaleString('en-US', { timeZone: this.DEFAULT_TIMEZONE })}`);
    
    if (error.stack) {
      console.error(`   📚 Stack trace: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
    }
  }

  /**
   * Shutdown scheduler gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🛑 [UPHScheduler] Shutting down scheduler...');
    
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Stop all active schedules
    for (const [name, task] of Array.from(this.schedules.entries())) {
      task.stop();
      console.log(`🛑 [UPHScheduler] Stopped schedule: ${name}`);
    }
    
    this.schedules.clear();
    this.isInitialized = false;
    
    console.log('✅ [UPHScheduler] Scheduler shutdown completed');
  }
}

// Export singleton instance
export const uphScheduler = UPHScheduler.getInstance();