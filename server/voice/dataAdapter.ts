/**
 * Data Adapter - Fetch player data from Power/RAG APIs
 * Combines multiple data sources into PlayerWeekFacts
 */

import axios from 'axios';
import type { PlayerWeekFacts } from './types';

const POWER_SERVICE_URL = process.env.POWER_SERVICE_URL || 'http://localhost:3001';

export async function fetchPlayerWeekBundle(
  playerId: string, 
  season: number, 
  week: number
): Promise<PlayerWeekFacts> {
  try {
    // Fetch from Power Rankings API
    const powerResponse = await axios.get(`${POWER_SERVICE_URL}/api/power/player/${playerId}?season=${season}`);
    const powerData = powerResponse.data;
    
    // Get current week data or most recent
    const weekData = powerData.history?.find((h: any) => h.week === week) || 
                     powerData.history?.[powerData.history.length - 1] || {};
    
    // Fetch FPG data for more detailed metrics
    let fpgData = null;
    try {
      const fpgResponse = await axios.get(`/api/power/fpg/player/${playerId}`);
      fpgData = fpgResponse.data;
    } catch (e) {
      // FPG data optional, continue without it
    }
    
    // Build comprehensive PlayerWeekFacts
    const player: PlayerWeekFacts = {
      player_id: playerId,
      name: powerData.name || weekData.name || playerId,
      position: powerData.position || weekData.position || 'UNKNOWN',
      team: powerData.team || weekData.team || 'UNKNOWN',
      
      // Power Rankings data
      power_score: weekData.power_score || weekData.score || 50,
      rank: weekData.rank || 999,
      prev_power_score: getPreviousWeekScore(powerData.history, week),
      delta_vs_ecr: weekData.delta_vs_ecr || 0,
      
      // RAG System data (from FPG or fallback)
      rag_score: fpgData?.rag_score || weekData.rag_score || deriveRagScore(weekData.power_score || 50),
      rag_color: fpgData?.rag_color || weekData.rag_color || deriveRagColor(fpgData?.rag_score || weekData.rag_score || 50),
      floor_points: fpgData?.floor_points || weekData.floor_points || estimateFloor(weekData.power_score || 50, powerData.position),
      ceiling_points: fpgData?.ceiling_points || weekData.ceiling_points || estimateCeiling(weekData.power_score || 50, powerData.position),
      expected_points: fpgData?.expected_points || weekData.expected_points || estimateExpected(weekData.power_score || 50, powerData.position),
      
      // Usage & matchup data
      upside_index: fpgData?.upside_index || weekData.upside_index,
      availability: weekData.availability || fpgData?.availability || 100,
      availability_flag: weekData.availability_flag || fpgData?.availability_flag || 'HEALTHY',
      opp_multiplier: weekData.opp_multiplier || fpgData?.opp_multiplier,
      beat_proj: weekData.beat_proj || fpgData?.beat_proj,
      
      // Position-specific thresholds
      posBenchline: getPositionThreshold(powerData.position || 'FLEX')
    };
    
    return player;
    
  } catch (error) {
    console.error(`Failed to fetch data for ${playerId}:`, error);
    
    // Return minimal fallback data
    return {
      player_id: playerId,
      name: playerId,
      position: 'UNKNOWN',
      team: 'UNKNOWN',
      power_score: 50,
      rank: 999,
      rag_score: 50,
      rag_color: 'AMBER',
      floor_points: 8,
      ceiling_points: 15,
      expected_points: 11,
      availability: 100,
      posBenchline: 10
    };
  }
}

// Helper functions
function getPreviousWeekScore(history: any[], currentWeek: number): number | undefined {
  if (!history) return undefined;
  const prevWeek = history.find(h => h.week === currentWeek - 1);
  return prevWeek?.power_score || prevWeek?.score;
}

function deriveRagScore(powerScore: number): number {
  // Convert power score (0-100) to RAG score (0-100)
  return Math.max(0, Math.min(100, powerScore));
}

function deriveRagColor(ragScore: number): 'GREEN' | 'AMBER' | 'RED' {
  if (ragScore >= 65) return 'GREEN';
  if (ragScore >= 45) return 'AMBER';
  return 'RED';
}

function estimateFloor(powerScore: number, position?: string): number {
  const baseFloor = position === 'QB' ? 12 : position === 'RB' ? 8 : position === 'WR' ? 6 : position === 'TE' ? 4 : 8;
  return baseFloor + (powerScore - 50) * 0.15;
}

function estimateCeiling(powerScore: number, position?: string): number {
  const baseCeiling = position === 'QB' ? 28 : position === 'RB' ? 22 : position === 'WR' ? 25 : position === 'TE' ? 18 : 20;
  return baseCeiling + (powerScore - 50) * 0.25;
}

function estimateExpected(powerScore: number, position?: string): number {
  const baseExpected = position === 'QB' ? 18 : position === 'RB' ? 14 : position === 'WR' ? 13 : position === 'TE' ? 9 : 12;
  return baseExpected + (powerScore - 50) * 0.2;
}

function getPositionThreshold(position: string): number {
  // Weekly startable thresholds by position
  switch (position) {
    case 'QB': return 15;
    case 'RB': return 10;
    case 'WR': return 8;
    case 'TE': return 6;
    default: return 10;
  }
}