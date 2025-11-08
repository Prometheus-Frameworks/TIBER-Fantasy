/**
 * Silver Layer Service - Normalized Canonical Data Processing
 * 
 * Core service for transforming raw Bronze data into clean, standardized canonical tables.
 * Handles cross-platform data integration, normalization, and quality validation.
 * 
 * Part of the Unified Player Hub's 3-tier ELT architecture.
 * 
 * Core Features:
 * - Bronze to Silver data transformation
 * - Cross-platform data reconciliation using Player Identity Map
 * - Data quality validation and enrichment
 * - Conflict resolution for overlapping data sources
 * - Batch processing with comprehensive error handling
 */

import { db } from '../infra/db';
import { 
  ingestPayloads, 
  playerIdentityMap, 
  nflTeamsDim, 
  marketSignals, 
  injuries, 
  depthCharts,
  type IngestPayload,
  dataSourceEnum, 
  ingestStatusEnum,
  dataQualityEnum 
} from '@shared/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { BronzeLayerService } from './BronzeLayerService';
import { PlayerIdentityService } from './PlayerIdentityService';

// Import processors
import { PlayersDimProcessor } from '../processors/PlayersDimProcessor';
import { TeamsDimProcessor } from '../processors/TeamsDimProcessor';
import { MarketSignalsProcessor } from '../processors/MarketSignalsProcessor';
import { InjuriesProcessor } from '../processors/InjuriesProcessor';
import { DepthChartsProcessor } from '../processors/DepthChartsProcessor';

export interface SilverProcessingResult {
  processed: number;
  success: number;
  errors: number;
  skipped: number;
  payloadIds: number[];
  tableResults: {
    playersCreated: number;
    playersUpdated: number;
    teamsCreated: number;
    teamsUpdated: number;
    marketSignalsCreated: number;
    injuriesCreated: number;
    depthChartsCreated: number;
  };
  errorDetails: Array<{
    payloadId: number;
    error: string;
    source?: string;
    endpoint?: string;
  }>;
  duration: number;
}

export interface ProcessingFilters {
  sources?: Array<typeof dataSourceEnum.enumValues[number]>;
  endpoints?: string[];
  season?: number;
  week?: number;
  maxAge?: number; // Hours
  onlyPending?: boolean;
}

export interface ConflictResolution {
  strategy: 'latest' | 'highest_confidence' | 'source_priority' | 'manual';
  sourcePriority?: Array<typeof dataSourceEnum.enumValues[number]>;
  conflictFields: string[];
  resolution: string;
}

export interface DataQualityReport {
  totalRecords: number;
  qualityDistribution: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    MISSING: number;
  };
  missingIdentities: number;
  crossPlatformConflicts: number;
  validationErrors: Array<{
    table: string;
    field: string;
    error: string;
    count: number;
  }>;
}

/**
 * Core Silver Layer Service
 * Orchestrates transformation of Bronze data into normalized canonical tables
 */
export class SilverLayerService {
  private static instance: SilverLayerService;
  private bronzeService: BronzeLayerService;
  private identityService: PlayerIdentityService;
  
  // Processors for each dimension table
  private playersDimProcessor: PlayersDimProcessor;
  private teamsDimProcessor: TeamsDimProcessor;
  private marketSignalsProcessor: MarketSignalsProcessor;
  private injuriesProcessor: InjuriesProcessor;
  private depthChartsProcessor: DepthChartsProcessor;

  public static getInstance(): SilverLayerService {
    if (!SilverLayerService.instance) {
      SilverLayerService.instance = new SilverLayerService();
    }
    return SilverLayerService.instance;
  }

  private constructor() {
    this.bronzeService = BronzeLayerService.getInstance();
    this.identityService = PlayerIdentityService.getInstance();
    
    // Initialize processors
    this.playersDimProcessor = new PlayersDimProcessor(this.identityService);
    this.teamsDimProcessor = new TeamsDimProcessor();
    this.marketSignalsProcessor = new MarketSignalsProcessor(this.identityService);
    this.injuriesProcessor = new InjuriesProcessor(this.identityService);
    this.depthChartsProcessor = new DepthChartsProcessor(this.identityService);
  }

