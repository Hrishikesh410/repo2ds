import { describe, expect, it } from 'vitest';
import type { ComponentInfo, PropInfo } from '../src/index.js';
import {
  componentImportPath,
  deriveArgTypes,
  deriveArgs,
  deriveVariants,
  humanise,
  importStatement,
  storyFilePath,
  storyTitle,
} from '../src/index.js';

function prop(overrides: Partial<PropInfo> & { name: string }): PropInfo {
  return { type: 'string', required: false, ...overrides };
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

describe('deriveArgTypes', () => {
  it('maps known prop types to controls', () => {
    const argTypes = deriveArgTypes([
      prop({ name: 'variant', type: 'enum', enumValues: ['primary', 'secondary'] }),
      prop({ name: 'disabled', type: 'boolean' }),
      prop({ name: 'label', type: 'string' }),
      prop({ name: 'count', type: 'number' }),
    ]);

    expect(argTypes).toEqual([
      { name: 'variant', control: 'select', options: ['primary', 'secondary'] },
      { name: 'disabled', control: 'boolean' },
      { name: 'label', control: 'text' },
      { name: 'count', control: 'number' },
    ]);
  });

  it('leaves props it cannot control alone', () => {
    const argTypes = deriveArgTypes([
      prop({ name: 'children', type: 'unknown' }),
      prop({ name: 'onPress', type: 'function' }),
      prop({ name: 'items', type: 'array' }),
      prop({ name: 'meta', type: 'object' }),
    ]);

    expect(argTypes).toEqual([]);
  });
});

describe('deriveArgs', () => {
  it('prefers a declared default', () => {
    const args = deriveArgs([
      prop({
        name: 'variant',
        type: 'enum',
        enumValues: ['primary', 'secondary'],
        defaultValue: 'secondary',
      }),
    ]);

    expect(args).toEqual([{ name: 'variant', value: { kind: 'literal', value: 'secondary' } }]);
  });

  it('invents safe values for required props', () => {
    const args = deriveArgs([
      prop({ name: 'label', type: 'string', required: true }),
      prop({ name: 'firstName', type: 'string', required: true }),
      prop({ name: 'count', type: 'number', required: true }),
      prop({ name: 'open', type: 'boolean', required: true }),
      prop({ name: 'mode', type: 'enum', enumValues: ['a', 'b'], required: true }),
      prop({ name: 'onPress', type: 'function', required: true }),
    ]);

    expect(args).toEqual([
      { name: 'label', value: { kind: 'literal', value: 'Label' } },
      { name: 'firstName', value: { kind: 'literal', value: 'First Name' } },
      { name: 'count', value: { kind: 'literal', value: 0 } },
      { name: 'open', value: { kind: 'literal', value: false } },
      { name: 'mode', value: { kind: 'literal', value: 'a' } },
      { name: 'onPress', value: { kind: 'expression', code: '() => {}' } },
    ]);
  });

  it('omits required props whose shape it cannot know', () => {
    const args = deriveArgs([
      prop({ name: 'children', type: 'unknown', required: true }),
      prop({ name: 'items', type: 'array', required: true }),
      prop({ name: 'meta', type: 'object', required: true }),
    ]);

    expect(args).toEqual([]);
  });

  it('leaves optional props without defaults out', () => {
    expect(deriveArgs([prop({ name: 'title', type: 'string' })])).toEqual([]);
  });
});

describe('deriveVariants', () => {
  it('creates a story per value of the first enum prop', () => {
    const variants = deriveVariants([
      prop({ name: 'variant', type: 'enum', enumValues: ['primary', 'ghost-inverse'] }),
      prop({ name: 'size', type: 'enum', enumValues: ['sm', 'md'] }),
    ]);

    expect(variants).toEqual([
      {
        name: 'Primary',
        args: [{ name: 'variant', value: { kind: 'literal', value: 'primary' } }],
      },
      {
        name: 'GhostInverse',
        args: [{ name: 'variant', value: { kind: 'literal', value: 'ghost-inverse' } }],
      },
    ]);
  });

  it('creates no variants when there is no enum prop with choices', () => {
    expect(deriveVariants([prop({ name: 'label', type: 'string' })])).toEqual([]);
    expect(deriveVariants([prop({ name: 'only', type: 'enum', enumValues: ['x'] })])).toEqual([]);
  });
});

describe('story file naming', () => {
  it('places the story beside the component', () => {
    expect(storyFilePath(component())).toBe('src/components/Button.stories.tsx');
    expect(storyFilePath(component({ filePath: 'Button.tsx' }))).toBe('Button.stories.tsx');
  });

  it('gives each component in a shared file its own story', () => {
    expect(storyFilePath(component({ name: 'CardHeader', filePath: 'src/Card.tsx' }))).toBe(
      'src/CardHeader.stories.tsx',
    );
  });

  it('imports from the component file, not from the component name', () => {
    expect(componentImportPath(component({ name: 'CardHeader', filePath: 'src/Card.tsx' }))).toBe(
      './Card',
    );
  });

  it('matches the import style to the export style', () => {
    expect(importStatement(component())).toBe("import { Button } from './Button';");
    expect(importStatement(component({ exportType: 'default' }))).toBe(
      "import Button from './Button';",
    );
  });

  it('titles stories under Components', () => {
    expect(storyTitle(component())).toBe('Components/Button');
  });
});

describe('humanise', () => {
  it.each([
    ['label', 'Label'],
    ['firstName', 'First Name'],
    ['aria-label', 'Aria label'],
    ['max_width', 'Max width'],
  ])('turns %s into %s', (input, expected) => {
    expect(humanise(input)).toBe(expected);
  });
});
