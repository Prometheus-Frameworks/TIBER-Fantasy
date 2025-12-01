/**
 * FORGE v0.1 - Types
 * Football Oriented Recursive Grading Engine
 * 
 * Core type definitions for the FORGE scoring system.
 * All scores are 0-100 unless otherwise noted.
 * 
 * Client-facing type aliases are exported at the bottom
 * to ensure server/client type parity.
 */

export type PlayerPosition = 'WR' | 'RB' | 'TE' | 'QB';

export type WeekOrPreseason = number | 'preseason';

export type Trajectory = 'rising' | 'flat' | 'declining';

export type ForgePosition = PlayerPosition;

export type ForgeTrajectory = Trajectory;

/**
 * FORGE Sub-Scores (0-100 each)
 * These are the component scores that combine into the final Alpha
 */
export interface ForgeSubScores {
  volume: number;        // Usage / opportunity metrics
  efficiency: number;    // Production per opportunity
  roleLeverage: number;  // Role quality / high-leverage situation usage
  stability: number;     // Consistency / floor-ceiling balance
  contextFit: number;    // Team environment / matchup quality
}

/**
 * FPR (Fibonacci Pattern Resonance) types
 * Used for pattern-based volatility and confidence analysis
 */
export type FPRPatternType = 'FIB_GROWTH' | 'FIB_DECAY' | 'FIB_STABLE' | 'UNDEFINED';
export type FPRResonanceBand = 'HIGH_RESONANCE' | 'MEDIUM' | 'LOW' | 'NOISE';

export interface FPRData {
  score: number;
  pattern: FPRPatternType;
  band: FPRResonanceBand;
  forgeConfidenceModifier: number;
  forgeVolatilityIndex: number;
}

/**
 * The complete FORGE score output for a player
 */
export interface ForgeScore {
  playerId: string;           // Canonical player ID
  playerName: string;         // Display name
  position: PlayerPosition;
  nflTeam?: string;
  season: number;
  asOfWeek: WeekOrPreseason;
  
  alpha: number;              // Final calibrated score (0-100)
  rawAlpha?: number;          // Pre-calibration engine score (for debugging)
  subScores: ForgeSubScores;
  trajectory: Trajectory;
  confidence: number;         // 0-100, how reliable this score is
  
  gamesPlayed: number;        // Games played this season (for context)
  
  fpr?: FPRData;              // Fibonacci Pattern Resonance data
  
  dataQuality: {
    hasAdvancedStats: boolean;
    hasSnapData: boolean;
    hasDvPData: boolean;
    hasEnvironmentData: boolean;
    cappedDueToMissingData: boolean;
  };
  
  scoredAt: Date;
}

/**
 * Alpha weights by position (must sum to 1.0)
 */
export interface AlphaWeights {
  volume: number;
  efficiency: number;
  roleLeverage: number;
  stability: number;
  contextFit: number;
}

/**
 * Position-specific alpha weights per the spec
 */
export const ALPHA_WEIGHTS: Record<PlayerPosition, AlphaWeights> = {
  WR: {
    volume: 0.35,
    efficiency: 0.30,
    roleLeverage: 0.18,
    stability: 0.12,
    contextFit: 0.05,
  },
  RB: {
    volume: 0.38,
    efficiency: 0.25,
    roleLeverage: 0.20,
    stability: 0.12,
    contextFit: 0.05,
  },
  TE: {
    volume: 0.30,
    efficiency: 0.28,
    roleLeverage: 0.25,
    stability: 0.10,
    contextFit: 0.07,
  },
  QB: {
    volume: 0.25,
    efficiency: 0.35,
    roleLeverage: 0.15,
    stability: 0.10,
    contextFit: 0.15,
  },
};

/**
 * Raw context data pulled from various services
 * This is the input to the feature builders
 */
export interface ForgeContext {
  playerId: string;
  playerName: string;
  position: PlayerPosition;
  nflTeam?: string;
  season: number;
  asOfWeek: WeekOrPreseason;
  
