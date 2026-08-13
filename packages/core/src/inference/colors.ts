const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_FUNCTION = /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i;

/** Named colors common enough in product code to be worth recognising. */
const NAMED_COLORS = new Set([
  'transparent',
  'currentcolor',
  'white',
  'black',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'silver',
  'gold',
  'teal',
  'navy',
  'maroon',
  'olive',
  'lime',
  'aqua',
  'cyan',
  'magenta',
  'brown',
  'beige',
  'ivory',
  'khaki',
  'coral',
  'crimson',
  'indigo',
  'salmon',
  'tan',
  'turquoise',
  'violet',
  'wheat',
]);

export function isColorValue(value: string | number): boolean {
  if (typeof value === 'number') {
    return false;
  }
  const trimmed = value.trim();
  return (
    HEX.test(trimmed) || COLOR_FUNCTION.test(trimmed) || NAMED_COLORS.has(trimmed.toLowerCase())
  );
}

/**
 * Normalises a colour so that identical colours group together: hex digits are
 * upper cased, shorthand hex is expanded, and whitespace inside colour
 * functions is removed.
 *
 * Conversion *between* notations is deliberately not attempted. `#FFF` and
 * `rgb(255,255,255)` are the same colour, but reporting one as the other would
 * mean showing users a value that appears nowhere in their code.
 */
export function normaliseColor(value: string): string {
  const trimmed = value.trim();

  if (HEX.test(trimmed)) {
    return expandHex(trimmed).toUpperCase();
  }

  if (COLOR_FUNCTION.test(trimmed)) {
    return trimmed.replace(/\s+/g, '').toLowerCase();
  }

  return trimmed.toLowerCase();
}

function expandHex(hex: string): string {
  const digits = hex.slice(1);
  if (digits.length !== 3 && digits.length !== 4) {
    return hex;
  }
  return `#${[...digits].map((digit) => `${digit}${digit}`).join('')}`;
}
