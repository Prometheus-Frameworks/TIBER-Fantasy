/**
 * Position Distribution Calculator
 * 
 * Calculates league-relative statistics for RAG scoring calibration
 * Ensures GREEN/AMBER/RED thresholds are position-aware
 */

import { calculatePositionDistribution } from './rag';

export interface PositionStats {
  position: 'QB' | 'RB' | 'WR' | 'TE';
  season: number;
  week: number;
  median: number;     // Median FPG for position this week
  std: number;        // Standard deviation of FPG 
  p40: number;        // 40th percentile (GREEN threshold)
  count: number;      // Number of players analyzed
  distribution: {
    min: number;
    max: number;
    p25: number;     // 25th percentile
    p75: number;     // 75th percentile
  };
  last_updated: string;
}

/**
 * Calculate position statistics for RAG calibration
 * @param players Array of player facts for the position
 * @param position Position to analyze
 * @param season Season year
 * @param week Week number
 * @returns Position statistics
 */
export function getPositionDistribution(
  players: any[],
  position: 'QB' | 'RB' | 'WR' | 'TE',
  season: number,
  week: number
): PositionStats {
  
  // Extract FPG values (prefer xfpg, fallback to proj_fpg, then fpg)
  const extractFPG = (player: any): number => {
    return player.xfpg || player.proj_fpg || player.fpg || 0;
  };
  
  const stats = calculatePositionDistribution(players, extractFPG);
  
  // Calculate additional percentiles for distribution
  const fpgValues = players
    .map(extractFPG)
    .filter(fpg => fpg > 0)
    .sort((a, b) => a - b);
  
  const getPercentile = (pct: number): number => {
    if (fpgValues.length === 0) return 0;
    const index = Math.floor(pct * fpgValues.length);
    return fpgValues[Math.min(index, fpgValues.length - 1)] || 0;
  };
  
  return {
    position,
    season,
    week,
    median: stats.median,
    std: stats.std,
    p40: stats.p40,
    count: stats.count,
    distribution: {
      min: fpgValues[0] || 0,
      max: fpgValues[fpgValues.length - 1] || 0,
      p25: getPercentile(0.25),
      p75: getPercentile(0.75)
    },
    last_updated: new Date().toISOString()
  };
}

/**
 * Get cached position statistics or calculate fresh
 * @param position Position to get stats for
 * @param season Season year
 * @param week Week number
 * @param allPlayerFacts All player facts for calculation
 * @returns Position statistics
 */
export async function getPositionStats(
  position: 'QB' | 'RB' | 'WR' | 'TE',
  season: number,
  week: number,
  allPlayerFacts: any[]
): Promise<PositionStats> {
  
  // Filter to position players
  const positionPlayers = allPlayerFacts.filter(p => p.position === position);
  
  // Calculate fresh statistics
  return getPositionDistribution(positionPlayers, position, season, week);
}

/**
 * Get all position statistics for the week
 * @param season Season year
 * @param week Week number  
 * @param allPlayerFacts All player facts
 * @returns Statistics for all positions
 */
export async function getAllPositionStats(
  season: number,
  week: number,
  allPlayerFacts: any[]
): Promise<Record<string, PositionStats>> {
  
  const positions: Array<'QB' | 'RB' | 'WR' | 'TE'> = ['QB', 'RB', 'WR', 'TE'];
  
  const results: Record<string, PositionStats> = {};
  
  for (const position of positions) {
    results[position] = await getPositionStats(position, season, week, allPlayerFacts);
  }
  
  return results;
}

/**
 * Fallback position statistics when no data available
 */
export const FALLBACK_POSITION_STATS: Record<string, Omit<PositionStats, 'position' | 'season' | 'week' | 'last_updated'>> = {
  QB: {
    median: 18.0,
    std: 5.0,
    p40: 15.0,
    count: 0,
    distribution: { min: 8, max: 30, p25: 14, p75: 22 }
  },
  RB: {
    median: 12.0,
    std: 4.5,
    p40: 10.0,
    count: 0,
    distribution: { min: 4, max: 25, p25: 8, p75: 16 }
  },
  WR: {
    median: 10.0,
    std: 4.0,
    p40: 8.0,
    count: 0,
    distribution: { min: 3, max: 22, p25: 7, p75: 13 }
  },
  TE: {
    median: 8.0,
    std: 3.5,
    p40: 6.5,
    count: 0,
    distribution: { min: 2, max: 18, p25: 5, p75: 11 }
  }
} as const;