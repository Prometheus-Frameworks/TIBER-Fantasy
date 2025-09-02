/**
 * Tiber Answer System - Real OTC Power Integration
 * Main answer router using live database queries
 */

import { resolvePlayerId, fetchPlayerWeekBundle } from './dataAdapter';
import { decideStartSit, decideTrade, reasonsFromMetrics, contingencies } from './deciders';
import type { TiberAsk, TiberAnswer } from './types';

export async function tiberAnswer(ask: TiberAsk): Promise<TiberAnswer> {
  const who = ask.players[0];
  
  // Resolve player name to ID
  const r = await resolvePlayerId(who);
  if (!r) {
    return {
      verdict: 'Unknown Player',
      confidence: 0,
      reasons: [`Could not resolve "${who}" to a player_id`],
      metrics: {},
      tone: 'tiber'
    };
  }
  
  // Fetch comprehensive player data
  const p = await fetchPlayerWeekBundle(r.player_id, ask.season, ask.week);
  if (!p) {
    return {
      verdict: 'No Data',
      confidence: 0,
      reasons: ['No facts for this player/week yet'],
      metrics: { player_id: r.player_id },
      tone: 'tiber'
    };
  }

  let verdict = 'Neutral';
  let confidence = 55;

  // Decision logic based on intent
  if (ask.intent === 'START_SIT' || ask.intent === 'PLAYER_OUTLOOK') {
    const d = decideStartSit(p);
    verdict = d.verdict;
    confidence = d.conf;
  } else if (ask.intent === 'TRADE') {
    const d = decideTrade(p);
    verdict = d.verdict;
    confidence = d.conf;
  } else if (ask.intent === 'WAIVER') {
    if ((p.rag_score ?? 0) >= 66) {
      verdict = 'Claim: High';
      confidence = 70 - (Math.max(0, (p.ceiling_points ?? 0) - (p.floor_points ?? 0)) * 2);
    } else if ((p.rag_score ?? 0) >= 50) {
      verdict = 'Claim: Medium';
      confidence = 60;
    } else {
      verdict = 'Pass';
      confidence = 65;
    }
  } else if (ask.intent === 'RANKING_EXPLAIN') {
    verdict = `Rank ${p.rank ?? '—'} (Power ${p.power_score?.toFixed(1) ?? '—'})`;
    confidence = 60 + Math.min(20, (p.power_score ?? 50) / 8);
  }

  // Build evidence-based reasons and contingencies
  const reasons = reasonsFromMetrics(p);
  const cont = contingencies(p);

  return {
    verdict,
    confidence: Math.round(Math.max(0, Math.min(100, confidence))),
    reasons,
    contingencies: cont.length ? cont : undefined,
    metrics: {
      player_id: p.player_id,
      name: p.name,
      team: p.team,
      pos: p.position,
      rank: p.rank,
      power_score: p.power_score,
      rag_color: p.rag_color,
      rag_score: p.rag_score,
      expected_points: p.expected_points,
      floor_points: p.floor_points,
      ceiling_points: p.ceiling_points,
      delta_vs_ecr: p.delta_vs_ecr,
      upside_index: p.upside_index,
      beat_proj: p.beat_proj
    },
    tone: 'tiber'
  };
}