import { DiagnosticCollector } from '@repo2ds/core';
import { describe, expect, it } from 'vitest';
import { ReactAdapter } from '../src/index.js';
import { parseSource } from './helpers/parse.js';

function adapter() {
  return new ReactAdapter({ rootDir: '/repo', diagnostics: new DiagnosticCollector() });
}

function discover(source: string, filePath = 'src/Component.tsx') {
  return adapter().discoverComponents(parseSource(filePath, source));
}

describe('React component discovery', () => {
  it('finds a function declaration returning JSX', () => {
    const components = discover(`
      function Button(props: ButtonProps) {
        return <button>Submit</button>;
      }
    `);

    expect(components).toHaveLength(1);
    expect(components[0]).toMatchObject({
      name: 'Button',
      exportType: 'unknown',
      framework: 'react',
      filePath: 'src/Component.tsx',
    });
  });

  it.each([
    ['const Button = (props: P) => <button />;', 'unknown'],
    ['export function Button() { return <button />; }', 'named'],
    ['export const Button = () => <button />;', 'named'],
    ['export default function Button() { return <button />; }', 'default'],
  ])('supports %s', (source, exportType) => {
    const components = discover(source);

    expect(components).toHaveLength(1);
    expect(components[0]?.name).toBe('Button');
    expect(components[0]?.exportType).toBe(exportType);
  });

  it('records default exports declared separately', () => {
    const components = discover(`
      const Button = () => <button />;
      export default Button;
    `);

    expect(components[0]?.exportType).toBe('default');
  });

  it('records components exported through an export list', () => {
    const components = discover(`
      const Button = () => <button />;
      export { Button };
    `);

    expect(components[0]?.exportType).toBe('named');
  });

  it('names a component after the alias it is exported under', () => {
    const components = discover(`
      const ButtonWithTheme = () => <button />;
      export { ButtonWithTheme as Button };
    `);

    expect(components.map((component) => [component.name, component.exportType])).toEqual([
      ['Button', 'named'],
    ]);
  });

  it('treats an alias of default as the default export', () => {
    const components = discover(`
      const Button = () => <button />;
      export { Button as default };
    `);

    expect(components[0]?.exportType).toBe('default');
  });

  it('ignores an export list that forwards another file', () => {
    const components = discover(`
      const Button = () => <button />;
      export { Card as Button } from './card';
    `);

    expect(components.map((component) => [component.name, component.exportType])).toEqual([
      ['Button', 'unknown'],
    ]);
  });

  it('finds components returning nested JSX', () => {
    const components = discover(`
      export function Layout() {
        return (
          <div>
            <span>Hello</span>
          </div>
        );
      }
    `);

    expect(components.map((component) => component.name)).toEqual(['Layout']);
  });

  it('finds class components extending React.Component', () => {
    const components = discover(`
      export class Modal extends React.Component<ModalProps> {
        render() {
          return <div />;
        }
      }
    `);

    expect(components.map((component) => component.name)).toEqual(['Modal']);
  });

  it('finds components wrapped in memo and forwardRef', () => {
    const components = discover(`
      export const Badge = memo(function Badge() { return <span />; });
      export const Field = React.forwardRef((props, ref) => <input ref={ref} />);
    `);

    expect(components.map((component) => component.name)).toEqual(['Badge', 'Field']);
  });

  it('reports a wrapped component under the name the file exports', () => {
    const components = discover(`
      function CardBase({ title }: { title: string }) {
        return <div>{title}</div>;
      }
      export const Card = memo(CardBase);
    `);

    expect(components.map((component) => component.name)).toEqual(['Card']);
    expect(components[0]?.exportType).toBe('named');
  });

  it('treats a component wrapped on its way out as the default export', () => {
    const components = discover(`
      function Button() { return <button />; }
      export default memo(Button);
    `);

    expect(components[0]).toMatchObject({ name: 'Button', exportType: 'default' });
  });

  it('records where a component is declared', () => {
    const components = discover('\nexport function Button() {\n  return <button />;\n}\n');

    expect(components[0]?.sourceLocation).toEqual({ line: 2, column: 17 });
  });

  it('ignores functions that do not return JSX', () => {
    const components = discover(`
      export function formatCurrency(value: number) { return '$' + value; }
      export function Titlecase(value: string) { return value.toUpperCase(); }
      export const useToggle = () => [true, () => {}];
    `);

    expect(components).toEqual([]);
  });

  it('ignores lower case functions that do return JSX', () => {
    const components = discover('export function renderRow() { return <tr />; }');

    expect(components).toEqual([]);
  });

  it('ignores constants and plain classes', () => {
    const components = discover(`
      export const COLORS = { primary: '#2563EB' };
      export const NAV_ITEMS = [<a href="/" />];
      export const RENDER_ROW = () => <tr />;
      export class ApiClient { request() { return null; } }
    `);

    expect(components).toEqual([]);
  });

  it('accepts short names and acronyms', () => {
    const components = discover(`
      export const CTA = () => <a href="/" />;
      export const C = () => <div />;
    `);

    expect(components.map((component) => component.name)).toEqual(['CTA', 'C']);
  });

  it('does not report helpers nested inside a component', () => {
    const components = discover(`
      export function Table() {
        const Row = () => <tr />;
        return <table><Row /></table>;
      }
    `);

    expect(components.map((component) => component.name)).toEqual(['Table']);
  });

  it('finds several components in one file', () => {
    const components = discover(`
      export function Card() { return <div />; }
      export const CardHeader = () => <header />;
      export class CardFooter extends React.PureComponent { render() { return <footer />; } }
    `);

    expect(components.map((component) => component.name)).toEqual([
      'Card',
      'CardHeader',
      'CardFooter',
    ]);
  });
});

describe('ReactAdapter.canHandle', () => {
  it('claims files containing JSX', () => {
    expect(adapter().canHandle(parseSource('a.tsx', 'export const A = () => <div />;'))).toBe(true);
  });

  it('claims files importing react without JSX', () => {
    expect(adapter().canHandle(parseSource('a.ts', "import { useState } from 'react';"))).toBe(
      true,
    );
  });

  it('declines plain TypeScript files', () => {
    expect(adapter().canHandle(parseSource('a.ts', 'export const a = 1;'))).toBe(false);
  });

  it('declines React Native files so the React Native adapter can claim them', () => {
    const file = parseSource(
      'a.tsx',
      "import { View } from 'react-native';\nexport const A = () => <View />;",
    );

    expect(adapter().canHandle(file)).toBe(false);
  });
});
