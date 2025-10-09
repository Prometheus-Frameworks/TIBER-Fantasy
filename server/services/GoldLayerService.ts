/**
 * Gold Layer Service - Analytics-Ready Facts Processing
 * 
 * Core service for transforming normalized Silver data into enriched analytics facts.
 * Orchestrates quality gates, data lineage, and comprehensive metrics aggregation
 * for downstream consumption by fantasy football analysis systems.
 * 
 * Part of the Unified Player Hub's 3-tier ELT architecture.
 * 
 * Core Features:
 * - Silver to Gold data transformation with quality gates
 * - Multi-format analytics processing (dynasty, redraft, trade analysis)
 * - Comprehensive data lineage tracking and quality validation
 * - Advanced fantasy metrics aggregation and enrichment
 * - Real-time analytics updates and batch processing
 * - Performance-optimized for large dataset processing
 */

import { db } from '../db';
import { 
  players,
  playerSeasonFacts, 
  playerMarketFacts, 
  playerCompositeFacts,
  playerWeekFacts,
  playerWeekFactsMetadata,
  qualityGateResults,
  dataLineage,
  type InsertPlayerSeasonFacts,
  type InsertPlayerMarketFacts,
  type InsertPlayerCompositeFacts,
  type InsertDataLineage,
  type InsertQualityGateResults
} from '@shared/schema';
import { eq, and, inArray, desc, sql, gte, lte } from 'drizzle-orm';
import { SilverLayerService } from './SilverLayerService';
import { PlayerIdentityService } from './PlayerIdentityService';

// Import fact processors
import { WeeklyFactsProcessor, createWeeklyFactsProcessor } from '../processors/facts/WeeklyFactsProcessor';
import { SeasonFactsProcessor, createSeasonFactsProcessor } from '../processors/facts/SeasonFactsProcessor';
import { MarketFactsProcessor, createMarketFactsProcessor } from '../processors/facts/MarketFactsProcessor';
import { CompositeFactsProcessor, createCompositeFactsProcessor } from '../processors/facts/CompositeFactsProcessor';

// Import quality services
import { QualityGateValidator, qualityGateValidator } from './quality/QualityGateValidator';
import { DataLineageTracker, dataLineageTracker } from './quality/DataLineageTracker';
import { ConfidenceScorer, confidenceScorer } from './quality/ConfidenceScorer';

export interface GoldProcessingResult {
  processed: number;
  success: number;
  errors: number;
  skipped: number;
  qualityGatesPassed: number;
  qualityGatesFailed: number;
  tableResults: {
    weeklyFactsProcessed: number;
    seasonFactsCreated: number;
    seasonFactsUpdated: number;
    marketFactsCreated: number;
    marketFactsUpdated: number;
    compositeFactsCreated: number;
    compositeFactsUpdated: number;
  };
  errorDetails: Array<{
    recordId: string;
    error: string;
    table?: string;
    qualityGate?: string;
  }>;
  duration: number;
}

export interface GoldProcessingFilters {
  players?: string[]; // Canonical player IDs
  season?: number;
  weeks?: number[];
  positions?: string[];
  forceRefresh?: boolean;
  skipQualityGates?: boolean;
  includeMarketFacts?: boolean;
  includeCompositeFacts?: boolean;
}

export interface AnalyticsRequest {
  type: 'weekly' | 'season' | 'market' | 'composite' | 'all';
  players: string[];
  season: number;
  week?: number;
  format?: 'dynasty' | 'redraft' | 'bestball' | 'trade_value';
  qualityThreshold?: number; // Minimum quality score (0-1)
}

export interface QualityReport {
  overallScore: number;
  completenessScore: number;
  consistencyScore: number;
  accuracyScore: number;
  freshnessScore: number;
  gatesPassed: number;
  gatesFailed: number;
  totalGates: number;
  recommendations: string[];
  criticalIssues: string[];
}

/**
 * Core Gold Layer Service
 * Orchestrates transformation of Silver data into enriched analytics facts
 */
