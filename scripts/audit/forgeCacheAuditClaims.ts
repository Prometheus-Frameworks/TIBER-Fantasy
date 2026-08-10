/**
 * The claim contract for the Fantasy #310 audit.
 *
 * Lives in its own module for the same reason `forgeCacheResponseGuard.ts` does:
 * `forgeCacheAudit.ts` runs as ESM under tsx (it uses `import.meta.url`), which
 * the Jest/ts-jest CommonJS pipeline cannot parse. Everything here is pure, so
 * both the script and the test suite can share one definition of what this
 * audit is and is not allowed to claim — rather than the tests re-asserting
 * string literals that could drift from the script.
 */

import { createHash } from 'crypto';

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Digest of the captured rows alone, independent of the envelope around them. */
export function rowsDigest(rows: unknown): string {
  return sha256(canonicalJson(rows));
}

/**
 * Named for the observed cohort, not for a producer.
 *
 * The previous name — `legacy_forge_cache_quarantined_insufficient_provenance` —
 * asserted in its own wording that the bytes came from the legacy cache, which
 * is precisely the attribution the capture cannot support. Quarantine is the
 * policy response to insufficient provenance; it is not a verdict about which
 * producer answered.
 */
export const TERMINAL_FINDING = 'observed_ranking_cohort_quarantined_insufficient_provenance';

export const SUPERSEDED_TERMINAL_FINDING = 'legacy_forge_cache_quarantined_insufficient_provenance';

/**
 * The evidence status of the committed cohort bytes.
 *
 * These rows were captured before `forgeCacheResponseGuard.ts` existed. The
 * guard is what binds a response to a producer path; without it, nothing was
 * recorded at capture time that can say which producer served those bytes. The
 * same endpoint serves promoted scoring-service items whenever
 * `SCORING_SERVICE_BASE_URL` is configured and the call succeeds, so "it came
 * from the legacy cache" was an inference from what the endpoint usually
 * serves, not an observation.
 *
 * The bytes are preserved unchanged rather than re-observed. A fresh guarded
 * capture would answer a different day's question and would destroy the record
 * of what was actually returned on the observation date. So the observation is
 * kept, dated, digest-pinned and closed — and the CLAIM is narrowed to what the
 * bytes can carry on their own.
 */
export const OBSERVATION_EVIDENCE_STATUS = {
  status: 'unverified_predates_lineage_guard',
  closed: true,
  immutable: true,
  captured_before_guard: 'scripts/audit/forgeCacheResponseGuard.ts',
  // Not an argument from absence of the guard alone — the gap is visible in the
  // committed bytes. `ObservedPositionSource` declares `layer` and `source`;
  // the committed per-position records carry only `asOf` and `fallbackReason`.
  // The serving layer was never captured, so it cannot be read back out.
  observed_fields_present: ['asOf', 'fallbackReason'],
  observed_fields_missing: ['layer', 'source'],
  missing_field_consequence:
    'The serving layer was not recorded for any position, so the committed bytes ' +
    'cannot identify which producer answered. A recorded scoringFallbackReason of ' +
    '"config_error" says the scoring service call failed; it does not record what ' +
    'served the rows instead.',
  supports: [
    'structural observations about the captured rows: row counts, per-position counts, identifier shape and namespace',
    'descriptive numeric observations computed from the captured alpha values: clamping bounds, floor/ceiling concentration, and joined-row agreement and spread',
  ],
  does_not_support: [
    'that the response was produced by forge_grade_cache',
    'that the response was produced by the promoted scoring service',
    'that the response was produced by any other named producer path',
  ],
  reobservation:
    'None. This observation is closed. It is not to be replaced by a fresh capture; ' +
    'a guarded re-observation would be a new, separately dated observation.',
} as const;

/**
 * Producer paths this observation cannot be attributed to. `--check` refuses any
 * lineage claim naming one of these anywhere in the observation envelope, so a
 * later edit cannot quietly restore the attribution the bytes do not support.
 */
