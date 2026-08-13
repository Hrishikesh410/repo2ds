import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagnosticCollector, readProjectManifest } from '../src/index.js';
import { createTempRepo, removeTempRepos } from './helpers/temp-repo.js';

afterEach(removeTempRepos);

describe('readProjectManifest', () => {
  it('merges runtime, dev and peer dependencies', async () => {
    const rootDir = await createTempRepo({
      'package.json': JSON.stringify({
        name: 'example-app',
        version: '2.1.0',
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
        peerDependencies: { 'react-dom': '^18.0.0' },
      }),
    });
    const diagnostics = new DiagnosticCollector();

    const manifest = await readProjectManifest(rootDir, diagnostics);

    expect(manifest.name).toBe('example-app');
    expect(manifest.version).toBe('2.1.0');
    expect(Object.keys(manifest.dependencies).sort()).toEqual(['react', 'react-dom', 'typescript']);
    expect(diagnostics.size).toBe(0);
  });

  it('falls back to the directory name when there is no manifest', async () => {
    const rootDir = await createTempRepo({ 'src/a.ts': 'export const a = 1;' });

    const diagnostics = new DiagnosticCollector();
    const manifest = await readProjectManifest(rootDir, diagnostics);

    expect(manifest.name).toBe(path.basename(rootDir));
    expect(manifest.dependencies).toEqual({});
    expect(diagnostics.all()).toEqual([
      expect.objectContaining({ status: 'warning', code: 'manifest-missing' }),
    ]);
  });

  it('warns instead of throwing on malformed JSON', async () => {
    const rootDir = await createTempRepo({ 'package.json': '{ "name": ' });

    const diagnostics = new DiagnosticCollector();
    const manifest = await readProjectManifest(rootDir, diagnostics);

    expect(manifest.dependencies).toEqual({});
    expect(diagnostics.all()).toEqual([
      expect.objectContaining({ status: 'warning', code: 'manifest-invalid' }),
    ]);
  });

  it('ignores non-string dependency ranges', async () => {
    const rootDir = await createTempRepo({
      'package.json': JSON.stringify({ name: 'x', dependencies: { react: 18, ok: '^1.0.0' } }),
    });

    const manifest = await readProjectManifest(rootDir, new DiagnosticCollector());

    expect(manifest.dependencies).toEqual({ ok: '^1.0.0' });
  });
});
