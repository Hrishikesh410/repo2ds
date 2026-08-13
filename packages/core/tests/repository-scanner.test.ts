import { afterEach, describe, expect, it } from 'vitest';
import { RepositoryScanner } from '../src/index.js';
import { createTempRepo, fixturePath, removeTempRepos } from './helpers/temp-repo.js';

afterEach(removeTempRepos);

describe('RepositoryScanner', () => {
  it('scans the react-basic fixture', async () => {
    const scanner = new RepositoryScanner({ rootDir: fixturePath('react-basic') });

    const visited: string[] = [];
    const result = await scanner.scan((file) => {
      visited.push(file.relativePath);
    });

    expect(result.manifest.name).toBe('react-basic-fixture');
    expect(result.files.map((file) => file.relativePath)).toEqual([
      'src/components/Button.tsx',
      'src/components/Card.tsx',
      'src/components/Input.tsx',
      'src/components/Modal.tsx',
      'src/utils/format.ts',
    ]);
    expect(visited).toEqual(result.files.map((file) => file.relativePath));
    expect(result.filesParsed).toBe(5);
    expect(result.filesFailed).toBe(0);
    expect(result.diagnostics).toEqual([]);
  });

  it('gives visitors a parsed AST for every file', async () => {
    const scanner = new RepositoryScanner({ rootDir: fixturePath('react-basic') });

    const exportedNames: string[] = [];
    await scanner.scan((file) => {
      exportedNames.push(...file.sourceFile.getExportedDeclarations().keys());
    });

    expect(exportedNames).toContain('Button');
    expect(exportedNames).toContain('Modal');
  });

  it('keeps scanning when one file has broken syntax', async () => {
    const rootDir = await createTempRepo({
      'package.json': JSON.stringify({ name: 'resilient', dependencies: { 'react-dom': '^18' } }),
      'src/Broken.tsx': 'export const Broken = () => { return <div>;',
      'src/Fine.tsx': 'export const Fine = () => null;',
    });

    const result = await new RepositoryScanner({ rootDir }).scan();

    expect(result.filesParsed).toBe(2);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['syntax-error']);
  });

  it('contains visitor failures as diagnostics against the offending file', async () => {
    const rootDir = await createTempRepo({
      'package.json': JSON.stringify({ name: 'visitor', dependencies: {} }),
      'src/a.tsx': 'export const A = () => null;',
      'src/b.tsx': 'export const B = () => null;',
    });

    const seen: string[] = [];
    const result = await new RepositoryScanner({ rootDir }).scan((file) => {
      seen.push(file.relativePath);
      if (file.relativePath === 'src/a.tsx') {
        throw new Error('analyzer exploded');
      }
    });

    expect(seen).toEqual(['src/a.tsx', 'src/b.tsx']);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        status: 'error',
        code: 'analysis-failed',
        filePath: 'src/a.tsx',
        detail: 'analyzer exploded',
      }),
    ]);
  });

  it('applies configuration overrides', async () => {
    const rootDir = await createTempRepo({
      'package.json': JSON.stringify({ name: 'configured' }),
      'app/Button.tsx': 'export const Button = () => null;',
      'src/Card.tsx': 'export const Card = () => null;',
    });

    const result = await new RepositoryScanner({
      rootDir,
      config: { include: ['app/**/*.tsx'] },
    }).scan();

    expect(result.files.map((file) => file.relativePath)).toEqual(['app/Button.tsx']);
  });

  it('rejects a root that is not a directory', async () => {
    const rootDir = await createTempRepo({ 'package.json': '{}' });

    await expect(
      new RepositoryScanner({ rootDir: `${rootDir}/package.json` }).scan(),
    ).rejects.toThrow(/not a directory/);
  });

  it('rejects a root that does not exist', async () => {
    await expect(new RepositoryScanner({ rootDir: '/definitely/not/here' }).scan()).rejects.toThrow(
      /does not exist/,
    );
  });
});