export const UNSUPPORTED_LINEAGE_TERMS = [
  'forge_grade_cache',
  'scoring service',
  'scoring_service',
  'promoted artifact',
  'promoted_artifact',
] as const;

/**
 * The immutable observation, pinned independently of the file that carries it.
 *
 * Reclassifying the observation necessarily rewrites the cohort FILE — the
 * status block lives inside it — so the file digest cannot itself be the thing
 * held immutable. What must never move is the captured payload: the rows as
 * returned, and the instant they were captured. Those are pinned here and
 * enforced by `--check`, so the annotation can be corrected while the
 * observation underneath it demonstrably cannot.
 *
 * `superseded_envelope_sha256` is the digest of the cohort file as originally
 * committed, before the evidence status was attached. It is retained as the
 * chain-of-custody record linking the two.
 */
export const PRESERVED_OBSERVATION = {
  observed_at: '2026-08-09T19:56:19.909Z',
  row_count: 357,
  rows_sha256: 'abe387160f400256f68ee8a671d68978f938824b6b8e5591a395cae40d11eadf',
  superseded_envelope_sha256: '118c5cc60bc59c6f3b9ca8d35ebcce4cf4e4442adacbb72fa77fd5109204f106',
  note:
    'Captured rows and capture instant, unchanged since first commit. The cohort file ' +
    'digest moved when the pre-lineage-guard evidence status was attached; this payload ' +
    'did not. Rerunning production GETs would replace the observation and is prohibited.',
} as const;

/**
 * Fields whose whole purpose is to name a producer path in order to DENY that
 * the observation supports it. Excluded from the claim scan — otherwise the
 * disclaimers would be flagged as the very claims they exist to refuse.
 *
 * Kept to an explicit allow-list rather than a heuristic: a scanner that tried
 * to tell an assertion from a denial by reading the surrounding prose would be
 * the wrong kind of clever, and the failure mode is silent.
 */
export const CLAIM_DISCLAIMER_KEYS = new Set([
  'does_not_support',
  'missing_field_consequence',
]);

/**
 * Every string under the observation envelope, except the disclaimer fields —
 * which must name the producer paths in order to disclaim them.
 */
export function observationClaimStrings(observation: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown, underDisclaimer: boolean) => {
    if (typeof node === 'string') { if (!underDisclaimer) out.push(node); return; }
    if (Array.isArray(node)) { node.forEach((n) => walk(n, underDisclaimer)); return; }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        walk(value, underDisclaimer || CLAIM_DISCLAIMER_KEYS.has(key));
      }
    }
  };
  walk(observation, false);
  return out;
}

/** Lineage claims the committed bytes cannot support. Empty means clean. */
export function unsupportedLineageClaims(observation: unknown): string[] {
  return observationClaimStrings(observation)
    .flatMap((text) => UNSUPPORTED_LINEAGE_TERMS
      .filter((term) => text.toLowerCase().includes(term))
      .map((term) => `observation text attributes a producer path ("${term}"): ${JSON.stringify(text.slice(0, 120))}`));
}

/**
 * Median of an already-ascending numeric array.
 *
 * An even-sized cohort has no single middle element, so it is the mean of the
 * two middle values. `sorted[Math.floor(n / 2)]` — what this used to be — is
 * the upper of the two, which is a different statistic: on the 50 joined rows
 * it reported -2.74 where the median is -3.215.
 *
 * Rounding follows the convention already documented for this audit: individual
 * deltas are held to 2dp. The mean of two 2dp values lands on at most 3dp, so
 * rounding the mean to 3dp is exact — it removes the binary-float residue
 * without introducing a second, lossy rounding step that would move the
 * reported midpoint off the real one.
 */
export function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = sorted.length / 2;
  if (!Number.isInteger(mid)) return sorted[Math.floor(mid)];
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(3));
}
