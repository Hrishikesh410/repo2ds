import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnalysisResult } from '@repo2ds/core';
import { AnalysisPipeline, DiagnosticCollector, detectStylingSystems } from '@repo2ds/core';
import { ReactNativeAdapter } from '@repo2ds/react-native';
import { beforeAll, describe, expect, it } from 'vitest';
import { NativeWindStyleAdapter } from '../src/index.js';

const rootDir = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../fixtures/react-native-nativewind',
);

let result: AnalysisResult;

beforeAll(async () => {
  const diagnostics = new DiagnosticCollector();

  result = await new AnalysisPipeline({
    rootDir,
    diagnostics,
    adapters: [
      new ReactNativeAdapter({
        rootDir,
        diagnostics,
        classStyleAdapter: new NativeWindStyleAdapter(),
      }),
    ],
  }).run();
});

describe('a NativeWind project', () => {
  it('detects NativeWind alongside Tailwind', () => {
    const detection = detectStylingSystems({ manifest: result.manifest, rootDir });

    expect(detection.systems).toEqual(['nativewind', 'tailwind']);
  });

  it('reports React Native components', () => {
    expect(result.components.map((component) => [component.name, component.framework])).toEqual([
      ['Button', 'react-native'],
      ['Card', 'react-native'],
    ]);
  });

  it('reads utility classes as nativewind styles', () => {
    const button = result.components.find((component) => component.name === 'Button');

    expect(
      button?.styles
        .filter((style) => style.source === 'nativewind')
        .map((style) => [style.origin, style.property, style.value]),
    ).toEqual([
      ['px-4', 'padding-left/right', 16],
      ['py-2', 'padding-top/bottom', 8],
      ['rounded-lg', 'border-radius', 8],
      ['bg-blue-600', 'background-color', 'blue-600'],
      ['px-4', 'padding-left/right', 16],
      ['py-2', 'padding-top/bottom', 8],
      ['rounded-lg', 'border-radius', 8],
      ['bg-gray-200', 'background-color', 'gray-200'],
      ['text-sm', 'font-size', 14],
      ['font-semibold', 'font-weight', 600],
      ['text-white', 'color', 'white'],
    ]);
  });

  it('reads utility classes and style sheets from the same component', () => {
    const card = result.components.find((component) => component.name === 'Card');
    const sources = new Set(card?.styles.map((style) => style.source));

    expect([...sources].sort()).toEqual(['nativewind', 'stylesheet']);
  });

  it('groups a utility class with an equal style sheet value', () => {
    const spacing16 = result.tokenCandidates.find(
      (candidate) => candidate.category === 'spacing' && candidate.value === 16,
    );

    expect(spacing16?.usageCount).toBe(5);
    expect(spacing16?.evidence).toContain('Used by 2 components');
  });

  it('reports the typography scale from utilities', () => {
    expect(
      result.tokenCandidates
        .filter((candidate) => candidate.category === 'typography')
        .map((candidate) => [candidate.value, candidate.usageCount]),
    ).toEqual([
      [14, 3],
      [600, 2],
    ]);
  });
});
