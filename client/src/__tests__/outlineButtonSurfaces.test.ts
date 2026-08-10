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
  Rgb,
  composite,
  contrastRatio,
  parseHex,
  relativeLuminance,
  resolveColourToken,
  resolveSurface,
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
  background: Rgb | null;
  foreground: Rgb | null;
  ratio: number | null;
  /** The audit could not resolve one side; reported rather than assumed to pass. */
  unresolved: boolean;
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

  const baseBgToken = split('bg-').colour;
  const baseBg = baseBgToken ? resolveSurface(baseBgToken, page) : variantBackground;
  const baseFgToken = split('text-').colour;
  const baseFg = baseFgToken ? resolveColourToken(baseFgToken.split('/')[0]) : variantForeground;

  const hoverBgToken = split('hover:bg-').colour;
  // A translucent hover composites over the button's own base surface.
  const hoverBg = hoverBgToken ? resolveSurface(hoverBgToken, baseBg ?? page) : baseBg;
  const hoverFgToken = split('hover:text-').colour;
  const hoverFg = hoverFgToken ? resolveColourToken(hoverFgToken.split('/')[0]) : baseFg;

  const check = (state: 'base' | 'hover', bg: Rgb | null, fg: Rgb | null): SurfaceCheck => ({
    state,
    background: bg,
    foreground: fg,
    ratio: bg && fg ? contrastRatio(bg, fg) : null,
    // The only genuine unknown: a translucent background with no resolvable
    // surface beneath it. A named colour always resolves, and a class that is
    // not a colour is simply not an override.
    unresolved: !bg || !fg,
  });

  return [check('base', baseBg, baseFg), check('hover', hoverBg, hoverFg)];
}

export interface Offender {
  file: string;
  line: number;
  className: string;
  state: string;
  ratio: number;
}

function auditOutlineButtons(): { offenders: Offender[]; audited: number } {
  const offenders: Offender[] = [];
  let audited = 0;

  for (const file of walk(CLIENT_SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    const page = pageSurface(source);

    for (const { tag, line } of openingTags(source)) {
      if (!isOutlineVariant(tag)) continue;

      // A ternary variant and a ternary className are written against the same
      // condition in the same order, so arm i of one is arm i of the other.
      // Pairing them keeps every arm audited — including the `default` arm,
      // which had real failures — without judging it by the wrong variant's
      // defaults.
      const variants = variantBranches(tag);
      const branches = classNameBranches(tag);
      const arms: Array<{ className: string; variant: 'outline' | 'default' }> =
        (branches.length ? branches : ['']).map((className, i) => ({
          className,
          variant: variants[i] === 'default' ? 'default' : 'outline',
        }));

      for (const { className, variant } of arms) {
        audited += 1;
        for (const result of auditClassName(className, page, variant)) {
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
            state: result.state,
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

  test('a translucent hover composites over the button, not the page', () => {
    const [, hover] = auditClassName('bg-white text-blue-700 hover:bg-blue-600/20', null);
    expect(hover.background).toEqual(composite(resolveColourToken('blue-600')!, [255, 255, 255], 0.2));
  });

  test('page surface is read from the page root', () => {
    expect(pageSurface('<div className="min-h-screen bg-[#0a0e1a] text-white p-4">'))
      .toEqual([10, 14, 26]);
    expect(pageSurface('<div className="p-4">')).toBeNull();
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

  test('the previously waived pairing would still be caught', () => {
    // The exact colours the waiver covered. If the audit ever stops seeing
    // white-on-ember as a failure, the no-waiver assertion above is passing
    // vacuously and this trips instead.
    const whiteOnEmber = contrastRatio(parseHex(CSS_PRIMARY)!, [255, 255, 255]);
    expect(Number(whiteOnEmber.toFixed(2))).toBe(3.46);
    expect(whiteOnEmber).toBeLessThan(AA_TEXT_CONTRAST);
  });
});
