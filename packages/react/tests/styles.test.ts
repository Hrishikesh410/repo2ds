import type { StyleUsage } from '@repo2ds/core';
import { DiagnosticCollector } from '@repo2ds/core';
import { describe, expect, it } from 'vitest';
import { ReactAdapter, parseCssDeclarations } from '../src/index.js';
import { parseSource } from './helpers/parse.js';

function extractStyles(
  source: string,
  options: { css?: Record<string, string> } = {},
): { styles: StyleUsage[]; diagnostics: DiagnosticCollector } {
  const diagnostics = new DiagnosticCollector();
  const adapter = new ReactAdapter({
    rootDir: '/repo',
    diagnostics,
    readTextFile: (absolutePath) => options.css?.[absolutePath],
  });

  return { styles: adapter.extractStyles(parseSource('src/Button.tsx', source)), diagnostics };
}

describe('React inline styles', () => {
  it('extracts static declarations', () => {
    const { styles } = extractStyles(`
      export function Button() {
        return <div style={{ padding: 16, margin: 8, borderRadius: 8, color: '#FFFFFF' }} />;
      }
    `);

    expect(styles.map((style) => [style.property, style.value, style.source])).toEqual([
      ['padding', 16, 'inline'],
      ['margin', 8, 'inline'],
      ['borderRadius', 8, 'inline'],
      ['color', '#FFFFFF', 'inline'],
    ]);
  });

  it('attributes styles to the component they belong to', () => {
    const { styles } = extractStyles(`
      export function Card() { return <div style={{ padding: 16 }} />; }
      export const Chip = () => <span style={{ padding: 4 }} />;
    `);

    expect(styles.map((style) => [style.componentName, style.value])).toEqual([
      ['Card', 16],
      ['Chip', 4],
    ]);
  });

  it('records where each declaration was written', () => {
    const { styles } = extractStyles('\nexport const A = () => <div style={{ padding: 16 }} />;\n');

    expect(styles[0]).toMatchObject({
      filePath: 'src/Button.tsx',
      location: { line: 2, column: 38 },
    });
  });

  it('extracts both branches of a conditional value', () => {
    const { styles } = extractStyles(`
      export function Button({ primary }) {
        return <button style={{ color: primary ? '#FFFFFF' : '#111827' }} />;
      }
    `);

    expect(styles.map((style) => style.value)).toEqual(['#FFFFFF', '#111827']);
    expect(styles.every((style) => style.dynamic === undefined)).toBe(true);
  });

  it('handles negative and template literal values', () => {
    const { styles } = extractStyles(
      'export const A = () => <div style={{ marginTop: -8, fontFamily: `Inter` }} />;',
    );

    expect(styles.map((style) => style.value)).toEqual([-8, 'Inter']);
  });

  it('flattens nested style objects', () => {
    const { styles } = extractStyles(
      'export const A = () => <div style={{ shadowOffset: { width: 0, height: 2 } }} />;',
    );

    expect(styles.map((style) => style.property)).toEqual([
      'shadowOffset.width',
      'shadowOffset.height',
    ]);
  });

  it('records dynamic values without evaluating them', () => {
    const { styles, diagnostics } = extractStyles(`
      export function Button({ size }) {
        return <div style={{ padding: getSpacing(size), margin: spacing[size] }} />;
      }
    `);

    expect(styles.map((style) => [style.property, style.value, style.dynamic])).toEqual([
      ['padding', 'getSpacing(size)', true],
      ['margin', 'spacing[size]', true],
    ]);
    expect(diagnostics.all().map((diagnostic) => diagnostic.code)).toEqual([
      'dynamic-style',
      'dynamic-style',
    ]);
  });

  it('skips spreads in style objects', () => {
    const { styles, diagnostics } = extractStyles(
      'export const A = () => <div style={{ ...base, padding: 4 }} />;',
    );

    expect(styles.map((style) => style.property)).toEqual(['padding']);
    expect(diagnostics.all()[0]).toMatchObject({ status: 'skipped', code: 'dynamic-style' });
  });

  it('reads object literals inside a style array', () => {
    const { styles } = extractStyles(
      'export const A = () => <div style={[{ padding: 4 }, { margin: 2 }]} />;',
    );

    expect(styles.map((style) => style.value)).toEqual([4, 2]);
  });
});

