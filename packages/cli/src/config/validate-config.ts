import path from 'node:path';
import type { FrameworkSetting, Repo2DSConfig, StoryLayout } from '@repo2ds/core';
import { FRAMEWORK_IDS, STORY_LAYOUTS } from '@repo2ds/core';

const FRAMEWORK_SETTINGS: readonly string[] = ['auto', ...FRAMEWORK_IDS];

const LAYOUT_SETTINGS: readonly string[] = STORY_LAYOUTS;

const TOP_LEVEL_KEYS: readonly string[] = [
  'framework',
  'include',
  'exclude',
  'maxFileSizeKb',
  'storybook',
  'tokens',
];

/**
 * Checks a config file's contents before the scanner sees them.
 *
 * A config is code we did not write, and TypeScript cannot help at runtime.
 * `include: 'src/**'` instead of `['src/**']` would otherwise spread into single
 * characters and quietly match nothing, which looks like a broken tool rather
 * than a typo, so every field is checked and named in the error.
 */
export function validateConfig(
  value: unknown,
  describe: (message: string) => string,
): Repo2DSConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(describe('expected the default export to be a configuration object.'));
  }

  const config = value as Record<string, unknown>;

  for (const key of Object.keys(config)) {
    if (!TOP_LEVEL_KEYS.includes(key)) {
      throw new Error(
        describe(`unknown option \`${key}\`. Expected one of ${TOP_LEVEL_KEYS.join(', ')}.`),
      );
    }
  }

  const validated: Repo2DSConfig = {};

  if (config.framework !== undefined) {
    if (typeof config.framework !== 'string' || !FRAMEWORK_SETTINGS.includes(config.framework)) {
      throw new Error(
        describe(`\`framework\` must be one of ${FRAMEWORK_SETTINGS.join(', ')}, or left out.`),
      );
    }
    validated.framework = config.framework as FrameworkSetting;
  }

  for (const key of ['include', 'exclude'] as const) {
    const patterns = config[key];
    if (patterns === undefined) {
      continue;
    }
    if (!Array.isArray(patterns) || patterns.some((pattern) => typeof pattern !== 'string')) {
      throw new Error(describe(`\`${key}\` must be an array of glob patterns.`));
    }
    validated[key] = patterns as string[];
  }

  if (config.maxFileSizeKb !== undefined) {
    validated.maxFileSizeKb = readPositiveNumber(config.maxFileSizeKb, 'maxFileSizeKb', describe);
  }

  const storybook = readSection(config.storybook, 'storybook', describe, [
    'enabled',
    'layout',
    'componentsDir',
    'package',
  ]);
  if (storybook) {
    validated.storybook = {};
    if (storybook.enabled !== undefined) {
      validated.storybook.enabled = readBoolean(storybook.enabled, 'storybook.enabled', describe);
    }
    if (storybook.layout !== undefined) {
      if (typeof storybook.layout !== 'string' || !LAYOUT_SETTINGS.includes(storybook.layout)) {
        throw new Error(
          describe(`\`storybook.layout\` must be one of ${LAYOUT_SETTINGS.join(', ')}.`),
        );
      }
      validated.storybook.layout = storybook.layout as StoryLayout;
    }
    if (storybook.componentsDir !== undefined) {
      validated.storybook.componentsDir = readDirectory(
        storybook.componentsDir,
        'storybook.componentsDir',
        describe,
      );
    }
    if (storybook.package !== undefined) {
      if (typeof storybook.package !== 'string' || storybook.package.trim().length === 0) {
        throw new Error(describe('`storybook.package` must be a package name.'));
      }
      validated.storybook.package = storybook.package.trim();
    }
  }

  const tokens = readSection(config.tokens, 'tokens', describe, ['enabled', 'minUsageCount']);
  if (tokens) {
    validated.tokens = {};
    if (tokens.enabled !== undefined) {
      validated.tokens.enabled = readBoolean(tokens.enabled, 'tokens.enabled', describe);
    }
    if (tokens.minUsageCount !== undefined) {
      validated.tokens.minUsageCount = readPositiveNumber(
        tokens.minUsageCount,
        'tokens.minUsageCount',
        describe,
      );
    }
  }

  return validated;
}

function readSection(
  value: unknown,
  name: string,
  describe: (message: string) => string,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(describe(`\`${name}\` must be an object.`));
  }

  const section = value as Record<string, unknown>;
  for (const key of Object.keys(section)) {
    if (!keys.includes(key)) {
      throw new Error(
        describe(`unknown option \`${name}.${key}\`. Expected one of ${keys.join(', ')}.`),
      );
    }
  }
  return section;
}

function readBoolean(value: unknown, name: string, describe: (message: string) => string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(describe(`\`${name}\` must be true or false.`));
  }
  return value;
}

/**
 * Repo2DS writes files into this directory, so it has to stay inside the
 * repository. An absolute path or one that climbs out with `..` would put
 * generated code somewhere the user never asked for.
 */
function readDirectory(value: unknown, name: string, describe: (m: string) => string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(describe(`\`${name}\` must be a non-empty directory path.`));
  }

  const normalised = value.trim().replace(/\\/g, '/');
  const escapes = normalised.split('/').includes('..');

  if (path.isAbsolute(value) || normalised.startsWith('/') || escapes) {
    throw new Error(describe(`\`${name}\` must be a relative path inside the repository.`));
  }

  return normalised;
}

function readPositiveNumber(
  value: unknown,
  name: string,
  describe: (message: string) => string,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(describe(`\`${name}\` must be a positive number.`));
  }
  return value;
}
