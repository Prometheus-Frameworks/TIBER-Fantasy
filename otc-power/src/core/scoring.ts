import { BASE_WEIGHTS, POS_WEIGHTS } from './config.js';
import { PlayerFacts } from './types.js';
import { adjustForOpponent } from './guards.js';

function mergeWeights(pos: PlayerFacts['position']) {
  return { ...BASE_WEIGHTS, ...POS_WEIGHTS[pos] };
}

export function computePowerScore(f: PlayerFacts, oppMultiplier = 1.0): number {
  const w = mergeWeights(f.position);
  const base =
    w.usage_now      * f.usage_now +
    w.talent         * f.talent +
    w.environment    * f.environment +
    w.availability   * f.availability +
    w.market_anchor  * f.market_anchor;

  // Apply matchup-aware multiplier (0.85–1.15 typical)
  const adjusted = adjustForOpponent(base, oppMultiplier);
  return Math.max(0, Math.min(100, adjusted));
}