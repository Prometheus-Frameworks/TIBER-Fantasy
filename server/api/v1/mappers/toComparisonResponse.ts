/**
 * toComparisonResponse
 * =====================
 * Maps the loose PlayerComparison output from playerComparisonService
 * into the canonical ComparisonResponse contract (shared/types/intelligence.ts).
 *
 * This is a pure adapter — no football logic lives here.
 * All scoring and verdict generation remains in playerComparisonService.
 */

import type { ComparisonResponse, VerdictWinner, EdgeStrength, Actionability, ConfidenceBand } from '../../../../shared/types/intelligence';
import type { PlayerComparison } from '../../../services/playerComparisonService';

const CONTRACT_VERSION = '1.0.0';

// ── Confidence mapping ────────────────────────────────────────────────────────

function mapConfidenceScore(band: string): number {
  switch (band.toLowerCase()) {
    case 'high':   return 0.80;
    case 'medium': return 0.55;
    default:       return 0.30;
  }
}

function mapConfidenceBand(band: string): ConfidenceBand {
  switch (band.toLowerCase()) {
    case 'high':   return 'high';
    case 'medium': return 'medium';
    default:       return 'low';
  }
}

// ── Verdict mapping ───────────────────────────────────────────────────────────

function mapWinner(recommendation: string, p1Name: string, p2Name: string): VerdictWinner {
  if (recommendation.toLowerCase().includes('coin flip')) return 'even';
  if (recommendation.includes(p1Name)) return 'side_a';
  if (recommendation.includes(p2Name)) return 'side_b';
  return 'unknown';
}

function mapEdgeStrength(confidence: string, recommendation: string): EdgeStrength {
  if (recommendation.toLowerCase().includes('coin flip')) return 'indeterminate';
  switch (confidence.toLowerCase()) {
    case 'high':   return 'strong';
    case 'medium': return 'moderate';
    default:       return 'slight';
  }
}

function mapActionability(confidence: string, recommendation: string): Actionability {
  if (recommendation.toLowerCase().includes('coin flip')) return 'more_research_needed';
  switch (confidence.toLowerCase()) {
    case 'high':   return 'act_now';
    case 'medium': return 'lean_only';
    default:       return 'more_research_needed';
  }
}

// ── Summary sentence ─────────────────────────────────────────────────────────

function buildSummary(
  recommendation: string,
  confidence: string,
  p1Name: string,
  p2Name: string,
): string {
  if (recommendation.toLowerCase().includes('coin flip')) {
    return `${p1Name} vs ${p2Name} is essentially a coin flip — no meaningful edge from available data.`;
  }
  const winner = recommendation.includes(p1Name) ? p1Name : p2Name;
  const loser  = winner === p1Name ? p2Name : p1Name;
  const strength = confidence.toLowerCase() === 'high' ? 'clearly favored' : 'the lean';
  return `${winner} is ${strength} over ${loser} based on recent usage and matchup data.`;
}

// ── Evidence assembly ─────────────────────────────────────────────────────────

function buildPillars(data: PlayerComparison) {
  const { player1, player2 } = data;
  const p1 = player1.usage;
  const p2 = player2.usage;

  const pillars = [];

  // Volume pillar
  const p1Vol = p1.targets ?? p1.carriesTotal ?? null;
  const p2Vol = p2.targets ?? p2.carriesTotal ?? null;
  if (p1Vol !== null && p2Vol !== null) {
    const delta = p1Vol - p2Vol;
    pillars.push({
      name: 'volume' as const,
      score: undefined,
      delta,
      direction: (delta > 3 ? 'side_a' : delta < -3 ? 'side_b' : 'even') as VerdictWinner,
      notes: [`${p1.playerName}: ${p1Vol} | ${p2.playerName}: ${p2Vol}`],
    });
  }

  // Team context pillar (matchup-based)
  const p1Epa = p1.position === 'RB'
    ? player1.opponent.rushEpaAllowed
    : player1.opponent.passEpaAllowed;
  const p2Epa = p2.position === 'RB'
    ? player2.opponent.rushEpaAllowed
    : player2.opponent.passEpaAllowed;

  if (p1Epa !== undefined && p1Epa !== null && p2Epa !== undefined && p2Epa !== null) {
    const delta = p1Epa - p2Epa;
    pillars.push({
      name: 'team_context' as const,
      score: undefined,
      delta,
      direction: (delta > 0.02 ? 'side_a' : delta < -0.02 ? 'side_b' : 'even') as VerdictWinner,
      notes: [
        `${p1.playerName} opp EPA allowed: ${p1Epa.toFixed(3)}`,
        `${p2.playerName} opp EPA allowed: ${p2Epa.toFixed(3)}`,
      ],
    });
  }

  // Efficiency pillar (snap share proxy)
  if (p1.snapSharePct !== undefined && p2.snapSharePct !== undefined) {
    const delta = p1.snapSharePct - p2.snapSharePct;
    pillars.push({
      name: 'efficiency' as const,
      score: undefined,
      delta,
      direction: (delta > 5 ? 'side_a' : delta < -5 ? 'side_b' : 'even') as VerdictWinner,
      notes: [
        `${p1.playerName} snap share: ${p1.snapSharePct.toFixed(1)}%`,
        `${p2.playerName} snap share: ${p2.snapSharePct.toFixed(1)}%`,
      ],
    });
  }

  return pillars;
}

