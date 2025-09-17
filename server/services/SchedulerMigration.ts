/**
 * Scheduler Migration Service
 * 
 * Handles graceful migration from UPHScheduler (fixed cron) to IntelligentScheduler (event-driven).
 * Provides zero-downtime transition with rollback capabilities and comprehensive migration tracking.
 * 
 * Migration Strategy:
 * 1. Gradual schedule migration (one at a time)
 * 2. Preserve existing schedule configurations
 * 3. Monitor performance during migration
 * 4. Automatic rollback on failure
 * 5. Maintain backup cron schedules during transition
 */

import { db } from '../db';
import { intelligentScheduleState, scheduleTriggers } from '@shared/schema';
import { sql } from 'drizzle-orm';

// Forward declarations to avoid circular dependencies
declare class UPHScheduler {
  getScheduleConfigs(): Promise<Map<string, any>>;
  getScheduleStatuses(): Promise<Map<string, any>>;
  pauseSchedule(name: string): Promise<void>;
  resumeSchedule(name: string): Promise<void>;
  disableSchedule(name: string): Promise<void>;
  getSystemHealth(): Promise<any>;
}

declare class IntelligentScheduler {
  initialize(): Promise<void>;
  addScheduleConfig(config: any): void;
  getScheduleStatuses(): Promise<Map<string, any>>;
  removeSchedule(scheduleKey: string): Promise<void>;
}

export interface MigrationConfig {
  scheduleKey: string;
  cronExpression: string;
  baseFrequencyMs: number;
  migrationStrategy: 'gradual' | 'immediate' | 'test_first';
  rollbackThreshold: {
    maxFailureRate: number; // e.g., 0.1 for 10%
    maxLatencyIncrease: number; // e.g., 2.0 for 200% increase
    minSuccessRate: number; // e.g., 0.8 for 80%
  };
  testDuration: number; // ms to test new schedule before full migration
}

export interface MigrationStatus {
  scheduleKey: string;
  phase: 'not_started' | 'testing' | 'migrating' | 'completed' | 'failed' | 'rolled_back';
  startedAt: Date;
  completedAt?: Date;
  oldScheduleActive: boolean;
  newScheduleActive: boolean;
  performanceMetrics: {
    oldScheduleSuccess: number;
    newScheduleSuccess: number;
    oldScheduleLatency: number;
    newScheduleLatency: number;
    errorCount: number;
  };
  rollbackReason?: string;
}

export interface MigrationHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  migrationCount: number;
  completedCount: number;
  failedCount: number;
  activeRollbacks: number;
  systemStability: 'stable' | 'unstable' | 'critical';
}

/**
 * Scheduler Migration Service
 * Orchestrates the transition from fixed cron scheduling to intelligent event-driven scheduling
 */
export class SchedulerMigration {
  private static instance: SchedulerMigration;
  
  // Migration state
  private migrationStatuses: Map<string, MigrationStatus> = new Map();
  private migrationConfigs: Map<string, MigrationConfig> = new Map();
  private isInitialized = false;
  private migrationStartTime?: Date;
  
  // Service references (lazy loaded)
  private uphScheduler: UPHScheduler | null = null;
  private intelligentScheduler: IntelligentScheduler | null = null;
  
  // Migration monitoring
  private migrationInterval: NodeJS.Timeout | null = null;
  private readonly MIGRATION_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
  
  public static getInstance(): SchedulerMigration {
    if (!SchedulerMigration.instance) {
      SchedulerMigration.instance = new SchedulerMigration();
    }
    return SchedulerMigration.instance;
  }

  private constructor() {
    this.initializeDefaultMigrationConfigs();
  }

