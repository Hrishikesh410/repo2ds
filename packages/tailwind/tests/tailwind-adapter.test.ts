import { TokenInferenceEngine } from '@repo2ds/core';
import { describe, expect, it } from 'vitest';
import { TailwindStyleAdapter } from '../src/index.js';

const context = {
  filePath: 'src/Button.tsx',
  componentName: 'Button',
  location: { line: 3, column: 5 },
};

describe('TailwindStyleAdapter', () => {
  it('reports utilities as style usages', () => {
    const styles = new TailwindStyleAdapter().parseClassNames('px-4 bg-blue-600', context);

    expect(styles).toEqual([
      {
        property: 'padding-left/right',
        value: 16,
        source: 'tailwind',
        filePath: 'src/Button.tsx',
        origin: 'px-4',
        location: { line: 3, column: 5 },
        componentName: 'Button',
      },
      expect.objectContaining({
        property: 'background-color',
        value: 'blue-600',
        origin: 'bg-blue-600',
      }),
    ]);
  });

  it('records the class it came from so findings are traceable', () => {
    const styles = new TailwindStyleAdapter().parseClassNames('md:hover:rounded-lg', context);

    expect(styles[0]).toMatchObject({ origin: 'md:hover:rounded-lg', value: 8 });
  });

  it('can report a different source, which is how NativeWind reuses it', () => {
    const adapter = new TailwindStyleAdapter({ source: 'nativewind' });

    expect(adapter.name).toBe('nativewind');
    expect(adapter.parseClassNames('p-4', context)[0]?.source).toBe('nativewind');
  });

  it('can filter out utilities a platform does not support', () => {
    const adapter = new TailwindStyleAdapter({
      filter: (declaration) => declaration.category !== 'layout',
    });

    const styles = adapter.parseClassNames('flex p-4', context);

    expect(styles.map((style) => style.property)).toEqual(['padding']);
  });

  it('feeds token inference so utilities and inline styles group together', () => {
    const adapter = new TailwindStyleAdapter();

    const candidates = new TokenInferenceEngine().infer([
      ...adapter.parseClassNames('p-4', context),
      {
        property: 'padding',
        value: 16,
        source: 'inline',
        filePath: 'src/Card.tsx',
        componentName: 'Card',
        location: { line: 1, column: 1 },
      },
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({ category: 'spacing', value: 16, usageCount: 2 }),
    ]);
  });

  it('never turns layout utilities into token candidates', () => {
    const styles = new TailwindStyleAdapter().parseClassNames(
      'flex items-center justify-between w-full',
      context,
    );

    expect(styles).toHaveLength(4);
    expect(new TokenInferenceEngine({ minUsageCount: 1 }).infer(styles)).toEqual([]);
  });
});
