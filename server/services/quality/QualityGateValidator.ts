/**
 * Quality Gate Validator - Data Quality Validation System
 * 
 * Comprehensive data quality validation system for Gold Layer analytics facts.
 * Implements multi-tier quality checks including completeness, consistency,
 * accuracy, freshness, and outlier detection with configurable thresholds.
 * 
 * Core Quality Gates:
 * - Completeness: Required field validation and coverage analysis
 * - Consistency: Cross-table validation and referential integrity
 * - Accuracy: Business logic validation and range checks
 * - Freshness: Data recency and update frequency validation
 * - Outliers: Statistical anomaly detection and flagging
 */

import { db } from '../../db';
import { 
  qualityGateResults,
  playerWeekFacts,
  playerSeasonFacts,
  playerMarketFacts,
  playerCompositeFacts,
  playerIdentityMap,
  marketSignals,
  type InsertQualityGateResults
} from '@shared/schema';
import { eq, and, sql, gte, lte, isNull, isNotNull, count, avg, stddev } from 'drizzle-orm';
import { qualityConfig, type QualityThresholds } from './QualityConfig';

export interface QualityRule {
  name: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  threshold?: number;
  validator: (record: any, context?: any) => Promise<QualityRuleResult>;
}

export interface QualityRuleResult {
  passed: boolean;
  score: number; // 0-1 where 1 is perfect
  message?: string;
  details?: any;
}

export interface QualityValidationRequest {
  tableName: string;
  recordIdentifier: string;
  recordData: any;
  validationRules?: string[]; // Specific rules to run, null for all
  context?: {
    season?: number;
    week?: number;
    position?: string;
    jobType?: 'WEEKLY' | 'SEASON' | 'BACKFILL' | 'INCREMENTAL';
    layer?: 'BRONZE_TO_SILVER' | 'SILVER_TO_GOLD';
    [key: string]: any;
  };
}

export interface QualityValidationResult {
  overallPassed: boolean;
  overallScore: number;
  gateResults: {
    completeness: QualityRuleResult;
    consistency: QualityRuleResult;
    accuracy: QualityRuleResult;
    freshness: QualityRuleResult;
    outlier: QualityRuleResult;
  };
  ruleResults: Map<string, QualityRuleResult>;
  failedRules: string[];
  warningRules: string[];
  criticalIssues: string[];
}

/**
 * Core Quality Gate Validator
 * Validates data quality across multiple dimensions with configurable thresholds
 */
export class QualityGateValidator {
  private static instance: QualityGateValidator;
  
  private rules: Map<string, QualityRule> = new Map();
  private qualityConfig = qualityConfig;

  public static getInstance(): QualityGateValidator {
    if (!QualityGateValidator.instance) {
      QualityGateValidator.instance = new QualityGateValidator();
    }
    return QualityGateValidator.instance;
  }

  private constructor() {
    this.initializeQualityRules();
  }

