import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnalysisResult } from '@repo2ds/core';
import { AnalysisPipeline, DiagnosticCollector } from '@repo2ds/core';
import { ReactAdapter } from '@repo2ds/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { ReactNativeAdapter } from '../src/index.js';

function fixture(name: string): string {
  return path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../fixtures', name);
}

/** Adapters in the order the CLI uses them: most specific first. */
async function analyse(name: string): Promise<AnalysisResult> {
  const rootDir = fixture(name);
  const diagnostics = new DiagnosticCollector();

  return new AnalysisPipeline({
    rootDir,
    diagnostics,
    adapters: [
      new ReactNativeAdapter({ rootDir, diagnostics }),
      new ReactAdapter({ rootDir, diagnostics }),
    ],
  }).run();
}

let result: AnalysisResult;

beforeAll(async () => {
  result = await analyse('react-native-basic');
});

describe('a React Native project', () => {
  it('detects React Native from the manifest', () => {
    expect(result.detection.frameworks).toEqual(['react-native']);
    expect(result.detection.evidence).toEqual(['package.json depends on react-native']);
  });

  it('finds the components and marks them native', () => {
    expect(result.components.map((component) => [component.name, component.framework])).toEqual([
      ['Button', 'react-native'],
      ['Card', 'react-native'],
      ['Screen', 'react-native'],
    ]);
  });

  it('reads props including defaults', () => {
    const card = result.components.find((component) => component.name === 'Card');

    expect(card?.exportType).toBe('default');
    expect(card?.props).toEqual([
      { name: 'title', type: 'string', required: true, rawType: 'string' },
      { name: 'subtitle', type: 'string', required: false, rawType: 'string' },
      {
        name: 'elevation',
        type: 'number',
        required: false,
        rawType: 'number',
        defaultValue: 2,
      },
    ]);
  });

  it('attributes style sheet values to their component', () => {
    const button = result.components.find((component) => component.name === 'Button');

    expect(button?.styles.map((style) => [style.origin, style.property, style.value])).toEqual([
      ['styles.base', 'paddingHorizontal', 16],
      ['styles.base', 'paddingVertical', 8],
      ['styles.base', 'borderRadius', 8],
      ['styles.base', 'alignItems', 'center'],
      ['styles.primary', 'backgroundColor', '#2563EB'],
      ['styles.secondary', 'backgroundColor', '#E5E7EB'],
      ['styles.label', 'fontSize', 14],
      ['styles.label', 'fontWeight', '600'],
      ['styles.label', 'color', '#FFFFFF'],
    ]);
  });

  it('infers tokens from native styles', () => {
    const byCategory = (category: string) =>
      result.tokenCandidates
        .filter((candidate) => candidate.category === category)
        .map((candidate) => [candidate.value, candidate.usageCount]);

    expect(byCategory('color')).toEqual([['#FFFFFF', 3]]);
    expect(byCategory('spacing')).toEqual([
      [16, 3],
      [8, 2],
    ]);
    expect(byCategory('radius')).toEqual([[8, 2]]);
    expect(byCategory('typography')).toEqual([
      [14, 2],
      [600, 2],
    ]);
  });

  it('treats React Native units as plain numbers, with no pixel suffix', () => {
    expect(
      result.tokenCandidates.every((candidate) => !String(candidate.value).includes('px')),
    ).toBe(true);
  });

  it('reports the one value it cannot resolve, and continues', () => {
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        status: 'warning',
        code: 'dynamic-style',
        filePath: 'src/components/Card.tsx',
        detail: 'elevation',
      }),
    ]);
    expect(result.components).toHaveLength(3);
  });
});
