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
import { decodeHTMLAttribute, decodeHTMLStrict } from 'entities';
import { lexer as lexMarkdown, type Token as MarkedToken } from 'marked';

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

interface MarkdownHeading extends AtxHeading {
  /** Source line containing the heading text (the line above a Setext underline). */
  line: number;
  /** First source line after the complete heading marker. */
  contentStart: number;
  raw: string;
  normalized: string;
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
  const content = normalizeHeadingContent(h.content);
  return content ? `${'#'.repeat(h.level)} ${content}` : '#'.repeat(h.level);
}

/**
 * Normalize inline spellings that render as the same heading text.
 *
 * Governed section identity is what a reader sees, not which inline spelling
 * produced it. Without this bounded normalization, `**4.3**`, `4\.3`, and
 * `4&#46;3` are three ways to publish a second visible §4.3 while evading a
 * literal-prefix selector. Unknown entities are retained, never guessed.
 */
function decodeVisibleInlineText(content: string): string {
  return content
    .replace(/&#(\d+);/g, (whole, digits) => {
      const code = Number(digits);
      return Number.isSafeInteger(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    })
    .replace(/&#x([0-9a-f]+);/gi, (whole, digits) => {
      const code = Number.parseInt(digits, 16);
      return Number.isSafeInteger(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    })
    .replace(/&(period|dot);/gi, '.')
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1');
}

