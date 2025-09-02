/**
 * Reason Builders - Generate factual bullets from metrics
 * Always cite specific data, never general claims
 */

import type { PlayerWeekFacts } from './types';

export function reasonsFromMetrics(player: PlayerWeekFacts): string[] {
  const reasons: string[] = [];
  
  // RAG System status
  if (player.rag_color === 'GREEN') {
    reasons.push(`RAG: GREEN (${player.rag_score}) with floor ${player.floor_points.toFixed(1)}`);
  } else if (player.rag_color === 'AMBER') {
    reasons.push(`RAG: AMBER (${player.rag_score}); volatile range ${player.floor_points.toFixed(1)}-${player.ceiling_points.toFixed(1)}`);
  } else if (player.rag_color === 'RED') {
    reasons.push(`RAG: RED (${player.rag_score}); expected ${player.expected_points.toFixed(1)} pts`);
  }
  
  // Performance vs projections
  if (player.beat_proj && player.beat_proj >= 60) {
    reasons.push(`Beating projections (${player.beat_proj}% scale)`);
  } else if (player.beat_proj && player.beat_proj <= 40) {
    reasons.push(`Underperforming projections (${player.beat_proj}% scale)`);
  }
  
  // Position-specific upside
  if (player.position === 'QB' && player.upside_index && player.upside_index >= 70) {
    reasons.push(`Rushing upside (${player.upside_index}/100)`);
  }
  
  if ((player.position === 'WR' || player.position === 'TE') && player.upside_index && player.upside_index >= 60) {
    reasons.push(`Target upside (${player.upside_index}/100)`);
  }
  
  if (player.position === 'RB' && player.upside_index && player.upside_index >= 65) {
    reasons.push(`Opportunity upside (${player.upside_index}/100)`);
  }
  
  // Matchup context
  if (player.opp_multiplier && player.opp_multiplier < 0.95) {
    const deflation = ((1 - player.opp_multiplier) * 100).toFixed(0);
    reasons.push(`Tough matchup (deflator ${deflation}%)`);
  } else if (player.opp_multiplier && player.opp_multiplier > 1.05) {
    const boost = ((player.opp_multiplier - 1) * 100).toFixed(0);
    reasons.push(`Favorable matchup (boost ${boost}%)`);
  }
  
  // Market position vs consensus
  if (player.delta_vs_ecr && player.delta_vs_ecr >= 10) {
    reasons.push(`Earlier than consensus by +${player.delta_vs_ecr} ranks`);
  } else if (player.delta_vs_ecr && player.delta_vs_ecr <= -10) {
    reasons.push(`Later than consensus by ${Math.abs(player.delta_vs_ecr)} ranks`);
  }
  
  // Injury/availability concerns
  if (player.availability < 70 && player.availability_flag) {
    reasons.push(`Injury risk: ${player.availability_flag} (${player.availability}% confidence)`);
  }
  
  // Power ranking movement
  if (player.prev_power_score && player.power_score > player.prev_power_score + 3) {
    const gain = (player.power_score - player.prev_power_score).toFixed(1);
    reasons.push(`Power rising (+${gain} week-over-week)`);
  } else if (player.prev_power_score && player.power_score < player.prev_power_score - 3) {
    const loss = (player.prev_power_score - player.power_score).toFixed(1);
    reasons.push(`Power declining (-${loss} week-over-week)`);
  }
  
  // Limit to top 4 most relevant reasons
  return reasons.slice(0, 4);
}

export function buildContingencies(player: PlayerWeekFacts): string[] {
  const contingencies: string[] = [];
  
  // Injury-based contingencies
  if (player.availability_flag === 'QUESTIONABLE') {
    contingencies.push(`If ${player.name} sits → downgrade to BENCH`);
  }
  
  // Matchup-dependent scenarios
  if (player.opp_multiplier && Math.abs(player.opp_multiplier - 1) > 0.1) {
    if (player.opp_multiplier > 1.05) {
      contingencies.push(`If weather/game script shifts → reduced ceiling`);
    } else {
      contingencies.push(`If game flow favors position → upgrade potential`);
    }
  }
  
  // Usage-dependent scenarios for skill positions
  if (player.position !== 'QB' && player.upside_index && player.upside_index >= 60) {
    contingencies.push(`If target/touch share drops <60% → downgrade`);
  }
  
  return contingencies.slice(0, 2); // Keep it concise
}