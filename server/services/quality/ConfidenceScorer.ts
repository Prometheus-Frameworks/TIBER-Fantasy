/**
 * Confidence Scorer - Data Quality Confidence Scoring System
 * 
 * Advanced confidence scoring system that evaluates data quality across
 * multiple dimensions and provides confidence ratings for analytics facts.
 * Combines statistical analysis, data lineage, and business rules to generate
 * comprehensive confidence scores for informed decision-making.
 * 
 * Core Confidence Factors:
 * - Data Source Reliability: Historical accuracy and consistency of sources
 * - Data Freshness: Recency and update frequency scoring
 * - Data Completeness: Field population and coverage analysis
 * - Statistical Consistency: Outlier detection and variance analysis
 * - Business Logic Validation: Domain-specific rule compliance
 * - Cross-Source Consensus: Agreement across multiple data sources
 */

import { db } from '../../infra/db';
import { 
  playerWeekFacts,
  playerSeasonFacts,
  playerMarketFacts,
  playerCompositeFacts,
  marketSignals,
  qualityGateResults,
  dataLineage,
  dataSourceEnum
} from '@shared/schema';
import { eq, and, sql, gte, lte, avg, count, stddev, isNotNull } from 'drizzle-orm';

export interface ConfidenceFactors {
  sourceReliability: number; // 0-1: Historical accuracy of data sources
  dataFreshness: number; // 0-1: Recency and staleness penalty
  dataCompleteness: number; // 0-1: Field population completeness
  statisticalConsistency: number; // 0-1: Consistency with historical patterns
  businessLogicCompliance: number; // 0-1: Adherence to business rules
  crossSourceConsensus: number; // 0-1: Agreement across multiple sources
  lineageQuality: number; // 0-1: Quality of transformation lineage
}

export interface ConfidenceScore {
  overallScore: number; // 0-1: Final confidence score
  factors: ConfidenceFactors;
  explanation: string;
  recommendations: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dataQualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface ConfidenceRequest {
  tableName: string;
  recordData: any;
  context?: {
    season?: number;
    week?: number;
    position?: string;
    canonicalPlayerId?: string;
    historicalDataPoints?: number;
    sourceBreakdown?: { [source: string]: number };
  };
}

export interface BenchmarkData {
  position: string;
  metricName: string;
  season: number;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  mean: number;
  stdDev: number;
  sampleSize: number;
}

/**
 * Core Confidence Scorer
 * Provides comprehensive confidence scoring for analytics facts
 */
export class ConfidenceScorer {
  private static instance: ConfidenceScorer;
  
  // Confidence factor weights (configurable)
  private readonly FACTOR_WEIGHTS = {
    sourceReliability: 0.20,
    dataFreshness: 0.15,
    dataCompleteness: 0.20,
    statisticalConsistency: 0.15,
    businessLogicCompliance: 0.15,
    crossSourceConsensus: 0.10,
    lineageQuality: 0.05
  };

  // Data source reliability scores (based on historical accuracy)
  private readonly SOURCE_RELIABILITY = {
    sleeper: 0.92,
    nfl_data_py: 0.95,
    fantasypros: 0.88,
    mysportsfeeds: 0.90,
    espn: 0.85,
    yahoo: 0.83,
    manual: 0.70,
    computed: 0.80
  };

  // Freshness thresholds (in hours)
  private readonly FRESHNESS_THRESHOLDS = {
    EXCELLENT: 1,   // Within 1 hour
    GOOD: 6,        // Within 6 hours
    FAIR: 24,       // Within 24 hours
    POOR: 72,       // Within 72 hours
    CRITICAL: 168   // Within 1 week
  };

  // Benchmark cache for statistical consistency
  private benchmarkCache = new Map<string, BenchmarkData>();

  public static getInstance(): ConfidenceScorer {
    if (!ConfidenceScorer.instance) {
      ConfidenceScorer.instance = new ConfidenceScorer();
    }
    return ConfidenceScorer.instance;
  }