  /**
   * Initialize the migration service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('🔧 [SchedulerMigration] Already initialized, skipping...');
      return;
    }

    console.log('🚀 [SchedulerMigration] Initializing scheduler migration service...');

    try {
      // Lazy load services to avoid circular dependencies
      await this.loadServices();
      
      // Initialize migration tracking
      await this.initializeMigrationTracking();
      
      // Start migration monitoring
      this.startMigrationMonitoring();
      
      this.isInitialized = true;
      console.log('✅ [SchedulerMigration] Migration service initialized successfully');

    } catch (error) {
      console.error('❌ [SchedulerMigration] Failed to initialize migration service:', error);
      throw error;
    }
  }

  /**
   * Start gradual migration from UPHScheduler to IntelligentScheduler
   */
  async startMigration(): Promise<void> {
    console.log('🔄 [SchedulerMigration] Starting gradual scheduler migration...');

    try {
      if (!this.uphScheduler || !this.intelligentScheduler) {
        throw new Error('Services not loaded - cannot start migration');
      }

      this.migrationStartTime = new Date();

      // Get current UPH schedules
      const currentSchedules = await this.uphScheduler.getScheduleConfigs();
      console.log(`📋 [SchedulerMigration] Found ${currentSchedules.size} schedules to migrate`);

      // Create migration plan
      const migrationPlan = await this.createMigrationPlan(currentSchedules);
      
      // Execute gradual migration
      await this.executeMigrationPlan(migrationPlan);

      console.log('✅ [SchedulerMigration] Migration process started successfully');

    } catch (error) {
      console.error('❌ [SchedulerMigration] Failed to start migration:', error);
      throw error;
    }
  }

  /**
   * Create a migration plan based on existing schedules
   */
  private async createMigrationPlan(schedules: Map<string, any>): Promise<MigrationConfig[]> {
    const migrationPlan: MigrationConfig[] = [];

    for (const [scheduleName, config] of Array.from(schedules.entries())) {
      // Convert cron schedule to intelligent schedule configuration
      const migrationConfig: MigrationConfig = {
        scheduleKey: this.convertScheduleNameToKey(scheduleName),
        cronExpression: config.cronExpression,
        baseFrequencyMs: this.cronToFrequency(config.cronExpression),
        migrationStrategy: this.determineMigrationStrategy(config),
        rollbackThreshold: {
          maxFailureRate: 0.15, // 15% max failure rate
          maxLatencyIncrease: 2.5, // 250% max latency increase
          minSuccessRate: 0.75 // 75% min success rate
        },
        testDuration: this.getTestDuration(config)
      };

      migrationPlan.push(migrationConfig);
      this.migrationConfigs.set(migrationConfig.scheduleKey, migrationConfig);
    }

    // Sort by migration priority (critical schedules last)
    migrationPlan.sort((a, b) => this.getMigrationPriority(a) - this.getMigrationPriority(b));

    return migrationPlan;
  }

  /**
   * Execute the migration plan schedule by schedule
   */
  private async executeMigrationPlan(plan: MigrationConfig[]): Promise<void> {
    console.log(`🗓️ [SchedulerMigration] Executing migration plan with ${plan.length} schedules`);

    for (const config of plan) {
      try {
        await this.migrateSchedule(config);
        
        // Wait between migrations to monitor stability
        await this.waitAndMonitor(config.testDuration);
        
      } catch (error) {
        console.error(`❌ [SchedulerMigration] Failed to migrate schedule ${config.scheduleKey}:`, error);
        
        // Mark as failed and continue with next schedule
        await this.markMigrationFailed(config.scheduleKey, (error as Error).message);
        continue;
      }
    }

    console.log('✅ [SchedulerMigration] Migration plan execution completed');
  }

  /**
   * Migrate a single schedule from UPH to Intelligent
   */
  private async migrateSchedule(config: MigrationConfig): Promise<void> {
    console.log(`🔄 [SchedulerMigration] Migrating schedule: ${config.scheduleKey}`);

    // Initialize migration status
    const status: MigrationStatus = {
      scheduleKey: config.scheduleKey,
      phase: 'testing',
      startedAt: new Date(),
      oldScheduleActive: true,
      newScheduleActive: false,
      performanceMetrics: {
        oldScheduleSuccess: 1.0,
        newScheduleSuccess: 0,
        oldScheduleLatency: 0,
        newScheduleLatency: 0,
        errorCount: 0
      }
    };

    this.migrationStatuses.set(config.scheduleKey, status);

    try {
      // Phase 1: Test new schedule alongside old one
      console.log(`🧪 [SchedulerMigration] Testing new schedule for ${config.scheduleKey}`);
      await this.runTestPhase(config, status);

      // Phase 2: Switch to new schedule if test successful
      if (await this.shouldProceedWithMigration(config, status)) {
        console.log(`🔄 [SchedulerMigration] Switching ${config.scheduleKey} to intelligent scheduling`);
        await this.switchToIntelligentSchedule(config, status);
        
        // Phase 3: Monitor and confirm success
        await this.monitorMigration(config, status);
        
        // Phase 4: Disable old schedule if migration successful
        await this.completeMigration(config, status);
        
      } else {
        console.warn(`⚠️ [SchedulerMigration] Migration test failed for ${config.scheduleKey}, keeping old schedule`);
        await this.rollbackMigration(config, status, 'Test phase metrics did not meet thresholds');
      }

    } catch (error) {
      console.error(`❌ [SchedulerMigration] Migration failed for ${config.scheduleKey}:`, error);
      await this.rollbackMigration(config, status, (error as Error).message);
      throw error;
    }
  }

