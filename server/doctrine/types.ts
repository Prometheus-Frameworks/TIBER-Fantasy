// server/doctrine/types.ts
// Shared contract for all Doctrine Layer modules.

export type DoctrineEntityType =
  | 'player'
  | 'roster'
  | 'trade'
  | 'pick'
  | 'window';

export interface ContributingSignal {
  name: string;
  value: number | string;
  weight: number;       // 0–1, how much this signal moved the score
  direction: 'positive' | 'negative' | 'neutral';
}

export interface DoctrineEvaluation {
  module: string;                         // e.g. 'positional_aging_curves'
  entity_type: DoctrineEntityType;
  entity_id: string;                      // player gsis_id, roster external_id, etc.
  evaluation_score: number;               // 0–1
  confidence: number;                     // 0–1
  contributing_signals: ContributingSignal[];
  reasoning: string;                      // 1–3 sentence plain-English summary
  generated_at: string;                   // ISO timestamp
  meta?: Record<string, unknown>;         // optional module-specific extras
}

export class DoctrineError extends Error {
  public readonly module: string;
  public readonly entity_id: string;

  constructor(message: string, module: string, entity_id: string) {
    super(message);
    this.name = 'DoctrineError';
    this.module = module;
    this.entity_id = entity_id;
  }
}

/**
 * Build a complete DoctrineEvaluation from a partial, filling in defaults
 * and stamping generated_at.
 */
export function makeEvaluation(partial: Partial<DoctrineEvaluation>): DoctrineEvaluation {
  return {
    module: partial.module ?? 'unknown',
    entity_type: partial.entity_type ?? 'player',
    entity_id: partial.entity_id ?? '',
    evaluation_score: clamp(partial.evaluation_score ?? 0.5, 0, 1),
    confidence: clamp(partial.confidence ?? 0.5, 0, 1),
    contributing_signals: partial.contributing_signals ?? [],
    reasoning: partial.reasoning ?? '',
    generated_at: new Date().toISOString(),
    ...(partial.meta !== undefined ? { meta: partial.meta } : {}),
  };
}

// ── Shared helpers ──────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function signalDirection(value: number, threshold = 0): 'positive' | 'negative' | 'neutral' {
  if (value > threshold) return 'positive';
  if (value < threshold) return 'negative';
  return 'neutral';
}

// ── Types consumed by roster_construction_heuristics ─────────

export interface ScoringProfile {
  format: 'ppr' | 'half_ppr' | 'standard' | 'custom';
  rec_multiplier: number;
  te_premium: number;
  bonus_rec_te: number;
  pass_td_pts: number;
  rush_td_pts: number;
  rec_td_pts: number;
  dynasty_relevant: boolean;
}

export interface PickRecord {
  id: string;
  season: number;
  round: number;
  source: string;
  original_roster_id: string;
  current_roster_id: string;
  original_team: { id: string; display_name: string } | null;
  current_team: { id: string; display_name: string } | null;
  synced_at: string;
}

// ── Shared HTTP helper for doctrine modules ─────────────────

export type Position = 'QB' | 'RB' | 'WR' | 'TE';

/**
 * Typed fetch helper that all doctrine modules use to call internal v1 endpoints.
 * Unwraps the v1 `{ data: ... }` envelope. Returns null on non-OK status
 * instead of throwing, so callers can degrade confidence gracefully.
 */
export async function doctrineFetch<T>(
  path: string,
  apiKey: string,
  baseUrl: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T | null> {
  const url = `${baseUrl}${path}`;
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    'x-tiber-key': apiKey,
    'content-type': 'application/json',
  };

  const init: RequestInit = { method, headers };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const json = await res.json() as Record<string, unknown>;
    // v1 endpoints wrap in { data: ... }
    return (json.data !== undefined ? json.data : json) as T;
  } catch {
    return null;
  }
}
