/**
 * FORGE SoS Multiplier Helper
 * 
 * Apply a mild Strength of Schedule multiplier to a base alpha score.
 * SoS impact is subtle (max ±10%).
 */

/**
 * Apply a mild Strength of Schedule multiplier to a base alpha score.
 *
 * @param baseAlpha - The alpha score computed from talent/env/matchup (pre-SoS).
 * @param sosValue - RoS SoS value (0–100, higher = easier).
 *
 * Returns:
 *  - norm: normalized SoS 0–1
 *  - multiplier: 0.90–1.10
 *  - finalAlpha: baseAlpha * multiplier
 */
export function applySosMultiplier(baseAlpha: number, sosValue: number): {
  norm: number;
  multiplier: number;
  finalAlpha: number;
} {
  if (!Number.isFinite(baseAlpha)) {
    throw new Error(`applySosMultiplier: invalid baseAlpha: ${baseAlpha}`);
  }

  // Safety clamp SoS to [0,100], default to 50 (neutral) if undefined/null.
  const raw = sosValue ?? 50;
  const clamped = Math.max(0, Math.min(100, raw));
  const norm = clamped / 100; // 0 (brutal) → 1 (cake)

  // 0.90 at norm=0, 1.00 at norm=0.5, 1.10 at norm=1
  const multiplier = 0.90 + norm * 0.20;
  const finalAlpha = baseAlpha * multiplier;

  return { norm, multiplier, finalAlpha };
}
