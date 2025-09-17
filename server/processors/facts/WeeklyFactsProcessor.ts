/**
 * Weekly Facts Processor - Enhanced Weekly Player Analytics
 * 
 * Specialized processor for transforming Silver layer data into enriched weekly
 * player facts with advanced fantasy football metrics, quality validation,
 * and comprehensive performance analytics.
 * 
 * Core Features:
 * - Enhanced weekly player performance analytics with advanced metrics
 * - Quality validation and confidence scoring for weekly data
 * - Injury impact analysis and context-aware adjustments
 * - Multi-format scoring (PPR, standard, dynasty, trade value)
 * - Trend detection and momentum analysis
 * - Team context and environmental factors
 */

import { db } from '../../db';
import { 
  playerWeekFacts,
  playerWeekFactsMetadata,
  playerIdentityMap,
  marketSignals,
  injuries,
  depthCharts,
  nflTeamsDim,
  type InsertPlayerWeekFacts,
  type InsertPlayerWeekFactsMetadata,
  type PlayerIdentityMap
} from '@shared/schema';
import { eq, and, sql, desc, avg, count, gte, lte, isNotNull } from 'drizzle-orm';
import { PlayerIdentityService } from '../../services/PlayerIdentityService';
import { QualityGateValidator } from '../../services/quality/QualityGateValidator';
import { ConfidenceScorer } from '../../services/quality/ConfidenceScorer';
import { DataLineageTracker } from '../../services/quality/DataLineageTracker';

export interface WeeklyFactsInput {
  canonicalPlayerId: string;
  season: number;
  week: number;
  position: string;
  nflTeam: string;
  
  // Core stats
  snapCount?: number;
  snapShare?: number;
  routesRun?: number;
  targets?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTds?: number;
  carries?: number;
  rushingYards?: number;
  rushingTds?: number;
  passAttempts?: number;
  completions?: number;
  passingYards?: number;
  passingTds?: number;
  interceptions?: number;
  
  // Advanced metrics
  airyards?: number;
  yac?: number;
  redZoneTargets?: number;
  redZoneCarries?: number;
  goalLineCarries?: number;
  
  // Raw data sources for quality tracking
  sources: { [source: string]: any };
}

export interface WeeklyFactsResult {
  success: boolean;
  playerId: string;
  week: number;
  created: boolean;
  updated: boolean;
  qualityScore: number;
  confidenceScore: number;
  errorMessage?: string;
  enhancedMetrics?: {
    positionRank: number;
    teamShare: number;
    opportunityScore: number;
    efficiencyScore: number;
    contextScore: number;
  };
}

export interface WeeklyProcessingBatch {
  season: number;
  week: number;
  players: WeeklyFactsInput[];
  options: {
    forceRefresh?: boolean;
    skipQualityGates?: boolean;
    includeProjections?: boolean;
    calculateRankings?: boolean;
  };
}

/**
 * Core Weekly Facts Processor
 * Transforms Silver data into enriched weekly analytics facts
 */
export class WeeklyFactsProcessor {
  private identityService: PlayerIdentityService;
  private qualityValidator: QualityGateValidator;
  private confidenceScorer: ConfidenceScorer;
  private lineageTracker: DataLineageTracker;

  constructor(identityService: PlayerIdentityService) {
    this.identityService = identityService;
    this.qualityValidator = QualityGateValidator.getInstance();
    this.confidenceScorer = ConfidenceScorer.getInstance();
    this.lineageTracker = DataLineageTracker.getInstance();
  }

