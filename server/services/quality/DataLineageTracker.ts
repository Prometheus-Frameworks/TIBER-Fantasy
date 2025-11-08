/**
 * Data Lineage Tracker - Data Flow and Transformation History
 * 
 * Comprehensive data lineage tracking system that records the complete flow
 * of data transformations from Bronze through Silver to Gold layers.
 * Provides full audit trails, impact analysis, and transformation history.
 * 
 * Core Features:
 * - End-to-end lineage tracking across all ELT layers
 * - Transformation impact analysis and dependency mapping
 * - Data quality correlation with lineage paths
 * - Performance metrics and processing optimization insights
 * - Comprehensive audit trails for regulatory compliance
 */

import { db } from '../../infra/db';
import { 
  dataLineage,
  ingestPayloads,
  playerIdentityMap,
  playerWeekFacts,
  playerSeasonFacts,
  playerMarketFacts,
  type InsertDataLineage,
  type DataLineage
} from '@shared/schema';
import { eq, and, desc, sql, inArray, gte, lte, isNotNull } from 'drizzle-orm';

export interface LineageNode {
  id: string;
  type: 'source' | 'bronze' | 'silver' | 'gold';
  tableName: string;
  recordId?: string;
  jobId: string;
  operation: string;
  timestamp: Date;
  qualityScore?: number;
  metadata?: any;
}

export interface LineageEdge {
  from: string;
  to: string;
  transformationType: 'extract' | 'load' | 'transform' | 'aggregate' | 'enrich';
  confidence: number;
  recordsProcessed: number;
  quality: {
    before: number;
    after: number;
    improvement: number;
  };
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  metadata: {
    totalTransformations: number;
    averageQualityScore: number;
    processingTime: number;
    dataVolume: number;
  };
}

export interface LineageTrackingRequest {
  jobId: string;
  operation: 'EXTRACT' | 'LOAD' | 'TRANSFORM' | 'AGGREGATE' | 'VALIDATE' | 'ENRICH';
  sourceTable?: string;
  targetTable: string;
  sourceJobId?: string;
  ingestPayloadId?: number;
  context?: {
    season?: number;
    week?: number;
    players?: string[];
    [key: string]: any;
  };
}

export interface LineageQuery {
  recordId?: string;
  tableName?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  includeUpstream?: boolean;
  includeDownstream?: boolean;
  maxDepth?: number;
  qualityThreshold?: number;
}

export interface ImpactAnalysisResult {
  affectedRecords: Array<{
    tableName: string;
    recordId: string;
    impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    transformationPath: string[];
    qualityRisk: number;
  }>;
  downstreamTables: string[];
  estimatedProcessingTime: number;
  dataVolumeImpact: number;
  qualityImpactScore: number;
}

/**
 * Core Data Lineage Tracker
 * Tracks complete data transformation lineage across ELT pipeline
 */
export class DataLineageTracker {
  private static instance: DataLineageTracker;

  public static getInstance(): DataLineageTracker {
    if (!DataLineageTracker.instance) {
      DataLineageTracker.instance = new DataLineageTracker();
    }
    return DataLineageTracker.instance;
  }

  /**
   * Start tracking lineage for a processing job
   */
  async startLineageTracking(request: LineageTrackingRequest): Promise<void> {
    console.log(`📊 [Lineage] Starting lineage tracking for job ${request.jobId}`);

    try {
      const lineageRecord: InsertDataLineage = {
        jobId: request.jobId,
        tableName: request.targetTable,
        operation: request.operation,
        sourceTable: request.sourceTable,
        sourceJobId: request.sourceJobId,
        ingestPayloadId: request.ingestPayloadId,
        recordsProcessed: 0,
        recordsSuccess: 0,
        recordsFailed: 0,
        recordsSkipped: 0,
        startedAt: new Date(),
        executionContext: {
          ...request.context,
          trackingStarted: new Date().toISOString()
        }
      };

      await db.insert(dataLineage).values(lineageRecord);
      
      console.log(`✅ [Lineage] Lineage tracking started for ${request.targetTable}`);

    } catch (error) {
      console.error(`❌ [Lineage] Failed to start lineage tracking:`, error);
      // Don't throw - lineage tracking is auxiliary and shouldn't block main processing
    }
  }

