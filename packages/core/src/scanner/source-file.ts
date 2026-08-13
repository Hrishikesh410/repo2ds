import type { SourceFile } from 'ts-morph';

/** A file selected by discovery, before it has been parsed. */
export interface DiscoveredFile {
  absolutePath: string;
  /** Repository-relative, POSIX separated. */
  relativePath: string;
  sizeBytes: number;
}

/**
 * A parsed file handed to framework adapters.
 *
 * Adapters receive this record rather than a bare `ts-morph` `SourceFile` so
 * they always have the repository-relative path to attribute findings to,
 * without recomputing it from an absolute path.
 */
export interface ParsedSourceFile extends DiscoveredFile {
  sourceFile: SourceFile;
}
