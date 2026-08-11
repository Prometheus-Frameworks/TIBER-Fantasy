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

export const GSIS_SHAPE = /^00-\d{7}$/;

export interface RowIdentity {
  /** The producer's own key — the GSIS identifier, and the only join key. */
  sourceId: string;
  sourceType: 'canonical' | 'gsis' | 'unknown';
  /** Canonical public key; null = unresolved, undefined = never recorded. */
  canonicalId?: string | null;
}

/**
 * The identity to record for one `/api/rankings/v2/weekly` item.
 *
 * Fantasy #313 is current-main law: `item.playerId` is the canonical public key
 * and nothing else, and it is **null** whenever identity did not resolve. The
 * producer's own key lives in `item.identity.sourceId`. Reading `playerId` as
 * the observation's identifier therefore records canonical keys — and empty
 * strings for the unresolved rows — under a field the audit later joins against
 * the GSIS-keyed static artifact, which quietly shrinks the intersection and
 * makes the comparison describe fewer players than it claims.
 *
 * A response with no identity envelope is refused rather than falling back to
 * `playerId`: without the envelope the audit cannot tell which namespace that
 * field is in, and guessing is the whole defect.
 */
export function rowIdentityFromResponseItem(item: any, where: string): RowIdentity {
  const identity = item?.identity;
  if (!identity || typeof identity.sourceId !== 'string' || identity.sourceId === '') {
    throw new Error(
      `${where}: ranking item carries no identity.sourceId, so the producer key was not observed. ` +
      'Falling back to item.playerId is not permitted — since Fantasy #313 that field is ' +
      'canonical-only and null when unresolved, and recording it as the producer key breaks ' +
      'the join against the GSIS-keyed static artifact.',
    );
  }
  const sourceType: RowIdentity['sourceType'] =
    identity.sourceType === 'gsis' || identity.sourceType === 'canonical'
      ? identity.sourceType
      : 'unknown';
  return {
    sourceId: identity.sourceId,
    sourceType,
    canonicalId: typeof item?.playerId === 'string' ? item.playerId : null,
  };
}

/**
 * The identity of a row read back from a committed cohort file.
 *
 * A cohort written after this change records `sourceId` explicitly. The frozen
 * 2026-08-09 file predates both the identity envelope and Fantasy #313: its
 * `playerId` values are GSIS keys, because at capture time that field still
 * carried the producer's key. Reading it as the producer key is correct *for
 * that file* and is deliberately not extended to any observation that records
 * `sourceId` — the canonical state was never observed there, so it is reported
 * as not recorded rather than as unresolved.
 */
export function rowIdentityFromCohortRow(row: any, where: string): RowIdentity {
  if (typeof row?.sourceId === 'string' && row.sourceId !== '') {
    return {
      sourceId: row.sourceId,
      sourceType: row.sourceType === 'gsis' || row.sourceType === 'canonical' ? row.sourceType : 'unknown',
      canonicalId: row.canonicalId === undefined ? undefined : row.canonicalId,
    };
  }
  if (typeof row?.playerId !== 'string' || row.playerId === '') {
    throw new Error(`${where}: cohort row carries neither sourceId nor a legacy playerId`);
  }
  return {
    sourceId: row.playerId,
    sourceType: GSIS_SHAPE.test(row.playerId) ? 'gsis' : 'unknown',
    canonicalId: undefined,
  };
}

/**
 * The `| label | value |` cells of the first markdown table under a heading.
 *
 * Returns null when the heading or its table is absent — a missing section is a
 * different problem from a wrong cell, and the caller reports it as one.
 */
export function readMarkdownTable(report: string, heading: RegExp): Map<string, string> | null {
  const lines = report.split('\n');
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return null;

  const cells = new Map<string, string>();
  let seen = false;
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      if (seen) break;      // the table ended
      if (/^#{1,6}\s/.test(trimmed)) return null; // next section, no table here
      continue;             // prose between the heading and the table
    }
    seen = true;
    if (/^\|[\s:|-]+\|$/.test(trimmed)) continue; // the |---|---:| separator
    const parts = trimmed.split('|').slice(1, -1).map((c) => c.trim());
    if (parts.length < 2) continue;
    const label = parts[0].replace(/\*\*/g, '').replace(/`/g, '').trim().toLowerCase();
    const value = parts[1].replace(/\*\*/g, '').replace(/`/g, '').trim();
    if (label && !cells.has(label)) cells.set(label, value);
  }
  return seen ? cells : null;
}

