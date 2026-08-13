import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXCLUDE,
  DEFAULT_INCLUDE,
  expandDirectoryPattern,
  resolveConfig,
} from '../src/index.js';

describe('resolveConfig', () => {
  it('falls back to auto detection and the default patterns', () => {
    const config = resolveConfig();

    expect(config.framework).toBe('auto');
    expect(config.include).toEqual([...DEFAULT_INCLUDE]);
    expect(config.exclude).toEqual([...DEFAULT_EXCLUDE]);
    expect(config.storybook.enabled).toBe(true);
    expect(config.tokens.enabled).toBe(true);
  });

  it('lets user patterns replace the defaults', () => {
    const config = resolveConfig({ include: ['app/**/*.tsx'], exclude: ['legacy'] });

    expect(config.include).toEqual(['app/**/*.tsx']);
    expect(config.exclude).toEqual(['**/legacy/**']);
  });

  it('ignores empty pattern lists rather than scanning nothing', () => {
    const config = resolveConfig({ include: [], exclude: ['  '] });

    expect(config.include).toEqual([...DEFAULT_INCLUDE]);
    expect(config.exclude).toEqual([...DEFAULT_EXCLUDE]);
  });

  it('keeps an explicit framework choice', () => {
    expect(resolveConfig({ framework: 'react-native' }).framework).toBe('react-native');
  });

  it('honours a disabled generator', () => {
    expect(resolveConfig({ storybook: { enabled: false } }).storybook.enabled).toBe(false);
  });
});

describe('expandDirectoryPattern', () => {
  it.each([
    ['node_modules', '**/node_modules/**'],
    ['dist/', '**/dist/**'],
    ['src/generated', 'src/generated/**'],
    ['**/*.d.ts', '**/*.d.ts'],
    ['src/legacy.tsx', 'src/legacy.tsx'],
  ])('expands %s to %s', (input, expected) => {
    expect(expandDirectoryPattern(input)).toBe(expected);
  });
});
