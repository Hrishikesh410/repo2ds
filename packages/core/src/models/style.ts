import type { SourceLocation } from './source-location.js';

/**
 * Where a style value was written. Framework adapters map their own concepts
 * onto these four sources so the token engine never needs to know about
 * `StyleSheet.create`, CSS modules or class strings.
 */
export type StyleSource = 'inline' | 'stylesheet' | 'tailwind' | 'nativewind';

export interface StyleUsage {
  /** Normalised CSS-ish property name, e.g. `padding`, `backgroundColor`, `border-radius`. */
  property: string;
  /**
   * The statically resolved value. When {@link StyleUsage.dynamic} is true this
   * holds the source text of the expression instead, and the token engine
   * ignores the entry.
   */
  value: string | number;
  source: StyleSource;
  /** True when the value could not be resolved statically (e.g. `padding: getSpacing(size)`). */
  dynamic?: boolean;
  /** Repository-relative path of the file the style was written in. */
  filePath?: string;
  location?: SourceLocation;
  /** Component the style was attached to, when the adapter could attribute it. */
  componentName?: string;
  /**
   * Adapter-specific provenance for reporting, e.g. `styles.container`,
   * `Button.module.css` or the original utility class `px-4`.
   */
  origin?: string;
}
