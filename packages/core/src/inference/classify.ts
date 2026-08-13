import type { TokenCategory } from '../models/index.js';

export interface Classification {
  category: TokenCategory;
  /**
   * True when the category came from the property name rather than from the
   * shape of the value. Named evidence is stronger evidence, and confidence
   * scoring uses it.
   */
  semantic: boolean;
}

/**
 * Property name patterns per category. Order matters, and resolves the names
 * that legitimately belong to two categories:
 *
 * - `shadowColor` is a colour, so colour is checked before shadow;
 * - `textShadow` is a shadow, so shadow is checked before typography;
 * - `letterSpacing` is typography, so typography is checked before spacing.
 */
const PROPERTY_RULES: { category: TokenCategory; pattern: RegExp }[] = [
  { category: 'color', pattern: /color$|^color|^background|^bg|^fill$|^stroke$|^tint/ },
  { category: 'shadow', pattern: /shadow|^elevation$/ },
  { category: 'radius', pattern: /radius|^rounded/ },
  {
    category: 'typography',
    pattern: /^font|^text|leading|lineheight|letterspacing|tracking|^typography$/,
  },
  { category: 'spacing', pattern: /^padding|^margin|gap|space|gutter|^inset/ },
];

/**
 * Decides which kind of design value a declaration holds.
 *
 * The property name is the primary signal, which is what makes the result
 * identical for `backgroundColor: '#FFF'` in a React Native style sheet, a
 * `--brand-bg` custom property and `background-color` in CSS.
 */
export function classifyProperty(property: string): Classification {
  const normalised = normaliseProperty(property);

  for (const rule of PROPERTY_RULES) {
    if (rule.pattern.test(normalised)) {
      return { category: rule.category, semantic: true };
    }
  }

  return { category: 'unknown', semantic: false };
}

/**
 * Strips separators and casing so `background-color`, `backgroundColor` and
 * `--background-color` are treated the same.
 */
export function normaliseProperty(property: string): string {
  return property
    .replace(/^--/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}
