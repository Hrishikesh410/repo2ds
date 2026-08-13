import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnalysisResult } from '@repo2ds/core';
import { AnalysisPipeline, DiagnosticCollector, detectStylingSystems } from '@repo2ds/core';
import { ReactAdapter } from '@repo2ds/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { TailwindStyleAdapter } from '../src/index.js';

const rootDir = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../fixtures/react-tailwind',
);

let result: AnalysisResult;

beforeAll(async () => {
  const diagnostics = new DiagnosticCollector();

  result = await new AnalysisPipeline({
    rootDir,
    diagnostics,
    adapters: [
      new ReactAdapter({
        rootDir,
        diagnostics,
        classStyleAdapter: new TailwindStyleAdapter(),
      }),
    ],
  }).run();
});

describe('a Tailwind React project', () => {
  it('detects Tailwind from the dependency and the config file', () => {
    const detection = detectStylingSystems({ manifest: result.manifest, rootDir });

    expect(detection.systems).toEqual(['tailwind']);
    expect(detection.evidence).toEqual([
      'tailwindcss found in package.json',
      'tailwind.config.js found',
    ]);
  });

  it('finds the components', () => {
    expect(result.components.map((component) => component.name)).toEqual([
      'Badge',
      'Button',
      'Card',
    ]);
  });

  it('reads utilities from a plain class attribute', () => {
    const heading = result.components.find((component) => component.name === 'Card');

    expect(
      heading?.styles
        .filter((style) => style.origin?.startsWith('text-lg'))
        .map((style) => [style.property, style.value, style.source]),
    ).toEqual([['font-size', 18, 'tailwind']]);
  });

  it('reads static utilities out of template literals and helper calls', () => {
    const button = result.components.find((component) => component.name === 'Button');
    const card = result.components.find((component) => component.name === 'Card');

    expect(button?.styles.map((style) => style.origin)).toContain('px-4');
    expect(card?.styles.map((style) => style.origin)).toContain('gap-4');
  });

  it('reads utilities from both branches of a conditional class name', () => {
    const badge = result.components.find((component) => component.name === 'Badge');

    expect(badge?.styles.filter((style) => style.value === 'green-100')).toHaveLength(1);
    expect(badge?.styles.filter((style) => style.value === 'gray-100')).toHaveLength(1);
  });

  it('infers tokens from repeated utilities', () => {
    const spacing = result.tokenCandidates.filter((candidate) => candidate.category === 'spacing');

    expect(spacing.map((candidate) => [candidate.value, candidate.usageCount])).toEqual([
      [16, 5],
      [8, 3],
    ]);
  });

  it('infers radius and typography tokens from utilities', () => {
    const byCategory = (category: string) =>
      result.tokenCandidates
        .filter((candidate) => candidate.category === category)
        .map((candidate) => [candidate.value, candidate.usageCount]);

    expect(byCategory('radius')).toEqual([[8, 4]]);
    expect(byCategory('typography')).toEqual([
      [14, 4],
      [600, 2],
    ]);
  });

  it('does not turn layout utilities into tokens', () => {
    expect(result.tokenCandidates.some((candidate) => candidate.category === 'unknown')).toBe(
      false,
    );
    expect(result.styles.some((style) => style.property === 'display')).toBe(true);
  });

  it('reports Tailwind colours as their token names', () => {
    const colours = result.tokenCandidates.filter((candidate) => candidate.category === 'color');

    expect(colours.map((candidate) => [candidate.value, candidate.usageCount])).toEqual([
      ['gray-900', 2],
    ]);
  });
});
