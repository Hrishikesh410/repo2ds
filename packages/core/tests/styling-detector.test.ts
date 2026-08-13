import { describe, expect, it } from 'vitest';
import type { ProjectManifest } from '../src/index.js';
import { detectStylingSystems } from '../src/index.js';

function manifest(dependencies: Record<string, string>): ProjectManifest {
  return { name: 'app', version: '1.0.0', dependencies };
}

function detect(dependencies: Record<string, string>, files: string[] = []) {
  return detectStylingSystems({
    manifest: manifest(dependencies),
    rootDir: '/repo',
    fileExists: (absolutePath) => files.some((file) => absolutePath.endsWith(file)),
  });
}

describe('detectStylingSystems', () => {
  it('detects Tailwind from the dependency', () => {
    expect(detect({ tailwindcss: '^3.4.0' })).toEqual({
      systems: ['tailwind'],
      evidence: ['tailwindcss found in package.json'],
    });
  });

  it('detects Tailwind from a config file alone', () => {
    expect(detect({}, ['tailwind.config.ts'])).toEqual({
      systems: ['tailwind'],
      evidence: ['tailwind.config.ts found'],
    });
  });

  it('detects NativeWind', () => {
    expect(detect({ nativewind: '^4.0.0' }).systems).toEqual(['nativewind']);
  });

  it('reports both when a project uses NativeWind on top of Tailwind', () => {
    const detection = detect({ nativewind: '^4.0.0', tailwindcss: '^3.4.0' }, [
      'tailwind.config.js',
    ]);

    expect(detection.systems).toEqual(['nativewind', 'tailwind']);
    expect(detection.evidence).toEqual([
      'nativewind found in package.json',
      'tailwindcss found in package.json',
      'tailwind.config.js found',
    ]);
  });

  it('reports nothing for a project that uses neither', () => {
    expect(detect({ react: '^18.0.0' })).toEqual({ systems: [], evidence: [] });
  });

  it('does not report the same system twice', () => {
    expect(detect({ tailwindcss: '^3.4.0' }, ['tailwind.config.js']).systems).toEqual(['tailwind']);
  });

  it('detects a system declared by a workspace package rather than the root', () => {
    const detection = detectStylingSystems({
      manifest: manifest({ typescript: '^5.9.3' }),
      rootDir: '/repo',
      fileExists: () => false,
      workspace: {
        packages: [
          { filePath: 'packages/ui/package.json', dependencies: { tailwindcss: '^3.4.0' } },
          { filePath: 'packages/mobile/package.json', dependencies: { nativewind: '^4.0.0' } },
        ],
        tailwindConfigs: ['packages/ui/tailwind.config.js'],
      },
    });

    expect(detection.systems).toEqual(['nativewind', 'tailwind']);
    expect(detection.evidence).toEqual([
      'tailwindcss found in packages/ui/package.json',
      'nativewind found in packages/mobile/package.json',
      'packages/ui/tailwind.config.js found',
    ]);
  });
});
