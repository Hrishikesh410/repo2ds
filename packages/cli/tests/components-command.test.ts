import { afterEach, describe, expect, it } from 'vitest';
import { runComponents } from '../src/commands/components.js';
import { MemoryWriter } from '../src/output/writer.js';
import { createTempRepo, fixturePath, removeTempRepos } from './helpers/temp-repo.js';

afterEach(removeTempRepos);

function environment(cwd: string = process.cwd()) {
  const writer = new MemoryWriter();
  return { writer, env: { writer, cwd, colors: false } };
}

describe('repo2ds components', () => {
  it('lists every component with its file and counts', async () => {
    const { writer, env } = environment();

    await runComponents(fixturePath('react-basic'), {}, env);

    const output = writer.text();
    expect(writer.lines[0]).toBe('Components');
    expect(output).toContain('Button  React · 5 props · 11 styles');
    expect(output).toContain('  src/components/Button.tsx');
    expect(output).toContain('4 components, 4 styled.');
  });

  it('lists props only when asked', async () => {
    const { writer, env } = environment();

    await runComponents(fixturePath('react-basic'), { filter: 'Button', props: true }, env);

    const output = writer.text();
    expect(output).toContain('label: string');
    expect(output).toContain("variant?: 'primary' | 'secondary' = 'primary'");
  });

  it('filters by name, case insensitively', async () => {
    const { writer, env } = environment();

    await runComponents(fixturePath('react-basic'), { filter: 'card' }, env);

    expect(writer.text()).toContain('Card');
    expect(writer.text()).not.toContain('Button');
  });

  it('says so when nothing matches the filter', async () => {
    const { writer, env } = environment();

    await runComponents(fixturePath('react-basic'), { filter: 'Nope' }, env);

    expect(writer.text()).toContain('No component matched "Nope".');
  });

  it('emits the components as JSON', async () => {
    const { writer, env } = environment();

    await runComponents(fixturePath('react-basic'), { json: true, filter: 'Input' }, env);

    const components = JSON.parse(writer.text()) as { name: string; props: unknown[] }[];
    expect(components).toHaveLength(1);
    expect(components[0]?.name).toBe('Input');
  });

  it('reports an empty repository without failing', async () => {
    const rootDir = await createTempRepo({
      'package.json': '{"name":"empty","dependencies":{"react-dom":"^18.0.0"}}',
      'src/util.ts': 'export const add = (a: number, b: number) => a + b;',
    });
    const { writer, env } = environment();

    await runComponents(rootDir, {}, env);

    expect(writer.text()).toContain('No components were found');
  });
});
