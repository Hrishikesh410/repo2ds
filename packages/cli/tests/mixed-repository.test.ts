import { describe, expect, it } from 'vitest';
import { analyse } from '../src/commands/shared.js';
import { MemoryWriter } from '../src/output/writer.js';
import { fixturePath } from './helpers/temp-repo.js';

function environment() {
  const writer = new MemoryWriter();
  return { writer, env: { writer, cwd: process.cwd(), colors: false } };
}

describe('a repository with both React and React Native', () => {
  it('attributes each component to the framework its file uses', async () => {
    const { env } = environment();

    const { result } = await analyse(fixturePath('react-mixed'), {}, env);

    expect(result.detection.mixed).toBe(true);
    expect(result.components.map((component) => [component.name, component.framework])).toEqual([
      ['Chip', 'react-native'],
      ['Banner', 'react'],
    ]);
  });

  it('resolves CSS custom properties to the values they hold', async () => {
    const { env } = environment();

    const { result } = await analyse(fixturePath('react-mixed'), {}, env);
    const banner = result.components.find((component) => component.name === 'Banner');

    expect(
      banner?.styles
        .filter((style) => style.source === 'stylesheet')
        .map((style) => [style.property, style.value]),
    ).toEqual([
      ['background-color', '#2563eb'],
      ['color', '#ffffff'],
      ['padding', '16px'],
      ['border-radius', '8px'],
      ['font-size', '14px'],
      ['font-size', '14px'],
      ['font-weight', '600'],
      ['margin-bottom', '16px'],
    ]);
  });

  it('does not record a custom property declaration as a style', async () => {
    const { env } = environment();

    const { result } = await analyse(fixturePath('react-mixed'), {}, env);

    expect(result.styles.filter((style) => style.property.startsWith('--'))).toEqual([]);
  });

  it('groups a value written for the web with the same value written for native', async () => {
    const { env } = environment();

    const { result } = await analyse(fixturePath('react-mixed'), {}, env);
    const blue = result.tokenCandidates.find(
      (candidate) => candidate.category === 'color' && candidate.value === '#2563EB',
    );

    expect(blue?.usageCount).toBeGreaterThan(2);
    expect(blue?.evidence).toContain('Repeated across 3 files');
  });
});
