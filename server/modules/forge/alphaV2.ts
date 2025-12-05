/**
 * FORGE Alpha V2 - 2025 Final Formula
 * 
 * Key changes from V1:
 * - Hard games-played floor (MIN_GAMES = 4)
 * - Recency bias (last 4 weeks = 65% of score)
 * - Rebalanced position weights (efficiency boosted for WR/TE/QB)
 * - Elite ceiling protection (true T1 never drops below 88)
 * - Calibrated output range: 25→95
 */

import { ForgeScore, PlayerPosition, ForgeSubScores } from './types';

const MIN_GAMES = 4;
const RECENCY_WEIGHT = 0.65;
const BASE_WEIGHT = 0.35;

export interface EnrichedPlayerWeek {
  playerId: string;
  playerName: string;
  position: PlayerPosition;
  nflTeam?: string;
  games_played: number;
  raw_alpha: number;
  season_alpha: number;
  last_4_weeks_alpha?: number;
  subscores: {
    volume: number;
    efficiency: number;
    stability: number;
    context: number;
  };
}

export interface AlphaV2Result {
  playerId: string;
  playerName: string;
  position: PlayerPosition;
  nflTeam?: string;
  gamesPlayed: number;
  alphaV2: number;
  alphaV1: number;
  delta: number;
  subscores: {
    volume: number;
    efficiency: number;
    stability: number;
    context: number;
  };
  flags: string[];
}

const POSITION_WEIGHTS: Record<PlayerPosition, { volume: number; efficiency: number; stability: number; context: number }> = {
  QB: { volume: 0.25, efficiency: 0.50, stability: 0.15, context: 0.10 },
  RB: { volume: 0.40, efficiency: 0.35, stability: 0.15, context: 0.10 },
  WR: { volume: 0.35, efficiency: 0.40, stability: 0.15, context: 0.10 },
  TE: { volume: 0.35, efficiency: 0.40, stability: 0.15, context: 0.10 },
};

export function calculateAlphaV2(player: EnrichedPlayerWeek): number {
  const games = player.games_played ?? 0;

  // 1. Hard games-played floor — no exceptions
  if (games < MIN_GAMES) {
    return Math.max(25, player.raw_alpha * (games / MIN_GAMES) * 0.85);
  }

  // 2. Recency bias — last 4 weeks dominate
  const recent = player.last_4_weeks_alpha ?? player.raw_alpha;
  const blended = (recent * RECENCY_WEIGHT) + (player.season_alpha * BASE_WEIGHT);

  // 3. Position-specific sub-score weights (2025 final)
  const weights = POSITION_WEIGHTS[player.position];

  // 4. Final Alpha — calibrated 25→95 (95+ reserved for GOAT seasons)
  const weightedSubscore = 
    (player.subscores.volume * weights.volume +
     player.subscores.efficiency * weights.efficiency +
     player.subscores.stability * weights.stability +
     player.subscores.context * weights.context) / 100;
  
  const final = blended * weightedSubscore;

  // 5. Elite ceiling protection
  if (player.season_alpha >= 90) {
    return Math.max(final, 88);
  }

  return Math.round(final * 10) / 10;
}

/**
 * Convert a ForgeScore (V1) to EnrichedPlayerWeek format for V2 calculation
 */
export function forgeScoreToEnrichedPlayer(score: ForgeScore, last4WeeksAlpha?: number): EnrichedPlayerWeek {
  return {
    playerId: score.playerId,
    playerName: score.playerName,
    position: score.position,
    nflTeam: score.nflTeam,
    games_played: score.gamesPlayed,
    raw_alpha: score.rawAlpha ?? score.alpha,
    season_alpha: score.alpha,
    last_4_weeks_alpha: last4WeeksAlpha,
    subscores: {
      volume: score.subScores.volume,
      efficiency: score.subScores.efficiency,
      stability: score.subScores.stability,
      context: score.subScores.contextFit,
    },
  };
}

/**
 * Calculate V2 Alpha for a ForgeScore and return enriched result
 */
export function calculateAlphaV2FromForgeScore(score: ForgeScore, last4WeeksAlpha?: number): AlphaV2Result {
  const enriched = forgeScoreToEnrichedPlayer(score, last4WeeksAlpha);
  const alphaV2 = calculateAlphaV2(enriched);
  const alphaV1 = score.alpha;
  const delta = alphaV2 - alphaV1;
  
  const flags: string[] = [];
  
  // Flag potential issues
  if (enriched.games_played < MIN_GAMES) {
    flags.push(`LOW_SAMPLE:${enriched.games_played}games`);
  }
  
  if (enriched.subscores.efficiency === 47.5 || enriched.subscores.efficiency === 50) {
    flags.push('EFF_DEFAULT');
  }
  
  if (enriched.subscores.context === 50) {
    flags.push('CTX_NEUTRAL');
  }
  
  if (Math.abs(delta) > 20) {
    flags.push(`BIG_DELTA:${delta > 0 ? '+' : ''}${delta.toFixed(1)}`);
  }
  
  // Flag if volume seems too dominant
  if (enriched.subscores.volume > 70 && enriched.subscores.efficiency < 50) {
    flags.push('HIGH_VOL_LOW_EFF');
  }
  
  return {
    playerId: score.playerId,
    playerName: score.playerName,
    position: score.position,
    nflTeam: score.nflTeam,
    gamesPlayed: enriched.games_played,
    alphaV2,
    alphaV1,
    delta,
    subscores: enriched.subscores,
    flags,
  };
}

/**
 * Batch calculate V2 Alpha for multiple ForgeScores
 */
export function batchCalculateAlphaV2(scores: ForgeScore[]): AlphaV2Result[] {
  return scores
    .map(score => calculateAlphaV2FromForgeScore(score))
    .sort((a, b) => b.alphaV2 - a.alphaV2);
}

export default calculateAlphaV2;
