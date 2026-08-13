import type { SourceLocation, StyleUsage, StylingSystemId } from '../models/index.js';

export interface ClassStyleContext {
  /** Repository-relative path of the file the class string was written in. */
  filePath: string;
  componentName?: string;
  location?: SourceLocation;
}

/**
 * Converts utility class strings (`className="px-4 bg-blue-600"`) into style
 * usages.
 *
 * Framework adapters find class attributes; a class style adapter interprets
 * them. That split is why Tailwind and NativeWind share one parser: NativeWind
 * is a different adapter over the same parsing logic, not a second parser.
 */
export interface ClassStyleAdapter {
  readonly name: StylingSystemId;

  parseClassNames(classNames: string, context: ClassStyleContext): StyleUsage[];
}
