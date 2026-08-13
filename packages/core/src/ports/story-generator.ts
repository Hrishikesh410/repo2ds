import type { StoryResult } from '../generators/index.js';
import type { ComponentInfo, FrameworkId } from '../models/index.js';

/**
 * Writes a Storybook story for one component.
 *
 * There is one generator per framework, because React and React Native
 * Storybook setups have genuinely different conventions. Each one supplies its
 * imports and meta entries to `generators/csf-story`, which renders the parts of
 * a story file that do not differ.
 */
export interface StoryGenerator {
  readonly framework: FrameworkId;

  generate(component: ComponentInfo): StoryResult;
}
