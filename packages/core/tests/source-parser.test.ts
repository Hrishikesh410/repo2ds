import path from 'node:path';
import { SyntaxKind } from 'ts-morph';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiscoveredFile } from '../src/index.js';
import { DiagnosticCollector, SourceParser } from '../src/index.js';
import { createTempRepo, removeTempRepos } from './helpers/temp-repo.js';

afterEach(removeTempRepos);

function fileAt(rootDir: string, relativePath: string): DiscoveredFile {
  return {
    absolutePath: path.join(rootDir, ...relativePath.split('/')),
    relativePath,
    sizeBytes: 0,
  };
}

describe('SourceParser', () => {
  it('parses TSX including JSX syntax', async () => {
    const rootDir = await createTempRepo({
      'src/Button.tsx': 'export const Button = () => <button>Submit</button>;',
    });
    const diagnostics = new DiagnosticCollector();
    const parser = new SourceParser({ diagnostics });

    const parsed = await parser.parse(fileAt(rootDir, 'src/Button.tsx'));

    expect(parsed?.relativePath).toBe('src/Button.tsx');
    expect(parsed?.sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement)).toHaveLength(1);
    expect(diagnostics.size).toBe(0);
  });

  it('parses JSX in .js files', async () => {
    const rootDir = await createTempRepo({
      'src/Card.js': 'export function Card() { return <div>hi</div>; }',
    });
    const parser = new SourceParser({ diagnostics: new DiagnosticCollector() });

    const parsed = await parser.parse(fileAt(rootDir, 'src/Card.js'));

    expect(parsed?.sourceFile.getFunction('Card')).toBeDefined();
  });

  it('reports syntax errors as warnings and still returns an AST', async () => {
    const rootDir = await createTempRepo({
      'src/Broken.tsx': 'export const Broken = () => { return <div>;',
    });
    const diagnostics = new DiagnosticCollector();
    const parser = new SourceParser({ diagnostics });

    const parsed = await parser.parse(fileAt(rootDir, 'src/Broken.tsx'));

    expect(parsed).toBeDefined();
    expect(diagnostics.all()).toEqual([
      expect.objectContaining({
        status: 'warning',
        code: 'syntax-error',
        filePath: 'src/Broken.tsx',
      }),
    ]);
    expect(diagnostics.all()[0]?.location).toEqual(expect.objectContaining({ line: 1 }));
  });

  it('records an error instead of throwing when a file cannot be read', async () => {
    const rootDir = await createTempRepo({});
    const diagnostics = new DiagnosticCollector();
    const parser = new SourceParser({ diagnostics });

    const parsed = await parser.parse(fileAt(rootDir, 'src/Missing.tsx'));

    expect(parsed).toBeUndefined();
    expect(diagnostics.all()).toEqual([
      expect.objectContaining({ status: 'error', code: 'file-read-failed' }),
    ]);
  });

  it('releases ASTs so repeated parses do not accumulate source files', async () => {
    const rootDir = await createTempRepo({ 'src/a.tsx': 'export const A = () => null;' });
    const parser = new SourceParser({ diagnostics: new DiagnosticCollector() });

    const first = await parser.parse(fileAt(rootDir, 'src/a.tsx'));
    expect(first).toBeDefined();
    parser.release(first!);

    const second = await parser.parse(fileAt(rootDir, 'src/a.tsx'));
    expect(second?.sourceFile.getVariableDeclaration('A')).toBeDefined();
  });
});