function protectDecodedInlineSyntax(content: string): string {
  return content
    .replace(/&#(\d+);/g, (whole, digits) => {
      const code = Number(digits);
      if (!Number.isSafeInteger(code) || code < 0 || code > 0x10ffff) return whole;
      const decoded = String.fromCodePoint(code);
      return decoded === '*' ? '\uE000' : decoded === '_' ? '\uE001' : decoded === '`' ? '\uE002' : decoded;
    })
    .replace(/&#x([0-9a-f]+);/gi, (whole, digits) => {
      const code = Number.parseInt(digits, 16);
      if (!Number.isSafeInteger(code) || code < 0 || code > 0x10ffff) return whole;
      const decoded = String.fromCodePoint(code);
      return decoded === '*' ? '\uE000' : decoded === '_' ? '\uE001' : decoded === '`' ? '\uE002' : decoded;
    })
    .replace(/&(period|dot);/gi, '.')
    .replace(/\\([*_`])/g, (_whole, char) => char === '*' ? '\uE000' : char === '_' ? '\uE001' : '\uE002');
}

interface NormalizedInline {
  value: string;
  problem: string | null;
}

/**
 * Normalize only presentation spans whose boundaries are unambiguous.
 *
 * Blindly deleting every `*`, `_`, or backtick invents semantic text that the
 * Markdown does not necessarily render: `4*.*3` became `4.3`, and `3**57`
 * became `357`. The governed subset accepts the forms the report actually
 * uses (bounded emphasis/strong/code spans and inline links), while retaining
 * or rejecting anything imbalanced instead of guessing at its visible text.
 */
function normalizeBoundedInline(content: string): NormalizedInline {
  if (/!\[/.test(content)) {
    return { value: content.trim(), problem: 'images are not supported in governed inline content' };
  }
  const MARKDOWN_STRUCTURAL_CODEPOINTS = new Set([
    33, 35, 38, 40, 41, 42, 60, 62, 91, 92, 93, 95, 96, 126,
  ]);
  const encodedSyntaxCodepoint = [...content.matchAll(/&#(x[0-9a-f]+|\d+);/gi)].some((match) => {
    const codepoint = match[1].toLowerCase().startsWith('x')
      ? Number.parseInt(match[1].slice(1), 16)
      : Number(match[1]);
    return MARKDOWN_STRUCTURAL_CODEPOINTS.has(codepoint);
  });
  const encodedAmpersandBeforeEntityTail = /&#(x[0-9a-f]+|\d+);#(?:x[0-9a-f]+|\d+);/gi;
  const doubleDecodeOpener = [...content.matchAll(encodedAmpersandBeforeEntityTail)].some((match) => {
    const codepoint = match[1].toLowerCase().startsWith('x')
      ? Number.parseInt(match[1].slice(1), 16)
      : Number(match[1]);
    return codepoint === 38;
  });
  if (/\\[*_`]/.test(content) || encodedSyntaxCodepoint || doubleDecodeOpener) {
    return {
      value: decodeVisibleInlineText(content).trim(),
      problem: 'escaped or entity-encoded presentation markers are literal in governed inline content',
    };
  }

  const protectedChars: Record<string, string> = { '*': '\uE000', '_': '\uE001', '`': '\uE002' };
  const restoreProtected = (value: string) => value
    .replace(/\uE000/g, '*')
    .replace(/\uE001/g, '_')
    .replace(/\uE002/g, '`');
  let text = protectDecodedInlineSyntax(content)
    .replace(/\[([^\]\n]+)\]\([^()\n]*\)/g, '$1');
  if (/\[[^\]]*\](?:\[[^\]]*\])?|~~|<\/?[a-z][^>]*>/i.test(text)) {
    return { value: text.trim(), problem: 'unsupported link, strikethrough, or HTML inline syntax' };
  }

  const boundaryBefore = '(^|[\\s([{>:\\-—])';
  const boundaryAfter = '(?=$|[\\s)\\]},.!?:;\\-—])';
  const unwrap = (pattern: RegExp, literal = false) => {
    let changed = false;
    text = text.replace(pattern, (whole, before, inner) => {
      if (!/[\p{L}\p{N}]/u.test(inner)) return whole;
      changed = true;
      const unwrapped = literal
        ? inner.replace(/[\*_`]/g, (char: string) => protectedChars[char])
        : inner;
      return `${before}${unwrapped}`;
    });
    return changed;
  };

  // Iterate so a whole strong span may safely contain a bounded code span.
  for (let pass = 0; pass < 4; pass += 1) {
    const changed = [
      unwrap(new RegExp(`${boundaryBefore}\\*\\*([^*\\n]+?)\\*\\*${boundaryAfter}`, 'gu')),
      unwrap(new RegExp(`${boundaryBefore}__([^_\\n]+?)__${boundaryAfter}`, 'gu')),
      unwrap(new RegExp(`${boundaryBefore}\\*([^*\\n]+?)\\*${boundaryAfter}`, 'gu')),
      unwrap(new RegExp(`${boundaryBefore}_([^_\\n]+?)_${boundaryAfter}`, 'gu')),
      unwrap(new RegExp(`${boundaryBefore}\`([^\`\\n]+?)\`${boundaryAfter}`, 'gu'), true),
    ].some(Boolean);
    if (!changed) break;
  }

  if (/[\*_`]/.test(text)) {
    return { value: text.trim(), problem: 'unsupported or imbalanced emphasis/code markers' };
  }

  return {
    value: restoreProtected(decodeVisibleInlineText(text)).replace(/[ \t]+/g, ' ').trim(),
    problem: null,
  };
}

function normalizeHeadingContent(content: string): string {
  return normalizeBoundedInline(content).value;
}

/** Inline forms this bounded tokenizer deliberately does not interpret. */
function hasUnsupportedInlineSyntax(content: string): boolean {
  return normalizeBoundedInline(content).problem !== null;
}

interface ActiveListContainer {
  /** Physical column at which this list item's flow content begins. */
  indent: number;
  /** Four-space marker padding ends the item before an unindented GFM table. */
  allowsLazyTable: boolean;
  /** The list was opened inside a blockquote and closes with that quote. */
  quoteBound: boolean;
  /** A marker-only item ends at a following blank rather than owning it. */
  emptyItem: boolean;
}

interface ContainerPrefix {
  text: string;
  stripped: boolean;
  lists: ActiveListContainer[];
  hasBlockquote: boolean;
}

/**
 * Strip every directly nested container marker and retain the physical content
 * indents of all list items encountered. `baseOffset` is the already-stripped
 * indentation of an enclosing list continuation.
 */
function stripContainerMarkers(
  line: string,
  baseOffset = 0,
  inheritedQuote = false,
): ContainerPrefix {
  let text = line.replace(/\r$/, '');
  let stripped = false;
  let consumed = 0;
  let hasBlockquote = inheritedQuote;
  const lists: ActiveListContainer[] = [];
  while (true) {
    const blockquote = /^ {0,3}>[ \t]?/.exec(text);
    if (blockquote) {
      stripped = true;
      hasBlockquote = true;
      consumed += blockquote[0].length;
      text = text.slice(blockquote[0].length);
      continue;
    }

    // A thematic break is not a bullet followed by more container content.
    const isThematicBreak = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(text);
    const list = isThematicBreak
      ? null
      : /^ {0,3}(?:[-+*]|\d{1,9}[.)])(?:( {1,4})(?! )|(?=$))/.exec(text);
    if (!list) break;
    stripped = true;
    const emptyItem = !list[1];
    consumed += list[0].length + (emptyItem ? 1 : 0);
    lists.push({
      indent: baseOffset + consumed,
      allowsLazyTable: !emptyItem && list[1].length < 4,
      quoteBound: hasBlockquote,
      emptyItem,
    });
    text = text.slice(list[0].length);
  }
  return { text, stripped, lists, hasBlockquote };
}

/**
 * Top-level view plus bounded blockquote/list continuation state.
 *
 * The active list state is a stack, not a single indent. A nested marker can
 * begin after an enclosing list's content indent (or after a blockquote marker),
 * and a later line may dedent back to an outer item. Retaining only the most
 * recent container made deeply nested governed headings/tables look like
 * four-space code and therefore disappear from verification.
 */
interface GovernedContainerView {
  text: string;
  stripped: boolean;
  problem?: string;
}

function governedContainerViews(lines: string[], visible: boolean[]): GovernedContainerView[] {
  const views: GovernedContainerView[] = [];
  let lists: ActiveListContainer[] = [];
  let blockquoteActive = false;
  let blankSinceContainer = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r$/, '');
    if (!visible[index]) {
      views.push({ text: line, stripped: false });
      continue;
    }
    if (line.trim() === '') {
      blankSinceContainer = blockquoteActive || lists.length > 0;
      if (blockquoteActive) {
        blockquoteActive = false;
        lists = lists.filter((container) => !container.quoteBound);
      }
      lists = lists.filter((container) => !container.emptyItem);
      views.push({ text: line, stripped: false });
      continue;
    }

    const leadingSpaces = /^ */.exec(line)?.[0].length ?? 0;
    // Expanding tabs to CommonMark's four-column stops would make a leading
    // tab (or a spaces+tab prefix) a continuation of some active list items,
    // but the exact residual indent depends on every enclosing content column.
    // This tokenizer intentionally stays bounded: while a list is active it
    // refuses that ambiguous continuation instead of treating it as top-level
    // tab-indented code and letting governed structure disappear. With no
    // active list, ordinary tab-indented code remains inert and accepted.
    let tabContinuationProblem = lists.length > 0 && /^[ \t]*\t/.test(line)
      ? 'uses tab indentation while a list container is active; governed-document list continuations require spaces'
      : undefined;
    let view = line;
    let inherited = false;
    let direct = stripContainerMarkers(line);

    let matchingList = -1;
    for (let candidate = lists.length - 1; candidate >= 0; candidate -= 1) {
      if (leadingSpaces >= lists[candidate].indent) {
        matchingList = candidate;
        break;
      }
    }

    if (matchingList >= 0) {
      lists = lists.slice(0, matchingList + 1);
      const parent = lists[matchingList];
      view = line.slice(parent.indent);
      inherited = true;

      // The continuation itself may open one or more deeper containers. Keep
      // their absolute content indents so subsequent nested flow is checked
      // at its own 0–3/4-space boundary instead of the outer item's boundary.
      const nested = stripContainerMarkers(view, parent.indent, parent.quoteBound);
      if (nested.stripped) {
        lists.push(...nested.lists);
        blockquoteActive ||= nested.hasBlockquote;
        view = nested.text;
        direct = nested;
      }
    } else if (direct.stripped) {
      // A marker outside every active list starts a fresh bounded container
      // chain. Checking active list indents first is material: `  > quote`
      // may itself be content of an outer list, and discarding that outer list
      // would make the quote's later nested heading/table disappear again.
      lists = direct.lists;
      blockquoteActive = direct.hasBlockquote;
      view = direct.text;
    } else {
      const isTableShaped = /^ {0,3}\|/.test(line);
      let lazyList = -1;
      if (!blankSinceContainer && isTableShaped) {
        for (let candidate = lists.length - 1; candidate >= 0; candidate -= 1) {
          if (lists[candidate].allowsLazyTable) {
            lazyList = candidate;
            break;
          }
        }
      }
      const lazyBlockquote = !blankSinceContainer && isTableShaped && blockquoteActive;
      if (lazyList >= 0 || lazyBlockquote) {
        if (lazyList >= 0) lists = lists.slice(0, lazyList + 1);
        view = line;
        inherited = true;
      } else {
        lists = [];
        blockquoteActive = false;
      }
    }
    if (!tabContinuationProblem && direct.stripped && /^[ \t]*\t/.test(view)) {
      const containerKind = direct.hasBlockquote ? 'blockquote' : 'list';
      tabContinuationProblem =
        `uses tab indentation after a ${containerKind} container marker; governed-document container content requires spaces`;
    }
    blankSinceContainer = false;

    views.push({ text: view, stripped: direct.stripped || inherited, problem: tabContinuationProblem });
  }
  return views;
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
  const normalized = line.replace(/\r$/, '');
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(normalized);
  if (!match) return null;
  const char = match[1][0] as '`' | '~';
  const infoString = match[2];
  if (char === '`' && infoString.includes('`')) return null;
  return { char, length: match[1].length };
}

function isFenceCloser(line: string, opener: FenceDelimiter): boolean {
  const match = /^ {0,3}(`+|~+)[ \t]*$/.exec(line.replace(/\r$/, ''));
  if (!match) return false;
  const run = match[1];
  return run[0] === opener.char && run.length >= opener.length;
}

function regexMatches(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

/** Lines that are ordinary Markdown flow content rather than fenced code. */
function visibleMarkdownLines(lines: string[]): boolean[] {
  const visible = Array.from({ length: lines.length }, () => true);
  let fence: FenceDelimiter | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    if (fence) {
      visible[i] = false;
      if (isFenceCloser(lines[i], fence)) fence = null;
      continue;
    }
    const opener = parseFenceOpener(lines[i]);
    if (opener) {
      visible[i] = false;
      fence = opener;
    }
  }
  return visible;
}

/**
 * Remove bounded same-line code spans before looking for raw HTML constructs.
 * Backtick runs are maximal tokens: a one- or two-backtick opener cannot use a
 * three-backtick run as its closer. The prior backreference regex matched a
 * prefix of the longer run and could therefore hide visible raw HTML.
 */
function withoutBoundedCodeSpans(line: string): string {
  let visible = '';
  let cursor = 0;
  while (cursor < line.length) {
    if (line[cursor] !== '`') {
      visible += line[cursor];
      cursor += 1;
      continue;
    }

    const openerStart = cursor;
    while (cursor < line.length && line[cursor] === '`') cursor += 1;
    const openerLength = cursor - openerStart;
    let search = cursor;
    let closerEnd = -1;
    while (search < line.length) {
      if (line[search] !== '`') {
        search += 1;
        continue;
      }
      const closerStart = search;
      while (search < line.length && line[search] === '`') search += 1;
      if (search - closerStart === openerLength) {
        closerEnd = search;
        break;
      }
    }

    if (closerEnd >= 0) {
      cursor = closerEnd;
    } else {
      visible += line.slice(openerStart, cursor);
    }
  }
  return visible;
}

/**
 * Constructs this bounded governed-document tokenizer deliberately refuses.
 *
 * It is not a complete CommonMark/HTML parser. Raw HTML headings and tables
 * render as competing document structure, so accepting them without parsing
 * them would recreate the duplicate-section/table bypass. Outside code blocks
 * they therefore fail closed; inside fences or 4-space-indented code they are
 * inert examples and remain allowed.
 */
export function governedMarkdownSyntaxProblems(report: string): string[] {
  const lines = report.split('\n');
  const visible = visibleMarkdownLines(lines);
  const containerViews = governedContainerViews(lines, visible);
  const problems: string[] = [];
  let rawHtmlBlockStart: number | null = null;
  lines.forEach((line, index) => {
    if (!visible[index]) return;
    if (/^ {0,3}(?:[-+*]|\d{1,9}[.)])\t/.test(line)) {
      problems.push(
        `report line ${index + 1} uses tab padding after a list marker; ` +
        'the bounded governed-document tokenizer requires 1–4 spaces',
      );
    }
    if (/^ {0,3}(?:[-+*]|\d{1,9}[.)]) {4}[ \t]/.test(line)) {
      problems.push(
        `report line ${index + 1} uses overlong padding after a list marker; ` +
        'the bounded governed-document tokenizer refuses the five-or-more-space fallback',
      );
    }
    const containerView = containerViews[index];
    if (containerView.problem) {
      problems.push(`report line ${index + 1} ${containerView.problem}`);
    }
    // Once a list's required content indent is removed, apply the usual 0–3
    // flow / 4-space code boundary to the content, not to its physical column.
    // Thus bullet continuations at 4/5 physical spaces remain nested flow,
    // while 6 spaces leaves four content spaces and is inert nested code.
    const structuralLine = containerView.stripped ? containerView.text : line;
    if (!hasBoundedIndent(structuralLine)) return;
    const structuralText = withoutBoundedCodeSpans(structuralLine);
    if (/<!--|-->/.test(structuralText)) {
      problems.push(`report line ${index + 1} uses an HTML comment; governed-document structure may not be hidden in comments`);
    }
    if (/<\?|<\!\[CDATA\[|<\![A-Z]/i.test(structuralText)) {
      problems.push(
        `report line ${index + 1} uses an HTML processing instruction, CDATA block, or declaration; ` +
        'governed-document structure must use bounded Markdown syntax',
      );
    }
    if (/<\/?h[1-6](?:\s|>)/i.test(structuralText)) {
      problems.push(`report line ${index + 1} uses a raw HTML heading; governed sections must use Markdown headings`);
    }
    if (/<\/?(?:table|thead|tbody|tfoot|tr|th|td)(?:\s|>)/i.test(structuralText)) {
      problems.push(`report line ${index + 1} uses a raw HTML table construct; governed findings must use Markdown pipe tables`);
    }
    if (/<\/?[a-z][^>]*>/i.test(structuralText)) {
      problems.push(`report line ${index + 1} uses raw inline HTML; governed-document inline content must use Markdown syntax`);
    }
    if (rawHtmlBlockStart !== null) {
      if (/>/.test(structuralText)) rawHtmlBlockStart = null;
    } else if (/<\/?[a-z][^>]*$/i.test(structuralText)) {
      rawHtmlBlockStart = index;
      problems.push(
        `report line ${index + 1} starts a multiline raw HTML construct; ` +
        'governed-document inline content must use Markdown syntax',
      );
    }

    const { text: container, stripped } = containerView;
    if (stripped) {
      const normalized = normalizeHeadingContent(container.trim());
      const looksGoverned = /^(?:3(?![\w.]|\.\d)|4\.3(?!\w|\.\d)|5\.2(?!\w|\.\d))(?:\s|[.\-—:]|$)/.test(normalized);
      const nextContainer = containerViews[index + 1]?.text ?? '';
      const cells = splitMarkdownTableRow(container);
      const delimiter = splitMarkdownTableCells(nextContainer);
      const looksLikeTablePair = !!cells && isDelimiterRow(delimiter) && cells.length === delimiter.raw.length;
      if (
        parseAtxHeading(container) || setextLevel(container) || looksGoverned ||
        looksLikeTablePair
      ) {
        problems.push(
          `report line ${index + 1} places heading/table-shaped governed content inside a blockquote or list container; ` +
          'governed structure must be top-level',
        );
      }
    }
  });
  for (const heading of parseMarkdownHeadings(lines, visible)) {
    if (hasUnsupportedInlineSyntax(heading.raw)) {
      problems.push(
        `report heading at line ${heading.line + 1} uses unsupported inline heading syntax; ` +
        'governed section identity must be directly tokenizable',
      );
    }
    const unsupportedEntity = heading.raw.match(/&(?:[a-z][a-z0-9]+|#x?[0-9a-f]+);/gi)?.find((entity) =>
      !/^&(?:period|dot|#\d+|#x[0-9a-f]+);$/i.test(entity),
    );
    if (unsupportedEntity) {
      problems.push(
        `report heading at line ${heading.line + 1} uses unsupported entity "${unsupportedEntity}"; ` +
        'governed section identity must be directly tokenizable',
      );
    }
  }
  return problems;
}

function setextLevel(line: string): 1 | 2 | null {
  if (!hasBoundedIndent(line)) return null;
  const match = /^ {0,3}(=+|-+)[ \t]*\r?$/.exec(line);
  if (!match) return null;
  return match[1][0] === '=' ? 1 : 2;
}

/**
 * Parse every real heading once. The resulting token stream is shared by
 * governed-section discovery and boundary detection, so ATX and Setext syntax
 * cannot disagree between the two jobs.
 */
function parseMarkdownHeadings(lines: string[], visible: boolean[]): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const consumed = new Set<number>();
  const tableLines = markdownTableLineNumbers(lines, visible);
  for (let i = 0; i < lines.length; i += 1) {
    if (!visible[i] || consumed.has(i)) continue;
    const atx = parseAtxHeading(lines[i]);
    if (atx) {
      headings.push({
        ...atx,
        line: i,
        contentStart: i + 1,
        raw: lines[i],
        normalized: normalizedHeadingLine(atx),
      });
      continue;
    }

    const level = lines[i].trim() !== '' && i + 1 < lines.length && visible[i + 1]
      ? setextLevel(lines[i + 1])
      : null;
    let paragraphStart = i;
    if (level) {
      while (paragraphStart > 0) {
        const previous = lines[paragraphStart - 1];
        if (
          !visible[paragraphStart - 1] || consumed.has(paragraphStart - 1) ||
          !hasBoundedIndent(previous) || previous.trim() === '' ||
          parseAtxHeading(previous) || setextLevel(previous) ||
          tableLines.has(paragraphStart - 1) || /^ {0,3}\[[^\]]+\]:/.test(previous) ||
          /^ {0,3}(?:>|(?:[-+*]|\d{1,9}[.)]) {1,4})/.test(previous)
        ) break;
        paragraphStart -= 1;
      }
    }
    const paragraphLines = lines.slice(paragraphStart, i + 1);
    const content = paragraphLines
      .map((line) => line.replace(/^ {0,3}/, '').replace(/\r$/, '').trim())
      .join(' ')
      .trim();
    if (
      level && content && hasBoundedIndent(lines[i]) &&
      // Block markers are not paragraph text that a Setext underline promotes.
      !/^ {0,3}(?:>|(?:[-+*]|\d{1,9}[.)]) {1,4})/.test(lines[i])
    ) {
      const parsed = { level, content };
      headings.push({
        ...parsed,
        line: paragraphStart,
        contentStart: i + 2,
        raw: paragraphLines.join('\n'),
        normalized: normalizedHeadingLine(parsed),
      });
      for (let line = paragraphStart; line <= i + 1; line += 1) consumed.add(line);
      i += 1; // the underline belongs to this heading, not to another block
    }
  }
  return headings;
}