  identity: {
    canonicalId: string;
    sleeperId?: string;
    nflDataPyId?: string;
    isActive: boolean;
  };
  
  seasonStats: {
    gamesPlayed: number;
    gamesStarted: number;
    snapCount: number;
    snapShare: number;
    fantasyPointsPpr: number;
    fantasyPointsHalfPpr: number;
    targets?: number;
    receptions?: number;
    receivingYards?: number;
    receivingTds?: number;
    rushAttempts?: number;
    rushYards?: number;
    rushTds?: number;
    passingAttempts?: number;
    passingYards?: number;
    passingTds?: number;
    interceptions?: number;
    targetShare?: number;
    airYards?: number;
    redZoneTargets?: number;
    redZoneCarries?: number;
  };
  
  advancedMetrics?: {
    yprr?: number;           // Yards per route run
    adot?: number;           // Average depth of target
    racr?: number;           // Receiver air conversion ratio
    wopr?: number;           // Weighted opportunity rating
    epaPerPlay?: number;
    epaPerTarget?: number;
    epaPerRush?: number;
    successRate?: number;
    catchRateOverExpected?: number;
    yardsPerCarry?: number;
    yardsAfterContact?: number;
    missedTacklesForced?: number;
    cpoe?: number;           // Completion % over expected (QB)
    aypa?: number;           // Adjusted yards per attempt (QB)
  };
  
  weeklyStats: Array<{
    week: number;
    fantasyPointsPpr: number;
    snapShare?: number;
    targets?: number;
    receptions?: number;
    rushAttempts?: number;
  }>;
  
  roleMetrics?: {
    routeRate?: number;        // routes / snaps
    slotRate?: number;         // % of routes from slot
    deepTargetShare?: number;  // aDOT > 15
    redZoneRouteShare?: number;
    backfieldTouchShare?: number;
    goalLineWorkRate?: number;
    thirdDownSnapPct?: number;
    receivingWorkRate?: number;
    designedRushShare?: number;  // QB
    goalLineRushShare?: number;  // QB
  };
  
  teamEnvironment?: {
    team: string;
    passAttemptsPerGame?: number;
    rushAttemptsPerGame?: number;
    pace?: number;
    proe?: number;              // Pass rate over expected
    olGrade?: number;
    qbStability?: number;
    redZoneEfficiency?: number;
    scoringEnvironment?: number;
    pacePct?: number;
    proePct?: number;
    olGradePct?: number;
  };
  
  dvpData?: {
    position: string;
    fantasyPtsAllowedPpr: number;
    rank: number;              // 1 = worst defense (best matchup), 32 = best defense
  };
  
  injuryStatus?: {
    hasRecentInjury: boolean;  // Within last 30 days
    gamesMissedLast2Years?: number;
  };
}

/**
 * Normalized feature bundle ready for scoring
 * All values are 0-100 percentile-based unless noted
 */
export interface ForgeFeatureBundle {
  position: PlayerPosition;
  gamesPlayed: number;
  
  volumeFeatures: {
    raw: Record<string, number | undefined>;
    normalized: Record<string, number>;  // 0-100 percentile
    score: number;  // Weighted sub-score
  };
  
  efficiencyFeatures: {
    raw: Record<string, number | undefined>;
    normalized: Record<string, number>;
    score: number;
    capped: boolean;  // True if capped due to missing advanced stats
  };
  
  roleLeverageFeatures: {
    raw: Record<string, number | undefined>;
    normalized: Record<string, number>;
    score: number;
    capped: boolean;
  };
  
  stabilityFeatures: {
    weeklyPpgStdDev?: number;
    floorWeekRate: number;    // % weeks > threshold
    boomWeekRate: number;     // % weeks > high threshold
    score: number;
  };
  
  contextFitFeatures: {
    raw: Record<string, number | undefined>;
    normalized: Record<string, number>;
    score: number;
    isNeutral: boolean;  // True if defaulted to 50 due to missing data
  };
  
