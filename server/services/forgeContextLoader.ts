/**
 * ForgeContext Loader v0
 * 
 * Provides FORGE data to Tiber chat without making HTTP calls.
 * Calls underlying FORGE services directly.
 */

import { forgeService } from '../modules/forge/forgeService';
import { getPlayerSoS } from '../modules/forge/sosService';
import type { ForgeScore, PlayerPosition } from '../modules/forge/types';

// ========================================
// ForgeContext Types
// ========================================

export interface ForgePlayerContext {
  id: string;
  name: string;
  team: string;
  position: string;

  alpha: number;           // SoS-adjusted final FORGE alpha
  alphaBase?: number;      // pre-SoS alpha, if available

  envScore?: number;       // environment score if available
  matchupScore?: number;   // current or next-week matchup score if available

  sosRos?: number;         // 0–100
  sosNext3?: number;       // 0–100
  sosPlayoffs?: number;    // 0–100
  sosMultiplier?: number;  // 0.90–1.10

  subscores?: {
    volume?: number;
    efficiency?: number;
    stability?: number;
    contextFit?: number;
  };
}

export interface ForgeRankingsSnapshotPlayer {
  id: string;
  name: string;
  team: string;
  alpha: number;
  sosMultiplier?: number;
}

export interface ForgeRankingsSnapshot {
  position: string;
  players: ForgeRankingsSnapshotPlayer[];
}

export interface ForgeContext {
  player?: ForgePlayerContext;
  rankingsSnapshot?: ForgeRankingsSnapshot;
}

export interface ForgeContextInput {
  playerId?: string;       // canonical player id (e.g., 'puka-nacua')
  position?: string;       // 'WR' | 'RB' | 'TE' | 'QB'
  teamId?: string;         // optional, if helpful for SoS / team-level queries
  rankingsLimit?: number;  // default ~10
}

// ========================================
// SoS Multiplier Calculation (from routes.ts)
// ========================================

function applySosMultiplier(alpha: number, sosRos: number): { norm: number; multiplier: number; finalAlpha: number } {
  const norm = sosRos / 100;
  const multiplier = 0.90 + (norm * 0.20); // Range: 0.90 (hard schedule) to 1.10 (easy schedule)
  const finalAlpha = alpha * multiplier;
  return { norm, multiplier, finalAlpha };
}

// ========================================
// Main Loader Function
// ========================================

export async function loadForgeContext(input: ForgeContextInput): Promise<ForgeContext> {
  const { playerId, position, rankingsLimit = 10 } = input;
  const season = 2025;
  const asOfWeek = 17;

  const result: ForgeContext = {};

  // 1. Load player context if playerId is provided
  if (playerId) {
    try {
      const playerContext = await loadPlayerContext(playerId, season, asOfWeek);
      if (playerContext) {
        result.player = playerContext;
      }
    } catch (error) {
      console.error(`[ForgeContextLoader] Error loading player context for ${playerId}:`, error);
    }
  }

  // 2. Load rankings snapshot if position is provided
  if (position && ['WR', 'RB', 'TE', 'QB'].includes(position.toUpperCase())) {
    try {
      const snapshot = await loadRankingsSnapshot(
        position.toUpperCase() as PlayerPosition, 
        rankingsLimit, 
        season, 
        asOfWeek
      );
      if (snapshot) {
        result.rankingsSnapshot = snapshot;
      }
    } catch (error) {
      console.error(`[ForgeContextLoader] Error loading rankings snapshot for ${position}:`, error);
    }
  }

  return result;
}

// ========================================
// Helper: Load single player context
// ========================================

async function loadPlayerContext(
  playerId: string, 
  season: number, 
  asOfWeek: number
): Promise<ForgePlayerContext | null> {
  
  // Get FORGE score for this player
  const scores = await forgeService.getForgeScoresForPlayers([playerId], season, asOfWeek);
  
  if (scores.length === 0) {
    console.log(`[ForgeContextLoader] No FORGE score found for player ${playerId}`);
    return null;
  }

  const score = scores[0];
  
  // Get SoS data
  const sosData = await getPlayerSoS(playerId, season);
  const sosRos = sosData?.sos?.ros ?? 50;
  const sosNext3 = sosData?.sos?.next3 ?? 50;
  const sosPlayoffs = sosData?.sos?.playoffs ?? 50;

  // Apply SoS multiplier to get adjusted alpha
  const { multiplier, finalAlpha } = applySosMultiplier(score.alpha, sosRos);

  return {
    id: score.playerId,
    name: score.playerName,
    team: score.nflTeam ?? 'UNK',
    position: score.position,

    alpha: Math.round(finalAlpha * 10) / 10,
    alphaBase: score.alpha,

    sosRos: Math.round(sosRos * 10) / 10,
    sosNext3: Math.round(sosNext3 * 10) / 10,
    sosPlayoffs: sosPlayoffs !== null ? Math.round(sosPlayoffs * 10) / 10 : undefined,
    sosMultiplier: Math.round(multiplier * 1000) / 1000,

    subscores: {
      volume: score.subScores.volume,
      efficiency: score.subScores.efficiency,
      stability: score.subScores.stability,
      contextFit: score.subScores.contextFit,
    },
  };
}

// ========================================
// Helper: Load rankings snapshot for position
// ========================================

async function loadRankingsSnapshot(
  position: PlayerPosition,
  limit: number,
  season: number,
  asOfWeek: number
): Promise<ForgeRankingsSnapshot | null> {

  // Use batch endpoint logic directly
  const scores = await forgeService.getForgeScoresBatch({
    position,
    limit: Math.min(limit, 15),
    season,
    asOfWeek,
  });

  if (scores.length === 0) {
    return null;
  }

  // Enrich with SoS and build snapshot
  const players: ForgeRankingsSnapshotPlayer[] = [];

  for (const score of scores) {
    try {
      const sosData = await getPlayerSoS(score.playerId, season);
      const sosRos = sosData?.sos?.ros ?? 50;
      const { multiplier, finalAlpha } = applySosMultiplier(score.alpha, sosRos);

      players.push({
        id: score.playerId,
        name: score.playerName,
        team: score.nflTeam ?? 'UNK',
        alpha: Math.round(finalAlpha * 10) / 10,
        sosMultiplier: Math.round(multiplier * 1000) / 1000,
      });
    } catch (error) {
      // On error, include player without SoS adjustment
      players.push({
        id: score.playerId,
        name: score.playerName,
        team: score.nflTeam ?? 'UNK',
        alpha: score.alpha,
      });
    }
  }

  // Sort by alpha descending
  players.sort((a, b) => b.alpha - a.alpha);

  return {
    position,
    players: players.slice(0, limit),
  };
}
