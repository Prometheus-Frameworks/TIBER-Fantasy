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
 * For WR 2025 week 10 observed stats:
 * - min: 29.9, max: 51.1, p10: 29.9, p90: 43
 * - Top WRs (Chase, JSN, Amon-Ra) cluster around 48-51
 * 
 * Calibration maps:
 * - Raw floor (~30) → 25 (low/no-data tier)
 * - Raw ceiling (~52) → 90 (elite tier)
 * 
 * This spreads the compressed 30-52 raw range across a 25-90 calibrated range.
 */
export interface AlphaCalibrationConfig {
  rawFloor: number;       // Raw score floor (observed minimum for valid data)
  rawCeiling: number;     // Raw score ceiling (observed elite scores)
  calibratedFloor: number; // Target calibrated floor
  calibratedCeiling: number; // Target calibrated ceiling
  clampMin: number;       // Final output minimum
  clampMax: number;       // Final output maximum
}

/**
 * Position-specific calibration configs
 * 
 * WR is calibrated based on 2025 season week 10 distribution.
 * Other positions use pass-through (no calibration) until data is analyzed.
 */
export const ALPHA_CALIBRATION: Record<PlayerPosition, AlphaCalibrationConfig | null> = {
  WR: {
    rawFloor: 30,           // No-data floor
    rawCeiling: 52,         // Elite WR raw score
    calibratedFloor: 25,    // Calibrated no-data tier
    calibratedCeiling: 90,  // Calibrated elite tier
    clampMin: 0,
    clampMax: 100,
  },
  RB: null, // Pass-through (no calibration yet)
  TE: null, // Pass-through (no calibration yet)
  QB: null, // Pass-through (no calibration yet)
};
