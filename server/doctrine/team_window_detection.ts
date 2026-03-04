// server/doctrine/team_window_detection.ts
// Evaluate whether a dynasty team is in a championship window, rebuilding, or transitioning.

import {
  type DoctrineEvaluation,
  type ContributingSignal,
  makeEvaluation,
  clamp,
  signalDirection,
  doctrineFetch,
} from './types';
import { PRIME_WINDOWS, AGE_DECAY_RATE } from './positional_aging_curves';

const MODULE_NAME = 'team_window_detection';

// ── Response types for FORGE batch endpoint ─────────────────

interface ForgeBatchPlayer {
  playerId: string;
  playerName: string;
  position: string;
  alpha: number;
  age?: number;
  nflTeam?: string;
  subScores?: {
    volume: number;
    efficiency: number;
    stability: number;
    contextFit: number;
  };
}

interface ForgeBatchResponse {
  scores?: ForgeBatchPlayer[];
  results?: ForgeBatchPlayer[];
}

// ── Primary export ──────────────────────────────────────────

export async function detectTeamWindow(
  leagueId: string,
  rosterId: string,
  playerIds: string[],
  apiKey: string,
  baseUrl: string,
): Promise<DoctrineEvaluation> {
  if (playerIds.length === 0) {
    return makeEvaluation({
      module: MODULE_NAME,
      entity_type: 'roster',
      entity_id: rosterId,
      evaluation_score: 0,
      confidence: 0.2,
      contributing_signals: [],
      reasoning: 'No players on roster — cannot evaluate team window.',
      meta: { window_classification: 'rebuild', elite_count: 0, starter_count: 0, median_alpha: 0, age_weighted_alpha: 0 },
    });
  }

  // Fetch FORGE batch for all roster players
  const batchData = await doctrineFetch<ForgeBatchResponse>(
    '/api/v1/forge/batch',
    apiKey,
    baseUrl,
    { method: 'POST', body: { player_ids: playerIds, mode: 'dynasty' } },
  );

  const players = batchData?.scores ?? batchData?.results ?? [];
  const matched = players.filter((p) => p.alpha !== undefined && p.alpha !== null);

  if (matched.length === 0) {
    return makeEvaluation({
      module: MODULE_NAME,
      entity_type: 'roster',
      entity_id: rosterId,
      evaluation_score: 0.3,
      confidence: 0.15,
      contributing_signals: [],
      reasoning: 'FORGE data unavailable for roster players. Defaulting to low-confidence rebuild classification.',
      meta: { window_classification: 'rebuild', elite_count: 0, starter_count: 0, median_alpha: 0, age_weighted_alpha: 0 },
    });
  }

  // Compute roster-level signals
  const alphas = matched.map((p) => p.alpha);
  const eliteCount = alphas.filter((a) => a >= 70).length;
  const starterCount = alphas.filter((a) => a >= 50 && a < 70).length;
  const medianAlpha = median(alphas);

  // Age-weighted alpha: weight each player by remaining prime window
  const ageWeightedAlpha = computeAgeWeightedAlpha(matched);

  // Top-3 average alpha
  const sortedDesc = [...alphas].sort((a, b) => b - a);
  const top3 = sortedDesc.slice(0, 3);
  const top3Alpha = top3.length > 0 ? top3.reduce((s, v) => s + v, 0) / top3.length : 0;

  // Score formula
  let score = ageWeightedAlpha / 100;
  if (eliteCount >= 2) score += 0.15;
  if (eliteCount === 0) score -= 0.20;
  if (top3Alpha < 45) score -= 0.15;
  if (medianAlpha < 35) score -= 0.10;
  score = clamp(score, 0, 1);

  // Window classification
  let windowClassification: string;
  if (score >= 0.70) {
    windowClassification = 'championship_window';
  } else if (score >= 0.45) {
    windowClassification = 'transitioning';
  } else {
    windowClassification = 'rebuild';
  }

  // Confidence based on data coverage
  const coverage = matched.length / playerIds.length;
  const confidence = clamp(0.5 + (coverage * 0.4), 0.3, 0.95);

  const signals: ContributingSignal[] = [
    { name: 'elite_count', value: eliteCount, weight: 0.25, direction: signalDirection(eliteCount - 1) },
    { name: 'starter_count', value: starterCount, weight: 0.15, direction: signalDirection(starterCount - 2) },
    { name: 'median_alpha', value: Math.round(medianAlpha * 10) / 10, weight: 0.20, direction: signalDirection(medianAlpha - 50) },
    { name: 'age_weighted_alpha', value: Math.round(ageWeightedAlpha * 10) / 10, weight: 0.25, direction: signalDirection(ageWeightedAlpha - 50) },
    { name: 'top3_alpha', value: Math.round(top3Alpha * 10) / 10, weight: 0.15, direction: signalDirection(top3Alpha - 50) },
  ];

  const reasoning = buildReasoning(windowClassification, eliteCount, starterCount, medianAlpha, score);

  return makeEvaluation({
    module: MODULE_NAME,
    entity_type: 'roster',
    entity_id: rosterId,
    evaluation_score: score,
    confidence,
    contributing_signals: signals,
    reasoning,
    meta: {
      window_classification: windowClassification,
      elite_count: eliteCount,
      starter_count: starterCount,
      median_alpha: Math.round(medianAlpha * 10) / 10,
      age_weighted_alpha: Math.round(ageWeightedAlpha * 10) / 10,
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────

function computeAgeWeightedAlpha(players: ForgeBatchPlayer[]): number {
  if (players.length === 0) return 0;

  let weightedSum = 0;
  let count = 0;

  for (const p of players) {
    const pos = normalizePosition(p.position);
    if (!pos) {
      // Unknown position — use alpha unweighted
      weightedSum += p.alpha;
      count++;
      continue;
    }

    const age = p.age ?? estimateDefaultAge(pos);
    const window = PRIME_WINDOWS[pos];
    const decayRate = AGE_DECAY_RATE[pos];

    let ageFactor: number;
    if (age <= window.peak[1]) {
      ageFactor = 1.0;
    } else if (age <= window.cliff) {
      const range = window.cliff - window.peak[1];
      const elapsed = age - window.peak[1];
      ageFactor = range > 0 ? 1.0 - (elapsed / range) * 0.5 : 0.5;
    } else {
      const yearsPastCliff = age - window.cliff;
      ageFactor = Math.max(0.1, 0.5 - (yearsPastCliff * decayRate));
    }

    weightedSum += p.alpha * ageFactor;
    count++;
  }

  return count > 0 ? weightedSum / count : 0;
}

function normalizePosition(pos: string): 'QB' | 'RB' | 'WR' | 'TE' | null {
  const upper = pos?.toUpperCase();
  if (upper === 'QB' || upper === 'RB' || upper === 'WR' || upper === 'TE') {
    return upper as 'QB' | 'RB' | 'WR' | 'TE';
  }
  return null;
}

function estimateDefaultAge(position: 'QB' | 'RB' | 'WR' | 'TE'): number {
  // Conservative default ages when age data is missing
  const defaults: Record<string, number> = { QB: 27, RB: 25, WR: 26, TE: 27 };
  return defaults[position];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildReasoning(
  classification: string,
  eliteCount: number,
  starterCount: number,
  medianAlpha: number,
  score: number,
): string {
  const label = classification.replace(/_/g, ' ');
  const parts: string[] = [
    `Team classified as ${label} (score: ${score.toFixed(2)}).`,
  ];

  if (eliteCount >= 2) {
    parts.push(`${eliteCount} elite-tier players anchor the roster.`);
  } else if (eliteCount === 1) {
    parts.push('Only one elite-tier player — roster lacks top-end concentration.');
  } else {
    parts.push('No elite-tier players detected — contention is unlikely without upgrades.');
  }

  if (medianAlpha < 35) {
    parts.push('Depth is thin with a sub-35 median alpha.');
  }

  return parts.join(' ');
}