  dataQuality: {
    hasAdvancedStats: boolean;
    hasSnapData: boolean;
    hasDvPData: boolean;
    hasEnvironmentData: boolean;
  };
}

/**
 * Service interface for FORGE
 */
export interface IForgeService {
  getForgeScoreForPlayer(
    playerId: string,
    season: number,
    asOfWeek: WeekOrPreseason
  ): Promise<ForgeScore>;
  
  getForgeScoresForPlayers(
    playerIds: string[],
    season: number,
    asOfWeek: WeekOrPreseason
  ): Promise<ForgeScore[]>;
}

/**
 * Thresholds for trajectory calculation
 */
export const TRAJECTORY_THRESHOLDS = {
  RISING: 6,    // delta >= +6 = rising
  DECLINING: -6 // delta <= -6 = declining
} as const;

/**
 * Confidence calculation constants
 */
export const CONFIDENCE_CONFIG = {
  BASE_PER_GAME: 8,       // base = min(100, games * 8)
  MAX_BASE: 100,
  MIN_FINAL: 20,
  MAX_FINAL: 100,
  ADJUSTMENTS: {
    LESS_THAN_4_GAMES: -30,
    LESS_THAN_6_GAMES: -15,
    RECENT_INJURY: -20,
    HIGH_VOLATILITY: -15,    // std_dev > 1.8x position avg
    MISSING_SNAPS: -10,
    MISSING_DVP: -5,
  }
} as const;

/**
 * Sub-score caps when data is missing
 */
export const MISSING_DATA_CAPS = {
  NO_ADVANCED_STATS_EFFICIENCY: 80,
  NO_SNAP_DATA_VOLUME: 75,
  NO_SNAP_DATA_ROLE: 75,
  LESS_THAN_3_GAMES: 75,
  LESS_THAN_3_GAMES_CONFIDENCE: 45,
} as const;

/**
 * Simplified feature bundle base type for client parity
 * This is the normalized output shape from all feature builders
 */
export interface ForgeFeatureBundleBase {
  volume: number;
  efficiency: number;
  roleLeverage: number;
  stability: number;
  contextFit: number;
}

/**
 * Alpha Calibration Configuration
 * 
 * Used to remap raw engine scores to a more intuitive 0-100 scale.
 * The calibration is a linear monotonic transformation based on observed 
 * distribution percentiles from the 2025 season data.
 * 
 * p10/p90 are observed from running `/api/forge/debug/distribution?position=X`
 * outMin/outMax define the target calibrated output range.
 */
export interface CalibrationParams {
  p10: number;    // 10th percentile of rawAlpha for that position
  p90: number;    // 90th percentile of rawAlpha for that position
  outMin: number; // Output min on the calibrated scale
  outMax: number; // Output max on the calibrated scale
}

/**
 * Position-specific calibration configs
 * 
 * METHODOLOGY: Filtered distributions (minGamesPlayed >= 4) to exclude
 * low-data players hitting placeholder scores. Uses p97 as upper bound for
 * WR/RB to allow differentiation among elite players (top 3-5%), and p95
 * for TE/QB which have narrower distributions.
 * 
 * WR calibrated based on 2025 season week 10 FILTERED distribution:
 * - Filtered: count=123, p10=34.8, p50=39.8, p90=45.9, p95=47.4, p97=50.2, max=54.9
 * - Spread: p10→p97 = 15.4 points
 * - Calibration maps p10(35)→25, p97(50)→90
 * 
 * RB calibrated based on 2025 season week 10 FILTERED distribution:
 * - Filtered: count=93, p10=31.9, p50=38.2, p90=47.8, p95=50.5, p97=52.1, max=55.7
 * - Spread: p10→p97 = 20.2 points
 * - Calibration maps p10(32)→25, p97(52)→90
 * 
 * TE calibrated based on 2025 season week 10 FILTERED distribution:
 * - Filtered: count=75, p10=33.2, p50=38.8, p90=44.9, p95=46.5, p97=46.7, max=49.1
 * - Spread: p10→p95 = 13.3 points (narrow elite tier)
 * - Calibration maps p10(33)→25, p95(47)→90
 * 
 * QB calibrated based on 2025 season week 10 FILTERED distribution:
 * - Filtered: count=37, p10=40.5, p50=42.8, p90=47.6, p95=48.4, p97=48.4, max=49.3
 * - Spread: p10→p95 = 7.9 points (narrowest - QB scores cluster tightly)
 * - Calibration maps p10(40)→25, p95(48)→90
 */
