/**
 * toComparisonResponse
 * =====================
 * Maps the loose PlayerComparison output from playerComparisonService
 * into the canonical ComparisonResponse contract (shared/types/intelligence.ts).
 *
 * This is a pure adapter — no football logic lives here.
 * All scoring and verdict generation remains in playerComparisonService.
 *
 * Semantic contract enforced here:
 * - verdict.label is derived from (edge_strength + winner), NOT the raw
 *   service recommendation string, so label never contradicts edge_strength.
 * - Snap share belongs in the "stability" pillar (role consistency), not "efficiency".
 * - Reasons are filtered: ⚠️ data-freshness lines go to warnings, not reasons;
 *   "run defense" keyFactors are suppressed for non-RB matchups.
 * - summary_signal exposes raw usage primitives for quick machine consumption,
 *   not a thin confidence-derived delta.
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

/**
 * Derive a human-readable verdict label from edge_strength and winner.
 *
 * This replaces passing verdict.recommendation directly as the label because
 * the service always emits "Lean X" regardless of confidence level — which
 * contradicts a "strong" edge_strength. The label must align with the edge.
 *
 *   strong + side_a/b   → "{WinnerName}"              (unambiguous)
 *   moderate + side_a/b → "Lean {WinnerName}"          (directional)
 *   slight + side_a/b   → "Slight edge: {WinnerName}"  (cautious lean)
 *   even/indeterminate  → "Coin flip"
 */
function buildVerdictLabel(
  edge: EdgeStrength,
  winner: VerdictWinner,
  p1Name: string,
  p2Name: string,
): string {
  const winnerName = winner === 'side_a' ? p1Name : winner === 'side_b' ? p2Name : null;
  if (!winnerName || winner === 'even' || winner === 'unknown') return 'Coin flip';
  switch (edge) {
    case 'strong':        return winnerName;
    case 'moderate':      return `Lean ${winnerName}`;
    case 'slight':        return `Slight edge: ${winnerName}`;
    case 'indeterminate': return 'Coin flip';
  }
}

// ── Summary sentence ─────────────────────────────────────────────────────────

