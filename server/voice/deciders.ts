/**
 * Tiber Decision Logic - Real TIBER Power Algorithm
 * Sophisticated decision-making using Power + RAG + market data
 */

import type { PlayerWeekBundle } from './dataAdapter';

const POS_BENCHLINES: Record<string, number> = { 
  QB: 15, 
  RB: 12, 
  WR: 12, 
  TE: 9 
};

function confFromSpread(p: PlayerWeekBundle): number {
  const spread = Math.max(0, (p.ceiling_points ?? 0) - (p.floor_points ?? 0));
  // Tighter range → higher confidence
  return Math.max(40, Math.min(90, 85 - spread * 4 + (p.rag_score ?? 50) / 10));
}

function volatilityPenalty(p: PlayerWeekBundle): number {
  const spread = Math.max(0, (p.ceiling_points ?? 0) - (p.floor_points ?? 0));
  return Math.min(25, spread * 2.5);
}

export function decideStartSit(p: PlayerWeekBundle): { verdict: string; conf: number } {
  const benchline = POS_BENCHLINES[p.position] ?? 10;
  
  if (p.injury_flag === 'OUT') {
    return { verdict: 'Bench', conf: 95 };
  }

  if (p.rag_color === 'GREEN' && (p.expected_points ?? 0) >= benchline) {
    return { verdict: 'Start', conf: confFromSpread(p) };
  }
  
  if (p.rag_color === 'RED') {
    return { verdict: 'Bench', conf: Math.max(70, confFromSpread(p)) };
  }
  
  return { verdict: 'Start (thin margin)', conf: confFromSpread(p) - 8 };
}

export function decideTrade(p: PlayerWeekBundle): { verdict: string; conf: number } {
  const edge = p.delta_vs_ecr ?? 0; // + means we're earlier
  const rising = (p.power_score ?? 0) - (p.prev_power_score ?? (p.power_score ?? 0)) >= 3;
  const healthy = (p.availability ?? 100) >= 70 && p.injury_flag !== 'OUT';

  if (edge >= 10 && healthy) {
    return { verdict: 'Lean Trade For', conf: 70 + Math.min(20, edge) };
  }
  
  if (edge <= -10) {
    return { verdict: 'Lean Trade Away', conf: 65 + Math.min(20, -edge) };
  }
  
  return { 
    verdict: rising ? 'Slight Lean For' : 'Neutral / Price Sensitive', 
    conf: 55 + (rising ? 8 : 0) 
  };
}

export function reasonsFromMetrics(p: PlayerWeekBundle): string[] {
  const R: string[] = [];
  
  if (p.rag_color) {
    R.push(`RAG: ${p.rag_color} (${p.rag_score ?? 0}) — exp ${(p.expected_points ?? 0).toFixed(1)} (floor ${(p.floor_points ?? 0).toFixed(1)})`);
  }
  
  if ((p.upside_index ?? 0) >= 70 && p.position === 'QB') {
    R.push(`Rushing upside (${p.upside_index}/100)`);
  }
  
  if ((p.beat_proj ?? 0) >= 60) {
    R.push(`Beating projections (${p.beat_proj} scale)`);
  }
  
  const oppMult = p.opp_multiplier ?? 1;
  if (oppMult > 1.05) {
    R.push(`Favorable matchup (boost +${((oppMult - 1) * 100).toFixed(0)}%)`);
  }
  
  if (oppMult < 0.95) {
    R.push(`Tough matchup (−${((1 - oppMult) * 100).toFixed(0)}%)`);
  }
  
  if ((p.delta_vs_ecr ?? 0) >= 10) {
    R.push(`Earlier than consensus by +${p.delta_vs_ecr} ranks`);
  }
  
  return R.slice(0, 4);
}

export function contingencies(p: PlayerWeekBundle): string[] {
  const C: string[] = [];
  
  if (p.position !== 'QB' && (p.opp_multiplier ?? 1) < 0.95) {
    C.push('If game script flips positive → upgrade');
  }
  
  if (p.position === 'QB' && (p.upside_index ?? 0) >= 70) {
    C.push('If designed runs <5% → downgrade');
  }
  
  if (p.injury_flag === 'Q') {
    C.push('If limited Friday → bench in shallow leagues');
  }
  
  return C.slice(0, 3);
}