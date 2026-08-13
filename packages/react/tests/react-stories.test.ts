import type { ComponentInfo, PropInfo, StoryResult } from '@repo2ds/core';
import type { Diagnostic } from 'ts-morph';
import { DiagnosticCategory, Project, ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { ReactStoryGenerator } from '../src/index.js';

/** Syntax errors only: type errors need Storybook's types, which tests do not install. */
function isSyntaxError(diagnostic: Diagnostic): boolean {
  return diagnostic.getCategory() === DiagnosticCategory.Error && diagnostic.getCode() < 2000;
}

function component(overrides: Partial<ComponentInfo> = {}): ComponentInfo {
  return {
    name: 'Button',
    filePath: 'src/components/Button.tsx',
    exportType: 'named',
    props: [],
    propsResolved: true,
    styles: [],
    framework: 'react',
    sourceLocation: { line: 1, column: 1 },
    ...overrides,
  };
}

const BUTTON_PROPS: PropInfo[] = [
  { name: 'label', type: 'string', required: true },
  {
    name: 'variant',
    type: 'enum',
    required: false,
    enumValues: ['primary', 'secondary'],
    defaultValue: 'primary',
  },
  { name: 'disabled', type: 'boolean', required: false },
  { name: 'onPress', type: 'function', required: false },
  { name: 'children', type: 'unknown', required: false },
];

function generate(overrides: Partial<ComponentInfo> = {}): StoryResult {
  return new ReactStoryGenerator().generate(component(overrides));
}

/** Parses the generated file and reports anything that stops it being read. */
function parseErrors(contents: string): string[] {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest, noLib: true },
  });
  const sourceFile = project.createSourceFile('/Button.stories.tsx', contents);

  return sourceFile
    .getPreEmitDiagnostics()
    .filter(isSyntaxError)
    .map((diagnostic) => {
      const message = diagnostic.getMessageText();
      return typeof message === 'string' ? message : message.getMessageText();
    });
}

function contentsOf(result: StoryResult): string {
  if (result.status !== 'generated') {
    throw new Error(`expected a generated story, got: ${result.reason}`);
  }
  return result.file.contents;
}