export const ALPHA_CALIBRATION: Partial<Record<PlayerPosition, CalibrationParams>> = {
  WR: {
    p10: 35,      // WR 2025 filtered p10 rawAlpha
    p90: 50,      // WR 2025 filtered p97 rawAlpha (using p97 for better elite spread)
    outMin: 25,   // Calibrated floor for low-tier WRs
    outMax: 90,   // Calibrated ceiling for elite WRs
  },
  RB: {
    p10: 32,      // RB 2025 filtered p10 rawAlpha (rounded from 31.9)
    p90: 52,      // RB 2025 filtered p97 rawAlpha (using p97 for better elite spread)
    outMin: 25,   // Calibrated floor for depth/committee backs
    outMax: 90,   // Calibrated ceiling for elite RBs
  },
  TE: {
    p10: 33,      // TE 2025 filtered p10 rawAlpha (rounded from 33.2)
    p90: 47,      // TE 2025 filtered p95 rawAlpha (using p95 as upper bound)
    outMin: 25,   // Calibrated floor for depth TEs
    outMax: 90,   // Calibrated ceiling for elite TEs
  },
  QB: {
    p10: 40,      // QB 2025 filtered p10 rawAlpha (rounded from 40.5)
    p90: 48,      // QB 2025 filtered p95 rawAlpha (using p95 as upper bound)
    outMin: 25,   // Calibrated floor for backup QBs
    outMax: 90,   // Calibrated ceiling for elite fantasy QBs
  },
};

// ========================================
// FORGE TEAM ENVIRONMENT + MATCHUP CONTEXT
// ========================================

/**
 * Team Environment types for fantasy-relevance scoring
 */
export interface TeamEnvironment {
  season: number;
  week: number;
  team: string;
  envScore100: number;  // 0-100, 50 = league average
  
  // Optional raw metrics for debugging
  metrics?: {
    qbCpoe?: number;
    qbEpaPerDropback?: number;
    neutralPassRate?: number;
    proe?: number;
    pressureRateAllowed?: number;
    sackRateAllowed?: number;
    ppg?: number;
    rzPossessionsPerGame?: number;
  };
}

/**
 * Matchup Context types for position-specific defensive matchups
 */
export interface MatchupContext {
  season: number;
  week: number;
  offenseTeam: string;
  defenseTeam: string;
  position: PlayerPosition;
  matchupScore100: number;  // 0-100, 50 = neutral matchup
  
  // Optional raw metrics for debugging
  metrics?: {
    defPassEpaPerAttempt?: number;
    defRushEpaPerRush?: number;
    defPressureRate?: number;
    defYacPerCompletion?: number;
    defExplosivePassRateAllowed?: number;
    defExplosiveRushRateAllowed?: number;
    fantasyPtsAllowedPerGame?: number;
  };
}

/**
 * FORGE Modifier Weights
 * Controls how strongly env/matchup affect rawAlpha
 */
export interface ForgeModifierWeights {
  w_env: number;   // Environment weight (0-1)
  w_mu: number;    // Matchup weight (0-1)
}

export const DEFAULT_FORGE_MODIFIER_WEIGHTS: ForgeModifierWeights = {
  w_env: 0.40,  // ±40% at extreme env scores
  w_mu: 0.25,   // ±25% at extreme matchup scores
};
