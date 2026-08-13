import type { TokenCategory } from '../models/index.js';
import { classifyProperty } from './classify.js';
import { isColorValue, normaliseColor } from './colors.js';

export interface TokenValue {
  category: TokenCategory;
  value: string | number;
  /** True when the category was derived from the property name. */
  semantic: boolean;
}

const PIXELS = /^-?\d+(\.\d+)?px$/i;
const NUMERIC = /^-?\d+(\.\d+)?$/;
const DIMENSION = /^-?\d+(\.\d+)?(rem|em|%|vh|vw|pt|dp|ch)$/i;
const FONT_WEIGHT_KEYWORDS = new Set(['normal', 'bold', 'lighter', 'bolder']);

/** CSS-wide keywords and defaults: they express "no decision here". */
const MEANINGLESS_KEYWORDS = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'auto',
  'none',
]);

/**
 * Turns one style declaration into the design values it contains.
 *
 * A declaration is not always one value. `padding: 16px 24px` holds two spacing
 * values, and `border: 1px solid #E5E7EB` holds a colour worth tracking. Parts
 * that carry no design meaning (`solid`, `auto`, `nowrap`) are dropped rather
 * than recorded as tokens.
 */
export function extractTokenValues(property: string, value: string | number): TokenValue[] {
  const { category, semantic } = classifyProperty(property);

  if (typeof value === 'number') {
    if (category === 'unknown' || isMeaninglessZero(category, value)) {
      return [];
    }
    return [{ category, value, semantic }];
  }

  const parts = splitValueParts(value);

  if (category === 'shadow' && parts.length > 1) {
    return readShadow(parts, semantic);
  }

  const values: TokenValue[] = [];

  for (const part of parts) {
    const tokenValue = readPart(part, category, semantic, parts.length > 1);
    if (tokenValue) {
      values.push(tokenValue);
    }
  }

  return values;
}

/**
 * A shadow is only meaningful as a whole: the offsets and blur radius of
 * `0 1px 2px rgba(0,0,0,0.1)` are not spacing values, and reporting them
 * individually would bury the shadow itself in noise. The colour inside is still
 * reported separately, since it usually belongs to the palette.
 */
function readShadow(parts: string[], semantic: boolean): TokenValue[] {
  const colors = parts
    .filter((part) => isColorValue(part))
    .map((part) => ({ category: 'color' as const, value: normaliseColor(part), semantic: false }));

  return [{ category: 'shadow', value: parts.join(' '), semantic }, ...colors];
}

function readPart(
  part: string,
  category: TokenCategory,
  semantic: boolean,
  isShorthand: boolean,
): TokenValue | undefined {
  if (isColorValue(part)) {
    return { category: 'color', value: normaliseColor(part), semantic: category === 'color' };
  }

  if (category === 'unknown' || isMeaninglessKeyword(part)) {
    return undefined;
  }

  // A colour property holds a colour even when the value is not recognisable as
  // one on its own: Tailwind's `bg-blue-600` and a theme reference such as
  // `colors.brand` are named colours, and grouping those names is how a palette
  // becomes visible in a utility-class codebase.
  if (category === 'color') {
    return { category, value: part, semantic };
  }

  if (PIXELS.test(part) || NUMERIC.test(part)) {
    const numeric = Number.parseFloat(part);
    return isMeaninglessZero(category, numeric)
      ? undefined
      : { category, value: numeric, semantic };
  }

  if (DIMENSION.test(part)) {
    return { category, value: part.toLowerCase(), semantic };
  }

  if (category === 'typography' && FONT_WEIGHT_KEYWORDS.has(part.toLowerCase())) {
    return { category, value: part.toLowerCase(), semantic };
  }

  // Font families are meaningful as written, but only when the declaration is the
  // whole value: a family name inside a shorthand cannot be split reliably.
  if (category === 'typography' && !isShorthand && /[a-z]/i.test(part)) {
    return { category, value: part, semantic };
  }

  return undefined;
}

function isMeaninglessKeyword(part: string): boolean {
  const lower = part.toLowerCase();
  return MEANINGLESS_KEYWORDS.has(lower) || lower.startsWith('url(');
}

/**
 * `margin: 0` and `border-radius: 0` express the absence of a design decision,
 * and resets are so common that zero would otherwise top the spacing chart in
 * most repositories.
 */
function isMeaninglessZero(category: TokenCategory, value: number): boolean {
  return value === 0 && (category === 'spacing' || category === 'radius');
}

/** Splits on whitespace while keeping `rgba(0, 0, 0, 0.1)` in one piece. */
export function splitValueParts(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of value.trim()) {
    if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth = Math.max(0, depth - 1);
    }

    if (depth === 0 && /\s/.test(character)) {
      if (current.length > 0) {
        parts.push(current);
        current = '';
      }
      continue;
    }

    current += character;
  }

  if (current.length > 0) {
    parts.push(current);
  }

  return parts.map((part) => part.replace(/[,;]+$/, '')).filter((part) => part.length > 0);
}