  /**
   * Calculate comprehensive confidence score for a record
   */
  async calculateConfidenceScore(request: ConfidenceRequest): Promise<ConfidenceScore> {
    console.log(`🎯 [Confidence] Calculating confidence score for ${request.tableName}`);

    try {
      // Calculate individual confidence factors in parallel
      const [
        sourceReliability,
        dataFreshness,
        dataCompleteness,
        statisticalConsistency,
        businessLogicCompliance,
        crossSourceConsensus,
        lineageQuality
      ] = await Promise.all([
        this.calculateSourceReliability(request),
        this.calculateDataFreshness(request),
        this.calculateDataCompleteness(request),
        this.calculateStatisticalConsistency(request),
        this.calculateBusinessLogicCompliance(request),
        this.calculateCrossSourceConsensus(request),
        this.calculateLineageQuality(request)
      ]);

      const factors: ConfidenceFactors = {
        sourceReliability,
        dataFreshness,
        dataCompleteness,
        statisticalConsistency,
        businessLogicCompliance,
        crossSourceConsensus,
        lineageQuality
      };

      // Calculate weighted overall score
      const overallScore = Object.entries(factors).reduce((score, [factorName, value]) => {
        const weight = this.FACTOR_WEIGHTS[factorName as keyof typeof this.FACTOR_WEIGHTS] || 0;
        return score + (value * weight);
      }, 0);

      // Generate explanation and recommendations
      const explanation = this.generateExplanation(factors, overallScore);
      const recommendations = this.generateRecommendations(factors);
      
      // Determine risk level and grade
      const riskLevel = this.determineRiskLevel(overallScore, factors);
      const dataQualityGrade = this.assignDataQualityGrade(overallScore);

      const confidenceScore: ConfidenceScore = {
        overallScore,
        factors,
        explanation,
        recommendations,
        riskLevel,
        dataQualityGrade
      };

      console.log(`✅ [Confidence] Confidence score calculated - Overall: ${overallScore.toFixed(3)}, Grade: ${dataQualityGrade}`);
      return confidenceScore;

    } catch (error) {
      console.error(`❌ [Confidence] Confidence calculation failed:`, error);
      
      // Return low confidence score on error
      return {
        overallScore: 0.3,
        factors: {
          sourceReliability: 0.5,
          dataFreshness: 0.5,
          dataCompleteness: 0.5,
          statisticalConsistency: 0.5,
          businessLogicCompliance: 0.5,
          crossSourceConsensus: 0.5,
          lineageQuality: 0.5
        },
        explanation: 'Confidence calculation failed - default low score assigned',
        recommendations: ['Review data quality manually', 'Investigate confidence calculation errors'],
        riskLevel: 'HIGH',
        dataQualityGrade: 'D'
      };
    }
  }

  /**
   * Calculate batch confidence scores for multiple records
   */
  async calculateBatchConfidenceScores(requests: ConfidenceRequest[]): Promise<Map<string, ConfidenceScore>> {
    console.log(`🎯 [Confidence] Calculating batch confidence scores for ${requests.length} records`);

    const results = new Map<string, ConfidenceScore>();
    
    // Process in parallel with concurrency limit
    const BATCH_SIZE = 20;
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (request, index) => {
        const recordKey = `${request.tableName}_${i + index}`;
        try {
          const score = await this.calculateConfidenceScore(request);
          results.set(recordKey, score);
        } catch (error) {
          console.error(`❌ [Confidence] Batch calculation failed for record ${recordKey}:`, error);
          // Add low confidence score for failed records
          results.set(recordKey, await this.getDefaultLowConfidenceScore());
        }
      });

      await Promise.all(batchPromises);
    }