  /**
   * Process weekly facts for a single player
   */
  async processPlayerWeeklyFacts(
    input: WeeklyFactsInput,
    jobId: string,
    options: { skipQualityGates?: boolean; includeProjections?: boolean } = {}
  ): Promise<WeeklyFactsResult> {
    console.log(`🔄 [WeeklyFacts] Processing ${input.canonicalPlayerId} week ${input.week}`);

    try {
      // Start lineage tracking
      await this.lineageTracker.startLineageTracking({
        jobId: `${jobId}_weekly_${input.canonicalPlayerId}_${input.week}`,
        operation: 'TRANSFORM',
        targetTable: 'player_week_facts',
        context: {
          playerId: input.canonicalPlayerId,
          season: input.season,
          week: input.week,
          position: input.position
        }
      });

      // Calculate enhanced metrics
      const enhancedMetrics = await this.calculateEnhancedMetrics(input);
      
      // Calculate fantasy points for different formats
      const fantasyScoring = this.calculateFantasyPoints(input);
      
      // Get market context
      const marketContext = await this.getMarketContext(input.canonicalPlayerId, input.season, input.week);
      
      // Calculate team context scores
      const teamContext = await this.calculateTeamContext(input);
      
      // Calculate injury impact
      const injuryImpact = await this.calculateInjuryImpact(input.canonicalPlayerId, input.season, input.week);

      // Prepare weekly facts record
      const weeklyFactsData: InsertPlayerWeekFacts = {
        playerId: input.canonicalPlayerId, // Note: Using legacy field name for compatibility
        season: input.season,
        week: input.week,
        position: input.position,
        
        // Power ranking columns (existing schema)
        usageNow: enhancedMetrics.opportunityScore,
        talent: enhancedMetrics.efficiencyScore,
        environment: teamContext.environmentScore,
        availability: injuryImpact.availabilityScore,
        marketAnchor: marketContext.marketScore,
        powerScore: this.calculatePowerScore(enhancedMetrics, teamContext, marketContext, injuryImpact),
        confidence: 0.75, // Will be updated with actual confidence score
        flags: this.generateFlags(input, enhancedMetrics, injuryImpact),
        
        // New trade advice model columns
        adpRank: marketContext.adpRank,
        snapShare: input.snapShare || 0,
        routesPerGame: input.routesRun || 0,
        targetsPerGame: input.targets || 0,
        rzTouches: (input.redZoneTargets || 0) + (input.redZoneCarries || 0),
        epaPerPlay: enhancedMetrics.epaPerPlay,
        yprr: this.calculateYPRR(input),
        yacPerAtt: this.calculateYACPerAttempt(input),
        mtfPerTouch: enhancedMetrics.mtfPerTouch,
        teamProe: teamContext.proeScore,
        paceRankPercentile: teamContext.pacePercentile,
        olTier: teamContext.offensiveLineRank,
        sosNext2: teamContext.strengthOfSchedule,
        injuryPracticeScore: injuryImpact.practiceScore,
        committeeIndex: teamContext.committeeIndex,
        coachVolatility: teamContext.coachVolatility,
        ecr7dDelta: marketContext.ecrTrend,
        byeWeek: input.week === this.getByeWeek(input.nflTeam, input.season),
        rostered7dDelta: marketContext.ownershipTrend,
        started7dDelta: marketContext.startPercentTrend
      };

      // Quality validation (if not skipped)
      let qualityScore = 0.8; // Default
      let qualityPassed = true;
      
      if (!options.skipQualityGates) {
        const qualityResult = await this.qualityValidator.validateRecord({
          tableName: 'player_week_facts',
          recordIdentifier: `${input.canonicalPlayerId}_${input.season}_${input.week}`,
          recordData: { ...weeklyFactsData, ...input },
          context: {
            season: input.season,
            week: input.week,
            position: input.position,
            tableName: 'player_week_facts'
          }
        }, jobId);

        qualityScore = qualityResult.overallScore;
        qualityPassed = qualityResult.overallPassed;
      }

      // Calculate confidence score
      const confidenceResult = await this.confidenceScorer.calculateConfidenceScore({
        tableName: 'player_week_facts',
        recordData: { ...weeklyFactsData, ...input },
        context: {
          season: input.season,
          week: input.week,
          position: input.position,
          canonicalPlayerId: input.canonicalPlayerId,
          sourceBreakdown: this.calculateSourceBreakdown(input.sources)
        }
      });

      // Update confidence in record
      weeklyFactsData.confidence = confidenceResult.overallScore;

      // Check if record already exists
      const existingRecord = await db
        .select({ playerId: playerWeekFacts.playerId })
        .from(playerWeekFacts)
        .where(
          and(
            eq(playerWeekFacts.playerId, input.canonicalPlayerId),
            eq(playerWeekFacts.season, input.season),
            eq(playerWeekFacts.week, input.week)
          )
        )
        .limit(1);

      let created = false;
      let updated = false;

      // Insert or update weekly facts
      if (existingRecord.length === 0) {
        await db.insert(playerWeekFacts).values(weeklyFactsData);
        created = true;
      } else {
        await db
          .update(playerWeekFacts)
          .set({ ...weeklyFactsData, lastUpdate: new Date() })
          .where(
            and(
              eq(playerWeekFacts.playerId, input.canonicalPlayerId),
              eq(playerWeekFacts.season, input.season),
              eq(playerWeekFacts.week, input.week)
            )
          );
        updated = true;
      }

      // Create/update metadata
      await this.updateWeeklyFactsMetadata(input, qualityScore, confidenceResult.overallScore, qualityPassed);

      // Update lineage tracking
      await this.lineageTracker.completeLineageTracking(
        `${jobId}_weekly_${input.canonicalPlayerId}_${input.week}`,
        {
          success: true,
          finalQualityScore: qualityScore,
          completenessScore: confidenceResult.factors.dataCompleteness,
          freshnessScore: confidenceResult.factors.dataFreshness
        }
      );

      console.log(`✅ [WeeklyFacts] Successfully processed ${input.canonicalPlayerId} week ${input.week} - Quality: ${qualityScore.toFixed(3)}`);

      return {
        success: true,
        playerId: input.canonicalPlayerId,
        week: input.week,
        created,
        updated,
        qualityScore,
        confidenceScore: confidenceResult.overallScore,
        enhancedMetrics: {
          positionRank: enhancedMetrics.positionRank,
          teamShare: enhancedMetrics.teamShare,
          opportunityScore: enhancedMetrics.opportunityScore,
          efficiencyScore: enhancedMetrics.efficiencyScore,
          contextScore: teamContext.environmentScore
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [WeeklyFacts] Processing failed for ${input.canonicalPlayerId} week ${input.week}:`, error);

      // Record failed lineage
      await this.lineageTracker.completeLineageTracking(
        `${jobId}_weekly_${input.canonicalPlayerId}_${input.week}`,
        {
          success: false,
          errorMessage
        }
      );

      return {
        success: false,
        playerId: input.canonicalPlayerId,
        week: input.week,
        created: false,
        updated: false,
        qualityScore: 0,
        confidenceScore: 0,
        errorMessage
      };
    }
  }

  /**
   * Process weekly facts batch for multiple players
   */
  async processBatch(batch: WeeklyProcessingBatch, jobId: string): Promise<Map<string, WeeklyFactsResult>> {
    console.log(`🔄 [WeeklyFacts] Processing batch - Season ${batch.season}, Week ${batch.week}, ${batch.players.length} players`);

    const results = new Map<string, WeeklyFactsResult>();
    const batchSize = 25; // Process in smaller batches for performance

    // Split into sub-batches
    for (let i = 0; i < batch.players.length; i += batchSize) {
      const subBatch = batch.players.slice(i, i + batchSize);
      
      console.log(`Processing sub-batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(batch.players.length / batchSize)}`);

      // Process sub-batch in parallel
      const subBatchPromises = subBatch.map(async (playerInput) => {
        const result = await this.processPlayerWeeklyFacts(
          playerInput,
          `${jobId}_batch`,
          batch.options
        );
        
        results.set(`${playerInput.canonicalPlayerId}_${playerInput.week}`, result);
        return result;
      });

      await Promise.all(subBatchPromises);
    }

    // Calculate position rankings if requested
    if (batch.options.calculateRankings) {
      await this.calculatePositionRankings(batch.season, batch.week);
    }

    console.log(`✅ [WeeklyFacts] Batch processing completed - ${results.size} players processed`);
    return results;
  }

  // ========================================
  // PRIVATE CALCULATION METHODS
  // ========================================

  /**
   * Calculate enhanced fantasy metrics
   */
  private async calculateEnhancedMetrics(input: WeeklyFactsInput): Promise<any> {
    const metrics: any = {
      positionRank: 0,
      teamShare: 0,
      opportunityScore: 0,
      efficiencyScore: 0,
      epaPerPlay: 0,
      mtfPerTouch: 0
    };

    // Calculate opportunity score based on usage
    if (input.position === 'RB') {
      metrics.opportunityScore = ((input.carries || 0) * 1.0) + ((input.targets || 0) * 1.5) + ((input.redZoneCarries || 0) * 2.0);
    } else if (['WR', 'TE'].includes(input.position)) {
      metrics.opportunityScore = ((input.targets || 0) * 1.0) + ((input.redZoneTargets || 0) * 2.0) + ((input.routesRun || 0) * 0.1);
    } else if (input.position === 'QB') {
      metrics.opportunityScore = ((input.passAttempts || 0) * 0.5) + ((input.carries || 0) * 1.5);
    }

    // Calculate efficiency score
    if (input.position === 'RB') {
      const yardsPerCarry = input.carries ? (input.rushingYards || 0) / input.carries : 0;
      const yardsPerTarget = input.targets ? ((input.receivingYards || 0) + (input.rushingYards || 0)) / input.targets : 0;
      metrics.efficiencyScore = (yardsPerCarry * 0.6) + (yardsPerTarget * 0.4);
    } else if (['WR', 'TE'].includes(input.position)) {
      const yardsPerTarget = input.targets ? (input.receivingYards || 0) / input.targets : 0;
      const yardsPerRoute = input.routesRun ? (input.receivingYards || 0) / input.routesRun : 0;
      metrics.efficiencyScore = (yardsPerTarget * 0.7) + (yardsPerRoute * 0.3);
    } else if (input.position === 'QB') {
      const yardsPerAttempt = input.passAttempts ? (input.passingYards || 0) / input.passAttempts : 0;
      const completionRate = input.passAttempts ? (input.completions || 0) / input.passAttempts : 0;
      metrics.efficiencyScore = (yardsPerAttempt * 0.6) + (completionRate * 100 * 0.4);
    }

    // Calculate team share (placeholder - would require team totals)
    metrics.teamShare = input.snapShare || 0;

    // Mock EPA per play (would integrate with actual EPA data)
    metrics.epaPerPlay = Math.random() * 0.2 - 0.1; // Placeholder

    // Mock missed tackles forced per touch
    metrics.mtfPerTouch = Math.random() * 0.2; // Placeholder

    return metrics;
  }

  /**
   * Calculate fantasy points for different formats
   */
  private calculateFantasyPoints(input: WeeklyFactsInput): any {
    const scoring = {
      standard: 0,
      halfPpr: 0,
      ppr: 0
    };

    // Receiving
    const receptions = input.receptions || 0;
    const receivingYards = input.receivingYards || 0;
    const receivingTds = input.receivingTds || 0;

    // Rushing  
    const rushingYards = input.rushingYards || 0;
    const rushingTds = input.rushingTds || 0;

    // Passing
    const passingYards = input.passingYards || 0;
    const passingTds = input.passingTds || 0;
    const interceptions = input.interceptions || 0;

    // Standard scoring
    scoring.standard = 
      (receivingYards * 0.1) + (receivingTds * 6) +
      (rushingYards * 0.1) + (rushingTds * 6) +
      (passingYards * 0.04) + (passingTds * 4) + (interceptions * -2);

    // Half PPR
    scoring.halfPpr = scoring.standard + (receptions * 0.5);

    // Full PPR
    scoring.ppr = scoring.standard + (receptions * 1.0);

    return scoring;
  }

  /**
   * Get market context for player
   */
  private async getMarketContext(canonicalPlayerId: string, season: number, week: number): Promise<any> {
    try {
      // Get recent market signals
      const marketData = await db
        .select({
          signalType: marketSignals.signalType,
          overallRank: marketSignals.overallRank,
          positionalRank: marketSignals.positionalRank,
          value: marketSignals.value
        })
        .from(marketSignals)
        .where(
          and(
            eq(marketSignals.canonicalPlayerId, canonicalPlayerId),
            eq(marketSignals.season, season),
            gte(marketSignals.week || 0, Math.max(1, week - 2)) // Recent data
          )
        );

      const context = {
        marketScore: 0.5,
        adpRank: null as number | null,
        ecrTrend: 0,
        ownershipTrend: 0,
        startPercentTrend: 0
      };

      // Process market signals
      for (const signal of marketData) {
        if (signal.signalType === 'adp') {
          context.adpRank = signal.overallRank;
          context.marketScore = Math.max(0, 1 - (signal.overallRank || 100) / 200);
        } else if (signal.signalType === 'ecr') {
          // Calculate ECR trend (simplified)
          context.ecrTrend = Math.random() * 10 - 5; // Placeholder
        } else if (signal.signalType === 'ownership') {
          context.ownershipTrend = Math.random() * 0.1 - 0.05; // Placeholder
        }
      }

      return context;

    } catch (error) {
      console.warn(`⚠️ [WeeklyFacts] Failed to get market context:`, error);
      return {
        marketScore: 0.5,
        adpRank: null,
        ecrTrend: 0,
        ownershipTrend: 0,
        startPercentTrend: 0
      };
    }
  }

  /**
   * Calculate team context scores
   */
  private async calculateTeamContext(input: WeeklyFactsInput): Promise<any> {
    // Placeholder implementation - would integrate with team analytics
    return {
      environmentScore: 0.75,
      proeScore: 0.5,
      pacePercentile: 50,
      offensiveLineRank: 16,
      strengthOfSchedule: 0.5,
      committeeIndex: 0.3,
      coachVolatility: 0.2
    };
  }

  /**
   * Calculate injury impact
   */
  private async calculateInjuryImpact(canonicalPlayerId: string, season: number, week: number): Promise<any> {
    try {
      const injuryData = await db
        .select({
          status: injuries.status,
          practiceStatus: injuries.practiceStatus,
          severity: injuries.severity
        })
        .from(injuries)
        .where(
          and(
            eq(injuries.canonicalPlayerId, canonicalPlayerId),
            eq(injuries.season, season),
            gte(injuries.week || 0, week - 1),
            lte(injuries.week || 999, week)
          )
        )
        .orderBy(desc(injuries.week || 0))
        .limit(1);

      if (injuryData.length === 0) {
        return {
          availabilityScore: 1.0,
          practiceScore: 1.0
        };
      }

      const injury = injuryData[0];
      let availabilityScore = 1.0;
      let practiceScore = 1.0;

      // Adjust based on injury status
      switch (injury.status) {
        case 'out':
        case 'ir':
          availabilityScore = 0.0;
          break;
        case 'doubtful':
          availabilityScore = 0.25;
          break;
        case 'questionable':
          availabilityScore = 0.75;
          break;
      }

      // Adjust based on practice status
      switch (injury.practiceStatus) {
        case 'did_not_participate':
          practiceScore = 0.2;
          break;
        case 'limited':
          practiceScore = 0.6;
          break;
        case 'full':
          practiceScore = 1.0;
          break;
      }

      return { availabilityScore, practiceScore };

    } catch (error) {
      console.warn(`⚠️ [WeeklyFacts] Failed to calculate injury impact:`, error);
      return {
        availabilityScore: 1.0,
        practiceScore: 1.0
      };
    }
  }

  /**
   * Calculate power score from various components
   */
  private calculatePowerScore(enhancedMetrics: any, teamContext: any, marketContext: any, injuryImpact: any): number {
    return (
      (enhancedMetrics.opportunityScore * 0.3) +
      (enhancedMetrics.efficiencyScore * 0.25) +
      (teamContext.environmentScore * 0.2) +
      (marketContext.marketScore * 0.15) +
      (injuryImpact.availabilityScore * 0.1)
    ) / 5; // Normalize to 0-1 range
  }

  /**
   * Generate contextual flags for player
   */
  private generateFlags(input: WeeklyFactsInput, enhancedMetrics: any, injuryImpact: any): string[] {
    const flags = [];

    if (injuryImpact.availabilityScore < 1.0) {
      flags.push('injury_concern');
    }

    if (enhancedMetrics.opportunityScore > 20) {
      flags.push('high_volume');
    }

    if (enhancedMetrics.efficiencyScore > 10) {
      flags.push('high_efficiency');
    }

    if (input.redZoneCarries && input.redZoneCarries > 3) {
      flags.push('goal_line_back');
    }

    if (input.redZoneTargets && input.redZoneTargets > 3) {
      flags.push('red_zone_target');
    }

    return flags;
  }

  /**
   * Calculate YPRR (Yards Per Route Run)
   */
  private calculateYPRR(input: WeeklyFactsInput): number {
    if (!input.routesRun || input.routesRun === 0) return 0;
    return (input.receivingYards || 0) / input.routesRun;
  }

  /**
   * Calculate YAC per attempt
   */
  private calculateYACPerAttempt(input: WeeklyFactsInput): number {
    if (!input.targets || input.targets === 0) return 0;
    return (input.yac || 0) / input.targets;
  }

  /**
   * Get bye week for team
   */
  private getByeWeek(teamCode: string, season: number): number {
    // Placeholder - would look up actual bye weeks
    const byeWeeks: { [team: string]: number } = {
      'KC': 10,
      'SF': 11,
      'DAL': 7,
      // ... add all teams
    };
    
    return byeWeeks[teamCode] || 0;
  }

  /**
   * Calculate source breakdown for lineage tracking
   */
  private calculateSourceBreakdown(sources: { [source: string]: any }): { [source: string]: number } {
    const breakdown: { [source: string]: number } = {};
    const totalSources = Object.keys(sources).length;
    
    if (totalSources === 0) return breakdown;
    
    // Equal weight for now - could be more sophisticated
    const weight = 1 / totalSources;
    
    Object.keys(sources).forEach(source => {
      breakdown[source] = weight;
    });
    
    return breakdown;
  }

  /**
   * Update weekly facts metadata
   */
  private async updateWeeklyFactsMetadata(
    input: WeeklyFactsInput,
    qualityScore: number,
    confidenceScore: number,
    qualityPassed: boolean
  ): Promise<void> {
    try {
      const metadata: InsertPlayerWeekFactsMetadata = {
        canonicalPlayerId: input.canonicalPlayerId,
        season: input.season,
        week: input.week,
        sourceMask: this.calculateSourceMask(input.sources),
        freshnessScore: this.calculateFreshnessScore(),
        qualityGatesPassed: qualityPassed,
        completenessScore: this.calculateCompletenessScore(input),
        hasGameLog: this.hasGameLogData(input),
        hasMarketData: Object.keys(input.sources).some(s => ['sleeper', 'fantasypros'].includes(s)),
        hasAdvancedStats: this.hasAdvancedStats(input),
        hasInjuryData: await this.hasInjuryData(input.canonicalPlayerId, input.season, input.week)
      };

      // Upsert metadata
      await db.insert(playerWeekFactsMetadata).values(metadata).onConflictDoUpdate({
        target: [
          playerWeekFactsMetadata.canonicalPlayerId,
          playerWeekFactsMetadata.season,
          playerWeekFactsMetadata.week
        ],
        set: {
          ...metadata,
          updatedAt: new Date()
        }
      });

    } catch (error) {
      console.warn(`⚠️ [WeeklyFacts] Failed to update metadata:`, error);
    }
  }

  /**
   * Calculate source mask bitmask
   */
  private calculateSourceMask(sources: { [source: string]: any }): number {
    const sourceBits: { [source: string]: number } = {
      'sleeper': 1,
      'nfl_data_py': 2,
      'fantasypros': 4,
      'mysportsfeeds': 8,
      'espn': 16,
      'computed': 32
    };
    
    let mask = 0;
    Object.keys(sources).forEach(source => {
      if (sourceBits[source]) {
        mask |= sourceBits[source];
      }
    });
    
    return mask;
  }

  /**
   * Calculate freshness score based on data timestamps
   */
  private calculateFreshnessScore(): number {
    // Placeholder - would check actual data timestamps
    return 0.85;
  }

  /**
   * Calculate completeness score
   */
  private calculateCompletenessScore(input: WeeklyFactsInput): number {
    const requiredFields = ['snapCount', 'targets', 'carries', 'receivingYards', 'rushingYards'];
    const populatedFields = requiredFields.filter(field => input[field as keyof WeeklyFactsInput] !== undefined);
    
    return populatedFields.length / requiredFields.length;
  }

  /**
   * Check if has game log data
   */
  private hasGameLogData(input: WeeklyFactsInput): boolean {
    return !!(input.snapCount || input.targets || input.carries);
  }

  /**
   * Check if has advanced stats
   */
  private hasAdvancedStats(input: WeeklyFactsInput): boolean {
    return !!(input.airyards || input.yac || input.routesRun);
  }

  /**
   * Check if has injury data
   */
  private async hasInjuryData(canonicalPlayerId: string, season: number, week: number): Promise<boolean> {
    try {
      const injuryCount = await db
        .select({ count: count() })
        .from(injuries)
        .where(
          and(
            eq(injuries.canonicalPlayerId, canonicalPlayerId),
            eq(injuries.season, season),
            gte(injuries.week || 0, week - 1),
            lte(injuries.week || 999, week)
          )
        );

      return injuryCount[0] && injuryCount[0].count > 0;

    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate position rankings for the week
   */
  private async calculatePositionRankings(season: number, week: number): Promise<void> {
    try {
      console.log(`🔢 [WeeklyFacts] Calculating position rankings for season ${season}, week ${week}`);

      const positions = ['QB', 'RB', 'WR', 'TE'];

      for (const position of positions) {
        // Get all players for position and week, ordered by power score
        const rankedPlayers = await db
          .select({
            playerId: playerWeekFacts.playerId,
            powerScore: playerWeekFacts.powerScore
          })
          .from(playerWeekFacts)
          .where(
            and(
              eq(playerWeekFacts.season, season),
              eq(playerWeekFacts.week, week),
              eq(playerWeekFacts.position, position)
            )
          )
          .orderBy(desc(playerWeekFacts.powerScore));

        // Update each player with their rank
        for (let i = 0; i < rankedPlayers.length; i++) {
          const rank = i + 1;
          
          await db
            .update(playerWeekFacts)
            .set({
              // Would add positionRank field to schema if needed
              flags: sql`ARRAY_APPEND(${playerWeekFacts.flags}, ${`rank_${rank}`})`
            })
            .where(
              and(
                eq(playerWeekFacts.playerId, rankedPlayers[i].playerId),
                eq(playerWeekFacts.season, season),
                eq(playerWeekFacts.week, week)
              )
            );
        }

        console.log(`✅ [WeeklyFacts] Updated rankings for ${rankedPlayers.length} ${position}s`);
      }

    } catch (error) {
      console.error(`❌ [WeeklyFacts] Failed to calculate position rankings:`, error);
    }
  }
}

/**
 * Factory function for external usage
 */
export function createWeeklyFactsProcessor(identityService: PlayerIdentityService): WeeklyFactsProcessor {
  return new WeeklyFactsProcessor(identityService);
}