interface MarkdownTableCells {
  /** Raw cell source with surrounding whitespace trimmed. */
  raw: string[];
  /** The same cells with bounded Markdown presentation normalized. */
  clean: string[];
}

const COMMONMARK_ESCAPABLE_PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/;

/** Split a GFM pipe-table row on structurally unescaped pipes. */
function splitMarkdownTableCells(line: string): MarkdownTableCells | null {
  if (!hasBoundedIndent(line)) return null;
  const text = line.replace(/^ {0,3}/, '').replace(/\r$/, '').trimEnd();
  const cells: string[] = [];
  const separators: number[] = [];
  let cell = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '\\' && i + 1 < text.length && COMMONMARK_ESCAPABLE_PUNCTUATION.test(text[i + 1])) {
      // Keep the physical escape in `raw`; delimiter validation must distinguish
      // `---` from `\---`. Presentation normalization happens only in `clean`.
      cell += `${char}${text[i + 1]}`;
      i += 1;
    } else if (char === '|') {
      cells.push(cell);
      separators.push(i);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  if (separators.length === 0) return null;
  if (separators[0] === 0) cells.shift();
  if (separators[separators.length - 1] === text.length - 1) cells.pop();
  const raw = cells.map((value) => value.trim());
  // Normalize exactly once from physical source. Pre-decoding here and then
  // passing through `cleanCell()` let escaped presentation (`\*\*357\*\*`)
  // become real bold on a second interpretation and pass as numeric evidence.
  return { raw, clean: raw.map(cleanCell) };
}

