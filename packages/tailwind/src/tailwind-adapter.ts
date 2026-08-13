import type { ClassStyleAdapter, ClassStyleContext, StyleSource, StyleUsage } from '@repo2ds/core';
import type { TailwindDeclaration } from './tailwind-parser.js';
import { parseTailwindClasses } from './tailwind-parser.js';

export interface TailwindStyleAdapterOptions {
  /**
   * Which style source to record. NativeWind uses the same parser but reports
   * `nativewind`, so a report can distinguish web classes from native ones.
   */
  source?: StyleSource;
  /** Restricts which utilities are reported. Used by the NativeWind adapter. */
  filter?: (declaration: TailwindDeclaration) => boolean;
}

/**
 * Reports Tailwind utility classes as style usages.
 *
 * Layout utilities (`flex`, `items-center`) are recorded so component styling
 * is visible, but their properties classify as neither spacing nor colour, so
 * they never become token candidates.
 */
export class TailwindStyleAdapter implements ClassStyleAdapter {
  readonly name: 'tailwind' | 'nativewind';

  private readonly source: StyleSource;
  private readonly filter: ((declaration: TailwindDeclaration) => boolean) | undefined;

  constructor(options: TailwindStyleAdapterOptions = {}) {
    this.source = options.source ?? 'tailwind';
    this.name = this.source === 'nativewind' ? 'nativewind' : 'tailwind';
    this.filter = options.filter;
  }

  parseClassNames(classNames: string, context: ClassStyleContext): StyleUsage[] {
    const declarations = parseTailwindClasses(classNames);

    return declarations
      .filter((declaration) => this.filter?.(declaration) ?? true)
      .map((declaration) => ({
        property: declaration.property,
        value: declaration.value,
        source: this.source,
        filePath: context.filePath,
        origin: declaration.raw,
        ...(context.location ? { location: context.location } : {}),
        ...(context.componentName ? { componentName: context.componentName } : {}),
      }));
  }
}