describe('ReactStoryGenerator', () => {
  it('writes a CSF3 story with controls, args and variants', () => {
    const result = generate({ props: BUTTON_PROPS });

    expect(result.status).toBe('generated');
    expect(contentsOf(result)).toBe(`import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    variant: { control: 'select', options: ['primary', 'secondary'] },
    disabled: { control: 'boolean' },
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

  it('writes the story beside the component', () => {
    const result = generate({ props: BUTTON_PROPS });

    expect(result.status === 'generated' && result.file.filePath).toBe(
      'src/components/Button.stories.tsx',
    );
  });

  it('uses a default import for a default exported component', () => {
    expect(contentsOf(generate({ exportType: 'default' }))).toContain(
      "import Button from './Button';",
    );
  });

  it('writes a minimal story for a component without props', () => {
    expect(contentsOf(generate())).toBe(`import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
`);
  });

  it('can leave autodocs out', () => {
    const result = new ReactStoryGenerator({ autodocs: false }).generate(component());

    expect(contentsOf(result)).not.toContain('autodocs');
  });

  it('imports the CSF types from the package the project uses', () => {
    const result = new ReactStoryGenerator({
      storybookPackage: '@storybook/react-vite',
    }).generate(component());

    expect(contentsOf(result)).toContain(
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
    );
  });

  it('imports a platform specific component without its suffix', () => {
    const result = generate({ filePath: 'src/Button.ios.tsx' });

    expect(contentsOf(result)).toContain("import { Button } from './Button';");
  });

  it('skips a component that is not exported, and says why', () => {
    expect(generate({ exportType: 'unknown' })).toEqual({
      status: 'skipped',
      component: 'Button',
      reason: 'component is not exported, so a story cannot import it',
    });
  });

  it('never invents args for props it cannot type', () => {
    const contents = contentsOf(generate({ props: BUTTON_PROPS }));

    expect(contents).not.toContain('children');
    expect(contents).not.toContain('onPress');
  });

  it('emits a no-op function for a required callback', () => {
    const contents = contentsOf(
      generate({ props: [{ name: 'onPress', type: 'function', required: true }] }),
    );

    expect(contents).toContain('onPress: () => {},');
  });

  it('quotes prop names that are not identifiers', () => {
    const contents = contentsOf(
      generate({ props: [{ name: 'aria-label', type: 'string', required: true }] }),
    );

    expect(contents).toContain("'aria-label': { control: 'text' },");
    expect(contents).toContain("'aria-label': 'Aria label',");
  });

  it('escapes quotes inside generated string values', () => {
    const contents = contentsOf(
      generate({
        props: [{ name: 'label', type: 'string', required: true, defaultValue: "It's fine" }],
      }),
    );

    expect(contents).toContain("label: 'It\\'s fine',");
  });

  it.each([
    ['a newline', 'line1\nline2', "label: 'line1\\nline2',"],
    ['a carriage return', 'a\rb', "label: 'a\\rb',"],
    ['a tab', 'a\tb', "label: 'a\\tb',"],
    ['a backslash', 'C:\\dir', "label: 'C:\\\\dir',"],
    ['a line separator', 'a\u2028b', "label: 'a\\u2028b',"],
    ['a null byte', 'a\u0000b', "label: 'a\\u0000b',"],
  ])('escapes %s in a default value', (_name, defaultValue, expected) => {
    const contents = contentsOf(
      generate({ props: [{ name: 'label', type: 'string', required: true, defaultValue }] }),
    );

    expect(contents).toContain(expected);
    expect(parseErrors(contents)).toEqual([]);
  });

  it.each(['Meta', 'StoryObj', 'Story', 'Default', 'Primary'])(
    'imports a component called %s under a name the story file has not taken',
    (name) => {
      const contents = contentsOf(generate({ name, props: BUTTON_PROPS }));

      expect(contents).toContain(`import { ${name} as ${name}Component } from './Button';`);
      expect(contents).toContain(`component: ${name}Component,`);
      expect(contents).toContain(`satisfies Meta<typeof ${name}Component>`);
    },
  );

  it('leaves a component name alone when nothing else uses it', () => {
    expect(contentsOf(generate())).toContain("import { Button } from './Button';");
  });

  it('loosens the typing when a required prop has no value, so the story still compiles', () => {
    const contents = contentsOf(
      generate({ props: [{ name: 'items', type: 'array', required: true }] }),
    );

    expect(contents).toContain('// Repo2DS could not infer a value for: items.');
    expect(contents).toContain('const meta: Meta<typeof Button> = {');
    expect(contents).toContain('type Story = StoryObj<typeof Button>;');
    expect(contents).not.toContain('satisfies');
  });

  it('loosens the typing when the props type could not be read at all', () => {
    const contents = contentsOf(generate({ props: [], propsResolved: false }));

    expect(contents).toContain('// Repo2DS could not read this props type');
    expect(contents).toContain('const meta: Meta<typeof Button> = {');
  });

  it('keeps the checked typing when every required prop has a value', () => {
    const contents = contentsOf(generate({ props: BUTTON_PROPS }));

    expect(contents).toContain('satisfies Meta<typeof Button>');
    expect(contents).toContain('type Story = StoryObj<typeof meta>;');
  });

  it('generates syntactically valid TypeScript', () => {
    const contents = contentsOf(
      generate({
        props: [
          ...BUTTON_PROPS,
          { name: 'aria-label', type: 'string', required: true },
          { name: 'count', type: 'number', required: true },
        ],
      }),
    );

    expect(parseErrors(contents)).toEqual([]);
  });

  it('is deterministic', () => {
    expect(contentsOf(generate({ props: BUTTON_PROPS }))).toBe(
      contentsOf(generate({ props: BUTTON_PROPS })),
    );
  });
});
