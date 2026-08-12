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

/**
 * What blocks (or does not block) a join between the two artifacts.
 *
 * A join is performed EXCLUSIVELY on `sourceId`/`player_id` — the measured
 * `directIdIntersection` — so this deliberately takes no name-related input
 * at all: there is nothing here for duplicate display names to block,
 * because the join never looks at names. That is enforced by this
 * function's own signature, not merely by an `if` a future edit could add
 * back. If a name-based FALLBACK join is ever introduced, its own blocker
 * belongs in a NEW, separate input to this function, gated on that fallback
 * actually being used — not on name ambiguity existing in the abstract.
 */
export function computeJoinBlockers(input: { directIdIntersection: number }): string[] {
  const blockers: string[] = [];
  if (input.directIdIntersection === 0) {
    blockers.push('zero direct identifier intersection between the two artifacts');
  }
  return blockers;
}

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

export interface AtxHeading {
  level: number;
  content: string;
}

/**
 * Parse one line as a bounded ATX heading (CommonMark's `#`-style heading),
 * or return null.
 *
 * Shared by section discovery AND section-boundary detection below, so both
 * agree on what counts as a heading rather than each carrying its own
 * regex/trim combination that can drift out of sync with the other:
 *
 *  - 0-3 leading spaces are tolerated (CommonMark's own boundary); 4+ spaces
 *    or ANY leading tab is an indented code line, never a heading — a
 *    pseudo-heading indented that far must not be promoted into one, and
 *    (via the same check in the section-boundary loop below) must not
 *    terminate a live section either.
 *  - 1-6 '#' characters.
 *  - a space or tab must follow the hash run, or the line must end there —
 *    "###4.3" glues the number onto the marker itself and is not a heading
 *    at all, just a line of text that happens to start with hashes.
 *  - a closing hash sequence is recognised and stripped only when it is
 *    itself preceded by a space/tab, per CommonMark ("### 4.3 Title ###"
 *    strips to content "4.3 Title"). A trailing run of '#' glued directly
 *    onto the content with no preceding whitespace ("### 4.3 Contradictory
 *    copy###") is NOT a recognised closing sequence either, per the same
 *    CommonMark rule — but unlike a missing separator after the OPENING
 *    hashes, this is still a well-formed heading with real title text
 *    before it. It is kept as literal content, glued hashes and all, rather
 *    than rejecting the whole line: a checker that discarded such a heading
 *    outright would fail to recognise it as a duplicate of the section it
 *    retitles, which is precisely the ambiguity this classifier exists to
 *    catch, not create.
 */
export function parseAtxHeading(line: string): AtxHeading | null {
  const match = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/.exec(line.replace(/\r$/, ''));
  if (!match) return null;

  const level = match[1].length;
  const content = (match[2] ?? '').trim();
  if (content === '') return { level, content: '' };

  const closing = /^(.*?)[ \t]+#+[ \t]*$/.exec(content);
  return closing ? { level, content: closing[1] } : { level, content };
}

/**
 * A parsed heading's line, reconstructed in normalized form (single space,
 * no leading indent, closing hashes already stripped), so a caller-supplied
 * title `RegExp` — several of which expect to see the `#` marker at the
 * start — matches against a canonical shape rather than the original line's
 * exact indentation or closing-hash spelling.
 */
function normalizedHeadingLine(h: AtxHeading): string {
  return h.content ? `${'#'.repeat(h.level)} ${h.content}` : '#'.repeat(h.level);
}

/**
 * True when a line's leading whitespace is inside the CommonMark "flow
 * content" bound: 0-3 spaces, no tab anywhere in the indent. Four or more
 * leading spaces — or a leading tab — is an indented code line, so neither a
 * heading marker (see `parseAtxHeading`) nor a table pipe starting there is
 * markup; it is a code line that happens to contain `#` or `|`.
 */
function hasBoundedIndent(line: string): boolean {
  return !/^( {4,}|\t| {1,3}\t)/.test(line);
}

/** A fence-opening delimiter: which character, and how many of it. */
export interface FenceDelimiter {
  char: '`' | '~';
  length: number;
}

/**
 * Lightweight fenced-code-block delimiter detector (backtick or tilde
 * fences). Deliberately not a full parser, but it DOES apply CommonMark's
 * two opener/closer rules that matter for this classifier:
 *
 *  - **Opener info string**: the text after the fence run on the SAME line.
 *    A backtick fence's info string may not itself contain a raw backtick —
 *    CommonMark says so because an unescaped backtick there is ambiguous
 *    with inline code spans, and a line like ```` ```bad`info ```` is
 *    therefore not a fence opener at all, just ordinary text. Treating it as
 *    an opener anyway would let a line shaped like that hide a governed
 *    heading/table underneath it as "fenced content" it was never entitled
 *    to hide. A tilde fence has no such restriction — its info string may
 *    contain backticks or tildes freely, since tildes cannot be confused
 *    with an inline code span delimiter.
 *  - **Closer**: must use the same character as its opener, run at least as
 *    long, and be followed only by whitespace. A shorter run, the opposite
 *    character, or a run with trailing suffix text (` ``` js `, `~~~~x`) is
 *    not a closer at all — it stays fenced content, so an accidental line
 *    inside a fenced block that happens to start with a few backticks
 *    cannot end the fence early either.
 */
