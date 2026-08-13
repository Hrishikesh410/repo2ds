import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Repo2DSConfig } from '@repo2ds/core';
import { describeError } from '@repo2ds/core';
import { validateConfig } from './validate-config.js';

/**
 * Searched in order, so a project that has both a TypeScript and a JavaScript
 * config gets the TypeScript one.
 */
export const CONFIG_FILE_NAMES: readonly string[] = [
  'repo2ds.config.ts',
  'repo2ds.config.mts',
  'repo2ds.config.js',
  'repo2ds.config.mjs',
  'repo2ds.config.cjs',
  'repo2ds.config.json',
];

export interface LoadedConfig {
  config: Repo2DSConfig;
  /** Absolute path of the file that was loaded, absent when none was found. */
  filePath?: string;
}

export interface LoadConfigOptions {
  rootDir: string;
  /** An explicit `--config` path. Missing files are an error rather than a miss. */
  configPath?: string;
}

/**
 * Loads `repo2ds.config.*` from the scanned repository.
 *
 * Configuration is code, so it is imported rather than parsed: a config that
 * computes its globs is normal. TypeScript configs rely on the running Node
 * being able to import TypeScript, which is why the error below names the
 * alternatives instead of failing with an opaque syntax error.
 */
export async function loadConfig(options: LoadConfigOptions): Promise<LoadedConfig> {
  const filePath = options.configPath
    ? path.resolve(options.rootDir, options.configPath)
    : await findConfigFile(options.rootDir);

  if (!filePath) {
    return { config: {} };
  }

  if (options.configPath && !(await fileExists(filePath))) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  return { config: await readConfigFile(filePath), filePath };
}

export async function findConfigFile(rootDir: string): Promise<string | undefined> {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = path.join(rootDir, name);
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

async function readConfigFile(filePath: string): Promise<Repo2DSConfig> {
  if (filePath.endsWith('.json')) {
    return parseJsonConfig(filePath, await fs.readFile(filePath, 'utf8'));
  }

  const exported = await importConfigFile(filePath);
  const config =
    typeof exported === 'function' ? await (exported as () => Promise<unknown>)() : exported;

  return validateConfig(config, (message) => `${configErrorPrefix(filePath)} ${message}`);
}

async function importConfigFile(filePath: string): Promise<unknown> {
  try {
    // Node caches modules for the life of the process, so a query string keeps a
    // second load in the same process from returning a stale config.
    const url = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
    const module = (await import(url)) as { default?: unknown };
    return module.default ?? module;
  } catch (error) {
    throw new Error(
      `${configErrorPrefix(filePath)} ${describeError(error)}${typeScriptHint(filePath)}`,
    );
  }
}

function parseJsonConfig(filePath: string, contents: string): Repo2DSConfig {
  const describe = (message: string): string => `${configErrorPrefix(filePath)} ${message}`;

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(describe(describeError(error)));
  }

  return validateConfig(parsed, describe);
}

function configErrorPrefix(filePath: string): string {
  return `Could not load ${path.basename(filePath)}:`;
}

/**
 * Node can only import TypeScript directly from v22.6 (behind a flag) and v23.6
 * onwards, so on older runtimes a `.ts` config fails for a reason that has
 * nothing to do with its contents.
 */
function typeScriptHint(filePath: string): string {
  if (!/\.m?ts$/.test(filePath)) {
    return '';
  }
  return ' Node cannot import TypeScript on this version; use repo2ds.config.js or repo2ds.config.json.';
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(absolutePath);
    return stats.isFile();
  } catch {
    return false;
  }
}
