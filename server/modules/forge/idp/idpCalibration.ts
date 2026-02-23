import type { DefensivePosition } from '@shared/idpSchema';

export const IDP_CALIBRATION_ANCHORS: Record<DefensivePosition, { p10: number; p25: number; p50: number; p75: number; p90: number }> = {
  EDGE: { p10: 30, p25: 40, p50: 52, p75: 65, p90: 78 },
  DI: { p10: 28, p25: 38, p50: 50, p75: 63, p90: 76 },
  LB: { p10: 30, p25: 42, p50: 55, p75: 68, p90: 80 },
  CB: { p10: 28, p25: 40, p50: 52, p75: 65, p90: 78 },
  S: { p10: 28, p25: 38, p50: 50, p75: 63, p90: 76 },
};

export function calibrateIdpAlpha(rawAlpha: number, position: DefensivePosition): number {
  const a = IDP_CALIBRATION_ANCHORS[position];
  if (rawAlpha <= a.p10) return 25;
  if (rawAlpha >= a.p90) return 95;
  const normalized = (rawAlpha - a.p10) / (a.p90 - a.p10);
  return Math.max(25, Math.min(95, 25 + normalized * 70));
}
