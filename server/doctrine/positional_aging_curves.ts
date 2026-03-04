// server/doctrine/positional_aging_curves.ts
// Given a player's age and position, score how far through their production window they are.

import {
  type DoctrineEvaluation,
  type ContributingSignal,
  type Position,
  makeEvaluation,
  clamp,
  signalDirection,
} from './types';

// ── Aging curve constants ───────────────────────────────────

export const PRIME_WINDOWS: Record<Position, { peak: [number, number]; cliff: number }> = {
  QB: { peak: [26, 33], cliff: 36 },
  RB: { peak: [22, 26], cliff: 28 },
  WR: { peak: [24, 29], cliff: 32 },
  TE: { peak: [25, 30], cliff: 33 },
};

export const AGE_DECAY_RATE: Record<Position, number> = {
  QB: 0.03,
  RB: 0.08,
  WR: 0.05,
  TE: 0.04,
};

const MODULE_NAME = 'positional_aging_curves';

// ── Primary export ──────────────────────────────────────────

export async function evaluateAgingCurve(
  playerId: string,
  playerAge: number,
  position: Position,
  forgeAlpha: number,   // 0–100
  _apiKey: string,
  _baseUrl: string,
): Promise<DoctrineEvaluation> {
  const window = PRIME_WINDOWS[position];
  const decayRate = AGE_DECAY_RATE[position];
  const [peakStart, peakEnd] = window.peak;

  let score: number;
  let primeStatus: string;

  if (playerAge < peakStart) {
    // Pre-prime: linearly approach 0.75 from 0.50 as age approaches peak start
    const yearsUntilPeak = peakStart - playerAge;
    score = 0.75 - (yearsUntilPeak * 0.05);
    score = clamp(score, 0.50, 0.75);
    primeStatus = 'pre_prime';
  } else if (playerAge >= peakStart && playerAge <= peakEnd) {
    // Within peak window: 0.75–1.0 scaled by FORGE alpha
    const alphaNorm = clamp(forgeAlpha / 100, 0, 1);
    score = 0.75 + (alphaNorm * 0.25);
    primeStatus = 'in_prime';
  } else if (playerAge > peakEnd && playerAge <= window.cliff) {
    // Between peak end and cliff: linear decay to 0.35
    const range = window.cliff - peakEnd;
    const yearsPostPeak = playerAge - peakEnd;
    const t = range > 0 ? yearsPostPeak / range : 1;
    score = 0.75 - (t * 0.40); // 0.75 → 0.35
    primeStatus = 'declining';
  } else {
    // Past cliff: apply AGE_DECAY_RATE per year, floor at 0.05
    const yearsPastCliff = playerAge - window.cliff;
    score = 0.35 - (yearsPastCliff * decayRate);
    score = Math.max(score, 0.05);
    primeStatus = 'post_cliff';
  }

  score = clamp(score, 0, 1);

  // Confidence: base 0.70, adjusted by forge alpha
  let confidence = 0.70;
  if (forgeAlpha >= 70) {
    // Elite players age better → higher certainty in the curve
    confidence += (forgeAlpha - 70) / 30 * 0.15;  // up to +0.15
  } else if (forgeAlpha < 40) {
    confidence -= 0.10;
  }
  confidence = clamp(confidence, 0.30, 0.95);

  const yearsFromPeak = playerAge < peakStart
    ? peakStart - playerAge
    : playerAge > peakEnd
      ? playerAge - peakEnd
      : 0;

  const signals: ContributingSignal[] = [
    { name: 'age', value: playerAge, weight: 0.35, direction: signalDirection(peakEnd - playerAge) },
    { name: 'position', value: position, weight: 0.15, direction: 'neutral' },
    { name: 'years_from_peak', value: yearsFromPeak, weight: 0.20, direction: signalDirection(-yearsFromPeak) },
    { name: 'forge_alpha', value: forgeAlpha, weight: 0.20, direction: signalDirection(forgeAlpha - 50) },
    { name: 'prime_window_status', value: primeStatus, weight: 0.10, direction: primeStatus === 'in_prime' ? 'positive' : primeStatus === 'pre_prime' ? 'neutral' : 'negative' },
  ];

  const reasoning = buildReasoning(playerAge, position, primeStatus, forgeAlpha, score);

  return makeEvaluation({
    module: MODULE_NAME,
    entity_type: 'player',
    entity_id: playerId,
    evaluation_score: score,
    confidence,
    contributing_signals: signals,
    reasoning,
    meta: { prime_window_status: primeStatus, years_from_peak: yearsFromPeak },
  });
}

// ── Helpers ─────────────────────────────────────────────────

function buildReasoning(
  age: number,
  position: Position,
  status: string,
  alpha: number,
  score: number,
): string {
  const pos = position;
  const window = PRIME_WINDOWS[position];
  const ageStr = age.toFixed(1);

  switch (status) {
    case 'pre_prime':
      return `${pos} at age ${ageStr} has not yet entered the prime window (${window.peak[0]}–${window.peak[1]}). Dynasty value is rising with upside ahead.`;
    case 'in_prime':
      return `${pos} at age ${ageStr} is within peak production years (${window.peak[0]}–${window.peak[1]}). FORGE alpha of ${alpha.toFixed(0)} supports a strong aging outlook (score: ${score.toFixed(2)}).`;
    case 'declining':
      return `${pos} at age ${ageStr} is past peak (${window.peak[1]}) and trending toward the cliff at ${window.cliff}. Dynasty value is depreciating.`;
    case 'post_cliff':
      return `${pos} at age ${ageStr} is past the positional cliff (${window.cliff}). Expect accelerating decline at ${(AGE_DECAY_RATE[position] * 100).toFixed(0)}% per year.`;
    default:
      return `${pos} at age ${ageStr} evaluated with score ${score.toFixed(2)}.`;
  }
}
