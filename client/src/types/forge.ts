/**
 * FORGE v0.1 - Client Types
 * Football Oriented Recursive Grading Engine
 * 
 * Canonical shared types consumed by frontend modules:
 * - OVR, TIBER, Strategy, Weekly Takes
 * 
 * These match the server ForgeScore shape exactly.
 * No implementation - just types.
 */

export type ForgePosition = 'QB' | 'RB' | 'WR' | 'TE';

export type ForgeTrajectory = 'rising' | 'flat' | 'declining';

export interface ForgeSubScores {
  volume: number;        // 0-100
  efficiency: number;    // 0-100
  roleLeverage: number;  // 0-100
  stability: number;     // 0-100
  contextFit: number;    // 0-100
}

export interface ForgeDataQuality {
  hasAdvancedStats: boolean;
  hasSnapData: boolean;
  hasDvPData: boolean;
  hasEnvironmentData: boolean;
  cappedDueToMissingData: boolean;
}

export interface ForgeScore {
  playerId: string;
  playerName: string;
  position: ForgePosition;
  nflTeam?: string;
  season: number;
  asOfWeek: number | 'preseason';
  
  alpha: number;              // 0-100 overall calibrated score (SoS-adjusted)
  alphaBase?: number;         // 0-100 pre-SoS alpha score
  rawAlpha?: number;          // 0-100 pre-calibration engine score (for debugging)
  subScores: ForgeSubScores;
  trajectory: ForgeTrajectory;
  confidence: number;         // 0-100 confidence rating
  
  sosRos?: number;            // 0-100 Rest of Season SoS (higher = easier)
  sosNext3?: number;          // 0-100 Next 3 weeks SoS
  sosPlayoffs?: number;       // 0-100 Playoffs SoS (weeks 15-17)
  sosMultiplier?: number;     // 0.90-1.10 applied multiplier
  
  gamesPlayed: number;
  dataQuality: ForgeDataQuality;
  
  scoredAt: string;           // ISO date string from server
}

export interface ForgePreviewResponse {
  success: boolean;
  meta: {
    position: ForgePosition;
    season: number;
    week: number;
    requestedCount: number;
    returnedCount: number;
    scoredAt: string;
  };
  scores: ForgeScore[];
  error?: string;
}

export interface ForgeBatchResponse {
  success: boolean;
  meta: {
    position: ForgePosition | 'ALL';
    limit: number;
    season: number;
    week: number;
    count: number;
    scoredAt: string;
  };
  scores: ForgeScore[];
  error?: string;
}

export interface ForgeSingleScoreResponse {
  success: boolean;
  score?: ForgeScore;
  error?: string;
}

export interface ForgeHealthResponse {
  success: boolean;
  service: string;
  version: string;
  status: 'operational' | 'degraded' | 'offline';
  timestamp: string;
}

export interface ForgeFeatureBundle {
  volume: number;
  efficiency: number;
  roleLeverage: number;
  stability: number;
  contextFit: number;
}
