import type { ClassStyleAdapter, ClassStyleContext, StyleUsage } from '@repo2ds/core';
import type { TailwindDeclaration } from '@repo2ds/tailwind';
import { TailwindStyleAdapter } from '@repo2ds/tailwind';

/**
 * Display values that exist on the web but have no meaning in a React Native
 * layout. NativeWind supports `flex` and `hidden`; the rest of the CSS display
 * model does not apply.
 */
const WEB_ONLY_DISPLAY = new Set([
  'grid',
  'inline-grid',
  'inline',
  'inline-block',
  'inline-flex',
  'table',
  'flow-root',
  'contents',
]);

/**
 * NativeWind support.
 *
 * NativeWind is Tailwind syntax compiled for React Native, so this is a
 * configuration of the Tailwind adapter rather than a second parser: same
 * utilities, same scales, reported as `nativewind`. Tailwind's spacing unit maps
 * to density-independent pixels, so `p-4` is 16 on both platforms and native and
 * web values group together in the token report.
 *
 * Utilities that only mean something on the web are dropped, since recording
 * `display: grid` for a native screen would describe styling that cannot apply.
 */
export class NativeWindStyleAdapter implements ClassStyleAdapter {
  readonly name = 'nativewind' as const;

  private readonly adapter = new TailwindStyleAdapter({
    source: 'nativewind',
    filter: (declaration) => isSupportedOnNative(declaration),
  });

  parseClassNames(classNames: string, context: ClassStyleContext): StyleUsage[] {
    return this.adapter.parseClassNames(classNames, context);
  }
}

export function isSupportedOnNative(declaration: TailwindDeclaration): boolean {
  if (declaration.property === 'display') {
    return !WEB_ONLY_DISPLAY.has(String(declaration.value));
  }
  return true;
}
