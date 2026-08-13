import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGenerate } from '../src/commands/generate.js';
import { MemoryWriter } from '../src/output/writer.js';
import { createTempRepo, removeTempRepos } from './helpers/temp-repo.js';

afterEach(removeTempRepos);

function environment(cwd: string = process.cwd()) {
  const writer = new MemoryWriter();
  return { writer, env: { writer, cwd, colors: false } };
}

const BUTTON = `export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, variant = 'primary' }: ButtonProps) {
  return <button className="btn" style={{ padding: 16 }}>{label}</button>;
}
`;

async function reactRepo(extra: Record<string, string> = {}): Promise<string> {
  return createTempRepo({
    'package.json': JSON.stringify({
      name: 'generate-app',
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
    }),
    'src/components/Button.tsx': BUTTON,
    ...extra,
  });
}

async function read(rootDir: string, relativePath: string): Promise<string> {
  return fs.readFile(path.join(rootDir, ...relativePath.split('/')), 'utf8');
}

describe('repo2ds generate', () => {
  it('writes a story next to the component plus the JSON artifacts', async () => {
    const rootDir = await reactRepo();
    const { writer, env } = environment();

    await runGenerate(rootDir, { layout: 'beside' }, env);

    const story = await read(rootDir, 'src/components/Button.stories.tsx');
    expect(story).toContain("import { Button } from './Button';");
    expect(story).toContain('title: ');

    const report = JSON.parse(await read(rootDir, '.repo2ds/report.json')) as {
      schemaVersion: number;
    };
    expect(report.schemaVersion).toBe(1);

    const tokens = JSON.parse(await read(rootDir, '.repo2ds/design-tokens.json')) as {
      schemaVersion: number;
    };
    expect(tokens.schemaVersion).toBe(1);

    expect(writer.text()).toContain('+ src/components/Button.stories.tsx');
    expect(writer.text()).toContain('Wrote 3 files.');
  });

  it('writes nothing during a dry run', async () => {
    const rootDir = await reactRepo();
    const { writer, env } = environment();

    await runGenerate(rootDir, { dryRun: true, layout: 'beside' }, env);

    await expect(read(rootDir, 'src/components/Button.stories.tsx')).rejects.toThrow();
    expect(writer.lines[0]).toBe('Generate (dry run)');
    expect(writer.text()).toContain('Would write 3 files.');
  });

  it('keeps an existing story unless --force is passed', async () => {
    const rootDir = await reactRepo({
      'src/components/Button.stories.tsx': '// hand written\n',
    });
    const { writer, env } = environment();

    await runGenerate(rootDir, {}, env);

    expect(await read(rootDir, 'src/components/Button.stories.tsx')).toBe('// hand written\n');
    expect(writer.text()).toContain('pass --force to overwrite');
    expect(writer.text()).toContain('skipped 1');
  });

  it('overwrites an existing story with --force', async () => {
    const rootDir = await reactRepo({
      'src/components/Button.stories.tsx': '// hand written\n',
    });
    const { env } = environment();

    await runGenerate(rootDir, { force: true }, env);

    expect(await read(rootDir, 'src/components/Button.stories.tsx')).toContain('Button');
  });

  it('honours --no-stories and --out', async () => {
    const rootDir = await reactRepo();
    const { writer, env } = environment();

    await runGenerate(rootDir, { stories: false, out: 'artifacts' }, env);

    await expect(read(rootDir, 'src/components/Button.stories.tsx')).rejects.toThrow();
    await expect(read(rootDir, 'artifacts/report.json')).resolves.toContain('schemaVersion');
    expect(writer.text()).toContain('Wrote 2 files.');
  });

  it('skips stories when the config disables Storybook', async () => {
    const rootDir = await reactRepo({
      'repo2ds.config.json': '{ "storybook": { "enabled": false } }',
    });
    const { writer, env } = environment();

    await runGenerate(rootDir, {}, env);

    await expect(read(rootDir, 'src/components/Button.stories.tsx')).rejects.toThrow();
    expect(writer.text()).toContain('Wrote 2 files.');
  });

  it('lists what it would write as JSON', async () => {
    const rootDir = await reactRepo();
    const { writer, env } = environment();

    await runGenerate(rootDir, { json: true, dryRun: true, layout: 'beside' }, env);

    expect(JSON.parse(writer.text())).toEqual({
      dryRun: true,
      layout: 'beside',
      files: [
        { filePath: 'src/components/Button.stories.tsx', status: 'written' },
        { filePath: '.repo2ds/report.json', status: 'written' },
        { filePath: '.repo2ds/design-tokens.json', status: 'written' },
      ],
    });
  });

  it('writes a React Native story for a React Native component', async () => {
    const rootDir = await createTempRepo({
      'package.json': JSON.stringify({
        name: 'rn-app',
        dependencies: { react: '18.3.1', 'react-native': '0.76.5' },
      }),
      'src/Badge.tsx': `import { Text, View } from 'react-native';

export interface BadgeProps {
  label: string;
}

export function Badge({ label }: BadgeProps) {
  return (
    <View style={{ padding: 8 }}>
      <Text>{label}</Text>
    </View>
  );
}
`,
    });
    const { env } = environment();

    await runGenerate(rootDir, { layout: 'beside' }, env);

    const story = await read(rootDir, 'src/Badge.stories.tsx');
    expect(story).toContain("from 'react-native'");
    expect(story).not.toContain('autodocs');
  });
});

