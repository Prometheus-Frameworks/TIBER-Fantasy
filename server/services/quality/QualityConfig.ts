/**
 * Quality Configuration System - Centralized Quality Thresholds and Rules
 * 
 * Centralized configuration system for all quality gate thresholds and validation rules.
 * Supports environment-based configuration, position-specific requirements, and 
 * processing mode-specific quality standards for fantasy football data.
 * 
 * Core Features:
 * - Environment-based quality threshold configuration (dev/staging/prod)
 * - Position-specific quality requirements (QB, RB, WR, TE validation standards)
 * - Processing mode-specific thresholds (WEEKLY, SEASON, BACKFILL, INCREMENTAL)
 * - Layer transition quality gates (Bronze→Silver, Silver→Gold enforcement)
 * - Configurable severity levels and bypass options
 * - Real-time threshold updates and validation
 */

import { uphJobTypeEnum } from '@shared/schema';

export interface QualityThresholds {
  // Data Completeness Thresholds (0.0 - 1.0)
  completeness: {
    critical: number;    // Must have this percentage of required fields
    warning: number;     // Warning if below this threshold
    minimum: number;     // Absolute minimum for processing
  };
  
  // Data Consistency Thresholds (0.0 - 1.0)
  consistency: {
    critical: number;    // Cross-platform data alignment
    warning: number;     // Acceptable variance level
    crossReference: number; // Reference data validation
  };
  
  // Data Accuracy Thresholds (0.0 - 1.0)
  accuracy: {
    critical: number;    // Statistical validation pass rate
    warning: number;     // Acceptable accuracy level
    outlierDetection: number; // Standard deviations for outlier detection
  };
  
  // Data Freshness Thresholds (hours)
  freshness: {
    critical: number;    // Must be fresher than this many hours
    warning: number;     // Warning if older than this
    maximum: number;     // Absolute maximum age for processing
  };
  
  // Processing Performance Thresholds
  performance: {
    processingTimeout: number;     // Maximum processing time (ms)
    batchSizeLimit: number;        // Maximum records per batch
    memoryLimitMB: number;         // Memory usage limit
  };
}

export interface PositionQualityRules {
  position: string;
  requiredFields: string[];
  optionalFields: string[];
  validationRules: string[];
  customThresholds?: Partial<QualityThresholds>;
}

export interface LayerTransitionConfig {
  layer: 'BRONZE_TO_SILVER' | 'SILVER_TO_GOLD';
  thresholds: QualityThresholds;
  enforceStrictValidation: boolean;
  failOnCritical: boolean;
  allowPartialProcessing: boolean;
}

export interface QualityConfigSettings {
  environment: 'development' | 'staging' | 'production';
  globalThresholds: QualityThresholds;
  positionSpecific: PositionQualityRules[];
  layerTransitions: LayerTransitionConfig[];
  processingModes: Map<typeof uphJobTypeEnum.enumValues[number], Partial<QualityThresholds>>;
  bypassOptions: {
    allowQualityBypass: boolean;
    emergencyMode: boolean;
    bypassRequiresApproval: boolean;
  };
}

/**
 * Centralized Quality Configuration Manager
 * Provides all quality thresholds and validation rules for the UPH system
 */
export class QualityConfig {
  private static instance: QualityConfig;
  private config: QualityConfigSettings;

  public static getInstance(): QualityConfig {
    if (!QualityConfig.instance) {
      QualityConfig.instance = new QualityConfig();
    }
    return QualityConfig.instance;
  }

  private constructor() {
    this.config = this.initializeConfiguration();
    console.log(`🔧 [QualityConfig] Initialized for environment: ${this.config.environment}`);
  }

