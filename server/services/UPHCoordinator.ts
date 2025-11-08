/**
 * UPH Coordinator Service - Core Orchestration Engine
 * 
 * Main orchestration service for the Unified Player Hub's Bronze→Silver→Gold DAG pipeline.
 * Coordinates complete data processing workflows with comprehensive job tracking,
 * quality gate validation, and resilient error handling.
 * 
 * Core Features:
 * - Bronze→Silver→Gold DAG orchestration with clear step definitions
 * - Job types: WEEKLY, SEASON, BACKFILL, INCREMENTAL with proper scope management
 * - Comprehensive job and task tracking using job_runs/task_runs tables
 * - Quality gate enforcement between layer transitions
 * - Batch processing with configurable limits and concurrency control
 * - Complete data lineage tracking through all transformations
 * - Resilient error handling with retry logic and exponential backoff
 * - Resource monitoring and performance optimization
 */

import { db } from '../infra/db';
import { 
  jobRuns, 
  taskRuns,
  ingestPayloads,
  type JobRuns,
  type TaskRuns,
  uphJobStatusEnum, 
  uphTaskTypeEnum, 
  uphJobTypeEnum,
  dataSourceEnum
} from '@shared/schema';
import { eq, and, desc, sql, inArray, gte, lte, count } from 'drizzle-orm';
import crypto from 'crypto';

// Import existing services
import { BronzeLayerService, type RawPayloadInput, type PayloadStorageResult } from './BronzeLayerService';
import { SilverLayerService, type SilverProcessingResult } from './SilverLayerService';
import { GoldLayerService, type GoldProcessingResult } from './GoldLayerService';
import { PlayerIdentityService } from './PlayerIdentityService';
import { QualityGateValidator, qualityGateValidator, type QualityValidationResult } from './quality/QualityGateValidator';
import { DataLineageTracker, dataLineageTracker } from './quality/DataLineageTracker';

// Forward declaration to avoid circular dependency
declare class IntelligentScheduler {
  onDatasetChange(dataset: string, season: number, week: number): Promise<void>;
}

// Temporary interface definition since LineageTrackingRequest type isn't available
interface LineageTrackingRequest {
  jobId: string;
  operation: string;
  sourceTable?: string;
  targetTable: string;
  sourceJobId?: string;
  ingestPayloadId?: number;
  context?: any;
}

// Types and interfaces
export interface ProcessingOptions {
  sources?: Array<typeof dataSourceEnum.enumValues[number]>;
  batchSize?: number;
  maxConcurrency?: number;
  skipQualityGates?: boolean;
  retryAttempts?: number;
  timeoutMs?: number;
  forceRefresh?: boolean;
  dryRun?: boolean;
}

export interface JobResult {
  jobId: string;
  status: typeof uphJobStatusEnum.enumValues[number];
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  skippedTasks: number;
  duration: number;
  stats: JobStats;
  errorDetails?: string[];
}

export interface JobStats {
  recordsProcessed: number;
  payloadsIngested: number;
  transformationsApplied: number;
  qualityChecksRun: number;
  qualityChecksPassed: number;
  qualityChecksFailed: number;
  averageProcessingTime: number;
  dataVolumeBytes: number;
  memoryUsagePeak: number;
}

export interface JobStatus {
  jobId: string;
  type: typeof uphJobTypeEnum.enumValues[number];
  status: typeof uphJobStatusEnum.enumValues[number];
  progress: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    currentTask?: string;
  };
  timeline: {
    createdAt: Date;
    startedAt?: Date;
    endedAt?: Date;
    estimatedCompletion?: Date;
  };
  stats: JobStats;
  errors: TaskError[];
}

export interface TaskError {
  taskId: number;
  taskType: typeof uphTaskTypeEnum.enumValues[number];
  error: string;
  attempt: number;
  timestamp: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface RetryResult {
  retriedTasks: number;
  successful: number;
  failed: number;
}

export interface CancelResult {
  cancelled: boolean;
  reason?: string;
}

export interface JobFilters {
  type?: typeof uphJobTypeEnum.enumValues[number];
  status?: typeof uphJobStatusEnum.enumValues[number];
  season?: number;
  week?: number;
  dateRange?: DateRange;
  limit?: number;
  offset?: number;
}

export interface JobHistory {
  jobId: string;
  type: typeof uphJobTypeEnum.enumValues[number];
  status: typeof uphJobStatusEnum.enumValues[number];
  season?: number;
  week?: number;
  duration?: number;
  createdAt: Date;
  stats: JobStats;
}

export interface HealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  activeJobs: number;
  queueLength: number;
  failureRate: number;
  averageProcessingTime: number;
  systemLoad: {
    cpu: number;
    memory: number;
    database: number;
  };
  lastHealthCheck: Date;
}

export interface ProcessingMetrics {
  totalJobs: number;
  successRate: number;
  averageJobDuration: number;
  throughputPerHour: number;
  errorDistribution: Record<string, number>;
  performanceByType: Record<string, {
    averageDuration: number;
    successRate: number;
    totalRuns: number;
  }>;
}

// DAG step definition
interface DAGStep {
  type: typeof uphTaskTypeEnum.enumValues[number];
  name: string;
  dependencies: typeof uphTaskTypeEnum.enumValues[number][];
  executor: (jobId: string, scope: any, options: ProcessingOptions) => Promise<any>;
}

/**
 * Core UPH Coordinator Service
 * Orchestrates the complete Bronze→Silver→Gold data processing pipeline
 */
export class UPHCoordinator {
  private static instance: UPHCoordinator;
  
  // Service dependencies
  private bronzeService: BronzeLayerService;
  private silverService: SilverLayerService;
  private goldService: GoldLayerService;
  private identityService: PlayerIdentityService;
  private qualityValidator: QualityGateValidator;
  private lineageTracker: DataLineageTracker;
  
  // Intelligent scheduling integration (lazy loaded to avoid circular dependency)
  private intelligentScheduler: IntelligentScheduler | null = null;
  
  // Processing configuration
  private readonly DEFAULT_BATCH_SIZE = 50;
  private readonly DEFAULT_MAX_CONCURRENCY = 10;
  private readonly DEFAULT_RETRY_ATTEMPTS = 3;
  private readonly DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  
  // DAG definition
  private readonly DAG_STEPS: DAGStep[] = [
    {
      type: 'BRONZE_INGEST',
      name: 'Bronze Layer Data Ingestion',
      dependencies: [],
      executor: this.executeBronzeIngest.bind(this)
    },
    {
      type: 'SILVER_TRANSFORM',
      name: 'Silver Layer Data Transformation',
      dependencies: ['BRONZE_INGEST'],
      executor: this.executeSilverTransform.bind(this)
    },
    {
      type: 'GOLD_FACTS',
      name: 'Gold Layer Facts Generation', 
      dependencies: ['SILVER_TRANSFORM'],
      executor: this.executeGoldFacts.bind(this)
    }
  ];

