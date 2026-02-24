import type { DefensivePosition } from '@shared/idpSchema';

export type CalibrationAnchors = { p5: number; p15: number; p30: number; p50: number; p70: number; p85: number; p95: number; max: number };

export const IDP_CALIBRATION_ANCHORS: Record<DefensivePosition, CalibrationAnchors> = {
  EDGE: { p5: 23.0, p15: 26.2, p30: 31.4, p50: 38.0, p70: 44.7, p85: 49.3, p95: 56.2, max: 67.3 },
  DI:   { p5: 22.9, p15: 24.1, p30: 25.7, p50: 28.0, p70: 33.4, p85: 42.2, p95: 46.8, max: 53.5 },
  LB:   { p5: 22.1, p15: 23.2, p30: 25.3, p50: 28.5, p70: 31.8, p85: 36.8, p95: 39.8, max: 47.7 },
  CB:   { p5: 26.8, p15: 29.1, p30: 31.7, p50: 34.5, p70: 38.6, p85: 42.8, p95: 45.4, max: 52.2 },
  S:    { p5: 25.3, p15: 27.0, p30: 30.5, p50: 33.3, p70: 36.1, p85: 39.9, p95: 44.2, max: 47.6 },
};

const ALPHA_MAP: Array<[string, number]> = [
  ['p5', 25],
  ['p15', 33],
  ['p30', 42],
  ['p50', 55],
  ['p70', 67],
  ['p85', 78],
  ['p95', 88],
  ['max', 95],
];

export function calibrateIdpAlpha(rawComposite: number, position: DefensivePosition): number {
  const a = IDP_CALIBRATION_ANCHORS[position];

  const rawKeys = ALPHA_MAP.map(([k]) => (a as any)[k] as number);
  const alphaKeys = ALPHA_MAP.map(([, v]) => v);

  if (rawComposite <= rawKeys[0]) return alphaKeys[0];
  if (rawComposite >= rawKeys[rawKeys.length - 1]) return alphaKeys[alphaKeys.length - 1];

  for (let i = 0; i < rawKeys.length - 1; i++) {
    if (rawComposite <= rawKeys[i + 1]) {
      const range = rawKeys[i + 1] - rawKeys[i];
      if (range <= 0) return alphaKeys[i];
      const t = (rawComposite - rawKeys[i]) / range;
      return Math.round((alphaKeys[i] + t * (alphaKeys[i + 1] - alphaKeys[i])) * 10) / 10;
    }
  }

  return 95;
}
