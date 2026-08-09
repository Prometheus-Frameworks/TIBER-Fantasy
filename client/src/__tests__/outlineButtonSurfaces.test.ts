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

const DARK_BG = /bg-(slate|gray|zinc|neutral)-(6|7|8|9)00|bg-\[#0/;
const DARK_HOVER_BG = /hover:bg-(slate|gray|zinc|neutral)-(6|7|8|9)00|hover:bg-\[#[01]/;
const BASE_TEXT = /(?<!hover:)(?<!disabled:)\btext-(?!accent-foreground\b)[a-z[]/;
const HOVER_TEXT = /hover:text-[a-z[]/;

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

function auditOutlineButtons(): Site[] {
  const sites: Site[] = [];
  for (const file of walk(CLIENT_SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const tag of openingTags(source)) {
      if (!tag.includes('variant="outline"')) continue;

      const darkBase = DARK_BG.test(tag.replace(/hover:bg-[^\s"]+/g, ''));
      const darkHover = DARK_HOVER_BG.test(tag);
      if (!darkBase && !darkHover) continue;

      sites.push({
        file: path.relative(CLIENT_SRC, file),
        tag: tag.replace(/\s+/g, ' ').slice(0, 120),
        needsBaseText: darkBase && !BASE_TEXT.test(tag),
        needsHoverText: darkHover && !HOVER_TEXT.test(tag),
      });
    }
  }
  return sites;
}

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