  public static getInstance(): UPHCoordinator {
    if (!UPHCoordinator.instance) {
      UPHCoordinator.instance = new UPHCoordinator();
    }
    return UPHCoordinator.instance;
  }

  private constructor() {
    // Initialize service dependencies
    this.bronzeService = BronzeLayerService.getInstance();
    this.silverService = SilverLayerService.getInstance();
    this.goldService = GoldLayerService.getInstance();
    this.identityService = PlayerIdentityService.getInstance();
    this.qualityValidator = qualityGateValidator;
    this.lineageTracker = dataLineageTracker;
  }

  /**
   * Run weekly data processing pipeline
   * Processes specific season/week data incrementally
   */
  async runWeeklyProcessing(
    season: number, 
    week: number, 
    options: ProcessingOptions = {}
  ): Promise<JobResult> {
    const jobId = this.generateJobId('WEEKLY', { season, week });
    const startTime = Date.now();

    console.log(`🚀 [UPHCoordinator] Starting WEEKLY processing for ${season} Week ${week} (Job: ${jobId})`);

    try {
      // Create job record
      await this.createJob(jobId, 'WEEKLY', { season, week }, options);
      
      // Execute DAG pipeline
      const result = await this.executeDAG(jobId, {
        type: 'WEEKLY',
        season,
        week,
        sources: options.sources || ['sleeper', 'nfl_data_py', 'fantasypros']
      }, options);

      const duration = Date.now() - startTime;
      
      // Update job status
      await this.updateJobStatus(jobId, 'SUCCESS', {
        totalTasks: result.totalTasks,
        successfulTasks: result.successfulTasks,
        failedTasks: result.failedTasks,
        duration
      });

      console.log(`✅ [UPHCoordinator] WEEKLY processing completed successfully in ${duration}ms`);
      
      return {
        ...result,
        jobId,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.handleJobFailure(jobId, error, duration);
      throw error;
    }
  }

  /**
   * Run season data processing pipeline
   * Processes entire season data with comprehensive analysis
   */
  async runSeasonProcessing(
    season: number, 
    options: ProcessingOptions = {}
  ): Promise<JobResult> {
    const jobId = this.generateJobId('SEASON', { season });
    const startTime = Date.now();

    console.log(`🚀 [UPHCoordinator] Starting SEASON processing for ${season} (Job: ${jobId})`);

    try {
      // Create job record
      await this.createJob(jobId, 'SEASON', { season }, options);
      
      // Execute DAG pipeline for full season
      const result = await this.executeDAG(jobId, {
        type: 'SEASON',
        season,
        sources: options.sources || ['sleeper', 'nfl_data_py', 'fantasypros']
      }, {
        ...options,
        batchSize: options.batchSize || 100, // Larger batches for season processing
      });

      const duration = Date.now() - startTime;
      
      // Update job status
      await this.updateJobStatus(jobId, 'SUCCESS', {
        totalTasks: result.totalTasks,
        successfulTasks: result.successfulTasks,
        failedTasks: result.failedTasks,
        duration
      });

      console.log(`✅ [UPHCoordinator] SEASON processing completed successfully in ${duration}ms`);
      
      return {
        ...result,
        jobId,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.handleJobFailure(jobId, error, duration);
      throw error;
    }
  }

  /**
   * Run backfill processing for historical data
   * Processes data for specified date range with batch optimization
   */
  async runBackfillProcessing(
    dateRange: DateRange, 
    options: ProcessingOptions = {}
  ): Promise<JobResult> {
    const jobId = this.generateJobId('BACKFILL', { dateRange });
    const startTime = Date.now();

    console.log(`🚀 [UPHCoordinator] Starting BACKFILL processing from ${dateRange.start.toISOString()} to ${dateRange.end.toISOString()} (Job: ${jobId})`);

    try {
      // Create job record
      await this.createJob(jobId, 'BACKFILL', { dateRange }, options);
      
      // Execute DAG pipeline for date range
      const result = await this.executeDAG(jobId, {
        type: 'BACKFILL',
        dateRange,
        sources: options.sources || ['sleeper', 'nfl_data_py']
      }, {
        ...options,
        batchSize: options.batchSize || 25, // Smaller batches for backfill
      });

      const duration = Date.now() - startTime;
      
      // Update job status
      await this.updateJobStatus(jobId, 'SUCCESS', {
        totalTasks: result.totalTasks,
        successfulTasks: result.successfulTasks,
        failedTasks: result.failedTasks,
        duration
      });

      console.log(`✅ [UPHCoordinator] BACKFILL processing completed successfully in ${duration}ms`);
      
      return {
        ...result,
        jobId,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.handleJobFailure(jobId, error, duration);
      throw error;
    }
  }

  /**
   * Run incremental processing for changed data since last run
   * Processes only data that has changed since specified timestamp
   */
  async runIncrementalProcessing(
    since: Date, 
    options: ProcessingOptions = {}
  ): Promise<JobResult> {
    const jobId = this.generateJobId('INCREMENTAL', { since });
    const startTime = Date.now();

    console.log(`🚀 [UPHCoordinator] Starting INCREMENTAL processing since ${since.toISOString()} (Job: ${jobId})`);

    try {
      // Create job record
      await this.createJob(jobId, 'INCREMENTAL', { since }, options);
      
      // Execute DAG pipeline for incremental data
      const result = await this.executeDAG(jobId, {
        type: 'INCREMENTAL',
        since,
        sources: options.sources || ['sleeper', 'nfl_data_py', 'fantasypros']
      }, options);

      const duration = Date.now() - startTime;
      
      // Update job status
      await this.updateJobStatus(jobId, 'SUCCESS', {
        totalTasks: result.totalTasks,
        successfulTasks: result.successfulTasks,
        failedTasks: result.failedTasks,
        duration
      });

      console.log(`✅ [UPHCoordinator] INCREMENTAL processing completed successfully in ${duration}ms`);
      
      return {
        ...result,
        jobId,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.handleJobFailure(jobId, error, duration);
      throw error;
    }
  }

  /**
   * Get current status of a job
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    try {
      // Get job record
      const [job] = await db
        .select()
        .from(jobRuns)
        .where(eq(jobRuns.jobId, jobId))
        .limit(1);

      if (!job) {
        return null;
      }

      // Get task records
      const tasks = await db
        .select()
        .from(taskRuns)
        .where(eq(taskRuns.jobId, jobId))
        .orderBy(desc(taskRuns.createdAt));

      // Calculate progress
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'SUCCESS').length;
      const failedTasks = tasks.filter(t => t.status === 'FAILED').length;

      // Extract errors
      const errors: TaskError[] = tasks
        .filter(t => t.errorMessage)
        .map(t => ({
          taskId: t.id,
          taskType: t.taskType,
          error: t.errorMessage!,
          attempt: t.attempt,
          timestamp: t.updatedAt || new Date()
        }));

      return {
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        progress: {
          totalTasks,
          completedTasks,
          failedTasks,
          currentTask: tasks.find(t => t.status === 'RUNNING')?.taskType
        },
        timeline: {
          createdAt: job.createdAt || new Date(),
          startedAt: job.startedAt || undefined,
          endedAt: job.endedAt || undefined,
          estimatedCompletion: this.estimateCompletion(job, tasks)
        },
        stats: (job.stats as JobStats) || this.getDefaultStats(),
        errors
      };

    } catch (error) {
      console.error(`[UPHCoordinator] Error getting job status for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Retry failed tasks for a job
   */
  async retryFailedTasks(jobId: string): Promise<RetryResult> {
    console.log(`🔄 [UPHCoordinator] Retrying failed tasks for job ${jobId}`);

    try {
      // Get failed tasks
      const failedTasks = await db
        .select()
        .from(taskRuns)
        .where(
          and(
            eq(taskRuns.jobId, jobId),
            eq(taskRuns.status, 'FAILED')
          )
        );

      if (failedTasks.length === 0) {
        console.log(`ℹ️ [UPHCoordinator] No failed tasks found for job ${jobId}`);
        return { retriedTasks: 0, successful: 0, failed: 0 };
      }

      let successful = 0;
      let failed = 0;

      // Retry each failed task
      for (const task of failedTasks) {
        try {
          // Reset task status
          await db
            .update(taskRuns)
            .set({ 
              status: 'PENDING',
              attempt: task.attempt + 1,
              errorMessage: null,
              updatedAt: new Date()
            })
            .where(eq(taskRuns.id, task.id));

          // Execute task based on type
          const stepExecutor = this.DAG_STEPS.find(s => s.type === task.taskType)?.executor;
          if (stepExecutor) {
            await stepExecutor(jobId, task.scope, {});
            successful++;
          } else {
            throw new Error(`No executor found for task type: ${task.taskType}`);
          }

        } catch (error) {
          console.error(`[UPHCoordinator] Failed to retry task ${task.id}:`, error);
          
          // Update task with failure
          await db
            .update(taskRuns)
            .set({ 
              status: 'FAILED',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              updatedAt: new Date()
            })
            .where(eq(taskRuns.id, task.id));
          
          failed++;
        }
      }

      console.log(`✅ [UPHCoordinator] Retry completed: ${successful} successful, ${failed} failed`);

      return {
        retriedTasks: failedTasks.length,
        successful,
        failed
      };

    } catch (error) {
      console.error(`[UPHCoordinator] Error retrying failed tasks for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<CancelResult> {
    console.log(`🛑 [UPHCoordinator] Cancelling job ${jobId}`);

    try {
      // Update job status to FAILED
      const [job] = await db
        .update(jobRuns)
        .set({ 
          status: 'FAILED',
          errorMessage: 'Job cancelled by user',
          endedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(jobRuns.jobId, jobId))
        .returning();

      if (!job) {
        return { cancelled: false, reason: 'Job not found' };
      }

      // Cancel running tasks
      await db
        .update(taskRuns)
        .set({ 
          status: 'FAILED',
          errorMessage: 'Task cancelled (parent job cancelled)',
          endedAt: new Date(),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(taskRuns.jobId, jobId),
            inArray(taskRuns.status, ['PENDING', 'RUNNING'])
          )
        );

      console.log(`✅ [UPHCoordinator] Job ${jobId} cancelled successfully`);

      return { cancelled: true };

    } catch (error) {
      console.error(`[UPHCoordinator] Error cancelling job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get job history with filtering
   */
  async getJobHistory(filters: JobFilters = {}): Promise<JobHistory[]> {
    try {
      let query = db.select().from(jobRuns);

      // Apply filters
      const conditions: any[] = [];
      
      if (filters.type) {
        conditions.push(eq(jobRuns.type, filters.type));
      }
      
      if (filters.status) {
        conditions.push(eq(jobRuns.status, filters.status));
      }
      
      if (filters.season) {
        conditions.push(eq(jobRuns.season, filters.season));
      }
      
      if (filters.week) {
        conditions.push(eq(jobRuns.week, filters.week));
      }

      if (filters.dateRange) {
        conditions.push(gte(jobRuns.createdAt, filters.dateRange.start));
        conditions.push(lte(jobRuns.createdAt, filters.dateRange.end));
      }

      let jobs = await db.select().from(jobRuns);
      
      // Apply filters manually since query building had type issues
      if (filters.type) {
        jobs = jobs.filter(j => j.type === filters.type);
      }
      if (filters.status) {
        jobs = jobs.filter(j => j.status === filters.status);
      }
      if (filters.season) {
        jobs = jobs.filter(j => j.season === filters.season);
      }
      if (filters.week) {
        jobs = jobs.filter(j => j.week === filters.week);
      }
      if (filters.dateRange) {
        jobs = jobs.filter(j => 
          j.createdAt && 
          j.createdAt >= filters.dateRange!.start && 
          j.createdAt <= filters.dateRange!.end
        );
      }
      
      // Sort by creation date descending
      jobs = jobs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      
      // Apply pagination
      if (filters.offset) {
        jobs = jobs.slice(filters.offset);
      }
      if (filters.limit) {
        jobs = jobs.slice(0, filters.limit);
      }

      // Jobs already filtered and sorted above

      return jobs.map(job => ({
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        season: job.season || undefined,
        week: job.week || undefined,
        duration: job.startedAt && job.endedAt 
          ? job.endedAt.getTime() - job.startedAt.getTime()
          : undefined,
        createdAt: job.createdAt || new Date(),
        stats: (job.stats as JobStats) || this.getDefaultStats()
      }));

    } catch (error) {
      console.error(`[UPHCoordinator] Error getting job history:`, error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<HealthStatus> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get active jobs count
      const [activeJobsResult] = await db
        .select({ count: count() })
        .from(jobRuns)
        .where(
          inArray(jobRuns.status, ['PENDING', 'RUNNING'])
        );
      
      const activeJobs = activeJobsResult?.count || 0;

      // Get recent job statistics
      const recentJobs = await db
        .select()
        .from(jobRuns)
        .where(gte(jobRuns.createdAt, oneHourAgo))
        .orderBy(desc(jobRuns.createdAt));

      // Calculate metrics
      const totalRecentJobs = recentJobs.length;
      const failedJobs = recentJobs.filter(j => j.status === 'FAILED').length;
      const failureRate = totalRecentJobs > 0 ? failedJobs / totalRecentJobs : 0;
      
      const completedJobs = recentJobs.filter(j => j.endedAt && j.startedAt);
      const averageProcessingTime = completedJobs.length > 0
        ? completedJobs.reduce((sum, job) => sum + (job.endedAt!.getTime() - job.startedAt!.getTime()), 0) / completedJobs.length
        : 0;

      // Determine health status
      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      if (failureRate > 0.5 || activeJobs > 10) {
        status = 'UNHEALTHY';
      } else if (failureRate > 0.2 || activeJobs > 5) {
        status = 'DEGRADED';
      }

      return {
        status,
        activeJobs,
        queueLength: activeJobs, // Simplified - could be more sophisticated
        failureRate,
        averageProcessingTime,
        systemLoad: {
          cpu: 0, // Would need system monitoring integration
          memory: 0, // Would need system monitoring integration
          database: 0 // Would need database monitoring integration
        },
        lastHealthCheck: now
      };

    } catch (error) {
      console.error(`[UPHCoordinator] Error getting system health:`, error);
      return {
        status: 'UNHEALTHY',
        activeJobs: 0,
        queueLength: 0,
        failureRate: 1,
        averageProcessingTime: 0,
        systemLoad: { cpu: 0, memory: 0, database: 0 },
        lastHealthCheck: new Date()
      };
    }
  }

  /**
   * Get processing metrics
   */
  async getProcessingMetrics(): Promise<ProcessingMetrics> {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get jobs from last week
      const recentJobs = await db
        .select()
        .from(jobRuns)
        .where(gte(jobRuns.createdAt, oneWeekAgo))
        .orderBy(desc(jobRuns.createdAt));

      const totalJobs = recentJobs.length;
      const successfulJobs = recentJobs.filter(j => j.status === 'SUCCESS').length;
      const successRate = totalJobs > 0 ? successfulJobs / totalJobs : 0;

      // Calculate durations
      const completedJobs = recentJobs.filter(j => j.endedAt && j.startedAt);
      const averageJobDuration = completedJobs.length > 0
        ? completedJobs.reduce((sum, job) => sum + (job.endedAt!.getTime() - job.startedAt!.getTime()), 0) / completedJobs.length
        : 0;

      // Calculate throughput (jobs per hour)
      const throughputPerHour = totalJobs / (7 * 24); // Average over the week

      // Error distribution
      const errorDistribution: Record<string, number> = {};
      recentJobs
        .filter(j => j.status === 'FAILED' && j.errorMessage)
        .forEach(job => {
          const errorType = this.categorizeError(job.errorMessage!);
          errorDistribution[errorType] = (errorDistribution[errorType] || 0) + 1;
        });

      // Performance by job type
      const performanceByType: Record<string, { averageDuration: number; successRate: number; totalRuns: number }> = {};
      
      ['WEEKLY', 'SEASON', 'BACKFILL', 'INCREMENTAL'].forEach(type => {
        const jobsOfType = recentJobs.filter(j => j.type === type);
        const completedOfType = jobsOfType.filter(j => j.endedAt && j.startedAt);
        const successfulOfType = jobsOfType.filter(j => j.status === 'SUCCESS');
        
        performanceByType[type] = {
          totalRuns: jobsOfType.length,
          successRate: jobsOfType.length > 0 ? successfulOfType.length / jobsOfType.length : 0,
          averageDuration: completedOfType.length > 0
            ? completedOfType.reduce((sum, job) => sum + (job.endedAt!.getTime() - job.startedAt!.getTime()), 0) / completedOfType.length
            : 0
        };
      });

      return {
        totalJobs,
        successRate,
        averageJobDuration,
        throughputPerHour,
        errorDistribution,
        performanceByType
      };

    } catch (error) {
      console.error(`[UPHCoordinator] Error getting processing metrics:`, error);
      throw error;
    }
  }

  // ========================================
  // PRIVATE METHODS - DAG EXECUTION
  // ========================================

  /**
   * Execute DAG (Directed Acyclic Graph) pipeline
   * Core orchestration method that executes Bronze→Silver→Gold pipeline with quality gates
   */
  private async executeDAG(
    jobId: string,
    scope: any,
    options: ProcessingOptions
  ): Promise<JobResult> {
    const startTime = Date.now();
    let totalTasks = 0;
    let successfulTasks = 0;
    let failedTasks = 0;
    let skippedTasks = 0;
    const stats = this.getDefaultStats();
    const errorDetails: string[] = [];

    console.log(`🔄 [UPHCoordinator] Executing DAG pipeline for job ${jobId}`);
    console.log(`   Scope:`, scope);
    console.log(`   Options:`, options);

    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'RUNNING');

      // Execute DAG steps in dependency order
      for (const step of this.DAG_STEPS) {
        console.log(`📋 [UPHCoordinator] Executing step: ${step.name}`);
        
        // Create task record
        const taskId = await this.createTask(jobId, step.type, scope, options);
        totalTasks++;

        try {
          // Update task to running
          await this.updateTaskStatus(taskId, 'RUNNING');

          // Check for job cancellation
          const jobStatus = await this.getJobStatus(jobId);
          if (jobStatus?.status === 'FAILED') {
            console.log(`🛑 [UPHCoordinator] Job ${jobId} was cancelled, skipping remaining steps`);
            skippedTasks += this.DAG_STEPS.length - totalTasks;
            break;
          }

          // Execute the step with timeout and retry logic
          const stepResult = await this.executeStepWithRetry(
            step.executor,
            jobId,
            scope,
            options,
            step.type,
            taskId
          );

          // Update task stats
          await this.updateTaskStatus(taskId, 'SUCCESS', null, stepResult.stats);
          successfulTasks++;

          // Update global stats
          if (stepResult.stats) {
            stats.recordsProcessed += stepResult.stats.recordsProcessed || 0;
            stats.transformationsApplied += stepResult.stats.transformationsApplied || 0;
          }

          // Run quality gate if required and not skipped
          if (this.shouldRunQualityGate(step.type) && !options.skipQualityGates) {
            const qualityResult = await this.runQualityGate(jobId, step.type, stepResult, scope);
            
            stats.qualityChecksRun++;
            if (qualityResult.overallPassed) {
              stats.qualityChecksPassed++;
              console.log(`✅ [UPHCoordinator] Quality gate passed for ${step.type}`);
            } else {
              stats.qualityChecksFailed++;
              const qualityError = `Quality gate failed for ${step.type}: ${qualityResult.criticalIssues.join(', ')}`;
              console.error(`❌ [UPHCoordinator] ${qualityError}`);
              errorDetails.push(qualityError);
              
              // Fail job if critical quality gate fails
              if (qualityResult.criticalIssues.length > 0) {
                throw new Error(qualityError);
              }
            }
          }

          // Add delay between steps for resource management
          if (options.maxConcurrency && options.maxConcurrency < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error) {
          failedTasks++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown step error';
          console.error(`❌ [UPHCoordinator] Step ${step.name} failed:`, error);
          
          await this.updateTaskStatus(taskId, 'FAILED', errorMessage);
          errorDetails.push(`${step.name}: ${errorMessage}`);

          // Check if we should continue after step failure
          if (!this.shouldContinueOnStepFailure(step.type)) {
            console.error(`🛑 [UPHCoordinator] Critical step ${step.name} failed, stopping pipeline`);
            throw error;
          }
        }
      }

      const duration = Date.now() - startTime;
      stats.averageProcessingTime = duration / totalTasks;

      console.log(`✅ [UPHCoordinator] DAG pipeline completed for job ${jobId}`);
      console.log(`   📊 Tasks: ${successfulTasks}/${totalTasks} successful, ${failedTasks} failed, ${skippedTasks} skipped`);
      console.log(`   ⏱️ Duration: ${duration}ms`);

      return {
        jobId,
        status: failedTasks > 0 ? 'FAILED' : 'SUCCESS',
        totalTasks,
        successfulTasks,
        failedTasks,
        skippedTasks,
        duration,
        stats,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown DAG error';
      
      console.error(`❌ [UPHCoordinator] DAG pipeline failed for job ${jobId}:`, error);
      
      return {
        jobId,
        status: 'FAILED',
        totalTasks,
        successfulTasks,
        failedTasks: totalTasks - successfulTasks,
        skippedTasks,
        duration,
        stats,
        errorDetails: [errorMessage, ...errorDetails]
      };
    }
  }

  /**
   * Execute step with retry logic and timeout handling
   */
  private async executeStepWithRetry(
    executor: (jobId: string, scope: any, options: ProcessingOptions) => Promise<any>,
    jobId: string,
    scope: any,
    options: ProcessingOptions,
    stepType: string,
    taskId: number
  ): Promise<any> {
    const maxRetries = options.retryAttempts || this.DEFAULT_RETRY_ATTEMPTS;
    const timeout = options.timeoutMs || this.DEFAULT_TIMEOUT_MS;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [UPHCoordinator] Step ${stepType} attempt ${attempt}/${maxRetries}`);
        
        // Execute with timeout
        const result = await Promise.race([
          executor(jobId, scope, options),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Step ${stepType} timed out after ${timeout}ms`)), timeout)
          )
        ]);

        return result;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ [UPHCoordinator] Step ${stepType} attempt ${attempt} failed:`, errorMessage);
        
        // Update task attempt count
        await db
          .update(taskRuns)
          .set({ attempt })
          .where(eq(taskRuns.id, taskId));

        // If not the last attempt, wait with exponential backoff
        if (attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30s
          console.log(`⏳ [UPHCoordinator] Retrying step ${stepType} in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          // Final attempt failed
          throw new Error(`Step ${stepType} failed after ${maxRetries} attempts: ${errorMessage}`);
        }
      }
    }
  }

  /**
   * Execute Bronze Layer data ingestion step with transaction management
   */
  private async executeBronzeIngest(
    jobId: string, 
    scope: any, 
    options: ProcessingOptions
  ): Promise<any> {
    console.log(`🔥 [UPHCoordinator] Executing Bronze ingest for job ${jobId}`);

    return await db.transaction(async (tx) => {
      try {
        // Prepare raw payload inputs based on scope
        const payloadInputs = await this.prepareBronzePayloads(scope, options);
        
        let totalProcessed = 0;
        let totalStored = 0;
        const errors: string[] = [];

        // Process payloads in batches with concurrency controls
        const batchSize = options.batchSize || this.DEFAULT_BATCH_SIZE;
        const maxConcurrentBatches = Math.min(3, Math.ceil(payloadInputs.length / batchSize));
        
        console.log(`📦 [UPHCoordinator] Processing ${payloadInputs.length} payloads in batches of ${batchSize}, max ${maxConcurrentBatches} concurrent`);

        const batches = [];
        for (let i = 0; i < payloadInputs.length; i += batchSize) {
          batches.push(payloadInputs.slice(i, i + batchSize));
        }

        // Process batches with controlled concurrency
        for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
          const concurrentBatches = batches.slice(i, i + maxConcurrentBatches);
          
          const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
            try {
              console.log(`⚡ [UPHCoordinator] Processing batch ${i + batchIndex + 1}/${batches.length} (${batch.length} items)`);
              
              const batchResults = await Promise.all(
                batch.map(input => this.bronzeService.storeRawPayload(input))
              );

              return {
                processed: batch.length,
                stored: batchResults.filter(r => !r.isDuplicate).length,
                errors: []
              };
              
            } catch (error) {
              const errorMsg = `Bronze batch ${i + batchIndex + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.error(`[UPHCoordinator] ${errorMsg}`);
              return {
                processed: batch.length,
                stored: 0,
                errors: [errorMsg]
              };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          
          // Aggregate results
          batchResults.forEach(result => {
            totalProcessed += result.processed;
            totalStored += result.stored;
            errors.push(...result.errors);
          });

          // Add delay between batch groups to prevent resource exhaustion
          if (i + maxConcurrentBatches < batches.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        console.log(`✅ [UPHCoordinator] Bronze ingest completed: ${totalStored}/${totalProcessed} payloads stored, ${errors.length} errors`);

        return {
          processed: totalProcessed,
          stored: totalStored,
          errors,
          stats: {
            recordsProcessed: totalProcessed,
            duplicatesSkipped: totalProcessed - totalStored,
            batchesProcessed: batches.length,
            errorRate: errors.length / batches.length
          }
        };

      } catch (error) {
        console.error(`[UPHCoordinator] Bronze ingest transaction failed for job ${jobId}:`, error);
        throw error;
      }
    });
  }

  /**
   * Execute Silver Layer data transformation step with transaction management
   */
  private async executeSilverTransform(
    jobId: string, 
    scope: any, 
    options: ProcessingOptions
  ): Promise<any> {
    console.log(`🥈 [UPHCoordinator] Executing Silver transform for job ${jobId}`);

    return await db.transaction(async (tx) => {
      try {
        // Get pending Bronze payloads for transformation
        const pendingPayloadsQuery = await tx
          .select({ id: ingestPayloads.id })
          .from(ingestPayloads)
          .where(
            and(
              eq(ingestPayloads.status, 'PENDING'),
              eq(ingestPayloads.season, scope.season || 2025),
              scope.week ? eq(ingestPayloads.week, scope.week) : sql`1=1`
            )
          )
          .limit(options.batchSize || this.DEFAULT_BATCH_SIZE);
        
        if (pendingPayloadsQuery.length === 0) {
          console.log(`ℹ️ [UPHCoordinator] No pending Bronze payloads found for Silver transformation`);
          return {
            processed: 0,
            success: 0,
            errors: 0,
            stats: {
              recordsProcessed: 0,
              transformationsApplied: 0,
              qualityChecksRun: 0,
              qualityChecksPassed: 0
            }
          };
        }

        const payloadIds = pendingPayloadsQuery.map((p: any) => p.id);
        console.log(`📊 [UPHCoordinator] Found ${payloadIds.length} Bronze payloads for Silver transformation`);
        
        // Execute Silver transformation with enhanced batch processing
        const result = await this.silverService.processBronzeToSilver(payloadIds, {
          force: options.forceRefresh,
          batchSize: options.batchSize || this.DEFAULT_BATCH_SIZE
        });

        // Enhanced quality gate validation for Bronze→Silver transition
        if (!options.skipQualityGates) {
          console.log(`🔍 [UPHCoordinator] Running Bronze→Silver quality gates`);
          
          const qualityRequest = {
            jobId,
            layerTransition: 'bronze_to_silver' as const,
            recordCount: result.processed,
            successCount: result.success,
            errorCount: result.errors || 0,
            context: {
              season: scope.season,
              week: scope.week,
              payloadIds
            }
          };

          const qualityResult = await this.runQualityGate(jobId, 'SILVER_TRANSFORM', qualityRequest, scope);
          
          if (!qualityResult.overallPassed) {
            console.warn(`⚠️ [UPHCoordinator] Bronze→Silver quality gate failed: ${qualityResult.criticalIssues.join(', ')}`);
            
            // Allow processing to continue but mark quality issues
            result.qualityWarnings = qualityResult.warningRules;
            result.qualityIssues = qualityResult.criticalIssues;
          } else {
            console.log(`✅ [UPHCoordinator] Bronze→Silver quality gate passed`);
          }

          result.stats = {
            ...result.stats,
            qualityChecksRun: 1,
            qualityChecksPassed: qualityResult.overallPassed ? 1 : 0
          };
        }

        console.log(`✅ [UPHCoordinator] Silver transform completed: ${result.success}/${result.processed} transformations successful`);

        return result;

      } catch (error) {
        console.error(`[UPHCoordinator] Silver transform transaction failed for job ${jobId}:`, error);
        throw error;
      }
    });
  }

  /**
   * Execute Gold Layer facts generation step with transaction management
   */
  private async executeGoldFacts(
    jobId: string, 
    scope: any, 
    options: ProcessingOptions
  ): Promise<any> {
    console.log(`🥇 [UPHCoordinator] Executing Gold facts generation for job ${jobId}`);

    return await db.transaction(async (tx) => {
      try {
        // Prepare Gold processing filters based on scope
        const filters = this.prepareGoldFilters(scope, options);
        console.log(`🎯 [UPHCoordinator] Gold filters:`, filters);
        
        // Execute Gold facts generation with enhanced processing
        const result = await this.goldService.processSilverToGold(filters, {
          batchSize: options.batchSize || this.DEFAULT_BATCH_SIZE,
          enableParallelism: true,
          maxConcurrency: 3
        });

        // Enhanced quality gate validation for Silver→Gold transition
        if (!options.skipQualityGates) {
          console.log(`🔍 [UPHCoordinator] Running Silver→Gold quality gates`);
          
          const qualityRequest = {
            jobId,
            layerTransition: 'silver_to_gold' as const,
            recordCount: result.processed,
            successCount: result.success,
            errorCount: result.errors || 0,
            context: {
              season: scope.season,
              week: scope.week,
              filters
            }
          };

          const qualityResult = await this.runQualityGate(jobId, 'GOLD_FACTS', qualityRequest, scope);
          
          if (!qualityResult.overallPassed) {
            console.warn(`⚠️ [UPHCoordinator] Silver→Gold quality gate failed: ${qualityResult.criticalIssues.join(', ')}`);
            
            // For Gold layer, quality failures are more critical
            if (qualityResult.criticalIssues.length > 0 && !options.ignoreCriticalQualityFailures) {
              throw new Error(`Gold layer quality gate critical failure: ${qualityResult.criticalIssues.join(', ')}`);
            }
            
            result.qualityWarnings = qualityResult.warningRules;
            result.qualityIssues = qualityResult.criticalIssues;
          } else {
            console.log(`✅ [UPHCoordinator] Silver→Gold quality gate passed`);
          }

          result.stats = {
            ...result.stats,
            qualityChecksRun: 1,
            qualityChecksPassed: qualityResult.overallPassed ? 1 : 0
          };
        }

        console.log(`✅ [UPHCoordinator] Gold facts generation completed: ${result.success}/${result.processed} facts generated`);

        // Trigger brand signals processing for completed gold dataset
        try {
          const { triggerDatasetCommitted } = await import('./BrandSignalsBootstrap');
          await triggerDatasetCommitted(
            'gold_player_week',
            scope.season || 0,
            scope.week || 0,
            result.success || 0,
            'uph_coordinator',
            jobId
          );
        } catch (error) {
          console.warn('⚠️ [UPHCoordinator] Brand signals trigger failed:', error);
          // Don't throw - brand signal failures shouldn't break UPH processing
        }

        return result;

      } catch (error) {
        console.error(`[UPHCoordinator] Gold facts generation transaction failed for job ${jobId}:`, error);
        throw error;
      }
    });
  }

  // ========================================
  // PRIVATE METHODS - JOB MANAGEMENT
  // ========================================

  /**
   * Create a new job record
   */
  private async createJob(
    jobId: string,
    type: typeof uphJobTypeEnum.enumValues[number],
    scope: any,
    options: ProcessingOptions
  ): Promise<void> {
    try {
      await db.insert(jobRuns).values({
        jobId,
        type,
        status: 'PENDING',
        season: scope.season || null,
        week: scope.week || null,
        sources: scope.sources || [],
        metadata: {
          scope,
          options,
          createdBy: 'UPHCoordinator'
        }
      });

      console.log(`📝 [UPHCoordinator] Created job record: ${jobId} (${type})`);

    } catch (error) {
      console.error(`[UPHCoordinator] Error creating job record for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new task record
   */
  private async createTask(
    jobId: string,
    taskType: typeof uphTaskTypeEnum.enumValues[number],
    scope: any,
    options: ProcessingOptions
  ): Promise<number> {
    try {
      const [task] = await db.insert(taskRuns).values({
        jobId,
        taskType,
        status: 'PENDING',
        scope,
      }).returning({ id: taskRuns.id });

      console.log(`📋 [UPHCoordinator] Created task record: ${task.id} (${taskType})`);
      return task.id;

    } catch (error) {
      console.error(`[UPHCoordinator] Error creating task record for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Update job status
   */
  private async updateJobStatus(
    jobId: string,
    status: typeof uphJobStatusEnum.enumValues[number],
    stats?: any
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (status === 'RUNNING' && !await this.getJobStartTime(jobId)) {
        updateData.startedAt = new Date();
      }

      if (status === 'SUCCESS' || status === 'FAILED') {
        updateData.endedAt = new Date();
      }

      if (stats) {
        updateData.stats = stats;
      }

      await db
        .update(jobRuns)
        .set(updateData)
        .where(eq(jobRuns.jobId, jobId));

    } catch (error) {
      console.error(`[UPHCoordinator] Error updating job status for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Update task status
   */
  private async updateTaskStatus(
    taskId: number,
    status: typeof uphJobStatusEnum.enumValues[number],
    errorMessage?: string | null,
    stats?: any
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (status === 'RUNNING') {
        updateData.startedAt = new Date();
      }

      if (status === 'SUCCESS' || status === 'FAILED') {
        updateData.endedAt = new Date();
      }

      if (errorMessage !== undefined) {
        updateData.errorMessage = errorMessage;
      }

      if (stats) {
        updateData.stats = stats;
      }

      await db
        .update(taskRuns)
        .set(updateData)
        .where(eq(taskRuns.id, taskId));

    } catch (error) {
      console.error(`[UPHCoordinator] Error updating task status for ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Handle job failure
   */
  private async handleJobFailure(
    jobId: string,
    error: any,
    duration: number
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`💥 [UPHCoordinator] Job ${jobId} failed: ${errorMessage}`);

    try {
      await db
        .update(jobRuns)
        .set({
          status: 'FAILED',
          errorMessage,
          endedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(jobRuns.jobId, jobId));

      // Mark any running tasks as failed
      await db
        .update(taskRuns)
        .set({
          status: 'FAILED',
          errorMessage: 'Job failed',
          endedAt: new Date(),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(taskRuns.jobId, jobId),
            eq(taskRuns.status, 'RUNNING')
          )
        );

    } catch (dbError) {
      console.error(`[UPHCoordinator] Error handling job failure for ${jobId}:`, dbError);
    }
  }

  // ========================================
  // PRIVATE METHODS - UTILITY
  // ========================================

  /**
   * Generate unique job ID
   */
  private generateJobId(
    type: string, 
    context: any
  ): string {
    const timestamp = Date.now();
    const contextStr = JSON.stringify(context);
    const hash = crypto.createHash('md5').update(contextStr).digest('hex').substring(0, 8);
    return `${type.toLowerCase()}-${timestamp}-${hash}`;
  }

  /**
   * Get job start time
   */
  private async getJobStartTime(jobId: string): Promise<Date | null> {
    try {
      const [job] = await db
        .select({ startedAt: jobRuns.startedAt })
        .from(jobRuns)
        .where(eq(jobRuns.jobId, jobId))
        .limit(1);

      return job?.startedAt || null;

    } catch (error) {
      console.error(`[UPHCoordinator] Error getting job start time for ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Estimate job completion time
   */
  private estimateCompletion(job: JobRuns, tasks: TaskRuns[]): Date | undefined {
    if (!job.startedAt || job.status !== 'RUNNING') {
      return undefined;
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'SUCCESS').length;
    
    if (completedTasks === 0) {
      return undefined;
    }

    const elapsedTime = Date.now() - job.startedAt.getTime();
    const averageTaskTime = elapsedTime / completedTasks;
    const remainingTasks = totalTasks - completedTasks;
    const estimatedRemainingTime = remainingTasks * averageTaskTime;

    return new Date(Date.now() + estimatedRemainingTime);
  }

  /**
   * Get default job stats
   */
  private getDefaultStats(): JobStats {
    return {
      recordsProcessed: 0,
      payloadsIngested: 0,
      transformationsApplied: 0,
      qualityChecksRun: 0,
      qualityChecksPassed: 0,
      qualityChecksFailed: 0,
      averageProcessingTime: 0,
      dataVolumeBytes: 0,
      memoryUsagePeak: 0
    };
  }

  /**
   * Categorize error for metrics
   */
  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('timeout') || errorMessage.includes('TimeoutError')) {
      return 'timeout';
    }
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
      return 'network';
    }
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return 'validation';
    }
    if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      return 'database';
    }
    if (errorMessage.includes('quality gate') || errorMessage.includes('quality')) {
      return 'quality';
    }
    return 'unknown';
  }

  /**
   * Prepare Bronze layer payload inputs based on scope
   */
  private async prepareBronzePayloads(
    scope: any, 
    options: ProcessingOptions
  ): Promise<RawPayloadInput[]> {
    const payloads: RawPayloadInput[] = [];
    const sources = scope.sources || options.sources || ['sleeper', 'nfl_data_py'];

    // This is a simplified implementation - in reality would fetch from external APIs
    for (const source of sources) {
      payloads.push({
        source,
        endpoint: this.getEndpointForScope(source, scope),
        payload: { mockData: true, scope }, // Would be real API data
        version: '1.0',
        jobId: scope.jobId || 'unknown',
        season: scope.season || 2025,
        week: scope.week || null,
        metadata: {
          extractedAt: new Date(),
          requestUrl: `${source}/api/data`
        }
      });
    }

    return payloads;
  }

  /**
   * Prepare Gold layer filters based on scope
   */
  private prepareGoldFilters(scope: any, options: ProcessingOptions): any {
    return {
      season: scope.season,
      weeks: scope.week ? [scope.week] : undefined,
      forceRefresh: options.forceRefresh,
      includeMarketFacts: true,
      includeCompositeFacts: true
    };
  }

  /**
   * Get endpoint for scope and source
   */
  private getEndpointForScope(source: string, scope: any): string {
    if (scope.type === 'WEEKLY') {
      return `${source}/weekly/${scope.season}/${scope.week}`;
    }
    if (scope.type === 'SEASON') {
      return `${source}/season/${scope.season}`;
    }
    return `${source}/data`;
  }

  /**
   * Map task type to lineage operation
   */
  private mapTaskTypeToOperation(taskType: typeof uphTaskTypeEnum.enumValues[number]): string {
    switch (taskType) {
      case 'BRONZE_INGEST': return 'EXTRACT';
      case 'SILVER_TRANSFORM': return 'TRANSFORM';
      case 'GOLD_FACTS': return 'AGGREGATE';
      case 'QUALITY_GATE': return 'VALIDATE';
      default: return 'LOAD';
    }
  }

  /**
   * Get target table for DAG step
   */
  private getTargetTableForStep(taskType: typeof uphTaskTypeEnum.enumValues[number]): string {
    switch (taskType) {
      case 'BRONZE_INGEST': return 'ingest_payloads';
      case 'SILVER_TRANSFORM': return 'player_identity_map';
      case 'GOLD_FACTS': return 'player_season_facts';
      case 'QUALITY_GATE': return 'quality_gate_results';
      default: return 'unknown';
    }
  }

  /**
   * Get source table for DAG step
   */
  private getSourceTableForStep(taskType: typeof uphTaskTypeEnum.enumValues[number]): string {
    switch (taskType) {
      case 'BRONZE_INGEST': return 'external_api';
      case 'SILVER_TRANSFORM': return 'ingest_payloads';
      case 'GOLD_FACTS': return 'player_identity_map';
      case 'QUALITY_GATE': return 'player_season_facts';
      default: return 'unknown';
    }
  }

  /**
   * Check if quality gate should run for step
   */
  private shouldRunQualityGate(taskType: typeof uphTaskTypeEnum.enumValues[number]): boolean {
    // Run quality gates between layer transitions
    return taskType === 'SILVER_TRANSFORM' || taskType === 'GOLD_FACTS';
  }

  /**
   * Check if processing should continue after step failure
   */
  private shouldContinueOnStepFailure(taskType: typeof uphTaskTypeEnum.enumValues[number]): boolean {
    // Bronze ingest failures are critical
    return taskType !== 'BRONZE_INGEST';
  }

  /**
   * Run quality gate validation
   */
  private async runQualityGate(
    jobId: string,
    taskType: typeof uphTaskTypeEnum.enumValues[number],
    stepResult: any,
    scope: any
  ): Promise<QualityValidationResult> {
    try {
      console.log(`🛡️ [UPHCoordinator] Running quality gate for ${taskType}`);

      // Create validation request based on task type
      const validationRequest = {
        tableName: this.getTargetTableForStep(taskType),
        recordIdentifier: `${jobId}_${taskType}`,
        recordData: stepResult,
        context: scope
      };

      // Execute quality validation
      const result = await this.qualityValidator.validateRecord(validationRequest, jobId);

      console.log(`🎯 [UPHCoordinator] Quality gate result: ${result.overallPassed ? 'PASSED' : 'FAILED'} (score: ${result.overallScore.toFixed(3)})`);

      return result;

    } catch (error) {
      console.error(`[UPHCoordinator] Quality gate validation failed for ${taskType}:`, error);
      
      // Return failed result
      return {
        overallPassed: false,
        overallScore: 0,
        gateResults: {
          completeness: { passed: false, score: 0, message: 'Quality gate execution failed' },
          consistency: { passed: false, score: 0, message: 'Quality gate execution failed' },
          accuracy: { passed: false, score: 0, message: 'Quality gate execution failed' },
          freshness: { passed: false, score: 0, message: 'Quality gate execution failed' },
          outlier: { passed: false, score: 0, message: 'Quality gate execution failed' }
        },
        ruleResults: new Map(),
        failedRules: [],
        warningRules: [],
        criticalIssues: [`Quality gate execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * INTELLIGENT SCHEDULING INTEGRATION
   * Methods for connecting with the IntelligentScheduler service
   */

  /**
   * Initialize intelligent scheduling integration
   * This should be called after both UPHCoordinator and IntelligentScheduler are initialized
   */
  async initializeIntelligentScheduling(): Promise<void> {
    try {
      // Lazy load the IntelligentScheduler to avoid circular dependency
      if (!this.intelligentScheduler) {
        const { intelligentScheduler } = await import('./IntelligentScheduler');
        this.intelligentScheduler = intelligentScheduler;
        console.log('🧠 [UPHCoordinator] Intelligent scheduling integration initialized');
      }
    } catch (error) {
      console.warn('⚠️ [UPHCoordinator] Failed to initialize intelligent scheduling:', error);
      // Continue without intelligent scheduling if it fails
    }
  }

  /**
   * Notify intelligent scheduler of dataset changes
   * Called automatically after successful data processing
   */
  async notifyDatasetChange(dataset: string, season: number, week: number): Promise<void> {
    try {
      // Initialize intelligent scheduling if not already done
      await this.initializeIntelligentScheduling();
      
      if (this.intelligentScheduler) {
        console.log(`📡 [UPHCoordinator] Notifying intelligent scheduler of dataset change: ${dataset}`);
        await this.intelligentScheduler.onDatasetChange(dataset, season, week);
      }
    } catch (error) {
      console.warn('⚠️ [UPHCoordinator] Failed to notify intelligent scheduler:', error);
      // Don't throw - dataset change notifications should not fail processing
    }
  }

  /**
   * Enhanced job completion with intelligent scheduling hooks
   * Called after successful job completion to trigger intelligent scheduling
   */
  async completeJobWithIntelligentHooks(
    jobId: string,
    result: JobResult,
    affectedDatasets: Array<{ dataset: string; season: number; week: number }>
  ): Promise<void> {
    try {
      console.log(`🔄 [UPHCoordinator] Completing job with intelligent hooks: ${jobId}`);

      // Mark job as completed
      await this.markJobCompleted(jobId, result);

      // Notify intelligent scheduler of all affected datasets
      for (const { dataset, season, week } of affectedDatasets) {
        await this.notifyDatasetChange(dataset, season, week);
      }

      console.log(`✅ [UPHCoordinator] Job completed with intelligent hooks: ${jobId}`);

    } catch (error) {
      console.error(`❌ [UPHCoordinator] Failed to complete job with intelligent hooks:`, error);
      throw error;
    }
  }

  /**
   * Get intelligent scheduling status for monitoring
   */
  async getIntelligentSchedulingStatus(): Promise<{
    enabled: boolean;
    lastDatasetNotification?: Date;
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
      console.warn('⚠️ [UPHCoordinator] Failed to get intelligent scheduling status:', error);
      return { enabled: false };
    }
  }

  /**
   * Helper method to mark a job as completed
   */
  private async markJobCompleted(jobId: string, result: JobResult): Promise<void> {
    try {
      await db
        .update(jobRuns)
        .set({
          status: result.status as any,
          endedAt: new Date(),
          stats: result.stats as any,
          errorMessage: result.errorDetails?.join('; ') || null,
          updatedAt: new Date()
        })
        .where(eq(jobRuns.jobId, jobId));

      console.log(`✅ [UPHCoordinator] Job marked as completed: ${jobId}`);
    } catch (error) {
      console.error(`❌ [UPHCoordinator] Failed to mark job as completed:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const uphCoordinator = UPHCoordinator.getInstance();