  /**
   * Update lineage tracking with processing progress
   */
  async updateLineageProgress(
    jobId: string,
    progress: {
      recordsProcessed?: number;
      recordsSuccess?: number;
      recordsFailed?: number;
      recordsSkipped?: number;
      qualityScore?: number;
      additionalContext?: any;
    }
  ): Promise<void> {
    try {
      const updateData: any = {};
      
      if (progress.recordsProcessed !== undefined) updateData.recordsProcessed = progress.recordsProcessed;
      if (progress.recordsSuccess !== undefined) updateData.recordsSuccess = progress.recordsSuccess;
      if (progress.recordsFailed !== undefined) updateData.recordsFailed = progress.recordsFailed;
      if (progress.recordsSkipped !== undefined) updateData.recordsSkipped = progress.recordsSkipped;
      if (progress.qualityScore !== undefined) updateData.qualityScore = progress.qualityScore;

      if (progress.additionalContext) {
        // Merge additional context with existing context
        const existingRecord = await db
          .select({ executionContext: dataLineage.executionContext })
          .from(dataLineage)
          .where(eq(dataLineage.jobId, jobId))
          .limit(1);

        if (existingRecord[0]) {
          updateData.executionContext = {
            ...existingRecord[0].executionContext,
            ...progress.additionalContext,
            lastUpdate: new Date().toISOString()
          };
        }
      }

      await db.update(dataLineage)
        .set(updateData)
        .where(eq(dataLineage.jobId, jobId));

    } catch (error) {
      console.warn(`⚠️ [Lineage] Failed to update lineage progress:`, error);
    }
  }

  /**
   * Complete lineage tracking for a processing job
   */
  async completeLineageTracking(
    jobId: string,
    completion: {
      success: boolean;
      errorMessage?: string;
      finalQualityScore?: number;
      completenessScore?: number;
      freshnessScore?: number;
      performanceMetrics?: any;
    }
  ): Promise<void> {
    console.log(`📊 [Lineage] Completing lineage tracking for job ${jobId}`);

    try {
      const updateData: any = {
        completedAt: new Date()
      };

      if (completion.errorMessage) updateData.errorMessage = completion.errorMessage;
      if (completion.finalQualityScore !== undefined) updateData.qualityScore = completion.finalQualityScore;
      if (completion.completenessScore !== undefined) updateData.completenessScore = completion.completenessScore;
      if (completion.freshnessScore !== undefined) updateData.freshnessScore = completion.freshnessScore;

      if (completion.performanceMetrics) {
        const existingRecord = await db
          .select({ executionContext: dataLineage.executionContext })
          .from(dataLineage)
          .where(eq(dataLineage.jobId, jobId))
          .limit(1);

        if (existingRecord[0]) {
          updateData.executionContext = {
            ...existingRecord[0].executionContext,
            performanceMetrics: completion.performanceMetrics,
            completedAt: new Date().toISOString(),
            success: completion.success
          };
        }
      }

      await db.update(dataLineage)
        .set(updateData)
        .where(eq(dataLineage.jobId, jobId));

      console.log(`✅ [Lineage] Lineage tracking completed for job ${jobId}`);

    } catch (error) {
      console.error(`❌ [Lineage] Failed to complete lineage tracking:`, error);
    }
  }

