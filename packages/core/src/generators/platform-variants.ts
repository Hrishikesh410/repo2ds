import type { ComponentInfo } from '../models/index.js';
import { platformOf, withoutPlatformSuffix } from '../utils/index.js';

/**
 * Finds components that are the same component written for another platform.
 *
 * `Button.tsx`, `Button.ios.tsx` and `Button.android.tsx` are one component to
 * everyone who imports it, and one story is what a Storybook needs. The variants
 * are still scanned, so their styles count towards token inference; they are
 * only left out of generation.
 *
 * Returns a reason per component that should be left out, keyed by the
 * component itself.
 */
export function findPlatformVariants(
  components: readonly ComponentInfo[],
): Map<ComponentInfo, string> {
  const groups = new Map<string, ComponentInfo[]>();

  for (const component of components) {
    const key = `${withoutPlatformSuffix(component.filePath)}::${component.name}`;
    const group = groups.get(key);
    if (group) {
      group.push(component);
    } else {
      groups.set(key, [component]);
    }
  }

  const variants = new Map<ComponentInfo, string>();

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const primary = choosePrimary(group);
    for (const component of group) {
      if (component !== primary) {
        variants.set(
          component,
          `written for ${platformOf(component.filePath) ?? 'a platform'}; ${primary.filePath} is used instead`,
        );
      }
    }
  }

  return variants;
}

/**
 * The platform-neutral file if there is one. Where every file is platform
 * specific the first by path is used, which keeps the choice stable between
 * runs; either way the generated import omits the suffix, so the bundler still
 * picks the right file per platform.
 */
function choosePrimary(group: readonly ComponentInfo[]): ComponentInfo {
  const sorted = [...group].sort((left, right) => left.filePath.localeCompare(right.filePath));
  return sorted.find((component) => platformOf(component.filePath) === undefined) ?? sorted[0]!;
}
