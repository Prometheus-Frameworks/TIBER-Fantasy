/**
 * Fantasy #309 — colour resolution and WCAG contrast for the button audit.
 *
 * Extracted from the audit test so the maths can be pinned against published
 * reference values instead of being trusted. The previous audit classified
 * surfaces by *pattern* — "shades 600-900 are dark" — which is why
 * `bg-black`, `bg-*-950` and near-black arbitrary hexes slipped through and
 * why the light/default surface was never examined at all. Resolving classes
 * to actual colours and computing the real ratio removes that entire class of
 * gap: there is no shade list to get wrong.
 */

import colors from 'tailwindcss/colors';

/**
 * `--background` / `--foreground` from client/src/index.css.
 *
 * These are the colours the `outline` variant itself declares via
 * `bg-background text-foreground`, so they are the surface for any outline
 * button that does not override the background — regardless of what page it
 * sits on. That is precisely how legacy dark-page buttons ended up as light
 * grey text on white. `index.css` is the source of truth and the audit pins
 * these values against it.
 */
export const CSS_BACKGROUND = '#ffffff';
export const CSS_FOREGROUND = '#0a0a0a';
/** What the `default` variant declares via `bg-primary text-primary-foreground`. */
export const CSS_PRIMARY = '#e2640d';
/**
 * Near-black, matching `--foreground`. White on the Ember primary measured
 * 3.46:1 — an AA failure for normal text that was briefly carried as a named
 * waiver. The waiver was rejected: the brand keeps its Ember background and
 * the foreground moves to a measured 5.72:1 instead.
 */
export const CSS_PRIMARY_FOREGROUND = '#0a0a0a';

/** WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for large text and non-text. */
export const AA_TEXT_CONTRAST = 4.5;

const TW_HUES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet',
  'purple', 'fuchsia', 'pink', 'rose',
] as const;

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb | null {
  let value = hex.trim().replace(/^#/, '');
  if (value.length === 3 || value.length === 4) {
    value = value.slice(0, 3).split('').map((c) => c + c).join('');
  }
  if (value.length === 8) value = value.slice(0, 6);
  if (value.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb;
}

/** WCAG relative luminance. */
export function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1:1 to 21:1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite `fg` at `alpha` over the opaque `bg`. */
export function composite(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as Rgb;
}

/**
 * Resolve the colour part of a Tailwind utility value.
 *
 * Returns null for anything that is not a colour — which is the point. The
 * previous allowlist accepted any arbitrary value, so `text-[10px]` counted as
 * a foreground colour and exempted the button from the audit entirely.
 */
export function resolveColourToken(token: string): Rgb | null {
  if (!token) return null;
  if (token === 'white') return [255, 255, 255];
  if (token === 'black') return [0, 0, 0];
  if (token === 'background') return parseHex(CSS_BACKGROUND);
  if (token === 'foreground') return parseHex(CSS_FOREGROUND);
  if (token === 'primary') return parseHex(CSS_PRIMARY);
  if (token === 'primary-foreground') return parseHex(CSS_PRIMARY_FOREGROUND);

  const scale = /^([a-z]+)-(\d{2,3})$/.exec(token);
  if (scale && (TW_HUES as readonly string[]).includes(scale[1])) {
    const hex = (colors as unknown as Record<string, Record<string, string>>)[scale[1]]?.[scale[2]];
    return hex ? parseHex(hex) : null;
  }

  const arbitrary = /^\[(.+)\]$/.exec(token);
  if (arbitrary) {
    const inner = arbitrary[1];
    // Only genuine colour syntax. `[10px]`, `[calc(...)]` and friends are not
    // colours and must not satisfy a foreground requirement.
    if (/^#[0-9a-fA-F]{3,8}$/.test(inner)) return parseHex(inner);
    const rgb = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(inner);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] as Rgb;
    return null;
  }

  return null;
}

/**
 * Resolve a full utility value including any `/NN` opacity modifier,
 * compositing over `under` when translucent.
 *
 * Returns null when the colour cannot be resolved, and null for `under` when a
 * translucent value has no known surface beneath it — the audit reports that
 * as unresolvable rather than assuming a surface.
 */
export function resolveSurface(value: string, under: Rgb | null): Rgb | null {
  const [name, opacity] = value.split('/');
  const solid = resolveColourToken(name);
  if (!solid) return null;
  if (opacity === undefined) return solid;
  const alpha = Number(opacity) / 100;
  if (!Number.isFinite(alpha)) return null;
  if (!under) return null;
  return composite(solid, under, alpha);
}