  /**
   * Get complete lineage graph for a record or table
   */
  async getLineageGraph(query: LineageQuery): Promise<LineageGraph> {
    console.log(`🔍 [Lineage] Building lineage graph for:`, query);

    try {
      // Build query conditions
      const conditions = [];
      
      if (query.tableName) {
        conditions.push(eq(dataLineage.tableName, query.tableName));
      }
      
      if (query.timeRange) {
        conditions.push(
          gte(dataLineage.startedAt, query.timeRange.start),
          lte(dataLineage.startedAt, query.timeRange.end)
        );
      }
      
      if (query.qualityThreshold) {
        conditions.push(gte(dataLineage.qualityScore, query.qualityThreshold));
      }

      // Get base lineage records
      let baseQuery = db
        .select()
        .from(dataLineage)
        .orderBy(desc(dataLineage.startedAt));

      if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions));
      }

      const lineageRecords = await baseQuery.limit(1000); // Reasonable limit

      // Build nodes from lineage records
      const nodes: LineageNode[] = lineageRecords.map(record => ({
        id: record.jobId,
        type: this.determineNodeType(record.tableName),
        tableName: record.tableName,
        jobId: record.jobId,
        operation: record.operation,
        timestamp: record.startedAt,
        qualityScore: record.qualityScore || undefined,
        metadata: {
          recordsProcessed: record.recordsProcessed,
          recordsSuccess: record.recordsSuccess,
          recordsFailed: record.recordsFailed,
          duration: record.completedAt ? 
            record.completedAt.getTime() - record.startedAt.getTime() : undefined,
          executionContext: record.executionContext
        }
      }));

      // Build edges from source relationships
      const edges: LineageEdge[] = [];
      
      for (const record of lineageRecords) {
        if (record.sourceJobId) {
          const sourceNode = nodes.find(n => n.id === record.sourceJobId);
          if (sourceNode) {
            edges.push({
              from: record.sourceJobId,
              to: record.jobId,
              transformationType: this.determineTransformationType(record.operation),
              confidence: record.qualityScore || 0.5,
              recordsProcessed: record.recordsProcessed || 0,
              quality: {
                before: 0.5, // Would be calculated from source quality
                after: record.qualityScore || 0.5,
                improvement: (record.qualityScore || 0.5) - 0.5
              }
            });
          }
        }
      }

      // Calculate metadata
      const metadata = {
        totalTransformations: nodes.length,
        averageQualityScore: nodes
          .filter(n => n.qualityScore !== undefined)
          .reduce((sum, n) => sum + n.qualityScore!, 0) / 
          nodes.filter(n => n.qualityScore !== undefined).length || 0,
        processingTime: nodes.reduce((sum, n) => {
          const duration = n.metadata?.duration;
          return sum + (duration || 0);
        }, 0),
        dataVolume: nodes.reduce((sum, n) => sum + (n.metadata?.recordsProcessed || 0), 0)
      };

      const graph: LineageGraph = { nodes, edges, metadata };
      
      console.log(`✅ [Lineage] Lineage graph built with ${nodes.length} nodes and ${edges.length} edges`);
      return graph;

    } catch (error) {
      console.error(`❌ [Lineage] Failed to build lineage graph:`, error);
      throw error;
    }
  }

  /**
   * Get transformation history for a specific record
   */
  async getRecordLineage(
    tableName: string, 
    recordId: string, 
    options: { includeUpstream?: boolean; includeDownstream?: boolean } = {}
  ): Promise<DataLineage[]> {
    console.log(`🔍 [Lineage] Getting record lineage for ${tableName}:${recordId}`);

    try {
      // Get direct lineage records
      let records = await db
        .select()
        .from(dataLineage)
        .where(
          and(
            eq(dataLineage.tableName, tableName),
            sql`${dataLineage.executionContext}->>'recordId' = ${recordId}`
          )
        )
        .orderBy(desc(dataLineage.startedAt));

      // Get upstream lineage if requested
      if (options.includeUpstream) {
        const upstreamJobIds = records
          .filter(r => r.sourceJobId)
          .map(r => r.sourceJobId!);
        
        if (upstreamJobIds.length > 0) {
          const upstreamRecords = await db
            .select()
            .from(dataLineage)
            .where(inArray(dataLineage.jobId, upstreamJobIds));
          
          records = [...records, ...upstreamRecords];
        }
      }

      // Get downstream lineage if requested
      if (options.includeDownstream) {
        const jobIds = records.map(r => r.jobId);
        
        if (jobIds.length > 0) {
          const downstreamRecords = await db
            .select()
            .from(dataLineage)
            .where(inArray(dataLineage.sourceJobId, jobIds));
          
          records = [...records, ...downstreamRecords];
        }
      }

      // Remove duplicates and sort
      const uniqueRecords = records.filter((record, index, self) => 
        index === self.findIndex(r => r.jobId === record.jobId)
      ).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

      console.log(`✅ [Lineage] Found ${uniqueRecords.length} lineage records for ${tableName}:${recordId}`);
      return uniqueRecords;

    } catch (error) {
      console.error(`❌ [Lineage] Failed to get record lineage:`, error);
      throw error;
    }
  }

  /**
   * Analyze impact of changing a source record
   */
  async analyzeImpact(
    sourceTable: string, 
    sourceRecordId?: string,
    timeRange: { start: Date; end: Date } = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      end: new Date()
    }
  ): Promise<ImpactAnalysisResult> {
    console.log(`🔍 [Lineage] Analyzing impact for ${sourceTable}${sourceRecordId ? `:${sourceRecordId}` : ''}`);

    try {
      // Find all downstream transformations
      const downstreamRecords = await db
        .select()
        .from(dataLineage)
        .where(
          and(
            eq(dataLineage.sourceTable, sourceTable),
            gte(dataLineage.startedAt, timeRange.start),
            lte(dataLineage.startedAt, timeRange.end)
          )
        );

      // Analyze affected records
      const affectedRecords = [];
      const downstreamTables = new Set<string>();
      let totalProcessingTime = 0;
      let totalDataVolume = 0;
      let qualityScores = [];

      for (const record of downstreamRecords) {
        downstreamTables.add(record.tableName);
        totalProcessingTime += record.completedAt ? 
          record.completedAt.getTime() - record.startedAt.getTime() : 0;
        totalDataVolume += record.recordsProcessed || 0;
        
        if (record.qualityScore) {
          qualityScores.push(record.qualityScore);
        }

        // Determine impact level based on data volume and failure rate
        let impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        const failureRate = (record.recordsFailed || 0) / (record.recordsProcessed || 1);
        
        if (failureRate > 0.1 || (record.recordsProcessed || 0) > 10000) {
          impactLevel = 'CRITICAL';
        } else if (failureRate > 0.05 || (record.recordsProcessed || 0) > 1000) {
          impactLevel = 'HIGH';
        } else if (failureRate > 0.01 || (record.recordsProcessed || 0) > 100) {
          impactLevel = 'MEDIUM';
        }

        affectedRecords.push({
          tableName: record.tableName,
          recordId: record.jobId,
          impactLevel,
          transformationPath: [sourceTable, record.tableName],
          qualityRisk: 1 - (record.qualityScore || 0.5)
        });
      }

      const result: ImpactAnalysisResult = {
        affectedRecords,
        downstreamTables: Array.from(downstreamTables),
        estimatedProcessingTime: totalProcessingTime,
        dataVolumeImpact: totalDataVolume,
        qualityImpactScore: qualityScores.length > 0 ? 
          qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length : 0.5
      };

      console.log(`✅ [Lineage] Impact analysis completed - ${affectedRecords.length} affected records across ${downstreamTables.size} tables`);
      return result;

    } catch (error) {
      console.error(`❌ [Lineage] Impact analysis failed:`, error);
      throw error;
    }
  }

  /**
   * Get lineage statistics for performance monitoring
   */
  async getLineageStatistics(
    timeRange: { start: Date; end: Date },
    filters: { tables?: string[]; operations?: string[] } = {}
  ): Promise<{
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    averageProcessingTime: number;
    totalRecordsProcessed: number;
    averageQualityScore: number;
    tableStatistics: { [tableName: string]: { jobs: number; avgQuality: number; avgProcessingTime: number } };
  }> {
    console.log(`📊 [Lineage] Getting lineage statistics`);

    try {
      // Build query conditions
      const conditions = [
        gte(dataLineage.startedAt, timeRange.start),
        lte(dataLineage.startedAt, timeRange.end)
      ];

      if (filters.tables?.length) {
        conditions.push(inArray(dataLineage.tableName, filters.tables));
      }

      if (filters.operations?.length) {
        conditions.push(inArray(dataLineage.operation, filters.operations));
      }

      // Get lineage records
      const records = await db
        .select()
        .from(dataLineage)
        .where(and(...conditions));

      // Calculate statistics
      const totalJobs = records.length;
      const successfulJobs = records.filter(r => r.completedAt && !r.errorMessage).length;
      const failedJobs = totalJobs - successfulJobs;

      const processingTimes = records
        .filter(r => r.completedAt)
        .map(r => r.completedAt!.getTime() - r.startedAt.getTime());
      
      const averageProcessingTime = processingTimes.length > 0 ? 
        processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length : 0;

      const totalRecordsProcessed = records.reduce((sum, r) => sum + (r.recordsProcessed || 0), 0);

      const qualityScores = records.filter(r => r.qualityScore).map(r => r.qualityScore!);
      const averageQualityScore = qualityScores.length > 0 ?
        qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length : 0;

      // Calculate table-specific statistics
      const tableStats: { [tableName: string]: any } = {};
      
      for (const record of records) {
        if (!tableStats[record.tableName]) {
          tableStats[record.tableName] = {
            jobs: 0,
            qualityScores: [],
            processingTimes: []
          };
        }
        
        tableStats[record.tableName].jobs++;
        
        if (record.qualityScore) {
          tableStats[record.tableName].qualityScores.push(record.qualityScore);
        }
        
        if (record.completedAt) {
          const processingTime = record.completedAt.getTime() - record.startedAt.getTime();
          tableStats[record.tableName].processingTimes.push(processingTime);
        }
      }

      // Calculate averages for each table
      const tableStatistics: { [tableName: string]: { jobs: number; avgQuality: number; avgProcessingTime: number } } = {};
      
      for (const [tableName, stats] of Object.entries(tableStats)) {
        const avgQuality = stats.qualityScores.length > 0 ?
          stats.qualityScores.reduce((sum: number, score: number) => sum + score, 0) / stats.qualityScores.length : 0;
        
        const avgProcessingTime = stats.processingTimes.length > 0 ?
          stats.processingTimes.reduce((sum: number, time: number) => sum + time, 0) / stats.processingTimes.length : 0;
        
        tableStatistics[tableName] = {
          jobs: stats.jobs,
          avgQuality,
          avgProcessingTime
        };
      }

      const statistics = {
        totalJobs,
        successfulJobs,
        failedJobs,
        averageProcessingTime,
        totalRecordsProcessed,
        averageQualityScore,
        tableStatistics
      };

      console.log(`✅ [Lineage] Statistics generated - ${totalJobs} jobs analyzed`);
      return statistics;

    } catch (error) {
      console.error(`❌ [Lineage] Failed to get lineage statistics:`, error);
      throw error;
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Determine node type based on table name
   */
  private determineNodeType(tableName: string): 'source' | 'bronze' | 'silver' | 'gold' {
    if (tableName.includes('ingest_payloads')) return 'bronze';
    if (tableName.includes('identity_map') || tableName.includes('market_signals') || tableName.includes('injuries')) return 'silver';
    if (tableName.includes('facts') || tableName.includes('rollups')) return 'gold';
    return 'source';
  }

  /**
   * Determine transformation type based on operation
   */
  private determineTransformationType(operation: string): 'extract' | 'load' | 'transform' | 'aggregate' | 'enrich' {
    const op = operation.toLowerCase();
    if (op.includes('extract')) return 'extract';
    if (op.includes('load')) return 'load';
    if (op.includes('aggregate')) return 'aggregate';
    if (op.includes('enrich')) return 'enrich';
    return 'transform';
  }
}

/**
 * Singleton instance for external usage
 */
export const dataLineageTracker = DataLineageTracker.getInstance();