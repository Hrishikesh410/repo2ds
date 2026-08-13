import { DiagnosticCollector } from '@repo2ds/core';
import { describe, expect, it } from 'vitest';
import {
  ReactAdapter,
  collectCustomProperties,
  parseCssDeclarations,
  resolveCssValue,
} from '../src/index.js';
import { parseSource } from './helpers/parse.js';

const STYLESHEET = `
  :root {
    --surface: #ffffff;
    --text: #1c1f24;
    --brand: var(--accent, #2563eb);
    --space-4: 16px;
    --alias: var(--surface);
  }
  .card {
    background: var(--surface);
    color: var(--text);
    padding: var(--space-4);
    border-color: var(--not-declared);
  }
`;

function variablesOf(css: string) {
  return collectCustomProperties(parseCssDeclarations(css));
}

describe('CSS custom properties', () => {
  it('indexes declared custom properties', () => {
    expect(variablesOf(STYLESHEET).get('--surface')).toBe('#ffffff');
  });

  it('resolves a reference to the declared value', () => {
    expect(resolveCssValue('var(--surface)', variablesOf(STYLESHEET))).toEqual({
      value: '#ffffff',
      dynamic: false,
    });
  });

  it('follows a chain of references', () => {
    expect(resolveCssValue('var(--alias)', variablesOf(STYLESHEET)).value).toBe('#ffffff');
  });

  it('uses the declared fallback when the variable is defined elsewhere', () => {
    expect(resolveCssValue('var(--brand)', variablesOf(STYLESHEET)).value).toBe('#2563eb');
  });

  it('marks unresolvable references as dynamic', () => {
    expect(resolveCssValue('var(--not-declared)', variablesOf(STYLESHEET))).toEqual({
      value: 'var(--not-declared)',
      dynamic: true,
    });
  });

  it('leaves values that are not references alone', () => {
    expect(resolveCssValue('16px', variablesOf(STYLESHEET))).toEqual({
      value: '16px',
      dynamic: false,
    });
  });

  it('counts variable references as usages of the underlying value', () => {
    const diagnostics = new DiagnosticCollector();
    const adapter = new ReactAdapter({
      rootDir: '/repo',
      diagnostics,
      readTextFile: () => STYLESHEET,
    });

    const styles = adapter.extractStyles(
      parseSource(
        'src/Card.tsx',
        'import \'./card.css\';\nexport function Card() { return <div className="card" />; }',
      ),
    );

    const backgrounds = styles.filter((style) => style.property === 'background');
    expect(backgrounds.map((style) => style.value)).toEqual(['#ffffff']);
    expect(styles.filter((style) => style.dynamic)).toEqual([
      expect.objectContaining({ property: 'border-color', value: 'var(--not-declared)' }),
    ]);
  });
});
