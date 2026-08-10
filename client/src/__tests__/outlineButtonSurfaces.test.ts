/**
 * Fantasy #309 — outline-button surface audit, encoded as a test.
 *
 * The `outline` variant declares `bg-background` + `text-foreground`. Legibility
 * therefore depends on what the call site overrides, and it can fail in both
 * directions:
 *
 *  - **Dark surface, no foreground.** A call site that overrides the background
 *    for a dark surface must also override the foreground, because `twMerge`
 *    lets the call site's `bg-*` win while the variant's light-surface
 *    `text-foreground` survives — dark text on a dark surface.
 *  - **Light surface, light foreground.** The mirror case, and the one the
 *    earlier revisions never looked at: a call site that overrides only the
 *    *foreground* to a light colour lands that light text on the variant's own
 *    light `bg-background`. There is no local `bg-*` to notice, so an audit
 *    keyed on dark backgrounds skips it entirely.
 *
 * The same applies to `hover:` overrides, including translucent hovers that
 * composite over a dark ancestor rather than over a local background.
 *
 * This is the standing version of the one-off audit: a new outline button that
 * forgets a foreground — on either surface — fails here rather than shipping
 * unreadable.
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
// dark hovers, then coloured dark *bases* such as `bg-blue-900`.
const TW_HUE =
  '(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';

// 950 is a real Tailwind shade and is darker than 900. Omitting it exempted the
// darkest surfaces in the palette from an audit about dark surfaces.
const DARK_SHADE = '(?:600|700|800|900|950)';

/* ------------------------------------------------------------------ *
 * Arbitrary colours, by luminance rather than by leading hex digit.
 * ------------------------------------------------------------------ */

/**
 * WCAG relative luminance of a hex colour, or null if it is not one.
 *
 * The previous classifier tested `bg-\[#0` — a leading-digit heuristic. It
 * matched `#0a0e1a` and missed every other dark hex in the repository,
 * `#1a1a1a` and `#111827` among them. Computing the luminance removes the
 * guesswork and makes `bg-[#...]` behave the same way for any value.
 */
