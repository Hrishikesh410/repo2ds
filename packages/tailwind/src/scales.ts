/**
 * Tailwind's **default** theme scales, resolved to pixels.
 *
 * Resolving to pixels is what lets `px-4` and an inline `paddingLeft: 16` be
 * recognised as the same spacing value, which is usually the whole point of
 * running Repo2DS on a Tailwind codebase.
 *
 * A project that customises `theme.spacing` or `theme.fontSize` will see the
 * default numbers here rather than its own. Repo2DS does not read
 * `tailwind.config` in V1, and doing so would mean executing repository code.
 */

/** Tailwind's spacing unit: `4` means 1rem, which is 16px by default. */
const SPACING_UNIT_PX = 4;

const SPACING_KEYWORD_PX: Record<string, number> = {
  px: 1,
};

export const RADIUS_PX: Record<string, number> = {
  none: 0,
  sm: 2,
  DEFAULT: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
};

export const FONT_SIZE_PX: Record<string, number> = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
  '7xl': 72,
  '8xl': 96,
  '9xl': 128,
};

export const FONT_WEIGHT: Record<string, number> = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

export const FONT_FAMILY = new Set(['sans', 'serif', 'mono']);

/** Unitless multipliers, as Tailwind declares them. */
export const LINE_HEIGHT: Record<string, number> = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
};

export const LETTER_SPACING = new Set(['tighter', 'tight', 'normal', 'wide', 'wider', 'widest']);

/** Resolves a spacing token such as `4`, `0.5` or `px` to pixels. */
export function spacingToPixels(token: string): number | undefined {
  const keyword = SPACING_KEYWORD_PX[token];
  if (keyword !== undefined) {
    return keyword;
  }
  if (!/^\d+(\.\d+)?$/.test(token)) {
    return undefined;
  }
  return Number.parseFloat(token) * SPACING_UNIT_PX;
}
