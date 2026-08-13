import { describe, expect, it } from 'vitest';
import { runTokens } from '../src/commands/tokens.js';
import { MemoryWriter } from '../src/output/writer.js';
import { fixturePath } from './helpers/temp-repo.js';

function environment(cwd: string = process.cwd()) {
  const writer = new MemoryWriter();
  return { writer, env: { writer, cwd, colors: false } };
}

describe('repo2ds tokens', () => {
  it('groups candidates by category with usage and confidence', async () => {
    const { writer, env } = environment();

    await runTokens(fixturePath('react-basic'), {}, env);

    const output = writer.text();
    expect(writer.lines[0]).toBe('Token candidates');
    expect(output).toContain('Colors:');
    expect(output).toContain('Spacing:');
    expect(output).toMatch(/\d+ uses · confidence \d\.\d\d/);
  });

  it('limits output to one category', async () => {
    const { writer, env } = environment();

    await runTokens(fixturePath('react-basic'), { category: 'spacing' }, env);

    expect(writer.text()).toContain('Spacing:');
    expect(writer.text()).not.toContain('Colors:');
  });

  it('shows locations only when asked', async () => {
    const { writer, env } = environment();

    await runTokens(fixturePath('react-basic'), { category: 'spacing', locations: true }, env);

    expect(writer.text()).toMatch(/src\/components\/\w+\.tsx:\d+:\d+/);
  });

  it('hides candidates below a minimum confidence', async () => {
    const { writer, env } = environment();

    await runTokens(fixturePath('react-basic'), { minConfidence: 1 }, env);

    expect(writer.text()).toContain('No repeated style values were found');
  });

  it('says which category came back empty', async () => {
    const { writer, env } = environment();

    await runTokens(fixturePath('react-basic'), { category: 'shadow' }, env);

    expect(writer.text()).toContain('No shadow candidates were found.');
  });

  it('emits the design tokens file with --json', async () => {
    const { writer, env } = environment();

    await runTokens(fixturePath('react-basic'), { json: true }, env);

    const file = JSON.parse(writer.text()) as {
      schemaVersion: number;
      tokens: Record<string, { value: unknown; usageCount: number }[]>;
    };

    expect(file.schemaVersion).toBe(1);
    expect(Object.keys(file.tokens)).toContain('color');
    expect(file.tokens.color?.[0]?.usageCount).toBeGreaterThan(1);
  });

  it('reports every value once when --min-usage is 1', async () => {
    const { writer, env } = environment();
    const strict = environment();

    await runTokens(fixturePath('react-basic'), { json: true }, strict.env);
    await runTokens(fixturePath('react-basic'), { json: true, minUsage: 1 }, env);

    const count = (text: string) =>
      Object.values((JSON.parse(text) as { tokens: Record<string, unknown[]> }).tokens).flat()
        .length;

    expect(count(writer.text())).toBeGreaterThan(count(strict.writer.text()));
  });
});
