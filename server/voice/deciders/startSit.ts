/**
 * Start/Sit Decision Logic
 * Uses RAG color, expected points, and position thresholds
 */

import type { PlayerWeekFacts, DecisionResult } from '../types';

export function decideStartSit(player: PlayerWeekFacts): DecisionResult {
  // Strong GREEN with solid expected points: Start
  if (player.rag_color === 'GREEN' && player.expected_points >= (player.posBenchline || 10)) {
    return { 
      verdict: 'Start', 
      conf: Math.min(85, 60 + confFromSpread(player)) 
    };
  }
  
  // RED or OUT: Bench
  if (player.rag_color === 'RED' || player.availability_flag === 'OUT') {
    return { verdict: 'Bench', conf: 90 };
  }
  
  // Injury concerns
  if (player.availability < 70) {
    return { verdict: 'Bench (injury risk)', conf: 75 };
  }
  
  // AMBER: depends on context
  if (player.rag_color === 'AMBER') {
    // Strong recent performance or favorable matchup
    if ((player.beat_proj && player.beat_proj >= 60) || (player.opp_multiplier && player.opp_multiplier > 1.05)) {
      return { verdict: 'Start (thin margin)', conf: 65 };
    }
    
    // Below position threshold
    if (player.expected_points < (player.posBenchline || 10)) {
      return { verdict: 'Bench', conf: 70 };
    }
    
    return { verdict: 'Start (risky)', conf: 55 };
  }
  
  // Fallback for unclear cases
  return { verdict: 'Neutral / Game-time decision', conf: 50 };
}

// Calculate confidence based on ceiling-floor spread
function confFromSpread(player: PlayerWeekFacts): number {
  const spread = player.ceiling_points - player.floor_points;
  if (spread <= 5) return 25; // High confidence, narrow range
  if (spread <= 8) return 15; // Medium confidence
  if (spread <= 12) return 10; // Lower confidence
  return 5; // Wide range, low confidence
}