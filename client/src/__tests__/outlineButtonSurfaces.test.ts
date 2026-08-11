/**
 * Fantasy #309 — button surface audit, encoded as a test.
 *
 * The `outline` variant declares `bg-background text-foreground`. A call site
 * that overrides one without the other gets a mismatched pair, because
 * `twMerge` lets the call site win per-utility rather than per-pair.
 *
 * The earlier version of this audit only looked for *dark* surfaces, and
 * decided what "dark" meant by pattern-matching shade numbers. That was wrong
 * in both directions:
 *
 *  - it never examined the light/default surface at all, so a legacy
 *    dark-page button carrying `text-gray-300` with no background override sat
 *    on the variant's own white `bg-background` at 1.47:1 and passed;
 *  - the shade list itself leaked — `bg-black`, `bg-*-950` and near-black
 *    arbitrary hexes matched nothing.
 *
 * Resolving classes to real colours and computing the real WCAG ratio removes
 * the whole category: there is no shade list left to get wrong, and both
 * surfaces are audited by the same rule.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  AA_TEXT_CONTRAST,
  CSS_BACKGROUND,
  CSS_FOREGROUND,
  CSS_PRIMARY,
  CSS_PRIMARY_FOREGROUND,
  type ImportantButtonOverride,
  Rgb,
  composite,
  contrastRatio,
  mix,
  parseHex,
  parseImportantButtonOverrides,
  readCssToken,
  resolveCssColour,
  relativeLuminance,
  resolveColourToken,
  resolveSurface,
  worstGradientPoint,
} from './buttonContrast';

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

/**
 * Yield each complete `<Button ...>` opening tag with its line number.
 *
 * A `[^>]*?>` regex cannot do this: an arrow callback such as
 * `onClick={(e) => ...}` contains a `>`, which ends the match early and hides
 * everything after it — including `className`. So track brace depth and
 * quoting, and only accept `>` as the terminator at depth 0 outside a string.
 */
export function* openingTags(source: string): Generator<{ tag: string; line: number }> {
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
    yield { tag: source.slice(index, end + 1), line: source.slice(0, index).split('\n').length };
    index = source.indexOf(OPEN, end);
  }
}

/**
 * Does this tag render the `outline` variant in at least one branch?
 *
 * `variant="outline"` alone missed `variant={active ? 'default' : 'outline'}`,
 * which is how a toggle group is written — so an entire class of buttons was
 * invisible to the audit.
 */
export function isOutlineVariant(tag: string): boolean {
  if (/variant\s*=\s*"outline"/.test(tag)) return true;
  const expression = /variant\s*=\s*\{([^}]*)\}/.exec(tag);
  return expression ? /['"`]outline['"`]/.test(expression[1]) : false;
}

/**
 * The class strings this tag can render.
 *
 * A conditional className produces genuinely different buttons, so each arm is
 * returned separately. Merging them would invent a combination that never
 * renders — and, worse, could let one arm's foreground mask the other arm's
 * missing one.
 */
