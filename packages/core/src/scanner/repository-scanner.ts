import fs from 'node:fs/promises';
import type { Repo2DSConfig, ResolvedConfig } from '../config/index.js';
import { resolveConfig } from '../config/index.js';
import type { Diagnostic } from '../models/index.js';
import { DiagnosticCollector, describeError } from '../utils/index.js';
import { FileDiscovery } from './file-discovery.js';
import type { ProjectManifest } from './project-manifest.js';
import { readProjectManifest } from './project-manifest.js';
import { SourceParser } from './source-parser.js';
import type { DiscoveredFile, ParsedSourceFile } from './source-file.js';

export interface RepositoryScannerOptions {
  /** Absolute path to the repository to scan. */
  rootDir: string;
  config?: Repo2DSConfig;
  /** Share a collector to merge scanner and adapter diagnostics into one list. */
  diagnostics?: DiagnosticCollector;
  /** An already-read manifest, so a caller that needed it early avoids a second read. */
  manifest?: ProjectManifest;
}

/**
 * Called once per parsed file. Throwing from a visitor is contained: the error
 * becomes a diagnostic against that file and the scan continues.
 *
 * The AST is released as soon as the visitor returns, so everything a consumer
 * needs must be read (and copied out as plain data) inside the visitor.
 */
export type SourceFileVisitor = (file: ParsedSourceFile) => void | Promise<void>;

export interface RepositoryScanResult {
  rootDir: string;
  config: ResolvedConfig;
  manifest: ProjectManifest;
  /** Files that were discovered and accepted for parsing, in stable order. */
  files: DiscoveredFile[];
  filesParsed: number;
  filesFailed: number;
  diagnostics: readonly Diagnostic[];
  durationMs: number;
}

/**
 * Phase 1 of the pipeline: find the files worth analysing, parse them, and hand
 * each one to a visitor.
 *
 * Files are streamed rather than collected: every later stage (component
 * discovery, prop extraction, style extraction) works one file at a time, so
 * ASTs are released immediately and memory stays flat on large repositories.
 */
export class RepositoryScanner {
  private readonly config: ResolvedConfig;
  private readonly diagnostics: DiagnosticCollector;

  constructor(private readonly options: RepositoryScannerOptions) {
    this.config = resolveConfig(options.config);
    this.diagnostics = options.diagnostics ?? new DiagnosticCollector();
  }

  get resolvedConfig(): ResolvedConfig {
    return this.config;
  }

  get diagnosticCollector(): DiagnosticCollector {
    return this.diagnostics;
  }

  async scan(visit?: SourceFileVisitor): Promise<RepositoryScanResult> {
    const startedAt = Date.now();
    const { rootDir } = this.options;
    await assertDirectory(rootDir);

    const manifest =
      this.options.manifest ?? (await readProjectManifest(rootDir, this.diagnostics));

    const files = await new FileDiscovery({
      rootDir,
      include: this.config.include,
      exclude: this.config.exclude,
      maxFileSizeKb: this.config.maxFileSizeKb,
      diagnostics: this.diagnostics,
    }).discover();

    const parser = new SourceParser({ diagnostics: this.diagnostics });
    let filesParsed = 0;
    let filesFailed = 0;

    for (const file of files) {
      const parsed = await parser.parse(file);
      if (!parsed) {
        filesFailed += 1;
        continue;
      }
      filesParsed += 1;
      try {
        await visit?.(parsed);
      } catch (error) {
        this.diagnostics.error('analysis-failed', 'Analysis of this file failed and was skipped.', {
          filePath: file.relativePath,
          detail: describeError(error),
        });
      } finally {
        parser.release(parsed);
      }
    }

    return {
      rootDir,
      config: this.config,
      manifest,
      files,
      filesParsed,
      filesFailed,
      diagnostics: this.diagnostics.all(),
      durationMs: Date.now() - startedAt,
    };
  }
}

async function assertDirectory(rootDir: string): Promise<void> {
  let stats;
  try {
    stats = await fs.stat(rootDir);
  } catch {
    throw new Error(`Path does not exist: ${rootDir}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${rootDir}`);
  }
}