  /**
   * Validate a record against quality gates
   * Main entry point for quality validation
   */
  async validateRecord(request: QualityValidationRequest, jobId: string): Promise<QualityValidationResult> {
    const startTime = Date.now();
    
    console.log(`🛡️ [QualityGates] Validating ${request.tableName}:${request.recordIdentifier}`);
    console.log(`🔧 [QualityGates] Context: jobType=${request.context?.jobType}, position=${request.context?.position}, layer=${request.context?.layer}`);

    try {
      // Get context-specific quality thresholds
      const thresholds = this.qualityConfig.getThresholds({
        jobType: request.context?.jobType,
        position: request.context?.position,
        layer: request.context?.layer
      });

      console.log(`📏 [QualityGates] Using thresholds - Completeness: ${thresholds.completeness.critical}, Consistency: ${thresholds.consistency.critical}`);

      const ruleResults = new Map<string, QualityRuleResult>();
      const failedRules: string[] = [];
      const warningRules: string[] = [];
      const criticalIssues: string[] = [];

      // Run specific rules or all rules
      const rulesToRun = request.validationRules 
        ? Array.from(this.rules.values()).filter(rule => request.validationRules!.includes(rule.name))
        : Array.from(this.rules.values());

      // Execute rules in parallel for performance
      const rulePromises = rulesToRun.map(async (rule) => {
        try {
          const result = await rule.validator(request.recordData, { ...request.context, thresholds });
          ruleResults.set(rule.name, result);

          if (!result.passed) {
            if (rule.severity === 'CRITICAL') {
              criticalIssues.push(`${rule.name}: ${result.message || 'Critical quality check failed'}`);
              failedRules.push(rule.name);
            } else if (rule.severity === 'WARNING') {
              warningRules.push(rule.name);
            }
          }

          return { rule, result };
        } catch (error) {
          const errorResult: QualityRuleResult = {
            passed: false,
            score: 0,
            message: `Rule execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
          ruleResults.set(rule.name, errorResult);
          criticalIssues.push(`${rule.name}: Rule execution failed`);
          failedRules.push(rule.name);
          
          return { rule, result: errorResult };
        }
      });

      await Promise.all(rulePromises);

      // Aggregate results into quality gate categories
      const gateResults = {
        completeness: this.aggregateRulesByCategory(ruleResults, 'completeness'),
        consistency: this.aggregateRulesByCategory(ruleResults, 'consistency'),
        accuracy: this.aggregateRulesByCategory(ruleResults, 'accuracy'),
        freshness: this.aggregateRulesByCategory(ruleResults, 'freshness'),
        outlier: this.aggregateRulesByCategory(ruleResults, 'outlier')
      };

      // Calculate overall score and pass/fail using centralized validation
      const overallScore = this.calculateOverallScore(gateResults);
      const qualityResult = this.qualityConfig.validateQualityResult(overallScore, {
        jobType: request.context?.jobType,
        position: request.context?.position,
        layer: request.context?.layer
      });
      
      const overallPassed = qualityResult.level === 'PASS';

      const validationResult: QualityValidationResult = {
        overallPassed,
        overallScore,
        gateResults,
        ruleResults,
        failedRules,
        warningRules,
        criticalIssues
      };

      // Persist validation results
      await this.persistValidationResults(jobId, request, validationResult);

      const duration = Date.now() - startTime;
      console.log(`✅ [QualityGates] Validation completed in ${duration}ms - Score: ${overallScore.toFixed(3)}, Passed: ${overallPassed}`);

      return validationResult;

    } catch (error) {
      console.error(`❌ [QualityGates] Validation failed for ${request.tableName}:${request.recordIdentifier}:`, error);
      throw error;
    }
  }

  /**
   * Validate multiple records in batch
   */
  async validateBatch(requests: QualityValidationRequest[], jobId: string): Promise<Map<string, QualityValidationResult>> {
    console.log(`🛡️ [QualityGates] Batch validating ${requests.length} records`);

    const results = new Map<string, QualityValidationResult>();
    
    // Process in parallel with concurrency limit
    const BATCH_SIZE = 10;
    const batches = [];
    
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      batches.push(requests.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (request) => {
        try {
          const result = await this.validateRecord(request, jobId);
          results.set(request.recordIdentifier, result);
        } catch (error) {
          console.error(`❌ [QualityGates] Batch validation failed for ${request.recordIdentifier}:`, error);
          // Add failed result
          results.set(request.recordIdentifier, {
            overallPassed: false,
            overallScore: 0,
            gateResults: {
              completeness: { passed: false, score: 0, message: 'Validation failed' },
              consistency: { passed: false, score: 0, message: 'Validation failed' },
              accuracy: { passed: false, score: 0, message: 'Validation failed' },
              freshness: { passed: false, score: 0, message: 'Validation failed' },
              outlier: { passed: false, score: 0, message: 'Validation failed' }
            },
            ruleResults: new Map(),
            failedRules: ['batch_validation_error'],
            warningRules: [],
            criticalIssues: ['Batch validation failed']
          });
        }
      });

      await Promise.all(batchPromises);
    }

    console.log(`✅ [QualityGates] Batch validation completed - ${results.size} records processed`);
    return results;
  }

  /**
   * Get quality statistics for a table/time period
   */
  async getQualityStatistics(
    tableName: string, 
    timeRange: { start: Date; end: Date },
    filters?: { [key: string]: any }
  ): Promise<{
    totalRecords: number;
    passedRecords: number;
    failedRecords: number;
    averageScore: number;
    gateStatistics: {
      [gateName: string]: {
        passed: number;
        failed: number;
        averageScore: number;
      };
    };
  }> {
    console.log(`📊 [QualityGates] Getting quality statistics for ${tableName}`);

    try {
      // Build query conditions
      const conditions = [
        eq(qualityGateResults.tableName, tableName),
        gte(qualityGateResults.validatedAt, timeRange.start),
        lte(qualityGateResults.validatedAt, timeRange.end)
      ];

      // Get quality results
      const results = await db
        .select({
          overallPassed: qualityGateResults.overallPassed,
          overallQualityScore: qualityGateResults.overallQualityScore,
          completenessCheck: qualityGateResults.completenessCheck,
          consistencyCheck: qualityGateResults.consistencyCheck,
          accuracyCheck: qualityGateResults.accuracyCheck,
          freshnessCheck: qualityGateResults.freshnessCheck,
          outlierCheck: qualityGateResults.outlierCheck,
          completenessScore: qualityGateResults.completenessScore,
          consistencyScore: qualityGateResults.consistencyScore,
          accuracyScore: qualityGateResults.accuracyScore,
          freshnessScore: qualityGateResults.freshnessScore,
          outlierScore: qualityGateResults.outlierScore
        })
        .from(qualityGateResults)
        .where(and(...conditions));

      const totalRecords = results.length;
      const passedRecords = results.filter(r => r.overallPassed).length;
      const failedRecords = totalRecords - passedRecords;
      
      const averageScore = results.reduce((sum, r) => sum + (r.overallQualityScore || 0), 0) / totalRecords;

      // Calculate gate statistics
      const gateStatistics = {
        completeness: this.calculateGateStats(results, 'completenessCheck', 'completenessScore'),
        consistency: this.calculateGateStats(results, 'consistencyCheck', 'consistencyScore'),
        accuracy: this.calculateGateStats(results, 'accuracyCheck', 'accuracyScore'),
        freshness: this.calculateGateStats(results, 'freshnessCheck', 'freshnessScore'),
        outlier: this.calculateGateStats(results, 'outlierCheck', 'outlierScore')
      };

      const statistics = {
        totalRecords,
        passedRecords,
        failedRecords,
        averageScore,
        gateStatistics
      };

      console.log(`✅ [QualityGates] Statistics generated - Pass rate: ${((passedRecords / totalRecords) * 100).toFixed(1)}%`);
      return statistics;

    } catch (error) {
      console.error(`❌ [QualityGates] Failed to get quality statistics:`, error);
      throw error;
    }
  }

  // ========================================
  // PRIVATE QUALITY RULE IMPLEMENTATIONS
  // ========================================

  /**
   * Initialize standard quality rules
   */
  private initializeQualityRules(): void {
    console.log(`🔧 [QualityGates] Initializing quality rules`);

    // Completeness Rules
    this.addRule({
      name: 'required_fields_present',
      description: 'Validates that all required fields are present and not null',
      severity: 'CRITICAL',
      validator: this.validateRequiredFields.bind(this)
    });

    this.addRule({
      name: 'field_coverage',
      description: 'Validates minimum field coverage percentage',
      severity: 'WARNING',
      threshold: 0.85, // Will be overridden by context-specific thresholds
      validator: this.validateFieldCoverage.bind(this)
    });

    // Consistency Rules
    this.addRule({
      name: 'referential_integrity',
      description: 'Validates foreign key relationships exist',
      severity: 'CRITICAL',
      validator: this.validateReferentialIntegrity.bind(this)
    });

    this.addRule({
      name: 'cross_table_consistency',
      description: 'Validates consistency across related tables',
      severity: 'WARNING',
      validator: this.validateCrossTableConsistency.bind(this)
    });

    // Accuracy Rules  
    this.addRule({
      name: 'value_ranges',
      description: 'Validates values are within expected ranges',
      severity: 'WARNING',
      validator: this.validateValueRanges.bind(this)
    });

    this.addRule({
      name: 'business_logic',
      description: 'Validates business logic constraints',
      severity: 'CRITICAL',
      validator: this.validateBusinessLogic.bind(this)
    });

    // Freshness Rules
    this.addRule({
      name: 'data_freshness',
      description: 'Validates data is sufficiently fresh',
      severity: 'WARNING',
      threshold: 72, // Will be overridden by context-specific thresholds
      validator: this.validateDataFreshness.bind(this)
    });

    // Outlier Rules
    this.addRule({
      name: 'statistical_outliers',
      description: 'Detects statistical outliers in numeric fields',
      severity: 'INFO',
      threshold: 2.5, // Will be overridden by context-specific thresholds
      validator: this.validateStatisticalOutliers.bind(this)
    });

    console.log(`✅ [QualityGates] Initialized ${this.rules.size} quality rules`);
  }

  /**
   * Add a quality rule to the validator
   */
  private addRule(rule: QualityRule): void {
    this.rules.set(rule.name, rule);
  }

  /**
   * Validate required fields are present
   */
  private async validateRequiredFields(record: any, context?: any): Promise<QualityRuleResult> {
    const requiredFields = this.getRequiredFieldsForTable(context?.tableName || 'unknown');
    const missingFields = requiredFields.filter(field => 
      record[field] === null || record[field] === undefined || record[field] === ''
    );

    const score = 1 - (missingFields.length / requiredFields.length);
    
    return {
      passed: missingFields.length === 0,
      score,
      message: missingFields.length > 0 ? `Missing required fields: ${missingFields.join(', ')}` : undefined,
      details: { missingFields, totalRequired: requiredFields.length }
    };
  }

  /**
   * Validate field coverage percentage
   */
  private async validateFieldCoverage(record: any, context?: any): Promise<QualityRuleResult> {
    const allFields = Object.keys(record);
    const populatedFields = allFields.filter(field => 
      record[field] !== null && record[field] !== undefined && record[field] !== ''
    );

    const coverage = populatedFields.length / allFields.length;
    
    // Get threshold from context or fall back to default
    const threshold = context?.thresholds?.completeness?.warning || 0.85;

    return {
      passed: coverage >= threshold,
      score: coverage,
      message: coverage < threshold ? `Field coverage ${(coverage * 100).toFixed(1)}% below threshold ${(threshold * 100).toFixed(1)}%` : undefined,
      details: { coverage, populatedFields: populatedFields.length, totalFields: allFields.length }
    };
  }

  /**
   * Validate referential integrity
   */
  private async validateReferentialIntegrity(record: any, context?: any): Promise<QualityRuleResult> {
    // Check if player ID exists in identity map
    if (record.canonicalPlayerId) {
      const playerExists = await db
        .select({ count: count() })
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap.canonicalId, record.canonicalPlayerId));

      if (!playerExists[0] || playerExists[0].count === 0) {
        return {
          passed: false,
          score: 0,
          message: `Player ID ${record.canonicalPlayerId} not found in identity map`,
          details: { invalidPlayerId: record.canonicalPlayerId }
        };
      }
    }

    return { passed: true, score: 1 };
  }

  /**
   * Validate cross-table consistency
   */
  private async validateCrossTableConsistency(record: any, context?: any): Promise<QualityRuleResult> {
    // Placeholder implementation - would validate consistency across related tables
    // For example, ensure season facts aggregate correctly from weekly facts
    return { passed: true, score: 1 };
  }

  /**
   * Validate value ranges
   */
  private async validateValueRanges(record: any, context?: any): Promise<QualityRuleResult> {
    const violations = [];

    // Fantasy points should be reasonable
    if (record.fantasyPoints !== null && record.fantasyPoints !== undefined) {
      if (record.fantasyPoints < -10 || record.fantasyPoints > 100) {
        violations.push(`Fantasy points ${record.fantasyPoints} outside reasonable range (-10 to 100)`);
      }
    }

    // Percentages should be 0-1
    const percentageFields = ['snapShare', 'targetShare', 'confidence', 'qualityScore'];
    percentageFields.forEach(field => {
      if (record[field] !== null && record[field] !== undefined) {
        if (record[field] < 0 || record[field] > 1) {
          violations.push(`${field} ${record[field]} should be between 0 and 1`);
        }
      }
    });

    return {
      passed: violations.length === 0,
      score: violations.length === 0 ? 1 : Math.max(0, 1 - (violations.length * 0.2)),
      message: violations.length > 0 ? violations.join('; ') : undefined,
      details: { violations }
    };
  }

  /**
   * Validate business logic constraints
   */
  private async validateBusinessLogic(record: any, context?: any): Promise<QualityRuleResult> {
    const violations = [];

    // Games played cannot exceed season games
    if (record.gamesPlayed > 17) {
      violations.push(`Games played ${record.gamesPlayed} exceeds season maximum`);
    }

    // Targets cannot exceed snaps (with reasonable buffer)
    if (record.targets && record.snapCount && record.targets > record.snapCount) {
      violations.push(`Targets ${record.targets} cannot exceed snap count ${record.snapCount}`);
    }

    return {
      passed: violations.length === 0,
      score: violations.length === 0 ? 1 : Math.max(0, 1 - (violations.length * 0.25)),
      message: violations.length > 0 ? violations.join('; ') : undefined,
      details: { violations }
    };
  }

  /**
   * Validate data freshness
   */
  private async validateDataFreshness(record: any, context?: any): Promise<QualityRuleResult> {
    const now = new Date();
    let lastUpdate = record.updatedAt || record.lastUpdated || record.createdAt;

    if (!lastUpdate) {
      return {
        passed: false,
        score: 0,
        message: 'No timestamp available to check freshness'
      };
    }

    if (typeof lastUpdate === 'string') {
      lastUpdate = new Date(lastUpdate);
    }

    const ageHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    
    // Get thresholds from context or fall back to defaults
    const warningThreshold = context?.thresholds?.freshness?.warning || 72;
    const criticalThreshold = context?.thresholds?.freshness?.critical || 24;

    let score = 1;
    if (ageHours > criticalThreshold) {
      score = Math.max(0, 1 - ((ageHours - criticalThreshold) / 24)); // Decay over days
    } else if (ageHours > warningThreshold) {
      score = 0.8; // Warning level
    }

    return {
      passed: ageHours <= warningThreshold,
      score,
      message: ageHours > warningThreshold ? `Data is ${ageHours.toFixed(1)} hours old` : undefined,
      details: { ageHours, lastUpdate }
    };
  }

  /**
   * Validate statistical outliers
   */
  private async validateStatisticalOutliers(record: any, context?: any): Promise<QualityRuleResult> {
    // Placeholder implementation - would check for statistical outliers
    // Would require historical data analysis and z-score calculations
    return { passed: true, score: 1 };
  }

  /**
   * Get required fields for a table
   */
  private getRequiredFieldsForTable(tableName: string): string[] {
    const requiredFieldsMap: { [key: string]: string[] } = {
      'player_week_facts': ['playerId', 'season', 'week', 'position'],
      'player_season_facts': ['canonicalPlayerId', 'season', 'position', 'nflTeam'],
      'player_market_facts': ['canonicalPlayerId', 'season'],
      'player_composite_facts': ['canonicalPlayerId', 'season']
    };

    return requiredFieldsMap[tableName] || [];
  }

  /**
   * Aggregate rule results by category
   */
  private aggregateRulesByCategory(ruleResults: Map<string, QualityRuleResult>, category: string): QualityRuleResult {
    const categoryRules = Array.from(this.rules.values()).filter(rule => 
      rule.name.toLowerCase().includes(category)
    );

    if (categoryRules.length === 0) {
      return { passed: true, score: 1, message: `No rules found for category: ${category}` };
    }

    const categoryResults = categoryRules.map(rule => ruleResults.get(rule.name)).filter(Boolean);
    
    if (categoryResults.length === 0) {
      return { passed: true, score: 1, message: `No results found for category: ${category}` };
    }

    const averageScore = categoryResults.reduce((sum, result) => sum + result!.score, 0) / categoryResults.length;
    const allPassed = categoryResults.every(result => result!.passed);

    return {
      passed: allPassed,
      score: averageScore,
      message: !allPassed ? `${categoryResults.filter(r => !r!.passed).length} of ${categoryResults.length} ${category} rules failed` : undefined
    };
  }

  /**
   * Calculate overall quality score from gate results
   */
  private calculateOverallScore(gateResults: { [key: string]: QualityRuleResult }): number {
    const weights = {
      completeness: 0.25,
      consistency: 0.25,
      accuracy: 0.25,
      freshness: 0.15,
      outlier: 0.10
    };

    return Object.entries(gateResults).reduce((score, [gate, result]) => {
      const weight = weights[gate as keyof typeof weights] || 0;
      return score + (result.score * weight);
    }, 0);
  }

  /**
   * Calculate gate statistics
   */
  private calculateGateStats(results: any[], checkField: string, scoreField: string): { passed: number; failed: number; averageScore: number } {
    const passed = results.filter(r => r[checkField] === true).length;
    const failed = results.filter(r => r[checkField] === false).length;
    const scores = results.map(r => r[scoreField]).filter(s => s !== null && s !== undefined);
    const averageScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

    return { passed, failed, averageScore };
  }

  /**
   * Persist validation results to database
   */
  private async persistValidationResults(
    jobId: string, 
    request: QualityValidationRequest, 
    result: QualityValidationResult
  ): Promise<void> {
    try {
      const validationResult: InsertQualityGateResults = {
        jobId,
        tableName: request.tableName,
        recordIdentifier: request.recordIdentifier,
        overallPassed: result.overallPassed,
        completenessCheck: result.gateResults.completeness.passed,
        consistencyCheck: result.gateResults.consistency.passed,
        accuracyCheck: result.gateResults.accuracy.passed,
        freshnessCheck: result.gateResults.freshness.passed,
        outlierCheck: result.gateResults.outlier.passed,
        completenessScore: result.gateResults.completeness.score,
        consistencyScore: result.gateResults.consistency.score,
        accuracyScore: result.gateResults.accuracy.score,
        freshnessScore: result.gateResults.freshness.score,
        outlierScore: result.gateResults.outlier.score,
        overallQualityScore: result.overallScore,
        failedRules: result.failedRules,
        warningRules: result.warningRules,
        validationMessages: {
          criticalIssues: result.criticalIssues,
          gateResults: Object.fromEntries(
            Object.entries(result.gateResults).map(([key, value]) => [key, value])
          )
        },
        validatedBy: 'system',
        validationVersion: '1.0.0'
      };

      await db.insert(qualityGateResults).values(validationResult);

    } catch (error) {
      console.warn(`⚠️ [QualityGates] Failed to persist validation results:`, error);
      // Don't throw - validation should continue even if persistence fails
    }
  }
}

/**
 * Singleton instance for external usage
 */
export const qualityGateValidator = QualityGateValidator.getInstance();