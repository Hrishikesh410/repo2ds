import type { ComponentInfo, PropInfo, StoryResult } from '@repo2ds/core';
import type { Diagnostic } from 'ts-morph';
import { DiagnosticCategory, Project, ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { ReactNativeStoryGenerator } from '../src/index.js';

function isSyntaxError(diagnostic: Diagnostic): boolean {
  return diagnostic.getCategory() === DiagnosticCategory.Error && diagnostic.getCode() < 2000;
}

const PROPS: PropInfo[] = [
  { name: 'label', type: 'string', required: true },
  {
    name: 'variant',
    type: 'enum',
    required: false,
    enumValues: ['primary', 'secondary'],
    defaultValue: 'primary',
  },
  { name: 'onPress', type: 'function', required: false },
];

function component(overrides: Partial<ComponentInfo> = {}): ComponentInfo {
  return {
    name: 'Button',
    filePath: 'src/components/Button.tsx',
    exportType: 'named',
    props: PROPS,
    propsResolved: true,
    styles: [],
    framework: 'react-native',
    sourceLocation: { line: 1, column: 1 },
    ...overrides,
  };
}

function contentsOf(result: StoryResult): string {
  if (result.status !== 'generated') {
    throw new Error(`expected a generated story, got: ${result.reason}`);
  }
  return result.file.contents;
}

describe('ReactNativeStoryGenerator', () => {
  it('writes a story wrapped in a View', () => {
    const contents = contentsOf(new ReactNativeStoryGenerator().generate(component()));

    expect(contents).toBe(`import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';

import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
  argTypes: {
    label: { control: 'text' },
    variant: { control: 'select', options: ['primary', 'secondary'] },
  },
  args: {
    label: 'Label',
    variant: 'primary',
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};
`);
  });

  it('does not use autodocs, which React Native Storybook does not support', () => {
    expect(contentsOf(new ReactNativeStoryGenerator().generate(component()))).not.toContain(
      'autodocs',
    );
  });

  it('never imports from @storybook/react-native-web or the DOM', () => {
    const contents = contentsOf(new ReactNativeStoryGenerator().generate(component()));

    expect(contents).not.toContain('react-dom');
    expect(contents).toContain("from 'react-native'");
  });

  it('accepts a different wrapper padding', () => {
    const contents = contentsOf(
      new ReactNativeStoryGenerator({ padding: 24 }).generate(component()),
    );

    expect(contents).toContain('padding: 24');
  });

  it('skips components that are not exported', () => {
    expect(new ReactNativeStoryGenerator().generate(component({ exportType: 'unknown' }))).toEqual({
      status: 'skipped',
      component: 'Button',
      reason: 'component is not exported, so a story cannot import it',
    });
  });

  it('generates syntactically valid TypeScript', () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest, noLib: true },
    });
    const sourceFile = project.createSourceFile(
      '/Button.stories.tsx',
      contentsOf(new ReactNativeStoryGenerator().generate(component())),
    );

    expect(sourceFile.getPreEmitDiagnostics().filter(isSyntaxError)).toEqual([]);
  });
});
