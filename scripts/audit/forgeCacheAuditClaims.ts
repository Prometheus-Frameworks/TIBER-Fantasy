/**
 * The claim contract for the Fantasy #310 audit.
 *
 * Lives in its own module for the same reason `forgeCacheResponseGuard.ts`
 * does: `forgeCacheAudit.ts` runs as ESM under tsx (it uses `import.meta.url`),
 * which the Jest/ts-jest CommonJS pipeline cannot parse. Everything here is
 * pure, so the script and the test suite share one definition of what this
 * audit may and may not claim, rather than the tests re-asserting string
 * literals that could drift from the script.
 */

import { createHash } from 'crypto';

export function sha256Text(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * The committed observation, frozen as a complete file.
 *
 * These are the bytes captured on 2026-08-09, exactly as first committed —
 * envelope, wording and all. The file is a dated historical record and is
 * **never rewritten**: not to correct its wording, not to attach a status, not
 * to re-observe. Everything this audit needs to say *about* the observation is
 * said outside it, in the manifest and report, and `--check` pins the complete
 * file digest so any edit — however well-intentioned — fails loudly.
 */
export const FROZEN_COHORT = {
  committed_path: 'docs/audits/assets/310-live-cohort-observed.json',
  sha256: '118c5cc60bc59c6f3b9ca8d35ebcce4cf4e4442adacbb72fa77fd5109204f106',
  observed_at: '2026-08-09T19:56:19.909Z',
  row_count: 357,
  /**
   * The frozen file's own source description, quoted verbatim. It asserts
   * "(which serves Railway forge_grade_cache)" — a producer attribution the
   * capture never established (see OBSERVATION_EVIDENCE_STATUS). The wording
   * is superseded, not rewritten: the historical record keeps saying what it
   * said, and the manifest states on the record that the parenthetical is not
   * supported by the captured bytes.
   */
  superseded_source_description:
    'Public HTTP GET of /api/rankings/v2/weekly (which serves Railway forge_grade_cache) ' +
    'for QB/RB/WR/TE at season=2025, asOfWeek=18, limit=300.',
} as const;

/** The manifest's own, current description of the same request. */
export const CURRENT_SOURCE_DESCRIPTION =
  'Public HTTP GET of /api/rankings/v2/weekly for QB/RB/WR/TE at season=2025, ' +
  'asOfWeek=18, limit=300. The responding producer path was not recorded at capture time.';

/**
 * Named for the observed cohort, not for a producer.
 *
 * The previous name asserted, in its own wording, that the rows came from the
 * legacy cache — precisely the attribution the capture cannot support.
 * Quarantine is the policy response to insufficient provenance; it is not a
 * verdict about which producer answered.
 */
export const TERMINAL_FINDING = 'observed_ranking_cohort_quarantined_insufficient_provenance';

export const SUPERSEDED_TERMINAL_FINDING = 'legacy_forge_cache_quarantined_insufficient_provenance';

/**
 * The evidence status of the frozen cohort.
 *
 * The rows were captured before `forgeCacheResponseGuard.ts` existed. That
 * guard is what binds a response to a producer path; without it, nothing was
 * recorded at capture time that can say which producer served the bytes. The
 * same endpoint serves promoted scoring-service items whenever
 * `SCORING_SERVICE_BASE_URL` is configured and the call succeeds, so "it came
 * from the legacy cache" was an inference from what the endpoint usually
 * serves — not an observation.
 *
 * This is visible in the frozen bytes, not merely inferred from the guard's
 * absence: `ObservedPositionSource` declares `layer` and `source`, and the
 * frozen per-position records carry only `asOf` and `fallbackReason`.
 */
export const OBSERVATION_EVIDENCE_STATUS = {
  status: 'unverified_predates_lineage_guard',
  closed: true,
  captured_before_guard: 'scripts/audit/forgeCacheResponseGuard.ts',
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
    'None into this artifact. The observation is closed; the frozen file is never ' +
    'rewritten or re-captured. Any future guarded observation is a NEW, separately ' +
    'dated artifact at a new path, made with the lineage guard recording the ' +
    'serving layer.',
} as const;

/**
 * Producer paths the frozen observation cannot be attributed to. The claim
 * scanner refuses any current assertion naming one of these, so a later edit
 * cannot quietly restore the attribution the bytes do not support.
 */
export const UNSUPPORTED_LINEAGE_TERMS = [
  'forge_grade_cache',
  'scoring service',
  'scoring_service',
  'promoted artifact',
  'promoted_artifact',
] as const;

/**
 * Fields exempt from the claim scan, each for a stated reason. An explicit
 * allow-list rather than a heuristic: a scanner that tried to tell an
 * assertion from a denial by reading prose would fail silently.
 */
export const CLAIM_SCAN_EXEMPT_KEYS: Record<string, string> = {
  // Names the investigation's subject question ("what is the lineage of the
  // Railway forge_grade_cache?"), not a claim about which producer served the
  // observed rows. The frozen cohort carries the same id.
  audit: 'investigation title, not an attribution of the observation',
  // Verbatim quotes of the frozen file's historical wording, present exactly
  // so the supersession is on the record.
  superseded_source_description: 'verbatim quote of the superseded historical wording',
  superseded_finding_name: 'the retired finding name, retained as a record',
  // Text that names producers in order to DENY the observation supports them.
  does_not_support: 'disclaimer that must name the producers it refuses',
  missing_field_consequence: 'explains why the producer cannot be identified',
  supersession_note: 'states which historical claim is being superseded and why',
};

/** Every string value under `node`, excluding exempt keys. */
export function currentClaimStrings(node: unknown): string[] {
  const out: string[] = [];
  const walk = (value: unknown, exempt: boolean) => {
    if (typeof value === 'string') { if (!exempt) out.push(value); return; }
    if (Array.isArray(value)) { value.forEach((v) => walk(v, exempt)); return; }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        walk(child, exempt || key in CLAIM_SCAN_EXEMPT_KEYS);
      }
    }
  };
  walk(node, false);
  return out;
}

/** Producer-attribution claims found in current (non-exempt) text. Empty = clean. */
export function unsupportedLineageClaims(node: unknown): string[] {
  return currentClaimStrings(node)
    .flatMap((text) => UNSUPPORTED_LINEAGE_TERMS
      .filter((term) => text.toLowerCase().includes(term))
      .map((term) => `current text attributes a producer path ("${term}"): ${JSON.stringify(text.slice(0, 120))}`));
}