/** Split a GFM pipe-table row on unescaped pipes; outer pipes are optional. */
function splitMarkdownTableRow(line: string): string[] | null {
  return splitMarkdownTableCells(line)?.clean ?? null;
}

function isDelimiterRow(cells: MarkdownTableCells | null): cells is MarkdownTableCells {
  return !!cells && cells.raw.length >= 2 && cells.raw.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/** Physical lines belonging to syntactically valid top-level pipe tables. */
function markdownTableLineNumbers(lines: string[], visible: boolean[]): Set<number> {
  const tableLines = new Set<number>();
  for (let i = 0; i + 1 < lines.length; i += 1) {
    if (!visible[i] || !visible[i + 1]) continue;
    const header = splitMarkdownTableCells(lines[i]);
    const delimiter = splitMarkdownTableCells(lines[i + 1]);
    if (!header || !isDelimiterRow(delimiter) || header.raw.length !== delimiter.raw.length) continue;
    tableLines.add(i);
    tableLines.add(i + 1);
    let cursor = i + 2;
    while (cursor < lines.length && visible[cursor]) {
      const row = splitMarkdownTableCells(lines[cursor]);
      if (!row) break;
      tableLines.add(cursor);
      cursor += 1;
    }
    i = cursor - 1;
  }
  return tableLines;
}

/**
 * The `| label | value |` cells of the first markdown table under a heading.
 *
 * Returns null when the heading or its table is absent — a missing section is a
 * different problem from a wrong cell, and the caller reports it as one.
 */
export function readMarkdownTable(report: string, heading: RegExp): Map<string, string> | null {
  const table = readMarkdownSections(report, heading)[0]?.tables[0];
  if (!table) return null;
  const cells = new Map<string, string>();
  for (const parts of table.rows) {
    if (parts.length < 2) continue;
    const label = normalizeHeadingContent(cleanCell(parts[0])).toLowerCase();
    const value = cleanCell(parts[1]);
    if (label && !cells.has(label)) cells.set(label, value);
  }
  return cells;
}

/** Every number in a cell, so `-26.01 … +22.30` yields both ends. */
function numbersIn(cell: string): number[] {
  return [...cell.matchAll(/[-+]?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

function strictNumber(cell: string): number | null {
  const match = /^[-+]?\d+(?:\.\d+)?$/.exec(cleanCell(cell));
  return match ? Number(match[0]) : null;
}

function strictNumberPair(cell: string): number[] | null {
  const match = /^\s*([-+]?\d+(?:\.\d+)?)\s*(?:…|\.\.|-|—|to)\s*([-+]?\d+(?:\.\d+)?)\s*$/i.exec(cleanCell(cell));
  return match ? [Number(match[1]), Number(match[2])] : null;
}

const cleanCell = (cell: string) => normalizeBoundedInline(cell).value.trim();

export interface MarkdownTable {
  header: string[];
  rows: string[][];
  problems: string[];
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
  /** Canonical ATX-shaped comparison form, including normalized inline text. */
  normalizedHeading: string;
  /** Zero-based source line carrying the section heading. */
  startLine: number;
  /** Zero-based exclusive source-line boundary for this section. */
  endLine: number;
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
  const visible = visibleMarkdownLines(lines);
  const headings = parseMarkdownHeadings(lines, visible);
  const sections: MarkdownSection[] = [];

  for (const parsedHeading of headings) {
    if (!regexMatches(heading, parsedHeading.normalized)) continue;
    const nextBoundary = headings.find((candidate) =>
      candidate.line > parsedHeading.line && candidate.level <= parsedHeading.level,
    );
    const end = nextBoundary?.line ?? lines.length;
    const tables: MarkdownTable[] = [];

    for (let i = parsedHeading.contentStart; i + 1 < end; i += 1) {
      if (!visible[i] || !visible[i + 1]) continue;
      const headerCells = splitMarkdownTableCells(lines[i]);
      const delimiter = splitMarkdownTableCells(lines[i + 1]);
      if (!headerCells || !isDelimiterRow(delimiter) || headerCells.raw.length !== delimiter.raw.length) continue;
      const header = headerCells.clean;

      const rows: string[][] = [];
      const problems: string[] = headerCells.raw.flatMap((cell, column) => {
        const problem = normalizeBoundedInline(cell).problem;
        return problem ? [`table header column ${column + 1} uses ${problem}`] : [];
      });
      let cursor = i + 2;
      while (cursor < end && visible[cursor]) {
        if (headings.some((candidate) => candidate.line === cursor)) break;
        const rowCells = splitMarkdownTableCells(lines[cursor]);
        if (!rowCells) break;
        const row = rowCells.clean;
        if (row.length !== header.length) {
          problems.push(
            `table row ${cursor + 1} has ${row.length} cells; its header declares ${header.length}`,
          );
        }
        rowCells.raw.forEach((cell, column) => {
          const problem = normalizeBoundedInline(cell).problem;
          if (problem) problems.push(`table row ${cursor + 1} column ${column + 1} uses ${problem}`);
        });
        rows.push(row);
        cursor += 1;
      }
      tables.push({ header, rows, problems });
      i = cursor - 1;
    }
    sections.push({
      heading: parsedHeading.raw,
      normalizedHeading: parsedHeading.normalized,
      startLine: parsedHeading.line,
      endLine: end,
      tables,
    });
  }

  return sections;
}

export function readMarkdownTables(report: string, heading: RegExp): MarkdownTable[] {
  // First matching section's tables, for callers that have already established
  // (or do not care) that the heading is unique. Uniqueness enforcement lives
  // with the callers that govern a section, via readMarkdownSections.
  return readMarkdownSections(report, heading)[0]?.tables ?? [];
}

interface GovernedNarrativeParagraph {
  value: string;
  kind: 'paragraph' | 'heading';
  topLevel: boolean;
  inGovernedSection: boolean;
  problem: string | null;
}

/**
 * Rendered text of a Marked inline-token stream.
 *
 * Marked retains entities in text tokens because its HTML renderer delegates
 * their decoding to the browser. The audit reasons about what a reader sees,
 * so decode HTML5 references exactly once after inline tokenization. Links,
 * emphasis, deletion and code spans contribute their rendered text; images
 * contribute alt text; hard/soft line breaks contribute whitespace.
 */
function renderedInlineSource(tokens: MarkedToken[] | undefined): string {
  if (!tokens) return '';
  return tokens.map((token): string => {
    switch (token.type) {
      case 'br':
        return ' ';
      case 'image':
        // Image alt text is flattened into one HTML attribute before the
        // browser decodes entities. Preserve entity fragments while removing
        // inline presentation, concatenate the full alt value, then decode it
        // once; ordinary prose intentionally decodes per token instead.
        {
          const altSource = token.tokens
            ? renderedImageAltSource(token.tokens)
            : token.text;
          // Marked places TextRenderer output directly in a double-quoted alt
          // attribute. A literal quote therefore terminates the attribute;
          // an entity-encoded quote is decoded later and remains data.
          return decodeHTMLAttribute(altSource.split('"', 1)[0]);
        }
      case 'text':
      case 'escape':
        // Marked's prose renderer recognizes entity source only when it has a
        // semicolon; legacy semicolonless spellings are escaped and therefore
        // remain literal reader-visible text.
        return decodeHTMLStrict(token.text);
      case 'codespan':
        // Entity-like text in a code span is literal code, not browser-decoded
        // prose. Keep it atomic so presentation boundaries cannot manufacture
        // an entity across adjacent tokens.
        return token.text;
      case 'strong':
      case 'em':
      case 'del':
      case 'link':
        return renderedInlineSource(token.tokens);
      case 'html':
        // governedMarkdownSyntaxProblems() rejects visible raw HTML before the
        // narrative check. Retain it here so it cannot manufacture plain text.
        return token.raw;
      default:
        return 'tokens' in token && Array.isArray(token.tokens)
          ? renderedInlineSource(token.tokens)
          : 'text' in token && typeof token.text === 'string'
            ? token.text
            : '';
    }
  }).join('');
}

function renderedInlineText(tokens: MarkedToken[] | undefined): string {
  return renderedInlineSource(tokens)
    .replace(/\p{Default_Ignorable_Code_Point}+/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Visible image-alt source before its single whole-attribute entity decode. */
function renderedImageAltSource(tokens: MarkedToken[] | undefined): string {
  if (!tokens) return '';
  return tokens.map((token): string => {
    // This mirrors Marked's TextRenderer: a hard break contributes nothing;
    // every other inline renderer contributes that token's own `text` value.
    // It deliberately does not recurse through nested presentation, whose
    // literal inner markers remain in the generated alt attribute.
    if (token.type === 'br') return '';
    return 'text' in token && typeof token.text === 'string' ? token.text : '';
  }).join('');
}

function governedInlineProblem(tokens: MarkedToken[] | undefined): string | null {
  if (!tokens) return null;
  for (const token of tokens) {
    if (token.type === 'image') return 'image alt text';
    if (token.type === 'del') return 'strikethrough text';
    if ('tokens' in token && Array.isArray(token.tokens)) {
      const nested = governedInlineProblem(token.tokens);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * Visible narrative blocks, parsed by a pinned real GFM lexer.
 *
 * The custom governed tokenizer remains authoritative for the report's exact
 * section/table schemas. Narrative paragraph boundaries are a different job:
 * CommonMark list, quote, Setext, thematic-break and fence interactions are
 * delegated to Marked instead of maintaining a second block parser here.
 * Paragraphs and headings remain visible globally; fenced/indented code and
 * tables are deliberately inert examples. Optional source-range markers are
 * inserted as top-level HTML comments before lexing the complete document, so
 * section membership is preserved without treating token lengths as physical
 * offsets (Marked deliberately omits reference-definition source lines).
 */
function governedNarrativeParagraphs(
  report: string,
  governedSection?: MarkdownSection,
): GovernedNarrativeParagraph[] {
  const blocks: GovernedNarrativeParagraph[] = [];
  let markerNonce = 0;
  let startMarker = '';
  let endMarker = '';
  do {
    startMarker = `<!--tiber-audit-governed-section-start-${markerNonce}-->`;
    endMarker = `<!--tiber-audit-governed-section-end-${markerNonce}-->`;
    markerNonce += 1;
  } while (report.includes(startMarker) || report.includes(endMarker));
  let source = report;
  if (governedSection) {
    const lineStarts = [0];
    for (const match of report.matchAll(/\n/g)) lineStarts.push((match.index ?? 0) + 1);
    const sectionStart = lineStarts[governedSection.startLine] ?? report.length;
    const sectionEnd = lineStarts[governedSection.endLine] ?? report.length;
    const beforeEnd = report.slice(sectionStart, sectionEnd);
    const endBoundary = beforeEnd.endsWith('\n') ? '' : '\n';
    source =
      report.slice(0, sectionStart) + `${startMarker}\n` +
      beforeEnd + endBoundary + `${endMarker}\n` +
      report.slice(sectionEnd);
  }
  let inGovernedSection = !governedSection;

  const visit = (tokens: MarkedToken[], topLevel: boolean): void => {
    for (const token of tokens) {
      if (topLevel && token.type === 'html') {
        if (token.raw.includes(startMarker)) inGovernedSection = true;
        if (token.raw.includes(endMarker)) inGovernedSection = false;
        continue;
      }
      if (token.type === 'paragraph' || token.type === 'heading' || (
        !topLevel && token.type === 'text' && Array.isArray(token.tokens)
      )) {
        blocks.push({
          value: renderedInlineText(token.tokens),
          kind: token.type === 'heading' ? 'heading' : 'paragraph',
          topLevel,
          inGovernedSection,
          problem: governedInlineProblem(token.tokens),
        });
      } else if (token.type === 'blockquote') {
        visit(token.tokens, false);
      } else if (token.type === 'list') {
        for (const item of token.items) visit(item.tokens, false);
      }
      // Code and table tokens intentionally do not recurse.
    }
  };

  visit(lexMarkdown(source, { gfm: true, async: false }) as MarkedToken[], true);
  return blocks;
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

interface GovernedColumn {
  key: string;
  label: string;
  matches: (header: string) => boolean;
}

/**
 * Require one and only one column for every governed meaning.
 *
 * Returning indexes (rather than assuming row[0]/row[1]) makes legitimate
 * reordering safe. Rejecting unknown columns matters just as much as rejecting
 * duplicate ones: a second, differently-titled value column can otherwise
 * contradict the governed cell while the checker validates only the first.
 */
function governedColumns(
  table: MarkdownTable,
  tableName: string,
  expected: GovernedColumn[],
): { indexes: Record<string, number>; problems: string[] } {
  const problems = [...table.problems.map((problem) => `${tableName}: ${problem}`)];
  const indexes: Record<string, number> = {};
  const headers = table.header.map((header) => normalizeHeadingContent(cleanCell(header)).toLowerCase());

  const claimed = new Set<number>();
  for (const column of expected) {
    const matches = headers
      .map((header, index) => column.matches(header) ? index : -1)
      .filter((index) => index !== -1);
    if (matches.length === 0) {
      problems.push(`${tableName} has no "${column.label}" column`);
    } else if (matches.length > 1) {
      problems.push(
        `${tableName} repeats the "${column.label}" column (${matches.length} columns match); exactly one is allowed`,
      );
    } else {
      indexes[column.key] = matches[0];
      claimed.add(matches[0]);
    }
  }
  headers.forEach((header, index) => {
    if (!claimed.has(index)) {
      problems.push(`${tableName} carries an unknown "${header || '(blank)'}" column`);
    }
  });
  return { indexes, problems };
}

function exactTableRows(
  table: MarkdownTable,
  tableName: string,
  labelColumn: number,
  expected: Array<{ key: string; label: string; matches: (label: string) => boolean }>,
): { rows: Record<string, string[]>; problems: string[] } {
  const problems: string[] = [];
  const rows: Record<string, string[]> = {};
  const claimed = new Set<number>();
  const labels = table.rows.map((row) => normalizeHeadingContent(cleanCell(row[labelColumn] ?? '')).toLowerCase());

  for (const governed of expected) {
    const matches = labels
      .map((label, index) => governed.matches(label) ? index : -1)
      .filter((index) => index !== -1);
    if (matches.length === 0) {
      problems.push(`${tableName} has no "${governed.label}" row`);
    } else if (matches.length > 1) {
      problems.push(
        `${tableName} repeats the "${governed.label}" row (${matches.length} rows match); exactly one is allowed`,
      );
      matches.forEach((index) => claimed.add(index));
    } else {
      rows[governed.key] = table.rows[matches[0]];
      claimed.add(matches[0]);
    }
  }
  labels.forEach((label, index) => {
    if (!claimed.has(index)) {
      problems.push(`${tableName} carries an unexpected "${label || '(blank)'}" row`);
    }
  });
  return { rows, problems };
}

const CLAMP_POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;

export const IDENTITY_SECTION_HEADING = /^#{1,6}\s+3(?!\w)(?!\.\d)/;

const IDENTITY_ROWS = [
  { key: 'rows', label: 'rows', matches: (label: string) => label === 'rows' },
  { key: 'distinct', label: 'distinct identifiers', matches: (label: string) => label === 'distinct identifiers' },
  {
    key: 'gsis',
    label: 'GSIS-shaped identifiers',
    matches: (label: string) =>
      label === 'gsis-shaped (00- + 7 digits)' || label === 'gsis-shaped identifiers',
  },
  { key: 'other', label: 'other namespaces', matches: (label: string) => label === 'other namespaces' },
  { key: 'canonical', label: 'canonical coverage', matches: (label: string) => label === 'canonical coverage' },
  { key: 'crossSurface', label: 'cross-surface resolvability', matches: (label: string) => label === 'cross-surface resolvability' },
] as const;

/** Compare the report's §3 identity summary with cacheCohort.identity. */
export function reportIdentityProblems(report: string, identity: any): string[] {
  if (!identity) return [];
  const syntaxProblems = governedMarkdownSyntaxProblems(report);
  if (syntaxProblems.length) return syntaxProblems;
  const sections = readMarkdownSections(report, IDENTITY_SECTION_HEADING);
  if (sections.length === 0) {
    return ['report has no §3 section for the manifest identity findings to be checked against'];
  }
  if (sections.length > 1) {
    return [`report carries ${sections.length} sections whose heading matches §3; exactly one may state these findings`];
  }

  const structuralProblems = sections[0].tables.length === 1
    ? []
    : [`report's §3 section carries ${sections[0].tables.length} tables; exactly one identity-summary table is allowed`];

  const candidates = sections[0].tables.filter((table) => {
    const cells = table.rows.flat().map((cell) => normalizeHeadingContent(cleanCell(cell)).toLowerCase());
    return cells.includes('rows') || cells.includes('distinct identifiers');
  });
  if (candidates.length === 0) {
    return ['report has no identity-summary table for the manifest identity findings to be checked against'];
  }
  if (candidates.length > 1) {
    return [`report carries ${candidates.length} identity-summary tables; exactly one may state these findings`];
  }

  const table = candidates[0];
  const schema = governedColumns(table, "report's identity-summary table", [
    { key: 'measure', label: 'measure', matches: (header) => header === 'measure' },
    { key: 'value', label: 'value', matches: (header) => header === 'value' },
  ]);
  if (schema.problems.length) return schema.problems;
  const exactRows = exactTableRows(
    table,
    "report's identity-summary table",
    schema.indexes.measure,
    [...IDENTITY_ROWS],
  );
  const problems = [...structuralProblems, ...exactRows.problems];
  const value = (key: string) => cleanCell(exactRows.rows[key]?.[schema.indexes.value] ?? '');
  const checkNumber = (key: string, label: string, expected: number) => {
    const stated = strictNumber(value(key));
    if (stated !== expected) {
      problems.push(`report states identity ${label} as "${value(key)}"; the manifest measured ${expected}`);
    }
  };

  checkNumber('rows', 'rows', Number(identity.totalRows));
  const distinctCell = value('distinct');
  const zeroDuplicateMatch = /^\s*(\d+)\s*\((?:zero|no) duplicates?\)\s*$/i.exec(distinctCell);
  const countedDuplicateMatch =
    /^\s*(\d+)\s*\((\d+) duplicate IDs?(?:,\s*(\d+) excess rows?)?\)\s*$/i.exec(distinctCell);
  const statedDistinct = zeroDuplicateMatch?.[1] ?? countedDuplicateMatch?.[1];
  if (Number(statedDistinct) !== Number(identity.distinctIds)) {
    problems.push(
      `report states distinct identifiers as "${distinctCell}"; the manifest measured ${identity.distinctIds}`,
    );
  }
  const expectedDuplicateIds = Array.isArray(identity.duplicateIds) ? identity.duplicateIds.length : 0;
  const statedDuplicateIds = zeroDuplicateMatch ? 0 : Number(countedDuplicateMatch?.[2]);
  if (statedDuplicateIds !== expectedDuplicateIds) {
    problems.push(
      `report states duplicate identifiers as "${distinctCell}"; the manifest lists ${expectedDuplicateIds} duplicate IDs`,
    );
  }
  if (countedDuplicateMatch?.[3] !== undefined) {
    const expectedExcessRows = Number(identity.totalRows) - Number(identity.distinctIds);
    if (Number(countedDuplicateMatch[3]) !== expectedExcessRows) {
      problems.push(
        `report states excess identity rows as ${countedDuplicateMatch[3]}; ` +
        `totalRows minus distinctIds is ${expectedExcessRows}`,
      );
    }
  }

  const gsisCell = value('gsis');
  const gsis = parseCountCell(gsisCell);
  if (gsis.count !== Number(identity.gsisShaped)) {
    problems.push(`report states GSIS-shaped identifiers as "${gsisCell}"; the manifest measured ${identity.gsisShaped}`);
  }
  const expectedGsisPct = Number(identity.gsisShapedPct).toFixed(1);
  if (gsis.pct !== expectedGsisPct) {
    problems.push(`report states the GSIS-shaped percentage as "${gsis.pct ?? 'none'}%"; the manifest measured ${expectedGsisPct}%`);
  }
  checkNumber('other', 'other namespaces', Number(identity.totalRows) - Number(identity.gsisShaped));

  const canonicalCell = value('canonical');
  const coverage = identity.canonicalCoverage;
  if (coverage?.recorded === false) {
    if (!/^not recorded — the capture predates the per-item identity envelope$/i.test(canonicalCell)) {
      problems.push(`report states canonical coverage as "${canonicalCell}"; the manifest says it was not recorded`);
    }
  } else if (coverage?.recorded === true) {
    const recordedMatch = /^(\d+) resolved(?:,| and) (\d+) unresolved$/i.exec(canonicalCell);
    const stated = recordedMatch ? [Number(recordedMatch[1]), Number(recordedMatch[2])] : [];
    const expected = [Number(coverage.resolved), Number(coverage.unresolved)];
    if (stated.length !== 2 || stated[0] !== expected[0] || stated[1] !== expected[1]) {
      problems.push(
        `report states canonical coverage as "${canonicalCell}"; the manifest measured ${expected[0]} resolved and ${expected[1]} unresolved`,
      );
    }
  }

  const crossSurfaceCell = value('crossSurface');
  if (
    identity.crossSurfaceResolvability === 'unavailable_requires_database' &&
    !/^unavailable — requires database$/i.test(crossSurfaceCell)
  ) {
    problems.push(
      `report states cross-surface resolvability as "${crossSurfaceCell}"; the manifest says unavailable_requires_database`,
    );
  }
  return problems;
}

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

  const syntaxProblems = governedMarkdownSyntaxProblems(report);
  if (syntaxProblems.length) return syntaxProblems;

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
  if (sections[0].tables.length !== 2) {
    problems.push(
      `report's §4.3 section carries ${sections[0].tables.length} tables; ` +
      'exactly two governed tables (declared bounds and observed clamping) are allowed',
    );
  }
  const declaredCandidates = sections[0].tables.filter((table) => {
    const headers = table.header.map((header) => normalizeHeadingContent(cleanCell(header)).toLowerCase());
    return headers.some((header) => /^outmin$/i.test(header)) || headers.some((header) => /^outmax$/i.test(header));
  });
  if (declaredCandidates.length === 0) {
    problems.push('report has no declared-bounds table for the manifest clamping findings to be checked against');
  } else if (declaredCandidates.length > 1) {
    problems.push(`report carries ${declaredCandidates.length} declared-bounds tables; exactly one may state these findings`);
  } else {
    const declared = declaredCandidates[0];
    const declaredSchema = governedColumns(declared, "report's declared-bounds table", [
      { key: 'position', label: 'position', matches: (header) => header === 'position' },
      { key: 'p10', label: 'p10', matches: (header) => header === 'p10' },
      { key: 'p90', label: 'p90', matches: (header) => header === 'p90' },
      { key: 'outMin', label: 'outMin', matches: (header) => header === 'outmin' },
      { key: 'outMax', label: 'outMax', matches: (header) => header === 'outmax' },
    ]);
    problems.push(...declaredSchema.problems);
    if (declaredSchema.problems.length === 0) {
      const rows = exactTableRows(
        declared,
        "report's declared-bounds table",
        declaredSchema.indexes.position,
        CLAMP_POSITIONS.map((position) => ({
          key: position,
          label: position,
          matches: (label: string) => label === position.toLowerCase(),
        })),
      );
      problems.push(...rows.problems);
      for (const position of CLAMP_POSITIONS) {
        const row = rows.rows[position];
        const measured = byPosition[position]?.declaredBounds;
        if (!row || !measured) continue;
        for (const key of ['p10', 'p90', 'outMin', 'outMax'] as const) {
          const stated = strictNumber(row[declaredSchema.indexes[key]] ?? '');
          const expected = Number(measured[key]);
          if (stated !== expected) {
            problems.push(
              `report states ${position} declared ${key} as "${cleanCell(row[declaredSchema.indexes[key]] ?? '')}"; ` +
              `the manifest measured ${expected}`,
            );
          }
        }
      }
    }
  }

  const candidates = sections[0].tables
    .filter((t) => t.header.some((h) => /at floor/i.test(normalizeHeadingContent(cleanCell(h)))));
  if (candidates.length === 0) {
    return ['report has no observed-clamping table for the manifest clamping findings to be checked against'];
  }
  if (candidates.length > 1) {
    return [
      `report carries ${candidates.length} observed-clamping tables; exactly one may state these findings`,
    ];
  }
  const table = candidates[0];

  const schema = governedColumns(table, "report's clamping table", [
    { key: 'position', label: 'position', matches: (header) => header === 'position' },
    { key: 'n', label: 'n', matches: (header) => header === 'n' },
    { key: 'min', label: 'min', matches: (header) => header === 'min' },
    { key: 'max', label: 'max', matches: (header) => header === 'max' },
    { key: 'floor', label: 'at floor', matches: (header) => /^at floor(?:\s|$)/.test(header) },
    { key: 'ceiling', label: 'at ceiling', matches: (header) => /^at ceiling(?:\s|$)/.test(header) },
  ]);
  problems.push(...schema.problems);
  if (problems.length) return problems;
  const columns = schema.indexes;

  const declaredBounds = CLAMP_POSITIONS
    .map((position) => byPosition[position]?.declaredBounds)
    .filter(Boolean);
  for (const [key, label, values] of [
    ['floor', 'at floor', new Set(declaredBounds.map((bound: any) => Number(bound.outMin)))],
    ['ceiling', 'at ceiling', new Set(declaredBounds.map((bound: any) => Number(bound.outMax)))],
  ] as const) {
    const header = normalizeHeadingContent(cleanCell(table.header[columns[key]] ?? '')).toLowerCase();
    if (values.size !== 1) {
      problems.push(`manifest has no single common ${label} bound across positions`);
      continue;
    }
    const expected = [...values][0];
    const expectedHeader = `${label} ${expected.toFixed(1)}`;
    if (header !== expectedHeader) {
      problems.push(
        `report's clamping table states its ${label} header as "${header}"; ` +
        `the manifest common bound must render as "${expectedHeader}"`,
      );
    }
  }
  if (problems.length) return problems;

  const observedRows = exactTableRows(
    table,
    "report's clamping table",
    columns.position,
    [...CLAMP_POSITIONS, 'total'].map((position) => ({
      key: position.toLowerCase(),
      label: position,
      matches: (label: string) => label === position.toLowerCase(),
    })),
  );
  problems.push(...observedRows.problems);

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

    const row = observedRows.rows[position.toLowerCase()];
    if (!row) {
      problems.push(`report's clamping table has no "${position}" row`);
      continue;
    }
    for (const [label, index, expected] of [
      ['n', columns.n, Number(measured.n)],
      ['min', columns.min, Number(measured.min)],
      ['max', columns.max, Number(measured.max)],
    ] as const) {
      const stated = strictNumber(cell(row, index));
      if (stated !== expected) {
        problems.push(`report states ${position} ${label} as "${cell(row, index)}"; the manifest measured ${expected}`);
      }
    }
    checkCount(
      `${position} at-floor`, row, columns.floor,
      Number(measured.atFloor), formatClampPct(Number(measured.atFloor), Number(measured.n)),
    );
    checkCount(`${position} at-ceiling`, row, columns.ceiling, Number(measured.atCeiling));
    if (parseCountCell(cell(row, columns.ceiling)).pct !== null) {
      problems.push(`report states a ${position} at-ceiling percentage; this governed cell must carry a count only`);
    }
  }

  const totalRow = observedRows.rows.total;
  if (!totalRow) {
    problems.push('report\'s clamping table has no "total" row');
  } else {
    const stated = strictNumber(cell(totalRow, columns.n));
    if (stated !== totalN) {
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
    if (parseCountCell(cell(totalRow, columns.ceiling)).pct !== null) {
      problems.push('report states a total at-ceiling percentage; this governed cell must carry a count only');
    }
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
  { label: /^within ±1(?:\.0)? alpha$/, describe: 'within ±1.0 alpha', key: 'within1' },
  { label: /^within ±5(?:\.0)? alpha$/, describe: 'within ±5.0 alpha', key: 'within5' },
  { label: /^median delta(?: \(cache − static\))?$/, describe: 'median delta', key: 'medianDelta' },
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

const EXACT_AGREEMENT_NARRATIVE_ROOT = /\bartifacts\s+agree\s+exactly\s+on\b/giu;

/**
 * Bind §5.2's redundant prose result to the same manifest fields as its table.
 *
 * This deliberately governs one exact sentence rather than attempting to
 * infer whether arbitrary English agrees with the table. Every visible
 * narrative use of the narrow "artifacts agree exactly on" root is counted
 * across the report: the one allowed use must be a standalone paragraph in
 * §5.2 and must match the manifest-derived template exactly. A second use is
 * contradictory/ambiguous even when the required sentence is still present.
 */
function exactAgreementNarrativeProblems(
  report: string,
  section: MarkdownSection,
  descriptiveComparison: any,
): string[] {
  const exactAgreement = descriptiveComparison.exactAgreement;
  const joinedRows = descriptiveComparison.joinedRows;
  if (
    typeof exactAgreement !== 'number' || !Number.isSafeInteger(exactAgreement) ||
    typeof joinedRows !== 'number' || !Number.isSafeInteger(joinedRows)
  ) {
    return ['manifest exact-agreement counts are not integers, so §5.2 narrative cannot be governed'];
  }

  const quantity = exactAgreement === 0
    ? 'none'
    : exactAgreement === joinedRows
      ? 'all'
      : String(exactAgreement);
  const expected =
    `The two artifacts agree exactly on ${quantity} of the ${joinedRows} shared players.`;
  const rooted = governedNarrativeParagraphs(report, section).flatMap((paragraph) => {
    const matches = [...paragraph.value.matchAll(EXACT_AGREEMENT_NARRATIVE_ROOT)];
    return matches.map(() => paragraph);
  });

  if (rooted.length === 0) {
    return [
      'report has no governed exact-agreement narrative in §5.2; expected the manifest-derived sentence ' +
      JSON.stringify(expected),
    ];
  }
  if (rooted.length > 1) {
    return [
      `report carries ${rooted.length} visible narrative claims rooted at "artifacts agree exactly on"; ` +
      'exactly one manifest-bound claim is allowed',
    ];
  }

  const [claim] = rooted;
  if (claim.problem) {
    return [
      `report's exact-agreement narrative is carried by ${claim.problem}; ` +
      'the governed claim must be directly visible paragraph text',
    ];
  }
  if (claim.kind !== 'paragraph' || !claim.topLevel) {
    return [
      `report's exact-agreement narrative is rendered as a ${claim.topLevel ? claim.kind : `nested ${claim.kind}`}; ` +
      'the governed claim must be one standalone top-level paragraph in §5.2',
    ];
  }
  if (!claim.inGovernedSection) {
    return ['report states its governed exact-agreement narrative outside the unique §5.2 section'];
  }
  if (claim.value !== expected) {
    return [
      `report's exact-agreement narrative is ${JSON.stringify(claim.value)}; ` +
      `the manifest requires ${JSON.stringify(expected)}`,
    ];
  }
  return [];
}

/**
 * Problems in how the report states the manifest's descriptive comparison.
 *
 * Deliberately NOT a substring scan of the whole document. `report.includes('0')`
 * is satisfied by any zero anywhere — a date, a GSIS id, a table of largest
 * disagreements — so a reviewer could rewrite the summary cells and `--check`
 * would still print "report consistent". Each measure is now read from the row
 * that states it, in the table under the descriptive-comparison heading, and
 * compared numerically. The section's exact-agreement prose is also governed
 * as one exact manifest-derived sentence; any additional visible narrative
 * claim using the same narrow root is rejected as contradictory/ambiguous.
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

  const syntaxProblems = governedMarkdownSyntaxProblems(report);
  if (syntaxProblems.length) return syntaxProblems;

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
  problems.push(...exactAgreementNarrativeProblems(report, sections[0], dc));
  if (sections[0].tables.length !== 2) {
    problems.push(
      `report's §5.2 section carries ${sections[0].tables.length} tables; ` +
      'exactly two governed tables (summary and largest disagreements) are allowed',
    );
  }

  // The descriptive-comparison table is identified by its shape (a "joined
  // rows" row), not by position — §5.2 also carries a second, unrelated
  // "largest absolute disagreements" table that must not be mistaken for it.
  const candidateDetails = sections[0].tables.map((table) => ({
    table,
    schema: governedColumns(table, "report's descriptive-comparison table", [
      { key: 'measure', label: 'measure', matches: (header) => header === 'measure' },
      { key: 'value', label: 'value', matches: (header) => header === 'value' },
    ]),
  }));
  const candidates = candidateDetails.filter(({ table }) => {
    const measureColumns = table.header
      .map((header, index) => normalizeHeadingContent(cleanCell(header)).toLowerCase() === 'measure' ? index : -1)
      .filter((index) => index !== -1);
    return measureColumns.some((measure) =>
      table.rows.some((row) => /^joined rows$/i.test(normalizeHeadingContent(cleanCell(row[measure] ?? '')))),
    );
  });
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
  const candidate = candidates[0];
  problems.push(...candidate.schema.problems);
  if (problems.length) return problems;
  const summaryRows = exactTableRows(
    candidate.table,
    "report's descriptive-comparison table",
    candidate.schema.indexes.measure,
    [
      ...COMPARISON_ROWS.map(({ label, describe, key }) => ({
        key,
        label: describe,
        matches: (rowLabel: string) => label.test(rowLabel),
      })),
      { key: 'range', label: 'range', matches: (rowLabel: string) => /^range$/.test(rowLabel) },
    ],
  );
  problems.push(...summaryRows.problems);
  const rowsMatching = (label: RegExp) =>
    candidate.table.rows
      .map((row) => ({
        label: normalizeHeadingContent(cleanCell(row[candidate.schema.indexes.measure] ?? '')).toLowerCase(),
        value: cleanCell(row[candidate.schema.indexes.value] ?? ''),
      }))
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
    const stated = strictNumber(matches[0].value);
    if (stated !== Number(expected)) {
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
      const stated = strictNumberPair(rangeMatches[0].value);
      const expected = [Number(dc.minDelta), Number(dc.maxDelta)];
      if (!stated || stated[0] !== expected[0] || stated[1] !== expected[1]) {
        problems.push(
          `report's range row states [${stated?.join(', ') ?? 'invalid'}]; the manifest measured ` +
          `[${expected.join(', ')}] in that order (minimum first)`,
        );
      }
    }
  }

  // The section heading counts the shared players too, and a heading that
  // disagrees with its own table is exactly the drift this check exists for.
  // Read from the section the scanner already found above (fence/indent
  // aware), not a second, separately-matched raw line.
  const headingLine = sections[0].normalizedHeading;
  if (dc.joinedRows !== null && dc.joinedRows !== undefined) {
    // Drop the leading section number ("### 5.2 ") so only counts stated in the
    // heading's prose are read.
    const headingProse = headingLine.replace(
      /^#{1,6}\s+5\.2(?!\w)(?!\.\d)[.\s—:-]*/,
      '',
    );
    const headingMatch = /^descriptive comparison across the (\d+) shared players$/i.exec(headingProse);
    if (!headingMatch) {
      problems.push(
        'report\'s descriptive-comparison heading does not state the shared-player count with the exact governed template ' +
        '"Descriptive comparison across the N shared players"',
      );
    } else if (Number(headingMatch[1]) !== Number(dc.joinedRows)) {
      problems.push(
        `report's descriptive-comparison heading states ${headingMatch[1]} shared players; the manifest measured ${dc.joinedRows}`,
      );
    }
  }

  const detailCandidates = sections[0].tables.filter((table) => {
    const headers = table.header.map((header) => normalizeHeadingContent(cleanCell(header)).toLowerCase());
    return headers.includes('gsis') || headers.includes('delta');
  });
  if (detailCandidates.length === 0) {
    problems.push('report has no largest-absolute-deltas table for the manifest comparison to be checked against');
  } else if (detailCandidates.length > 1) {
    problems.push(`report carries ${detailCandidates.length} largest-absolute-deltas tables; exactly one may state these findings`);
  } else {
    const detail = detailCandidates[0];
    const detailSchema = governedColumns(detail, "report's largest-absolute-deltas table", [
      { key: 'player', label: 'player', matches: (header) => header === 'player' },
      { key: 'gsis', label: 'GSIS', matches: (header) => header === 'gsis' },
      { key: 'position', label: 'pos', matches: (header) => header === 'pos' },
      { key: 'staticAlpha', label: 'static alpha', matches: (header) => header === 'static alpha' },
      { key: 'cacheAlpha', label: 'cache alpha', matches: (header) => header === 'cache alpha' },
      { key: 'delta', label: 'delta', matches: (header) => header === 'delta' },
    ]);
    problems.push(...detailSchema.problems);
    if (detailSchema.problems.length === 0) {
      const expected = Array.isArray(dc.largestAbsoluteDeltas) ? dc.largestAbsoluteDeltas.slice(0, 5) : [];
      if (detail.rows.length !== expected.length) {
        problems.push(
          `report's largest-absolute-deltas table carries ${detail.rows.length} rows; ` +
          `the manifest publishes ${expected.length} rendered rows`,
        );
      }
      for (let i = 0; i < Math.min(detail.rows.length, expected.length); i += 1) {
        const row = detail.rows[i];
        const measured = expected[i];
        const textual = [
          ['player', measured.playerName],
          ['gsis', measured.gsisPlayerId],
          ['position', measured.position],
        ] as const;
        for (const [key, expectedValue] of textual) {
          const stated = cleanCell(row[detailSchema.indexes[key]] ?? '');
          if (stated !== String(expectedValue)) {
            problems.push(
              `report's largest-absolute-deltas row ${i + 1} states ${key} as "${stated}"; ` +
              `the manifest measured "${expectedValue}" in that position`,
            );
          }
        }
        for (const [key, expectedValue] of [
          ['staticAlpha', measured.staticAlpha],
          ['cacheAlpha', measured.cacheAlpha],
          ['delta', measured.delta],
        ] as const) {
          const cell = cleanCell(row[detailSchema.indexes[key]] ?? '');
          const stated = strictNumber(cell);
          if (stated !== Number(expectedValue)) {
            problems.push(
              `report's largest-absolute-deltas row ${i + 1} states ${key} as "${cell}"; ` +
              `the manifest measured ${expectedValue} in that position`,
            );
          }
        }
      }
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
