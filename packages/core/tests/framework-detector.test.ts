import { describe, expect, it } from 'vitest';
import type { ProjectManifest } from '../src/index.js';
import { detectFrameworksFromManifest, resolveFrameworks } from '../src/index.js';

function manifest(dependencies: Record<string, string>): ProjectManifest {
  return { name: 'example', dependencies };
}

describe('detectFrameworksFromManifest', () => {
  it('detects React from react-dom', () => {
    const detection = detectFrameworksFromManifest(
      manifest({ react: '^18.0.0', 'react-dom': '^18.0.0' }),
    );

    expect(detection.frameworks).toEqual(['react']);
    expect(detection.mixed).toBe(false);
    expect(detection.evidence).toContain('package.json depends on react-dom');
  });

  it('detects React from a web meta-framework', () => {
    expect(detectFrameworksFromManifest(manifest({ next: '^15.0.0' })).frameworks).toEqual([
      'react',
    ]);
  });

  it('detects React Native from react-native', () => {
    const detection = detectFrameworksFromManifest(
      manifest({ react: '^18.0.0', 'react-native': '0.76.0' }),
    );

    expect(detection.frameworks).toEqual(['react-native']);
    expect(detection.mixed).toBe(false);
  });

  it('detects React Native from expo', () => {
    expect(detectFrameworksFromManifest(manifest({ expo: '^52.0.0' })).frameworks).toEqual([
      'react-native',
    ]);
  });

  it('reports a mixed repository when both are present', () => {
    const detection = detectFrameworksFromManifest(
      manifest({ 'react-dom': '^18.0.0', 'react-native': '0.76.0' }),
    );

    expect(detection.frameworks).toEqual(['react', 'react-native']);
    expect(detection.mixed).toBe(true);
  });

  it('treats a bare react dependency as React', () => {
    expect(detectFrameworksFromManifest(manifest({ react: '^18.0.0' })).frameworks).toEqual([
      'react',
    ]);
  });

  it('detects nothing when no framework dependency exists', () => {
    const detection = detectFrameworksFromManifest(manifest({ lodash: '^4.0.0' }));

    expect(detection.frameworks).toEqual([]);
    expect(detection.evidence).toEqual([]);
  });
});

describe('resolveFrameworks', () => {
  it('lets configuration override detection', () => {
    const detection = resolveFrameworks('react-native', manifest({ 'react-dom': '^18.0.0' }));

    expect(detection.frameworks).toEqual(['react-native']);
    expect(detection.evidence).toEqual(['framework set to "React Native" in configuration']);
  });

  it('defers to detection when set to auto', () => {
    expect(resolveFrameworks('auto', manifest({ 'react-dom': '^18.0.0' })).frameworks).toEqual([
      'react',
    ]);
  });
});
