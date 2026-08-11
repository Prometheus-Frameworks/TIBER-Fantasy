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

const cleanCell = (cell: string) => cell.replace(/\*\*/g, '').replace(/`/g, '').trim();

export interface MarkdownTable {
  header: string[];
  rows: string[][];
}

/**
 * Every markdown table under a heading, in order, as full rows.
 *
 * `readMarkdownTable` above returns only the first table's label/value pairs,
 * which is the wrong shape here twice over: §4.3 carries TWO tables — the
 * declared bounds and the observed clamping — and the clamping one has six
 * columns, not two.
 */
export interface MarkdownSection {
  /** The heading line itself, verbatim. */
  heading: string;
  tables: MarkdownTable[];
}

/**
 * EVERY section whose heading matches, across the whole document.
 *
 * Scanning from only the first match is the section-level version of the
 * `.find()` table bug one level down: a duplicated §4.3 heading with a
 * contradictory second table sat entirely outside the scanned range, so the
 * one-table rule inside the first section was satisfied while a reader
 * scrolled to the duplicate. A checker that enforces uniqueness within a
 * region it selected by taking the first match has only moved the ambiguity,
 * not removed it.
 */
export function readMarkdownSections(report: string, heading: RegExp): MarkdownSection[] {
  const lines = report.split('\n');
  const sections: MarkdownSection[] = [];

  for (let start = 0; start < lines.length; start += 1) {
    if (!heading.test(lines[start])) continue;

    const headingLevel = (/^(#{1,6})\s/.exec(lines[start].trim()) ?? [, ''])[1]!.length;
    const tables: MarkdownTable[] = [];
    let current: string[][] | null = null;

    for (const line of lines.slice(start + 1)) {
      const trimmed = line.trim();
      const nextHeading = /^(#{1,6})\s/.exec(trimmed);
      // Stop at the next heading of the same or a higher level, so a
      // subsection's tables are not attributed to this section.
      if (nextHeading && nextHeading[1].length <= headingLevel) break;

      if (!trimmed.startsWith('|')) {
        if (current) { tables.push({ header: current[0], rows: current.slice(1) }); current = null; }
        continue;
      }
      if (/^\|[\s:|-]+\|$/.test(trimmed)) continue; // the |---|---:| separator
      const parts = trimmed.split('|').slice(1, -1).map(cleanCell);
      if (!current) current = [parts];
      else current.push(parts);
    }
    if (current) tables.push({ header: current[0], rows: current.slice(1) });
    sections.push({ heading: lines[start], tables });
  }

  return sections;
}

export function readMarkdownTables(report: string, heading: RegExp): MarkdownTable[] {
  // First matching section's tables, for callers that have already established
  // (or do not care) that the heading is unique. Uniqueness enforcement lives
  // with the callers that govern a section, via readMarkdownSections.
  return readMarkdownSections(report, heading)[0]?.tables ?? [];
}

/**
 * The report's own formatting rule for a clamp percentage.
 *
 * One decimal place, matching `auditClamping()` in `forgeCacheAudit.ts`. Kept
 * here as the single definition so the checker cannot drift from the producer.
 */
export function formatClampPct(count: number, n: number): string {
  return ((count / n) * 100).toFixed(1);
}

/** `59 (40.4%)` -> `{ count: 59, pct: '40.4' }`; a bare `7` -> `{ count: 7 }`. */
function parseCountCell(cell: string): { count: number | null; pct: string | null } {
  const match = /^(-?\d+(?:\.\d+)?)\s*(?:\(\s*(-?\d+(?:\.\d+)?)\s*%\s*\))?$/.exec(cleanCell(cell));
  if (!match) return { count: null, pct: null };
  return { count: Number(match[1]), pct: match[2] ?? null };
}

const CLAMP_POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;

/**
 * The governed clamping section, identified by its NUMBER.
 *
 * The section's identity is §4.3, not the phrase its title happens to carry
 * today. Matching on the title meant a duplicated section could be retitled —
 * "4.3 Observed clamping under the designed bounds" — and stop being
 * recognised as a duplicate at all, defeating the exactly-one rule by
 * renaming rather than by position. So the heading is matched on the anchored
 * numeric prefix alone and the remainder of the title is ignored.
 *
 * The boundary is deliberate on both sides: the number must sit at the start
 * of a real Markdown heading (prose mentioning "4.3" is not a heading), and
 * it must be exactly 4.3 — `(?!\d)` refuses 4.30 and `(?!\.\d)` refuses the
 * subsection 4.3.1, while bare and differently punctuated forms ("### 4.3",
 * "### 4.3.", "### 4.3 — retitled") all still count as §4.3.
 */
export const CLAMPING_SECTION_HEADING = /^#{1,6}\s*4\.3(?!\d)(?!\.\d)/;

/**
 * Problems in how the report states the manifest's clamping findings.
 *
 * The gap this closes: `--check` verified the descriptive-comparison table and
 * nothing else, so §4.3's clamping table could be edited freely — changing the
 * WR floor from 59 (40.4%) to 1 (0.7%) still passed, turning the audit's
 * headline finding ("roughly a third of the board sits on the floor") into its
 * opposite while the gate reported the document consistent.
 *
 * Every position row and the total row is compared: counts exactly, and the
 * displayed percentages against the report's own formatting rule rather than
 * against a re-derived float that might round differently.
 */
export function reportClampingProblems(report: string, clamping: any): string[] {
  const byPosition = clamping?.byPosition;
  if (!byPosition) return [];

  const problems: string[] = [];
  // Uniqueness is enforced at BOTH levels, because each level was defeated in
  // turn. First the table: `.find()` took the first match inside the section
  // and ignored a conflicting second table. Then the section: scanning from
  // only the first matching heading meant a duplicated §4.3 heading — with its
  // own contradictory table — sat entirely outside the scanned range, so the
  // one-table rule was satisfied while a reader scrolled to the duplicate.
  // Which copy is authoritative is not a question a checker should answer by
  // position at either level, and the duplicate heading is a failure even when
  // only one copy contains a table at all: the ambiguity is the defect.
  const sections = readMarkdownSections(report, CLAMPING_SECTION_HEADING);
  if (sections.length === 0) {
    return ['report has no §4.3 section for the manifest clamping findings to be checked against'];
  }
  if (sections.length > 1) {
    return [
      `report carries ${sections.length} sections whose heading matches §4.3; ` +
      'exactly one may state these findings',
    ];
  }
  const candidates = sections[0].tables
    .filter((t) => t.header.some((h) => /at floor/i.test(h)));
  if (candidates.length === 0) {
    return ['report has no observed-clamping table for the manifest clamping findings to be checked against'];
  }
  if (candidates.length > 1) {
    return [
      `report carries ${candidates.length} observed-clamping tables; exactly one may state these findings`,
    ];
  }
  const table = candidates[0];

  const columnOf = (pattern: RegExp) => table.header.findIndex((h) => pattern.test(h));
  const columns = {
    n: columnOf(/^n$/i),
    min: columnOf(/^min$/i),
    max: columnOf(/^max$/i),
    floor: columnOf(/at floor/i),
    ceiling: columnOf(/at ceiling/i),
  };
  for (const [name, index] of Object.entries(columns)) {
    if (index === -1) problems.push(`report's clamping table has no "${name}" column`);
  }
  if (problems.length) return problems;

  const seen = new Map<string, string[]>();
  for (const row of table.rows) {
    const key = (row[0] ?? '').toLowerCase();
    if (!key) continue;
    if (seen.has(key)) {
      problems.push(`report's clamping table repeats the "${row[0]}" row`);
      continue;
    }
    seen.set(key, row);
  }

  const expectedKeys = [...CLAMP_POSITIONS.map((p) => p.toLowerCase()), 'total'];
  for (const key of seen.keys()) {
    if (!expectedKeys.includes(key)) {
      problems.push(`report's clamping table carries an unexpected "${key}" row`);
    }
  }

  const cell = (row: string[], index: number) => cleanCell(row[index] ?? '');

  const checkCount = (label: string, row: string[], index: number, expected: number, expectedPct?: string) => {
    const parsed = parseCountCell(cell(row, index));
    if (parsed.count !== expected) {
      problems.push(`report states ${label} as "${cell(row, index)}"; the manifest measured ${expected}`);
      return;
    }
    if (expectedPct !== undefined && parsed.pct !== expectedPct) {
      problems.push(
        `report states ${label} percentage as "${parsed.pct ?? 'none'}%"; the measured value formats to ${expectedPct}%`,
      );
    }
  };

  let totalN = 0;
  let totalFloor = 0;
  let totalCeiling = 0;

  for (const position of CLAMP_POSITIONS) {
    const measured = byPosition[position];
    if (!measured) {
      problems.push(`manifest has no clamping entry for ${position}`);
      continue;
    }
    totalN += Number(measured.n);
    totalFloor += Number(measured.atFloor);
    totalCeiling += Number(measured.atCeiling);

    const row = seen.get(position.toLowerCase());
    if (!row) {
      problems.push(`report's clamping table has no "${position}" row`);
      continue;
    }
    for (const [label, index, expected] of [
      ['n', columns.n, Number(measured.n)],
      ['min', columns.min, Number(measured.min)],
      ['max', columns.max, Number(measured.max)],
    ] as const) {
      const stated = numbersIn(cell(row, index));
      if (stated.length !== 1 || stated[0] !== expected) {
        problems.push(`report states ${position} ${label} as "${cell(row, index)}"; the manifest measured ${expected}`);
      }
    }
    checkCount(
      `${position} at-floor`, row, columns.floor,
      Number(measured.atFloor), formatClampPct(Number(measured.atFloor), Number(measured.n)),
    );
    checkCount(`${position} at-ceiling`, row, columns.ceiling, Number(measured.atCeiling));
  }

  const totalRow = seen.get('total');
  if (!totalRow) {
    problems.push('report\'s clamping table has no "total" row');
  } else {
    const stated = numbersIn(cell(totalRow, columns.n));
    if (stated.length !== 1 || stated[0] !== totalN) {
      problems.push(`report states the clamping total n as "${cell(totalRow, columns.n)}"; the positions sum to ${totalN}`);
    }
    // The total row's min/max are deliberately blank, and must stay blank.
    // A cohort-wide minimum and maximum would be a NEW aggregate claim: the
    // per-position bounds are what the calibration declares and what the
    // manifest measures, and "the lowest alpha anywhere in the cohort" is a
    // different statistic that nothing here derives. Leaving these unchecked
    // let arbitrary numbers be inserted and read as measurements, so absence is
    // enforced rather than assumed.
    for (const [label, index] of [['min', columns.min], ['max', columns.max]] as const) {
      const value = cell(totalRow, index);
      if (value !== '') {
        problems.push(
          `report's clamping total row states a ${label} of "${value}"; that cell must stay blank — ` +
          'the audit derives no cohort-wide bound',
        );
      }
    }
    checkCount('total at-floor', totalRow, columns.floor, totalFloor, formatClampPct(totalFloor, totalN));
    checkCount('total at-ceiling', totalRow, columns.ceiling, totalCeiling);
  }

  return problems;
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
