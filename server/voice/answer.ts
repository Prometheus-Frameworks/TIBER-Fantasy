/**
 * Main Tiber Answer Router
 * Ties together data fetching, decision logic, and response building
 */

import { decideStartSit } from './deciders/startSit';
import { decideTrade } from './deciders/trade';
import { decideWaiver } from './deciders/waiver';
import { reasonsFromMetrics, buildContingencies } from './reasons';
import { fetchPlayerWeekBundle } from './dataAdapter';
import type { TiberAsk, TiberAnswer, PlayerWeekFacts } from './types';

export async function tiberAnswer(ask: TiberAsk): Promise<TiberAnswer> {
  // Fetch primary player data
  const player = await fetchPlayerWeekBundle(ask.players[0], ask.season, ask.week);
  
  // Default response values
  let verdict = 'Neutral';
  let conf = 50;
  
  // Route to appropriate decision logic
  switch (ask.intent) {
    case 'START_SIT': {
      const decision = decideStartSit(player);
      verdict = decision.verdict;
      conf = decision.conf;
      break;
    }
    
    case 'TRADE': {
      // For trade analysis, optionally fetch comparison player
      let theirPlayer: PlayerWeekFacts | undefined;
      if (ask.players.length > 1) {
        theirPlayer = await fetchPlayerWeekBundle(ask.players[1], ask.season, ask.week);
      }
      
      const decision = decideTrade(player, theirPlayer);
      verdict = decision.verdict;
      conf = decision.conf;
      break;
    }
    
    case 'WAIVER': {
      const decision = decideWaiver(player);
      verdict = decision.verdict;
      conf = decision.conf;
      break;
    }
    
    case 'RANKING_EXPLAIN': {
      verdict = `Ranked ${player.rank} (${player.power_score.toFixed(1)})`;
      conf = 60 + Math.min(20, player.power_score / 5);
      break;
    }
    
    case 'PLAYER_OUTLOOK': {
      if (player.rag_color === 'GREEN') {
        verdict = `Strong outlook (${player.rag_color} ${player.rag_score})`;
        conf = 70 + Math.min(20, (player.rag_score - 65) * 2);
      } else if (player.rag_color === 'RED') {
        verdict = `Concerning outlook (${player.rag_color} ${player.rag_score})`;
        conf = 75;
      } else {
        verdict = `Mixed outlook (${player.rag_color} ${player.rag_score})`;
        conf = 60;
      }
      break;
    }
    
    default:
      verdict = 'Unable to analyze';
      conf = 30;
      break;
  }
  
  // Build supporting data
  const reasons = reasonsFromMetrics(player);
  const contingencies = buildContingencies(player);
  const metrics = packMetrics(player);
  
  return {
    verdict,
    confidence: conf,
    reasons,
    metrics,
    contingencies: contingencies.length > 0 ? contingencies : undefined,
    tone: 'tiber'
  };
}

// Pack key metrics for frontend display
function packMetrics(player: PlayerWeekFacts): Record<string, any> {
  return {
    power_score: player.power_score,
    rag_score: player.rag_score,
    rag_color: player.rag_color,
    expected_points: player.expected_points,
    floor_ceiling: `${player.floor_points.toFixed(1)}-${player.ceiling_points.toFixed(1)}`,
    rank: player.rank,
    position: player.position,
    team: player.team,
    availability: player.availability,
    delta_vs_ecr: player.delta_vs_ecr,
    upside_index: player.upside_index,
    opp_multiplier: player.opp_multiplier
  };
}

// Utility to calculate confidence penalties
export function volatilityPenalty(player: PlayerWeekFacts): number {
  const spread = player.ceiling_points - player.floor_points;
  if (spread <= 6) return 0;   // Consistent player
  if (spread <= 10) return 5;  // Some volatility  
  if (spread <= 15) return 10; // High volatility
  return 15; // Very volatile
}