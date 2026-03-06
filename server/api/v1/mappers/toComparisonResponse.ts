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
  const normalized = recommendation.toLowerCase();
  if (normalized.includes('coin flip')) return 'even';
  if (recommendation.includes(p1Name)) return 'side_a';
  if (recommendation.includes(p2Name)) return 'side_b';
  return 'unknown';
}

function mapEdgeStrength(confidence: string, recommendation: string): EdgeStrength {
  const normalizedRecommendation = recommendation.toLowerCase();
  if (normalizedRecommendation.includes('coin flip')) return 'indeterminate';
  if (normalizedRecommendation.includes('lean')) {
    return confidence.toLowerCase() === 'high' ? 'moderate' : 'slight';
  }
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

function buildVerdictLabel(winner: VerdictWinner, edge: EdgeStrength, p1Name: string, p2Name: string): string {
  if (winner === 'even' || winner === 'unknown' || edge === 'indeterminate') {
    return 'Coin flip';
  }

  const winnerName = winner === 'side_a' ? p1Name : p2Name;
  if (edge === 'strong') return `Strong edge ${winnerName}`;
  if (edge === 'moderate') return `Edge ${winnerName}`;
  return `Lean ${winnerName}`;
}

// ── Summary sentence ─────────────────────────────────────────────────────────

function buildSummary(
  verdictLabel: string,
  edge: EdgeStrength,
  p1Name: string,
  p2Name: string,
): string {
  if (verdictLabel === 'Coin flip') {
    return `${p1Name} vs ${p2Name} is essentially a coin flip — no meaningful edge from available data.`;
  }

  const winner = verdictLabel.includes(p1Name) ? p1Name : p2Name;
  const loser  = winner === p1Name ? p2Name : p1Name;
  const phrase = edge === 'strong'
    ? 'clearly favored'
    : edge === 'moderate'
      ? 'holds the edge'
      : 'gets a slight lean';
  return `${winner} ${phrase} over ${loser} based on usage and matchup context.`;
}

type PillarDirection = 'side_a' | 'side_b' | 'even';

function mapDirection(delta: number, threshold: number): PillarDirection {
  if (delta > threshold) return 'side_a';
  if (delta < -threshold) return 'side_b';
  return 'even';
}

function buildPillars(data: PlayerComparison) {
  const { player1, player2 } = data;
  const p1 = player1.usage;
  const p2 = player2.usage;

  const pillars = [];

  const p1Volume = p1.targets ?? p1.carriesTotal ?? null;
  const p2Volume = p2.targets ?? p2.carriesTotal ?? null;
  if (p1Volume !== null && p2Volume !== null) {
    const delta = p1Volume - p2Volume;
    pillars.push({
      name: 'volume' as const,
      score: undefined,
      delta,
      direction: mapDirection(delta, 3),
      notes: [
        `${p1.playerName} opportunity count: ${p1Volume}`,
        `${p2.playerName} opportunity count: ${p2Volume}`,
      ],
    });
  }

  const p1Epa = p1.position === 'RB'
    ? player1.opponent.rushEpaAllowed
    : player1.opponent.passEpaAllowed;
  const p2Epa = p2.position === 'RB'
    ? player2.opponent.rushEpaAllowed
    : player2.opponent.passEpaAllowed;

  if (p1Epa !== undefined && p1Epa !== null && p2Epa !== undefined && p2Epa !== null) {
    const delta = p1Epa - p2Epa;
    const epaType = p1.position === 'RB' && p2.position === 'RB' ? 'rush' : 'pass';
    pillars.push({
      name: 'team_context' as const,
      score: undefined,
      delta,
      direction: mapDirection(delta, 0.02),
      notes: [
        `${p1.playerName} opponent ${epaType} EPA allowed: ${p1Epa.toFixed(3)}`,
        `${p2.playerName} opponent ${epaType} EPA allowed: ${p2Epa.toFixed(3)}`,
      ],
    });
  }

  if (p1.targetSharePct !== undefined && p2.targetSharePct !== undefined) {
    const delta = p1.targetSharePct - p2.targetSharePct;
    pillars.push({
      name: 'efficiency' as const,
      score: undefined,
      delta,
      direction: mapDirection(delta, 3),
      notes: [
        `${p1.playerName} target share: ${p1.targetSharePct.toFixed(1)}%`,
        `${p2.playerName} target share: ${p2.targetSharePct.toFixed(1)}%`,
      ],
    });
  }

  if (p1.snapSharePct !== undefined && p2.snapSharePct !== undefined) {
    const delta = p1.snapSharePct - p2.snapSharePct;
    pillars.push({
      name: 'stability' as const,
      score: undefined,
      delta,
      direction: mapDirection(delta, 5),
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
  if (p1.targets !== undefined)
    metrics.push({ name: `${p1.playerName} targets`, value: p1.targets, source: 'nflfastR' });
  if (p2.targets !== undefined)
    metrics.push({ name: `${p2.playerName} targets`, value: p2.targets, source: 'nflfastR' });
  if (p1.snapSharePct !== undefined)
    metrics.push({ name: `${p1.playerName} snap share`, value: p1.snapSharePct, unit: '%', source: 'nflfastR' });
  if (p2.snapSharePct !== undefined)
    metrics.push({ name: `${p2.playerName} snap share`, value: p2.snapSharePct, unit: '%', source: 'nflfastR' });

  const p1IsRb = p1.position === 'RB';
  const p2IsRb = p2.position === 'RB';

  if (p1IsRb && player1.opponent.rushEpaAllowed !== undefined)
    metrics.push({ name: `${player1.opponent.opponent} rush EPA allowed`, value: player1.opponent.rushEpaAllowed, context: `vs ${p1.playerName}`, source: 'nflfastR' });
  if (!p1IsRb && player1.opponent.passEpaAllowed !== undefined)
    metrics.push({ name: `${player1.opponent.opponent} pass EPA allowed`, value: player1.opponent.passEpaAllowed, context: `vs ${p1.playerName}`, source: 'nflfastR' });
  if (p2IsRb && player2.opponent.rushEpaAllowed !== undefined)
    metrics.push({ name: `${player2.opponent.opponent} rush EPA allowed`, value: player2.opponent.rushEpaAllowed, context: `vs ${p2.playerName}`, source: 'nflfastR' });
  if (!p2IsRb && player2.opponent.passEpaAllowed !== undefined)
    metrics.push({ name: `${player2.opponent.opponent} pass EPA allowed`, value: player2.opponent.passEpaAllowed, context: `vs ${p2.playerName}`, source: 'nflfastR' });

  return metrics;
}

function buildReasons(data: PlayerComparison) {
  const { player1, player2 } = data;
  const p1 = player1.usage;
  const p2 = player2.usage;

  const reasons: string[] = [];

  const p1Volume = p1.targets ?? p1.carriesTotal;
  const p2Volume = p2.targets ?? p2.carriesTotal;
  if (p1Volume !== undefined && p2Volume !== undefined && Math.abs(p1Volume - p2Volume) >= 3) {
    const favored = p1Volume > p2Volume ? p1.playerName : p2.playerName;
    reasons.push(`${favored} shows the stronger opportunity volume in recent usage.`);
  }

  if (p1.targetSharePct !== undefined && p2.targetSharePct !== undefined && Math.abs(p1.targetSharePct - p2.targetSharePct) >= 3) {
    const favored = p1.targetSharePct > p2.targetSharePct ? p1.playerName : p2.playerName;
    reasons.push(`${favored} has the better target-share efficiency signal.`);
  }

  const p1Epa = p1.position === 'RB' ? player1.opponent.rushEpaAllowed : player1.opponent.passEpaAllowed;
  const p2Epa = p2.position === 'RB' ? player2.opponent.rushEpaAllowed : player2.opponent.passEpaAllowed;
  if (p1Epa !== undefined && p2Epa !== undefined && Math.abs(p1Epa - p2Epa) >= 0.02) {
    const favored = p1Epa > p2Epa ? p1.playerName : p2.playerName;
    const axis = p1.position === 'RB' && p2.position === 'RB' ? 'rush-EPA matchup' : 'pass-EPA matchup';
    reasons.push(`${favored} has the more favorable ${axis}.`);
  }

  if (reasons.length === 0) {
    reasons.push('The available usage and matchup metrics are tightly clustered between both sides.');
  }

  return reasons;
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

function deriveSideScores(edge: EdgeStrength, winner: VerdictWinner): { sideAScore: number; sideBScore: number; scoreDelta: number } {
  if (winner !== 'side_a' && winner !== 'side_b') {
    return { sideAScore: 50, sideBScore: 50, scoreDelta: 0 };
  }

  const delta = edge === 'strong' ? 20 : edge === 'moderate' ? 12 : 6;
  const sideAScore = winner === 'side_a' ? 50 + delta : 50 - delta;
  const sideBScore = winner === 'side_b' ? 50 + delta : 50 - delta;
  return { sideAScore, sideBScore, scoreDelta: sideAScore - sideBScore };
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

  const winner = mapWinner(verdict.recommendation, p1Name, p2Name);
  const edge = mapEdgeStrength(verdict.confidence, verdict.recommendation);
  const action = mapActionability(verdict.confidence, verdict.recommendation);
  const confScore = mapConfidenceScore(verdict.confidence);
  const confBand = mapConfidenceBand(verdict.confidence);
  const label = buildVerdictLabel(winner, edge, p1Name, p2Name);
  const warnings = buildWarnings(data);
  const sideScores = deriveSideScores(edge, winner);

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
      label,
      winner,
      edge_strength: edge,
      actionability: action,
    },
    confidence: {
      score: confScore,
      band: confBand,
    },
    summary: buildSummary(label, edge, p1Name, p2Name),
    evidence: {
      summary_signal: {
        side_a_score: sideScores.sideAScore,
        side_b_score: sideScores.sideBScore,
        score_delta: sideScores.scoreDelta,
        market_delta: Math.abs(confScore - 0.5) * 2,
      },
      pillars: buildPillars(data),
      metrics: buildMetrics(data),
      reasons: buildReasons(data),
    },
    uncertainty: {
      could_change_if: buildCouldChangeIf(data),
      missing_inputs: ['FORGE alpha scores', 'Current injury report'],
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  };
}
