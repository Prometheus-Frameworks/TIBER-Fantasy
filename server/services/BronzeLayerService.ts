/**
 * Bronze Layer Service - Raw Data Storage System
 * 
 * Manages the ingestion and storage of raw, unprocessed data from all external sources.
 * Provides comprehensive metadata tracking, data lineage, and audit trails.
 * 
 * Part of the Unified Player Hub's 3-tier ELT architecture.
 * 
 * Core Features:
 * - Raw JSON payload storage with metadata
 * - Idempotent operations to prevent duplicates  
 * - Status tracking for processing pipelines
 * - Data lineage and job tracking
 * - Error logging and retry mechanisms
 */

import { db } from '../db';
import { ingestPayloads, type IngestPayload, dataSourceEnum, ingestStatusEnum } from '@shared/schema';
import { eq, and, desc, count, gte, lte, inArray, sql } from 'drizzle-orm';
import crypto from 'crypto';
import stableStringify from 'json-stable-stringify';

export interface RawPayloadInput {
  source: typeof dataSourceEnum.enumValues[number];
  endpoint: string;
  payload: Record<string, any>;
  version: string;
  jobId: string;
  season: number;
  week?: number | null;
  metadata?: {
    apiVersion?: string;
    requestId?: string;
    requestUrl?: string;
    responseHeaders?: Record<string, string>;
    extractedAt?: Date;
    sourceSize?: number;
    sourceFormat?: string;
  };
}

export interface PayloadQueryFilters {
  source?: typeof dataSourceEnum.enumValues[number];
  status?: typeof ingestStatusEnum.enumValues[number];
  season?: number;
  week?: number;
  jobId?: string;
  endpoint?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface PayloadStorageResult {
  payloadId: number;
  isDuplicate: boolean;
  checksumHash: string;
  recordCount: number;
}

export interface PayloadBatchResult {
  processed: number;
  stored: number;
  duplicates: number;
  errors: number;
  payloadIds: number[];
  errorDetails: Array<{ error: string; payload?: any }>;
}

export interface DataSourceStats {
  source: string;
  totalPayloads: number;
  pendingPayloads: number;
  successfulPayloads: number;
  failedPayloads: number;
  lastIngestDate?: Date;
  avgPayloadSize?: number;
  totalRecords?: number;
}

/**
 * Core Bronze Layer Service
 * Manages all raw data ingestion and storage operations
 */
export class BronzeLayerService {
  private static instance: BronzeLayerService;
  
  public static getInstance(): BronzeLayerService {
    if (!BronzeLayerService.instance) {
      BronzeLayerService.instance = new BronzeLayerService();
    }
    return BronzeLayerService.instance;
  }