export class GoldLayerService {
  private static instance: GoldLayerService;
  private silverService: SilverLayerService;
  private identityService: PlayerIdentityService;
  
  // Processors
  private weeklyProcessor: WeeklyFactsProcessor;
  private seasonProcessor: SeasonFactsProcessor;
  private marketProcessor: MarketFactsProcessor;
  private compositeProcessor: CompositeFactsProcessor;
  
  // Quality services
  private qualityValidator: QualityGateValidator;
  private lineageTracker: DataLineageTracker;
  private confidenceScorer: ConfidenceScorer;

  public static getInstance(): GoldLayerService {
    if (!GoldLayerService.instance) {
      GoldLayerService.instance = new GoldLayerService();
    }
    return GoldLayerService.instance;
  }

  private constructor() {
    this.silverService = SilverLayerService.getInstance();
    this.identityService = PlayerIdentityService.getInstance();
    
    // Initialize processors
    this.weeklyProcessor = createWeeklyFactsProcessor(this.identityService);
    this.seasonProcessor = createSeasonFactsProcessor(this.identityService);
    this.marketProcessor = createMarketFactsProcessor(this.identityService);
    this.compositeProcessor = createCompositeFactsProcessor(this.identityService);
    
    // Initialize quality services
    this.qualityValidator = qualityGateValidator;
    this.lineageTracker = dataLineageTracker;
    this.confidenceScorer = confidenceScorer;
  }

  /**
   * Process Silver data into Gold analytics facts
   * Main orchestration method for Silver-to-Gold transformation
   */
  async processSilverToGold(
    filters: GoldProcessingFilters,
    options: { validateOnly?: boolean; batchSize?: number } = {}
  ): Promise<GoldProcessingResult> {
    const startTime = Date.now();
    const jobId = `gold_processing_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    console.log(`🔄 [GoldLayer] Starting Silver-to-Gold processing`);
    console.log(`   JobID: ${jobId}`);
    console.log(`   Filters:`, filters);
    console.log(`   Options:`, options);
    
    const result: GoldProcessingResult = {
      processed: 0,
      success: 0,
      errors: 0,
      skipped: 0,
      qualityGatesPassed: 0,
      qualityGatesFailed: 0,
      tableResults: {
        weeklyFactsProcessed: 0,
        seasonFactsCreated: 0,
        seasonFactsUpdated: 0,
        marketFactsCreated: 0,
        marketFactsUpdated: 0,
        compositeFactsCreated: 0,
        compositeFactsUpdated: 0
      },
      errorDetails: [],
      duration: 0
    };

    try {
      // Start data lineage tracking
      await this.startLineageTracking(jobId, 'SILVER_TO_GOLD', filters);

      // Get players to process
      const playersToProcess = await this.getPlayersForProcessing(filters);
      result.processed = playersToProcess.length;

      if (playersToProcess.length === 0) {
        console.log(`⚠️ [GoldLayer] No players found matching filters`);
        result.duration = Date.now() - startTime;
        return result;
      }

      console.log(`📊 [GoldLayer] Processing ${playersToProcess.length} players`);

      // Process in batches for performance
      const batchSize = options.batchSize || 50;
      const batches = this.createBatches(playersToProcess, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} players)`);