function parseFenceOpener(line: string): FenceDelimiter | null {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return null;
  const char = match[1][0] as '`' | '~';
  const infoString = match[2];
  if (char === '`' && infoString.includes('`')) return null;
  return { char, length: match[1].length };
}

function isFenceCloser(line: string, opener: FenceDelimiter): boolean {
  const match = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
  if (!match) return false;
  const run = match[1];
  return run[0] === opener.char && run.length >= opener.length;
}

/**
 * The `| label | value |` cells of the first markdown table under a heading.
 *
 * Returns null when the heading or its table is absent — a missing section is a
 * different problem from a wrong cell, and the caller reports it as one.
 */
export function readMarkdownTable(report: string, heading: RegExp): Map<string, string> | null {
  const lines = report.split('\n');
  let start = -1;
  let scanFence: FenceDelimiter | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    if (scanFence) { if (isFenceCloser(lines[i], scanFence)) scanFence = null; continue; }
    const opener = parseFenceOpener(lines[i]);
    if (opener) { scanFence = opener; continue; }
    const parsed = parseAtxHeading(lines[i]);
    if (parsed && heading.test(normalizedHeadingLine(parsed))) { start = i; break; }
  }
  if (start === -1) return null;

  const cells = new Map<string, string>();
  let seen = false;
  let fence: FenceDelimiter | null = null;
  for (const line of lines.slice(start + 1)) {
    if (fence) { if (isFenceCloser(line, fence)) fence = null; continue; }
    const opener = parseFenceOpener(line);
    if (opener) { fence = opener; continue; }

    const trimmed = line.trim();
    const isTableRow = trimmed.startsWith('|') && hasBoundedIndent(line);
    if (!isTableRow) {
      if (seen) break;      // the table ended
      if (parseAtxHeading(line)) return null; // next section, no table here
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

  let scanFence: FenceDelimiter | null = null;
  for (let start = 0; start < lines.length; start += 1) {
    if (scanFence) { if (isFenceCloser(lines[start], scanFence)) scanFence = null; continue; }
    const scanOpener = parseFenceOpener(lines[start]);
    if (scanOpener) { scanFence = scanOpener; continue; }

    const parsedHeading = parseAtxHeading(lines[start]);
    if (!parsedHeading || !heading.test(normalizedHeadingLine(parsedHeading))) continue;

    const headingLevel = parsedHeading.level;
    const tables: MarkdownTable[] = [];
    let current: string[][] | null = null;
    let fence: FenceDelimiter | null = null;

    for (const line of lines.slice(start + 1)) {
      if (fence) { if (isFenceCloser(line, fence)) fence = null; continue; }
      const opener = parseFenceOpener(line);
      if (opener) { fence = opener; continue; }

      // Stop at the next heading of the same or a higher level, so a
      // subsection's tables are not attributed to this section. A
      // pseudo-heading indented 4+ spaces/a tab, or one living inside a
      // fenced block (handled above), is not a heading via `parseAtxHeading`
      // and so cannot end the section early.
      const nextHeading = parseAtxHeading(line);
      if (nextHeading && nextHeading.level <= headingLevel) break;

      const trimmed = line.trim();
      const isTableRow = trimmed.startsWith('|') && hasBoundedIndent(line);
      if (!isTableRow) {
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
 * it must be exactly 4.3 — `(?!\w)` refuses 4.30 (a digit is a word
 * character) AND a letter-suffixed lookalike like "4.3b", while `(?!\.\d)`
 * separately refuses the subsection 4.3.1 (`.` is not a word character, so
 * `(?!\w)` alone would not catch it). Bare and differently punctuated forms
 * ("### 4.3", "### 4.3.", "### 4.3 — retitled") all still count as §4.3.
 *
 * "Real Markdown heading" is enforced by `parseAtxHeading` before this
 * pattern ever runs: `readMarkdownSections`/`readMarkdownTable` test it
 * against the heading's normalized reconstruction (0-3 leading spaces
 * already stripped, a required space/tab after the hashes already
 * confirmed, any closing hash sequence already resolved), never against a
 * raw, possibly-indented, possibly-glued line. `\s+` here — not `\s*` — is
 * then just "the one separating space", since the classifier has already
 * refused a bare "###4.3" with no separator at all.
 */
export const CLAMPING_SECTION_HEADING = /^#{1,6}\s+4\.3(?!\w)(?!\.\d)/;

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
 * The governed descriptive-comparison section, identified by its NUMBER —
 * the same treatment as `CLAMPING_SECTION_HEADING` and for the same reason:
 * matching on the title phrase ("descriptive comparison") let a duplicated
 * section be retitled and stop being recognised as §5.2 at all. `(?!\w)`
 * refuses 5.20 AND the report's own "5.2b" — a letter-suffixed lookalike
 * that is a DIFFERENT, superseded section per the committed report and must
 * not be conflated with the governed §5.2 — and `(?!\.\d)` separately
 * refuses the subsection 5.2.1.
 */
export const COMPARISON_SECTION_HEADING = /^#{1,6}\s+5\.2(?!\w)(?!\.\d)/;

/**
 * Problems in how the report states the manifest's descriptive comparison.
 *
 * Deliberately NOT a substring scan of the whole document. `report.includes('0')`
 * is satisfied by any zero anywhere — a date, a GSIS id, a table of largest
 * disagreements — so a reviewer could rewrite the summary cells and `--check`
 * would still print "report consistent". Each measure is now read from the row
 * that states it, in the table under the descriptive-comparison heading, and
 * compared numerically.
 *
 * Uniqueness is enforced at both the section and table level, mirroring
 * `reportClampingProblems`: a duplicated §5.2 heading — verbatim, retitled,
 * carrying a conflicting table, or even bare with no table at all — is a
 * failure on its own, independent of whether any one copy happens to state
 * the correct figures. Which copy a reader lands on is not something this
 * checker should decide by position.
 */
export function reportComparisonProblems(report: string, descriptiveComparison: any): string[] {
  const dc = descriptiveComparison;
  if (!dc || dc.status !== 'available') return [];

  const problems: string[] = [];
  const sections = readMarkdownSections(report, COMPARISON_SECTION_HEADING);
  if (sections.length === 0) {
    return ['report has no §5.2 section for the manifest descriptive comparison to be checked against'];
  }
  if (sections.length > 1) {
    return [
      `report carries ${sections.length} sections whose heading matches §5.2; exactly one may state these findings`,
    ];
  }

  // The descriptive-comparison table is identified by its shape (a "joined
  // rows" row), not by position — §5.2 also carries a second, unrelated
  // "largest absolute disagreements" table that must not be mistaken for it.
  const candidates = sections[0].tables.filter((t) =>
    t.rows.some((row) => /^joined rows$/i.test(cleanCell(row[0] ?? ''))),
  );
  if (candidates.length === 0) {
    return ['report has no descriptive-comparison table for the manifest comparison to be checked against'];
  }
  if (candidates.length > 1) {
    return [
      `report carries ${candidates.length} descriptive-comparison tables; exactly one may state these findings`,
    ];
  }

  // Every row that matches a given measure's label regex, from the
  // PRESERVED row array — not a label -> value Map. A Map collapsed a
  // second row under the same (or a differently-worded, same-regex) label
  // to whichever value was seen first, silently discarding a conflicting —
  // or even identical — duplicate rather than reporting it. "Exactly one
  // semantic match" is enforced explicitly below instead.
  const rowsMatching = (label: RegExp) =>
    candidates[0].rows
      .map((row) => ({ label: cleanCell(row[0] ?? '').toLowerCase(), value: cleanCell(row[1] ?? '') }))
      .filter((r) => r.label && label.test(r.label));

  for (const { label, describe, key } of COMPARISON_ROWS) {
    const matches = rowsMatching(label);
    if (matches.length > 1) {
      // Duplicate detection is unconditional — a structural property of the
      // report — independent of whether the manifest currently has a value
      // to compare it against. Identical-valued and conflicting-valued
      // duplicates both trip this; which copy would be "correct" is not a
      // question this checker should answer by position.
      problems.push(
        `report's descriptive-comparison table repeats the "${describe}" row ` +
        `(${matches.length} rows match); exactly one may state this measure`,
      );
      continue;
    }
    const expected = dc[key];
    if (expected === null || expected === undefined) continue;
    if (matches.length === 0) {
      problems.push(`report's descriptive-comparison table has no "${describe}" row`);
      continue;
    }
    const stated = numbersIn(matches[0].value);
    if (stated.length !== 1 || stated[0] !== Number(expected)) {
      problems.push(
        `report states ${describe} as "${matches[0].value}"; the manifest measured ${expected}`,
      );
    }
  }

  // The range row carries both ends, and their ORDER is part of the claim.
  // Membership alone ("does 22.30 appear somewhere in this cell?") is satisfied
  // by `+22.30 … -26.01`, which states the maximum as the minimum and reads as
  // a range running backwards. The cell must be the exact ordered pair.
  const rangeMatches = rowsMatching(/^range$/);
  if (rangeMatches.length > 1) {
    problems.push(
      `report's descriptive-comparison table repeats the "range" row ` +
      `(${rangeMatches.length} rows match); exactly one may state this measure`,
    );
  } else if (dc.minDelta !== null && dc.minDelta !== undefined) {
    if (rangeMatches.length === 0) {
      problems.push('report\'s descriptive-comparison table has no "range" row');
    } else if (dc.maxDelta !== null && dc.maxDelta !== undefined) {
      const stated = numbersIn(rangeMatches[0].value);
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
  // Read from the section the scanner already found above (fence/indent
  // aware), not a second, separately-matched raw line.
  const headingLine = sections[0].heading;
  if (dc.joinedRows !== null && dc.joinedRows !== undefined) {
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
