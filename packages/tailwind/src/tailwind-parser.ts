import {
  FONT_FAMILY,
  FONT_SIZE_PX,
  FONT_WEIGHT,
  LETTER_SPACING,
  LINE_HEIGHT,
  RADIUS_PX,
  spacingToPixels,
} from './scales.js';

export type TailwindCategory = 'spacing' | 'color' | 'radius' | 'typography' | 'layout';

export interface TailwindDeclaration {
  /** The utility exactly as written, including variants, e.g. `md:hover:px-4`. */
  raw: string;
  /** Variant prefixes such as `hover` or `md`, in the order written. */
  variants: string[];
  /** A CSS-like property name, e.g. `padding-left/right`. */
  property: string;
  category: TailwindCategory;
  /** The Tailwind token, e.g. `4`, `blue-600`, `lg`. */
  token: string;
  /** Normalised value: pixels where the default scale defines them. */
  value: string | number;
}

const SPACING_PROPERTIES: Record<string, string> = {
  p: 'padding',
  px: 'padding-left/right',
  py: 'padding-top/bottom',
  pt: 'padding-top',
  pb: 'padding-bottom',
  pl: 'padding-left',
  pr: 'padding-right',
  ps: 'padding-inline-start',
  pe: 'padding-inline-end',
  m: 'margin',
  mx: 'margin-left/right',
  my: 'margin-top/bottom',
  mt: 'margin-top',
  mb: 'margin-bottom',
  ml: 'margin-left',
  mr: 'margin-right',
  ms: 'margin-inline-start',
  me: 'margin-inline-end',
  gap: 'gap',
  'gap-x': 'column-gap',
  'gap-y': 'row-gap',
  'space-x': 'space-x',
  'space-y': 'space-y',
};

const RADIUS_SIDES: Record<string, string> = {
  t: 'border-top-radius',
  b: 'border-bottom-radius',
  l: 'border-left-radius',
  r: 'border-right-radius',
  s: 'border-start-radius',
  e: 'border-end-radius',
  tl: 'border-top-left-radius',
  tr: 'border-top-right-radius',
  bl: 'border-bottom-left-radius',
  br: 'border-bottom-right-radius',
  ss: 'border-start-start-radius',
  se: 'border-start-end-radius',
  es: 'border-end-start-radius',
  ee: 'border-end-end-radius',
};

/** `text-*` tokens that are alignment or wrapping rather than size or colour. */
const TEXT_KEYWORDS = new Set([
  'left',
  'center',
  'right',
  'justify',
  'start',
  'end',
  'wrap',
  'nowrap',
  'balance',
  'pretty',
  'ellipsis',
  'clip',
]);

/** `bg-*` tokens that describe background behaviour rather than colour. */
const BACKGROUND_KEYWORDS = new Set([
  'none',
  'auto',
  'cover',
  'contain',
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'fixed',
  'local',
  'scroll',
  'repeat',
  'no-repeat',
  'repeat-x',
  'repeat-y',
  'repeat-round',
  'repeat-space',
  'origin-border',
  'origin-padding',
  'origin-content',
  'clip-border',
  'clip-padding',
  'clip-content',
  'clip-text',
  'blend-normal',
  'blend-multiply',
]);

const BORDER_STYLE_KEYWORDS = new Set(['solid', 'dashed', 'dotted', 'double', 'hidden', 'none']);

const DISPLAY_UTILITIES = new Set([
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
  'contents',
  'hidden',
  'table',
  'flow-root',
]);

const POSITION_UTILITIES = new Set(['static', 'fixed', 'absolute', 'relative', 'sticky']);

/**
 * Layout utilities are matched against known token sets rather than by prefix
 * alone. A project class such as `my-custom-thing` or `content-wrapper` must not
 * be mistaken for a utility, and a wrong match would put a meaningless value
 * into the report.
 */
const ALIGNMENT_TOKENS = new Set([
  'start',
  'end',
  'center',
  'baseline',
  'stretch',
  'between',
  'around',
  'evenly',
  'normal',
  'first',
  'last',
  'auto',
]);

const FLEX_TOKENS = new Set([
  'row',
  'col',
  'row-reverse',
  'col-reverse',
  'wrap',
  'nowrap',
  'wrap-reverse',
  '1',
  'auto',
  'initial',
  'none',
]);

const OVERFLOW_TOKENS = new Set(['auto', 'hidden', 'visible', 'scroll', 'clip']);

const SIZE_KEYWORDS = new Set([
  'full',
  'screen',
  'auto',
  'min',
  'max',
  'fit',
  'px',
  'svh',
  'dvh',
  'lvh',
]);

