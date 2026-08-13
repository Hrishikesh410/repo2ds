import fs from 'node:fs/promises';
import { Project, ts } from 'ts-morph';
import type { SourceLocation } from '../models/index.js';
import type { DiagnosticCollector } from '../utils/index.js';
import { describeError } from '../utils/index.js';
import type { DiscoveredFile, ParsedSourceFile } from './source-file.js';

export interface SourceParserOptions {
  diagnostics: DiagnosticCollector;
}

/**
 * Parses source files into `ts-morph` ASTs.
 *
 * Deliberately syntax-only: no `tsconfig.json` is loaded, lib files are not
 * read and the type checker is never asked a question. That keeps scans fast,
 * makes results independent of whether the target repository compiles, and
 * guarantees Repo2DS never executes code from the repository it analyses.
 */
export class SourceParser {
  private readonly project: Project;

  constructor(private readonly options: SourceParserOptions) {
    this.project = new Project({
      useInMemoryFileSystem: false,
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: true,
      compilerOptions: {
        allowJs: true,
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.Latest,
        noLib: true,
        noResolve: true,
      },
    });
  }

  /**
   * Returns the parsed file, or `undefined` when the file could not be read or
   * parsed. Failures are recorded as diagnostics; they never throw, so one bad
   * file cannot abort a scan.
   */
  async parse(file: DiscoveredFile): Promise<ParsedSourceFile | undefined> {
    let text: string;
    try {
      text = await fs.readFile(file.absolutePath, 'utf8');
    } catch (error) {
      this.options.diagnostics.error('file-read-failed', 'Could not read file contents.', {
        filePath: file.relativePath,
        detail: describeError(error),
      });
      return undefined;
    }

    try {
      const sourceFile = this.project.createSourceFile(file.absolutePath, text, {
        overwrite: true,
      });
      this.reportSyntaxErrors(file, sourceFile.compilerNode);
      return { ...file, sourceFile };
    } catch (error) {
      this.options.diagnostics.error('parse-failed', 'Could not parse file.', {
        filePath: file.relativePath,
        detail: describeError(error),
      });
      return undefined;
    }
  }

  /** Drops the AST so memory stays flat while streaming through a repository. */
  release(parsed: ParsedSourceFile): void {
    this.project.removeSourceFile(parsed.sourceFile);
  }

  private reportSyntaxErrors(file: DiscoveredFile, sourceFile: ts.SourceFile): void {
    const diagnostics = readParseDiagnostics(sourceFile);
    const first = diagnostics[0];
    if (!first) {
      return;
    }

    const extra = diagnostics.length > 1 ? ` (+${diagnostics.length - 1} more)` : '';
    this.options.diagnostics.warn(
      'syntax-error',
      `File has syntax errors; analysis of this file may be incomplete${extra}.`,
      {
        filePath: file.relativePath,
        detail: ts.flattenDiagnosticMessageText(first.messageText, ' '),
        ...locationOf(sourceFile, first.start),
      },
    );
  }
}

/**
 * `parseDiagnostics` is TypeScript's own record of syntax errors on a parsed
 * source file. It is marked internal, so access is defensive: without a
 * program there is no public API that reports syntax-only errors, and building
 * a program would force type resolution we explicitly avoid.
 */
function readParseDiagnostics(sourceFile: ts.SourceFile): readonly ts.Diagnostic[] {
  const candidate = (sourceFile as ts.SourceFile & { parseDiagnostics?: unknown }).parseDiagnostics;
  return Array.isArray(candidate) ? (candidate as ts.Diagnostic[]) : [];
}

function locationOf(
  sourceFile: ts.SourceFile,
  start: number | undefined,
): { location?: SourceLocation } {
  if (start === undefined) {
    return {};
  }
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
  return { location: { line: line + 1, column: character + 1 } };
}
