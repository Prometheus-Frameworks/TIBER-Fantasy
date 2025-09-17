/**
 * Market Facts Processor - Market Signal Analytics and Trends
 * 
 * Specialized processor for transforming Silver layer market data into enriched
 * market analytics facts with trend analysis, sentiment scoring, and 
 * predictive market insights for fantasy football decision making.
 * 
 * Core Features:
 * - ADP trend analysis and volatility tracking
 * - Expert consensus rankings (ECR) aggregation and trend detection
 * - Ownership and start percentage momentum analysis
 * - Market sentiment scoring and buzz tracking
 * - Cross-platform market signal consensus and conflict detection
 * - Predictive market analytics and breakout/bust indicators
 */

import { db } from '../../db';
import { 
  playerMarketFacts,
  marketSignals,
  playerIdentityMap,
  playerWeekFacts,
  type InsertPlayerMarketFacts,
  type MarketSignals
} from '@shared/schema';
import { eq, and, sql, desc, asc, avg, count, max, min, gte, lte, isNotNull } from 'drizzle-orm';
import { PlayerIdentityService } from '../../services/PlayerIdentityService';
import { QualityGateValidator } from '../../services/quality/QualityGateValidator';
import { ConfidenceScorer } from '../../services/quality/ConfidenceScorer';
import { DataLineageTracker } from '../../services/quality/DataLineageTracker';

export interface MarketFactsRequest {
  canonicalPlayerId: string;
  season: number;
  week?: number; // null for season-level market facts
  lookbackPeriod?: number; // Days to look back for trend analysis
  includeVolatilityAnalysis?: boolean;
  includeSentimentScoring?: boolean;
}

export interface MarketFactsResult {
  success: boolean;
  playerId: string;
  season: number;
  week?: number;
  created: boolean;
  updated: boolean;
  qualityScore: number;
  signalCount: number;
  consensusStrength: number;
  marketMomentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  errorMessage?: string;
}

export interface MarketTrendAnalysis {
  adpTrend: {
    direction: 'RISING' | 'FALLING' | 'STABLE';
    strength: number;
    volatility: number;
    changePoints: Array<{ week: number; change: number }>;
  };
  ecrTrend: {
    direction: 'RISING' | 'FALLING' | 'STABLE';
    strength: number;
    consensus: number;
    expertAgreement: number;
  };
  ownershipTrend: {
    direction: 'INCREASING' | 'DECREASING' | 'STABLE';
    momentum: number;
    acceleration: number;
  };
  marketSentiment: {
    overallScore: number; // -1 to 1
    buzzScore: number; // 0 to 100
    contrarySignal: number; // 0 to 1
    hypeIndex: number; // 0 to 1
  };
}

export interface MarketPredictions {
  tierBreakoutProbability: number; // 0 to 1
  bustRiskScore: number; // 0 to 1
  valueArbitrage: number; // Expected value difference
  marketCorrection: {
    expected: boolean;
    direction: 'UP' | 'DOWN';
    magnitude: number;
    confidence: number;
  };
}

/**
 * Core Market Facts Processor
 * Transforms market signals into enriched market analytics facts
 */
