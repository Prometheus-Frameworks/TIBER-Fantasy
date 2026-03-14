export type TierInfo = { label: string; short: string; color: string; bg: string; text: string };

export type SortKey = 'alpha' | 'raw' | 'plays' | 'leverage' | 'opponent' | 'script' | 'name';

export const COMPONENT_EXPLANATIONS: Record<string, string> = {
  Leverage: 'Win probability swing per play — high means they produced when the game was on the line.',
  Opponent: 'Adjustment for defense quality — performing well vs strong defenses scores higher.',
  'Game Script': 'Boost for trailing/competitive situations — filters out garbage-time stat padding.',
  Recency: 'Recent weeks weighted more — measures sustained clutch production, not just early-season.',
};

export function num(v: unknown, digits = 1): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

export function getTier(alpha: number): TierInfo {
  if (alpha >= 85) return { label: 'Elite Clutch', short: 'Elite', color: 'text-emerald-700', bg: 'bg-emerald-100', text: 'text-emerald-800' };
  if (alpha >= 65) return { label: 'Clutch', short: 'Clutch', color: 'text-green-700', bg: 'bg-green-100', text: 'text-green-800' };
  if (alpha >= 45) return { label: 'Neutral', short: 'Neutral', color: 'text-gray-600', bg: 'bg-gray-100', text: 'text-gray-700' };
  if (alpha >= 25) return { label: 'Low Signal', short: 'Low', color: 'text-amber-700', bg: 'bg-amber-100', text: 'text-amber-800' };
  return { label: 'Garbage Time Risk', short: 'GBG', color: 'text-red-600', bg: 'bg-red-100', text: 'text-red-700' };
}

export function tierDescription(alpha: number): string {
  const tier = getTier(alpha);
  if (alpha >= 85) return `${tier.label} — This player consistently delivered in high-leverage moments against quality defenses. A top-tier clutch performer.`;
  if (alpha >= 65) return `${tier.label} — Reliable in meaningful situations. Produced more often when the game was competitive.`;
  if (alpha >= 45) return `${tier.label} — Production was context-neutral. Neither a clutch specialist nor a garbage-time padder.`;
  if (alpha >= 25) return `${tier.label} — Production leaned toward lower-leverage situations. Needs scrutiny before trusting in big spots.`;
  return `${tier.label} — Stats accumulated heavily in garbage time. Context-adjusted value is significantly lower than raw numbers suggest.`;
}

export function barWidth(value: number, max: number): string {
  return `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
}
