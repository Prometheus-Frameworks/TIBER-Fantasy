/**
 * Trade Decision Logic
 * Uses market edge, trajectory, and health
 */

import type { PlayerWeekFacts, DecisionResult } from '../types';

export function decideTrade(player: PlayerWeekFacts, theirPlayer?: PlayerWeekFacts): DecisionResult {
  const edge = player.delta_vs_ecr || 0; // positive = we rank higher than consensus
  const rising = (player.power_score - (player.prev_power_score || player.power_score)) >= 3;
  const healthy = player.availability >= 70;
  
  // Strong edge + healthy = lean trade for
  if (edge >= 10 && healthy) {
    return { 
      verdict: 'Lean Trade For', 
      conf: Math.min(90, 70 + Math.min(20, edge))
    };
  }
  
  // Consensus way higher = lean trade away
  if (edge <= -10) {
    return { 
      verdict: 'Lean Trade Away', 
      conf: Math.min(90, 65 + Math.min(20, -edge))
    };
  }
  
  // Injury concerns override mild edges
  if (!healthy && Math.abs(edge) <= 5) {
    return { verdict: 'Trade Away (health)', conf: 75 };
  }
  
  // Rising trajectory gives slight boost
  const risingBonus = rising ? 5 : 0;
  
  // Medium edge cases
  if (edge >= 5) {
    return { verdict: 'Slight Trade For', conf: 60 + risingBonus };
  }
  
  if (edge <= -5) {
    return { verdict: 'Slight Trade Away', conf: 60 - risingBonus };
  }
  
  // Neutral zone
  return { 
    verdict: 'Neutral / Price Sensitive', 
    conf: 55 + risingBonus 
  };
}