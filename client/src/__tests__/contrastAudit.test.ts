/**
 * Fantasy #309 — automated WCAG 2.2 AA contrast check.
 *
 * Contrast is computed from the **actual token values in `client/src/index.css`**
 * and the **actual variant string in `button.tsx`**, not from constants copied
 * into the test. If someone lowers a token or drops the outline foreground, this
 * fails.
 *
 * Targets: 1.4.3 Contrast (Minimum) 4.5:1 for normal text; 1.4.11 Non-text
 * Contrast 3:1 for meaningful UI component boundaries and states.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const CSS = fs.readFileSync(path.join(ROOT, 'client/src/index.css'), 'utf8');
const BUTTON = fs.readFileSync(path.join(ROOT, 'client/src/components/ui/button.tsx'), 'utf8');

type RGB = [number, number, number];

function hex(value: string): RGB {
  const h = value.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = luminance(a) > luminance(b) ? [luminance(a), luminance(b)] : [luminance(b), luminance(a)];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite a translucent foreground over an opaque background. */
function over(fg: RGB, alpha: number, bg: RGB): RGB {
  return fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]) as RGB;
}

/** Read a `--token: value;` declaration out of index.css. */
function cssToken(name: string): string {
  const match = CSS.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`token --${name} not found in index.css`);
  return match[1].trim();
}

/** Read the alpha of the first `var(--name, rgba(r,g,b,A))` fallback. */
function tokenFallbackAlpha(name: string): number {
  const match = CSS.match(new RegExp(`var\\(--${name},\\s*rgba\\(226,228,232,([0-9.]+)\\)\\)`));
  if (!match) throw new Error(`fallback for --${name} not found in index.css`);
  return Number(match[1]);
}

// Surfaces, read from source rather than hardcoded.
const SHELL = hex(cssToken('tmd-bg').replace(/^var\([^,]+,\s*/, '').replace(/\)$/, '') || '#07080a');
const TABLE_SURFACE: RGB = [10, 14, 26]; // bg-[#0a0e1a], set inline in TiberTiers.tsx
const SHELL_TEXT: RGB = [226, 228, 232];
const BACKGROUND = hex(cssToken('background'));
const FOREGROUND = hex(cssToken('foreground'));

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe('dark-shell text tokens meet AA', () => {
  test('nav / secondary labels (--tmd-text-muted) reach 4.5:1', () => {
    const alpha = tokenFallbackAlpha('tmd-text-muted');
    const ratio = contrast(over(SHELL_TEXT, alpha, SHELL), SHELL);
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test('tiny uppercase section labels / badges (--tmd-text-dim) reach 4.5:1', () => {
    // These convey navigation and status, so they are not decorative and do not
    // get the relaxed treatment.
    const alpha = tokenFallbackAlpha('tmd-text-dim');
    const ratio = contrast(over(SHELL_TEXT, alpha, SHELL), SHELL);
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test('both tokens also pass over the darker table surface', () => {
    for (const name of ['tmd-text-muted', 'tmd-text-dim']) {
      const alpha = tokenFallbackAlpha(name);
      expect(contrast(over(SHELL_TEXT, alpha, TABLE_SURFACE), TABLE_SURFACE)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  test('the visual hierarchy survives the repair — dim stays dimmer than muted', () => {
    const dim = tokenFallbackAlpha('tmd-text-dim');
    const muted = tokenFallbackAlpha('tmd-text-muted');
    expect(dim).toBeLessThan(muted);
    expect(muted).toBeLessThan(1);
  });

  test('regression: the previously-failing alphas are gone', () => {
    expect(CSS).not.toContain('rgba(226,228,232,0.45)'); // was 3.75:1
    expect(CSS).not.toContain('rgba(226,228,232,0.28)'); // was 2.11:1
  });
});

describe('Rankings table headers meet AA', () => {
  const SLATE_500 = hex('#64748b');
  const SLATE_400 = hex('#94a3b8');

  test('slate-400 passes on the table surface', () => {
    expect(contrast(SLATE_400, TABLE_SURFACE)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test('slate-500 does not — documents why the header moved off it', () => {
    expect(contrast(SLATE_500, TABLE_SURFACE)).toBeLessThan(AA_TEXT);
  });

  test('the Rankings table no longer uses slate-500 for headers or the rank column', () => {
    const tiers = fs.readFileSync(path.join(ROOT, 'client/src/pages/TiberTiers.tsx'), 'utf8');
    expect(tiers).not.toContain('text-xs text-slate-500 uppercase');
    expect(tiers).not.toContain('text-center text-slate-500 font-mono');
  });
});

describe('outline button — the 1.27:1 Back to Tiers defect', () => {
  test('the variant declares an explicit foreground', () => {
    const outline = BUTTON.match(/outline:\s*\n?\s*"([^"]+)"/)?.[1] ?? '';
    expect(outline).toContain('text-foreground');
    expect(outline).toContain('bg-background');
  });

  test('that foreground/background pairing clears AA by a wide margin', () => {
    expect(contrast(FOREGROUND, BACKGROUND)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test('the old inherited body colour on white is the failure being fixed', () => {
    // #e2e4e8 (global html/body colour) on #ffffff.
    expect(contrast(SHELL_TEXT, BACKGROUND)).toBeLessThan(2);
  });

  test('the border meets the 3:1 non-text requirement', () => {
    const border = hex(cssToken('btn-outline-border'));
    expect(contrast(border, BACKGROUND)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  test('--input alone would not have met it — documents the separate token', () => {
    expect(contrast(hex(cssToken('input')), BACKGROUND)).toBeLessThan(AA_NON_TEXT);
  });

  test('the variant uses the compliant border token, not --input', () => {
    const outline = BUTTON.match(/outline:\s*\n?\s*"([^"]+)"/)?.[1] ?? '';
    expect(outline).toContain('border-btn-outline');
    expect(outline).not.toContain('border-input');
  });

  test('hover keeps a valid pairing', () => {
    const outline = BUTTON.match(/outline:\s*\n?\s*"([^"]+)"/)?.[1] ?? '';
    expect(outline).toContain('hover:bg-accent');
    expect(outline).toContain('hover:text-accent-foreground');
    expect(contrast(hex(cssToken('accent-foreground')), hex(cssToken('accent')))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test('disabled keeps an explicit foreground rather than inheriting', () => {
    const outline = BUTTON.match(/outline:\s*\n?\s*"([^"]+)"/)?.[1] ?? '';
    expect(outline).toContain('disabled:text-foreground');
    // disabled:opacity-50 composites the foreground toward the background.
    expect(contrast(over(FOREGROUND, 0.5, BACKGROUND), BACKGROUND)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  test('focus-visible is a ring shape, not colour alone, and meets 3:1', () => {
    expect(BUTTON).toContain('focus-visible:ring-2');
    expect(BUTTON).toContain('focus-visible:ring-offset-2');
    expect(contrast(hex(cssToken('ring')), BACKGROUND)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  test('ghost is deliberately unchanged — it declares no background of its own', () => {
    const ghost = BUTTON.match(/ghost:\s*"([^"]+)"/)?.[1] ?? '';
    expect(ghost).not.toContain('bg-background');
    expect(ghost).not.toContain('text-foreground');
  });
});