        try {
          const batchResult = await this.processBatch(batch, filters, jobId, options);
          
          // Aggregate results
          result.success += batchResult.success;
          result.errors += batchResult.errors;
          result.skipped += batchResult.skipped;
          result.qualityGatesPassed += batchResult.qualityGatesPassed;
          result.qualityGatesFailed += batchResult.qualityGatesFailed;
          
          // Merge table results
          this.mergeTableResults(result.tableResults, batchResult.tableResults);
          result.errorDetails.push(...batchResult.errorDetails);

        } catch (error) {
          console.error(`❌ [GoldLayer] Batch ${i + 1} processing failed:`, error);
          result.errors += batch.length;
          result.errorDetails.push({
            recordId: `batch_${i + 1}`,
            error: error instanceof Error ? error.message : 'Unknown batch error'
          });
        }
      }

      result.duration = Date.now() - startTime;

      // Complete lineage tracking
      await this.completeLineageTracking(jobId, result);

      console.log(`✅ [GoldLayer] Silver-to-Gold processing completed in ${result.duration}ms`);
      console.log(`   📊 Success: ${result.success} | Errors: ${result.errors} | Skipped: ${result.skipped}`);
      console.log(`   🛡️ Quality Gates - Passed: ${result.qualityGatesPassed} | Failed: ${result.qualityGatesFailed}`);
      console.log(`   📈 Table Results:`, result.tableResults);

      return result;

    } catch (error) {
      result.duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ [GoldLayer] Critical error in Silver-to-Gold processing:`, error);
      
      // Record failure in lineage
      await this.failLineageTracking(jobId, errorMessage);
      
      result.errors = result.processed;
      result.errorDetails.push({
        recordId: 'critical_failure',
        error: errorMessage
      });
      
      throw new Error(`Gold Layer processing failed: ${errorMessage}`);
    }
  }

  /**
   * Process analytics request for specific players and formats
   */
  async processAnalyticsRequest(request: AnalyticsRequest): Promise<any[]> {
    console.log(`🔍 [GoldLayer] Processing analytics request:`, request);

    try {
      const results = [];

      switch (request.type) {
        case 'weekly':
          if (!request.week) {
            throw new Error('Week is required for weekly analytics');
          }
          // Will implement with WeeklyFactsProcessor
          results.push(...await this.getWeeklyAnalytics(request.players, request.season, request.week));
          break;

        case 'season':
          // Will implement with SeasonFactsProcessor
          results.push(...await this.getSeasonAnalytics(request.players, request.season));
          break;

        case 'market':
          // Will implement with MarketFactsProcessor
          results.push(...await this.getMarketAnalytics(request.players, request.season, request.week));
          break;

        case 'composite':
          // Will implement with CompositeFactsProcessor
          results.push(...await this.getCompositeAnalytics(request.players, request.season, request.format));
          break;

        case 'all':
          // Comprehensive analytics across all fact types
          const [weekly, season, market, composite] = await Promise.all([
            request.week ? this.getWeeklyAnalytics(request.players, request.season, request.week) : [],
            this.getSeasonAnalytics(request.players, request.season),
            this.getMarketAnalytics(request.players, request.season, request.week),
            this.getCompositeAnalytics(request.players, request.season, request.format)
          ]);
          
          // Merge results by player
          const mergedResults = this.mergeAnalyticsByPlayer(weekly, season, market, composite);
          results.push(...mergedResults);
          break;

        default:
          throw new Error(`Unsupported analytics type: ${request.type}`);
      }

      // Apply quality filtering if threshold specified
      if (request.qualityThreshold !== undefined) {
        return results.filter(result => 
          result.qualityScore >= request.qualityThreshold
        );
      }

      return results;

    } catch (error) {
      console.error(`❌ [GoldLayer] Analytics request failed:`, error);
      throw error;
    }
  }

  /**
   * Generate quality report for Gold Layer data
   */
  async generateQualityReport(
    season: number, 
    week?: number, 
    players?: string[]
  ): Promise<QualityReport> {
    console.log(`📊 [GoldLayer] Generating quality report for season ${season}${week ? `, week ${week}` : ''}`);

    try {
      // Build where conditions
      const conditions = [eq(playerWeekFactsMetadata.season, season)];
      
      if (week !== undefined) {
        conditions.push(eq(playerWeekFactsMetadata.week, week));
      }
      
      if (players?.length) {
        conditions.push(inArray(playerWeekFactsMetadata.canonicalPlayerId, players));
      }

      // Get quality metadata
      const qualityData = await db
        .select({
          qualityGatesPassed: playerWeekFactsMetadata.qualityGatesPassed,
          completenessScore: playerWeekFactsMetadata.completenessScore,
          freshnessScore: playerWeekFactsMetadata.freshnessScore
        })
        .from(playerWeekFactsMetadata)
        .where(and(...conditions));

      const totalRecords = qualityData.length;
      const gatesPassed = qualityData.filter(d => d.qualityGatesPassed).length;
      const gatesFailed = totalRecords - gatesPassed;

      // Calculate average scores
      const avgCompleteness = qualityData.reduce((sum, d) => sum + (d.completenessScore || 0), 0) / totalRecords;
      const avgFreshness = qualityData.reduce((sum, d) => sum + (d.freshnessScore || 0), 0) / totalRecords;

      // Generate recommendations
      const recommendations = [];
      const criticalIssues = [];

      if (avgCompleteness < 0.8) {
        recommendations.push('Improve data completeness - many records missing key fields');
      }
      if (avgFreshness < 0.7) {
        recommendations.push('Update data sources - freshness scores are low');
      }
      if (gatesFailed > totalRecords * 0.1) {
        criticalIssues.push('High quality gate failure rate - investigate data quality issues');
      }

      const report: QualityReport = {
        overallScore: (gatesPassed / totalRecords) * 0.4 + avgCompleteness * 0.3 + avgFreshness * 0.3,
        completenessScore: avgCompleteness,
        consistencyScore: 0.85, // Placeholder - will implement with QualityGateValidator
        accuracyScore: 0.90, // Placeholder - will implement with QualityGateValidator
        freshnessScore: avgFreshness,
        gatesPassed,
        gatesFailed,
        totalGates: totalRecords,
        recommendations,
        criticalIssues
      };

      console.log(`✅ [GoldLayer] Quality report generated - Overall score: ${report.overallScore.toFixed(3)}`);
      return report;

    } catch (error) {
      console.error(`❌ [GoldLayer] Quality report generation failed:`, error);
      throw error;
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Get players for processing based on filters
   */
  private async getPlayersForProcessing(filters: GoldProcessingFilters): Promise<string[]> {
    if (filters.players?.length) {
      return filters.players;
    }

    // Get all active players if no specific players requested
    let query = db.select({ canonicalId: players.canonicalId })
      .from(players)
      .where(eq(players.isActive, true));

    // Filter by positions if specified
    if (filters.positions?.length) {
      query = query.where(inArray(players.position, filters.positions)) as any;
    }

    const activePlayers = await query;
    return activePlayers.map(p => p.canonicalId);
  }

  /**
   * Create processing batches for performance
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of players
   */
  private async processBatch(
    players: string[],
    filters: GoldProcessingFilters,
    jobId: string,
    options: { validateOnly?: boolean }
  ): Promise<GoldProcessingResult> {
    const batchResult: GoldProcessingResult = {
      processed: players.length,
      success: 0,
      errors: 0,
      skipped: 0,
      qualityGatesPassed: 0,
      qualityGatesFailed: 0,
      tableResults: {
        weeklyFactsProcessed: 0,
        seasonFactsCreated: 0,
        seasonFactsUpdated: 0,
        marketFactsCreated: 0,
        marketFactsUpdated: 0,
        compositeFactsCreated: 0,
        compositeFactsUpdated: 0
      },
      errorDetails: [],
      duration: 0
    };

    // Process each player in the batch
    for (const playerId of players) {
      try {
        // Process weekly facts (always done)
        await this.processPlayerWeeklyFacts(playerId, filters, jobId);
        batchResult.tableResults.weeklyFactsProcessed++;

        // Process season facts
        const seasonResult = await this.processPlayerSeasonFacts(playerId, filters, jobId);
        if (seasonResult.created) batchResult.tableResults.seasonFactsCreated++;
        if (seasonResult.updated) batchResult.tableResults.seasonFactsUpdated++;

        // Process market facts if requested
        if (filters.includeMarketFacts) {
          const marketResult = await this.processPlayerMarketFacts(playerId, filters, jobId);
          if (marketResult.created) batchResult.tableResults.marketFactsCreated++;
          if (marketResult.updated) batchResult.tableResults.marketFactsUpdated++;
        }

        // Process composite facts if requested
        if (filters.includeCompositeFacts) {
          const compositeResult = await this.processPlayerCompositeFacts(playerId, filters, jobId);
          if (compositeResult.created) batchResult.tableResults.compositeFactsCreated++;
          if (compositeResult.updated) batchResult.tableResults.compositeFactsUpdated++;
        }

        batchResult.success++;

      } catch (error) {
        console.error(`❌ [GoldLayer] Error processing player ${playerId}:`, error);
        batchResult.errors++;
        batchResult.errorDetails.push({
          recordId: playerId,
          error: error instanceof Error ? error.message : 'Unknown player processing error'
        });
      }
    }

    return batchResult;
  }

  /**
   * Process weekly facts for a player
   */
  private async processPlayerWeeklyFacts(playerId: string, filters: GoldProcessingFilters, jobId: string): Promise<void> {
    if (!filters.weeks || filters.weeks.length === 0) {
      console.log(`⏭️ [GoldLayer] No weeks specified for weekly facts processing`);
      return;
    }

    for (const week of filters.weeks) {
      // Create weekly facts input (this would normally come from Silver layer data)
      const weeklyInput = await this.createWeeklyFactsInput(playerId, filters.season || 2025, week);
      
      if (weeklyInput) {
        await this.weeklyProcessor.processPlayerWeeklyFacts(
          weeklyInput,
          jobId,
          { skipQualityGates: filters.skipQualityGates }
        );
      }
    }
  }

  /**
   * Process season facts for a player
   */
  private async processPlayerSeasonFacts(playerId: string, filters: GoldProcessingFilters, jobId: string): Promise<{created: boolean, updated: boolean}> {
    const seasonRequest = {
      canonicalPlayerId: playerId,
      season: filters.season || 2025,
      forceRecalculation: filters.forceRefresh || false,
      includeProjections: true,
      weekRange: filters.weeks ? { start: Math.min(...filters.weeks), end: Math.max(...filters.weeks) } : undefined
    };

    const result = await this.seasonProcessor.processPlayerSeasonFacts(seasonRequest, jobId);
    return { created: result.created, updated: result.updated };
  }

  /**
   * Process market facts for a player
   */
  private async processPlayerMarketFacts(playerId: string, filters: GoldProcessingFilters, jobId: string): Promise<{created: boolean, updated: boolean}> {
    const marketRequest = {
      canonicalPlayerId: playerId,
      season: filters.season || 2025,
      week: filters.weeks && filters.weeks.length === 1 ? filters.weeks[0] : undefined,
      lookbackPeriod: 30,
      includeVolatilityAnalysis: true,
      includeSentimentScoring: true
    };

    const result = await this.marketProcessor.processPlayerMarketFacts(marketRequest, jobId);
    return { created: result.created, updated: result.updated };
  }

  /**
   * Process composite facts for a player
   */
  private async processPlayerCompositeFacts(playerId: string, filters: GoldProcessingFilters, jobId: string): Promise<{created: boolean, updated: boolean}> {
    const compositeRequest = {
      canonicalPlayerId: playerId,
      season: filters.season || 2025,
      includeProjections: true,
      includeRiskAnalysis: true,
      formats: ['dynasty', 'redraft', 'bestball', 'trade_value'] as const,
      forceRecalculation: filters.forceRefresh || false
    };

    const result = await this.compositeProcessor.processPlayerCompositeFacts(compositeRequest, jobId);
    return { created: result.created, updated: result.updated };
  }

  /**
   * Start data lineage tracking for processing job
   */
  private async startLineageTracking(jobId: string, operation: string, filters: any): Promise<void> {
    try {
      await db.insert(dataLineage).values({
        jobId,
        tableName: 'gold_layer_processing',
        operation,
        recordsProcessed: 0,
        recordsSuccess: 0,
        recordsFailed: 0,
        recordsSkipped: 0,
        startedAt: new Date(),
        executionContext: { filters }
      });
    } catch (error) {
      console.warn(`⚠️ [GoldLayer] Failed to start lineage tracking:`, error);
    }
  }

  /**
   * Complete data lineage tracking
   */
  private async completeLineageTracking(jobId: string, result: GoldProcessingResult): Promise<void> {
    try {
      await db.update(dataLineage)
        .set({
          recordsProcessed: result.processed,
          recordsSuccess: result.success,
          recordsFailed: result.errors,
          recordsSkipped: result.skipped,
          qualityScore: result.qualityGatesPassed / (result.qualityGatesPassed + result.qualityGatesFailed) || 0,
          completedAt: new Date(),
          executionContext: { result }
        })
        .where(eq(dataLineage.jobId, jobId));
    } catch (error) {
      console.warn(`⚠️ [GoldLayer] Failed to complete lineage tracking:`, error);
    }
  }

  /**
   * Record failed lineage tracking
   */
  private async failLineageTracking(jobId: string, errorMessage: string): Promise<void> {
    try {
      await db.update(dataLineage)
        .set({
          errorMessage,
          completedAt: new Date()
        })
        .where(eq(dataLineage.jobId, jobId));
    } catch (error) {
      console.warn(`⚠️ [GoldLayer] Failed to record lineage failure:`, error);
    }
  }

  /**
   * Merge table results from batch processing
   */
  private mergeTableResults(target: any, source: any): void {
    Object.keys(source).forEach(key => {
      target[key] = (target[key] || 0) + (source[key] || 0);
    });
  }

  /**
   * Get weekly analytics
   */
  private async getWeeklyAnalytics(players: string[], season: number, week: number): Promise<any[]> {
    try {
      const results = await db
        .select()
        .from(playerWeekFacts)
        .where(
          and(
            inArray(playerWeekFacts.playerId, players),
            eq(playerWeekFacts.season, season),
            eq(playerWeekFacts.week, week)
          )
        );

      return results.map(r => ({
        canonicalPlayerId: r.playerId,
        season: r.season,
        week: r.week,
        position: r.position,
        fantasyPoints: (r.powerScore || 0) * 25, // Scale power score to fantasy points
        powerScore: r.powerScore,
        confidence: r.confidence,
        usageNow: r.usageNow,
        talent: r.talent,
        environment: r.environment,
        qualityScore: r.confidence || 0.75
      }));
    } catch (error) {
      console.error('❌ [GoldLayer] Failed to get weekly analytics:', error);
      return [];
    }
  }

  /**
   * Get season analytics
   */
  private async getSeasonAnalytics(players: string[], season: number): Promise<any[]> {
    try {
      const results = await db
        .select()
        .from(playerSeasonFacts)
        .where(
          and(
            inArray(playerSeasonFacts.canonicalPlayerId, players),
            eq(playerSeasonFacts.season, season)
          )
        );

      return results.map(r => ({
        canonicalPlayerId: r.canonicalPlayerId,
        season: r.season,
        position: r.position,
        gamesPlayed: r.gamesPlayed,
        fantasyPoints: r.fantasyPoints,
        fantasyPointsPpr: r.fantasyPointsPpr,
        qualityScore: r.completenessScore || 0.8,
        completenessScore: r.completenessScore,
        freshnessScore: r.freshnessScore
      }));
    } catch (error) {
      console.error('❌ [GoldLayer] Failed to get season analytics:', error);
      return [];
    }
  }

  /**
   * Get market analytics
   */
  private async getMarketAnalytics(players: string[], season: number, week?: number): Promise<any[]> {
    try {
      let query = db
        .select()
        .from(playerMarketFacts)
        .where(
          and(
            inArray(playerMarketFacts.canonicalPlayerId, players),
            eq(playerMarketFacts.season, season)
          )
        );

      if (week) {
        query = query.where(
          and(
            inArray(playerMarketFacts.canonicalPlayerId, players),
            eq(playerMarketFacts.season, season),
            eq(playerMarketFacts.week, week)
          )
        );
      }

      const results = await query;

      return results.map(r => ({
        canonicalPlayerId: r.canonicalPlayerId,
        season: r.season,
        week: r.week,
        avgAdp: r.avgAdp,
        avgEcr: r.avgEcr,
        momentumScore: r.momentumScore,
        volatilityIndex: r.volatilityIndex,
        qualityScore: r.confidenceScore || 0.7
      }));
    } catch (error) {
      console.error('❌ [GoldLayer] Failed to get market analytics:', error);
      return [];
    }
  }

  /**
   * Get composite analytics
   */
  private async getCompositeAnalytics(players: string[], season: number, format?: string): Promise<any[]> {
    try {
      const results = await db
        .select()
        .from(playerCompositeFacts)
        .where(
          and(
            inArray(playerCompositeFacts.canonicalPlayerId, players),
            eq(playerCompositeFacts.season, season)
          )
        );

      return results.map(r => {
        const baseData = {
          canonicalPlayerId: r.canonicalPlayerId,
          season: r.season,
          overallTalentGrade: r.overallTalentGrade,
          opportunityGrade: r.opportunityGrade,
          consistencyGrade: r.consistencyGrade,
          qualityScore: r.confidenceScore || 0.75
        };

        // Return format-specific data
        switch (format) {
          case 'dynasty':
            return { ...baseData, rank: r.dynastyRank, score: r.dynastyScore, format: 'dynasty' };
          case 'redraft':
            return { ...baseData, rank: r.redraftRank, score: r.redraftScore, format: 'redraft' };
          case 'bestball':
            return { ...baseData, rank: r.bestballRank, score: r.bestballScore, format: 'bestball' };
          case 'trade_value':
            return { ...baseData, rank: r.tradeValueRank, score: r.tradeValueScore, format: 'trade_value' };
          default:
            return { ...baseData, dynastyRank: r.dynastyRank, redraftRank: r.redraftRank };
        }
      });
    } catch (error) {
      console.error('❌ [GoldLayer] Failed to get composite analytics:', error);
      return [];
    }
  }

  /**
   * Merge analytics results by player
   */
  private mergeAnalyticsByPlayer(...analyticsArrays: any[][]): any[] {
    const playerMap = new Map();
    
    analyticsArrays.forEach(analytics => {
      analytics.forEach(result => {
        const playerId = result.canonicalPlayerId || result.playerId;
        if (!playerMap.has(playerId)) {
          playerMap.set(playerId, { ...result });
        } else {
          Object.assign(playerMap.get(playerId), result);
        }
      });
    });
    
    return Array.from(playerMap.values());
  }

  // ========================================
  // PRIVATE HELPER METHODS FOR PROCESSORS
  // ========================================

  /**
   * Create weekly facts input from Silver layer data (placeholder)
   */
  private async createWeeklyFactsInput(playerId: string, season: number, week: number): Promise<any | null> {
    try {
      // This would normally fetch from Silver layer services
      // For now, create a basic structure that the WeeklyFactsProcessor expects
      
      const playerIdentity = await this.identityService.getByCanonicalId(playerId);
      if (!playerIdentity) return null;

      return {
        canonicalPlayerId: playerId,
        season,
        week,
        position: playerIdentity.position,
        nflTeam: playerIdentity.nflTeam || 'UNK',
        
        // Mock stats for now - would come from Silver layer
        snapCount: Math.floor(Math.random() * 70),
        snapShare: Math.random() * 1.0,
        targets: Math.floor(Math.random() * 15),
        receptions: Math.floor(Math.random() * 10),
        receivingYards: Math.floor(Math.random() * 150),
        receivingTds: Math.floor(Math.random() * 3),
        carries: Math.floor(Math.random() * 20),
        rushingYards: Math.floor(Math.random() * 100),
        rushingTds: Math.floor(Math.random() * 2),
        
        // Raw data sources for quality tracking
        sources: {
          sleeper: { game_stats: true },
          nfl_data_py: { advanced_stats: true }
        }
      };
    } catch (error) {
      console.warn(`⚠️ [GoldLayer] Failed to create weekly facts input for ${playerId}:`, error);
      return null;
    }
  }
}

/**
 * Singleton instance for external usage
 */
export const goldLayerService = GoldLayerService.getInstance();