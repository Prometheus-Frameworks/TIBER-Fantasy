/**
 * MonitoringService - Lightweight observability with health & metrics endpoints
 * 
 * Provides comprehensive monitoring without "NASA stack" complexity.
 * Includes health checks, readiness validation, and Prometheus metrics export.
 * 
 * Core Features:
 * - /healthz: Process up, DB ping, queue reachable
 * - /readyz: Plus schema sync, last job run ≤ SLA
 * - /metrics: Prometheus format metrics
 * - Integration with UPH job tracking and schema drift service
 */

import { db } from '../db';
import { 
  monitoringJobRuns, 
  datasetVersions, 
  jobRuns, 
  schemaRegistry,
  type DatasetVersions,
  type MonitoringJobRuns
} from '@shared/schema';
import { desc, sql, count, and, gte } from 'drizzle-orm';
import client from 'prom-client';

// Prometheus Metrics Registry
const reg = new client.Registry();
client.collectDefaultMetrics({ register: reg });

// Custom Metrics
export const jobDuration = new client.Histogram({
  name: 'job_duration_seconds',
  help: 'Job execution duration in seconds',
  labelNames: ['job_name', 'status'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600, 1800], // 0.1s to 30min
  registers: [reg]
});

export const jobFails = new client.Counter({
  name: 'job_failures_total',
  help: 'Total number of job failures',
  labelNames: ['job_name', 'error_type'],
  registers: [reg]
});

export const rowsIngest = new client.Counter({
  name: 'rows_ingested_total',
  help: 'Total number of rows ingested',
  labelNames: ['dataset', 'source'],
  registers: [reg]
});

export const cacheHitRate = new client.Histogram({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type'],
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100],
  registers: [reg]
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [reg]
});

export const systemResourceUsage = new client.Gauge({
  name: 'system_resource_usage',
  help: 'System resource usage',
  labelNames: ['resource_type'],
  registers: [reg]
});

// Types
export interface HealthStatus {
  ok: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: HealthCheck;
    process: HealthCheck;
    services: HealthCheck;
  };
  timestamp: string;
  uptime: number;
}

export interface ReadinessStatus {
  ready: boolean;
  status: 'ready' | 'not_ready';
  checks: {
    health: HealthCheck;
    schema_sync: HealthCheck;
    recent_jobs: HealthCheck;
    sla_compliance: HealthCheck;
  };
  timestamp: string;
  details: {
    last_job_run?: Date;
    schema_drift?: boolean;
    job_failure_rate?: number;
  };
}

export interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  duration_ms: number;
  message?: string;
  details?: any;
}

export interface JobMetrics {
  total_runs: number;
  success_rate: number;
  avg_duration_ms: number;
  recent_failures: number;
  last_run?: Date;
}

export interface DatasetMetrics {
  total_versions: number;
  latest_season: number;
  latest_week: number;
  total_rows: number;
  last_commit?: Date;
}

export interface MetricsSnapshot {
  jobs: Record<string, JobMetrics>;
  datasets: Record<string, DatasetMetrics>;
  system: {
    uptime: number;
    memory_usage: number;
    cpu_usage: number;
  };
  timestamp: string;
}

/**
 * Monitoring Service
 * Handles health checks, readiness validation, and metrics collection
 */
export class MonitoringService {
  private static instance: MonitoringService;
  private startTime = new Date();
  
  // Configuration
  private readonly JOB_SLA_HOURS = parseInt(process.env.JOB_SLA_HOURS || '24', 10);
  private readonly FAILURE_RATE_THRESHOLD = parseFloat(process.env.FAILURE_RATE_THRESHOLD || '0.1');
  private readonly DB_TIMEOUT_MS = parseInt(process.env.DB_TIMEOUT_MS || '5000', 10);

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Get health status - basic system health
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    console.log('🏥 [MonitoringService] Performing health check...');
    
    const checks = {
      database: await this.checkDatabase(),
      process: await this.checkProcess(),
      services: await this.checkServices()
    };

    const allPassing = Object.values(checks).every(check => check.status === 'pass');
    const anyFailing = Object.values(checks).some(check => check.status === 'fail');
    
    const status: HealthStatus = {
      ok: allPassing,
      status: anyFailing ? 'unhealthy' : allPassing ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime.getTime()
    };

    const duration = Date.now() - startTime;
    console.log(`🏥 [MonitoringService] Health check completed in ${duration}ms - Status: ${status.status}`);
    
