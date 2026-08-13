import type { ParsedSourceFile } from '@repo2ds/core';
import { Project, ts } from 'ts-morph';

/** Parses a snippet the way the repository scanner does: syntax only. */
export function parseSource(relativePath: string, source: string): ParsedSourceFile {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.Latest,
      noLib: true,
    },
  });

  const sourceFile = project.createSourceFile(`/repo/${relativePath}`, source, { overwrite: true });

  return {
    absolutePath: `/repo/${relativePath}`,
    relativePath,
    sizeBytes: source.length,
    sourceFile,
  };
}