/** Every number in a cell, so `-26.01 … +22.30` yields both ends. */
function numbersIn(cell: string): number[] {
  return [...cell.matchAll(/[-+]?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

/**
 * The measures the descriptive-comparison table must carry, each bound to the
 * row that states it.
 */
const COMPARISON_ROWS: Array<{ label: RegExp; describe: string; key: string }> = [
  { label: /^joined rows$/, describe: 'joined rows', key: 'joinedRows' },
  { label: /^exact agreement$/, describe: 'exact agreement', key: 'exactAgreement' },
  { label: /^within ±1/, describe: 'within ±1.0 alpha', key: 'within1' },
  { label: /^within ±5/, describe: 'within ±5.0 alpha', key: 'within5' },
  { label: /^median delta/, describe: 'median delta', key: 'medianDelta' },
];

/**
 * Problems in how the report states the manifest's descriptive comparison.
 *
 * Deliberately NOT a substring scan of the whole document. `report.includes('0')`
 * is satisfied by any zero anywhere — a date, a GSIS id, a table of largest
 * disagreements — so a reviewer could rewrite the summary cells and `--check`
 * would still print "report consistent". Each measure is now read from the row
 * that states it, in the table under the descriptive-comparison heading, and
 * compared numerically.
 */
export function reportComparisonProblems(report: string, descriptiveComparison: any): string[] {
  const dc = descriptiveComparison;
  if (!dc || dc.status !== 'available') return [];

  const problems: string[] = [];
  const table = readMarkdownTable(report, /^#{2,4}.*descriptive comparison/i);
  if (!table) {
    return ['report has no descriptive-comparison table for the manifest comparison to be checked against'];
  }

  const findRow = (label: RegExp) => {
    for (const [key, value] of table) if (label.test(key)) return { key, value };
    return null;
  };

  for (const { label, describe, key } of COMPARISON_ROWS) {
    const expected = dc[key];
    if (expected === null || expected === undefined) continue;
    const row = findRow(label);
    if (!row) {
      problems.push(`report's descriptive-comparison table has no "${describe}" row`);
      continue;
    }
    const stated = numbersIn(row.value);
    if (stated.length !== 1 || stated[0] !== Number(expected)) {
      problems.push(
        `report states ${describe} as "${row.value}"; the manifest measured ${expected}`,
      );
    }
  }

  // The range row carries both ends, and their ORDER is part of the claim.
  // Membership alone ("does 22.30 appear somewhere in this cell?") is satisfied
  // by `+22.30 … -26.01`, which states the maximum as the minimum and reads as
  // a range running backwards. The cell must be the exact ordered pair.
  if (dc.minDelta !== null && dc.minDelta !== undefined) {
    const row = findRow(/^range$/);
    if (!row) {
      problems.push('report\'s descriptive-comparison table has no "range" row');
    } else if (dc.maxDelta !== null && dc.maxDelta !== undefined) {
      const stated = numbersIn(row.value);
      const expected = [Number(dc.minDelta), Number(dc.maxDelta)];
      if (stated.length !== 2 || stated[0] !== expected[0] || stated[1] !== expected[1]) {
        problems.push(
          `report's range row states [${stated.join(', ')}]; the manifest measured ` +
          `[${expected.join(', ')}] in that order (minimum first)`,
        );
      }
    }
  }

  // The section heading counts the shared players too, and a heading that
  // disagrees with its own table is exactly the drift this check exists for.
  const headingLine = report.split('\n').find((line) => /^#{2,4}.*descriptive comparison/i.test(line));
  if (headingLine && dc.joinedRows !== null && dc.joinedRows !== undefined) {
    // Drop the leading section number ("### 5.2 ") so only counts stated in the
    // heading's prose are read.
    const counts = numbersIn(headingLine.replace(/^#{2,4}\s*[\d.]*\s*/, ''));
    if (counts.length && !counts.includes(Number(dc.joinedRows))) {
      problems.push(
        `report's descriptive-comparison heading states ${counts.join('/')} shared players; the manifest measured ${dc.joinedRows}`,
      );
    }
  }

  return problems;
}

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