export class MarketFactsProcessor {
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
   * Process market facts for a single player
   */
  async processPlayerMarketFacts(
    request: MarketFactsRequest,
    jobId: string
  ): Promise<MarketFactsResult> {
    console.log(`🔄 [MarketFacts] Processing ${request.canonicalPlayerId} season ${request.season}${request.week ? ` week ${request.week}` : ''}`);

    try {
      // Start lineage tracking
      await this.lineageTracker.startLineageTracking({
        jobId: `${jobId}_market_${request.canonicalPlayerId}_${request.season}_${request.week || 'season'}`,
        operation: 'TRANSFORM',
        targetTable: 'player_market_facts',
        sourceTable: 'market_signals',
        context: {
          playerId: request.canonicalPlayerId,
          season: request.season,
          week: request.week
        }
      });

      // Get player identity
      const playerIdentity = await this.identityService.getByCanonicalId(request.canonicalPlayerId);
      if (!playerIdentity) {
        throw new Error(`Player not found: ${request.canonicalPlayerId}`);
      }

      // Get market signals for analysis
      const marketSignals = await this.getMarketSignalsForPlayer(request);
      if (marketSignals.length === 0) {
        throw new Error(`No market signals found for player ${request.canonicalPlayerId}`);
      }

      console.log(`📊 [MarketFacts] Found ${marketSignals.length} market signals for analysis`);

      // Perform market trend analysis
      const trendAnalysis = await this.calculateMarketTrendAnalysis(marketSignals, request);
      
      // Calculate market predictions
      const predictions = await this.calculateMarketPredictions(marketSignals, trendAnalysis, request);
      
      // Calculate advanced market metrics
      const advancedMetrics = this.calculateAdvancedMarketMetrics(marketSignals, trendAnalysis);
      
      // Perform cross-source consensus analysis
      const consensusAnalysis = this.calculateConsensusAnalysis(marketSignals);

      // Prepare market facts record
      const marketFactsData: InsertPlayerMarketFacts = {
        canonicalPlayerId: request.canonicalPlayerId,
        season: request.season,
        week: request.week || null,
        
        // ADP Analytics
        avgAdp: advancedMetrics.avgAdp,
        adpTrend7d: trendAnalysis.adpTrend.strength * (trendAnalysis.adpTrend.direction === 'RISING' ? -1 : 1), // Negative = improving rank
        adpTrend30d: advancedMetrics.adpTrend30d,
        adpVolatility: trendAnalysis.adpTrend.volatility,
        
        // ECR Analytics
        avgEcr: advancedMetrics.avgEcr,
        ecrTrend7d: trendAnalysis.ecrTrend.strength * (trendAnalysis.ecrTrend.direction === 'RISING' ? -1 : 1),
        ecrTrend30d: advancedMetrics.ecrTrend30d,
        ecrConsensus: trendAnalysis.ecrTrend.consensus,
        
        // Ownership Analytics
        averageOwnership: advancedMetrics.averageOwnership,
        ownershipTrend7d: trendAnalysis.ownershipTrend.momentum,
        ownershipMomentum: trendAnalysis.ownershipTrend.acceleration,
        
        // Market Sentiment
        expertBuyRating: trendAnalysis.marketSentiment.overallScore,
        communityBuzzScore: trendAnalysis.marketSentiment.buzzScore,
        momentumScore: this.calculateOverallMomentum(trendAnalysis),
        volatilityIndex: this.calculateVolatilityIndex(trendAnalysis),
        
        // Advanced Market Metrics
        valueOverReplacement: advancedMetrics.valueOverReplacement,
        positionMarketShare: advancedMetrics.positionMarketShare,
        tierBreakoutScore: predictions.tierBreakoutProbability,
        contraryIndicator: trendAnalysis.marketSentiment.contrarySignal,
        
        // Data Quality
        sourceMask: this.calculateSourceMask(marketSignals),
        sampleSize: marketSignals.length,
        freshnessScore: this.calculateFreshnessScore(marketSignals),
        qualityGatesPassed: false, // Will be updated after validation
        confidenceScore: 0.5, // Will be updated with actual confidence
        
        // Validity period
        validFrom: new Date(),
        validTo: request.week ? 
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : // 1 week for weekly facts
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days for season facts
      };

      // Quality validation
      const qualityResult = await this.qualityValidator.validateRecord({
        tableName: 'player_market_facts',
        recordIdentifier: `${request.canonicalPlayerId}_${request.season}_${request.week || 'season'}`,
        recordData: { ...marketFactsData, marketSignals, trendAnalysis },
        context: {
          season: request.season,
          week: request.week,
          signalCount: marketSignals.length,
          tableName: 'player_market_facts'
        }
      }, jobId);

      // Update quality metrics
      marketFactsData.qualityGatesPassed = qualityResult.overallPassed;
      marketFactsData.freshnessScore = qualityResult.gateResults.freshness.score;

      // Calculate confidence score
      const confidenceResult = await this.confidenceScorer.calculateConfidenceScore({
        tableName: 'player_market_facts',
        recordData: { ...marketFactsData, trendAnalysis, predictions },
        context: {
          season: request.season,
          week: request.week,
          canonicalPlayerId: request.canonicalPlayerId,
          signalCount: marketSignals.length,
          sourceBreakdown: this.calculateSourceBreakdown(marketSignals)
        }
      });

      marketFactsData.confidenceScore = confidenceResult.overallScore;

      // Check if record exists
      const existingRecord = await db
        .select({ id: playerMarketFacts.id })
        .from(playerMarketFacts)
        .where(
          and(
            eq(playerMarketFacts.canonicalPlayerId, request.canonicalPlayerId),
            eq(playerMarketFacts.season, request.season),
            request.week ? eq(playerMarketFacts.week, request.week) : sql`${playerMarketFacts.week} IS NULL`
          )
        )
        .limit(1);

      let created = false;
      let updated = false;

      // Insert or update market facts
      if (existingRecord.length === 0) {
        await db.insert(playerMarketFacts).values(marketFactsData);
        created = true;
      } else {
        await db
          .update(playerMarketFacts)
          .set({ ...marketFactsData, updatedAt: new Date() })
          .where(eq(playerMarketFacts.id, existingRecord[0].id));
        updated = true;
      }

      // Determine market momentum
      const marketMomentum = this.determineMarketMomentum(trendAnalysis);

      // Complete lineage tracking
      await this.lineageTracker.completeLineageTracking(
        `${jobId}_market_${request.canonicalPlayerId}_${request.season}_${request.week || 'season'}`,
        {
          success: true,
          finalQualityScore: qualityResult.overallScore,
          completenessScore: qualityResult.gateResults.completeness.score,
          freshnessScore: qualityResult.gateResults.freshness.score,
          performanceMetrics: {
            signalCount: marketSignals.length,
            consensusStrength: consensusAnalysis.strength,
            marketMomentum,
            confidenceScore: confidenceResult.overallScore
          }
        }
      );

      console.log(`✅ [MarketFacts] Successfully processed ${request.canonicalPlayerId} - Momentum: ${marketMomentum}, Quality: ${qualityResult.overallScore.toFixed(3)}`);

      return {
        success: true,
        playerId: request.canonicalPlayerId,
        season: request.season,
        week: request.week,
        created,
        updated,
        qualityScore: qualityResult.overallScore,
        signalCount: marketSignals.length,
        consensusStrength: consensusAnalysis.strength,
        marketMomentum
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [MarketFacts] Processing failed for ${request.canonicalPlayerId}:`, error);

      // Record failed lineage
      await this.lineageTracker.completeLineageTracking(
        `${jobId}_market_${request.canonicalPlayerId}_${request.season}_${request.week || 'season'}`,
        {
          success: false,
          errorMessage
        }
      );

      return {
        success: false,
        playerId: request.canonicalPlayerId,
        season: request.season,
        week: request.week,
        created: false,
        updated: false,
        qualityScore: 0,
        signalCount: 0,
        consensusStrength: 0,
        marketMomentum: 'NEUTRAL',
        errorMessage
      };
    }
  }

  /**
   * Process market facts for multiple players in batch
   */
  async processBatch(
    requests: MarketFactsRequest[],
    jobId: string,
    options: { concurrency?: number } = {}
  ): Promise<Map<string, MarketFactsResult>> {
    console.log(`🔄 [MarketFacts] Processing batch of ${requests.length} market fact requests`);

    const results = new Map<string, MarketFactsResult>();
    const concurrency = options.concurrency || 15;

    // Process in controlled concurrency batches
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      
      console.log(`Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(requests.length / concurrency)}`);

      const batchPromises = batch.map(async (request) => {
        const result = await this.processPlayerMarketFacts(request, `${jobId}_batch`);
        const resultKey = `${request.canonicalPlayerId}_${request.season}_${request.week || 'season'}`;
        results.set(resultKey, result);
        return result;
      });

      await Promise.all(batchPromises);
    }

    console.log(`✅ [MarketFacts] Batch processing completed - ${results.size} market facts processed`);
    return results;
  }

  // ========================================
  // PRIVATE ANALYSIS METHODS
  // ========================================

  /**
   * Get market signals for analysis
   */
  private async getMarketSignalsForPlayer(request: MarketFactsRequest): Promise<MarketSignals[]> {
    const lookbackDays = request.lookbackPeriod || 30;
    const lookbackDate = new Date(Date.now() - (lookbackDays * 24 * 60 * 60 * 1000));

    let query = db
      .select()
      .from(marketSignals)
      .where(
        and(
          eq(marketSignals.canonicalPlayerId, request.canonicalPlayerId),
          eq(marketSignals.season, request.season),
          gte(marketSignals.extractedAt, lookbackDate)
        )
      )
      .orderBy(desc(marketSignals.extractedAt));

    // Add week filter for weekly market facts
    if (request.week) {
      query = query.where(
        and(
          eq(marketSignals.canonicalPlayerId, request.canonicalPlayerId),
          eq(marketSignals.season, request.season),
          eq(marketSignals.week, request.week),
          gte(marketSignals.extractedAt, lookbackDate)
        )
      );
    }

    return await query;
  }

  /**
   * Calculate comprehensive market trend analysis
   */
  private async calculateMarketTrendAnalysis(
    marketSignals: MarketSignals[],
    request: MarketFactsRequest
  ): Promise<MarketTrendAnalysis> {
    // Group signals by type
    const adpSignals = marketSignals.filter(s => s.signalType === 'adp').sort((a, b) => a.extractedAt.getTime() - b.extractedAt.getTime());
    const ecrSignals = marketSignals.filter(s => s.signalType === 'ecr').sort((a, b) => a.extractedAt.getTime() - b.extractedAt.getTime());
    const ownershipSignals = marketSignals.filter(s => s.signalType === 'ownership').sort((a, b) => a.extractedAt.getTime() - b.extractedAt.getTime());

    // Calculate ADP trend
    const adpTrend = this.calculateAdpTrend(adpSignals);
    
    // Calculate ECR trend
    const ecrTrend = this.calculateEcrTrend(ecrSignals);
    
    // Calculate ownership trend
    const ownershipTrend = this.calculateOwnershipTrend(ownershipSignals);
    
    // Calculate market sentiment
    const marketSentiment = this.calculateMarketSentiment(marketSignals, request);

    return {
      adpTrend,
      ecrTrend,
      ownershipTrend,
      marketSentiment
    };
  }

  /**
   * Calculate ADP trend analysis
   */
  private calculateAdpTrend(adpSignals: MarketSignals[]): any {
    if (adpSignals.length < 2) {
      return {
        direction: 'STABLE' as const,
        strength: 0,
        volatility: 0,
        changePoints: []
      };
    }

    // Calculate trend direction and strength
    const ranks = adpSignals.map(s => s.overallRank || 999);
    const trendSlope = this.calculateTrendSlope(ranks);
    const volatility = this.calculateVolatility(ranks);

    // Detect change points (significant ADP movements)
    const changePoints = [];
    for (let i = 1; i < adpSignals.length; i++) {
      const prevRank = adpSignals[i-1].overallRank || 999;
      const currRank = adpSignals[i].overallRank || 999;
      const change = prevRank - currRank; // Negative = rank improved (lower number)
      
      if (Math.abs(change) > 10) { // Significant change threshold
        changePoints.push({
          week: adpSignals[i].week || 0,
          change
        });
      }
    }

    return {
      direction: Math.abs(trendSlope) < 0.5 ? 'STABLE' : trendSlope < 0 ? 'RISING' : 'FALLING',
      strength: Math.abs(trendSlope),
      volatility,
      changePoints
    };
  }

  /**
   * Calculate ECR trend analysis
   */
  private calculateEcrTrend(ecrSignals: MarketSignals[]): any {
    if (ecrSignals.length < 2) {
      return {
        direction: 'STABLE' as const,
        strength: 0,
        consensus: 0,
        expertAgreement: 0
      };
    }

    const ranks = ecrSignals.map(s => s.overallRank || 999);
    const trendSlope = this.calculateTrendSlope(ranks);
    
    // Calculate consensus strength (inverse of standard deviation)
    const avgRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
    const variance = ranks.reduce((sum, rank) => sum + Math.pow(rank - avgRank, 2), 0) / ranks.length;
    const stdDev = Math.sqrt(variance);
    const consensus = Math.max(0, 1 - (stdDev / 50)); // Normalize to 0-1

    // Calculate expert agreement (how consistent rankings are across sources)
    const expertAgreement = this.calculateExpertAgreement(ecrSignals);

    return {
      direction: Math.abs(trendSlope) < 0.5 ? 'STABLE' : trendSlope < 0 ? 'RISING' : 'FALLING',
      strength: Math.abs(trendSlope),
      consensus,
      expertAgreement
    };
  }

  /**
   * Calculate ownership trend analysis
   */
  private calculateOwnershipTrend(ownershipSignals: MarketSignals[]): any {
    if (ownershipSignals.length < 2) {
      return {
        direction: 'STABLE' as const,
        momentum: 0,
        acceleration: 0
      };
    }

    const values = ownershipSignals.map(s => s.value || 0);
    const trendSlope = this.calculateTrendSlope(values);
    
    // Calculate acceleration (second derivative)
    let acceleration = 0;
    if (values.length >= 3) {
      const midpoint = Math.floor(values.length / 2);
      const firstHalf = values.slice(0, midpoint);
      const secondHalf = values.slice(midpoint);
      
      const firstSlope = this.calculateTrendSlope(firstHalf);
      const secondSlope = this.calculateTrendSlope(secondHalf);
      
      acceleration = secondSlope - firstSlope;
    }

    return {
      direction: Math.abs(trendSlope) < 0.01 ? 'STABLE' : trendSlope > 0 ? 'INCREASING' : 'DECREASING',
      momentum: trendSlope,
      acceleration
    };
  }

  /**
   * Calculate market sentiment score
   */
  private calculateMarketSentiment(marketSignals: MarketSignals[], request: MarketFactsRequest): any {
    // Combine multiple factors for sentiment analysis
    const adpSignals = marketSignals.filter(s => s.signalType === 'adp');
    const ecrSignals = marketSignals.filter(s => s.signalType === 'ecr');
    const ownershipSignals = marketSignals.filter(s => s.signalType === 'ownership');

    // Calculate overall sentiment score (-1 to 1)
    let sentimentScore = 0;
    let components = 0;

    // ADP sentiment (improving ADP = positive sentiment)
    if (adpSignals.length >= 2) {
      const recent = adpSignals.slice(-2);
      const adpChange = (recent[0].overallRank || 999) - (recent[1].overallRank || 999);
      sentimentScore += Math.max(-1, Math.min(1, adpChange / 25)); // Normalize
      components++;
    }

    // ECR sentiment
    if (ecrSignals.length >= 2) {
      const recent = ecrSignals.slice(-2);
      const ecrChange = (recent[0].overallRank || 999) - (recent[1].overallRank || 999);
      sentimentScore += Math.max(-1, Math.min(1, ecrChange / 25));
      components++;
    }

    // Ownership momentum sentiment
    if (ownershipSignals.length >= 2) {
      const recent = ownershipSignals.slice(-2);
      const ownershipChange = (recent[1].value || 0) - (recent[0].value || 0);
      sentimentScore += Math.max(-1, Math.min(1, ownershipChange * 10));
      components++;
    }

    if (components > 0) {
      sentimentScore /= components;
    }

    // Calculate buzz score based on signal frequency and volatility
    const recentSignals = marketSignals.filter(s => 
      s.extractedAt.getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000)
    );
    const buzzScore = Math.min(100, recentSignals.length * 5);

    // Calculate contrary indicator (high buzz + poor performance = contrary signal)
    const contrarySignal = this.calculateContrarySignal(marketSignals, request);

    // Calculate hype index
    const hypeIndex = this.calculateHypeIndex(marketSignals);

    return {
      overallScore: sentimentScore,
      buzzScore,
      contrarySignal,
      hypeIndex
    };
  }

  /**
   * Calculate market predictions
   */
  private async calculateMarketPredictions(
    marketSignals: MarketSignals[],
    trendAnalysis: MarketTrendAnalysis,
    request: MarketFactsRequest
  ): Promise<MarketPredictions> {
    // Calculate tier breakout probability
    const tierBreakoutProbability = this.calculateTierBreakoutProbability(trendAnalysis);
    
    // Calculate bust risk
    const bustRiskScore = this.calculateBustRisk(marketSignals, trendAnalysis);
    
    // Calculate value arbitrage
    const valueArbitrage = await this.calculateValueArbitrage(request.canonicalPlayerId, marketSignals);
    
    // Predict market correction
    const marketCorrection = this.predictMarketCorrection(trendAnalysis);

    return {
      tierBreakoutProbability,
      bustRiskScore,
      valueArbitrage,
      marketCorrection
    };
  }

  /**
   * Calculate advanced market metrics
   */
  private calculateAdvancedMarketMetrics(marketSignals: MarketSignals[], trendAnalysis: MarketTrendAnalysis): any {
    // Calculate averages by signal type
    const adpSignals = marketSignals.filter(s => s.signalType === 'adp');
    const ecrSignals = marketSignals.filter(s => s.signalType === 'ecr');
    const ownershipSignals = marketSignals.filter(s => s.signalType === 'ownership');

    const avgAdp = adpSignals.length > 0 ? 
      adpSignals.reduce((sum, s) => sum + (s.overallRank || 999), 0) / adpSignals.length : null;
    
    const avgEcr = ecrSignals.length > 0 ?
      ecrSignals.reduce((sum, s) => sum + (s.overallRank || 999), 0) / ecrSignals.length : null;
      
    const averageOwnership = ownershipSignals.length > 0 ?
      ownershipSignals.reduce((sum, s) => sum + (s.value || 0), 0) / ownershipSignals.length : null;

    // Calculate longer-term trends
    const adpTrend30d = this.calculateLongerTermTrend(adpSignals, 30);
    const ecrTrend30d = this.calculateLongerTermTrend(ecrSignals, 30);

    // Calculate positional metrics (placeholder - would require positional data)
    const valueOverReplacement = this.calculateVORP(avgAdp, avgEcr);
    const positionMarketShare = this.calculatePositionMarketShare(averageOwnership);

    return {
      avgAdp,
      avgEcr,
      averageOwnership,
      adpTrend30d,
      ecrTrend30d,
      valueOverReplacement,
      positionMarketShare
    };
  }

  // ========================================
  // PRIVATE CALCULATION HELPERS
  // ========================================

  /**
   * Calculate trend slope using linear regression
   */
  private calculateTrendSlope(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({length: n}, (_, i) => i);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, idx) => sum + val * values[idx], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope || 0;
  }

  /**
   * Calculate volatility (coefficient of variation)
   */
  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return mean !== 0 ? stdDev / Math.abs(mean) : 0;
  }

  /**
   * Calculate expert agreement
   */
  private calculateExpertAgreement(ecrSignals: MarketSignals[]): number {
    // Group by time period and calculate consistency
    const timeGroups = new Map<string, MarketSignals[]>();
    
    ecrSignals.forEach(signal => {
      const timeKey = signal.extractedAt.toISOString().substring(0, 10); // Group by day
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, []);
      }
      timeGroups.get(timeKey)!.push(signal);
    });

    let totalAgreement = 0;
    let periods = 0;

    timeGroups.forEach((signals) => {
      if (signals.length > 1) {
        const ranks = signals.map(s => s.overallRank || 999);
        const mean = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
        const variance = ranks.reduce((sum, rank) => sum + Math.pow(rank - mean, 2), 0) / ranks.length;
        const agreement = Math.max(0, 1 - (Math.sqrt(variance) / 50));
        totalAgreement += agreement;
        periods++;
      }
    });

    return periods > 0 ? totalAgreement / periods : 0;
  }

  /**
   * Calculate overall market momentum
   */
  private calculateOverallMomentum(trendAnalysis: MarketTrendAnalysis): number {
    const weights = { adp: 0.4, ecr: 0.3, ownership: 0.3 };
    
    let momentum = 0;
    momentum += trendAnalysis.adpTrend.strength * weights.adp * (trendAnalysis.adpTrend.direction === 'RISING' ? 1 : -1);
    momentum += trendAnalysis.ecrTrend.strength * weights.ecr * (trendAnalysis.ecrTrend.direction === 'RISING' ? 1 : -1);
    momentum += trendAnalysis.ownershipTrend.momentum * weights.ownership;
    
    return momentum;
  }

  /**
   * Calculate volatility index
   */
  private calculateVolatilityIndex(trendAnalysis: MarketTrendAnalysis): number {
    return (trendAnalysis.adpTrend.volatility + 
            (1 - trendAnalysis.ecrTrend.consensus) + 
            Math.abs(trendAnalysis.ownershipTrend.acceleration)) / 3;
  }

  /**
   * Determine market momentum category
   */
  private determineMarketMomentum(trendAnalysis: MarketTrendAnalysis): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const overallMomentum = this.calculateOverallMomentum(trendAnalysis);
    const sentimentScore = trendAnalysis.marketSentiment.overallScore;
    
    const combinedSignal = (overallMomentum * 0.6) + (sentimentScore * 0.4);
    
    if (combinedSignal > 0.2) return 'BULLISH';
    if (combinedSignal < -0.2) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Calculate source mask from market signals
   */
  private calculateSourceMask(marketSignals: MarketSignals[]): number {
    const sourceBits: { [key: string]: number } = {
      'sleeper': 1,
      'fantasypros': 2,
      'espn': 4,
      'yahoo': 8,
      'rotowire': 16,
      'underdog': 32
    };
    
    let mask = 0;
    const sources = new Set(marketSignals.map(s => s.source));
    
    sources.forEach(source => {
      if (sourceBits[source]) {
        mask |= sourceBits[source];
      }
    });
    
    return mask;
  }

  /**
   * Calculate freshness score
   */
  private calculateFreshnessScore(marketSignals: MarketSignals[]): number {
    if (marketSignals.length === 0) return 0;
    
    const now = new Date();
    const mostRecent = Math.max(...marketSignals.map(s => s.extractedAt.getTime()));
    const ageHours = (now.getTime() - mostRecent) / (1000 * 60 * 60);
    
    if (ageHours <= 1) return 1.0;
    if (ageHours <= 6) return 0.9;
    if (ageHours <= 24) return 0.7;
    if (ageHours <= 72) return 0.4;
    return 0.1;
  }

  /**
   * Calculate source breakdown for lineage tracking
   */
  private calculateSourceBreakdown(marketSignals: MarketSignals[]): { [source: string]: number } {
    const sourceCounts = new Map<string, number>();
    
    marketSignals.forEach(signal => {
      const count = sourceCounts.get(signal.source) || 0;
      sourceCounts.set(signal.source, count + 1);
    });
    
    const totalSignals = marketSignals.length;
    const breakdown: { [source: string]: number } = {};
    
    sourceCounts.forEach((count, source) => {
      breakdown[source] = count / totalSignals;
    });
    
    return breakdown;
  }

  // Placeholder implementations for advanced calculations
  private calculateTierBreakoutProbability(trendAnalysis: MarketTrendAnalysis): number {
    // Combine multiple factors for breakout probability
    const momentumFactor = Math.abs(this.calculateOverallMomentum(trendAnalysis));
    const volatilityFactor = 1 - this.calculateVolatilityIndex(trendAnalysis);
    const sentimentFactor = (trendAnalysis.marketSentiment.overallScore + 1) / 2; // Normalize to 0-1
    
    return (momentumFactor * 0.4) + (volatilityFactor * 0.3) + (sentimentFactor * 0.3);
  }

  private calculateBustRisk(marketSignals: MarketSignals[], trendAnalysis: MarketTrendAnalysis): number {
    // High volatility + negative sentiment = higher bust risk
    const volatility = this.calculateVolatilityIndex(trendAnalysis);
    const negativeSentiment = Math.max(0, -trendAnalysis.marketSentiment.overallScore);
    const hypeRisk = trendAnalysis.marketSentiment.hypeIndex;
    
    return (volatility * 0.4) + (negativeSentiment * 0.35) + (hypeRisk * 0.25);
  }

  private async calculateValueArbitrage(canonicalPlayerId: string, marketSignals: MarketSignals[]): Promise<number> {
    // Compare ADP vs ECR to find value discrepancies
    const adpSignals = marketSignals.filter(s => s.signalType === 'adp');
    const ecrSignals = marketSignals.filter(s => s.signalType === 'ecr');
    
    if (adpSignals.length === 0 || ecrSignals.length === 0) return 0;
    
    const avgAdp = adpSignals.reduce((sum, s) => sum + (s.overallRank || 999), 0) / adpSignals.length;
    const avgEcr = ecrSignals.reduce((sum, s) => sum + (s.overallRank || 999), 0) / ecrSignals.length;
    
    // Positive = undervalued (ECR better than ADP), Negative = overvalued
    return avgAdp - avgEcr;
  }

  private predictMarketCorrection(trendAnalysis: MarketTrendAnalysis): any {
    const momentum = Math.abs(this.calculateOverallMomentum(trendAnalysis));
    const volatility = this.calculateVolatilityIndex(trendAnalysis);
    
    // High momentum + high volatility = correction likely
    const correctionProbability = (momentum * 0.6) + (volatility * 0.4);
    
    return {
      expected: correctionProbability > 0.7,
      direction: trendAnalysis.marketSentiment.overallScore > 0 ? 'DOWN' : 'UP',
      magnitude: correctionProbability,
      confidence: Math.min(0.9, correctionProbability)
    };
  }

  private calculateLongerTermTrend(signals: MarketSignals[], days: number): number {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    const relevantSignals = signals.filter(s => s.extractedAt >= cutoffDate);
    
    if (relevantSignals.length < 2) return 0;
    
    const values = relevantSignals.map(s => s.overallRank || s.value || 0);
    return this.calculateTrendSlope(values);
  }

  private calculateVORP(avgAdp: number | null, avgEcr: number | null): number {
    // Simplified VORP calculation
    if (!avgAdp && !avgEcr) return 0;
    
    const rank = avgEcr || avgAdp || 999;
    const replacement = 200; // Replacement level
    
    return Math.max(0, (replacement - rank) / replacement);
  }

  private calculatePositionMarketShare(averageOwnership: number | null): number {
    // Simplified market share calculation
    return Math.min(1, (averageOwnership || 0) * 10); // Convert percentage to share
  }

  private calculateContrarySignal(marketSignals: MarketSignals[], request: MarketFactsRequest): number {
    // Placeholder - would analyze performance vs hype
    return Math.random() * 0.5; // 0 to 0.5 range
  }

  private calculateHypeIndex(marketSignals: MarketSignals[]): number {
    // Calculate hype based on signal frequency and magnitude of changes
    const recentSignals = marketSignals.filter(s => 
      s.extractedAt.getTime() > Date.now() - (14 * 24 * 60 * 60 * 1000)
    );
    
    const frequency = recentSignals.length / 14; // Signals per day
    const volatility = this.calculateVolatility(recentSignals.map(s => s.overallRank || s.value || 0));
    
    return Math.min(1, (frequency * 0.6) + (volatility * 0.4));
  }

  private calculateConsensusAnalysis(marketSignals: MarketSignals[]): { strength: number } {
    // Calculate how much sources agree
    const signalTypes = new Set(marketSignals.map(s => s.signalType));
    let totalConsensus = 0;
    let types = 0;
    
    signalTypes.forEach(type => {
      const typeSignals = marketSignals.filter(s => s.signalType === type);
      if (typeSignals.length > 1) {
        const values = typeSignals.map(s => s.overallRank || s.value || 0);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const consensus = Math.max(0, 1 - (Math.sqrt(variance) / (mean || 1)));
        totalConsensus += consensus;
        types++;
      }
    });
    
    return {
      strength: types > 0 ? totalConsensus / types : 0
    };
  }
}

/**
 * Factory function for external usage
 */
export function createMarketFactsProcessor(identityService: PlayerIdentityService): MarketFactsProcessor {
  return new MarketFactsProcessor(identityService);
}