  /**
   * Run test phase - new schedule runs alongside old one
   */
  private async runTestPhase(config: MigrationConfig, status: MigrationStatus): Promise<void> {
    console.log(`🧪 [SchedulerMigration] Starting test phase for ${config.scheduleKey}`);

    // Add new intelligent schedule configuration (but don't activate yet)
    const intelligentConfig = this.convertToIntelligentConfig(config);
    this.intelligentScheduler!.addScheduleConfig(intelligentConfig);

    // Monitor both schedules during test period
    const testStartTime = Date.now();
    while (Date.now() - testStartTime < config.testDuration) {
      await this.sleep(5000); // Check every 5 seconds
      await this.updatePerformanceMetrics(config.scheduleKey, status);
    }

    console.log(`✅ [SchedulerMigration] Test phase completed for ${config.scheduleKey}`);
  }

  /**
   * Switch from old schedule to intelligent schedule
   */
  private async switchToIntelligentSchedule(config: MigrationConfig, status: MigrationStatus): Promise<void> {
    // Pause old schedule
    await this.uphScheduler!.pauseSchedule(config.scheduleKey);
    status.oldScheduleActive = false;

    // Activate new intelligent schedule
    status.newScheduleActive = true;
    status.phase = 'migrating';

    console.log(`🔄 [SchedulerMigration] Switched ${config.scheduleKey} to intelligent scheduling`);
  }

  /**
   * Monitor migration performance and decide if rollback is needed
   */
  private async monitorMigration(config: MigrationConfig, status: MigrationStatus): Promise<void> {
    const monitorStartTime = Date.now();
    const monitorDuration = config.testDuration; // Same duration as test

    while (Date.now() - monitorStartTime < monitorDuration) {
      await this.sleep(10000); // Check every 10 seconds
      
      await this.updatePerformanceMetrics(config.scheduleKey, status);
      
      // Check if rollback is needed
      if (await this.shouldRollback(config, status)) {
        await this.rollbackMigration(config, status, 'Performance degradation detected');
        return;
      }
    }

    console.log(`✅ [SchedulerMigration] Migration monitoring completed for ${config.scheduleKey}`);
  }

  /**
   * Complete migration by disabling old schedule
   */
  private async completeMigration(config: MigrationConfig, status: MigrationStatus): Promise<void> {
    // Fully disable old schedule
    await this.uphScheduler!.disableSchedule(config.scheduleKey);
    
    // Update status
    status.phase = 'completed';
    status.completedAt = new Date();
    
    // Persist migration completion to database
    await this.recordMigrationCompletion(config.scheduleKey);

    console.log(`✅ [SchedulerMigration] Successfully migrated ${config.scheduleKey} to intelligent scheduling`);
  }

  /**
   * Rollback migration to old schedule
   */
  private async rollbackMigration(config: MigrationConfig, status: MigrationStatus, reason: string): Promise<void> {
    console.warn(`🔙 [SchedulerMigration] Rolling back migration for ${config.scheduleKey}: ${reason}`);

    try {
      // Re-enable old schedule
      await this.uphScheduler!.resumeSchedule(config.scheduleKey);
      status.oldScheduleActive = true;

      // Disable new intelligent schedule
      await this.intelligentScheduler!.removeSchedule(config.scheduleKey);
      status.newScheduleActive = false;

      // Update status
      status.phase = 'rolled_back';
      status.rollbackReason = reason;
      status.completedAt = new Date();

      console.log(`✅ [SchedulerMigration] Successfully rolled back ${config.scheduleKey}`);

    } catch (error) {
      console.error(`❌ [SchedulerMigration] Rollback failed for ${config.scheduleKey}:`, error);
      status.phase = 'failed';
      throw error;
    }
  }