const LAYOUT_RULES: { name: string; property: string; accepts: (token: string) => boolean }[] = [
  { name: 'items', property: 'align-items', accepts: (token) => ALIGNMENT_TOKENS.has(token) },
  { name: 'justify', property: 'justify-content', accepts: (token) => ALIGNMENT_TOKENS.has(token) },
  { name: 'self', property: 'align-self', accepts: (token) => ALIGNMENT_TOKENS.has(token) },
  { name: 'content', property: 'align-content', accepts: (token) => ALIGNMENT_TOKENS.has(token) },
  { name: 'flex', property: 'flex', accepts: (token) => FLEX_TOKENS.has(token) },
  { name: 'overflow', property: 'overflow', accepts: (token) => OVERFLOW_TOKENS.has(token) },
  { name: 'w', property: 'width', accepts: isSizeToken },
  { name: 'h', property: 'height', accepts: isSizeToken },
  { name: 'min-w', property: 'min-width', accepts: isSizeToken },
  { name: 'min-h', property: 'min-height', accepts: isSizeToken },
  { name: 'max-w', property: 'max-width', accepts: isSizeToken },
  { name: 'max-h', property: 'max-height', accepts: isSizeToken },
];

function isSizeToken(token: string): boolean {
  return SIZE_KEYWORDS.has(token) || /^\d+(\.\d+)?$/.test(token) || /^\d+\/\d+$/.test(token);
}

/** `auto`, `full` and `reverse` are spacing utilities without a pixel value. */
const SPACING_KEYWORDS = new Set(['auto', 'full', 'screen', 'reverse', 'px']);

function isSpacingToken(token: string): boolean {
  return SPACING_KEYWORDS.has(token) || /^\d+(\.\d+)?$/.test(token);
}

/**
 * Parses a `className` string into normalised declarations.
 *
 * This is the only place in Repo2DS that understands Tailwind syntax. The React
 * Tailwind adapter and the NativeWind adapter are both thin wrappers around it,
 * so the two can never drift apart.
 *
 * Unrecognised classes are ignored rather than guessed at: a project's own
 * `card` or `btn-primary` class carries no information Repo2DS can normalise,
 * and V1 supports a defined subset of Tailwind utilities.
 */
export function parseTailwindClasses(classNames: string): TailwindDeclaration[] {
  const declarations: TailwindDeclaration[] = [];

  for (const raw of classNames.split(/\s+/).filter((token) => token.length > 0)) {
    const declaration = parseTailwindClass(raw);
    if (declaration) {
      declarations.push(declaration);
    }
  }

  return declarations;
}

export function parseTailwindClass(raw: string): TailwindDeclaration | undefined {
  const segments = raw.split(':');
  const utility = segments.pop();
  if (!utility) {
    return undefined;
  }

  const variants = segments;
  const withoutImportant = utility.replace(/^!/, '');
  const negative = withoutImportant.startsWith('-');
  const body = negative ? withoutImportant.slice(1) : withoutImportant;

  const parsed = parseUtility(body);
  if (!parsed) {
    return undefined;
  }

  const value = negative && typeof parsed.value === 'number' ? -parsed.value : parsed.value;

  return { raw, variants, ...parsed, value };
}

type ParsedUtility = Omit<TailwindDeclaration, 'raw' | 'variants'>;

function parseUtility(body: string): ParsedUtility | undefined {
  const { name, token, arbitrary } = splitUtility(body);

  if (name === 'rounded') {
    return parseRadius(token, arbitrary);
  }

  const spacingProperty = SPACING_PROPERTIES[name];
  if (spacingProperty && (arbitrary !== undefined || isSpacingToken(token))) {
    return {
      property: spacingProperty,
      category: 'spacing',
      token,
      value: arbitrary ? parseArbitrary(arbitrary) : (spacingToPixels(token) ?? token),
    };
  }

  switch (name) {
    case 'text':
      return parseText(token, arbitrary);
    case 'font':
      return parseFont(token, arbitrary);
    case 'leading':
      return parseLeading(token, arbitrary);
    case 'tracking':
      return LETTER_SPACING.has(token) || arbitrary
        ? {
            property: 'letter-spacing',
            category: 'typography',
            token,
            value: arbitrary ? parseArbitrary(arbitrary) : token,
          }
        : undefined;
    case 'bg':
      return parseBackground(token, arbitrary);
    case 'border':
      return parseBorder(token, arbitrary);
    default:
      break;
  }

  if (DISPLAY_UTILITIES.has(body)) {
    return { property: 'display', category: 'layout', token: body, value: body };
  }

  if (POSITION_UTILITIES.has(body)) {
    return { property: 'position', category: 'layout', token: body, value: body };
  }

  const layoutRule = LAYOUT_RULES.find((rule) => rule.name === name);
  if (layoutRule && (arbitrary !== undefined || layoutRule.accepts(token))) {
    return {
      property: layoutRule.property,
      category: 'layout',
      token,
      value: arbitrary ? parseArbitrary(arbitrary) : token,
    };
  }

  return undefined;
}

/**
 * Splits `px-4` into `px` and `4`, `bg-blue-600` into `bg` and `blue-600`, and
 * `p-[13px]` into `p` with an arbitrary value.
 */
