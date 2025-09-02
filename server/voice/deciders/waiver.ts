/**
 * Waiver Priority Decision Logic
 * Uses RAG score with upside adjustments and minimum snap/usage gates
 */

import type { PlayerWeekFacts, DecisionResult } from '../types';

export function decideWaiver(player: PlayerWeekFacts): DecisionResult {
  // Minimum usage gate - need some baseline opportunity
  const hasUsage = player.availability >= 50; // Some playing time expected
  
  if (!hasUsage) {
    return { verdict: 'Pass (no usage)', conf: 80 };
  }
  
  // RAG-based priority with upside adjustments
  let priority_score = player.rag_score;
  
  // QB upside boost for rushing ability
  if (player.position === 'QB' && player.upside_index && player.upside_index >= 70) {
    priority_score += 10;
  }
  
  // WR/TE target upside boost
  if ((player.position === 'WR' || player.position === 'TE') && player.upside_index && player.upside_index >= 60) {
    priority_score += 8;
  }
  
  // RB opportunity boost
  if (player.position === 'RB' && player.upside_index && player.upside_index >= 65) {
    priority_score += 12;
  }
  
  // Rising trajectory boost
  if (player.power_score > (player.prev_power_score || 0)) {
    priority_score += 5;
  }
  
  // Determine claim priority
  if (priority_score >= 75) {
    return { verdict: 'Claim: High', conf: Math.min(90, 70 + (priority_score - 75)) };
  }
  
  if (priority_score >= 60) {
    return { verdict: 'Claim: Medium', conf: 65 + Math.min(15, priority_score - 60) };
  }
  
  if (priority_score >= 45) {
    return { verdict: 'Claim: Low', conf: 55 + Math.min(10, priority_score - 45) };
  }
  
  return { verdict: 'Pass', conf: 70 };
}