function buildMetrics(data: PlayerComparison) {
  const { player1, player2 } = data;
  const p1 = player1.usage;
  const p2 = player2.usage;
  const metrics = [];

  if (p1.targetSharePct !== undefined)
    metrics.push({ name: `${p1.playerName} target share`, value: p1.targetSharePct, unit: '%', source: 'nflfastR' });
  if (p2.targetSharePct !== undefined)
    metrics.push({ name: `${p2.playerName} target share`, value: p2.targetSharePct, unit: '%', source: 'nflfastR' });
  if (p1.carriesTotal !== undefined)
    metrics.push({ name: `${p1.playerName} carries`, value: p1.carriesTotal, source: 'nflfastR' });
  if (p2.carriesTotal !== undefined)
    metrics.push({ name: `${p2.playerName} carries`, value: p2.carriesTotal, source: 'nflfastR' });
  if (p1.snapSharePct !== undefined)
    metrics.push({ name: `${p1.playerName} snap share`, value: p1.snapSharePct, unit: '%', source: 'nflfastR' });
  if (p2.snapSharePct !== undefined)
    metrics.push({ name: `${p2.playerName} snap share`, value: p2.snapSharePct, unit: '%', source: 'nflfastR' });
  if (player1.opponent.passEpaAllowed !== undefined)
    metrics.push({ name: `${player1.opponent.opponent} pass EPA allowed`, value: player1.opponent.passEpaAllowed, context: `vs ${p1.playerName}`, source: 'nflfastR' });
  if (player2.opponent.passEpaAllowed !== undefined)
    metrics.push({ name: `${player2.opponent.opponent} pass EPA allowed`, value: player2.opponent.passEpaAllowed, context: `vs ${p2.playerName}`, source: 'nflfastR' });

  return metrics;
}

function buildCouldChangeIf(data: PlayerComparison): string[] {
  const reasons: string[] = [];
  const { player1, player2 } = data;

  if (player1.usage.dataContext) {
    reasons.push(`${player1.usage.playerName} returns from injury/bye and usage profile shifts`);
  }
  if (player2.usage.dataContext) {
    reasons.push(`${player2.usage.playerName} returns from injury/bye and usage profile shifts`);
  }
  reasons.push('Either player is ruled out or limited in practice this week');
  reasons.push('Game script changes significantly (blowout, weather, etc.)');
  return reasons;
}

function buildWarnings(data: PlayerComparison): string[] {
  const warnings: string[] = [];
  if (data.player1.usage.dataContext)
    warnings.push(`${data.player1.usage.playerName}: data is ${data.player1.usage.dataContext}`);
  if (data.player2.usage.dataContext)
    warnings.push(`${data.player2.usage.playerName}: data is ${data.player2.usage.dataContext}`);
  return warnings;
}

// ── Main mapper ───────────────────────────────────────────────────────────────

export function toComparisonResponse(
  data: PlayerComparison,
  opts: {
    week: number;
    season: number;
    traceId?: string;
    source?: string;
  },
): ComparisonResponse {
  const { verdict, player1, player2 } = data;
  const p1Name = player1.usage.playerName;
  const p2Name = player2.usage.playerName;

  const winner     = mapWinner(verdict.recommendation, p1Name, p2Name);
  const edge       = mapEdgeStrength(verdict.confidence, verdict.recommendation);
  const action     = mapActionability(verdict.confidence, verdict.recommendation);
  const confScore  = mapConfidenceScore(verdict.confidence);
  const confBand   = mapConfidenceBand(verdict.confidence);
  const warnings   = buildWarnings(data);

  return {
    request_meta: {
      version: CONTRACT_VERSION,
      intent: 'comparison',
      generated_at: data.generatedAt,
      season: opts.season,
      week: opts.week,
      trace_id: opts.traceId,
      source: opts.source ?? 'api_v1',
    },
    subject: {
      type: 'comparison',
      label: `${p1Name} vs ${p2Name}`,
      side_a: { label: p1Name, id: player1.usage.playerId },
      side_b: { label: p2Name, id: player2.usage.playerId },
    },
    verdict: {
      label: verdict.recommendation,
      winner,
      edge_strength: edge,
      actionability: action,
    },
    confidence: {
      score: confScore,
      band: confBand,
    },
    summary: buildSummary(verdict.recommendation, verdict.confidence, p1Name, p2Name),
    evidence: {
      summary_signal: {
        market_delta: Math.abs(confScore - 0.5) * 2,
      },
      pillars: buildPillars(data),
      metrics: buildMetrics(data),
      reasons: verdict.keyFactors,
    },
    uncertainty: {
      could_change_if: buildCouldChangeIf(data),
      missing_inputs: ['FORGE alpha scores', 'Current injury report'],
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  };
}
