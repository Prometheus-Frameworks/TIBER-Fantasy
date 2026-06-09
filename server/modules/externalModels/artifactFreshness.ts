/**
 * Warn-only artifact freshness assessment (Issue #192, finding M3).
 *
 * Promoted/external artifacts carry generated_at / promoted_at timestamps that
 * adapters parse but never assess. This helper surfaces artifact age in logs
 * and adapter metadata WITHOUT changing product behavior: it never throws and
 * never rejects an artifact based on age. Fail-closed enforcement is a future
 * phase, after observing normal offseason artifact age.
 */

export type ArtifactFreshnessStatus = 'fresh' | 'warning' | 'stale' | 'unknown';

export interface ArtifactFreshness {
  /** fresh: age <= maxAgeDays; warning: <= 2x maxAgeDays; stale: older; unknown: no usable timestamp. */
  status: ArtifactFreshnessStatus;
  /** Whole days since the timestamp (floored, never negative); null when unknown. */
  ageDays: number | null;
  /** Timestamp the assessment used (generatedAt preferred, promotedAt fallback); null when unknown. */
  timestamp: string | null;
  /** Threshold the status was computed against. */
  maxAgeDays: number;
}

/**
 * Provisional generic default until per-artifact age policies exist.
 * Chosen conservatively for warn-only observation — not tuned per artifact.
 */
export const DEFAULT_ARTIFACT_MAX_AGE_DAYS = 45;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseTimestampMs(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Picks the newest parseable timestamp from a list. Useful for lab artifacts
 * where freshness lives on per-row provenance rather than the artifact root.
 */
export function pickNewestTimestamp(values: Array<string | null | undefined>): string | null {
  let newest: string | null = null;
  let newestMs = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    const ms = parseTimestampMs(value);
    if (ms != null && ms > newestMs) {
      newestMs = ms;
      newest = value as string;
    }
  }
  return newest;
}

export interface ArtifactFreshnessInput {
  /** Stable artifact name for logs/throttling, e.g. 'player_ownership_v0'. */
  artifact: string;
  generatedAt?: string | null;
  promotedAt?: string | null;
  maxAgeDays?: number;
  /** Injectable clock for tests. */
  now?: Date;
}

/** Never throws; malformed/missing timestamps yield status 'unknown'. */
export function assessArtifactFreshness(input: ArtifactFreshnessInput): ArtifactFreshness {
  const maxAgeDays =
    typeof input.maxAgeDays === 'number' && input.maxAgeDays > 0
      ? input.maxAgeDays
      : DEFAULT_ARTIFACT_MAX_AGE_DAYS;

  const timestamp =
    parseTimestampMs(input.generatedAt) != null
      ? (input.generatedAt as string)
      : parseTimestampMs(input.promotedAt) != null
        ? (input.promotedAt as string)
        : null;

  const timestampMs = parseTimestampMs(timestamp);
  if (timestampMs == null) {
    return { status: 'unknown', ageDays: null, timestamp: null, maxAgeDays };
  }

  const nowMs = (input.now ?? new Date()).getTime();
  // Future timestamps (producer/consumer clock skew) count as age 0, not an error.
  const ageDays = Math.max(0, Math.floor((nowMs - timestampMs) / MS_PER_DAY));

  const status: ArtifactFreshnessStatus =
    ageDays <= maxAgeDays ? 'fresh' : ageDays <= maxAgeDays * 2 ? 'warning' : 'stale';

  return { status, ageDays, timestamp, maxAgeDays };
}

// Adapters run per-request, so non-fresh warnings are throttled per
// artifact+status to avoid log noise on hot paths.
const LOG_THROTTLE_MS = 6 * 60 * 60 * 1000;
const lastLoggedAtMs = new Map<string, number>();

/**
 * Assess and (throttled) warn when an artifact is not fresh. Logs metadata
 * only — never payload contents. Warn-only: callers must not branch product
 * behavior on the result in this phase.
 */
export function assessAndLogArtifactFreshness(input: ArtifactFreshnessInput): ArtifactFreshness {
  const freshness = assessArtifactFreshness(input);
  if (freshness.status === 'fresh') return freshness;

  const key = `${input.artifact}:${freshness.status}`;
  const nowMs = (input.now ?? new Date()).getTime();
  const last = lastLoggedAtMs.get(key);
  if (last == null || nowMs - last >= LOG_THROTTLE_MS) {
    lastLoggedAtMs.set(key, nowMs);
    console.warn(
      `[artifactFreshness] ${input.artifact}: status=${freshness.status}` +
        ` ageDays=${freshness.ageDays ?? 'n/a'} timestamp=${freshness.timestamp ?? 'missing'}` +
        ` maxAgeDays=${freshness.maxAgeDays} (warn-only, not enforced)`,
    );
  }
  return freshness;
}

/** Test hook: clears the warn throttle state. */
export function resetArtifactFreshnessLogThrottle(): void {
  lastLoggedAtMs.clear();
}
