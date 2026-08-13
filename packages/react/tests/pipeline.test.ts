import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnalysisPipeline, DiagnosticCollector } from '@repo2ds/core';
import { describe, expect, it } from 'vitest';
import { ReactAdapter } from '../src/index.js';

function fixturePath(name: string): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  return path.resolve(here, '../../../fixtures', name);
}

async function analyse(fixture: string) {
  const rootDir = fixturePath(fixture);
  const diagnostics = new DiagnosticCollector();

  return new AnalysisPipeline({
    rootDir,
    diagnostics,
    adapters: [new ReactAdapter({ rootDir, diagnostics })],
  }).run();
}

describe('AnalysisPipeline with the React adapter', () => {
  it('builds a component inventory from the react-basic fixture', async () => {
    const result = await analyse('react-basic');

    expect(result.detection.frameworks).toEqual(['react']);
    expect(result.components.map((component) => component.name)).toEqual([
      'Button',
      'Card',
      'Input',
      'Modal',
    ]);
    expect(result.report.statistics.components).toBe(4);
    expect(result.report.statistics.filesScanned).toBe(5);
  });

  it('attaches props to the component that declares them', async () => {
    const result = await analyse('react-basic');
    const button = result.components.find((component) => component.name === 'Button');

    expect(button?.exportType).toBe('named');
    expect(button?.props).toEqual([
      { name: 'label', type: 'string', required: true, rawType: 'string' },
      {
        name: 'variant',
        type: 'enum',
        required: false,
        enumValues: ['primary', 'secondary'],
        rawType: "'primary' | 'secondary'",
        defaultValue: 'primary',
      },
      {
        name: 'size',
        type: 'enum',
        required: false,
        enumValues: ['sm', 'md', 'lg'],
        rawType: "'sm' | 'md' | 'lg'",
      },
      { name: 'disabled', type: 'boolean', required: false, rawType: 'boolean' },
      { name: 'onPress', type: 'function', required: false, rawType: '() => void' },
    ]);
  });

  it('attaches styles to the component that declares them', async () => {
    const result = await analyse('react-basic');
    const card = result.components.find((component) => component.name === 'Card');

    expect(card?.styles.map((style) => [style.property, style.value])).toEqual([
      ['padding', 16],
      ['margin', 8],
      ['borderRadius', 12],
      ['backgroundColor', '#FFFFFF'],
      ['fontSize', 16],
      ['fontWeight', '600'],
      ['color', '#111827'],
      ['fontSize', 14],
      ['color', '#6B7280'],
    ]);
  });

  it('recognises the default exported component', async () => {
    const result = await analyse('react-basic');

    expect(result.components.find((component) => component.name === 'Input')?.exportType).toBe(
      'default',
    );
  });

  it('collects every style usage for token inference', async () => {
    const result = await analyse('react-basic');

    expect(result.styles.length).toBeGreaterThan(20);
    expect(result.styles.every((style) => style.filePath?.startsWith('src/'))).toBe(true);
  });

  it('passes collected styles to the token inference function', async () => {
    const rootDir = fixturePath('react-basic');
    const diagnostics = new DiagnosticCollector();

    const result = await new AnalysisPipeline({
      rootDir,
      diagnostics,
      adapters: [new ReactAdapter({ rootDir, diagnostics })],
      inferTokens: (styles) => [
        {
          category: 'spacing',
          value: 16,
          usageCount: styles.length,
          locations: [],
          confidence: 1,
          evidence: [],
        },
      ],
    }).run();

    expect(result.tokenCandidates[0]?.usageCount).toBe(result.styles.length);
    expect(result.report.statistics.spacingValues).toBe(1);
  });

  it('produces a report that is stable across runs', async () => {
    const first = await analyse('react-basic');
    const second = await analyse('react-basic');

    expect(JSON.stringify(first.report)).toBe(JSON.stringify(second.report));
  });

  it('honours an explicit framework setting by skipping other adapters', async () => {
    const rootDir = fixturePath('react-basic');
    const diagnostics = new DiagnosticCollector();

    const result = await new AnalysisPipeline({
      rootDir,
      diagnostics,
      config: { framework: 'react-native' },
      adapters: [new ReactAdapter({ rootDir, diagnostics })],
    }).run();

    expect(result.components).toEqual([]);
  });
});
