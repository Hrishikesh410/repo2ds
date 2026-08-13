import type { Command } from 'commander';
import { afterEach, describe, expect, it } from 'vitest';
import { runScan } from '../src/commands/scan.js';
import { MemoryWriter } from '../src/output/writer.js';
import { createProgram } from '../src/program.js';
import { createTempRepo, fixturePath, removeTempRepos } from './helpers/temp-repo.js';

afterEach(removeTempRepos);

function environment(cwd: string = process.cwd()) {
  const writer = new MemoryWriter();
  return { writer, env: { writer, cwd, colors: false } };
}

/** Commander exits the process on a usage error; tests need it to throw instead. */
function throwingProgram(env: { writer: MemoryWriter; cwd: string; colors: boolean }): Command {
  const program = createProgram(env).exitOverride();
  for (const command of program.commands) {
    command.exitOverride().configureOutput({ writeErr: () => undefined });
  }
  return program;
}

describe('repo2ds scan', () => {
  it('reports the project, framework and what was found', async () => {
    const { writer, env } = environment();

    await runScan(fixturePath('react-basic'), {}, env);

    expect(writer.lines).toEqual([
      'Repo2DS',
      '',
      'Project            react-basic-fixture',
      'Framework          React',
      'Files scanned      5',
      'Components         4',
      'Styled components  4',
      '',
      'Potential tokens',
      'Colors      2',
      'Spacing     2',
      'Typography  2',
      'Radius      0',
      'Shadows     0',
      '',
      'Scan completed with no warnings.',
    ]);
  });

  it('resolves a relative path against the working directory', async () => {
    const { writer, env } = environment(fixturePath('.'));

    await runScan('react-basic', {}, env);

    expect(writer.text()).toContain('react-basic-fixture');
  });

  it('reports Tailwind usage when the project uses Tailwind', async () => {
    const { writer, env } = environment();

    await runScan(fixturePath('react-tailwind'), {}, env);

    expect(writer.lines).toContain('Tailwind CSS components  3');
  });

  it('emits the machine-readable report with --json', async () => {
    const { writer, env } = environment();

    await runScan(fixturePath('react-basic'), { json: true }, env);

    const report = JSON.parse(writer.text()) as Record<string, unknown>;

    expect(report).toMatchObject({
      schemaVersion: 1,
      project: { name: 'react-basic-fixture', frameworks: ['react'], stylingSystems: [] },
      statistics: { components: 4, filesScanned: 5 },
      diagnostics: [],
    });
    expect((report.components as { name: string }[]).map((component) => component.name)).toEqual([
      'Button',
      'Card',
      'Input',
      'Modal',
    ]);
  });

  it('names a mixed repository after both frameworks', async () => {
    const rootDir = await createTempRepo({
      'package.json': JSON.stringify({
        name: 'mixed-app',
        dependencies: { 'react-dom': '^18.0.0', 'react-native': '0.76.0' },
      }),
      'src/Button.tsx': 'export const Button = () => null;',
    });
    const { writer, env } = environment();

    await runScan(rootDir, {}, env);

    expect(writer.text()).toContain('React + React Native');
    expect(writer.text()).toContain('Mixed repository detected');
  });

  it('warns when no framework can be detected', async () => {
    const rootDir = await createTempRepo({
      'package.json': JSON.stringify({ name: 'plain', dependencies: { lodash: '^4.0.0' } }),
      'src/index.ts': 'export const answer = 42;',
    });
    const { writer, env } = environment();

    await runScan(rootDir, {}, env);

    expect(writer.text()).toContain('No supported framework detected');
  });

  it('surfaces skipped files without failing the scan', async () => {
    const rootDir = await createTempRepo({
      'package.json': JSON.stringify({ name: 'styled', dependencies: { 'react-dom': '^18.0.0' } }),
      'src/Button.tsx': 'export const Button = () => null;',
      'src/Button.css': '.button { padding: 16px; }',
    });
    const { writer, env } = environment();

    await runScan(rootDir, { include: ['src/**/*'] }, env);

    const output = writer.text();
    expect(output).toContain('unsupported-extension src/Button.css');
    expect(output).toContain('Scan completed with 1 skipped file.');
  });

  it('fails with a clear message for a missing path', async () => {
    const { env } = environment();

    await expect(runScan('/definitely/not/here', {}, env)).rejects.toThrow(/does not exist/);
  });

  it('suggests the help output when the path looks like a mistyped command', async () => {
    const { env } = environment();

    await expect(runScan('tokns', {}, env)).rejects.toThrow(/If you meant a command/);
    await expect(runScan('./tokns', {}, env)).rejects.toThrow(/^(?!.*If you meant a command).*$/s);
  });
});

describe('repo2ds program', () => {
  it('runs scan as the default command', async () => {
    const { writer, env } = environment();
    const program = createProgram(env).exitOverride();

    await program.parseAsync(['node', 'repo2ds', fixturePath('react-basic')]);

    expect(writer.text()).toContain('Files scanned      5');
  });

  it('registers a command for each stage of the workflow', () => {
    const { env } = environment();

    expect(createProgram(env).commands.map((command) => command.name())).toEqual([
      'scan',
      'components',
      'tokens',
      'generate',
    ]);
  });

  it('runs the components command', async () => {
    const { writer, env } = environment();
    const program = createProgram(env).exitOverride();

    await program.parseAsync(['node', 'repo2ds', 'components', fixturePath('react-basic')]);

    expect(writer.text()).toContain('4 components, 4 styled.');
  });

  it('runs the tokens command', async () => {
    const { writer, env } = environment();
    const program = createProgram(env).exitOverride();

    await program.parseAsync([
      'node',
      'repo2ds',
      'tokens',
      fixturePath('react-basic'),
      '--category',
      'color',
    ]);

    expect(writer.text()).toContain('Colors:');
  });

  it('rejects a category it cannot report on', async () => {
    const { env } = environment();
    const program = throwingProgram(env);

    await expect(
      program.parseAsync(['node', 'repo2ds', 'tokens', '.', '--category', 'motion']),
    ).rejects.toThrow(/motion/);
  });

  it('rejects a confidence outside 0 to 1', async () => {
    const { env } = environment();
    const program = throwingProgram(env);

    await expect(
      program.parseAsync(['node', 'repo2ds', 'tokens', '.', '--min-confidence', '4']),
    ).rejects.toThrow(/between 0 and 1/);
  });

  it('rejects a non-numeric --max-file-size', async () => {
    const { env } = environment();
    const program = createProgram(env).exitOverride();

    await expect(
      program.parseAsync(['node', 'repo2ds', 'scan', '.', '--max-file-size', 'huge']),
    ).rejects.toThrow(/positive number of kilobytes/);
  });
});
