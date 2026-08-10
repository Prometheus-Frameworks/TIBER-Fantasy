/**
 * Fantasy #309 — outline-button surface audit, encoded as a test.
 *
 * The `outline` variant now declares `bg-background` + `text-foreground`. Any
 * call site that overrides the background for a **dark** surface must also
 * override the foreground, because `twMerge` lets the call site's `bg-*` win
 * while the variant's dark `text-foreground` would otherwise survive — dark text
 * on a dark surface.
 *
 * The same applies to a `hover:bg-*` override that flips to a dark surface: the
 * variant's `hover:text-accent-foreground` is dark and must be overridden too.
 *
 * This is the standing version of the one-off audit: a new dark-surface outline
 * button that forgets its foreground fails here rather than shipping unreadable.
 */

import * as fs from 'fs';
import * as path from 'path';

const CLIENT_SRC = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

// Every Tailwind hue, not just the neutrals. Restricting these classifiers to
// slate/gray/zinc/neutral silently exempted coloured surfaces — first coloured
// dark hovers, then coloured dark *bases* such as `bg-blue-900`, which were
// classified as neither dark base nor dark hover and never audited at all.
const TW_HUE =
  '(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';

/** Dark surface: any hue at a dark shade, or a near-black arbitrary hex. */
const DARK_BG = new RegExp(`(?<!hover:)bg-${TW_HUE}-(?:6|7|8|9)00(?:\\/\\d+)?|(?<!hover:)bg-\\[#0`);
// `/20`-style opacity modifiers are part of the class name and must not defeat
// the match.
const DARK_HOVER_BG = new RegExp(`hover:bg-${TW_HUE}-(?:6|7|8|9)00(?:\\/\\d+)?|hover:bg-\\[#[01]`);
/**
 * A translucent hover of any hue composites over whatever is beneath it, so on
 * a surface the audit already classifies as dark the hover surface is dark too.
 */
const TRANSLUCENT_HOVER = new RegExp(`hover:bg-(?:${TW_HUE}-\\d{2,3}|\\[#[0-9a-fA-F]+\\])\\/\\d+`);

/**
 * Foreground **colour** utilities only.
 *
 * `text-*` is not evidence of a colour: `text-sm`, `text-xs` and `text-center`
 * are typography and layout. Accepting them let `bg-slate-900 text-sm` pass the
 * audit with no foreground colour supplied at all.
 *
 * This is deliberately an allowlist. An unrecognised `text-*` utility is not
 * treated as colour evidence, so the button gets reported rather than exempted
 * — the safe direction for an audit to be wrong in.
 */
const TEXT_COLOUR =
  `(?:${TW_HUE}-\\d{2,3}(?:\\/\\d+)?` +
  `|white|black|transparent|current|inherit` +
  `|foreground|background|primary|secondary|muted|accent|destructive|card|popover|ring` +
  `|(?:muted|primary|secondary|accent|destructive|card|popover)-foreground` +
  `|\\[[^\\]\\s]+\\])`;

const BASE_TEXT = new RegExp(`(?<!hover:)(?<!disabled:)(?<!focus:)\\btext-(?!accent-foreground\\b)${TEXT_COLOUR}`);
const HOVER_TEXT = new RegExp(`hover:text-${TEXT_COLOUR}`);

interface Site {
  file: string;
  tag: string;
  needsBaseText: boolean;
  needsHoverText: boolean;
}

/**
 * Yield each complete `<Button ...>` opening tag.
 *
 * A `[^>]*?>` regex cannot do this: an arrow callback such as
 * `onClick={(e) => ...}` contains a `>`, which ends the match early and hides
 * everything after it — including `className`. The audit would then silently
 * skip a dark-surface button and still claim repository-wide coverage.
 *
 * So track brace depth and quoting, and only accept `>` as the tag terminator
 * at depth 0 outside a string.
 */
