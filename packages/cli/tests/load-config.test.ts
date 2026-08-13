import { afterEach, describe, expect, it } from 'vitest';
import { findConfigFile, loadConfig, mergeConfig } from '../src/config/index.js';
import { createTempRepo, removeTempRepos } from './helpers/temp-repo.js';

afterEach(removeTempRepos);

describe('loadConfig', () => {
  it('returns empty configuration when the project has none', async () => {
    const rootDir = await createTempRepo({ 'package.json': '{"name":"none"}' });

    const loaded = await loadConfig({ rootDir });

    expect(loaded).toEqual({ config: {} });
  });

  it('loads a JavaScript config from its default export', async () => {
    const rootDir = await createTempRepo({
      'package.json': '{"name":"app"}',
      'repo2ds.config.mjs': 'export default { include: ["app/**/*.tsx"], maxFileSizeKb: 128 };',
    });

    const loaded = await loadConfig({ rootDir });

    expect(loaded.config).toEqual({ include: ['app/**/*.tsx'], maxFileSizeKb: 128 });
    expect(loaded.filePath).toContain('repo2ds.config.mjs');
  });

  it('calls a config that is exported as a function', async () => {
    const rootDir = await createTempRepo({
      'package.json': '{"name":"app"}',
      'repo2ds.config.mjs': 'export default () => ({ tokens: { minUsageCount: 5 } });',
    });

    const loaded = await loadConfig({ rootDir });

    expect(loaded.config).toEqual({ tokens: { minUsageCount: 5 } });
  });

  it('loads a JSON config', async () => {
    const rootDir = await createTempRepo({
      'package.json': '{"name":"app"}',
      'repo2ds.config.json': '{ "framework": "react-native" }',
    });

    const loaded = await loadConfig({ rootDir });

    expect(loaded.config).toEqual({ framework: 'react-native' });
  });

  it('loads an explicit --config path', async () => {
    const rootDir = await createTempRepo({
      'package.json': '{"name":"app"}',
      'repo2ds.config.json': '{ "framework": "react" }',
      'config/ci.json': '{ "framework": "react-native" }',
    });

    const loaded = await loadConfig({ rootDir, configPath: 'config/ci.json' });

    expect(loaded.config).toEqual({ framework: 'react-native' });
  });

  it('fails when an explicit --config path does not exist', async () => {
    const rootDir = await createTempRepo({ 'package.json': '{"name":"app"}' });

    await expect(loadConfig({ rootDir, configPath: 'missing.json' })).rejects.toThrow(
      /Config file not found/,
    );
  });

  it('names the file when its contents cannot be read', async () => {
    const rootDir = await createTempRepo({
      'package.json': '{"name":"app"}',
      'repo2ds.config.json': '{ not json',
    });

    await expect(loadConfig({ rootDir })).rejects.toThrow(/Could not load repo2ds.config.json/);
  });

  it('rejects a config that is not an object', async () => {
    const rootDir = await createTempRepo({
      'package.json': '{"name":"app"}',
      'repo2ds.config.mjs': 'export default 42;',
    });

    await expect(loadConfig({ rootDir })).rejects.toThrow(/configuration object/);
  });

  it('explains that older Node versions cannot import a TypeScript config', async () => {
    const rootDir = await createTempRepo({
      'package.json': '{"name":"app"}',
      'repo2ds.config.ts': 'export default { framework: "react" } as const;',
    });

    // Newer Node versions can strip types, so either outcome is correct; what
    // must not happen is an unexplained syntax error.
    try {
      const loaded = await loadConfig({ rootDir });
      expect(loaded.config).toEqual({ framework: 'react' });
    } catch (error) {
      expect((error as Error).message).toMatch(/repo2ds.config.js or repo2ds.config.json/);
    }
  });

  it('prefers a TypeScript config over a JavaScript one', async () => {
    const rootDir = await createTempRepo({
      'package.json': '{"name":"app"}',
      'repo2ds.config.ts': 'export default {};',
      'repo2ds.config.js': 'module.exports = {};',
    });

    await expect(findConfigFile(rootDir)).resolves.toMatch(/repo2ds\.config\.ts$/);
  });
});

describe('config validation', () => {
  async function load(contents: string): Promise<unknown> {
    const rootDir = await createTempRepo({
      'package.json': '{"name":"app"}',
      'repo2ds.config.json': contents,
    });
    const loaded = await loadConfig({ rootDir });
    return loaded.config;
  }

  it('rejects a glob list written as a single string', async () => {
    await expect(load('{ "include": "src/**/*.tsx" }')).rejects.toThrow(
      /`include` must be an array of glob patterns/,
    );
  });

  it('rejects a framework it does not support', async () => {
    await expect(load('{ "framework": "vue" }')).rejects.toThrow(
      /`framework` must be one of auto, react, react-native/,
    );
  });

  it('rejects a size or count that is not a positive number', async () => {
    await expect(load('{ "maxFileSizeKb": 0 }')).rejects.toThrow(
      /`maxFileSizeKb` must be a positive number/,
    );
    await expect(load('{ "tokens": { "minUsageCount": "5" } }')).rejects.toThrow(
      /`tokens.minUsageCount` must be a positive number/,
    );
  });

  it('rejects a flag that is not a boolean', async () => {
    await expect(load('{ "storybook": { "enabled": "yes" } }')).rejects.toThrow(
      /`storybook.enabled` must be true or false/,
    );
  });

  it('names a misspelled option instead of ignoring it', async () => {
    await expect(load('{ "excludes": ["dist"] }')).rejects.toThrow(
      /unknown option `excludes`. Expected one of framework, include, exclude/,
    );
    await expect(load('{ "tokens": { "minUsage": 3 } }')).rejects.toThrow(
      /unknown option `tokens.minUsage`/,
    );
  });

  it('accepts a config that uses every option', async () => {
    await expect(
      load(
        JSON.stringify({
          framework: 'react',
          include: ['app/**/*.tsx'],
          exclude: ['app/legacy/**'],
          maxFileSizeKb: 256,
          storybook: { enabled: false },
          tokens: { enabled: true, minUsageCount: 3 },
        }),
      ),
    ).resolves.toEqual({
      framework: 'react',
      include: ['app/**/*.tsx'],
      exclude: ['app/legacy/**'],
      maxFileSizeKb: 256,
      storybook: { enabled: false },
      tokens: { enabled: true, minUsageCount: 3 },
    });
  });
});

describe('mergeConfig', () => {
  it('lets command line options win over the file', () => {
    const merged = mergeConfig({ include: ['src/**'], maxFileSizeKb: 64 }, { include: ['app/**'] });

    expect(merged).toEqual({ include: ['app/**'], maxFileSizeKb: 64 });
  });

  it('merges nested sections instead of replacing them', () => {
    const merged = mergeConfig(
      { tokens: { enabled: true, minUsageCount: 2 } },
      { tokens: { minUsageCount: 5 } },
    );

    expect(merged).toEqual({ tokens: { enabled: true, minUsageCount: 5 } });
  });

  it('leaves sections out when neither side sets one', () => {
    expect(mergeConfig({ framework: 'react' }, {})).toEqual({ framework: 'react' });
  });
});
