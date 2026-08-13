import type { ComponentInfo, FrameworkId, StoryGenerator, StoryResult } from '@repo2ds/core';
import { buildStory } from '@repo2ds/core';

export interface ReactNativeStoryGeneratorOptions {
  /** Padding for the wrapping `View`, in device-independent pixels. */
  padding?: number;
  /** Package the CSF types are imported from. Defaults to `@storybook/react`. */
  storybookPackage?: string;
}

const DEFAULT_PADDING = 16;

/** React Native Storybook takes its CSF types from the React renderer. */
const DEFAULT_STORYBOOK_PACKAGE = '@storybook/react';

/**
 * Generates Storybook stories for React Native components.
 *
 * React Native Storybook renders on a device, so a story needs a `View` wrapper
 * to be visible and cannot use `autodocs`, which is web only. Everything else
 * about the file is the same as on the web, and comes from `buildStory`.
 */
export class ReactNativeStoryGenerator implements StoryGenerator {
  readonly framework: FrameworkId = 'react-native';

  constructor(private readonly options: ReactNativeStoryGeneratorOptions = {}) {}

  generate(component: ComponentInfo): StoryResult {
    const padding = this.options.padding ?? DEFAULT_PADDING;
    const storybookPackage = this.options.storybookPackage ?? DEFAULT_STORYBOOK_PACKAGE;

    return buildStory(component, {
      imports: [
        `import type { Meta, StoryObj } from '${storybookPackage}';`,
        "import { View } from 'react-native';",
      ],
      meta: [
        '  decorators: [',
        '    (Story) => (',
        `      <View style={{ padding: ${padding} }}>`,
        '        <Story />',
        '      </View>',
        '    ),',
        '  ],',
      ],
    });
  }
}