  /**
   * Get quality thresholds for a specific context
   */
  getThresholds(context: {
    jobType?: typeof uphJobTypeEnum.enumValues[number];
    position?: string;
    layer?: 'BRONZE_TO_SILVER' | 'SILVER_TO_GOLD';
    environment?: string;
  }): QualityThresholds {
    // Start with global thresholds
    let thresholds = { ...this.config.globalThresholds };

    // Apply processing mode-specific overrides
    if (context.jobType && this.config.processingModes.has(context.jobType)) {
      const modeOverrides = this.config.processingModes.get(context.jobType)!;
      thresholds = this.mergeThresholds(thresholds, modeOverrides);
    }

    // Apply position-specific overrides
    if (context.position) {
      const positionConfig = this.config.positionSpecific.find(p => p.position === context.position);
      if (positionConfig?.customThresholds) {
        thresholds = this.mergeThresholds(thresholds, positionConfig.customThresholds);
      }
    }

    // Apply layer-specific overrides
    if (context.layer) {
      const layerConfig = this.config.layerTransitions.find(l => l.layer === context.layer);
      if (layerConfig) {
        thresholds = this.mergeThresholds(thresholds, layerConfig.thresholds);
      }
    }

    return thresholds;
  }

  /**
   * Get position-specific validation rules
   */
  getPositionRules(position: string): PositionQualityRules | null {
    return this.config.positionSpecific.find(p => p.position === position) || null;
  }

  /**
   * Get layer transition configuration
   */
  getLayerConfig(layer: 'BRONZE_TO_SILVER' | 'SILVER_TO_GOLD'): LayerTransitionConfig | null {
    return this.config.layerTransitions.find(l => l.layer === layer) || null;
  }

  /**
   * Check if quality bypass is allowed
   */
  isQualityBypassAllowed(): boolean {
    return this.config.bypassOptions.allowQualityBypass;
  }

  /**
   * Check if system is in emergency mode
   */
  isEmergencyMode(): boolean {
    return this.config.bypassOptions.emergencyMode;
  }

  /**
   * Update configuration at runtime
   */
  updateConfiguration(updates: Partial<QualityConfigSettings>): void {
    this.config = { ...this.config, ...updates };
    console.log(`🔧 [QualityConfig] Configuration updated`);
  }

  /**
   * Get current configuration
   */
  getConfiguration(): QualityConfigSettings {
    return { ...this.config };
  }

  /**
   * Validate quality result against thresholds
   */
  validateQualityResult(
    qualityScore: number, 
    context: { jobType?: typeof uphJobTypeEnum.enumValues[number]; position?: string; layer?: 'BRONZE_TO_SILVER' | 'SILVER_TO_GOLD' }
  ): {
    level: 'PASS' | 'WARNING' | 'CRITICAL';
    shouldFail: boolean;
    shouldWarn: boolean;
    message: string;
  } {
    const thresholds = this.getThresholds(context);
    const layerConfig = context.layer ? this.getLayerConfig(context.layer) : null;

    if (qualityScore >= thresholds.consistency.critical) {
      return {
        level: 'PASS',
        shouldFail: false,
        shouldWarn: false,
        message: `Quality score ${qualityScore.toFixed(3)} passes all thresholds`
      };
    }

    if (qualityScore >= thresholds.consistency.warning) {
      return {
        level: 'WARNING',
        shouldFail: false,
        shouldWarn: true,
        message: `Quality score ${qualityScore.toFixed(3)} below critical threshold ${thresholds.consistency.critical}`
      };
    }

    const shouldFail = layerConfig?.failOnCritical ?? true;
    return {
      level: 'CRITICAL',
      shouldFail,
      shouldWarn: true,
      message: `Quality score ${qualityScore.toFixed(3)} below warning threshold ${thresholds.consistency.warning}`
    };
  }

