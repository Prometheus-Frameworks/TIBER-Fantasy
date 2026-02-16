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
 * v1.4: Scoring format options for PPR/Dynasty adjustments
 */
export type LeagueType = 'redraft' | 'dynasty';
export type PPRType = '0.5' | '1'; // Half-PPR or Full PPR

/**
 * Scoring options that affect Alpha calculation
 * - PPR: Adjusts efficiency subscore based on receptions (rec-heavy players get boost in full PPR)
 * - Dynasty: Applies age multiplier (young players get boost, old players get penalty)
 */
export interface ForgeScoreOptions {
  leagueType: LeagueType;
  pprType: PPRType;
}

/**
 * Default scoring options (Redraft + Full PPR)
 */
export const DEFAULT_SCORE_OPTIONS: ForgeScoreOptions = {
  leagueType: 'redraft',
  pprType: '1',
};

/**
 * Dynasty age multiplier constants
 * - Under 27: 1.1 (10% boost for youth)
 * - Over 27: 0.95^(age-27) (compounding 5% penalty per year over 27)
 * - Default age (if unknown): 26 (neutral)
 */
export const DYNASTY_AGE_CONFIG = {
  YOUTH_THRESHOLD: 27,
  YOUTH_MULTIPLIER: 1.1,
  DECAY_BASE: 0.95,
  DEFAULT_AGE: 26,
};

/**
 * FORGE Sub-Scores (0-100 each)
 * These are the component scores that combine into the final Alpha
 */
export interface ForgeSubScores {
  volume: number;        // Usage / opportunity metrics
  efficiency: number;    // Production per opportunity
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
 * Fantasy stats for Tiber Tiers display
 * v1.2: Added for enhanced fantasy rankings UI
 * v1.5: Added recTds, xFpts, fpoe for advanced columns
 */
export interface FantasyStats {
  seasonFptsPpr: number;      // Season total fantasy points (PPR)
  seasonFptsHalf: number;     // Season total fantasy points (Half-PPR)
  ppgPpr: number;             // Points per game (PPR)
  ppgHalf: number;            // Points per game (Half-PPR)
  last3AvgPpr: number;        // Last 3 games average (PPR)
  last3AvgHalf: number;       // Last 3 games average (Half-PPR)
  targets?: number;           // Season total targets (WR/TE/RB)
  touches?: number;           // Season total touches (rush att + targets for RB)
  receptions?: number;        // Season total receptions
  recTds?: number;            // v1.5: Season receiving touchdowns
  snapPct?: number;           // Average snap percentage
  rzOpps?: number;            // Red zone opportunities
  xFpts?: number;             // v1.5: Expected fantasy points (NFLfastR model)
  fpoe?: number;              // v1.5: Fantasy Points Over Expected (actual - xFpts)
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
  age?: number;               // v1.4: Player age for dynasty adjustments
  
  alpha: number;              // Final calibrated score (0-100)
  rawAlpha?: number;          // Pre-calibration engine score (for debugging)
  subScores: ForgeSubScores;
  trajectory: Trajectory;
  confidence: number;         // 0-100, how reliable this score is
  
  gamesPlayed: number;        // Games played this season (for context)
  
  fpr?: FPRData;              // Fibonacci Pattern Resonance data
  
  fantasyStats?: FantasyStats; // v1.2: Fantasy stats for Tiber Tiers
  
