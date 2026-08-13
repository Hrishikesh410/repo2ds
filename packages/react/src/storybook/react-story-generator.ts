import type { ComponentInfo, FrameworkId, StoryGenerator, StoryResult } from '@repo2ds/core';
import { buildStory } from '@repo2ds/core';

export interface ReactStoryGeneratorOptions {
  /** Adds `tags: ['autodocs']` to the meta. Defaults to true. */
  autodocs?: boolean;
  /** Package the CSF types are imported from. Defaults to `@storybook/react`. */
  storybookPackage?: string;
}

/** Where `Meta` and `StoryObj` come from in Storybook 7 and 8. */
const DEFAULT_STORYBOOK_PACKAGE = '@storybook/react';

/**
 * Generates Component Story Format 3 stories for React components.
 *
 * The output is plain CSF3 with `satisfies Meta<typeof Component>`, which is
 * what current Storybook documentation recommends and what type-aware editors
 * can check.
 *
 * Storybook 9 moved the CSF types to the framework package, so a project on it
 * imports from `@storybook/react-vite` or `@storybook/nextjs` instead. Set
 * `storybook.package` to match the project.
 */
export class ReactStoryGenerator implements StoryGenerator {
  readonly framework: FrameworkId = 'react';

  constructor(private readonly options: ReactStoryGeneratorOptions = {}) {}

  generate(component: ComponentInfo): StoryResult {
    const storybookPackage = this.options.storybookPackage ?? DEFAULT_STORYBOOK_PACKAGE;

    return buildStory(component, {
      imports: [`import type { Meta, StoryObj } from '${storybookPackage}';`],
      meta: this.options.autodocs === false ? [] : ["  tags: ['autodocs'],"],
    });
  }
}
