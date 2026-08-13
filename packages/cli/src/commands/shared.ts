import fs from 'node:fs/promises';
import path from 'node:path';
import type { AnalysisResult, Repo2DSConfig } from '@repo2ds/core';
import { DiagnosticCollector } from '@repo2ds/core';
import { analyseRepository } from '../analysis.js';
import { loadConfig, mergeConfig } from '../config/index.js';
import { Reporter } from '../output/reporter.js';
import type { Writer } from '../output/writer.js';

export interface CommandEnvironment {
  writer: Writer;
  cwd: string;
  colors?: boolean;
}

/** Options every command accepts, because every command analyses a repository. */
export interface CommonOptions {
  include?: string[];
  exclude?: string[];
  maxFileSize?: number;
  minUsage?: number;
  config?: string;
  json?: boolean;
}

export interface Analysed {
  result: AnalysisResult;
  rootDir: string;
  /** Absolute path of the config file that was used, if there was one. */
  configPath?: string;
}

/** Resolve the target, load its config, and analyse it. Shared by all commands. */
export async function analyse(
  target: string | undefined,
  options: CommonOptions,
  env: CommandEnvironment,
): Promise<Analysed> {
  const rootDir = path.resolve(env.cwd, target ?? '.');
  await assertTargetExists(target, rootDir);

  const loaded = await loadConfig({
    rootDir,
    ...(options.config ? { configPath: options.config } : {}),
  });

  const result = await analyseRepository({
    rootDir,
    config: mergeConfig(loaded.config, toConfig(options)),
    diagnostics: new DiagnosticCollector(),
  });

  return { result, rootDir, ...(loaded.filePath ? { configPath: loaded.filePath } : {}) };
}

/**
 * `scan` is the default command, so a mistyped command name arrives here as a
 * path. Saying so is more useful than reporting a missing directory called
 * `tokns`, and the scanner's own check still covers everything else.
 */
async function assertTargetExists(target: string | undefined, rootDir: string): Promise<void> {
  if (target === undefined || (await isDirectory(rootDir))) {
    return;
  }

  const looksLikeACommandName = !/[/\\.]/.test(target);
  const hint = looksLikeACommandName ? ' If you meant a command, run `repo2ds --help`.' : '';
  throw new Error(`Path does not exist: ${rootDir}.${hint}`);
}

async function isDirectory(absolutePath: string): Promise<boolean> {
  try {
    return (await fs.stat(absolutePath)).isDirectory();
  } catch {
    return false;
  }
}

export function createReporter(env: CommandEnvironment): Reporter {
  return new Reporter({
    writer: env.writer,
    ...(env.colors === undefined ? {} : { colors: env.colors }),
  });
}

export function printJson(env: CommandEnvironment, data: unknown): void {
  env.writer.line(JSON.stringify(data, null, 2));
}

/** Config file paths are reported relative to the scanned repository. */
export function relativeTo(rootDir: string, absolutePath: string): string {
  return path.relative(rootDir, absolutePath) || path.basename(absolutePath);
}

function toConfig(options: CommonOptions): Repo2DSConfig {
  const config: Repo2DSConfig = {};
  if (options.include && options.include.length > 0) {
    config.include = options.include;
  }
  if (options.exclude && options.exclude.length > 0) {
    config.exclude = options.exclude;
  }
  if (options.maxFileSize !== undefined) {
    config.maxFileSizeKb = options.maxFileSize;
  }
  if (options.minUsage !== undefined) {
    config.tokens = { minUsageCount: options.minUsage };
  }
  return config;
}