describe('React stylesheet imports', () => {
  it('extracts declarations from an imported CSS module', () => {
    const { styles } = extractStyles(
      `
        import styles from './Button.module.css';
        export function Button() { return <button className={styles.button} />; }
      `,
      {
        css: {
          '/repo/src/Button.module.css':
            '.button { padding: 16px; border-radius: 8px; color: #FFFFFF; }',
        },
      },
    );

    expect(styles).toEqual([
      expect.objectContaining({
        property: 'padding',
        value: '16px',
        source: 'stylesheet',
        filePath: 'src/Button.module.css',
        origin: 'src/Button.module.css .button',
        componentName: 'Button',
      }),
      expect.objectContaining({ property: 'border-radius', value: '8px' }),
      expect.objectContaining({ property: 'color', value: '#FFFFFF' }),
    ]);
  });

  it('extracts declarations from a plain CSS import', () => {
    const { styles } = extractStyles(
      `
        import './Button.css';
        export function Button() { return <button />; }
      `,
      { css: { '/repo/src/Button.css': '.button { padding: 8px; }' } },
    );

    expect(styles.map((style) => [style.property, style.value])).toEqual([['padding', '8px']]);
  });

  it('warns when an imported stylesheet cannot be read', () => {
    const { styles, diagnostics } = extractStyles(`
      import './missing.css';
      export function Button() { return <button />; }
    `);

    expect(styles).toEqual([]);
    expect(diagnostics.all()).toEqual([
      expect.objectContaining({ status: 'warning', code: 'stylesheet-unreadable' }),
    ]);
  });

  it('ignores stylesheets from packages', () => {
    const { styles, diagnostics } = extractStyles(`
      import 'normalize.css';
      export function Button() { return <button />; }
    `);

    expect(styles).toEqual([]);
    expect(diagnostics.size).toBe(0);
  });
});

describe('parseCssDeclarations', () => {
  it('reads declarations and ignores comments', () => {
    const declarations = parseCssDeclarations(`
      /* a comment { padding: 99px } */
      .button {
        padding: 16px;
        color: #fff;
      }
    `);

    expect(declarations).toEqual([
      {
        selector: '.button',
        property: 'padding',
        value: '16px',
        dynamic: false,
        location: { line: 4, column: 9 },
      },
      {
        selector: '.button',
        property: 'color',
        value: '#fff',
        dynamic: false,
        location: { line: 5, column: 9 },
      },
    ]);
  });

  it('keeps line numbers accurate after a comment that spans lines', () => {
    const declarations = parseCssDeclarations(
      ['/* first', '   second', '   third */', '.a {', '  padding: 8px;', '}'].join('\n'),
    );

    expect(declarations[0]?.location).toEqual({ line: 5, column: 3 });
  });

  it('reads declarations inside media queries', () => {
    const declarations = parseCssDeclarations('@media (min-width: 40em) { .a { padding: 24px; } }');

    expect(declarations.map((declaration) => declaration.value)).toEqual(['24px']);
  });

  it('marks variable driven values as dynamic', () => {
    const declarations = parseCssDeclarations(
      '.a { color: var(--brand); padding: $spacing-4; margin: @gutter; }',
    );

    expect(declarations.every((declaration) => declaration.dynamic)).toBe(true);
  });

  it('ignores malformed input instead of throwing', () => {
    expect(parseCssDeclarations('.a { color }')).toEqual([]);
    expect(parseCssDeclarations('')).toEqual([]);
    expect(parseCssDeclarations('not css at all')).toEqual([]);
  });
});

describe('styles Repo2DS cannot read', () => {
  it('warns that CSS-in-JS template literals were not parsed', () => {
    const { styles, diagnostics } = extractStyles(`
      import styled from 'styled-components';
      const Root = styled.button\`padding: 16px;\`;
      export function Button() { return <Root />; }
    `);

    expect(styles).toEqual([]);
    expect(diagnostics.all()[0]).toMatchObject({
      code: 'css-in-js-unsupported',
      filePath: 'src/Button.tsx',
    });
  });

  it('stays quiet when a CSS-in-JS package is imported but no template is tagged', () => {
    const { diagnostics } = extractStyles(`
      import { ThemeProvider } from 'styled-components';
      export function Button() { return <ThemeProvider><button /></ThemeProvider>; }
    `);

    expect(diagnostics.all()).toEqual([]);
  });

  it('warns that an aliased stylesheet import was not resolved', () => {
    const { diagnostics } = extractStyles(`
      import '@/styles/theme.css';
      export function Button() { return <button className="button" />; }
    `);

    expect(diagnostics.all()[0]).toMatchObject({ code: 'stylesheet-alias-unresolved' });
  });

  it("says nothing about a dependency's own stylesheet", () => {
    const { diagnostics } = extractStyles(`
      import 'bootstrap/dist/css/bootstrap.css';
      export function Button() { return <button />; }
    `);

    expect(diagnostics.all()).toEqual([]);
  });
});
