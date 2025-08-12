// server/consensus/curves.ts
// Smooth, monotonic transform so rank spacing is realistic at the top.
// Tune a/b if needed (defaults work well for 1–300).
export const RANK_SCORE_CURVE = { a: 1000, b: 1.2 } as const;

export function rankToScore(rank: number, a = RANK_SCORE_CURVE.a, b = RANK_SCORE_CURVE.b) {
  // Higher score = better player. rank>=1.
  const r = Math.max(1, rank);
  return a / Math.pow(r, b);
}

export function scoreToRank(score: number, a = RANK_SCORE_CURVE.a, b = RANK_SCORE_CURVE.b) {
  // Inverse of rankToScore. Lower rank = better.
  const s = Math.max(1e-6, score);
  return Math.round(Math.pow(a / s, 1 / b));
}

// Example: apply dynasty injury multiplier (k) then map back to rank
export function adjustRankWithMultiplier(rank: number, k: number) {
  const base = rankToScore(rank);
  const adj = base * k;            // k < 1.0 pushes rank down (worse), k > 1.0 up (rare)
  return scoreToRank(adj);
}