function* openingTags(source: string): Generator<string> {
  const OPEN = '<Button';
  let index = source.indexOf(OPEN);

  while (index !== -1) {
    // Require a tag boundary so `<ButtonGroup` is not treated as `<Button`.
    if (!/[\s/>]/.test(source[index + OPEN.length] ?? '')) {
      index = source.indexOf(OPEN, index + OPEN.length);
      continue;
    }

    let depth = 0;
    let quote: string | null = null;
    let end = -1;

    for (let i = index + OPEN.length; i < source.length; i += 1) {
      const char = source[i];
      if (quote) {
        if (char === quote && source[i - 1] !== '\\') quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
      if (char === '{') { depth += 1; continue; }
      if (char === '}') { depth -= 1; continue; }
      if (char === '>' && depth === 0) { end = i; break; }
    }

    if (end === -1) return; // Unterminated tag; nothing further is parseable.
    yield source.slice(index, end + 1);
    index = source.indexOf(OPEN, end);
  }
}

/**
 * The audit's classification of a single opening tag.
 *
 * Extracted so the classifiers can be pinned directly. The repository sweep
 * only asserts a site count, which passes whether or not a classifier is
 * silently exempting surfaces — that is exactly how the neutral-hue-only
 * matchers survived three review rounds.
 */
export function classifyOutlineTag(tag: string) {
  const darkBase = DARK_BG.test(tag.replace(/hover:bg-[^\s"]+/g, ''));
  const darkHover = DARK_HOVER_BG.test(tag) || (darkBase && TRANSLUCENT_HOVER.test(tag));
  return {
    darkBase,
    darkHover,
    audited: darkBase || darkHover,
    needsBaseText: darkBase && !BASE_TEXT.test(tag),
    needsHoverText: darkHover && !HOVER_TEXT.test(tag),
  };
}

function auditOutlineButtons(): Site[] {
  const sites: Site[] = [];
  for (const file of walk(CLIENT_SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const tag of openingTags(source)) {
      if (!tag.includes('variant="outline"')) continue;

      const { darkBase, darkHover, needsBaseText, needsHoverText } = classifyOutlineTag(tag);
      if (!darkBase && !darkHover) continue;

      sites.push({
        file: path.relative(CLIENT_SRC, file),
        tag: tag.replace(/\s+/g, ' ').slice(0, 120),
        needsBaseText,
        needsHoverText,
      });
    }
  }
  return sites;
}

describe('the classifiers themselves', () => {
  const tag = (cls: string) => `<Button variant="outline" className="${cls}">`;

  describe('dark-base detection covers coloured hues, not just neutrals', () => {
    test('a coloured dark base is audited', () => {
      // The regression: `bg-blue-900 hover:bg-blue-500/20` was classified as
      // neither dark base nor dark hover, so it was never audited at all.
      const result = classifyOutlineTag(tag('bg-blue-900 hover:bg-blue-500/20'));
      expect(result.darkBase).toBe(true);
      expect(result.audited).toBe(true);
      expect(result.needsBaseText).toBe(true);
      expect(result.needsHoverText).toBe(true);
    });

    test.each(['bg-indigo-800', 'bg-emerald-700', 'bg-rose-900', 'bg-slate-900', 'bg-[#0a0e1a]'])(
      '%s counts as a dark base',
      (cls) => expect(classifyOutlineTag(tag(cls)).darkBase).toBe(true),
    );

    test('a light base is not audited', () => {
      expect(classifyOutlineTag(tag('bg-blue-100 text-blue-900')).audited).toBe(false);
    });

    test('a hover-only dark class does not make the base dark', () => {
      // Base darkness is judged with hover classes stripped, so a light button
      // that merely hovers dark is not reported as needing a base foreground.
      const result = classifyOutlineTag(tag('bg-white hover:bg-slate-800'));
      expect(result.darkBase).toBe(false);
      expect(result.darkHover).toBe(true);
    });
  });

  describe('foreground detection accepts colours, not typography', () => {
    test('text-sm is not evidence of a foreground colour', () => {
      // The regression: any `text-*` counted, so `bg-slate-900 text-sm` passed
      // the audit with no foreground colour supplied at all.
      expect(classifyOutlineTag(tag('bg-slate-900 text-sm')).needsBaseText).toBe(true);
    });

    test.each(['text-xs', 'text-lg', 'text-center', 'text-ellipsis', 'text-nowrap'])(
      '%s is typography or layout, not a colour',
      (cls) => expect(classifyOutlineTag(tag(`bg-slate-900 ${cls}`)).needsBaseText).toBe(true),
    );

    test.each(['text-slate-100', 'text-white', 'text-blue-200', 'text-foreground', 'text-[#fff]'])(
      '%s satisfies the base foreground requirement',
      (cls) => expect(classifyOutlineTag(tag(`bg-slate-900 ${cls}`)).needsBaseText).toBe(false),
    );

    test('hover foreground detection is colour-specific too', () => {
      expect(classifyOutlineTag(tag('hover:bg-slate-800 hover:text-sm')).needsHoverText).toBe(true);
      expect(classifyOutlineTag(tag('hover:bg-slate-800 hover:text-slate-100')).needsHoverText).toBe(false);
    });

    test('an unrecognised text utility is reported rather than exempted', () => {
      // The allowlist fails toward reporting: a utility the audit does not
      // recognise must not silently satisfy the foreground requirement.
      expect(classifyOutlineTag(tag('bg-slate-900 text-somethingnew')).needsBaseText).toBe(true);
    });
  });
});

describe('outline buttons on dark surfaces', () => {
  const sites = auditOutlineButtons();

  test('the audit finds the known dark-surface call sites', () => {
    // Guards the audit itself: if the regexes silently stop matching, this trips
    // rather than the suite passing vacuously.
    expect(sites.length).toBeGreaterThanOrEqual(5);
  });

  test('every dark-surface outline button declares its own foreground', () => {
    const offenders = sites
      .filter((site) => site.needsBaseText)
      .map((site) => `${site.file}: ${site.tag}`);

    expect(offenders).toEqual([]);
  });

  test('every outline button that hovers to a dark surface overrides the hover foreground', () => {
    const offenders = sites
      .filter((site) => site.needsHoverText)
      .map((site) => `${site.file}: ${site.tag}`);

    expect(offenders).toEqual([]);
  });
});
