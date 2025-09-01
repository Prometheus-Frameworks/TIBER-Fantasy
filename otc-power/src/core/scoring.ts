import { BASE_WEIGHTS, POS_WEIGHTS } from './config.js';
import { PlayerFacts } from './types.js';

function mergeWeights(pos: PlayerFacts['position']) {
  return { ...BASE_WEIGHTS, ...POS_WEIGHTS[pos] };
}

export function computePowerScore(f: PlayerFacts): number {
  const w = mergeWeights(f.position);
  const score =
    w.usage_now      * f.usage_now +
    w.talent         * f.talent +
    w.environment    * f.environment +
    w.availability   * f.availability +
    w.market_anchor  * f.market_anchor;
  return Math.max(0, Math.min(100, score));
}