  /**
   * Get current migration status
   */
  async getMigrationStatus(): Promise<{
    overall: MigrationHealth;
    schedules: MigrationStatus[];
    summary: {
      total: number;
      completed: number;
      failed: number;
      inProgress: number;
      rolledBack: number;
    };
  }> {
    const schedules = Array.from(this.migrationStatuses.values());
    
    const summary = {
      total: schedules.length,
      completed: schedules.filter(s => s.phase === 'completed').length,
      failed: schedules.filter(s => s.phase === 'failed').length,
      inProgress: schedules.filter(s => ['testing', 'migrating'].includes(s.phase)).length,
      rolledBack: schedules.filter(s => s.phase === 'rolled_back').length
    };

    const overall: MigrationHealth = {
      overall: this.calculateOverallHealth(schedules),
      migrationCount: summary.total,
      completedCount: summary.completed,
      failedCount: summary.failed,
      activeRollbacks: summary.rolledBack,
      systemStability: await this.assessSystemStability()
    };

    return {
      overall,
      schedules,
      summary
    };
  }

  // Helper methods

  private async loadServices(): Promise<void> {
    try {
      // Lazy load UPHScheduler
      const { uphScheduler } = await import('./UPHScheduler');
      this.uphScheduler = uphScheduler;

      // Lazy load IntelligentScheduler
      const { intelligentScheduler } = await import('./IntelligentScheduler');
      this.intelligentScheduler = intelligentScheduler;

      // Initialize IntelligentScheduler if not already done
      await this.intelligentScheduler.initialize();

    } catch (error) {
      console.error('❌ [SchedulerMigration] Failed to load services:', error);
      throw error;
    }
  }

  private initializeDefaultMigrationConfigs(): void {
    // Default migration configurations for common schedules
    const defaultConfigs = [
      {
        scheduleKey: 'nightly_incremental',
        cronExpression: '0 2 * * *', // 2 AM daily
        baseFrequencyMs: 24 * 60 * 60 * 1000, // 24 hours
        migrationStrategy: 'gradual' as const,
        rollbackThreshold: {
          maxFailureRate: 0.1,
          maxLatencyIncrease: 2.0,
          minSuccessRate: 0.8
        },
        testDuration: 2 * 60 * 60 * 1000 // 2 hours
      },
      {
        scheduleKey: 'weekly_season',
        cronExpression: '0 4 * * 0', // 4 AM Sunday
        baseFrequencyMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        migrationStrategy: 'test_first' as const,
        rollbackThreshold: {
          maxFailureRate: 0.05,
          maxLatencyIncrease: 1.5,
          minSuccessRate: 0.9
        },
        testDuration: 4 * 60 * 60 * 1000 // 4 hours
      }
    ];

    defaultConfigs.forEach(config => {
      this.migrationConfigs.set(config.scheduleKey, config);
    });
  }

