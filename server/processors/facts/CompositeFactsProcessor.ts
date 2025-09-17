/**
 * Composite Facts Processor - Cross-Format Unified Player Profiles
 * 
 * Specialized processor for creating comprehensive, unified player profiles that
 * serve multiple fantasy formats (dynasty, redraft, bestball, trade value) by
 * combining data from all fact tables into cohesive player analytics.
 * 
 * Core Features:
 * - Multi-format fantasy scoring and ranking integration
 * - Cross-table analytics aggregation (weekly, season, market facts)
 * - Risk assessment and player valuation across formats
 * - Trend analysis and career trajectory evaluation
 * - Advanced player grading system (talent, opportunity, consistency)
 * - Trade value and dynasty value calculations
 */

import { db } from '../../db';
import { 
  playerCompositeFacts,
  playerSeasonFacts,
  playerWeekFacts,
  playerMarketFacts,
  playerIdentityMap,
  marketSignals,
  injuries,
  type InsertPlayerCompositeFacts,
  type PlayerIdentityMap,
  type PlayerSeasonFacts,
  type PlayerMarketFacts
} from '@shared/schema';
import { eq, and, sql, desc, asc, avg, count, max, min, gte, lte, isNotNull } from 'drizzle-orm';
import { PlayerIdentityService } from '../../services/PlayerIdentityService';
import { QualityGateValidator } from '../../services/quality/QualityGateValidator';
import { ConfidenceScorer } from '../../services/quality/ConfidenceScorer';
import { DataLineageTracker } from '../../services/quality/DataLineageTracker';

export interface CompositeFactsRequest {
  canonicalPlayerId: string;
  season: number;
  includeProjections?: boolean;
  includeRiskAnalysis?: boolean;
  formats?: ('dynasty' | 'redraft' | 'bestball' | 'trade_value')[];
  forceRecalculation?: boolean;
}

export interface CompositeFactsResult {
  success: boolean;
  playerId: string;
  season: number;
  created: boolean;
  updated: boolean;
  qualityScore: number;
  factTables: string[];
  missingTables: string[];
  grades: {
    overall: string;
    talent: string;
    opportunity: string;
    consistency: string;
  };
  errorMessage?: string;
}

export interface UnifiedPlayerAnalytics {
  // Multi-format rankings and scores
  rankings: {
    dynasty: { rank: number; tier: number; score: number };
    redraft: { rank: number; tier: number; score: number };
    bestball: { rank: number; tier: number; score: number };
    tradeValue: { rank: number; tier: number; score: number };
  };
  
  // Unified grading system
  grades: {
    overallTalent: number; // 0-100
    opportunity: number; // 0-100
    consistency: number; // 0-100
    ceiling: number; // 0-100
    floor: number; // 0-100
  };
  
  // Risk assessment
  riskMetrics: {
    injury: number; // 0-1
    age: number; // 0-1
    situation: number; // 0-1
    overall: number; // 0-1
  };
  
  // Trend analysis
  trajectory: {
    momentum: number; // -1 to 1
    longTermTrend: number; // -1 to 1
    breakoutProbability: number; // 0-1
    bustProbability: number; // 0-1
  };
  
  // Value metrics
  valueMetrics: {
    positionValue: number;
    sosImpact: number;
    teamContext: number;
  };
}

export interface CompositeDataSources {
  weeklyFacts: any[];
  seasonFacts: PlayerSeasonFacts | null;
  marketFacts: PlayerMarketFacts[];
  playerIdentity: PlayerIdentityMap;
  injuryHistory: any[];
}

/**
 * Core Composite Facts Processor
 * Creates unified player profiles across all fantasy formats
 */
