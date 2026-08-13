import type { Repo2DSConfig } from '@repo2ds/core';

/**
 * Command line options win over the config file: a flag is a deliberate,
 * one-off override of a committed setting.
 */
export function mergeConfig(file: Repo2DSConfig, overrides: Repo2DSConfig): Repo2DSConfig {
  const merged: Repo2DSConfig = { ...file, ...overrides };

  const storybook = { ...file.storybook, ...overrides.storybook };
  if (Object.keys(storybook).length > 0) {
    merged.storybook = storybook;
  }

  const tokens = { ...file.tokens, ...overrides.tokens };
  if (Object.keys(tokens).length > 0) {
    merged.tokens = tokens;
  }

  return merged;
}