    return status;
  }

  /**
   * Get readiness status - comprehensive operational readiness
   */
  async getReadinessStatus(): Promise<ReadinessStatus> {
    const startTime = Date.now();
    
    console.log('🚀 [MonitoringService] Performing readiness check...');
    
    const healthStatus = await this.getHealthStatus();
    const checks = {
      health: {
        status: healthStatus.ok ? 'pass' : 'fail' as const,
        duration_ms: 0,
        message: healthStatus.ok ? 'All health checks passing' : 'Health checks failing'
      },
      schema_sync: await this.checkSchemaSync(),
      recent_jobs: await this.checkRecentJobs(),
      sla_compliance: await this.checkSLACompliance()
    };

    const allPassing = Object.values(checks).every(check => check.status === 'pass');
    
    // Get additional details
    const details = await this.getReadinessDetails();
    
    const status: ReadinessStatus = {
      ready: allPassing,
      status: allPassing ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
      details
    };

    const duration = Date.now() - startTime;
    console.log(`🚀 [MonitoringService] Readiness check completed in ${duration}ms - Status: ${status.status}`);
    
    return status;
  }

  /**
   * Get Prometheus metrics
   */
  async getMetrics(): Promise<string> {
    console.log('📊 [MonitoringService] Collecting Prometheus metrics...');
    
    // Update system metrics before export
    await this.updateSystemMetrics();
    
    return await reg.metrics();
  }

  /**
   * Get metrics snapshot for debugging
   */
  async getMetricsSnapshot(): Promise<MetricsSnapshot> {
    console.log('📸 [MonitoringService] Creating metrics snapshot...');
    
    const [jobMetrics, datasetMetrics, systemMetrics] = await Promise.all([
      this.getJobMetrics(),
      this.getDatasetMetrics(),
      this.getSystemMetrics()
    ]);

    return {
      jobs: jobMetrics,
      datasets: datasetMetrics,
      system: systemMetrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Record job execution metrics
   */
  async recordJobExecution(
    jobName: string, 
    status: 'success' | 'error', 
    durationMs: number, 
    details?: any
  ): Promise<void> {
    try {
      // Record in monitoring table
      await db.insert(monitoringJobRuns).values({
        jobName,
        status,
        startedAt: new Date(Date.now() - durationMs),
        finishedAt: new Date(),
        durationMs,
        details
      });

      // Update Prometheus metrics
      jobDuration.labels(jobName, status).observe(durationMs / 1000);
      
      if (status === 'error') {
        jobFails.labels(jobName, details?.error_type || 'unknown').inc();
      }

      console.log(`📝 [MonitoringService] Recorded job execution: ${jobName} (${status}, ${durationMs}ms)`);
    } catch (error) {
      console.error('❌ [MonitoringService] Failed to record job execution:', error);
    }
  }

  /**
   * Record dataset commit
   */
  async recordDatasetCommit(
    dataset: string,
    season: number,
    week: number,
    rowCount: number,
    source: string
  ): Promise<void> {
    try {
      await db.insert(datasetVersions).values({
        dataset,
        season,
        week,
        rowCount,
        source
      });

      // Update Prometheus metrics
      rowsIngest.labels(dataset, source).inc(rowCount);

      console.log(`📊 [MonitoringService] Recorded dataset commit: ${dataset} (${rowCount} rows)`);
    } catch (error) {
      console.error('❌ [MonitoringService] Failed to record dataset commit:', error);
    }
  }

  // Private health check methods
  
  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      // Simple ping test with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), this.DB_TIMEOUT_MS)
      );
      
      const pingPromise = db.execute(sql`SELECT 1 as ping`);
      
      await Promise.race([pingPromise, timeoutPromise]);
      
      return {
        status: 'pass',
        duration_ms: Date.now() - start,
        message: 'Database connection successful'
      };
    } catch (error) {
      return {
        status: 'fail',
        duration_ms: Date.now() - start,
        message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      };
    }
  }

  private async checkProcess(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Check if memory usage is reasonable (< 1GB)
      const memoryThreshold = 1024 * 1024 * 1024; // 1GB
      const memoryOk = memUsage.heapUsed < memoryThreshold;
      
      return {
        status: memoryOk ? 'pass' : 'warn',
        duration_ms: Date.now() - start,
        message: memoryOk ? 'Process health good' : 'High memory usage detected',
        details: { memUsage, cpuUsage }
      };
    } catch (error) {
      return {
        status: 'fail',
        duration_ms: Date.now() - start,
        message: `Process check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkServices(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      // Check critical services are available
      let servicesOk = true;
      const details: any = {};
      
      // Check if UPH services are available
      try {
        const { UPHScheduler } = await import('./UPHScheduler');
        const scheduler = UPHScheduler.getInstance();
        details.uphScheduler = 'available';
      } catch (error) {
        servicesOk = false;
        details.uphScheduler = 'unavailable';
      }
      
      return {
        status: servicesOk ? 'pass' : 'warn',
        duration_ms: Date.now() - start,
        message: servicesOk ? 'All services available' : 'Some services unavailable',
        details
      };
    } catch (error) {
      return {
        status: 'fail',
        duration_ms: Date.now() - start,
        message: `Services check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkSchemaSync(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const { SchemaDriftService } = await import('./SchemaDriftService');
      const schemaDriftService = new SchemaDriftService();
      
      const driftResult = await schemaDriftService.checkDrift();
      
      return {
        status: driftResult.hasDrift ? 'warn' : 'pass',
        duration_ms: Date.now() - start,
        message: driftResult.hasDrift ? 'Schema drift detected' : 'Schema in sync',
        details: driftResult
      };
    } catch (error) {
      return {
        status: 'fail',
        duration_ms: Date.now() - start,
        message: `Schema sync check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkRecentJobs(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const recentCutoff = new Date(Date.now() - (this.JOB_SLA_HOURS * 60 * 60 * 1000));
      
      const recentJobs = await db
        .select()
        .from(monitoringJobRuns)
        .where(gte(monitoringJobRuns.startedAt, recentCutoff))
        .orderBy(desc(monitoringJobRuns.startedAt))
        .limit(10);

      const hasRecentJobs = recentJobs.length > 0;
      const recentFailures = recentJobs.filter(job => job.status === 'error').length;
      
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = 'Recent jobs running normally';
      
      if (!hasRecentJobs) {
        status = 'warn';
        message = `No jobs run in last ${this.JOB_SLA_HOURS} hours`;
      } else if (recentFailures > recentJobs.length / 2) {
        status = 'fail';
        message = `High failure rate: ${recentFailures}/${recentJobs.length} recent jobs failed`;
      }
      
      return {
        status,
        duration_ms: Date.now() - start,
        message,
        details: { 
          recent_count: recentJobs.length, 
          failures: recentFailures,
          cutoff: recentCutoff.toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        duration_ms: Date.now() - start,
        message: `Recent jobs check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkSLACompliance(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const slaCutoff = new Date(Date.now() - (this.JOB_SLA_HOURS * 60 * 60 * 1000));
      
      const totalJobs = await db
        .select({ count: count() })
        .from(monitoringJobRuns)
        .where(gte(monitoringJobRuns.startedAt, slaCutoff));

      const failedJobs = await db
        .select({ count: count() })
        .from(monitoringJobRuns)
        .where(
          and(
            gte(monitoringJobRuns.startedAt, slaCutoff),
            sql`status = 'error'`
          )
        );

      const totalCount = totalJobs[0]?.count || 0;
      const failedCount = failedJobs[0]?.count || 0;
      const failureRate = totalCount > 0 ? failedCount / totalCount : 0;
      
      const slaCompliant = failureRate <= this.FAILURE_RATE_THRESHOLD;
      
      return {
        status: slaCompliant ? 'pass' : 'fail',
        duration_ms: Date.now() - start,
        message: slaCompliant 
          ? `SLA compliant (${(failureRate * 100).toFixed(1)}% failure rate)` 
          : `SLA breach (${(failureRate * 100).toFixed(1)}% failure rate)`,
        details: { 
          total_jobs: totalCount, 
          failed_jobs: failedCount, 
          failure_rate: failureRate,
          threshold: this.FAILURE_RATE_THRESHOLD
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        duration_ms: Date.now() - start,
        message: `SLA compliance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async getReadinessDetails() {
    try {
      const [lastJob, schemaDrift, jobMetrics] = await Promise.all([
        db.select().from(monitoringJobRuns).orderBy(desc(monitoringJobRuns.startedAt)).limit(1),
        this.checkSchemaSync(),
        this.getJobFailureRate()
      ]);

      return {
        last_job_run: lastJob[0]?.startedAt,
        schema_drift: schemaDrift.status !== 'pass',
        job_failure_rate: jobMetrics
      };
    } catch (error) {
      console.error('❌ [MonitoringService] Failed to get readiness details:', error);
      return {};
    }
  }

  private async getJobMetrics(): Promise<Record<string, JobMetrics>> {
    try {
      const jobs = await db
        .select({
          jobName: monitoringJobRuns.jobName,
          status: monitoringJobRuns.status,
          durationMs: monitoringJobRuns.durationMs,
          startedAt: monitoringJobRuns.startedAt
        })
        .from(monitoringJobRuns)
        .orderBy(desc(monitoringJobRuns.startedAt))
        .limit(1000);

      const jobMap: Record<string, JobMetrics> = {};
      
      for (const job of jobs) {
        if (!jobMap[job.jobName]) {
          jobMap[job.jobName] = {
            total_runs: 0,
            success_rate: 0,
            avg_duration_ms: 0,
            recent_failures: 0,
            last_run: undefined
          };
        }
        
        const metrics = jobMap[job.jobName];
        metrics.total_runs++;
        
        if (job.status === 'success') {
          // Success tracking handled in success_rate calculation
        } else {
          metrics.recent_failures++;
        }
        
        if (job.durationMs) {
          metrics.avg_duration_ms = (metrics.avg_duration_ms * (metrics.total_runs - 1) + job.durationMs) / metrics.total_runs;
        }
        
        if (!metrics.last_run || job.startedAt > metrics.last_run) {
          metrics.last_run = job.startedAt;
        }
      }
      
      // Calculate success rates
      for (const [jobName, metrics] of Object.entries(jobMap)) {
        const successCount = metrics.total_runs - metrics.recent_failures;
        metrics.success_rate = metrics.total_runs > 0 ? successCount / metrics.total_runs : 0;
      }
      
      return jobMap;
    } catch (error) {
      console.error('❌ [MonitoringService] Failed to get job metrics:', error);
      return {};
    }
  }

  private async getDatasetMetrics(): Promise<Record<string, DatasetMetrics>> {
    try {
      const datasets = await db
        .select({
          dataset: datasetVersions.dataset,
          season: datasetVersions.season,
          week: datasetVersions.week,
          rowCount: datasetVersions.rowCount,
          committedAt: datasetVersions.committedAt
        })
        .from(datasetVersions)
        .orderBy(desc(datasetVersions.committedAt))
        .limit(1000);

      const datasetMap: Record<string, DatasetMetrics> = {};
      
      for (const dataset of datasets) {
        if (!datasetMap[dataset.dataset]) {
          datasetMap[dataset.dataset] = {
            total_versions: 0,
            latest_season: 0,
            latest_week: 0,
            total_rows: 0,
            last_commit: undefined
          };
        }
        
        const metrics = datasetMap[dataset.dataset];
        metrics.total_versions++;
        metrics.total_rows += dataset.rowCount;
        
        if (dataset.season > metrics.latest_season || 
           (dataset.season === metrics.latest_season && dataset.week > metrics.latest_week)) {
          metrics.latest_season = dataset.season;
          metrics.latest_week = dataset.week;
        }
        
        if (!metrics.last_commit || dataset.committedAt > metrics.last_commit) {
          metrics.last_commit = dataset.committedAt;
        }
      }
      
      return datasetMap;
    } catch (error) {
      console.error('❌ [MonitoringService] Failed to get dataset metrics:', error);
      return {};
    }
  }

  private async getSystemMetrics() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      return {
        uptime: Date.now() - this.startTime.getTime(),
        memory_usage: memUsage.heapUsed,
        cpu_usage: cpuUsage.user + cpuUsage.system
      };
    } catch (error) {
      console.error('❌ [MonitoringService] Failed to get system metrics:', error);
      return {
        uptime: 0,
        memory_usage: 0,
        cpu_usage: 0
      };
    }
  }

  private async getJobFailureRate(): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - (this.JOB_SLA_HOURS * 60 * 60 * 1000));
      
      const totalJobs = await db
        .select({ count: count() })
        .from(monitoringJobRuns)
        .where(gte(monitoringJobRuns.startedAt, cutoff));

      const failedJobs = await db
        .select({ count: count() })
        .from(monitoringJobRuns)
        .where(
          and(
            gte(monitoringJobRuns.startedAt, cutoff),
            sql`status = 'error'`
          )
        );

      const totalCount = totalJobs[0]?.count || 0;
      const failedCount = failedJobs[0]?.count || 0;
      
      return totalCount > 0 ? failedCount / totalCount : 0;
    } catch (error) {
      console.error('❌ [MonitoringService] Failed to get job failure rate:', error);
      return 0;
    }
  }

  private async updateSystemMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      
      systemResourceUsage.labels('memory_heap_used').set(memUsage.heapUsed);
      systemResourceUsage.labels('memory_heap_total').set(memUsage.heapTotal);
      systemResourceUsage.labels('memory_external').set(memUsage.external);
      systemResourceUsage.labels('uptime').set(Date.now() - this.startTime.getTime());
      
    } catch (error) {
      console.error('❌ [MonitoringService] Failed to update system metrics:', error);
    }
  }
}

// Export singleton instance
export const monitoringService = MonitoringService.getInstance();