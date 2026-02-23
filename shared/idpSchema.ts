export type DefensivePosition = 'EDGE' | 'DI' | 'LB' | 'CB' | 'S';

export const IDP_POSITIONS: readonly DefensivePosition[] = ['EDGE', 'DI', 'LB', 'CB', 'S'];

export const NFL_TO_IDP_POSITION: Record<string, DefensivePosition> = {
  DE: 'EDGE',
  OLB: 'EDGE',
  EDGE: 'EDGE',
  DL: 'DI',
  DT: 'DI',
  NT: 'DI',
  ILB: 'LB',
  MLB: 'LB',
  LB: 'LB',
  CB: 'CB',
  FS: 'S',
  SS: 'S',
  S: 'S',
  DB: 'S',
};

export const HAVOC_PRIOR_SNAPS = 200;
export const HAVOC_PRIOR_RATE = 0.08;

export const IDP_TIER_THRESHOLDS: Record<DefensivePosition, [number, number, number, number]> = {
  EDGE: [82, 72, 58, 45],
  DI: [80, 70, 56, 43],
  LB: [84, 74, 60, 46],
  CB: [80, 70, 56, 43],
  S: [80, 70, 56, 43],
};

export function mapHavocToTier(alpha: number): string {
  if (alpha >= 82) return 'T1';
  if (alpha >= 72) return 'T2';
  if (alpha >= 58) return 'T3';
  if (alpha >= 45) return 'T4';
  return 'T5';
}
