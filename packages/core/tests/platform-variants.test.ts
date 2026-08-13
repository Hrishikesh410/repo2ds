import { describe, expect, it } from 'vitest';
import type { ComponentInfo } from '../src/index.js';
import {
  findPlatformVariants,
  planScaffold,
  platformOf,
  withoutPlatformSuffix,
} from '../src/index.js';

function component(filePath: string, name = 'Button'): ComponentInfo {
  return {
    name,
    filePath,
    framework: 'react-native',
    exportType: 'named',
    sourceLocation: { line: 1, column: 1 },
    props: [],
    propsResolved: true,
    styles: [],
  };
}

describe('platform suffixes', () => {
  it.each([
    ['src/Button.ios.tsx', 'ios'],
    ['src/Button.android.tsx', 'android'],
    ['src/Button.native.ts', 'native'],
    ['src/Button.web.jsx', 'web'],
    ['src/Button.tsx', undefined],
    ['src/Button.test.tsx', undefined],
    ['Button.ios.tsx', 'ios'],
  ])('reads the platform of %s', (filePath, platform) => {
    expect(platformOf(filePath)).toBe(platform);
  });

  it.each([
    ['src/Button.ios.tsx', 'src/Button.tsx'],
    ['Button.android.jsx', 'Button.jsx'],
    ['src/Button.tsx', 'src/Button.tsx'],
  ])('strips the platform from %s', (filePath, expected) => {
    expect(withoutPlatformSuffix(filePath)).toBe(expected);
  });
});

describe('findPlatformVariants', () => {
  it('keeps the platform-neutral file and sets the others aside', () => {
    const neutral = component('src/Button.tsx');
    const ios = component('src/Button.ios.tsx');
    const android = component('src/Button.android.tsx');

    const variants = findPlatformVariants([ios, neutral, android]);

    expect(variants.has(neutral)).toBe(false);
    expect(variants.get(ios)).toContain('src/Button.tsx');
    expect(variants.get(android)).toContain('written for android');
  });

  it('picks one file when every variant is platform specific', () => {
    const ios = component('src/Button.ios.tsx');
    const android = component('src/Button.android.tsx');

    const variants = findPlatformVariants([ios, android]);

    expect(variants.size).toBe(1);
    expect(variants.has(android)).toBe(false);
  });

  it('leaves different components in the same directory alone', () => {
    const button = component('src/Button.tsx');
    const chip = component('src/Chip.tsx', 'Chip');

    expect(findPlatformVariants([button, chip]).size).toBe(0);
  });

  it('does not group components that merely share a name', () => {
    const one = component('src/ui/Button.tsx');
    const two = component('src/forms/Button.tsx');

    expect(findPlatformVariants([one, two]).size).toBe(0);
  });
});

describe('scaffolding a component with platform variants', () => {
  it('plans one folder that imports the component without its suffix', () => {
    const results = planScaffold(
      [
        component('src/Button.tsx'),
        component('src/Button.ios.tsx'),
        component('src/Button.android.tsx'),
      ],
      { directory: 'repo2ds/components' },
    );

    const planned = results.filter((result) => result.status === 'planned');
    expect(planned).toHaveLength(1);

    const folder = planned[0]?.status === 'planned' ? planned[0].folder : undefined;
    expect(folder?.name).toBe('Button');
    expect(folder?.files[0]?.contents).toBe("export { Button } from '../../../src/Button';\n");
  });

  it('imports the neutral path even when only platform files exist', () => {
    const results = planScaffold([component('src/Button.ios.tsx')], {
      directory: 'repo2ds/components',
    });

    const folder = results[0]?.status === 'planned' ? results[0].folder : undefined;
    expect(folder?.files[0]?.contents).toBe("export { Button } from '../../../src/Button';\n");
  });
});