export function hexLuminance(value: string): number | null {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const channel = (pair: string) => {
    const srgb = parseInt(pair, 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(hex.slice(0, 2))
    + 0.7152 * channel(hex.slice(2, 4))
    + 0.0722 * channel(hex.slice(4, 6));
}

/** Midpoint split. A surface either reads as dark or it does not. */
const DARK_LUMINANCE_MAX = 0.18;
const LIGHT_LUMINANCE_MIN = 0.4;

function arbitraryValue(cls: string): string | null {
  const match = /\[([^\]]+)\]$/.exec(cls);
  return match ? match[1] : null;
}

/* ------------------------------------------------------------------ *
 * Class extraction
 * ------------------------------------------------------------------ */

const CLASS_TOKEN = /[\w:/[\]#().,%-]+/g;

/** Every class-like token in a tag, with its variant prefixes intact. */
function tokens(tag: string): string[] {
  return tag.match(CLASS_TOKEN) ?? [];
}

const STATE_PREFIX = /^(hover|focus|focus-visible|active|disabled|group-hover|peer-hover|dark|aria-\w+|data-\[[^\]]*\])?:/;

function stripPrefix(token: string): { prefix: string | null; base: string } {
  const match = STATE_PREFIX.exec(token);
  if (!match || !match[1]) return { prefix: null, base: token };
  return { prefix: match[1], base: token.slice(match[0].length) };
}

type Surface = 'dark' | 'light' | 'unknown';

/** Classify one `bg-*` utility (already stripped of its state prefix). */
export function backgroundSurface(base: string): Surface {
  if (!base.startsWith('bg-')) return 'unknown';
  const value = base.slice(3).replace(/\/\d+$/, '');

  if (value === 'black') return 'dark';
  if (value === 'white') return 'light';
  // `bg-transparent` overrides the variant's `bg-background`, so the effective
  // surface becomes the ancestor's. Resolved by the caller, which knows it.
  if (value === 'transparent') return 'unknown';
  // Semantic tokens: `background`/`card`/`popover` are the light-system
  // surfaces this variant is built on.
  if (/^(background|card|popover|muted|secondary)$/.test(value)) return 'light';
  if (/^(foreground|primary)$/.test(value)) return 'dark';

  const shade = new RegExp(`^${TW_HUE}-(\\d{2,3})$`).exec(value);
  if (shade) {
    const n = Number(shade[1]);
    if (n >= 600) return 'dark';
    if (n <= 300) return 'light';
    return 'unknown';
  }

  const arbitrary = arbitraryValue(base);
  if (arbitrary) {
    const luminance = hexLuminance(arbitrary);
    if (luminance === null) return 'unknown';
    if (luminance <= DARK_LUMINANCE_MAX) return 'dark';
    if (luminance >= LIGHT_LUMINANCE_MIN) return 'light';
    return 'unknown';
  }
  return 'unknown';
}

/**
 * Classify one `text-*` utility as a foreground colour.
 *
 * `text-*` is not evidence of a colour: `text-sm`, `text-center` and
 * `text-[10px]` are typography and layout. The arbitrary-value case is the
 * subtle one — `text-[10px]` and `text-[#fff]` share a syntax, and accepting
 * every `text-[...]` let a font size satisfy a colour requirement.
 *
 * Deliberately an allowlist. An unrecognised `text-*` utility is not treated as
 * colour evidence, so the button is reported rather than exempted.
 */
export function textColour(base: string): Surface | null {
  if (!base.startsWith('text-')) return null;
  const value = base.slice(5).replace(/\/\d+$/, '');

  if (value === 'white') return 'light';
  if (value === 'black') return 'dark';
  if (/^(foreground|primary|destructive|accent-foreground|primary-foreground|card-foreground|popover-foreground)$/.test(value)) return 'dark';
  if (/^(background|muted|muted-foreground|secondary-foreground)$/.test(value)) return 'light';
  if (/^(transparent|current|inherit)$/.test(value)) return 'unknown';

  // Foreground boundary, set from measured contrast rather than symmetry with
  // the background scale. On white, `gray-400` (#9ca3af) is 2.54:1 and fails AA,
  // while `gray-500` (#6b7280) is 4.83:1 and passes — so the failing boundary
  // for a *foreground* is 400, not 300. On a dark surface the same split holds
  // in reverse: `gray-400` on `slate-900` is 7.4:1 and is legible.
  // 500 is genuinely borderline and hue-dependent, so it stays unknown, which
  // reports rather than exempts.
  const shade = new RegExp(`^${TW_HUE}-(\\d{2,3})$`).exec(value);
  if (shade) {
    const n = Number(shade[1]);
    if (n <= 400) return 'light';
    if (n >= 600) return 'dark';
    return 'unknown';
  }

  const arbitrary = arbitraryValue(base);
  if (arbitrary) {
    // A colour, not a length. `text-[10px]` / `text-[1.5rem]` are typography.
    const luminance = hexLuminance(arbitrary);
    if (luminance !== null) {
      return luminance <= DARK_LUMINANCE_MAX ? 'dark'
        : luminance >= LIGHT_LUMINANCE_MIN ? 'light'
        : 'unknown';
    }
    if (/^(color:|rgb|hsl|var\()/.test(arbitrary)) return 'unknown';
    return null; // A length, a line-height, or something unrecognised.
  }
  return null; // text-sm, text-center, text-ellipsis, …
}

/* ------------------------------------------------------------------ *
 * Variant detection
 * ------------------------------------------------------------------ */

/**
 * Whether this tag can render as the `outline` variant.
 *
 * `variant="outline"` is only the literal case. A conditional —
 * `variant={active ? 'outline' : 'ghost'}` — renders as outline on one branch
 * and was skipped entirely by a substring test for `variant="outline"`.
 */
export function mentionsOutlineVariant(tag: string): boolean {
  if (/variant\s*=\s*["']outline["']/.test(tag)) return true;
  // Any expression-valued variant that names outline somewhere inside it.
  return /variant\s*=\s*\{/.test(tag) && /["']outline["']/.test(tag);
}

/* ------------------------------------------------------------------ *
 * Correlated ternary branches
 * ------------------------------------------------------------------ */

/** The balanced `{...}` expression for an attribute, or null. */
export function attrExpression(tag: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*\\{`).exec(tag);
  if (!match) return null;
  const start = match.index + match[0].length;
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < tag.length; i += 1) {
    const char = tag[i];
    if (quote) {
      if (char === quote && tag[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') { depth += 1; continue; }
    if (char === '}') {
      if (depth === 0) return tag.slice(start, i);
      depth -= 1;
    }
  }
  return null;
}

/** Split `cond ? a : b` at the top level, or null if it is not a ternary. */
export function splitTernary(expression: string): { cond: string; whenTrue: string; whenFalse: string } | null {
  let depth = 0;
  let quote: string | null = null;
  let question = -1;
  for (let i = 0; i < expression.length; i += 1) {
    const char = expression[i];
    if (quote) {
      if (char === quote && expression[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '(' || char === '[' || char === '{') { depth += 1; continue; }
    if (char === ')' || char === ']' || char === '}') { depth -= 1; continue; }
    if (char === '?' && depth === 0 && expression[i + 1] !== '.' && expression[i + 1] !== '?') { question = i; break; }
  }
  if (question === -1) return null;

  depth = 0; quote = null;
  for (let i = question + 1; i < expression.length; i += 1) {
    const char = expression[i];
    if (quote) {
      if (char === quote && expression[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '(' || char === '[' || char === '{') { depth += 1; continue; }
    if (char === ')' || char === ']' || char === '}') { depth -= 1; continue; }
    if (char === ':' && depth === 0) {
      return {
        cond: expression.slice(0, question).trim(),
        whenTrue: expression.slice(question + 1, i).trim(),
        whenFalse: expression.slice(i + 1).trim(),
      };
    }
  }
  return null;
}

/**
 * Reduce a tag to the branch that actually renders as `outline`.
 *
 * `variant={x === y ? 'default' : 'outline'} className={x === y ? 'bg-green-600' : ''}`
 * has correlated branches: the `bg-green-600` belongs to the `default` button,
 * not the outline one. Classifying the union of both branches produces a false
 * offender for that button, and — worse — a real offender elsewhere reported
 * under the wrong cause, which is how a genuine defect gets "fixed" in the
 * wrong place.
 *
 * Branches are treated as correlated only when the two conditions are
 * textually identical. Anything less certain is left as the union, which fails
 * toward reporting.
 */
export function outlineBranchTag(tag: string): string {
  const variantExpr = attrExpression(tag, 'variant');
  const classExpr = attrExpression(tag, 'className');
  if (!variantExpr || !classExpr) return tag;

  const variantTernary = splitTernary(variantExpr);
  const classTernary = splitTernary(classExpr);
  if (!variantTernary || !classTernary) return tag;

  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  if (norm(variantTernary.cond) !== norm(classTernary.cond)) return tag;

  const outlineIsTrueBranch = /["']outline["']/.test(variantTernary.whenTrue);
  const outlineIsFalseBranch = /["']outline["']/.test(variantTernary.whenFalse);
  if (outlineIsTrueBranch === outlineIsFalseBranch) return tag; // both or neither

  const branch = outlineIsTrueBranch ? classTernary.whenTrue : classTernary.whenFalse;
  return tag.replace(`className={${classExpr}}`, `className={${branch}}`);
}

/* ------------------------------------------------------------------ *
 * Classification
 * ------------------------------------------------------------------ */

export interface OutlineClassification {
  baseSurface: Surface;
  hoverSurface: Surface;
  /** True when the base surface comes from the variant, not a local override. */
  baseIsVariantDefault: boolean;
  needsBaseText: boolean;
  needsHoverText: boolean;
  audited: boolean;
  reasons: string[];
}

export interface ClassifyOptions {
  /** True when an enclosing element in the same file paints a dark surface. */
  darkAncestor?: boolean;
}

export function classifyOutlineTag(rawTag: string, options: ClassifyOptions = {}): OutlineClassification {
  const tag = outlineBranchTag(rawTag);
  let baseSurface: Surface = 'unknown';
  let hoverSurface: Surface = 'unknown';
  let baseText: Surface | null = null;
  let hoverText: Surface | null = null;
  let hasLocalBase = false;
  let transparentBase = false;
  let translucentHover = false;

  for (const token of tokens(tag)) {
    const { prefix, base } = stripPrefix(token);
    const isHoverish = prefix === 'hover' || prefix === 'group-hover' || prefix === 'peer-hover';

    if (base.startsWith('bg-')) {
      const surface = backgroundSurface(base);
      if (isHoverish) {
        hoverSurface = surface;
        if (/\/\d+$/.test(base)) translucentHover = true;
      } else if (!prefix) {
        hasLocalBase = true;
        if (/^bg-transparent(\/\d+)?$/.test(base)) transparentBase = true;
        baseSurface = surface;
      }
    } else if (base.startsWith('text-')) {
      const colour = textColour(base);
      if (colour === null) continue; // typography, not a colour
      if (isHoverish) hoverText = colour;
      else if (!prefix) baseText = colour;
    }
  }

  // No local background means the variant's own `bg-background` applies, which
  // is a LIGHT surface. This is the case the dark-background sweep never saw.
  const baseIsVariantDefault = !hasLocalBase;
  if (baseIsVariantDefault) baseSurface = 'light';
  // An explicit `bg-transparent` cancels the variant background, so the button
  // sits on whatever its ancestor paints.
  if (transparentBase) baseSurface = options.darkAncestor ? 'dark' : 'light';

  // A translucent hover composites over whatever is beneath it. That is the
  // local base when there is one, and otherwise the enclosing surface — which
  // is why a dark ancestor has to be considered even with no local `bg-*`.
  if (translucentHover && hoverSurface !== 'dark') {
    const beneath: Surface = (hasLocalBase && !transparentBase)
      ? baseSurface
      : (options.darkAncestor ? 'dark' : 'light');
    if (beneath === 'dark') hoverSurface = 'dark';
  }
  if (hoverSurface === 'unknown' && options.darkAncestor && translucentHover) hoverSurface = 'dark';

  const reasons: string[] = [];

  // Dark surface with no foreground, or with a dark foreground.
  const needsBaseTextDark = baseSurface === 'dark' && baseText !== 'light';
  // Light surface with a light foreground. Absent foreground is fine here: the
  // variant's own `text-foreground` is dark and correct on a light surface.
  const needsBaseTextLight = baseSurface === 'light' && baseText === 'light';

  if (needsBaseTextDark) {
    reasons.push(baseText === null
      ? 'dark base surface with no foreground colour'
      : 'dark base surface with a dark foreground colour');
  }
  if (needsBaseTextLight) {
    reasons.push(baseIsVariantDefault
      ? 'light foreground on the variant default light background'
      : 'light foreground on a light base surface');
  }

  const needsHoverTextDark = hoverSurface === 'dark' && hoverText !== 'light'
    // A base foreground that is already light carries into hover.
    && !(hoverText === null && baseText === 'light');
  const needsHoverTextLight = hoverSurface === 'light' && hoverText === 'light';

  if (needsHoverTextDark) reasons.push('hovers to a dark surface without a light hover foreground');
  if (needsHoverTextLight) reasons.push('light hover foreground on a light hover surface');

  return {
    baseSurface,
    hoverSurface,
    baseIsVariantDefault,
    needsBaseText: needsBaseTextDark || needsBaseTextLight,
    needsHoverText: needsHoverTextDark || needsHoverTextLight,
    audited: baseSurface !== 'unknown' || hoverSurface !== 'unknown',
    reasons,
  };
}

/* ------------------------------------------------------------------ *
 * Repository sweep
 * ------------------------------------------------------------------ */

/**
 * Yield each complete `<Button ...>` opening tag with its source offset.
 *
 * A `[^>]*?>` regex cannot do this: an arrow callback such as
 * `onClick={(e) => ...}` contains a `>`, which ends the match early and hides
 * everything after it — including `className`.
 */
export function* openingTags(source: string): Generator<{ tag: string; index: number }> {
  const OPEN = '<Button';
  let index = source.indexOf(OPEN);

  while (index !== -1) {
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

    if (end === -1) return;
    yield { tag: source.slice(index, end + 1), index };
    index = source.indexOf(OPEN, end);
  }
}

/**
 * Whether anything before this point in the file paints a dark surface.
 *
 * A translucent hover with no local background composites over its ancestor,
 * and JSX nesting is not reliably parseable from source text. So this is
 * deliberately a conservative over-approximation: if the file paints anything
 * dark above the button, the button's translucent hover is treated as landing
 * on dark. It fails toward reporting, which is the safe direction here.
 */
export function darkAncestorBefore(source: string, index: number): boolean {
  const before = source.slice(0, index);
  for (const token of tokens(before)) {
    const { prefix, base } = stripPrefix(token);
    if (prefix) continue;
    if (backgroundSurface(base) === 'dark') return true;
  }
  return /\btmd-(shell|surface|panel|root)\b/.test(before);
}

export interface Site {
  file: string;
  tag: string;
  needsBaseText: boolean;
  needsHoverText: boolean;
  reasons: string[];
}

export function auditOutlineButtons(): Site[] {
  const sites: Site[] = [];
  for (const file of walk(CLIENT_SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const { tag, index } of openingTags(source)) {
      if (!mentionsOutlineVariant(tag)) continue;

      const result = classifyOutlineTag(tag, { darkAncestor: darkAncestorBefore(source, index) });
      if (!result.needsBaseText && !result.needsHoverText) continue;

      sites.push({
        file: `${path.relative(CLIENT_SRC, file)}:${source.slice(0, index).split('\n').length}`,
        tag: tag.replace(/\s+/g, ' ').slice(0, 140),
        needsBaseText: result.needsBaseText,
        needsHoverText: result.needsHoverText,
        reasons: result.reasons,
      });
    }
  }
  return sites;
}

/* ------------------------------------------------------------------ *
 * Adversarial pins
 *
 * The repository sweep asserts an empty offender list, which passes just as
 * well when a classifier has silently stopped matching. Each block below pins
 * one classifier family so that deleting it fails deterministically rather
 * than quietly widening the exemption — which is exactly how the
 * neutral-hue-only matchers survived three review rounds.
 * ------------------------------------------------------------------ */

describe('classifier: dark base surfaces', () => {
  const tag = (cls: string) => `<Button variant="outline" className="${cls}">`;

  test.each([
    'bg-blue-900', 'bg-indigo-800', 'bg-emerald-700', 'bg-rose-900', 'bg-slate-900',
    'bg-slate-950', 'bg-neutral-950', 'bg-black', 'bg-[#0a0e1a]', 'bg-[#1a1a1a]',
    'bg-[#111827]', 'bg-[#141824]', 'bg-[#222]',
  ])('%s is a dark base needing a foreground', (cls) => {
    const result = classifyOutlineTag(tag(cls));
    expect(result.baseSurface).toBe('dark');
    expect(result.needsBaseText).toBe(true);
  });

  test('950 shades are dark — omitting them exempted the darkest surfaces', () => {
    expect(backgroundSurface('bg-slate-950')).toBe('dark');
    expect(backgroundSurface('bg-zinc-950')).toBe('dark');
  });

  test('bg-black is dark even though it carries no numeric shade', () => {
    expect(backgroundSurface('bg-black')).toBe('dark');
  });

  test('arbitrary hexes are judged by luminance, not by leading digit', () => {
    // The old classifier tested `bg-\[#0`, matching one repository colour and
    // missing every other dark hex.
    expect(backgroundSurface('bg-[#1a1a1a]')).toBe('dark');
    expect(backgroundSurface('bg-[#0a0e1a]')).toBe('dark');
    expect(backgroundSurface('bg-[#ffffff]')).toBe('light');
    expect(backgroundSurface('bg-[#fafafa]')).toBe('light');
  });

  test('a light base is not reported as needing a dark-surface foreground', () => {
    const result = classifyOutlineTag(tag('bg-blue-100 text-blue-900'));
    expect(result.baseSurface).toBe('light');
    expect(result.needsBaseText).toBe(false);
  });

  test('a hover-only dark class does not make the base dark', () => {
    const result = classifyOutlineTag(tag('bg-white hover:bg-slate-800'));
    expect(result.baseSurface).toBe('light');
    expect(result.hoverSurface).toBe('dark');
  });
});

describe('classifier: the default light surface', () => {
  const tag = (cls: string) => `<Button variant="outline" className="${cls}">`;

  test('a button with no local background sits on the variant light surface', () => {
    // The gap the dark-background sweep could not see: there is no local `bg-*`
    // to key on, so the site was never examined at all.
    const result = classifyOutlineTag(tag('text-slate-300'));
    expect(result.baseIsVariantDefault).toBe(true);
    expect(result.baseSurface).toBe('light');
    expect(result.needsBaseText).toBe(true);
    expect(result.reasons).toContain('light foreground on the variant default light background');
  });

  test.each(['text-white', 'text-slate-200', 'text-gray-100', 'text-blue-200', 'text-[#fff]'])(
    '%s is illegible on the default light surface',
    (cls) => expect(classifyOutlineTag(tag(cls)).needsBaseText).toBe(true),
  );

  test('an unstyled outline button is fine — the variant foreground is correct', () => {
    const result = classifyOutlineTag(tag('gap-2'));
    expect(result.baseSurface).toBe('light');
    expect(result.needsBaseText).toBe(false);
  });

  test.each(['text-slate-900', 'text-foreground', 'text-black'])(
    '%s is legible on the default light surface',
    (cls) => expect(classifyOutlineTag(tag(cls)).needsBaseText).toBe(false),
  );
});

describe('classifier: foreground colours vs typography', () => {
  const tag = (cls: string) => `<Button variant="outline" className="${cls}">`;

  test.each(['text-sm', 'text-xs', 'text-lg', 'text-center', 'text-ellipsis', 'text-nowrap'])(
    '%s is typography or layout, not a colour',
    (cls) => {
      expect(textColour(cls)).toBeNull();
      expect(classifyOutlineTag(tag(`bg-slate-900 ${cls}`)).needsBaseText).toBe(true);
    },
  );

  test.each(['text-[10px]', 'text-[11px]', 'text-[1.5rem]', 'text-[0.8em]'])(
    '%s is an arbitrary LENGTH and must not satisfy a colour requirement',
    (cls) => {
      // The subtle hole: `text-[10px]` and `text-[#fff]` share a syntax, and
      // accepting every `text-[...]` let a font size stand in for a colour.
      expect(textColour(cls)).toBeNull();
      expect(classifyOutlineTag(tag(`bg-slate-900 ${cls}`)).needsBaseText).toBe(true);
    },
  );

  test.each(['text-slate-100', 'text-white', 'text-blue-200', 'text-[#fff]', 'text-[#e2e4e8]'])(
    '%s satisfies the dark-surface foreground requirement',
    (cls) => expect(classifyOutlineTag(tag(`bg-slate-900 ${cls}`)).needsBaseText).toBe(false),
  );

  test('a dark foreground on a dark surface is still an offender', () => {
    // Presence of a colour is not sufficiency: `text-slate-900` on
    // `bg-slate-900` is a colour, and unreadable.
    expect(classifyOutlineTag(tag('bg-slate-900 text-slate-900')).needsBaseText).toBe(true);
  });

  test('an unrecognised text utility is reported rather than exempted', () => {
    expect(textColour('text-somethingnew')).toBeNull();
    expect(classifyOutlineTag(tag('bg-slate-900 text-somethingnew')).needsBaseText).toBe(true);
  });
});

describe('classifier: hover surfaces', () => {
  const tag = (cls: string) => `<Button variant="outline" className="${cls}">`;

  test('hover foreground detection is colour-specific', () => {
    expect(classifyOutlineTag(tag('hover:bg-slate-800 hover:text-sm')).needsHoverText).toBe(true);
    expect(classifyOutlineTag(tag('hover:bg-slate-800 hover:text-[10px]')).needsHoverText).toBe(true);
    expect(classifyOutlineTag(tag('hover:bg-slate-800 hover:text-slate-100')).needsHoverText).toBe(false);
  });

  test.each(['hover:bg-black', 'hover:bg-slate-950', 'hover:bg-[#1a1a1a]'])(
    '%s is a dark hover surface',
    (cls) => expect(classifyOutlineTag(tag(cls)).needsHoverText).toBe(true),
  );

  test('a translucent hover over a local dark base is dark', () => {
    const result = classifyOutlineTag(tag('bg-blue-900 hover:bg-blue-500/20 text-white'));
    expect(result.hoverSurface).toBe('dark');
    expect(result.needsHoverText).toBe(false); // light base text carries into hover
  });

  test('a translucent hover over a DARK ANCESTOR is dark with no local base', () => {
    // Previously required a local dark background, so a translucent hover on a
    // button sitting directly on the dark shell was never classified.
    const withAncestor = classifyOutlineTag(tag('hover:bg-white/10'), { darkAncestor: true });
    expect(withAncestor.hoverSurface).toBe('dark');
    expect(withAncestor.needsHoverText).toBe(true);

    const withoutAncestor = classifyOutlineTag(tag('hover:bg-white/10'), { darkAncestor: false });
    expect(withoutAncestor.hoverSurface).not.toBe('dark');
  });

  test('darkAncestorBefore sees a dark shell painted above the button', () => {
    const source = '<div className="bg-[#0a0e1a]">\n  <Button variant="outline" />';
    expect(darkAncestorBefore(source, source.indexOf('<Button'))).toBe(true);
    const light = '<div className="bg-white">\n  <Button variant="outline" />';
    expect(darkAncestorBefore(light, light.indexOf('<Button'))).toBe(false);
  });
});

describe('classifier: correlated ternary branches', () => {
  test('className follows the branch that renders as outline', () => {
    // Real site: `bg-green-600` belongs to the `default` button. Attributing it
    // to the outline branch invents an offender that does not exist.
    const tag = `<Button variant={viewType === 'offensive' ? 'default' : 'outline'} className={viewType === 'offensive' ? 'bg-green-600 hover:bg-green-700' : ''}>`;
    expect(outlineBranchTag(tag)).toContain("className={''}");
    const result = classifyOutlineTag(tag);
    expect(result.baseSurface).toBe('light');
    expect(result.needsBaseText).toBe(false);
    expect(result.needsHoverText).toBe(false);
  });

  test('the outline branch is classified on its own classes', () => {
    // Real site: the outline branch carries `text-gray-400`, which lands on the
    // variant's white background at 2.5:1 — a genuine offender, but for the
    // outline branch's own reason, not the default branch's `bg-primary`.
    const tag = `<Button variant={position === pos ? 'default' : 'outline'} className={position === pos ? 'bg-primary text-white' : 'text-gray-400'}>`;
    expect(outlineBranchTag(tag)).toContain("className={'text-gray-400'}");
    const result = classifyOutlineTag(tag);
    expect(result.baseIsVariantDefault).toBe(true);
    expect(result.needsBaseText).toBe(true);
    expect(result.reasons).toContain('light foreground on the variant default light background');
  });

  test('uncorrelated conditions are left as the union, failing toward reporting', () => {
    const tag = `<Button variant={a ? 'default' : 'outline'} className={b ? 'bg-slate-900' : ''}>`;
    expect(outlineBranchTag(tag)).toBe(tag);
    expect(classifyOutlineTag(tag).needsBaseText).toBe(true);
  });

  test('splitTernary ignores optional chaining and nullish coalescing', () => {
    expect(splitTernary('a?.b ?? c')).toBeNull();
    expect(splitTernary("x === y ? 'a' : 'b'")).toEqual({ cond: 'x === y', whenTrue: "'a'", whenFalse: "'b'" });
  });
});

describe('classifier: conditional outline variants', () => {
  test('a literal variant is detected', () => {
    expect(mentionsOutlineVariant('<Button variant="outline" className="x">')).toBe(true);
  });

  test('a ternary that can render outline is detected', () => {
    // The regression: a substring test for `variant="outline"` skipped every
    // conditional call site, however dark its surface.
    expect(mentionsOutlineVariant(`<Button variant={active ? 'outline' : 'ghost'} className="bg-slate-900">`)).toBe(true);
    expect(mentionsOutlineVariant(`<Button variant={isOn ? "default" : "outline"}>`)).toBe(true);
  });

  test('a variable-valued variant naming outline nowhere is not claimed', () => {
    expect(mentionsOutlineVariant('<Button variant={variant} className="bg-slate-900">')).toBe(false);
    expect(mentionsOutlineVariant('<Button variant="ghost" className="bg-slate-900">')).toBe(false);
  });

  test('a conditional outline on a dark surface is audited end to end', () => {
    const tag = `<Button variant={active ? 'outline' : 'ghost'} className="bg-slate-900 text-sm">`;
    expect(mentionsOutlineVariant(tag)).toBe(true);
    expect(classifyOutlineTag(tag).needsBaseText).toBe(true);
  });
});

describe('classifier: tag extraction', () => {
  test('an arrow callback containing > does not truncate the tag', () => {
    const source = `<Button variant="outline" onClick={(e) => setX(e)} className="bg-slate-900" />`;
    const [first] = [...openingTags(source)];
    expect(first.tag).toContain('className="bg-slate-900"');
  });

  test('<ButtonGroup is not treated as <Button', () => {
    expect([...openingTags('<ButtonGroup className="bg-slate-900">')]).toEqual([]);
  });
});

describe('outline buttons across the client', () => {
  const sites = auditOutlineButtons();

  test('every outline button is legible on its base surface', () => {
    const offenders = sites
      .filter((site) => site.needsBaseText)
      .map((site) => `${site.file}: [${site.reasons.join('; ')}] ${site.tag}`);

    expect(offenders).toEqual([]);
  });

  test('every outline button is legible on its hover surface', () => {
    const offenders = sites
      .filter((site) => site.needsHoverText)
      .map((site) => `${site.file}: [${site.reasons.join('; ')}] ${site.tag}`);

    expect(offenders).toEqual([]);
  });
});