  /**
   * Initialize default configuration based on environment
   */
  private initializeConfiguration(): QualityConfigSettings {
    const environment = (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production';
    
    return {
      environment,
      globalThresholds: this.getEnvironmentThresholds(environment),
      positionSpecific: this.initializePositionRules(),
      layerTransitions: this.initializeLayerTransitions(environment),
      processingModes: this.initializeProcessingModes(),
      bypassOptions: {
        allowQualityBypass: environment === 'development',
        emergencyMode: false,
        bypassRequiresApproval: environment === 'production'
      }
    };
  }

  /**
   * Get environment-specific quality thresholds
   */
  private getEnvironmentThresholds(environment: string): QualityThresholds {
    const baseThresholds: QualityThresholds = {
      completeness: {
        critical: 0.95,
        warning: 0.85,
        minimum: 0.70
      },
      consistency: {
        critical: 0.98,
        warning: 0.90,
        crossReference: 0.95
      },
      accuracy: {
        critical: 0.95,
        warning: 0.85,
        outlierDetection: 2.5
      },
      freshness: {
        critical: 24,   // 24 hours
        warning: 72,    // 72 hours
        maximum: 168    // 1 week
      },
      performance: {
        processingTimeout: 30 * 60 * 1000, // 30 minutes
        batchSizeLimit: 1000,
        memoryLimitMB: 512
      }
    };

    // Adjust thresholds based on environment
    switch (environment) {
      case 'production':
        return {
          ...baseThresholds,
          completeness: { ...baseThresholds.completeness, critical: 0.98, warning: 0.90 },
          consistency: { ...baseThresholds.consistency, critical: 0.99, warning: 0.95 },
          freshness: { ...baseThresholds.freshness, critical: 12, warning: 24 }
        };

      case 'staging':
        return {
          ...baseThresholds,
          completeness: { ...baseThresholds.completeness, critical: 0.96, warning: 0.88 },
          freshness: { ...baseThresholds.freshness, critical: 48, warning: 96 }
        };

      default: // development
        return {
          ...baseThresholds,
          completeness: { ...baseThresholds.completeness, critical: 0.90, warning: 0.80, minimum: 0.60 },
          consistency: { ...baseThresholds.consistency, critical: 0.95, warning: 0.85 },
          freshness: { ...baseThresholds.freshness, critical: 72, warning: 168, maximum: 336 }
        };
    }
  }

  /**
   * Initialize position-specific quality rules
   */
  private initializePositionRules(): PositionQualityRules[] {
    return [
      {
        position: 'QB',
        requiredFields: ['passingYards', 'passingTouchdowns', 'interceptions', 'completions', 'attempts'],
        optionalFields: ['rushingYards', 'rushingTouchdowns', 'fumbles', 'qbr', 'pff_grade'],
        validationRules: ['qb_passing_accuracy', 'qb_efficiency_check', 'qb_volume_validation'],
        customThresholds: {
          accuracy: { critical: 0.98, warning: 0.92, outlierDetection: 2.0 },
          completeness: { critical: 0.98, warning: 0.95, minimum: 0.90 }
        }
      },
      {
        position: 'RB',
        requiredFields: ['rushingYards', 'rushingTouchdowns', 'carries', 'targets', 'receptions', 'receivingYards'],
        optionalFields: ['fumbles', 'redZoneCarries', 'goalLineCarries', 'breakAwayRuns'],
        validationRules: ['rb_touch_validation', 'rb_efficiency_check', 'rb_usage_patterns'],
        customThresholds: {
          completeness: { critical: 0.96, warning: 0.90, minimum: 0.85 },
          freshness: { critical: 12, warning: 24, maximum: 48 }
        }
      },
      {
        position: 'WR',
        requiredFields: ['targets', 'receptions', 'receivingYards', 'receivingTouchdowns', 'airYards'],
        optionalFields: ['rushingYards', 'rushingTouchdowns', 'returnYards', 'drops'],
        validationRules: ['wr_target_validation', 'wr_efficiency_check', 'wr_snap_correlation'],
        customThresholds: {
          accuracy: { critical: 0.96, warning: 0.88, outlierDetection: 2.2 },
          consistency: { critical: 0.97, warning: 0.92, crossReference: 0.94 }
        }
      },
      {
        position: 'TE',
        requiredFields: ['targets', 'receptions', 'receivingYards', 'receivingTouchdowns', 'blockingSnaps'],
        optionalFields: ['rushingYards', 'rushingTouchdowns', 'redZoneTargets'],
        validationRules: ['te_dual_role_validation', 'te_usage_check', 'te_blocking_correlation'],
        customThresholds: {
          completeness: { critical: 0.94, warning: 0.87, minimum: 0.80 },
          accuracy: { critical: 0.94, warning: 0.86, outlierDetection: 2.3 }
        }
      }
    ];
  }

  /**
   * Initialize layer transition configurations
   */
  private initializeLayerTransitions(environment: string): LayerTransitionConfig[] {
    const isProduction = environment === 'production';
    
    return [
      {
        layer: 'BRONZE_TO_SILVER',
        thresholds: {
          completeness: { critical: 0.90, warning: 0.80, minimum: 0.70 },
          consistency: { critical: 0.85, warning: 0.75, crossReference: 0.80 },
          accuracy: { critical: 0.85, warning: 0.75, outlierDetection: 3.0 },
          freshness: { critical: 48, warning: 96, maximum: 192 },
          performance: { processingTimeout: 15 * 60 * 1000, batchSizeLimit: 500, memoryLimitMB: 256 }
        },
        enforceStrictValidation: false,
        failOnCritical: false,
        allowPartialProcessing: true
      },
      {
        layer: 'SILVER_TO_GOLD',
        thresholds: {
          completeness: { critical: isProduction ? 0.98 : 0.95, warning: isProduction ? 0.95 : 0.90, minimum: 0.85 },
          consistency: { critical: isProduction ? 0.99 : 0.97, warning: isProduction ? 0.97 : 0.93, crossReference: 0.98 },
          accuracy: { critical: isProduction ? 0.98 : 0.95, warning: isProduction ? 0.95 : 0.90, outlierDetection: 2.0 },
          freshness: { critical: isProduction ? 12 : 24, warning: isProduction ? 24 : 48, maximum: isProduction ? 48 : 96 },
          performance: { processingTimeout: 45 * 60 * 1000, batchSizeLimit: 1000, memoryLimitMB: 512 }
        },
        enforceStrictValidation: isProduction,
        failOnCritical: isProduction,
        allowPartialProcessing: !isProduction
      }
    ];
  }

  /**
   * Initialize processing mode-specific thresholds
   */
  private initializeProcessingModes(): Map<typeof uphJobTypeEnum.enumValues[number], Partial<QualityThresholds>> {
    const modeMap = new Map<typeof uphJobTypeEnum.enumValues[number], Partial<QualityThresholds>>();

    // WEEKLY processing - higher standards for recent data
    modeMap.set('WEEKLY', {
      completeness: { critical: 0.98, warning: 0.95, minimum: 0.90 },
      freshness: { critical: 6, warning: 12, maximum: 24 },
      performance: { processingTimeout: 20 * 60 * 1000, batchSizeLimit: 200, memoryLimitMB: 256 }
    });

    // SEASON processing - balanced standards for bulk processing
    modeMap.set('SEASON', {
      completeness: { critical: 0.95, warning: 0.90, minimum: 0.85 },
      freshness: { critical: 24, warning: 72, maximum: 168 },
      performance: { processingTimeout: 60 * 60 * 1000, batchSizeLimit: 1000, memoryLimitMB: 512 }
    });

    // BACKFILL processing - relaxed standards for historical data
    modeMap.set('BACKFILL', {
      completeness: { critical: 0.90, warning: 0.80, minimum: 0.70 },
      freshness: { critical: 168, warning: 336, maximum: 2160 }, // Up to 90 days old
      performance: { processingTimeout: 120 * 60 * 1000, batchSizeLimit: 500, memoryLimitMB: 1024 }
    });

    // INCREMENTAL processing - strict standards for delta updates
    modeMap.set('INCREMENTAL', {
      completeness: { critical: 0.99, warning: 0.97, minimum: 0.95 },
      consistency: { critical: 0.99, warning: 0.97, crossReference: 0.98 },
      freshness: { critical: 1, warning: 6, maximum: 12 },
      performance: { processingTimeout: 10 * 60 * 1000, batchSizeLimit: 100, memoryLimitMB: 128 }
    });

    return modeMap;
  }

  /**
   * Merge threshold objects with deep override
   */
  private mergeThresholds(base: QualityThresholds, overrides: Partial<QualityThresholds>): QualityThresholds {
    const merged = { ...base };

    if (overrides.completeness) {
      merged.completeness = { ...merged.completeness, ...overrides.completeness };
    }
    if (overrides.consistency) {
      merged.consistency = { ...merged.consistency, ...overrides.consistency };
    }
    if (overrides.accuracy) {
      merged.accuracy = { ...merged.accuracy, ...overrides.accuracy };
    }
    if (overrides.freshness) {
      merged.freshness = { ...merged.freshness, ...overrides.freshness };
    }
    if (overrides.performance) {
      merged.performance = { ...merged.performance, ...overrides.performance };
    }

    return merged;
  }
}

// Export singleton instance
export const qualityConfig = QualityConfig.getInstance();