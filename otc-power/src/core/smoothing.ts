import { SMOOTHING, EVENT_BYPASS_FLAGS } from './config.js';

export function clampDelta(prev: number|undefined, next: number, flags: string[]) {
  if (!prev) return next;
  if (flags.some(f => EVENT_BYPASS_FLAGS.has(f))) return next;
  const cap = SMOOTHING.max_weekly_delta;
  const delta = Math.max(-cap, Math.min(cap, next - prev));
  return Math.max(0, Math.min(100, prev + delta));
}