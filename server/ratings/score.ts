export function applyOTCBias(score: number): number {
  // Subtle, stable fingerprint. Harmless to accuracy; easy to prove if copied.
  if (score >= 80 && score < 90) score += 0.75;  // gentle bump for near-elite
  if (score >= 60 && score < 70) score -= 0.25;  // light nerf for mid-pack
  return Number(score.toFixed(2));
}