  private convertScheduleNameToKey(scheduleName: string): string {
    return scheduleName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private cronToFrequency(cronExpression: string): number {
    // Simple conversion - would need more sophisticated parsing for complex crons
    if (cronExpression.includes('* * *')) {
      return 24 * 60 * 60 * 1000; // Daily
    } else if (cronExpression.includes('* * 0')) {
      return 7 * 24 * 60 * 60 * 1000; // Weekly
    } else {
      return 60 * 60 * 1000; // Default hourly
    }
  }

  private determineMigrationStrategy(config: any): 'gradual' | 'immediate' | 'test_first' {
    // Critical schedules use test_first, others use gradual
    const criticalSchedules = ['weekly_season', 'critical_processing'];
    return criticalSchedules.some(critical => config.name.includes(critical)) ? 'test_first' : 'gradual';
  }

  private getTestDuration(config: any): number {
    // Longer test duration for more critical schedules
    return config.cronExpression.includes('0') ? 4 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
  }

  private getMigrationPriority(config: MigrationConfig): number {
    // Lower numbers = higher priority (migrate first)
    const priorities: Record<string, number> = {
      'nightly_incremental': 1,
      'brand_signal_refresh': 2,
      'weekly_season': 10 // Migrate critical schedules last
    };
    return priorities[config.scheduleKey] || 5;
  }

  private convertToIntelligentConfig(config: MigrationConfig): any {
    return {
      scheduleKey: config.scheduleKey,
      baseFrequencyMs: config.baseFrequencyMs,
      minFrequencyMs: config.baseFrequencyMs * 0.5,
      maxFrequencyMs: config.baseFrequencyMs * 2,
      freshnessThresholdMs: config.baseFrequencyMs * 0.25,
      slaTargets: {
        targetProcessingTime: 5 * 60 * 1000, // 5 minutes
        actualProcessingTime: 0,
        targetErrorRate: 0.02,
        actualErrorRate: 0,
        targetFreshness: config.baseFrequencyMs / (60 * 1000),
        actualFreshness: 0,
        slaCompliance: 1.0
      },
      enabled: true
    };
  }

  private async initializeMigrationTracking(): Promise<void> {
    // Initialize database tracking if needed
    console.log('📊 [SchedulerMigration] Initializing migration tracking...');
  }

  private startMigrationMonitoring(): void {
    this.migrationInterval = setInterval(async () => {
      try {
        await this.checkMigrationHealth();
      } catch (error) {
        console.error('❌ [SchedulerMigration] Migration health check failed:', error);
      }
    }, this.MIGRATION_CHECK_INTERVAL_MS);
  }

  private async checkMigrationHealth(): Promise<void> {
    // Monitor ongoing migrations and system stability
    for (const [scheduleKey, status] of Array.from(this.migrationStatuses.entries())) {
      if (['testing', 'migrating'].includes(status.phase)) {
        await this.updatePerformanceMetrics(scheduleKey, status);
      }
    }
  }

  private async updatePerformanceMetrics(scheduleKey: string, status: MigrationStatus): Promise<void> {
    // Update performance metrics from both old and new schedules
    // This would integrate with actual monitoring data
    console.log(`📊 [SchedulerMigration] Updating metrics for ${scheduleKey}`);
  }

  private async shouldProceedWithMigration(config: MigrationConfig, status: MigrationStatus): Promise<boolean> {
    const metrics = status.performanceMetrics;
    const thresholds = config.rollbackThreshold;

    return (
      metrics.newScheduleSuccess >= thresholds.minSuccessRate &&
      metrics.errorCount === 0 &&
      metrics.newScheduleLatency <= metrics.oldScheduleLatency * thresholds.maxLatencyIncrease
    );
  }

  private async shouldRollback(config: MigrationConfig, status: MigrationStatus): Promise<boolean> {
    const metrics = status.performanceMetrics;
    const thresholds = config.rollbackThreshold;

    return (
      metrics.newScheduleSuccess < thresholds.minSuccessRate ||
      metrics.errorCount > 3 ||
      metrics.newScheduleLatency > metrics.oldScheduleLatency * thresholds.maxLatencyIncrease
    );
  }

  private async waitAndMonitor(duration: number): Promise<void> {
    await this.sleep(Math.min(duration, 30 * 1000)); // Max 30 second wait between migrations
  }

  private async recordMigrationCompletion(scheduleKey: string): Promise<void> {
    try {
      await db.insert(scheduleTriggers).values({
        triggerType: 'migration_completed',
        triggerSource: 'scheduler_migration',
        scheduleKey: scheduleKey,
        actionTaken: 'migrated_to_intelligent',
        success: true,
        executionTimeMs: 0,
        triggeredAt: new Date()
      });
    } catch (error) {
      console.error('❌ [SchedulerMigration] Failed to record migration completion:', error);
    }
  }

  private async markMigrationFailed(scheduleKey: string, reason: string): Promise<void> {
    const status = this.migrationStatuses.get(scheduleKey);
    if (status) {
      status.phase = 'failed';
      status.rollbackReason = reason;
      status.completedAt = new Date();
    }
  }

  private calculateOverallHealth(schedules: MigrationStatus[]): 'healthy' | 'degraded' | 'critical' {
    if (schedules.length === 0) return 'healthy';

    const failedCount = schedules.filter(s => s.phase === 'failed').length;
    const rolledBackCount = schedules.filter(s => s.phase === 'rolled_back').length;
    const totalCount = schedules.length;

    const problemRate = (failedCount + rolledBackCount) / totalCount;

    if (problemRate > 0.3) return 'critical';
    if (problemRate > 0.1) return 'degraded';
    return 'healthy';
  }

  private async assessSystemStability(): Promise<'stable' | 'unstable' | 'critical'> {
    // This would check system metrics, error rates, etc.
    return 'stable';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const schedulerMigration = SchedulerMigration.getInstance();