describe('repo2ds generate, folder layout', () => {
  it('scaffolds a folder per component without touching the application', async () => {
    const rootDir = await reactRepo();
    const { writer, env } = environment();

    await runGenerate(rootDir, { layout: 'folder' }, env);

    expect(await read(rootDir, 'repo2ds/components/Button/Button.tsx')).toBe(
      "export { Button } from '../../../src/components/Button';\n",
    );
    expect(await read(rootDir, 'repo2ds/components/Button/Button.types.ts')).toBe(
      "export type { ButtonProps } from '../../../src/components/Button';\n",
    );
    expect(await read(rootDir, 'repo2ds/components/Button/index.ts')).toBe(
      [
        "export { Button } from './Button';",
        "export type { ButtonProps } from './Button.types';",
        '',
      ].join('\n'),
    );

    // The story sits in the folder and imports the re-export, not the original.
    const story = await read(rootDir, 'repo2ds/components/Button/Button.stories.tsx');
    expect(story).toContain("import { Button } from './Button';");

    const example = await read(rootDir, 'repo2ds/components/Button/Button.example.tsx');
    expect(example).toContain("import { Button } from './Button';");
    expect(example).toContain('<Button label="Label" variant="primary" />');

    await expect(read(rootDir, 'repo2ds/components/README.md')).resolves.toContain(
      'src/components/Button.tsx',
    );

    // Nothing was written beside the component.
    await expect(read(rootDir, 'src/components/Button.stories.tsx')).rejects.toThrow();
    expect(await read(rootDir, 'src/components/Button.tsx')).toBe(BUTTON);
    expect(writer.text()).toContain('Wrote 8 files.');
  });

  it('chooses folders when the repository has no stories of its own', async () => {
    const rootDir = await reactRepo();
    const { writer, env } = environment();

    await runGenerate(rootDir, {}, env);

    expect(writer.text()).toContain('No stories found');
    await expect(read(rootDir, 'repo2ds/components/Button/Button.tsx')).resolves.toContain(
      'export {',
    );
  });

  it('defers to the existing convention when the repository already has stories', async () => {
    const rootDir = await reactRepo({ 'src/other/Card.stories.tsx': '// hand written\n' });
    const { writer, env } = environment();

    await runGenerate(rootDir, {}, env);

    expect(writer.text()).toContain('src/other/Card.stories.tsx');
    await expect(read(rootDir, 'src/components/Button.stories.tsx')).resolves.toContain('Button');
    await expect(read(rootDir, 'repo2ds/components/Button/Button.tsx')).rejects.toThrow();
  });

  it('leaves an adopted folder alone unless --force is passed', async () => {
    const rootDir = await reactRepo();
    const { env } = environment();
    await runGenerate(rootDir, { layout: 'folder' }, env);

    const entry = path.join(rootDir, 'repo2ds/components/Button/Button.tsx');
    await fs.writeFile(entry, '// adopted, real implementation lives here now\n', 'utf8');

    const second = environment();
    await runGenerate(rootDir, { layout: 'folder' }, second.env);

    expect(await read(rootDir, 'repo2ds/components/Button/Button.tsx')).toBe(
      '// adopted, real implementation lives here now\n',
    );
    expect(second.writer.text()).toContain('pass --force to overwrite');
  });

  it('keeps choosing folders on a second run, ignoring the stories it wrote itself', async () => {
    const rootDir = await reactRepo();
    await runGenerate(rootDir, {}, environment().env);

    const second = environment();
    await runGenerate(rootDir, {}, second.env);

    expect(second.writer.text()).toContain('No stories found');
    await expect(read(rootDir, 'src/components/Button.stories.tsx')).rejects.toThrow();
  });

  it('writes the folders where --components-dir asks', async () => {
    const rootDir = await reactRepo();
    const { env } = environment();

    await runGenerate(rootDir, { layout: 'folder', componentsDir: 'design-system' }, env);

    await expect(read(rootDir, 'design-system/Button/Button.tsx')).resolves.toContain(
      "from '../../src/components/Button'",
    );
  });

  it('qualifies folder names when two components share one', async () => {
    const rootDir = await reactRepo({
      'src/admin/Button.tsx': 'export function Button() {\n  return <button />;\n}\n',
    });
    const { env } = environment();

    await runGenerate(rootDir, { layout: 'folder' }, env);

    await expect(read(rootDir, 'repo2ds/components/Button-admin/Button.tsx')).resolves.toContain(
      "from '../../../src/admin/Button'",
    );
    await expect(
      read(rootDir, 'repo2ds/components/Button-components/Button.tsx'),
    ).resolves.toContain("from '../../../src/components/Button'");
  });
});
