import fs from 'node:fs/promises';
import { glob } from 'tinyglobby';
import type { DiagnosticCollector } from '../utils/index.js';
import {
  describeError,
  hasSupportedExtension,
  mapWithConcurrency,
  toRelativePosixPath,
} from '../utils/index.js';
import type { DiscoveredFile } from './source-file.js';

const STAT_CONCURRENCY = 32;

export interface FileDiscoveryOptions {
  /** Absolute path to the repository being scanned. */
  rootDir: string;
  include: readonly string[];
  exclude: readonly string[];
  maxFileSizeKb: number;
  diagnostics: DiagnosticCollector;
}

/**
 * Turns include/exclude globs into a deterministic, sorted list of files worth
 * parsing. Discovery never reads file contents, only metadata.
 */
export class FileDiscovery {
  constructor(private readonly options: FileDiscoveryOptions) {}

  async discover(): Promise<DiscoveredFile[]> {
    const { rootDir, include, exclude, diagnostics } = this.options;

    const matches = await glob({
      patterns: [...include],
      ignore: [...exclude],
      cwd: rootDir,
      absolute: true,
      onlyFiles: true,
      dot: false,
      followSymbolicLinks: false,
      expandDirectories: false,
    });

    const candidates: string[] = [];
    for (const absolutePath of matches) {
      if (hasSupportedExtension(absolutePath)) {
        candidates.push(absolutePath);
        continue;
      }
      diagnostics.skip('unsupported-extension', 'Unsupported file extension, not parsed.', {
        filePath: toRelativePosixPath(rootDir, absolutePath),
      });
    }

    const maxBytes = this.options.maxFileSizeKb * 1024;
    const files = await mapWithConcurrency(candidates, STAT_CONCURRENCY, async (absolutePath) => {
      const relativePath = toRelativePosixPath(rootDir, absolutePath);
      try {
        const stats = await fs.stat(absolutePath);
        if (stats.size > maxBytes) {
          diagnostics.skip(
            'file-too-large',
            `File is larger than ${this.options.maxFileSizeKb} kB and was skipped.`,
            { filePath: relativePath, detail: `${Math.round(stats.size / 1024)} kB` },
          );
          return undefined;
        }
        return { absolutePath, relativePath, sizeBytes: stats.size } satisfies DiscoveredFile;
      } catch (error) {
        diagnostics.error('file-stat-failed', 'Could not read file metadata.', {
          filePath: relativePath,
          detail: describeError(error),
        });
        return undefined;
      }
    });

    return files.filter((file): file is DiscoveredFile => file !== undefined).sort(byRelativePath);
  }
}

/** Sorts by raw code unit order so results do not depend on the host locale. */
function byRelativePath(a: DiscoveredFile, b: DiscoveredFile): number {
  if (a.relativePath === b.relativePath) {
    return 0;
  }
  return a.relativePath < b.relativePath ? -1 : 1;
}