  /**
   * Store raw JSON payload with comprehensive metadata tracking
   * Implements idempotent operations to prevent duplicate storage
   */
  async storeRawPayload(input: RawPayloadInput): Promise<PayloadStorageResult> {
    const startTime = Date.now();
    
    try {
      // Generate checksum for deduplication using stable stringify
      // Include season/week in salt to prevent over-deduplication across periods
      const payloadString = stableStringify(input.payload);
      const checksumSalt = `${input.source}:${input.endpoint}:${input.season}:${input.week || 'regular'}`;
      const checksumHash = crypto.createHash('sha256')
        .update(`${checksumSalt}:${payloadString}`)
        .digest('hex');

      // Check for existing payload with same checksum
      const existingPayload = await db
        .select({ id: ingestPayloads.id })
        .from(ingestPayloads)
        .where(
          and(
            eq(ingestPayloads.source, input.source),
            eq(ingestPayloads.endpoint, input.endpoint),
            eq(ingestPayloads.checksumHash, checksumHash)
          )
        )
        .limit(1);

      if (existingPayload.length > 0) {
        console.log(`[BronzeLayer] Duplicate payload detected for ${input.source}:${input.endpoint} (checksum: ${checksumHash})`);
        return {
          payloadId: existingPayload[0].id,
          isDuplicate: true,
          checksumHash,
          recordCount: 0
        };
      }

      // Calculate record count based on payload structure
      const recordCount = this.calculateRecordCount(input.payload);
      
      // Store the payload
      const [storedPayload] = await db
        .insert(ingestPayloads)
        .values({
          source: input.source,
          endpoint: input.endpoint,
          payload: input.payload,
          version: input.version,
          jobId: input.jobId,
          season: input.season,
          week: input.week,
          status: 'PENDING',
          recordCount,
          checksumHash,
          ingestedAt: new Date()
        })
        .returning({ id: ingestPayloads.id });

      const duration = Date.now() - startTime;
      
      console.log(`✅ [BronzeLayer] Stored raw payload from ${input.source}:${input.endpoint}`);
      console.log(`   📊 Payload ID: ${storedPayload.id} | Records: ${recordCount} | Duration: ${duration}ms`);
      console.log(`   🔐 Checksum: ${checksumHash.substring(0, 12)}...`);

      return {
        payloadId: storedPayload.id,
        isDuplicate: false,
        checksumHash,
        recordCount
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [BronzeLayer] Error storing payload from ${input.source}:${input.endpoint}:`, error);
      console.error(`   Duration: ${duration}ms`);
      throw new Error(`Failed to store raw payload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store multiple payloads in batch operation
   * Optimized for high-volume data ingestion
   */
  async storeBatchPayloads(inputs: RawPayloadInput[]): Promise<PayloadBatchResult> {
    const startTime = Date.now();
    const result: PayloadBatchResult = {
      processed: inputs.length,
      stored: 0,
      duplicates: 0,
      errors: 0,
      payloadIds: [],
      errorDetails: []
    };

    try {
      console.log(`🔄 [BronzeLayer] Processing batch of ${inputs.length} payloads`);

      for (const input of inputs) {
        try {
          const storageResult = await this.storeRawPayload(input);
          
          if (storageResult.isDuplicate) {
            result.duplicates++;
          } else {
            result.stored++;
          }
          
          result.payloadIds.push(storageResult.payloadId);
          
        } catch (error) {
          result.errors++;
          result.errorDetails.push({
            error: error instanceof Error ? error.message : 'Unknown error',
            payload: { source: input.source, endpoint: input.endpoint, jobId: input.jobId }
          });
        }
      }

      const duration = Date.now() - startTime;
      
      console.log(`✅ [BronzeLayer] Batch processing completed in ${duration}ms`);
      console.log(`   📊 Processed: ${result.processed} | Stored: ${result.stored} | Duplicates: ${result.duplicates} | Errors: ${result.errors}`);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [BronzeLayer] Batch processing failed:`, error);
      console.error(`   Duration: ${duration}ms`);
      throw new Error(`Batch payload storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve raw payloads with flexible filtering
   * Supports pagination and complex query conditions
   */
  async getRawPayloads(filters: PayloadQueryFilters = {}): Promise<IngestPayload[]> {
    try {
      let query = db.select().from(ingestPayloads);
      
      const conditions = [];
      
      if (filters.source) {
        conditions.push(eq(ingestPayloads.source, filters.source));
      }
      
      if (filters.status) {
        conditions.push(eq(ingestPayloads.status, filters.status));
      }
      
      if (filters.season) {
        conditions.push(eq(ingestPayloads.season, filters.season));
      }
      
      if (filters.week !== undefined) {
        conditions.push(eq(ingestPayloads.week, filters.week));
      }
      
      if (filters.jobId) {
        conditions.push(eq(ingestPayloads.jobId, filters.jobId));
      }
      
      if (filters.endpoint) {
        conditions.push(eq(ingestPayloads.endpoint, filters.endpoint));
      }
      
      if (filters.fromDate) {
        conditions.push(gte(ingestPayloads.ingestedAt, filters.fromDate));
      }
      
      if (filters.toDate) {
        conditions.push(lte(ingestPayloads.ingestedAt, filters.toDate));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Order by most recent first
      query = query.orderBy(desc(ingestPayloads.ingestedAt));
      
      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      
      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      const payloads = await query;
      
      console.log(`📊 [BronzeLayer] Retrieved ${payloads.length} raw payloads with filters:`, filters);
      
      return payloads;

    } catch (error) {
      console.error(`❌ [BronzeLayer] Error retrieving raw payloads:`, error);
      throw new Error(`Failed to retrieve raw payloads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get single payload by ID
   */
  async getRawPayload(payloadId: number): Promise<IngestPayload | null> {
    try {
      const [payload] = await db
        .select()
        .from(ingestPayloads)
        .where(eq(ingestPayloads.id, payloadId))
        .limit(1);

      return payload || null;

    } catch (error) {
      console.error(`❌ [BronzeLayer] Error retrieving payload ${payloadId}:`, error);
      throw new Error(`Failed to retrieve payload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update processing status for a payload
   * Used by ETL pipelines to track processing progress
   */
  async updatePayloadStatus(
    payloadId: number, 
    status: typeof ingestStatusEnum.enumValues[number], 
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        processedAt: new Date()
      };

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      await db
        .update(ingestPayloads)
        .set(updateData)
        .where(eq(ingestPayloads.id, payloadId));

      console.log(`📝 [BronzeLayer] Updated payload ${payloadId} status to ${status}`);
      if (errorMessage) {
        console.log(`   ⚠️ Error: ${errorMessage}`);
      }

    } catch (error) {
      console.error(`❌ [BronzeLayer] Error updating payload status:`, error);
      throw new Error(`Failed to update payload status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update multiple payload statuses in batch
   */
  async updateBatchPayloadStatus(
    payloadIds: number[], 
    status: typeof ingestStatusEnum.enumValues[number]
  ): Promise<void> {
    try {
      await db
        .update(ingestPayloads)
        .set({ 
          status, 
          processedAt: new Date() 
        })
        .where(inArray(ingestPayloads.id, payloadIds));

      console.log(`📝 [BronzeLayer] Updated ${payloadIds.length} payloads to status ${status}`);

    } catch (error) {
      console.error(`❌ [BronzeLayer] Error updating batch payload status:`, error);
      throw new Error(`Failed to update batch payload status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get data source statistics and health metrics
   */
  async getDataSourceStats(source?: typeof dataSourceEnum.enumValues[number]): Promise<DataSourceStats[]> {
    try {
      let query = db
        .select({
          source: ingestPayloads.source,
          totalPayloads: count(),
          pendingPayloads: sql<number>`COUNT(CASE WHEN ${ingestPayloads.status} = 'PENDING' THEN 1 END)`,
          successfulPayloads: sql<number>`COUNT(CASE WHEN ${ingestPayloads.status} = 'SUCCESS' THEN 1 END)`,
          failedPayloads: sql<number>`COUNT(CASE WHEN ${ingestPayloads.status} = 'FAILED' THEN 1 END)`,
          lastIngestDate: sql<Date>`MAX(${ingestPayloads.ingestedAt})`,
          avgPayloadSize: sql<number>`AVG(jsonb_array_length(COALESCE(${ingestPayloads.payload}, '[]'::jsonb)))`,
          totalRecords: sql<number>`SUM(COALESCE(${ingestPayloads.recordCount}, 0))`
        })
        .from(ingestPayloads)
        .groupBy(ingestPayloads.source);

      if (source) {
        query = query.where(eq(ingestPayloads.source, source));
      }

      const stats = await query;
      
      return stats.map(stat => ({
        source: stat.source,
        totalPayloads: Number(stat.totalPayloads),
        pendingPayloads: Number(stat.pendingPayloads),
        successfulPayloads: Number(stat.successfulPayloads),
        failedPayloads: Number(stat.failedPayloads),
        lastIngestDate: stat.lastIngestDate,
        avgPayloadSize: Number(stat.avgPayloadSize) || 0,
        totalRecords: Number(stat.totalRecords) || 0
      }));

    } catch (error) {
      console.error(`❌ [BronzeLayer] Error getting data source stats:`, error);
      throw new Error(`Failed to get data source stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Purge old payloads based on cutoff date
   * Used for data retention management
   */
  async purgeOldPayloads(
    source: typeof dataSourceEnum.enumValues[number],
    cutoffDate: Date
  ): Promise<{ deletedCount: number }> {
    try {
      const deletedPayloads = await db
        .delete(ingestPayloads)
        .where(
          and(
            eq(ingestPayloads.source, source),
            lte(ingestPayloads.ingestedAt, cutoffDate)
          )
        )
        .returning({ id: ingestPayloads.id });

      const deletedCount = deletedPayloads.length;
      
      console.log(`🗑️ [BronzeLayer] Purged ${deletedCount} old payloads from ${source} before ${cutoffDate.toISOString()}`);
      
      return { deletedCount };

    } catch (error) {
      console.error(`❌ [BronzeLayer] Error purging old payloads:`, error);
      throw new Error(`Failed to purge old payloads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate record count from payload structure
   * Handles different data formats intelligently
   */
  private calculateRecordCount(payload: any): number {
    try {
      if (Array.isArray(payload)) {
        return payload.length;
      }
      
      if (typeof payload === 'object' && payload !== null) {
        // Look for common array fields that contain records
        const possibleArrays = ['players', 'data', 'results', 'records', 'items'];
        
        for (const field of possibleArrays) {
          if (Array.isArray(payload[field])) {
            return payload[field].length;
          }
        }
        
        // If it's an object with keys, count the keys as records
        return Object.keys(payload).length;
      }
      
      // Single record
      return 1;
      
    } catch (error) {
      console.warn(`[BronzeLayer] Error calculating record count, defaulting to 1:`, error);
      return 1;
    }
  }
}

// Export singleton instance
export const bronzeLayerService = BronzeLayerService.getInstance();