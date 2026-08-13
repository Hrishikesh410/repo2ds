import { describe, expect, it } from 'vitest';
import type { ComponentInfo, PropInfo, ScaffoldFolder } from '../src/index.js';
import { planScaffold, renderScaffoldReadme } from '../src/index.js';

function component(overrides: Partial<ComponentInfo> = {}): ComponentInfo {
  return {
    name: 'Button',
    filePath: 'src/components/Button.tsx',
    exportType: 'named',
    props: [],
    propsResolved: true,
    styles: [],
    framework: 'react',
    ...overrides,
  };
}

function prop(overrides: Partial<PropInfo> & { name: string }): PropInfo {
  return { type: 'string', required: false, ...overrides };
}

function plan(components: ComponentInfo[], directory = 'repo2ds/components'): ScaffoldFolder[] {
  return planScaffold(components, { directory }).flatMap((result) =>
    result.status === 'planned' ? [result.folder] : [],
  );
}

function contentsOf(folder: ScaffoldFolder, suffix: string): string | undefined {
  return folder.files.find((file) => file.filePath.endsWith(suffix))?.contents;
}

describe('planScaffold', () => {
  it('re-exports the component from where it already lives', () => {
    const [folder] = plan([component()]);

    expect(folder?.directory).toBe('repo2ds/components/Button');
    expect(contentsOf(folder!, 'Button.tsx')).toBe(
      "export { Button } from '../../../src/components/Button';\n",
    );
  });

  it('renames a default export so the folder exports it by name', () => {
    const [folder] = plan([component({ exportType: 'default' })]);

    expect(contentsOf(folder!, 'Button.tsx')).toBe(
      "export { default as Button } from '../../../src/components/Button';\n",
    );
  });

  it('points the story at the local re-export rather than the original', () => {
    const [folder] = plan([component()]);

    expect(folder?.entry.filePath).toBe('repo2ds/components/Button/Button.tsx');
    expect(folder?.entry.exportType).toBe('named');
    expect(folder?.origin).toBe('src/components/Button.tsx');
  });

  it('re-exports the props type when the source file exports it', () => {
    const [folder] = plan([component({ propsType: { name: 'ButtonProps', exported: true } })]);

    expect(contentsOf(folder!, 'Button.types.ts')).toBe(
      "export type { ButtonProps } from '../../../src/components/Button';\n",
    );
    expect(contentsOf(folder!, 'index.ts')).toContain(
      "export type { ButtonProps } from './Button.types';",
    );
  });

  it('writes no types file for a props type the source keeps to itself', () => {
    const [folder] = plan([component({ propsType: { name: 'ButtonProps', exported: false } })]);

    expect(contentsOf(folder!, '.types.ts')).toBeUndefined();
    expect(contentsOf(folder!, 'index.ts')).toBe("export { Button } from './Button';\n");
  });

  it('skips a component nothing can import', () => {
    const results = planScaffold([component({ exportType: 'unknown' })], {
      directory: 'repo2ds/components',
    });

    expect(results).toEqual([
      {
        status: 'skipped',
        component: 'Button',
        filePath: 'src/components/Button.tsx',
        reason: 'component is not exported, so it cannot be re-exported',
      },
    ]);
  });

  it('leaves a component that already lives in the folder alone', () => {
    const results = planScaffold(
      [component({ filePath: 'repo2ds/components/Button/Button.tsx' })],
      { directory: 'repo2ds/components' },
    );

    expect(results[0]).toMatchObject({
      status: 'skipped',
      reason: 'component already lives in the components directory',
    });
  });

  it('qualifies both folders when two components share a name', () => {
    const folders = plan([
      component({ filePath: 'src/web/Button.tsx' }),
      component({ filePath: 'src/native/Button.tsx' }),
    ]);

    expect(folders.map((folder) => folder.name)).toEqual(['Button-web', 'Button-native']);
    // The file inside keeps the component's own name; only the folder is qualified.
    expect(folders[0]?.files[0]?.filePath).toBe('repo2ds/components/Button-web/Button.tsx');
  });

  it('falls back to a counter when the directory does not tell them apart', () => {
    const folders = plan([
      component({ filePath: 'src/ui/Button.tsx' }),
      component({ filePath: 'lib/ui/Button.tsx' }),
    ]);

    expect(folders.map((folder) => folder.name)).toEqual(['Button-ui', 'Button-ui-2']);
  });

  it('builds an example that passes the props the component expects', () => {
    const [folder] = plan([
      component({
        props: [
          prop({ name: 'label', type: 'string', required: true }),
          prop({ name: 'count', type: 'number', defaultValue: 3 }),
          prop({ name: 'disabled', type: 'boolean', defaultValue: true }),
          prop({ name: 'variant', type: 'enum', enumValues: ['primary'], defaultValue: 'primary' }),
        ],
      }),
    ]);

    expect(contentsOf(folder!, '.example.tsx')).toBe(
      [
        "import { Button } from './Button';",
        '',
        'export function ButtonExample() {',
        '  return (',
        '    <Button label="Label" count={3} disabled variant="primary" />',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('takes a required prop it cannot value as a parameter, so the example compiles', () => {
    const [folder] = plan([
      component({
        props: [
          prop({ name: 'label', type: 'string', required: true }),
          prop({ name: 'items', type: 'array', required: true }),
          prop({ name: 'user', type: 'object', required: true }),
        ],
      }),
    ]);

    expect(contentsOf(folder!, '.example.tsx')).toBe(
      [
        "import type { ComponentProps } from 'react';",
        '',
        "import { Button } from './Button';",
        '',
        '// Repo2DS could not infer a value for these props. Pass them in to render the example.',
        'type ButtonExampleProps = Pick<',
        '  ComponentProps<typeof Button>,',
        "  'items' | 'user'",
        '>;',
        '',
        'export function ButtonExample(props: ButtonExampleProps) {',
        '  return (',
        '    <Button {...props} label="Label" />',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('passes the props straight through when the props type could not be read', () => {
    const [folder] = plan([component({ props: [], propsResolved: false })]);
    const contents = contentsOf(folder!, '.example.tsx');

    expect(contents).toContain(
      'export function ButtonExample(props: ComponentProps<typeof Button>)',
    );
    expect(contents).toContain('<Button {...props} />');
  });

  it('escapes a default value that would otherwise break the example', () => {
    const [folder] = plan([
      component({
        props: [prop({ name: 'label', required: true, defaultValue: 'line1\nline2' })],
      }),
    ]);

    expect(contentsOf(folder!, '.example.tsx')).toContain("label={'line1\\nline2'}");
  });

  it('breaks a long example over several lines', () => {
    const [folder] = plan([
      component({
        props: Array.from({ length: 6 }, (_, index) =>
          prop({ name: `attribute${index}`, required: true }),
        ),
      }),
    ]);

    expect(contentsOf(folder!, '.example.tsx')).toContain('    <Button\n      attribute0=');
  });

  it('names the components it re-exports in the readme', () => {
    const readme = renderScaffoldReadme(plan([component()]));

    expect(readme).toContain('| `Button/` | `src/components/Button.tsx` |');
    expect(readme).toContain('Deleting this directory changes nothing.');
  });
});