  /**
   * Process Bronze payloads into normalized Silver tables
   * Main orchestration method for Bronze-to-Silver transformation
   */
  async processBronzeToSilver(
    payloadIds: number[], 
    options: { force?: boolean; validateOnly?: boolean } = {}
  ): Promise<SilverProcessingResult> {
    const startTime = Date.now();
    
    const result: SilverProcessingResult = {
      processed: 0,
      success: 0,
      errors: 0,
      skipped: 0,
      payloadIds: payloadIds,
      tableResults: {
        playersCreated: 0,
        playersUpdated: 0,
        teamsCreated: 0,
        teamsUpdated: 0,
        marketSignalsCreated: 0,
        injuriesCreated: 0,
        depthChartsCreated: 0
      },
      errorDetails: [],
      duration: 0
    };

    try {
      console.log(`🔄 [SilverLayer] Processing ${payloadIds.length} Bronze payloads to Silver tables`);
      console.log(`   Options: force=${options.force}, validateOnly=${options.validateOnly}`);

      // Fetch Bronze payloads
      const payloads = await this.fetchBronzePayloads(payloadIds);
      result.processed = payloads.length;

      if (payloads.length === 0) {
        console.log(`⚠️ [SilverLayer] No Bronze payloads found for provided IDs`);
        result.duration = Date.now() - startTime;
        return result;
      }

      // Group payloads by source and endpoint for efficient processing
      const groupedPayloads = this.groupPayloadsBySourceEndpoint(payloads);
      
      console.log(`📊 [SilverLayer] Processing ${Object.keys(groupedPayloads).length} source/endpoint groups`);

      // Process each group with appropriate processor
      for (const [sourceEndpoint, payloadGroup] of Object.entries(groupedPayloads)) {
        const [source, endpoint] = sourceEndpoint.split('::');
        
        try {
          console.log(`🔄 Processing ${payloadGroup.length} payloads for ${source}:${endpoint}`);
          
          const groupResult = await this.processPayloadGroup(
            payloadGroup, 
            source as typeof dataSourceEnum.enumValues[number], 
            endpoint,
            options
          );
          
          // Aggregate results
          result.success += groupResult.success;
          result.errors += groupResult.errors;
          result.skipped += groupResult.skipped;
          
          // Merge table results
          this.mergeTableResults(result.tableResults, groupResult.tableResults);
          
          // Add any errors
          result.errorDetails.push(...groupResult.errorDetails);
          
        } catch (error) {
          console.error(`❌ [SilverLayer] Error processing group ${sourceEndpoint}:`, error);
          
          result.errors += payloadGroup.length;
          result.errorDetails.push({
            payloadId: payloadGroup[0].id,
            error: error instanceof Error ? error.message : 'Unknown error',
            source,
            endpoint
          });
        }
      }

      result.duration = Date.now() - startTime;
      
      console.log(`✅ [SilverLayer] Bronze-to-Silver processing completed in ${result.duration}ms`);
      console.log(`   📊 Success: ${result.success} | Errors: ${result.errors} | Skipped: ${result.skipped}`);
      console.log(`   📈 Table Results:`, result.tableResults);

      return result;

    } catch (error) {
      result.duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ [SilverLayer] Critical error in Bronze-to-Silver processing:`, error);
      
      result.errors = payloadIds.length;
      result.errorDetails.push({
        payloadId: 0,
        error: errorMessage
      });
      
      throw new Error(`Silver Layer processing failed: ${errorMessage}`);
    }
  }

  /**
   * Process Bronze payloads by filter criteria
   * Allows processing based on source, timeframe, status, etc.
   */
  async processBronzeByFilters(filters: ProcessingFilters): Promise<SilverProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 [SilverLayer] Finding Bronze payloads with filters:`, filters);
      
      // Build query conditions
      const conditions = [];
      
      if (filters.sources?.length) {
        conditions.push(inArray(ingestPayloads.source, filters.sources));
      }
      
      if (filters.endpoints?.length) {
        conditions.push(inArray(ingestPayloads.endpoint, filters.endpoints));
      }
      
      if (filters.season) {
        conditions.push(eq(ingestPayloads.season, filters.season));
      }
      
      if (filters.week !== undefined) {
        conditions.push(eq(ingestPayloads.week, filters.week));
      }
      
      if (filters.onlyPending) {
        conditions.push(eq(ingestPayloads.status, 'PENDING'));
      }
      
      if (filters.maxAge) {
        const cutoffDate = new Date(Date.now() - (filters.maxAge * 60 * 60 * 1000));
        conditions.push(sql`${ingestPayloads.ingestedAt} >= ${cutoffDate}`);
      }

      // Fetch matching payloads
      let query = db.select({ id: ingestPayloads.id }).from(ingestPayloads);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      query = query.orderBy(desc(ingestPayloads.ingestedAt));
      
      const payloadIds = (await query).map(p => p.id);
      
      console.log(`📊 [SilverLayer] Found ${payloadIds.length} matching Bronze payloads`);
      
      if (payloadIds.length === 0) {
        return {
          processed: 0,
          success: 0,
          errors: 0,
          skipped: 0,
          payloadIds: [],
          tableResults: {
            playersCreated: 0,
            playersUpdated: 0,
            teamsCreated: 0,
            teamsUpdated: 0,
            marketSignalsCreated: 0,
            injuriesCreated: 0,
            depthChartsCreated: 0
          },
          errorDetails: [],
          duration: Date.now() - startTime
        };
      }
      
      // Process the found payloads
      return await this.processBronzeToSilver(payloadIds);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [SilverLayer] Error processing Bronze by filters:`, error);
      throw new Error(`Filter-based processing failed: ${errorMessage}`);
    }
  }

  /**
   * Generate data quality report for Silver tables
   * Provides insights into data completeness and consistency
   */
  async generateDataQualityReport(): Promise<DataQualityReport> {
    try {
      console.log(`📊 [SilverLayer] Generating data quality report`);
      
      // Count total players in identity map
      const totalPlayersQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(playerIdentityMap);
      const totalRecords = totalPlayersQuery[0]?.count || 0;

      // Count market signals by quality
      const qualityDistQuery = await db
        .select({ 
          quality: marketSignals.dataQuality,
          count: sql<number>`count(*)` 
        })
        .from(marketSignals)
        .groupBy(marketSignals.dataQuality);

      const qualityDistribution = {
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        MISSING: 0
      };

      qualityDistQuery.forEach(row => {
        if (row.quality && row.quality in qualityDistribution) {
          qualityDistribution[row.quality as keyof typeof qualityDistribution] = row.count;
        }
      });

      // Count players without external IDs
      const missingIdentitiesQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(playerIdentityMap)
        .where(
          and(
            sql`${playerIdentityMap.sleeperId} IS NULL`,
            sql`${playerIdentityMap.espnId} IS NULL`,
            sql`${playerIdentityMap.yahooId} IS NULL`
          )
        );
      const missingIdentities = missingIdentitiesQuery[0]?.count || 0;

      const report: DataQualityReport = {
        totalRecords,
        qualityDistribution,
        missingIdentities,
        crossPlatformConflicts: 0, // TODO: Implement conflict detection
        validationErrors: [] // TODO: Implement validation error tracking
      };

      console.log(`✅ [SilverLayer] Data quality report generated:`, report);
      return report;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [SilverLayer] Error generating data quality report:`, error);
      throw new Error(`Data quality report failed: ${errorMessage}`);
    }
  }

  /**
   * Private helper methods
   */

  private async fetchBronzePayloads(payloadIds: number[]): Promise<IngestPayload[]> {
    return await db
      .select()
      .from(ingestPayloads)
      .where(inArray(ingestPayloads.id, payloadIds))
      .orderBy(desc(ingestPayloads.ingestedAt));
  }

  private groupPayloadsBySourceEndpoint(payloads: IngestPayload[]): Record<string, IngestPayload[]> {
    const grouped: Record<string, IngestPayload[]> = {};
    
    for (const payload of payloads) {
      const key = `${payload.source}::${payload.endpoint}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(payload);
    }
    
    return grouped;
  }

  private async processPayloadGroup(
    payloads: IngestPayload[], 
    source: typeof dataSourceEnum.enumValues[number], 
    endpoint: string,
    options: { force?: boolean; validateOnly?: boolean }
  ): Promise<SilverProcessingResult> {
    const startTime = Date.now();
    
    // Determine which processor to use based on source and endpoint
    const processor = this.getProcessorForEndpoint(source, endpoint);
    
    if (!processor) {
      console.log(`⚠️ [SilverLayer] No processor found for ${source}:${endpoint}, skipping`);
      return {
        processed: payloads.length,
        success: 0,
        errors: 0,
        skipped: payloads.length,
        payloadIds: payloads.map(p => p.id),
        tableResults: {
          playersCreated: 0,
          playersUpdated: 0,
          teamsCreated: 0,
          teamsUpdated: 0,
          marketSignalsCreated: 0,
          injuriesCreated: 0,
          depthChartsCreated: 0
        },
        errorDetails: [],
        duration: Date.now() - startTime
      };
    }

    // Process with the appropriate processor
    return await processor.process(payloads, options);
  }

  private getProcessorForEndpoint(
    source: typeof dataSourceEnum.enumValues[number], 
    endpoint: string
  ): any {
    // Route to appropriate processor based on source and endpoint patterns
    if (endpoint.includes('players') || endpoint.includes('rosters')) {
      return this.playersDimProcessor;
    }
    
    if (endpoint.includes('teams') || endpoint.includes('franchise')) {
      return this.teamsDimProcessor;
    }
    
    if (endpoint.includes('adp') || endpoint.includes('rankings') || endpoint.includes('ownership')) {
      return this.marketSignalsProcessor;
    }
    
    if (endpoint.includes('injuries') || endpoint.includes('practice')) {
      return this.injuriesProcessor;
    }
    
    if (endpoint.includes('depth') || endpoint.includes('lineup')) {
      return this.depthChartsProcessor;
    }
    
    // Default to players processor for unknown endpoints
    return this.playersDimProcessor;
  }

  private mergeTableResults(
    target: SilverProcessingResult['tableResults'], 
    source: SilverProcessingResult['tableResults']
  ): void {
    target.playersCreated += source.playersCreated;
    target.playersUpdated += source.playersUpdated;
    target.teamsCreated += source.teamsCreated;
    target.teamsUpdated += source.teamsUpdated;
    target.marketSignalsCreated += source.marketSignalsCreated;
    target.injuriesCreated += source.injuriesCreated;
    target.depthChartsCreated += source.depthChartsCreated;
  }
}

// Export singleton instance
export const silverLayerService = SilverLayerService.getInstance();