    console.log(`✅ [Confidence] Batch confidence scores calculated for ${results.size} records`);
    return results;
  }

  /**
   * Get confidence benchmarks for a position/metric combination
   */
  async getConfidenceBenchmarks(
    position: string,
    metricName: string,
    season: number
  ): Promise<BenchmarkData | null> {
    const cacheKey = `${position}_${metricName}_${season}`;
    
    if (this.benchmarkCache.has(cacheKey)) {
      return this.benchmarkCache.get(cacheKey)!;
    }

    console.log(`📊 [Confidence] Calculating benchmarks for ${position} ${metricName} in ${season}`);

    try {
      // Get statistical data based on table/metric
      let benchmarkData: BenchmarkData | null = null;

      if (metricName === 'fantasyPoints') {
        benchmarkData = await this.calculateFantasyPointsBenchmarks(position, season);
      } else if (metricName === 'snapShare') {
        benchmarkData = await this.calculateSnapShareBenchmarks(position, season);
      } else if (metricName === 'targetShare') {
        benchmarkData = await this.calculateTargetShareBenchmarks(position, season);
      }

      if (benchmarkData) {
        this.benchmarkCache.set(cacheKey, benchmarkData);
        return benchmarkData;
      }

      return null;

    } catch (error) {
      console.error(`❌ [Confidence] Failed to calculate benchmarks:`, error);
      return null;
    }
  }

  // ========================================
  // PRIVATE CONFIDENCE FACTOR CALCULATIONS
  // ========================================

  /**
   * Calculate source reliability score
   */
  private async calculateSourceReliability(request: ConfidenceRequest): Promise<number> {
    try {
      // Get source breakdown from context or infer from data lineage
      let sourceBreakdown = request.context?.sourceBreakdown;
      
      if (!sourceBreakdown) {
        sourceBreakdown = await this.inferSourceBreakdown(request);
      }

      if (!sourceBreakdown || Object.keys(sourceBreakdown).length === 0) {
        return 0.75; // Default moderate reliability
      }

      // Calculate weighted reliability score
      let totalWeight = 0;
      let weightedScore = 0;

      for (const [source, weight] of Object.entries(sourceBreakdown)) {
        const reliability = this.SOURCE_RELIABILITY[source as keyof typeof this.SOURCE_RELIABILITY] || 0.7;
        weightedScore += reliability * weight;
        totalWeight += weight;
      }

      return totalWeight > 0 ? weightedScore / totalWeight : 0.75;

    } catch (error) {
      console.warn(`⚠️ [Confidence] Source reliability calculation failed:`, error);
      return 0.5;
    }
  }

  /**
   * Calculate data freshness score
   */
  private async calculateDataFreshness(request: ConfidenceRequest): Promise<number> {
    try {
      const now = new Date();
      let lastUpdate = request.recordData.updatedAt || 
                      request.recordData.lastUpdated || 
                      request.recordData.createdAt ||
                      request.recordData.lastRefreshed;

      if (!lastUpdate) {
        return 0.3; // Low score if no timestamp available
      }

      if (typeof lastUpdate === 'string') {
        lastUpdate = new Date(lastUpdate);
      }

      const ageHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

      // Calculate freshness score based on thresholds
      if (ageHours <= this.FRESHNESS_THRESHOLDS.EXCELLENT) return 1.0;
      if (ageHours <= this.FRESHNESS_THRESHOLDS.GOOD) return 0.9;
      if (ageHours <= this.FRESHNESS_THRESHOLDS.FAIR) return 0.7;
      if (ageHours <= this.FRESHNESS_THRESHOLDS.POOR) return 0.4;
      if (ageHours <= this.FRESHNESS_THRESHOLDS.CRITICAL) return 0.2;
      
      return 0.1; // Very stale data

    } catch (error) {
      console.warn(`⚠️ [Confidence] Data freshness calculation failed:`, error);
      return 0.5;
    }
  }

  /**
   * Calculate data completeness score
   */
  private async calculateDataCompleteness(request: ConfidenceRequest): Promise<number> {
    try {
      const data = request.recordData;
      const criticalFields = this.getCriticalFieldsForTable(request.tableName);
      const optionalFields = this.getOptionalFieldsForTable(request.tableName);
      
      // Check critical fields
      const missingCriticalFields = criticalFields.filter(field => 
        data[field] === null || data[field] === undefined || data[field] === ''
      );

      if (missingCriticalFields.length > 0) {
        return Math.max(0, 1 - (missingCriticalFields.length / criticalFields.length));
      }

      // Check optional fields for bonus completeness
      const populatedOptionalFields = optionalFields.filter(field =>
        data[field] !== null && data[field] !== undefined && data[field] !== ''
      );

      const optionalCompleteness = populatedOptionalFields.length / optionalFields.length;
      
      // Base 0.85 for all critical fields + bonus for optional fields
      return Math.min(1.0, 0.85 + (optionalCompleteness * 0.15));

    } catch (error) {
      console.warn(`⚠️ [Confidence] Data completeness calculation failed:`, error);
      return 0.6;
    }
  }

  /**
   * Calculate statistical consistency score
   */
  private async calculateStatisticalConsistency(request: ConfidenceRequest): Promise<number> {
    try {
      if (!request.context?.position) {
        return 0.75; // Default if position not available
      }

      const data = request.recordData;
      const position = request.context.position;
      const season = request.context.season || 2025;

      // Check key metrics against benchmarks
      const metricsToCheck = ['fantasyPoints', 'snapShare', 'targetShare'];
      const consistencyScores = [];

      for (const metric of metricsToCheck) {
        if (data[metric] !== null && data[metric] !== undefined) {
          const benchmarks = await this.getConfidenceBenchmarks(position, metric, season);
          
          if (benchmarks) {
            const value = data[metric];
            const score = this.calculateMetricConsistency(value, benchmarks);
            consistencyScores.push(score);
          }
        }
      }

      if (consistencyScores.length === 0) {
        return 0.7; // Default if no metrics to check
      }

      return consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length;

    } catch (error) {
      console.warn(`⚠️ [Confidence] Statistical consistency calculation failed:`, error);
      return 0.6;
    }
  }

  /**
   * Calculate business logic compliance score
   */
  private async calculateBusinessLogicCompliance(request: ConfidenceRequest): Promise<number> {
    try {
      const data = request.recordData;
      const violations = [];

      // Fantasy football specific business rules
      if (data.gamesPlayed > 17) violations.push('Games played exceeds season maximum');
      if (data.snapShare > 1) violations.push('Snap share cannot exceed 100%');
      if (data.fantasyPoints < -20 || data.fantasyPoints > 100) violations.push('Fantasy points outside reasonable range');
      if (data.targets && data.snapCount && data.targets > data.snapCount * 1.5) violations.push('Targets unreasonably high vs snaps');
      
      // Position-specific rules
      if (request.context?.position === 'QB') {
        if (data.targets > 0) violations.push('QB should not have targets');
        if (data.rushingTds > 10) violations.push('QB rushing TDs unusually high');
      }

      if (request.context?.position === 'K') {
        if (data.rushingYards > 0 || data.receivingYards > 0) violations.push('Kicker should not have rushing/receiving yards');
      }

      // Calculate compliance score
      if (violations.length === 0) return 1.0;
      return Math.max(0, 1 - (violations.length * 0.2));

    } catch (error) {
      console.warn(`⚠️ [Confidence] Business logic compliance calculation failed:`, error);
      return 0.7;
    }
  }

  /**
   * Calculate cross-source consensus score
   */
  private async calculateCrossSourceConsensus(request: ConfidenceRequest): Promise<number> {
    try {
      // For now, return a moderate score - would implement cross-source comparison
      // by checking agreement between different data sources for the same metric
      
      if (request.context?.sourceBreakdown) {
        const sourceCount = Object.keys(request.context.sourceBreakdown).length;
        
        // More sources generally means better consensus opportunity
        if (sourceCount >= 3) return 0.9;
        if (sourceCount >= 2) return 0.8;
        return 0.6; // Single source
      }

      return 0.7; // Default moderate consensus

    } catch (error) {
      console.warn(`⚠️ [Confidence] Cross-source consensus calculation failed:`, error);
      return 0.6;
    }
  }

  /**
   * Calculate lineage quality score
   */
  private async calculateLineageQuality(request: ConfidenceRequest): Promise<number> {
    try {
      // Check if we have quality data from lineage tracking
      if (request.context?.canonicalPlayerId) {
        const lineageData = await db
          .select({
            qualityScore: dataLineage.qualityScore,
            completenessScore: dataLineage.completenessScore
          })
          .from(dataLineage)
          .where(
            and(
              eq(dataLineage.tableName, request.tableName),
              sql`${dataLineage.executionContext}->>'canonicalPlayerId' = ${request.context.canonicalPlayerId}`
            )
          )
          .orderBy(sql`${dataLineage.startedAt} DESC`)
          .limit(1);

        if (lineageData[0]) {
          const qualityScore = lineageData[0].qualityScore || 0.5;
          const completenessScore = lineageData[0].completenessScore || 0.5;
          return (qualityScore * 0.7) + (completenessScore * 0.3);
        }
      }

      return 0.75; // Default if no lineage data

    } catch (error) {
      console.warn(`⚠️ [Confidence] Lineage quality calculation failed:`, error);
      return 0.6;
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Infer source breakdown from available data
   */
  private async inferSourceBreakdown(request: ConfidenceRequest): Promise<{ [source: string]: number } | null> {
    // Placeholder implementation - would analyze data lineage to determine source contributions
    return null;
  }

  /**
   * Get critical fields for a table
   */
  private getCriticalFieldsForTable(tableName: string): string[] {
    const criticalFieldsMap: { [key: string]: string[] } = {
      'player_week_facts': ['playerId', 'season', 'week', 'position'],
      'player_season_facts': ['canonicalPlayerId', 'season', 'position', 'nflTeam', 'gamesPlayed'],
      'player_market_facts': ['canonicalPlayerId', 'season'],
      'player_composite_facts': ['canonicalPlayerId', 'season']
    };

    return criticalFieldsMap[tableName] || [];
  }

  /**
   * Get optional fields for a table
   */
  private getOptionalFieldsForTable(tableName: string): string[] {
    const optionalFieldsMap: { [key: string]: string[] } = {
      'player_week_facts': ['snapShare', 'fantasyPoints', 'targets', 'carries'],
      'player_season_facts': ['fantasyPoints', 'snapShare', 'avgAdp', 'ecrRank'],
      'player_market_facts': ['avgAdp', 'avgEcr', 'averageOwnership'],
      'player_composite_facts': ['dynastyScore', 'redraftScore', 'overallTalentGrade']
    };

    return optionalFieldsMap[tableName] || [];
  }

  /**
   * Calculate metric consistency against benchmarks
   */
  private calculateMetricConsistency(value: number, benchmarks: BenchmarkData): number {
    // Calculate z-score
    const zScore = Math.abs((value - benchmarks.mean) / benchmarks.stdDev);
    
    // Convert z-score to consistency score (higher z-score = lower consistency)
    if (zScore <= 1) return 1.0; // Within 1 standard deviation
    if (zScore <= 2) return 0.8; // Within 2 standard deviations
    if (zScore <= 3) return 0.5; // Within 3 standard deviations
    return 0.2; // Beyond 3 standard deviations (outlier)
  }

  /**
   * Calculate fantasy points benchmarks
   */
  private async calculateFantasyPointsBenchmarks(position: string, season: number): Promise<BenchmarkData | null> {
    try {
      const stats = await db
        .select({
          avg: avg(playerWeekFacts.powerScore), // Using powerScore as proxy
          stddev: sql<number>`STDDEV(${playerWeekFacts.powerScore})`,
          count: count()
        })
        .from(playerWeekFacts)
        .where(
          and(
            eq(playerWeekFacts.season, season),
            eq(playerWeekFacts.position, position)
          )
        );

      if (stats[0] && stats[0].count > 10) {
        const mean = stats[0].avg || 0;
        const stdDev = stats[0].stddev || 1;

        return {
          position,
          metricName: 'fantasyPoints',
          season,
          percentiles: {
            p10: mean - 1.28 * stdDev,
            p25: mean - 0.67 * stdDev,
            p50: mean,
            p75: mean + 0.67 * stdDev,
            p90: mean + 1.28 * stdDev
          },
          mean,
          stdDev,
          sampleSize: stats[0].count
        };
      }

      return null;

    } catch (error) {
      console.warn(`⚠️ [Confidence] Fantasy points benchmark calculation failed:`, error);
      return null;
    }
  }

  /**
   * Calculate snap share benchmarks
   */
  private async calculateSnapShareBenchmarks(position: string, season: number): Promise<BenchmarkData | null> {
    try {
      const stats = await db
        .select({
          avg: avg(playerWeekFacts.snapShare),
          stddev: sql<number>`STDDEV(${playerWeekFacts.snapShare})`,
          count: count()
        })
        .from(playerWeekFacts)
        .where(
          and(
            eq(playerWeekFacts.season, season),
            eq(playerWeekFacts.position, position),
            isNotNull(playerWeekFacts.snapShare)
          )
        );

      if (stats[0] && stats[0].count > 10) {
        const mean = stats[0].avg || 0;
        const stdDev = stats[0].stddev || 0.1;

        return {
          position,
          metricName: 'snapShare',
          season,
          percentiles: {
            p10: Math.max(0, mean - 1.28 * stdDev),
            p25: Math.max(0, mean - 0.67 * stdDev),
            p50: mean,
            p75: Math.min(1, mean + 0.67 * stdDev),
            p90: Math.min(1, mean + 1.28 * stdDev)
          },
          mean,
          stdDev,
          sampleSize: stats[0].count
        };
      }

      return null;

    } catch (error) {
      console.warn(`⚠️ [Confidence] Snap share benchmark calculation failed:`, error);
      return null;
    }
  }

  /**
   * Calculate target share benchmarks (for WR/TE positions)
   */
  private async calculateTargetShareBenchmarks(position: string, season: number): Promise<BenchmarkData | null> {
    if (!['WR', 'TE'].includes(position)) {
      return null; // Target share only relevant for WR/TE
    }

    try {
      // Would use target share if available, using placeholder calculation
      const mean = position === 'WR' ? 0.15 : 0.12; // Typical target shares
      const stdDev = 0.08;

      return {
        position,
        metricName: 'targetShare',
        season,
        percentiles: {
          p10: Math.max(0, mean - 1.28 * stdDev),
          p25: Math.max(0, mean - 0.67 * stdDev),
          p50: mean,
          p75: Math.min(1, mean + 0.67 * stdDev),
          p90: Math.min(1, mean + 1.28 * stdDev)
        },
        mean,
        stdDev,
        sampleSize: 100 // Placeholder
      };

    } catch (error) {
      console.warn(`⚠️ [Confidence] Target share benchmark calculation failed:`, error);
      return null;
    }
  }

  /**
   * Generate explanation for confidence score
   */
  private generateExplanation(factors: ConfidenceFactors, overallScore: number): string {
    const explanations = [];

    if (factors.sourceReliability >= 0.9) {
      explanations.push('High-reliability data sources');
    } else if (factors.sourceReliability <= 0.6) {
      explanations.push('Lower-reliability data sources detected');
    }

    if (factors.dataFreshness >= 0.9) {
      explanations.push('Very fresh data');
    } else if (factors.dataFreshness <= 0.5) {
      explanations.push('Stale data may impact accuracy');
    }

    if (factors.dataCompleteness >= 0.95) {
      explanations.push('Complete data with all fields populated');
    } else if (factors.dataCompleteness <= 0.8) {
      explanations.push('Missing some data fields');
    }

    if (factors.statisticalConsistency <= 0.6) {
      explanations.push('Values outside typical statistical ranges');
    }

    if (factors.businessLogicCompliance <= 0.7) {
      explanations.push('Some business rule violations detected');
    }

    const scoreDescription = overallScore >= 0.9 ? 'Very High' :
                           overallScore >= 0.8 ? 'High' :
                           overallScore >= 0.7 ? 'Good' :
                           overallScore >= 0.6 ? 'Fair' : 'Low';

    return `${scoreDescription} confidence score (${overallScore.toFixed(3)}). ${explanations.join('. ')}.`;
  }

  /**
   * Generate recommendations based on confidence factors
   */
  private generateRecommendations(factors: ConfidenceFactors): string[] {
    const recommendations = [];

    if (factors.sourceReliability <= 0.7) {
      recommendations.push('Consider using additional or higher-reliability data sources');
    }

    if (factors.dataFreshness <= 0.6) {
      recommendations.push('Update data more frequently to improve freshness');
    }

    if (factors.dataCompleteness <= 0.8) {
      recommendations.push('Improve data collection to fill missing fields');
    }

    if (factors.statisticalConsistency <= 0.6) {
      recommendations.push('Review statistical outliers and validate unusual values');
    }

    if (factors.businessLogicCompliance <= 0.7) {
      recommendations.push('Validate and clean data to meet business rule requirements');
    }

    if (factors.crossSourceConsensus <= 0.6) {
      recommendations.push('Cross-reference with additional data sources for validation');
    }

    if (recommendations.length === 0) {
      recommendations.push('Data quality is good - maintain current data processes');
    }

    return recommendations;
  }

  /**
   * Determine risk level based on confidence score and factors
   */
  private determineRiskLevel(overallScore: number, factors: ConfidenceFactors): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Critical if any critical factors are very low
    if (factors.businessLogicCompliance <= 0.5 || factors.sourceReliability <= 0.4) {
      return 'CRITICAL';
    }

    if (overallScore >= 0.85) return 'LOW';
    if (overallScore >= 0.7) return 'MEDIUM';
    if (overallScore >= 0.5) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Assign data quality grade
   */
  private assignDataQualityGrade(overallScore: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (overallScore >= 0.9) return 'A';
    if (overallScore >= 0.8) return 'B';
    if (overallScore >= 0.7) return 'C';
    if (overallScore >= 0.6) return 'D';
    return 'F';
  }

  /**
   * Get default low confidence score for error cases
   */
  private async getDefaultLowConfidenceScore(): Promise<ConfidenceScore> {
    return {
      overallScore: 0.3,
      factors: {
        sourceReliability: 0.5,
        dataFreshness: 0.5,
        dataCompleteness: 0.5,
        statisticalConsistency: 0.5,
        businessLogicCompliance: 0.5,
        crossSourceConsensus: 0.5,
        lineageQuality: 0.5
      },
      explanation: 'Low confidence due to calculation errors or missing data',
      recommendations: ['Review data quality manually', 'Investigate confidence scoring issues'],
      riskLevel: 'HIGH',
      dataQualityGrade: 'D'
    };
  }
}

/**
 * Singleton instance for external usage
 */
export const confidenceScorer = ConfidenceScorer.getInstance();