export class CompositeFactsProcessor {
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
   * Process composite facts for a single player
   */
  async processPlayerCompositeFacts(
    request: CompositeFactsRequest,
    jobId: string
  ): Promise<CompositeFactsResult> {
    console.log(`🔄 [CompositeFacts] Processing ${request.canonicalPlayerId} season ${request.season}`);

    try {
      // Start lineage tracking
      await this.lineageTracker.startLineageTracking({
        jobId: `${jobId}_composite_${request.canonicalPlayerId}_${request.season}`,
        operation: 'ENRICH',
        targetTable: 'player_composite_facts',
        context: {
          playerId: request.canonicalPlayerId,
          season: request.season,
          formats: request.formats
        }
      });

      // Gather all required data sources
      const dataSources = await this.gatherDataSources(request);
      
      // Validate data completeness
      const dataValidation = this.validateDataCompleteness(dataSources);
      if (!dataValidation.sufficient) {
        throw new Error(`Insufficient data for composite analysis: ${dataValidation.missing.join(', ')}`);
      }

      console.log(`📊 [CompositeFacts] Data sources: ${dataValidation.available.join(', ')}`);

      // Perform unified analytics calculation
      const unifiedAnalytics = await this.calculateUnifiedAnalytics(dataSources, request);
      
      // Calculate multi-format rankings and scores
      const multiFormatRankings = this.calculateMultiFormatRankings(unifiedAnalytics, dataSources, request);
      
      // Calculate risk assessment
      const riskAssessment = this.calculateRiskAssessment(dataSources, unifiedAnalytics);
      
      // Calculate trend analysis
      const trendAnalysis = this.calculateTrendAnalysis(dataSources);
      
      // Calculate advanced metrics
      const advancedMetrics = this.calculateAdvancedMetrics(unifiedAnalytics, dataSources);

      // Prepare composite facts record
      const compositeFactsData: InsertPlayerCompositeFacts = {
        canonicalPlayerId: request.canonicalPlayerId,
        season: request.season,
        
        // Multi-format rankings
        dynastyRank: multiFormatRankings.dynasty.rank,
        redraftRank: multiFormatRankings.redraft.rank,
        bestballRank: multiFormatRankings.bestball.rank,
        tradeValueRank: multiFormatRankings.tradeValue.rank,
        
        // Multi-format scores
        dynastyScore: multiFormatRankings.dynasty.score,
        redraftScore: multiFormatRankings.redraft.score,
        bestballScore: multiFormatRankings.bestball.score,
        tradeValueScore: multiFormatRankings.tradeValue.score,
        
        // Unified analytics
        overallTalentGrade: unifiedAnalytics.grades.overallTalent,
        opportunityGrade: unifiedAnalytics.grades.opportunity,
        consistencyGrade: unifiedAnalytics.grades.consistency,
        ceilingGrade: unifiedAnalytics.grades.ceiling,
        floorGrade: unifiedAnalytics.grades.floor,
        
        // Risk metrics
        injuryRisk: riskAssessment.injury,
        ageRisk: riskAssessment.age,
        situationRisk: riskAssessment.situation,
        overallRiskGrade: riskAssessment.overall,
        
        // Trend analysis
        momentumScore: trendAnalysis.momentum,
        trajectoryScore: trendAnalysis.longTermTrend,
        breakoutProbability: trendAnalysis.breakoutProbability,
        bustProbability: trendAnalysis.bustProbability,
        
        // Advanced metrics
        positionValueScore: advancedMetrics.positionValue,
        strengthOfScheduleImpact: advancedMetrics.sosImpact,
        teamContextScore: advancedMetrics.teamContext,
        
        // Data lineage
        contributingFactTables: dataValidation.available,
        sourceMask: this.calculateSourceMask(dataSources),
        freshnessScore: this.calculateFreshnessScore(dataSources),
        qualityGatesPassed: false, // Will be updated after validation
        completenessScore: dataValidation.completeness,
        confidenceScore: 0.5 // Will be updated with actual confidence
      };

      // Quality validation
      const qualityResult = await this.qualityValidator.validateRecord({
        tableName: 'player_composite_facts',
        recordIdentifier: `${request.canonicalPlayerId}_${request.season}`,
        recordData: { ...compositeFactsData, unifiedAnalytics, dataSources },
        context: {
          season: request.season,
          position: dataSources.playerIdentity.position,
          factTables: dataValidation.available,
          tableName: 'player_composite_facts'
        }
      }, jobId);

      // Update quality metrics
      compositeFactsData.qualityGatesPassed = qualityResult.overallPassed;
      compositeFactsData.completenessScore = qualityResult.gateResults.completeness.score;
      compositeFactsData.freshnessScore = qualityResult.gateResults.freshness.score;

      // Calculate confidence score
      const confidenceResult = await this.confidenceScorer.calculateConfidenceScore({
        tableName: 'player_composite_facts',
        recordData: { ...compositeFactsData, unifiedAnalytics, trendAnalysis },
        context: {
          season: request.season,
          position: dataSources.playerIdentity.position,
          canonicalPlayerId: request.canonicalPlayerId,
          factTables: dataValidation.available.length
        }
      });

      compositeFactsData.confidenceScore = confidenceResult.overallScore;

      // Check if record exists
      const existingRecord = await db
        .select({ canonicalPlayerId: playerCompositeFacts.canonicalPlayerId })
        .from(playerCompositeFacts)
        .where(
          and(
            eq(playerCompositeFacts.canonicalPlayerId, request.canonicalPlayerId),
            eq(playerCompositeFacts.season, request.season)
          )
        )
        .limit(1);

      let created = false;
      let updated = false;

      // Insert or update composite facts
      if (existingRecord.length === 0) {
        await db.insert(playerCompositeFacts).values(compositeFactsData);
        created = true;
      } else if (request.forceRecalculation) {
        await db
          .update(playerCompositeFacts)
          .set({ ...compositeFactsData, updatedAt: new Date() })
          .where(
            and(
              eq(playerCompositeFacts.canonicalPlayerId, request.canonicalPlayerId),
              eq(playerCompositeFacts.season, request.season)
            )
          );
        updated = true;
      } else {
        console.log(`⏭️ [CompositeFacts] Record exists and forceRecalculation=false, skipping update`);
      }

      // Generate grade letters
      const grades = {
        overall: this.calculateGradeLetter(unifiedAnalytics.grades.overallTalent),
        talent: this.calculateGradeLetter(unifiedAnalytics.grades.overallTalent),
        opportunity: this.calculateGradeLetter(unifiedAnalytics.grades.opportunity),
        consistency: this.calculateGradeLetter(unifiedAnalytics.grades.consistency)
      };

      // Complete lineage tracking
      await this.lineageTracker.completeLineageTracking(
        `${jobId}_composite_${request.canonicalPlayerId}_${request.season}`,
        {
          success: true,
          finalQualityScore: qualityResult.overallScore,
          completenessScore: qualityResult.gateResults.completeness.score,
          freshnessScore: qualityResult.gateResults.freshness.score,
          performanceMetrics: {
            factTables: dataValidation.available.length,
            dynastyScore: multiFormatRankings.dynasty.score,
            overallTalentGrade: unifiedAnalytics.grades.overallTalent,
            confidenceScore: confidenceResult.overallScore
          }
        }
      );

      console.log(`✅ [CompositeFacts] Successfully processed ${request.canonicalPlayerId} - Overall Grade: ${grades.overall}, Quality: ${qualityResult.overallScore.toFixed(3)}`);

      return {
        success: true,
        playerId: request.canonicalPlayerId,
        season: request.season,
        created,
        updated,
        qualityScore: qualityResult.overallScore,
        factTables: dataValidation.available,
        missingTables: dataValidation.missing,
        grades
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [CompositeFacts] Processing failed for ${request.canonicalPlayerId}:`, error);

      // Record failed lineage
      await this.lineageTracker.completeLineageTracking(
        `${jobId}_composite_${request.canonicalPlayerId}_${request.season}`,
        {
          success: false,
          errorMessage
        }
      );

      return {
        success: false,
        playerId: request.canonicalPlayerId,
        season: request.season,
        created: false,
        updated: false,
        qualityScore: 0,
        factTables: [],
        missingTables: ['all'],
        grades: {
          overall: 'F',
          talent: 'F',
          opportunity: 'F',
          consistency: 'F'
        },
        errorMessage
      };
    }
  }

  /**
   * Process composite facts for multiple players in batch
   */
  async processBatch(
    requests: CompositeFactsRequest[],
    jobId: string,
    options: { concurrency?: number } = {}
  ): Promise<Map<string, CompositeFactsResult>> {
    console.log(`🔄 [CompositeFacts] Processing batch of ${requests.length} composite fact requests`);

    const results = new Map<string, CompositeFactsResult>();
    const concurrency = options.concurrency || 8; // Lower concurrency for complex processing

    // Process in controlled concurrency batches
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      
      console.log(`Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(requests.length / concurrency)}`);

      const batchPromises = batch.map(async (request) => {
        const result = await this.processPlayerCompositeFacts(request, `${jobId}_batch`);
        results.set(`${request.canonicalPlayerId}_${request.season}`, result);
        return result;
      });

      await Promise.all(batchPromises);
    }

    console.log(`✅ [CompositeFacts] Batch processing completed - ${results.size} composite facts processed`);
    return results;
  }

  // ========================================
  // PRIVATE DATA GATHERING METHODS
  // ========================================

  /**
   * Gather all required data sources for composite analysis
   */
  private async gatherDataSources(request: CompositeFactsRequest): Promise<CompositeDataSources> {
    console.log(`📊 [CompositeFacts] Gathering data sources for ${request.canonicalPlayerId}`);

    // Get player identity
    const playerIdentity = await this.identityService.getByCanonicalId(request.canonicalPlayerId);
    if (!playerIdentity) {
      throw new Error(`Player not found: ${request.canonicalPlayerId}`);
    }

    // Gather data sources in parallel
    const [weeklyFacts, seasonFacts, marketFacts, injuryHistory] = await Promise.all([
      this.getWeeklyFacts(request.canonicalPlayerId, request.season),
      this.getSeasonFacts(request.canonicalPlayerId, request.season),
      this.getMarketFacts(request.canonicalPlayerId, request.season),
      this.getInjuryHistory(request.canonicalPlayerId, request.season)
    ]);

    return {
      weeklyFacts,
      seasonFacts,
      marketFacts,
      playerIdentity,
      injuryHistory
    };
  }

  /**
   * Get weekly facts data
   */
  private async getWeeklyFacts(canonicalPlayerId: string, season: number): Promise<any[]> {
    try {
      return await db
        .select()
        .from(playerWeekFacts)
        .where(
          and(
            eq(playerWeekFacts.playerId, canonicalPlayerId),
            eq(playerWeekFacts.season, season)
          )
        )
        .orderBy(asc(playerWeekFacts.week));
    } catch (error) {
      console.warn(`⚠️ [CompositeFacts] Failed to get weekly facts:`, error);
      return [];
    }
  }

  /**
   * Get season facts data
   */
  private async getSeasonFacts(canonicalPlayerId: string, season: number): Promise<PlayerSeasonFacts | null> {
    try {
      const results = await db
        .select()
        .from(playerSeasonFacts)
        .where(
          and(
            eq(playerSeasonFacts.canonicalPlayerId, canonicalPlayerId),
            eq(playerSeasonFacts.season, season)
          )
        )
        .limit(1);

      return results[0] || null;
    } catch (error) {
      console.warn(`⚠️ [CompositeFacts] Failed to get season facts:`, error);
      return null;
    }
  }

  /**
   * Get market facts data
   */
  private async getMarketFacts(canonicalPlayerId: string, season: number): Promise<PlayerMarketFacts[]> {
    try {
      return await db
        .select()
        .from(playerMarketFacts)
        .where(
          and(
            eq(playerMarketFacts.canonicalPlayerId, canonicalPlayerId),
            eq(playerMarketFacts.season, season)
          )
        )
        .orderBy(desc(playerMarketFacts.calculatedAt));
    } catch (error) {
      console.warn(`⚠️ [CompositeFacts] Failed to get market facts:`, error);
      return [];
    }
  }

  /**
   * Get injury history
   */
  private async getInjuryHistory(canonicalPlayerId: string, season: number): Promise<any[]> {
    try {
      return await db
        .select()
        .from(injuries)
        .where(
          and(
            eq(injuries.canonicalPlayerId, canonicalPlayerId),
            gte(injuries.season, season - 2), // Include 2 prior seasons
            lte(injuries.season, season)
          )
        )
        .orderBy(desc(injuries.season), desc(injuries.week));
    } catch (error) {
      console.warn(`⚠️ [CompositeFacts] Failed to get injury history:`, error);
      return [];
    }
  }

  // ========================================
  // PRIVATE CALCULATION METHODS
  // ========================================

  /**
   * Validate data completeness for composite analysis
   */
  private validateDataCompleteness(dataSources: CompositeDataSources): any {
    const available = [];
    const missing = [];

    if (dataSources.playerIdentity) available.push('player_identity');
    else missing.push('player_identity');

    if (dataSources.weeklyFacts.length > 0) available.push('weekly_facts');
    else missing.push('weekly_facts');

    if (dataSources.seasonFacts) available.push('season_facts');
    else missing.push('season_facts');

    if (dataSources.marketFacts.length > 0) available.push('market_facts');
    else missing.push('market_facts');

    if (dataSources.injuryHistory.length > 0) available.push('injury_history');
    else missing.push('injury_history');

    const completeness = available.length / (available.length + missing.length);
    const sufficient = available.length >= 2; // Need at least identity + one fact table

    return {
      available,
      missing,
      completeness,
      sufficient
    };
  }

  /**
   * Calculate unified analytics from all data sources
   */
  private async calculateUnifiedAnalytics(
    dataSources: CompositeDataSources,
    request: CompositeFactsRequest
  ): Promise<UnifiedPlayerAnalytics> {
    // Calculate grades from multiple data sources
    const grades = await this.calculateUnifiedGrades(dataSources);
    
    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(dataSources);
    
    // Calculate trajectory
    const trajectory = this.calculateTrajectory(dataSources);
    
    // Calculate value metrics
    const valueMetrics = this.calculateValueMetrics(dataSources);

    // Rankings will be calculated separately
    const rankings = {
      dynasty: { rank: 0, tier: 0, score: 0 },
      redraft: { rank: 0, tier: 0, score: 0 },
      bestball: { rank: 0, tier: 0, score: 0 },
      tradeValue: { rank: 0, tier: 0, score: 0 }
    };

    return {
      rankings,
      grades,
      riskMetrics,
      trajectory,
      valueMetrics
    };
  }

  /**
   * Calculate unified grades across all data sources
   */
  private async calculateUnifiedGrades(dataSources: CompositeDataSources): Promise<any> {
    const position = dataSources.playerIdentity.position;
    
    // Calculate talent grade (efficiency and production metrics)
    let talentGrade = 50; // Base grade
    
    if (dataSources.weeklyFacts.length > 0) {
      const avgTalent = dataSources.weeklyFacts.reduce((sum, w) => sum + (w.talent || 0), 0) / dataSources.weeklyFacts.length;
      talentGrade += avgTalent * 40; // Scale to grade points
    }
    
    if (dataSources.seasonFacts) {
      // Add season-level performance bonuses
      const fantasyPoints = dataSources.seasonFacts.fantasyPointsPpr || 0;
      const positionBonus = this.getPositionFantasyBonus(position, fantasyPoints);
      talentGrade += positionBonus;
    }
    
    // Calculate opportunity grade (usage and situation)
    let opportunityGrade = 50;
    
    if (dataSources.weeklyFacts.length > 0) {
      const avgUsage = dataSources.weeklyFacts.reduce((sum, w) => sum + (w.usageNow || 0), 0) / dataSources.weeklyFacts.length;
      opportunityGrade += avgUsage * 40;
    }
    
    if (dataSources.seasonFacts) {
      const snapShare = dataSources.seasonFacts.snapShare || 0;
      opportunityGrade += snapShare * 30;
    }
    
    // Calculate consistency grade (variance and reliability)
    let consistencyGrade = 50;
    
    if (dataSources.weeklyFacts.length > 4) {
      const fantasyPoints = dataSources.weeklyFacts.map(w => (w.powerScore || 0) * 25);
      const mean = fantasyPoints.reduce((sum, fp) => sum + fp, 0) / fantasyPoints.length;
      const variance = fantasyPoints.reduce((sum, fp) => sum + Math.pow(fp - mean, 2), 0) / fantasyPoints.length;
      const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
      
      // Lower CV = higher consistency
      consistencyGrade += Math.max(0, (1 - coefficientOfVariation) * 40);
    }
    
    // Calculate ceiling and floor grades
    const ceiling = Math.min(100, talentGrade * 1.2); // Talent with upside multiplier
    const floor = Math.max(0, talentGrade * 0.8 * (1 - this.calculateInjuryRisk(dataSources))); // Talent with injury discount

    return {
      overallTalent: Math.min(100, Math.max(0, talentGrade)),
      opportunity: Math.min(100, Math.max(0, opportunityGrade)),
      consistency: Math.min(100, Math.max(0, consistencyGrade)),
      ceiling: Math.min(100, Math.max(0, ceiling)),
      floor: Math.min(100, Math.max(0, floor))
    };
  }

  /**
   * Calculate multi-format rankings and scores
   */
  private calculateMultiFormatRankings(
    unifiedAnalytics: UnifiedPlayerAnalytics,
    dataSources: CompositeDataSources,
    request: CompositeFactsRequest
  ): any {
    const position = dataSources.playerIdentity.position;
    const age = this.calculateAge(dataSources.playerIdentity);

    // Dynasty scoring (talent + age curve + opportunity)
    const dynastyScore = this.calculateDynastyScore(unifiedAnalytics, age, position);
    
    // Redraft scoring (current year production focus)
    const redraftScore = this.calculateRedraftScore(unifiedAnalytics, dataSources);
    
    // Best ball scoring (ceiling focused)
    const bestballScore = this.calculateBestballScore(unifiedAnalytics, dataSources);
    
    // Trade value scoring (market + performance blend)
    const tradeValueScore = this.calculateTradeValueScore(unifiedAnalytics, dataSources);

    // Convert scores to approximate rankings (would need position-wide data for actual ranks)
    const dynastyRank = this.convertScoreToRank(dynastyScore, position, 'dynasty');
    const redraftRank = this.convertScoreToRank(redraftScore, position, 'redraft');
    const bestballRank = this.convertScoreToRank(bestballScore, position, 'bestball');
    const tradeValueRank = this.convertScoreToRank(tradeValueScore, position, 'trade');

    return {
      dynasty: { rank: dynastyRank, tier: Math.ceil(dynastyRank / 12), score: dynastyScore },
      redraft: { rank: redraftRank, tier: Math.ceil(redraftRank / 12), score: redraftScore },
      bestball: { rank: bestballRank, tier: Math.ceil(bestballRank / 12), score: bestballScore },
      tradeValue: { rank: tradeValueRank, tier: Math.ceil(tradeValueRank / 12), score: tradeValueScore }
    };
  }

  /**
   * Calculate risk assessment metrics
   */
  private calculateRiskAssessment(dataSources: CompositeDataSources, unifiedAnalytics: UnifiedPlayerAnalytics): any {
    const injuryRisk = this.calculateInjuryRisk(dataSources);
    const ageRisk = this.calculateAgeRisk(dataSources.playerIdentity);
    const situationRisk = this.calculateSituationRisk(dataSources);
    
    const overall = (injuryRisk * 0.4) + (ageRisk * 0.3) + (situationRisk * 0.3);

    return {
      injury: injuryRisk,
      age: ageRisk,
      situation: situationRisk,
      overall
    };
  }

  /**
   * Calculate trend analysis for composite facts
   */
  private calculateTrendAnalysis(dataSources: CompositeDataSources): any {
    if (dataSources.weeklyFacts.length < 4) {
      return {
        momentum: 0,
        longTermTrend: 0,
        breakoutProbability: 0.3,
        bustProbability: 0.3
      };
    }

    // Calculate short-term momentum (last 4 weeks vs season average)
    const fantasyPoints = dataSources.weeklyFacts.map(w => (w.powerScore || 0) * 25);
    const lastFour = fantasyPoints.slice(-4);
    const seasonAvg = fantasyPoints.reduce((sum, fp) => sum + fp, 0) / fantasyPoints.length;
    const lastFourAvg = lastFour.reduce((sum, fp) => sum + fp, 0) / lastFour.length;
    
    const momentum = seasonAvg > 0 ? (lastFourAvg - seasonAvg) / seasonAvg : 0;

    // Calculate long-term trend using linear regression
    const longTermTrend = this.calculateLinearTrend(fantasyPoints);

    // Calculate breakout/bust probabilities
    const breakoutProbability = this.calculateBreakoutProbability(dataSources, momentum);
    const bustProbability = this.calculateBustProbability(dataSources, momentum);

    return {
      momentum: Math.max(-1, Math.min(1, momentum)),
      longTermTrend: Math.max(-1, Math.min(1, longTermTrend)),
      breakoutProbability,
      bustProbability
    };
  }

  /**
   * Calculate advanced composite metrics
   */
  private calculateAdvancedMetrics(unifiedAnalytics: UnifiedPlayerAnalytics, dataSources: CompositeDataSources): any {
    const position = dataSources.playerIdentity.position;
    
    // Position value based on scarcity and production
    const positionValue = this.calculatePositionValue(position, unifiedAnalytics.grades.overallTalent);
    
    // Strength of schedule impact (placeholder)
    const sosImpact = 0.5; // Neutral impact
    
    // Team context score
    const teamContext = this.calculateTeamContextScore(dataSources);

    return {
      positionValue,
      sosImpact,
      teamContext
    };
  }

  // ========================================
  // PRIVATE HELPER CALCULATIONS
  // ========================================

  /**
   * Calculate dynasty score with age curve considerations
   */
  private calculateDynastyScore(unifiedAnalytics: UnifiedPlayerAnalytics, age: number, position: string): number {
    const baseTalent = unifiedAnalytics.grades.overallTalent;
    const opportunity = unifiedAnalytics.grades.opportunity;
    
    // Age curve multipliers by position
    const ageCurves: { [key: string]: { peak: number; decline: number } } = {
      'QB': { peak: 30, decline: 0.02 },
      'RB': { peak: 26, decline: 0.05 },
      'WR': { peak: 28, decline: 0.03 },
      'TE': { peak: 29, decline: 0.025 }
    };
    
    const curve = ageCurves[position] || ageCurves['WR'];
    const ageMultiplier = age <= curve.peak ? 
      1 + ((curve.peak - age) * 0.02) : // Bonus for young players
      1 - ((age - curve.peak) * curve.decline); // Penalty for old players
    
    return (baseTalent * 0.5 + opportunity * 0.3) * Math.max(0.3, ageMultiplier) + (unifiedAnalytics.grades.consistency * 0.2);
  }

  /**
   * Calculate redraft score focusing on current season
   */
  private calculateRedraftScore(unifiedAnalytics: UnifiedPlayerAnalytics, dataSources: CompositeDataSources): number {
    const talent = unifiedAnalytics.grades.overallTalent;
    const opportunity = unifiedAnalytics.grades.opportunity;
    const consistency = unifiedAnalytics.grades.consistency;
    
    // Health factor for current season
    const healthFactor = 1 - unifiedAnalytics.riskMetrics.injury;
    
    return (talent * 0.4 + opportunity * 0.4 + consistency * 0.2) * healthFactor;
  }

  /**
   * Calculate bestball score emphasizing ceiling
   */
  private calculateBestballScore(unifiedAnalytics: UnifiedPlayerAnalytics, dataSources: CompositeDataSources): number {
    const ceiling = unifiedAnalytics.grades.ceiling;
    const opportunity = unifiedAnalytics.grades.opportunity;
    
    // Volume bonus for best ball
    const volumeBonus = opportunity > 70 ? 1.1 : 1.0;
    
    return (ceiling * 0.7 + opportunity * 0.3) * volumeBonus;
  }

  /**
   * Calculate trade value score
   */
  private calculateTradeValueScore(unifiedAnalytics: UnifiedPlayerAnalytics, dataSources: CompositeDataSources): number {
    const dynastyAspect = this.calculateDynastyScore(unifiedAnalytics, this.calculateAge(dataSources.playerIdentity), dataSources.playerIdentity.position);
    const redraftAspect = this.calculateRedraftScore(unifiedAnalytics, dataSources);
    
    // Market perception factor (from market facts)
    let marketFactor = 1.0;
    if (dataSources.marketFacts.length > 0) {
      const recentMarket = dataSources.marketFacts[0];
      marketFactor = recentMarket.momentumScore ? 1 + (recentMarket.momentumScore * 0.2) : 1.0;
    }
    
    return ((dynastyAspect * 0.6) + (redraftAspect * 0.4)) * marketFactor;
  }

  /**
   * Calculate injury risk from history
   */
  private calculateInjuryRisk(dataSources: CompositeDataSources): number {
    if (dataSources.injuryHistory.length === 0) return 0.1; // Base risk
    
    // Count significant injuries in last 2 seasons
    const significantInjuries = dataSources.injuryHistory.filter(inj => 
      ['major', 'season_ending'].includes(inj.severity) ||
      ['out', 'ir'].includes(inj.status)
    ).length;
    
    const minorInjuries = dataSources.injuryHistory.filter(inj =>
      ['minor', 'moderate'].includes(inj.severity) ||
      ['questionable', 'doubtful'].includes(inj.status)
    ).length;
    
    return Math.min(0.9, 0.1 + (significantInjuries * 0.2) + (minorInjuries * 0.05));
  }

  /**
   * Calculate age risk
   */
  private calculateAgeRisk(playerIdentity: PlayerIdentityMap): number {
    const age = this.calculateAge(playerIdentity);
    const position = playerIdentity.position;
    
    // Age risk thresholds by position
    const riskThresholds: { [key: string]: number } = {
      'QB': 35,
      'RB': 28,
      'WR': 30,
      'TE': 32
    };
    
    const threshold = riskThresholds[position] || 30;
    
    if (age <= threshold - 2) return 0.1; // Young player
    if (age <= threshold) return 0.3; // Prime age
    return Math.min(0.9, 0.3 + ((age - threshold) * 0.1)); // Aging player
  }

  /**
   * Calculate situation risk
   */
  private calculateSituationRisk(dataSources: CompositeDataSources): number {
    // Base situation risk
    let risk = 0.3;
    
    // Team changes, coaching changes, etc. would increase risk
    // This is a placeholder - would integrate with actual situation data
    
    return risk;
  }

  /**
   * Calculate player age from identity
   */
  private calculateAge(playerIdentity: PlayerIdentityMap): number {
    if (!playerIdentity.birthDate) return 27; // Default age
    
    const now = new Date();
    const birthDate = new Date(playerIdentity.birthDate);
    const ageMs = now.getTime() - birthDate.getTime();
    const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
    
    return age;
  }

  /**
   * Get fantasy points bonus by position
   */
  private getPositionFantasyBonus(position: string, fantasyPoints: number): number {
    // Position-specific fantasy point scaling
    const thresholds: { [key: string]: { good: number; great: number } } = {
      'QB': { good: 250, great: 320 },
      'RB': { good: 200, great: 280 },
      'WR': { good: 180, great: 250 },
      'TE': { good: 150, great: 200 }
    };
    
    const threshold = thresholds[position] || thresholds['WR'];
    
    if (fantasyPoints >= threshold.great) return 20;
    if (fantasyPoints >= threshold.good) return 10;
    return 0;
  }

  /**
   * Calculate linear trend from data series
   */
  private calculateLinearTrend(values: number[]): number {
    if (values.length < 3) return 0;
    
    const n = values.length;
    const x = Array.from({length: n}, (_, i) => i);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, idx) => sum + val * values[idx], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;
    
    return avgY > 0 ? slope / avgY : 0; // Normalize by average
  }

  /**
   * Calculate breakout probability
   */
  private calculateBreakoutProbability(dataSources: CompositeDataSources, momentum: number): number {
    let probability = 0.3; // Base probability
    
    // Positive momentum increases breakout probability
    probability += Math.max(0, momentum * 0.3);
    
    // Young players more likely to break out
    const age = this.calculateAge(dataSources.playerIdentity);
    const position = dataSources.playerIdentity.position;
    const youngAge = { 'QB': 27, 'RB': 25, 'WR': 26, 'TE': 27 }[position] || 26;
    
    if (age <= youngAge) {
      probability += 0.2;
    }
    
    // Opportunity increase
    if (dataSources.weeklyFacts.length > 0) {
      const recentUsage = dataSources.weeklyFacts.slice(-4).reduce((sum, w) => sum + (w.usageNow || 0), 0) / 4;
      if (recentUsage > 0.6) {
        probability += 0.15;
      }
    }
    
    return Math.min(0.9, probability);
  }

  /**
   * Calculate bust probability
   */
  private calculateBustProbability(dataSources: CompositeDataSources, momentum: number): number {
    let probability = 0.3; // Base probability
    
    // Negative momentum increases bust probability
    probability += Math.max(0, -momentum * 0.4);
    
    // Injury risk increases bust probability
    const injuryRisk = this.calculateInjuryRisk(dataSources);
    probability += injuryRisk * 0.3;
    
    // Age risk increases bust probability
    const ageRisk = this.calculateAgeRisk(dataSources.playerIdentity);
    probability += ageRisk * 0.2;
    
    return Math.min(0.9, probability);
  }

  /**
   * Calculate positional value based on scarcity
   */
  private calculatePositionValue(position: string, talent: number): number {
    // Position scarcity multipliers
    const scarcityMultipliers: { [key: string]: number } = {
      'QB': 0.8, // Lower scarcity
      'RB': 1.2, // Higher scarcity
      'WR': 1.0, // Baseline
      'TE': 1.3  // Highest scarcity
    };
    
    const multiplier = scarcityMultipliers[position] || 1.0;
    return (talent / 100) * multiplier;
  }

  /**
   * Calculate team context score
   */
  private calculateTeamContextScore(dataSources: CompositeDataSources): number {
    // Placeholder - would integrate with actual team context data
    return 0.7; // Neutral/good team context
  }

  /**
   * Convert score to approximate rank
   */
  private convertScoreToRank(score: number, position: string, format: string): number {
    // Rough conversion - would need actual position-wide scoring for accurate ranks
    const positionDepth: { [key: string]: number } = {
      'QB': 24,
      'RB': 36,
      'WR': 48,
      'TE': 20
    };
    
    const depth = positionDepth[position] || 36;
    
    // Convert 0-100 score to rank (higher score = better rank)
    const normalizedScore = score / 100;
    const rank = Math.max(1, Math.ceil(depth * (1 - normalizedScore)));
    
    return rank;
  }

  /**
   * Calculate grade letter from numeric score
   */
  private calculateGradeLetter(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 87) return 'A';
    if (score >= 84) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 77) return 'B';
    if (score >= 74) return 'B-';
    if (score >= 70) return 'C+';
    if (score >= 67) return 'C';
    if (score >= 64) return 'C-';
    if (score >= 60) return 'D+';
    if (score >= 57) return 'D';
    if (score >= 54) return 'D-';
    return 'F';
  }

  /**
   * Calculate source mask from all data sources
   */
  private calculateSourceMask(dataSources: CompositeDataSources): number {
    let mask = 0;
    
    // Set bits for available data sources
    if (dataSources.weeklyFacts.length > 0) mask |= 1; // weekly_facts
    if (dataSources.seasonFacts) mask |= 2; // season_facts  
    if (dataSources.marketFacts.length > 0) mask |= 4; // market_facts
    if (dataSources.injuryHistory.length > 0) mask |= 8; // injury_history
    
    return mask;
  }

  /**
   * Calculate freshness score from data sources
   */
  private calculateFreshnessScore(dataSources: CompositeDataSources): number {
    const scores = [];
    
    // Weekly facts freshness
    if (dataSources.weeklyFacts.length > 0) {
      const mostRecent = Math.max(...dataSources.weeklyFacts.map(w => new Date(w.lastUpdate || 0).getTime()));
      const ageHours = (Date.now() - mostRecent) / (1000 * 60 * 60);
      scores.push(Math.max(0.1, 1 - (ageHours / 168))); // 1 week decay
    }
    
    // Season facts freshness
    if (dataSources.seasonFacts) {
      const ageHours = (Date.now() - new Date(dataSources.seasonFacts.lastRefreshed).getTime()) / (1000 * 60 * 60);
      scores.push(Math.max(0.2, 1 - (ageHours / 720))); // 30 day decay
    }
    
    // Market facts freshness
    if (dataSources.marketFacts.length > 0) {
      const mostRecent = Math.max(...dataSources.marketFacts.map(m => new Date(m.calculatedAt).getTime()));
      const ageHours = (Date.now() - mostRecent) / (1000 * 60 * 60);
      scores.push(Math.max(0.1, 1 - (ageHours / 48))); // 2 day decay
    }
    
    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0.5;
  }
}

/**
 * Factory function for external usage
 */
export function createCompositeFactsProcessor(identityService: PlayerIdentityService): CompositeFactsProcessor {
  return new CompositeFactsProcessor(identityService);
}