function splitUtility(body: string): { name: string; token: string; arbitrary?: string } {
  const arbitraryMatch = /^(.+?)-\[(.+)\]$/.exec(body);
  if (arbitraryMatch) {
    const value = (arbitraryMatch[2] ?? '').replace(/_/g, ' ');
    return { name: arbitraryMatch[1] ?? '', token: `[${value}]`, arbitrary: value };
  }

  // Two-part prefixes (`gap-x`, `min-w`) must be recognised before the split.
  for (const prefix of [
    'gap-x',
    'gap-y',
    'space-x',
    'space-y',
    'min-w',
    'min-h',
    'max-w',
    'max-h',
  ]) {
    if (body === prefix) {
      return { name: prefix, token: '' };
    }
    if (body.startsWith(`${prefix}-`)) {
      return { name: prefix, token: body.slice(prefix.length + 1) };
    }
  }

  const separator = body.indexOf('-');
  if (separator === -1) {
    return { name: body, token: '' };
  }

  return { name: body.slice(0, separator), token: stripOpacity(body.slice(separator + 1)) };
}

/**
 * `bg-blue-600/50` sets colour and opacity. The opacity modifier is dropped so
 * the colour still groups with other uses of `blue-600`.
 */
function stripOpacity(token: string): string {
  const separator = token.lastIndexOf('/');
  return separator === -1 ? token : token.slice(0, separator);
}

function parseRadius(token: string, arbitrary?: string): ParsedUtility {
  const [maybeSide, ...rest] = token.split('-');
  const side = maybeSide === undefined ? undefined : RADIUS_SIDES[maybeSide];
  const sizeToken = side ? rest.join('-') : token;
  const property = side ?? 'border-radius';
  const size = sizeToken.length === 0 ? 'DEFAULT' : sizeToken;

  return {
    property,
    category: 'radius',
    token: size,
    value: arbitrary ? parseArbitrary(arbitrary) : (RADIUS_PX[size] ?? size),
  };
}

function parseText(token: string, arbitrary?: string): ParsedUtility | undefined {
  if (arbitrary) {
    const value = parseArbitrary(arbitrary);
    return typeof value === 'number'
      ? { property: 'font-size', category: 'typography', token, value }
      : { property: 'color', category: 'color', token, value };
  }

  const fontSize = FONT_SIZE_PX[token];
  if (fontSize !== undefined) {
    return { property: 'font-size', category: 'typography', token, value: fontSize };
  }

  if (TEXT_KEYWORDS.has(token)) {
    return { property: 'text-align', category: 'layout', token, value: token };
  }

  if (token.length === 0) {
    return undefined;
  }

  return { property: 'color', category: 'color', token, value: token };
}

function parseFont(token: string, arbitrary?: string): ParsedUtility | undefined {
  const weight = FONT_WEIGHT[token];
  if (weight !== undefined) {
    return { property: 'font-weight', category: 'typography', token, value: weight };
  }

  if (FONT_FAMILY.has(token) || arbitrary) {
    return {
      property: 'font-family',
      category: 'typography',
      token,
      value: arbitrary ?? token,
    };
  }

  return undefined;
}

function parseLeading(token: string, arbitrary?: string): ParsedUtility | undefined {
  if (arbitrary) {
    return {
      property: 'line-height',
      category: 'typography',
      token,
      value: parseArbitrary(arbitrary),
    };
  }

  const named = LINE_HEIGHT[token];
  if (named !== undefined) {
    return { property: 'line-height', category: 'typography', token, value: named };
  }

  const pixels = spacingToPixels(token);
  return pixels === undefined
    ? undefined
    : { property: 'line-height', category: 'typography', token, value: pixels };
}

function parseBackground(token: string, arbitrary?: string): ParsedUtility | undefined {
  if (arbitrary) {
    return { property: 'background-color', category: 'color', token, value: arbitrary };
  }
  if (token.length === 0 || BACKGROUND_KEYWORDS.has(token) || token.startsWith('gradient-')) {
    return { property: 'background', category: 'layout', token, value: token };
  }
  return { property: 'background-color', category: 'color', token, value: token };
}

function parseBorder(token: string, arbitrary?: string): ParsedUtility | undefined {
  if (arbitrary) {
    const value = parseArbitrary(arbitrary);
    return typeof value === 'number'
      ? { property: 'border-width', category: 'layout', token, value }
      : { property: 'border-color', category: 'color', token, value };
  }

  if (token.length === 0 || /^\d+$/.test(token)) {
    return { property: 'border-width', category: 'layout', token, value: token || 'DEFAULT' };
  }

  if (BORDER_STYLE_KEYWORDS.has(token)) {
    return { property: 'border-style', category: 'layout', token, value: token };
  }

  // `border-x-4` and `border-t-2` are widths, not colours.
  if (/^[xytblse]-\d+$/.test(token)) {
    return { property: 'border-width', category: 'layout', token, value: token };
  }

  return { property: 'border-color', category: 'color', token, value: token };
}

/** `13px` becomes 13; `#2563EB` and `1.5rem` are kept as written. */
function parseArbitrary(value: string): string | number {
  const pixels = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  if (pixels) {
    return Number.parseFloat(pixels[1] ?? '0');
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number.parseFloat(value);
  }
  return value;
}
