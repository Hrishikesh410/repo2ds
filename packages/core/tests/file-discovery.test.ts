import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_EXCLUDE,
  DEFAULT_INCLUDE,
  DiagnosticCollector,
  FileDiscovery,
} from '../src/index.js';
import { createTempRepo, removeTempRepos } from './helpers/temp-repo.js';

afterEach(removeTempRepos);

async function discover(
  rootDir: string,
  overrides: { include?: string[]; exclude?: string[]; maxFileSizeKb?: number } = {},
) {
  const diagnostics = new DiagnosticCollector();
  const files = await new FileDiscovery({
    rootDir,
    include: overrides.include ?? DEFAULT_INCLUDE,
    exclude: overrides.exclude ?? DEFAULT_EXCLUDE,
    maxFileSizeKb: overrides.maxFileSizeKb ?? 512,
    diagnostics,
  }).discover();

  return { files, diagnostics };
}

describe('FileDiscovery', () => {
  it('finds source files and ignores the default noise directories', async () => {
    const rootDir = await createTempRepo({
      'src/Button.tsx': 'export const Button = () => null;',
      'src/utils/format.ts': 'export const format = () => 1;',
      'src/legacy/old.jsx': 'export default null;',
      'node_modules/pkg/index.js': 'module.exports = {};',
      'dist/Button.js': 'export const Button = null;',
      'build/Button.js': 'export const Button = null;',
      '.next/page.js': 'export default null;',
      'src/Button.test.tsx': 'it("x", () => {});',
      'src/Button.stories.tsx': 'export default {};',
      'src/types.d.ts': 'export declare const x: number;',
      'README.md': '# hello',
    });

    const { files } = await discover(rootDir);

    expect(files.map((file) => file.relativePath)).toEqual([
      'src/Button.tsx',
      'src/legacy/old.jsx',
      'src/utils/format.ts',
    ]);
  });

  it('returns files in a stable order regardless of file system order', async () => {
    const rootDir = await createTempRepo({
      'src/z.ts': 'export const z = 1;',
      'src/a.ts': 'export const a = 1;',
      'src/m/b.ts': 'export const b = 1;',
    });

    const first = await discover(rootDir);
    const second = await discover(rootDir);

    expect(first.files.map((file) => file.relativePath)).toEqual([
      'src/a.ts',
      'src/m/b.ts',
      'src/z.ts',
    ]);
    expect(second.files).toEqual(first.files);
  });

  it('records file sizes', async () => {
    const rootDir = await createTempRepo({ 'src/a.ts': 'export const a = 1;' });

    const { files } = await discover(rootDir);

    expect(files[0]?.sizeBytes).toBe('export const a = 1;'.length);
  });

  it('skips files above the size limit with a diagnostic', async () => {
    const rootDir = await createTempRepo({
      'src/huge.ts': `export const big = "${'x'.repeat(3000)}";`,
      'src/small.ts': 'export const small = 1;',
    });

    const { files, diagnostics } = await discover(rootDir, { maxFileSizeKb: 1 });

    expect(files.map((file) => file.relativePath)).toEqual(['src/small.ts']);
    expect(diagnostics.all()).toEqual([
      expect.objectContaining({
        status: 'skipped',
        code: 'file-too-large',
        filePath: 'src/huge.ts',
      }),
    ]);
  });

  it('skips matched files it cannot parse and says why', async () => {
    const rootDir = await createTempRepo({
      'src/theme.css': '.a { color: red; }',
      'src/Button.tsx': 'export const Button = () => null;',
    });

    const { files, diagnostics } = await discover(rootDir, { include: ['src/**/*'] });

    expect(files.map((file) => file.relativePath)).toEqual(['src/Button.tsx']);
    expect(diagnostics.all()).toEqual([
      expect.objectContaining({ code: 'unsupported-extension', filePath: 'src/theme.css' }),
    ]);
  });

  it('honours custom include patterns', async () => {
    const rootDir = await createTempRepo({
      'app/Button.tsx': 'export const Button = () => null;',
      'scripts/build.ts': 'export const build = 1;',
    });

    const { files } = await discover(rootDir, { include: ['app/**/*.tsx'] });

    expect(files.map((file) => file.relativePath)).toEqual(['app/Button.tsx']);
  });

  it('returns nothing when a repository has no source files', async () => {
    const rootDir = await createTempRepo({ 'README.md': '# empty' });

    const { files, diagnostics } = await discover(rootDir);

    expect(files).toEqual([]);
    expect(diagnostics.size).toBe(0);
  });
});