  nextMatchup?: {             // v1.7: Next week's matchup info for DvP column
    opponent: string;
    dvpRank: number;          // 1-32, lower = easier matchup
    isHome: boolean;
  };
  
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
 * 
 * Note: roleLeverage removed in v0.2 - weights redistributed proportionally
 */
export interface AlphaWeights {
  volume: number;
  efficiency: number;
  stability: number;
  contextFit: number;
}

/**
 * Position-specific alpha weights per the spec
 * 
 * v0.2: roleLeverage removed - weights redistributed proportionally:
 * - WR: removed 0.18, redistributed to volume(+0.08), efficiency(+0.07), stability(+0.03)
 * - RB: removed 0.20, redistributed to volume(+0.095), efficiency(+0.06), stability(+0.03), contextFit(+0.015)
 * - TE: removed 0.25, redistributed to volume(+0.10), efficiency(+0.09), stability(+0.03), contextFit(+0.03)
 * - QB: removed 0.15, redistributed to volume(+0.04), efficiency(+0.06), stability(+0.02), contextFit(+0.03)
 */
export const ALPHA_WEIGHTS: Record<PlayerPosition, AlphaWeights> = {
  WR: {
    volume: 0.43,      // was 0.35
    efficiency: 0.37,  // was 0.30
    stability: 0.15,   // was 0.12
    contextFit: 0.05,  // unchanged
  },
  RB: {
    volume: 0.475,     // was 0.38
    efficiency: 0.31,  // was 0.25
    stability: 0.15,   // was 0.12
    contextFit: 0.065, // was 0.05
  },
  TE: {
    volume: 0.40,      // was 0.30
    efficiency: 0.37,  // was 0.28
    stability: 0.13,   // was 0.10
    contextFit: 0.10,  // was 0.07
  },
  QB: {
    volume: 0.29,      // was 0.25
    efficiency: 0.41,  // was 0.35
    stability: 0.12,   // was 0.10
    contextFit: 0.18,  // was 0.15
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
  age?: number;  // v1.4: Player age for dynasty adjustments
  
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
  
  // v1.5: Expected fantasy points data from NFLfastR models
  xFptsData?: {
    totalXFpts: number;       // Season total expected fantasy points
    totalActual: number;      // Season total actual fantasy points
    totalFpoe: number;        // Total fantasy points over expected
    avgFpoe: number;          // Average FPOE per game
    gamesWithData: number;    // Games with xFPTS data available
  };
}

/**
 * Normalized feature bundle ready for scoring
 * All values are 0-100 percentile-based unless noted
 * 
 * v0.2: roleLeverageFeatures removed - underlying data wasn't connected
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
  LESS_THAN_3_GAMES: 75,
  LESS_THAN_3_GAMES_CONFIDENCE: 45,
} as const;

/**
 * Position-specific efficiency caps
 * QBs can hit 100 (no cap), skill positions capped at 85
 */
export const EFFICIENCY_CAPS: Record<PlayerPosition, number> = {
  QB: 100,
  RB: 85,
  WR: 85,
  TE: 85,
} as const;

/**
 * Tiber Tiers 2025 - Position-specific Alpha thresholds
 * 
 * T1 = Elite, T2 = Quality Starter, T3 = Flex/Depth, T4 = Rosterable, T5 = Waiver Wire
 * 
 * v1.1 UPDATE (Dec 2025): Recalibrated for multi-week aggregation fix.
 * Thresholds lowered to match the new 25-95 calibration range.
 */
export const TIBER_TIERS_2025 = {
  QB: { T1: 70, T2: 55, T3: 42, T4: 32 },  // Lowered to match calibrated QB range (max ~74)
  RB: { T1: 78, T2: 68, T3: 55, T4: 42 },
  WR: { T1: 82, T2: 72, T3: 58, T4: 45 },
  TE: { T1: 82, T2: 70, T3: 55, T4: 42 },
} as const;

export type TiberTierLevel = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

/**
 * Weekly Mover Rules for Tiber Tiers
 */
export const TIER_MOVER_RULES = {
  MAX_TIER_CHANGE_PER_WEEK: 1,
  MAX_MATCHUP_BOOST: 10,
  MAX_MATCHUP_PENALTY: -10,
  BOTTOM_OFFENSE_MAX_BOOST: 4,  // Bottom-8 team in offensive EPA/play
  LOW_SNAP_PROJECTION_THRESHOLD: 0.60,  // 60% projected snaps
  ELITE_THRESHOLD: 85,  // Season Alpha >= 85 = true elite
  ELITE_MAX_DROP: 6,    // Elites max -6 points (never drop out of T1)
} as const;

/**
 * Tiber Tier assignment result
 */
export interface TiberTierAssignment {
  tier: TiberTierLevel;
  alpha: number;
  weeklyAlpha?: number;  // Matchup-adjusted alpha
  previousTier?: TiberTierLevel;
  tierChange?: number;   // +1, 0, -1
  isElite: boolean;
  moveConstrained: boolean;
}

/**
 * Simplified feature bundle base type for client parity
 * This is the normalized output shape from all feature builders
 * 
 * v0.2: roleLeverage removed
 */
export interface ForgeFeatureBundleBase {
  volume: number;
  efficiency: number;
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
 * METHODOLOGY: Calibrated using CUMULATIVE season data (weeks 1-N aggregated)
 * with minGamesPlayed >= 4 filter. Uses observed raw alpha distributions to
 * map scores to a 25-95 calibrated scale for better elite differentiation.
 * 
 * v1.1 RECALIBRATION (Dec 2025): Updated for multi-week aggregation fix.
 * Previous calibration used single-snapshot data with p90~50; cumulative data
 * produces higher raw alphas (p90~60) requiring expanded calibration ranges.
 * 
 * WR calibrated based on 2025 season week 13 CUMULATIVE distribution:
 * - Observed: p10=35, p50=43, p90=57, max=63
 * - Spread: p10→max = 28 points
 * - Calibration maps p10(35)→25, max(65)→95
 * 
 * RB calibrated based on 2025 season week 13 CUMULATIVE distribution:
 * - Observed: p10=32, p50=42, p90=55, max=60
 * - Spread: p10→max = 28 points
 * - Calibration maps p10(32)→25, max(62)→95
 * 
 * TE calibrated based on 2025 season week 13 CUMULATIVE distribution:
 * - Observed: p10=33, p50=40, p90=52, max=58
 * - Spread: p10→max = 25 points
 * - Calibration maps p10(33)→25, max(58)→95
 * 
 * QB calibrated based on 2025 season week 13 CUMULATIVE distribution:
 * - Observed: p10=35, p50=40, p90=50, max=55
 * - Spread: p10→max = 20 points (QB scores cluster tighter)
 * - Calibration maps p10(35)→25, max(55)→95
 */
export const ALPHA_CALIBRATION: Partial<Record<PlayerPosition, CalibrationParams>> = {
  WR: {
    p10: 28,
    p90: 78,
    outMin: 25,
    outMax: 95,
  },
  RB: {
    p10: 28,
    p90: 64,
    outMin: 25,
    outMax: 95,
  },
  TE: {
    p10: 31,
    p90: 68,
    outMin: 25,
    outMax: 95,
  },
  QB: {
    p10: 30,
    p90: 73,
    outMin: 25,
    outMax: 95,
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