function buildSummary(
  edge: EdgeStrength,
  winner: VerdictWinner,
  p1Name: string,
  p2Name: string,
): string {
  if (winner === 'even' || winner === 'unknown' || edge === 'indeterminate') {
    return `${p1Name} vs ${p2Name} is essentially a coin flip — no meaningful edge from available data.`;
  }
  const winnerName = winner === 'side_a' ? p1Name : p2Name;
  const loserName  = winnerName === p1Name ? p2Name : p1Name;
  const strengthPhrase =
    edge === 'strong'   ? 'is clearly the call over' :
    edge === 'moderate' ? 'is the lean over'         :
                          'holds a slight edge over';
  return `${winnerName} ${strengthPhrase} ${loserName} based on recent usage and matchup data.`;
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

  // Volume pillar — targets (WR) or carries (RB)
  const p1Vol = p1.targets ?? p1.carriesTotal ?? null;
  const p2Vol = p2.targets ?? p2.carriesTotal ?? null;
  if (p1Vol !== null && p2Vol !== null) {
    const delta = p1Vol - p2Vol;
    const volLabel = p1.targets !== undefined ? 'targets' : 'carries';
    pillars.push({
      name: 'volume' as const,
      delta,
      direction: (delta > 3 ? 'side_a' : delta < -3 ? 'side_b' : 'even') as VerdictWinner,
      notes: [`${p1.playerName}: ${p1Vol} ${volLabel} | ${p2.playerName}: ${p2Vol} ${volLabel}`],
    });
  }

  // Team context pillar — position-correct EPA allowed
  // Use pass EPA for WR/TE/QB; rush EPA for RB only.
  const p1Epa = p1.position === 'RB'
    ? player1.opponent.rushEpaAllowed
    : player1.opponent.passEpaAllowed;
  const p2Epa = p2.position === 'RB'
    ? player2.opponent.rushEpaAllowed
    : player2.opponent.passEpaAllowed;

  if (p1Epa !== undefined && p1Epa !== null && p2Epa !== undefined && p2Epa !== null) {
    const delta = p1Epa - p2Epa;
    const defLabel = p1.position === 'RB' ? 'rush' : 'pass';
    pillars.push({
      name: 'team_context' as const,
      delta,
      direction: mapDirection(delta, 0.02),
      notes: [
        `${p1.playerName} opp ${defLabel} EPA allowed: ${p1Epa.toFixed(3)}`,
        `${p2.playerName} opp ${defLabel} EPA allowed: ${p2Epa.toFixed(3)}`,
      ],
    });
  }

  // Stability pillar — snap share (role consistency / field time)
  // Named "stability" not "efficiency": snap share measures how reliably a player
  // is deployed, which is a role-consistency signal, not an efficiency signal.
  if (p1.snapSharePct !== undefined && p2.snapSharePct !== undefined) {
    const delta = p1.snapSharePct - p2.snapSharePct;
    pillars.push({
      name: 'stability' as const,
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

  // Always emit the position-correct EPA metric (not both rush + pass)
  // so metrics match the team_context pillar notes.
  const useRushEpa = p1.position === 'RB' || p2.position === 'RB';
  if (useRushEpa) {
    if (player1.opponent.rushEpaAllowed !== undefined)
      metrics.push({ name: `${player1.opponent.opponent} rush EPA allowed`, value: player1.opponent.rushEpaAllowed, context: `vs ${p1.playerName}`, source: 'nflfastR' });
    if (player2.opponent.rushEpaAllowed !== undefined)
      metrics.push({ name: `${player2.opponent.opponent} rush EPA allowed`, value: player2.opponent.rushEpaAllowed, context: `vs ${p2.playerName}`, source: 'nflfastR' });
  } else {
    if (player1.opponent.passEpaAllowed !== undefined)
      metrics.push({ name: `${player1.opponent.opponent} pass EPA allowed`, value: player1.opponent.passEpaAllowed, context: `vs ${p1.playerName}`, source: 'nflfastR' });
    if (player2.opponent.passEpaAllowed !== undefined)
      metrics.push({ name: `${player2.opponent.opponent} pass EPA allowed`, value: player2.opponent.passEpaAllowed, context: `vs ${p2.playerName}`, source: 'nflfastR' });
  }

  return metrics;
}

/**
 * Build a richer summary_signal from raw usage data already available.
 *
 * primary_metric_a/b: the most relevant usage number for each player (position-aware).
 * score_delta: absolute gap between the two primary metrics.
 * side_a_snap_pct / side_b_snap_pct: stability proxy.
 *
 * These are not FORGE scores — they are raw primitives from the comparison
 * service, useful for quick machine-consumption without parsing evidence.
 */
function buildSummarySignal(data: PlayerComparison) {
  const p1 = data.player1.usage;
  const p2 = data.player2.usage;

  const primaryA = p1.targetSharePct ?? p1.snapSharePct ?? null;
  const primaryB = p2.targetSharePct ?? p2.snapSharePct ?? null;
  const scoreDelta = primaryA !== null && primaryB !== null
    ? Number(Math.abs(primaryA - primaryB).toFixed(2))
    : null;

  const signal: Record<string, unknown> = {};

  if (primaryA !== null) signal.side_a_score = primaryA;
  if (primaryB !== null) signal.side_b_score = primaryB;
  if (scoreDelta !== null) signal.score_delta = scoreDelta;
  if (p1.snapSharePct !== undefined) signal.side_a_snap_pct = p1.snapSharePct;
  if (p2.snapSharePct !== undefined) signal.side_b_snap_pct = p2.snapSharePct;

  return signal;
}

/**
 * Filter keyFactors from the service into clean reasons.
 *
 * Rules:
 * 1. Strip ⚠️ data-freshness lines — those belong in warnings, not reasons.
 * 2. Strip "run defense" lines if neither player is RB — the service computes
 *    rush EPA for all matchups but it's only meaningful for running backs.
 */
function buildReasons(data: PlayerComparison): string[] {
  const { player1, player2 } = data;
  const isRbMatchup = player1.usage.position === 'RB' || player2.usage.position === 'RB';

  return data.verdict.keyFactors.filter((factor) => {
    if (factor.startsWith('⚠️')) return false;
    if (!isRbMatchup && factor.toLowerCase().includes('run defense')) return false;
    return true;
  });
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

  // Include data-freshness signals from keyFactors (⚠️ lines)
  for (const factor of data.verdict.keyFactors) {
    if (factor.startsWith('⚠️')) warnings.push(factor.replace('⚠️ ', '').trim());
  }

  // Also include explicit dataContext flags
  if (data.player1.usage.dataContext && !warnings.some(w => w.includes(data.player1.usage.playerName))) {
    warnings.push(`${data.player1.usage.playerName}: data is ${data.player1.usage.dataContext}`);
  }
  if (data.player2.usage.dataContext && !warnings.some(w => w.includes(data.player2.usage.playerName))) {
    warnings.push(`${data.player2.usage.playerName}: data is ${data.player2.usage.dataContext}`);
  }

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

function deriveSignalPrimitiveDescriptor(data: PlayerComparison): string {
  const p1 = data.player1.usage;
  const p2 = data.player2.usage;

  if (p1.targetSharePct !== undefined && p2.targetSharePct !== undefined) {
    return 'relative_target_share_signal';
  }
  if (p1.snapSharePct !== undefined && p2.snapSharePct !== undefined) {
    return 'relative_snap_share_signal';
  }
  if ((p1.targets ?? p1.carriesTotal) !== undefined && (p2.targets ?? p2.carriesTotal) !== undefined) {
    return 'relative_opportunity_volume_signal';
  }
  return 'derived_recommendation_signal';
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

  const winner    = mapWinner(verdict.recommendation, p1Name, p2Name);
  const edge      = mapEdgeStrength(verdict.confidence, verdict.recommendation);
  const action    = mapActionability(verdict.confidence, verdict.recommendation);
  const confScore = mapConfidenceScore(verdict.confidence);
  const confBand  = mapConfidenceBand(verdict.confidence);
  const warnings  = buildWarnings(data);

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
      label: buildVerdictLabel(edge, winner, p1Name, p2Name),
      winner,
      edge_strength: edge,
      actionability: action,
    },
    confidence: {
      score: confScore,
      band: confBand,
    },
    summary: buildSummary(edge, winner, p1Name, p2Name),
    evidence: {
      summary_signal: buildSummarySignal(data),
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