export function variantBranches(tag: string): Array<'outline' | 'default' | 'other'> {
  if (/variant\s*=\s*"outline"/.test(tag)) return ['outline'];
  const expression = /variant\s*=\s*\{([^}]*)\}/.exec(tag);
  if (!expression) return [];
  return [...expression[1].matchAll(/['"`]([a-z]+)['"`]/g)].map((m) =>
    m[1] === 'outline' ? 'outline' : m[1] === 'default' ? 'default' : 'other',
  );
}

export function classNameBranches(tag: string): string[] {
  const literal = /className\s*=\s*"([^"]*)"/.exec(tag);
  if (literal) return [literal[1]];

  const expression = /className\s*=\s*\{/.exec(tag);
  if (!expression) return [];

  const start = expression.index + expression[0].length;
  let depth = 1;
  let end = start;
  for (let i = start; i < tag.length; i += 1) {
    if (tag[i] === '{') depth += 1;
    else if (tag[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  const body = tag.slice(start, end);
  const template = templateBranches(body.trim());
  if (template) return template;
  const branches = [...body.matchAll(/['"`]([^'"`]*)['"`]/g)].map((m) => m[1]);
  return branches.filter((branch) => /[a-z]-|^[a-z]+$/.test(branch));
}

/**
 * Expand a template-literal className into the class strings it can render.
 *
 * `` `border-amber-500/50 ${open ? 'a' : 'b'}` `` is the common shape for a
 * button with a fixed border and a conditional fill. Scanning it for quoted
 * runs produced one mangled branch — the opening backtick to the first quote —
 * so the static prefix was corrupted and the ternary arms, which carry the
 * actual foreground and hover, were never audited at all.
 *
 * Statics are concatenated onto every branch and each interpolation
 * contributes its arms, so the audit sees what the browser sees.
 */
export function templateBranches(body: string): string[] | null {
  if (!body.startsWith('`') || !body.endsWith('`')) return null;
  const inner = body.slice(1, -1);

  const parts: Array<{ text: string } | { arms: string[] }> = [];
  let buffer = '';
  let i = 0;
  while (i < inner.length) {
    if (inner[i] === '$' && inner[i + 1] === '{') {
      if (buffer) { parts.push({ text: buffer }); buffer = ''; }
      let depth = 1;
      let j = i + 2;
      for (; j < inner.length; j += 1) {
        if (inner[j] === '{') depth += 1;
        else if (inner[j] === '}') { depth -= 1; if (depth === 0) break; }
      }
      const arms = [...inner.slice(i + 2, j).matchAll(/['"`]([^'"`]*)['"`]/g)].map((m) => m[1]);
      parts.push({ arms: arms.length ? arms : [''] });
      i = j + 1;
      continue;
    }
    buffer += inner[i];
    i += 1;
  }
  if (buffer) parts.push({ text: buffer });

  let branches: string[] = [''];
  for (const part of parts) {
    if ('text' in part) {
      branches = branches.map((b) => `${b} ${part.text}`);
    } else {
      // Bounded: a pathological number of interpolations degrades to the
      // statics rather than exploding into a cross product.
      if (branches.length * part.arms.length > 32) continue;
      branches = branches.flatMap((b) => part.arms.map((arm) => `${b} ${arm}`));
    }
  }
  return branches.map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const classesOf = (className: string) => className.split(/\s+/).filter(Boolean);

/**
 * The opaque page surface a translucent button background composites over.
 *
 * Only consulted for translucent overrides. The client is mid-migration: some
 * pages are the v2 white system and others still carry legacy dark navy, so
 * `bg-slate-900/60` is nearly black on one and mid-grey on the other. Guessing
 * either way produces a wrong verdict, so the page root is read from the file.
 */
export function pageSurface(source: string): Rgb | null {
  const root = /min-h-screen[^"'`]*?\bbg-(\[#[0-9a-fA-F]+\]|[a-z]+-\d{2,3}|white|black)/.exec(source)
    ?? /\bbg-(\[#[0-9a-fA-F]+\]|[a-z]+-\d{2,3}|white|black)[^"'`]*?min-h-screen/.exec(source);
  if (!root) return null;
  return resolveColourToken(root[1]);
}

export interface SurfaceCheck {
  state: 'base' | 'hover';
  /** For a gradient, the least-contrasting point along it — not a declared stop. */
  background: Rgb | null;
  foreground: Rgb | null;
  ratio: number | null;
  /** The audit could not resolve one side; reported rather than assumed to pass. */
  unresolved: boolean;
  /** Where the worst point sits along the gradient, 0 at `from` and 1 at `to`. */
  gradientOffset?: number;
}

/**
 * Audit one rendered class string against WCAG AA for text.
 *
 * An outline button with no background override sits on the variant's own
 * `bg-background`, whatever page it is on — that is not an assumption, it is
 * what the variant declares.
 */
export function auditClassName(
  className: string,
  page: Rgb | null,
  variant: 'outline' | 'default' = 'outline',
): SurfaceCheck[] {
  const classes = classesOf(className);

  /**
   * Tokens under `prefix`, split into the ones that name a colour and the ones
   * that do not.
   *
   * `text-` is not a colour prefix: `text-xs`, `text-center` and `text-[10px]`
   * are typography and layout, and a button carrying them has not overridden
   * its foreground at all — the variant's still applies. Taking the *first*
   * `text-` class regardless let `text-xs` stand in for a colour override and
   * mask what actually renders.
   */
  const split = (prefix: string) => {
    const values = classes.filter((c) => c.startsWith(prefix)).map((c) => c.slice(prefix.length));
    const colours = values.filter((v) => resolveColourToken(v.split('/')[0]) !== null);
    return { colour: colours[0], any: values.length > 0 };
  };

  // What the variant itself declares when the call site overrides nothing.
  // Auditing a `default` arm against the `outline` defaults invents a failure
  // that never renders — a toggle group's active arm is `bg-primary
  // text-primary-foreground`, not dark text on white.
  const variantBackground = parseHex(variant === 'default' ? CSS_PRIMARY : CSS_BACKGROUND)!;
  const variantForeground = parseHex(variant === 'default' ? CSS_PRIMARY_FOREGROUND : CSS_FOREGROUND)!;

  /**
   * The first `<prefix><stop>-` class naming a colour, e.g. `from-blue-500`.
   *
   * A gradient stop can also carry a *position* — `from-40%` — which is not a
   * colour and must not be mistaken for one.
   */
  const stopValue = (prefix: string, stop: string): string | undefined => {
    const full = `${prefix}${stop}-`;
    return classes
      .filter((c) => c.startsWith(full))
      .map((c) => c.slice(full.length))
      .find((v) => resolveColourToken(v.split('/')[0]) !== null);
  };

  // A `bg-gradient-*` / `bg-linear-*` directive means the painted surface is
  // the from/via/to stops — not a `bg-<colour>` class and not the variant's
  // own background. Ignoring the directive and measuring the variant fallback
  // is exactly how a blue-to-purple hero button reported the Ember primary's
  // 5.72:1 while actually rendering 3.68:1.
  const isGradient = (prefix: string) =>
    classes.some((c) => new RegExp(`^${prefix}bg-(gradient-to|linear)-`).test(c));

  const baseStops = {
    from: stopValue('', 'from'),
    via: stopValue('', 'via'),
    to: stopValue('', 'to'),
  };
  // `hover:from-*` overrides only the stop it names; the rest keep their base
  // colour, so hover is the base track with the named stops swapped.
  const hoverStops = {
    from: stopValue('hover:', 'from') ?? baseStops.from,
    via: stopValue('hover:', 'via') ?? baseStops.via,
    to: stopValue('hover:', 'to') ?? baseStops.to,
  };

  /**
   * Ordered gradient stops, or null when any stop is unresolvable.
   *
   * An omitted `from`/`to` is `transparent` in CSS, which shows the page
   * through that end of the button — so the page is that stop's colour, and a
   * gradient on a page the audit cannot read is unresolved rather than
   * assumed to pass.
   */
  const gradientTrack = (
    stops: { from?: string; via?: string; to?: string },
    under: Rgb | null,
  ): Rgb[] | null => {
    const resolve = (token?: string) => (token === undefined ? under : resolveSurface(token, under));
    const track = [resolve(stops.from)];
    if (stops.via !== undefined) track.push(resolve(stops.via));
    track.push(resolve(stops.to));
    return track.every((c): c is Rgb => c !== null) ? track : null;
  };

  const solidTrack = (colour: Rgb | null): Rgb[] | null => (colour ? [colour] : null);

  const baseBgToken = split('bg-').colour;
  const baseTrack = isGradient('')
    ? gradientTrack(baseStops, page)
    : solidTrack(baseBgToken ? resolveSurface(baseBgToken, page) : variantBackground);

  const baseFgToken = split('text-').colour;
  const baseFg = baseFgToken ? resolveColourToken(baseFgToken.split('/')[0]) : variantForeground;

  const hoverBgToken = split('hover:bg-').colour;
  const hoverTrack = isGradient('') || isGradient('hover:')
    ? gradientTrack(hoverStops, page)
    // A translucent hover composites over the PAGE, not over the button's own
    // base background. `hover:bg-blue-600/20` sets `background-color` on hover,
    // and a background-color replaces the element's previous one outright —
    // the alpha then composites against the backdrop behind the element, which
    // is the ancestor/page surface. Compositing over the base background
    // instead invents a lighter surface than the browser paints: on a dark
    // navy page it turned a near-black hover into an off-white one, which is
    // how `hover:bg-blue-600/20` with dark blue text passed at a fictional
    // ratio while rendering about 1.85:1.
    : hoverBgToken
      ? solidTrack(resolveSurface(hoverBgToken, page))
      : baseTrack;

  const hoverFgToken = split('hover:text-').colour;
  const hoverFg = hoverFgToken ? resolveColourToken(hoverFgToken.split('/')[0]) : baseFg;

  const check = (state: 'base' | 'hover', track: Rgb[] | null, fg: Rgb | null): SurfaceCheck => {
    // The only genuine unknown: a translucent background — or a gradient stop —
    // with no resolvable surface beneath it. A named colour always resolves,
    // and a class that is not a colour is simply not an override.
    if (!track || !fg) {
      return { state, background: track?.[0] ?? null, foreground: fg, ratio: null, unresolved: true };
    }
    const worst = worstGradientPoint(track, fg);
    return {
      state,
      background: worst.colour,
      foreground: fg,
      ratio: worst.ratio,
      unresolved: false,
      gradientOffset: track.length > 1 ? worst.offset : undefined,
    };
  };

  return [check('base', baseTrack, baseFg), check('hover', hoverTrack, hoverFg)];
}

export interface Offender {
  file: string;
  line: number;
  className: string;
  state: string;
  ratio: number;
}

/**
 * The auditable arms of a Button tag, or null when the tag is out of scope.
 *
 * Scope covers the two variants that declare their own background/foreground
 * pair: `outline` (white/near-black) and `default` (Ember/near-black). A tag
 * with NO variant attribute renders as `default` — which is exactly where the
 * near-black `--primary-foreground` followed custom `bg-purple-600` overrides
 * onto surfaces it fails on, invisible to a sweep keyed on `variant=` text.
 * Other variants (ghost, secondary, destructive, link) remain out of scope.
 */
export function buttonArms(
  tag: string,
): Array<{ className: string; variant: 'outline' | 'default' }> | null {
  const branches = classNameBranches(tag);
  const armsFor = (variant: 'outline' | 'default') =>
    (branches.length ? branches : ['']).map((className) => ({ className, variant }));

  if (!/variant\s*=/.test(tag)) return armsFor('default');
  if (/variant\s*=\s*"default"/.test(tag)) return armsFor('default');

  const variants = variantBranches(tag);
  if (isOutlineVariant(tag)) {
    // A ternary variant and a ternary className are written against the same
    // condition in the same order, so arm i of one is arm i of the other.
    // Pairing them keeps every arm audited — including the `default` arm,
    // which had real failures — without judging it by the wrong variant's
    // defaults.
    return (branches.length ? branches : ['']).map((className, i) => ({
      className,
      variant: variants[i] === 'default' ? 'default' : 'outline',
    }));
  }
  if (variants.includes('default')) {
    // Conditional between `default` and an out-of-scope variant: audit the
    // default arms only, keeping the pairing.
    const arms = (branches.length ? branches : ['']).map((className, i) => ({
      className,
      variant: variants[i] === 'default' ? ('default' as const) : null,
    }));
    const scoped = arms.filter((a): a is { className: string; variant: 'default' } => a.variant !== null);
    return scoped.length ? scoped : null;
  }
  return null;
}

const INDEX_CSS = fs.readFileSync(path.join(CLIENT_SRC, 'index.css'), 'utf8');
const IMPORTANT_OVERRIDES = parseImportantButtonOverrides(INDEX_CSS);

/**
 * The states an `!important` stylesheet rule forces onto a matching button.
 *
 * A button matching one of these selectors renders the override's colours
 * wherever the shell is mounted — the call site's own classes lose. So its
 * class list is not the whole story, and a button that clears AA on its
 * declared surface can still be unreadable on the surface it actually gets.
 *
 * Which pages mount inside the shell is a routing question a static scan
 * cannot answer, so the rule here is the conservative one: a button must be
 * legible on every surface it can render on. That is stricter than the DOM in
 * some cases and never weaker, which is the correct direction for an audit.
 */
export function overriddenChecks(
  className: string,
  overrides: ImportantButtonOverride[] = IMPORTANT_OVERRIDES,
): SurfaceCheck[] {
  const classes = classesOf(className);
  const applicable = overrides.filter((rule) =>
    rule.classMatches.some((match) => classes.some((c) => c.includes(match))),
  );
  if (!applicable.length) return [];

  const base = applicable.find((rule) => !rule.hover);
  const hover = applicable.find((rule) => rule.hover);
  if (!base) return [];

  // A `:hover` rule that sets only the background inherits the base rule's
  // foreground, exactly as the cascade does.
  const states: Array<{ state: 'base' | 'hover'; bg: Rgb | null; fg: Rgb | null }> = [
    { state: 'base', bg: base.background, fg: base.foreground },
  ];
  if (hover) {
    states.push({
      state: 'hover',
      bg: hover.background ?? base.background,
      fg: hover.foreground ?? base.foreground,
    });
  }

  return states.map(({ state, bg, fg }) => ({
    state,
    background: bg,
    foreground: fg,
    ratio: bg && fg ? contrastRatio(bg, fg) : null,
    unresolved: !bg || !fg,
  }));
}

function auditOutlineButtons(): { offenders: Offender[]; audited: number } {
  const offenders: Offender[] = [];
  let audited = 0;

  for (const file of walk(CLIENT_SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    const page = pageSurface(source);

    for (const { tag, line } of openingTags(source)) {
      const arms = buttonArms(tag);
      if (!arms) continue;

      for (const { className, variant } of arms) {
        audited += 1;
        const declared = auditClassName(className, page, variant);
        const overridden = overriddenChecks(className).map((check) => ({
          ...check,
          state: `${check.state}` as 'base' | 'hover',
          overridden: true,
        }));
        for (const result of [...declared, ...overridden] as Array<SurfaceCheck & { overridden?: boolean }>) {
          if (result.ratio === null) {
            // Neither passing nor failing: the audit could not resolve one
            // side. Silently skipping these is how a translucent background
            // over an unknown surface escapes review entirely, so they are
            // reported as their own category rather than dropped.
            if (result.unresolved) {
              offenders.push({
                file: path.relative(CLIENT_SRC, file),
                line, className: className.slice(0, 90),
                state: `${result.state}/unresolved`, ratio: 0,
              });
            }
            continue;
          }
          if (result.ratio >= AA_TEXT_CONTRAST) continue;
          offenders.push({
            file: path.relative(CLIENT_SRC, file),
            line,
            className: className.slice(0, 90),
            // Name where along a gradient the failure sits, and say when the
            // failing surface is the one a stylesheet forced rather than the
            // one the class list declares: "it fails" is not a repairable
            // report when the class list looks compliant.
            state: result.overridden
              ? `${result.state}/!important`
              : result.gradientOffset === undefined
                ? result.state
                : `${result.state}@${result.gradientOffset.toFixed(2)}`,
            ratio: Number(result.ratio.toFixed(2)),
          });
        }
      }
    }
  }

  return { offenders, audited };
}

describe('the contrast maths is correct, not merely plausible', () => {
  // Pinned against published WCAG reference values. An audit whose arithmetic
  // is wrong is worse than no audit: it produces confident wrong verdicts.
  const ratio = (a: string, b: string) => contrastRatio(parseHex(a)!, parseHex(b)!);

  test('matches published reference ratios', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(ratio('#ffffff', '#ffffff')).toBeCloseTo(1, 2);
    // #767676 is the canonical "just passes AA on white" grey.
    expect(ratio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(ratio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  test('is symmetric', () => {
    expect(ratio('#123456', '#abcdef')).toBeCloseTo(ratio('#abcdef', '#123456'), 10);
  });

  test('relative luminance spans 0 to 1', () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 10);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 10);
  });

  test('compositing at full and zero alpha is the identity', () => {
    expect(composite([10, 20, 30], [200, 200, 200], 1)).toEqual([10, 20, 30]);
    expect(composite([10, 20, 30], [200, 200, 200], 0)).toEqual([200, 200, 200]);
  });

  test('the CSS tokens match index.css', () => {
    // If the theme moves, this audit's notion of the variant surface must move
    // with it rather than silently auditing against a stale colour.
    const css = fs.readFileSync(path.join(CLIENT_SRC, 'index.css'), 'utf8');
    expect(css).toMatch(new RegExp(`--background:\\s*${CSS_BACKGROUND}\\s*;`));
    expect(css).toMatch(new RegExp(`--foreground:\\s*${CSS_FOREGROUND}\\s*;`));
  });
});

describe('colour token resolution', () => {
  test('resolves the palette, keywords and CSS tokens', () => {
    expect(resolveColourToken('white')).toEqual([255, 255, 255]);
    expect(resolveColourToken('black')).toEqual([0, 0, 0]);
    expect(resolveColourToken('gray-300')).toEqual(parseHex('#d1d5db'));
    expect(resolveColourToken('background')).toEqual(parseHex(CSS_BACKGROUND));
    expect(resolveColourToken('[#0a0e1a]')).toEqual([10, 14, 26]);
  });

  test.each(['[10px]', '[calc(100%-1rem)]', '[--custom]', 'sm', 'center', 'ellipsis', 'nowrap'])(
    '%s is not a colour',
    (token) => expect(resolveColourToken(token)).toBeNull(),
  );

  test('an arbitrary size is not accepted as a foreground colour', () => {
    // The regression: the old allowlist accepted ANY arbitrary value, so
    // `text-[10px]` satisfied the foreground requirement and exempted the
    // button from the audit entirely. It is typography, so the variant's own
    // foreground still applies — and dark-on-dark is then reported as the
    // failure it actually is, rather than passing.
    const [base] = auditClassName('bg-slate-900 text-[10px]', null);
    expect(base.foreground).toEqual(parseHex(CSS_FOREGROUND));
    expect(base.ratio!).toBeLessThan(AA_TEXT_CONTRAST);
  });

  test('typography classes do not stand in for a foreground override', () => {
    // `text-xs` is not a colour, so it must not mask the variant's foreground
    // — taking the first `text-*` class regardless hid what actually renders.
    const [base] = auditClassName('text-xs h-7', null);
    expect(base.foreground).toEqual(parseHex(CSS_FOREGROUND));
    expect(base.background).toEqual(parseHex(CSS_BACKGROUND));
    expect(base.ratio!).toBeGreaterThan(AA_TEXT_CONTRAST);
  });

  test('shades the old pattern matcher missed now resolve', () => {
    // `bg-black`, `bg-*-950` and near-black arbitrary hexes matched no dark
    // pattern, so those surfaces were never audited. There is no pattern now.
    for (const token of ['black', 'slate-950', 'gray-950', '[#000]', '[#111827]']) {
      expect(resolveColourToken(token)).not.toBeNull();
    }
  });
});

describe('tag scanning', () => {
  test('sees a conditional variant, not just a literal one', () => {
    // The regression: `variant="outline"` alone missed toggle groups written
    // as a ternary, hiding every such button from the audit.
    expect(isOutlineVariant('<Button variant="outline">')).toBe(true);
    expect(isOutlineVariant("<Button variant={active ? 'default' : 'outline'}>")).toBe(true);
    expect(isOutlineVariant("<Button variant={x ? 'outline' : 'ghost'}>")).toBe(true);
    expect(isOutlineVariant('<Button variant="ghost">')).toBe(false);
    expect(isOutlineVariant('<Button>')).toBe(false);
  });

  test('treats each conditional className arm as its own button', () => {
    const branches = classNameBranches(
      "<Button className={on ? 'bg-green-700 text-white' : 'text-gray-700 border-gray-300'}>",
    );
    expect(branches).toEqual(['bg-green-700 text-white', 'text-gray-700 border-gray-300']);
  });

  test('an arrow callback does not truncate the tag', () => {
    const tag = [...openingTags(
      '<Button onClick={(e) => handle(e)} variant="outline" className="text-gray-700">x</Button>',
    )][0].tag;
    expect(tag).toContain('className="text-gray-700"');
  });

  test('<ButtonGroup> is not mistaken for <Button>', () => {
    expect([...openingTags('<ButtonGroup variant="outline">')]).toHaveLength(0);
  });
});

describe('surface resolution', () => {
  test('an outline button with no background override sits on the variant background', () => {
    // Not an assumption about the page: `bg-background` is what the variant
    // declares. This is the mechanism behind the light-grey-on-white failures.
    const [base] = auditClassName('text-gray-300', parseHex('#0a0e1a'));
    expect(base.background).toEqual(parseHex(CSS_BACKGROUND));
    expect(base.ratio!).toBeLessThan(AA_TEXT_CONTRAST);
    expect(base.ratio!).toBeCloseTo(1.47, 2);
  });

  test('a translucent background composites over the page it is actually on', () => {
    // The same class is readable on one page and not on another, so the page
    // is read from the file rather than guessed.
    const onNavy = auditClassName('bg-slate-900/60 text-slate-100', parseHex('#0a0e1a'))[0];
    const onWhite = auditClassName('bg-slate-900/60 text-slate-100', parseHex('#ffffff'))[0];
    expect(onNavy.ratio!).toBeGreaterThan(AA_TEXT_CONTRAST);
    expect(onWhite.ratio!).toBeLessThan(AA_TEXT_CONTRAST);
  });

  test('a translucent hover composites over the page, not over the base background', () => {
    // An earlier revision of this audit had it the other way round, and that
    // was wrong about CSS: `hover:bg-*` sets `background-color`, which REPLACES
    // the element's previous background rather than layering over it, so the
    // alpha composites against the backdrop behind the element. On a dark page
    // the difference is the whole verdict — the same class is a near-black
    // surface, not an off-white one.
    const navy = parseHex('#0a0e1a')!;
    const [, hover] = auditClassName('bg-white text-blue-700 hover:bg-blue-600/20', navy);
    expect(hover.background).toEqual(composite(resolveColourToken('blue-600')!, navy, 0.2));
    expect(hover.background).not.toEqual(composite(resolveColourToken('blue-600')!, [255, 255, 255], 0.2));

    // And the wrong model was not merely imprecise, it flipped the result:
    // dark text on that surface passes under the old model and fails under the
    // correct one.
    expect(hover.ratio!).toBeLessThan(AA_TEXT_CONTRAST);
    const underOldModel = contrastRatio(
      composite(resolveColourToken('blue-600')!, [255, 255, 255], 0.2),
      resolveColourToken('blue-700')!,
    );
    expect(underOldModel).toBeGreaterThan(AA_TEXT_CONTRAST);
  });

  test('a translucent hover on a page the audit cannot read is unresolved', () => {
    // No page root: the backdrop is genuinely unknown, and the audit says so
    // rather than substituting the button's own background for it.
    const [, hover] = auditClassName('bg-white text-blue-700 hover:bg-blue-600/20', null);
    expect(hover.unresolved).toBe(true);
    expect(hover.ratio).toBeNull();
  });

  test('page surface is read from the page root', () => {
    expect(pageSurface('<div className="min-h-screen bg-[#0a0e1a] text-white p-4">'))
      .toEqual([10, 14, 26]);
    expect(pageSurface('<div className="p-4">')).toBeNull();
  });

  test('a gradient background is measured, not replaced by the variant fallback', () => {
    // The regression: `bg-gradient-to-r` is not a colour, so the `bg-` scan
    // found nothing and fell through to the variant's own background. The two
    // hero buttons therefore reported the Ember primary's compliant 5.72:1
    // while painting blue-to-purple, and the suite passed on a surface that
    // never renders.
    const [base, hover] = auditClassName(
      'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700',
      null,
      'default',
    );
    expect(base.background).not.toEqual(parseHex(CSS_PRIMARY));
    expect(Number(base.ratio!.toFixed(2))).toBe(3.67);
    expect(Number(hover.ratio!.toFixed(2))).toBe(2.81);
  });

  test('the worst point on a gradient can be interior, so the track is sampled', () => {
    // Not a refinement — endpoint-only checking is wrong. Relative luminance is
    // convex in the channel bytes, so interpolating between two stops can dip
    // below both. `from-cyan-600 to-rose-500` clears AA at BOTH declared stops
    // and fails across the middle of the button, which a stop-only audit calls
    // compliant.
    const cyan = resolveColourToken('cyan-600')!;
    const rose = resolveColourToken('rose-500')!;
    const black: Rgb = [0, 0, 0];
    expect(contrastRatio(cyan, black)).toBeGreaterThan(AA_TEXT_CONTRAST);
    expect(contrastRatio(rose, black)).toBeGreaterThan(AA_TEXT_CONTRAST);

    const worst = worstGradientPoint([cyan, rose], black);
    expect(Number(worst.ratio.toFixed(2))).toBe(4.22);
    expect(worst.ratio).toBeLessThan(AA_TEXT_CONTRAST);
    expect(worst.offset).toBeCloseTo(0.5, 2);
    expect(worst.colour).toEqual(mix(cyan, rose, 0.5));

    // And the audit reports it through the same path a call site would hit.
    const [check] = auditClassName('bg-gradient-to-r from-cyan-600 to-rose-500 text-black', null);
    expect(check.ratio!).toBeLessThan(AA_TEXT_CONTRAST);
    expect(check.gradientOffset).toBeCloseTo(0.5, 2);
  });

  test('a gradient position stop is not mistaken for a colour', () => {
    // `from-40%` sets where the stop sits, not what colour it is. Reading it as
    // a colour would make the track unresolvable and hide the button.
    const [base] = auditClassName(
      'bg-gradient-to-r from-blue-600 from-40% to-purple-700 text-white',
      null,
    );
    expect(base.unresolved).toBe(false);
    expect(base.background).toEqual(resolveColourToken('blue-600'));
  });

  test('a via stop is part of the track', () => {
    // A three-stop gradient whose middle is the failure: dropping `via-*` from
    // the track measures a button that clears AA end to end and never notices.
    const [base] = auditClassName(
      'bg-gradient-to-r from-blue-700 via-yellow-300 to-purple-800 text-white',
      null,
    );
    expect(base.ratio!).toBeLessThan(AA_TEXT_CONTRAST);
    expect(base.gradientOffset).toBeCloseTo(0.5, 2);
  });

  test('an omitted gradient stop is transparent, so the page shows through', () => {
    // `bg-gradient-to-r from-white` fades to the page, not to the variant
    // background. On a known page that end is the page colour; on an unknown
    // one the audit says it does not know rather than assuming.
    const onNavy = auditClassName('bg-gradient-to-r from-white', parseHex('#0a0e1a'), 'default')[0];
    expect(onNavy.unresolved).toBe(false);
    expect(onNavy.background).toEqual(parseHex('#0a0e1a'));

    const onUnknown = auditClassName('bg-gradient-to-r from-white', null, 'default')[0];
    expect(onUnknown.unresolved).toBe(true);
    expect(onUnknown.ratio).toBeNull();
  });

  test('an unresolvable translucent surface is reported, not assumed', () => {
    // No page root and a translucent override: the audit does not know what is
    // underneath, and says so rather than picking a convenient answer.
    const [base] = auditClassName('bg-amber-500/10 text-amber-300', null);
    expect(base.background).toBeNull();
    expect(base.unresolved).toBe(true);
  });
});

describe('outline buttons meet WCAG AA for text', () => {
  const { offenders, audited } = auditOutlineButtons();

  test('the audit actually examined call sites', () => {
    // Guards against the sweep silently matching nothing and passing vacuously.
    expect(audited).toBeGreaterThanOrEqual(20);
  });

  test('no outline button renders text below 4.5:1 on its own surface — no waivers', () => {
    // An earlier revision carried a four-entry KNOWN_BRAND_DEBT list for the
    // Ember primary at 3.46:1 with white text. The waiver was rejected: a
    // documented failure is still a failure, and it contradicted this PR's own
    // AA objective. The brand keeps its Ember background and the foreground
    // moved to near-black instead, so the list is gone and this assertion is
    // absolute. Do not reintroduce an exception list here.
    const report = offenders
      .map((o) => `${o.file}:${o.line} [${o.state} ${o.ratio}:1] ${o.className}`);
    expect(report).toEqual([]);
  });

  test('the brand primary pairing itself clears AA, pinned to the measured value', () => {
    // #0a0a0a on #e2640d. Pinned exactly so a drift in either token — or a
    // quiet revert of --primary-foreground to white (3.46:1) — fails here
    // rather than resurfacing as four call-site offenders with a tempting
    // waiver-shaped fix.
    const brand = contrastRatio(parseHex(CSS_PRIMARY)!, parseHex(CSS_PRIMARY_FOREGROUND)!);
    expect(brand).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    expect(Number(brand.toFixed(2))).toBe(5.72);
  });

  test('default-variant buttons with background overrides are in the audit scope', () => {
    // The near-black --primary-foreground follows a custom background wherever
    // the call site does not set its own foreground. A sweep keyed on
    // `variant=` text never saw the most common shape — a <Button> with no
    // variant attribute at all — which is how bg-purple-600 controls shipped
    // at 3.68:1. All three forms are in scope:
    expect(buttonArms('<Button className="bg-purple-600" />')).toEqual([
      { className: 'bg-purple-600', variant: 'default' },
    ]);
    expect(buttonArms('<Button variant="default" className="bg-purple-600" />')).toEqual([
      { className: 'bg-purple-600', variant: 'default' },
    ]);
    // A conditional default arm keeps its pairing; out-of-scope arms drop out.
    expect(buttonArms(`<Button variant={on ? 'default' : 'ghost'} className={on ? 'bg-purple-600' : 'x-y'} />`)).toEqual([
      { className: 'bg-purple-600', variant: 'default' },
    ]);
    // Out-of-scope variants stay out.
    expect(buttonArms('<Button variant="ghost" className="bg-purple-600" />')).toBeNull();
  });

  test('the repaired default-override pairings clear AA at rest AND hover, pinned', () => {
    // The exact repairs applied for the custom-background finding, pinned to
    // their measured values so a shade drift reopens the finding loudly.
    const pin = (fg: string, bg: string, expected: number) => {
      const measured = contrastRatio(parseHex(fg)!, parseHex(bg)!);
      expect(Number(measured.toFixed(2))).toBe(expected);
      expect(measured).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    };
    // white on purple-600 (rest) / purple-700 (hover)
    pin('#ffffff', '#9333ea', 5.38); pin('#ffffff', '#7e22ce', 6.98);
    // white on green-700 / green-800
    pin('#ffffff', '#15803d', 5.02); pin('#ffffff', '#166534', 7.13);
    // black on amber-600 / amber-500
    pin('#000000', '#d97706', 6.59); pin('#000000', '#f59e0b', 9.78);
    // white on emerald-700 / emerald-800
    pin('#ffffff', '#047857', 5.48); pin('#ffffff', '#065f46', 7.68);
    // white on cyan-700 / cyan-800
    pin('#ffffff', '#0e7490', 5.36); pin('#ffffff', '#155e75', 7.27);
    // white on blue-600 / blue-700
    pin('#ffffff', '#2563eb', 5.17); pin('#ffffff', '#1d4ed8', 6.70);
    // and the failures they replaced stay failures
    expect(contrastRatio(parseHex('#0a0a0a')!, parseHex('#9333ea')!)).toBeLessThan(AA_TEXT_CONTRAST); // 3.68
    expect(contrastRatio(parseHex('#ffffff')!, parseHex('#16a34a')!)).toBeLessThan(AA_TEXT_CONTRAST); // 3.30
  });

  test('the repaired hero gradient clears AA across the whole track, pinned', () => {
    // No foreground exists that clears the ORIGINAL blue-500 -> purple-700
    // span: the light end needs a foreground darker than black and the dark end
    // needs one lighter than white. So the finding could not be closed by
    // "adding a compliant foreground" alone — the track itself had to darken to
    // a range white clears, and `text-white` had to become explicit because the
    // default variant's near-black foreground fails on it.
    const track = (stops: string[], fg: string) =>
      worstGradientPoint(stops.map((s) => resolveColourToken(s)!), parseHex(fg)!);

    expect(Number(track(['blue-600', 'purple-700'], '#ffffff').ratio.toFixed(2))).toBe(5.17);
    expect(Number(track(['blue-700', 'purple-800'], '#ffffff').ratio.toFixed(2))).toBe(6.70);

    // `text-white` is load-bearing, not decorative: on the same repaired track
    // the variant's own near-black foreground is still a failure, so dropping
    // the class reopens the finding rather than quietly passing.
    expect(track(['blue-600', 'purple-700'], CSS_PRIMARY_FOREGROUND).ratio)
      .toBeLessThan(AA_TEXT_CONTRAST);

    // And the original span admits no compliant foreground at all.
    for (const fg of ['#ffffff', '#000000', CSS_PRIMARY_FOREGROUND, '#767676']) {
      const rest = track(['blue-500', 'purple-600'], fg).ratio;
      const hover = track(['blue-600', 'purple-700'], fg).ratio;
      expect(Math.min(rest, hover)).toBeLessThan(AA_TEXT_CONTRAST);
    }
  });

  test('the shell\'s !important overrides are read out of index.css, not restated', () => {
    // A hardcoded copy of these rules would stop meaning anything the moment
    // the stylesheet moved, which is the failure mode this whole audit exists
    // to remove. The rules are parsed from the real file.
    const shell = IMPORTANT_OVERRIDES.filter((rule) =>
      rule.classMatches.some((m) => ['bg-purple', 'bg-indigo', 'bg-blue'].includes(m)),
    );
    expect(shell.length).toBeGreaterThanOrEqual(2);

    const base = shell.find((rule) => !rule.hover)!;
    const hover = shell.find((rule) => rule.hover)!;
    // `var(--ember)` is followed back into the stylesheet, not guessed.
    expect(base.background).toEqual(parseHex(readCssToken(INDEX_CSS, 'ember')!));
    expect(base.foreground).toEqual(parseHex(CSS_PRIMARY_FOREGROUND));
    expect(hover.background).toEqual(parseHex('#cc5a0c'));
  });

  test('a stylesheet override is audited as the surface that actually renders', () => {
    // The regression: `.tiber-main button[class*="bg-purple"]` repaints every
    // legacy purple/indigo/blue button with the Ember brand surface and beats
    // the call site with `!important`. A class-name audit measured purple and
    // called it compliant; the DOM rendered Ember.
    const forgeLabButton = 'bg-purple-600 hover:bg-purple-700 text-white';
    const checks = overriddenChecks(forgeLabButton);
    expect(checks).toHaveLength(2);
    expect(checks[0].background).toEqual(parseHex(CSS_PRIMARY));
    // The call site's own `text-white` loses to the `!important` colour.
    expect(checks[0].foreground).not.toEqual([255, 255, 255]);
    for (const check of checks) expect(check.ratio!).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    expect(Number(checks[0].ratio!.toFixed(2))).toBe(5.72);
    expect(Number(checks[1].ratio!.toFixed(2))).toBe(4.75);
  });

  test('the override\'s previous white foreground is caught, at the reviewed ratios', () => {
    // Replaying the stylesheet as it was: `color: white !important` on the same
    // two Ember surfaces. Both fail — 3.46:1 at rest and 4.17:1 on hover — and
    // 3.46:1 is the exact pairing this PR deleted the waiver for, reintroduced
    // through a rule no class-name scan could see.
    const previous: ImportantButtonOverride[] = parseImportantButtonOverrides(`
      .tiber-main button[class*="bg-purple"],
      .tiber-main button[class*="bg-blue"] {
        background: var(--ember) !important;
        color: white !important;
      }
      .tiber-main button[class*="bg-purple"]:hover,
      .tiber-main button[class*="bg-blue"]:hover {
        background: #cc5a0c !important;
      }
      :root { --ember: ${CSS_PRIMARY}; }
    `);

    const checks = overriddenChecks('bg-purple-600 hover:bg-purple-700 text-white', previous);
    expect(checks.map((c) => Number(c.ratio!.toFixed(2)))).toEqual([3.46, 4.17]);
    for (const check of checks) expect(check.ratio!).toBeLessThan(AA_TEXT_CONTRAST);
    // The hover rule sets no colour, so it inherits the base rule's — the same
    // thing the cascade does.
    expect(checks[1].foreground).toEqual([255, 255, 255]);
  });

  test('a button the override does not match is unaffected', () => {
    // The repaired hero gradient carries neither `bg-purple` nor `bg-blue` as a
    // background class, so the shell rule does not apply to it — asserting
    // otherwise would invent failures.
    expect(overriddenChecks('bg-gradient-to-r from-blue-600 to-purple-700 text-white')).toEqual([]);
    expect(overriddenChecks('bg-green-700 text-white')).toEqual([]);
  });

  test('the previously waived pairing would still be caught', () => {
    // The exact colours the waiver covered. If the audit ever stops seeing
    // white-on-ember as a failure, the no-waiver assertion above is passing
    // vacuously and this trips instead.
    const whiteOnEmber = contrastRatio(parseHex(CSS_PRIMARY)!, [255, 255, 255]);
    expect(Number(whiteOnEmber.toFixed(2))).toBe(3.46);
    expect(whiteOnEmber).toBeLessThan(AA_TEXT_CONTRAST);
  });
});
