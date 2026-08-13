import { TokenInferenceEngine } from '@repo2ds/core';
import { TailwindStyleAdapter } from '@repo2ds/tailwind';
import { describe, expect, it } from 'vitest';
import { NativeWindStyleAdapter } from '../src/index.js';

const context = { filePath: 'src/Button.tsx', componentName: 'Button' };

describe('NativeWindStyleAdapter', () => {
  it('reports the nativewind source', () => {
    const adapter = new NativeWindStyleAdapter();

    expect(adapter.name).toBe('nativewind');
    expect(adapter.parseClassNames('p-4', context)[0]?.source).toBe('nativewind');
  });

  it('produces the same values as the Tailwind adapter', () => {
    const classNames = 'px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold';

    const native = new NativeWindStyleAdapter()
      .parseClassNames(classNames, context)
      .map((style) => [style.property, style.value]);
    const web = new TailwindStyleAdapter()
      .parseClassNames(classNames, context)
      .map((style) => [style.property, style.value]);

    expect(native).toEqual(web);
  });

  it('drops display values that have no meaning on native', () => {
    const styles = new NativeWindStyleAdapter().parseClassNames(
      'flex grid inline-block hidden p-4',
      context,
    );

    expect(styles.map((style) => style.value)).toEqual(['flex', 'hidden', 16]);
  });

  it('groups with values written in a style sheet, because a Tailwind unit is a dp', () => {
    const candidates = new TokenInferenceEngine().infer([
      ...new NativeWindStyleAdapter().parseClassNames('p-4', context),
      {
        property: 'padding',
        value: 16,
        source: 'stylesheet',
        filePath: 'src/Card.tsx',
        componentName: 'Card',
        origin: 'styles.card',
      },
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({ category: 'spacing', value: 16, usageCount: 2 }),
    ]);
  });

  it('keeps the class it came from so a finding can be traced back', () => {
    const styles = new NativeWindStyleAdapter().parseClassNames('text-white', context);

    expect(styles[0]).toMatchObject({ property: 'color', value: 'white', origin: 'text-white' });
  });
});
