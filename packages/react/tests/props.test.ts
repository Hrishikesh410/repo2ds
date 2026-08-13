import type { PropInfo } from '@repo2ds/core';
import { DiagnosticCollector } from '@repo2ds/core';
import { describe, expect, it } from 'vitest';
import { ReactAdapter } from '../src/index.js';
import { parseSource } from './helpers/parse.js';

function extract(source: string): { props: PropInfo[]; diagnostics: DiagnosticCollector } {
  const diagnostics = new DiagnosticCollector();
  const adapter = new ReactAdapter({ rootDir: '/repo', diagnostics });
  const file = parseSource('src/Button.tsx', source);
  const [component] = adapter.discoverComponents(file);

  return {
    props: component ? adapter.extractProps(component, file).props : [],
    diagnostics,
  };
}

describe('React prop extraction', () => {
  it('reads the props type from a forwardRef type argument', () => {
    const { props } = extract(`
      interface ButtonProps { label: string; variant?: 'primary' | 'secondary' }
      export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
        { label, variant = 'primary' },
        ref,
      ) {
        return <button ref={ref}>{label}</button>;
      });
    `);

    expect(props).toEqual([
      { name: 'label', type: 'string', required: true, rawType: 'string' },
      {
        name: 'variant',
        type: 'enum',
        required: false,
        enumValues: ['primary', 'secondary'],
        rawType: "'primary' | 'secondary'",
        defaultValue: 'primary',
      },
    ]);
  });

  it('reads the props of a component passed to memo by name', () => {
    const { props } = extract(`
      interface CardProps { title: string }
      function CardBase({ title }: CardProps) { return <div>{title}</div>; }
      export const Card = memo(CardBase);
    `);

    expect(props).toEqual([{ name: 'title', type: 'string', required: true, rawType: 'string' }]);
  });

  it('reads an interface referenced by the props parameter', () => {
    const { props } = extract(`
      interface ButtonProps {
        variant?: 'primary' | 'secondary';
        size?: 'sm' | 'md' | 'lg';
        disabled?: boolean;
      }
      export function Button(props: ButtonProps) { return <button />; }
    `);

    expect(props).toEqual([
      {
        name: 'variant',
        type: 'enum',
        required: false,
        enumValues: ['primary', 'secondary'],
        rawType: "'primary' | 'secondary'",
      },
      {
        name: 'size',
        type: 'enum',
        required: false,
        enumValues: ['sm', 'md', 'lg'],
        rawType: "'sm' | 'md' | 'lg'",
      },
      { name: 'disabled', type: 'boolean', required: false, rawType: 'boolean' },
    ]);
  });

  it('reads a type alias', () => {
    const { props } = extract(`
      type ButtonProps = {
        variant?: 'primary' | 'secondary';
      };
      export const Button = (props: ButtonProps) => <button />;
    `);

    expect(props).toEqual([
      {
        name: 'variant',
        type: 'enum',
        required: false,
        enumValues: ['primary', 'secondary'],
        rawType: "'primary' | 'secondary'",
      },
    ]);
  });

  it('reads props from a destructured parameter', () => {
    const { props } = extract(`
      interface ButtonProps { variant?: 'primary'; disabled?: boolean }
      export function Button({ variant, disabled }: ButtonProps) { return <button />; }
    `);

    expect(props.map((prop) => prop.name)).toEqual(['variant', 'disabled']);
  });

  it('records defaults taken from destructuring', () => {
    const { props } = extract(`
      interface ButtonProps { variant?: 'primary' | 'secondary'; count?: number; open?: boolean }
      export function Button({ variant = 'primary', count = 3, open = false }: ButtonProps) {
        return <button />;
      }
    `);

    expect(props.map((prop) => prop.defaultValue)).toEqual(['primary', 3, false]);
  });

  it('reads an inline object type', () => {
    const { props } = extract(
      'export function Button(props: { label: string; onPress?: () => void }) { return <button />; }',
    );

    expect(props).toEqual([
      { name: 'label', type: 'string', required: true, rawType: 'string' },
      { name: 'onPress', type: 'function', required: false, rawType: '() => void' },
    ]);
  });

  it('reads props from a React.FC annotation', () => {
    const { props } = extract(`
      interface BadgeProps { label: string }
      export const Badge: React.FC<BadgeProps> = ({ label }) => <span>{label}</span>;
    `);

    expect(props).toEqual([{ name: 'label', type: 'string', required: true, rawType: 'string' }]);
  });

  it('reads props from a class component type argument', () => {
    const { props } = extract(`
      interface ModalProps { open: boolean; title: string }
      export class Modal extends React.Component<ModalProps> {
        render() { return <div />; }
      }
    `);

    expect(props.map((prop) => prop.name)).toEqual(['open', 'title']);
  });

  it('includes props inherited from a local interface', () => {
    const { props } = extract(`
      interface BaseProps { id: string }
      interface ButtonProps extends BaseProps { label: string }
      export function Button(props: ButtonProps) { return <button />; }
    `);

    expect(props.map((prop) => prop.name)).toEqual(['label', 'id']);
  });

  it('merges intersection types', () => {
    const { props } = extract(`
      type Sizing = { size?: 'sm' | 'lg' };
      type ButtonProps = { label: string } & Sizing;
      export function Button(props: ButtonProps) { return <button />; }
    `);

    expect(props.map((prop) => prop.name)).toEqual(['label', 'size']);
  });

  it('maps the supported type shapes', () => {
    const { props } = extract(`
      interface P {
        text: string;
        count: number;
        active: boolean;
        onPress: () => void;
        meta: { id: string };
        items: string[];
        list: Array<number>;
        record: Record<string, string>;
        mode: 'a' | 'b';
        exact: 'only';
        optionalEnum?: 'a' | 'b' | undefined;
      }
      export function C(props: P) { return <div />; }
    `);

    expect(props.map((prop) => [prop.name, prop.type])).toEqual([
      ['text', 'string'],
      ['count', 'number'],
      ['active', 'boolean'],
      ['onPress', 'function'],
      ['meta', 'object'],
      ['items', 'array'],
      ['list', 'array'],
      ['record', 'object'],
      ['mode', 'enum'],
      ['exact', 'enum'],
      ['optionalEnum', 'enum'],
    ]);
    expect(props.find((prop) => prop.name === 'optionalEnum')?.enumValues).toEqual(['a', 'b']);
  });

  it('marks types it cannot resolve as unknown rather than guessing', () => {
    const { props } = extract(`
      import type { ReactNode } from 'react';
      interface P { children?: ReactNode; value: string | number }
      export function C(props: P) { return <div />; }
    `);

    expect(props.map((prop) => [prop.name, prop.type])).toEqual([
      ['children', 'unknown'],
      ['value', 'unknown'],
    ]);
  });

  it('warns when the props type is declared in another file', () => {
    const { props, diagnostics } = extract(`
      import type { ButtonProps } from './types';
      export function Button(props: ButtonProps) { return <button />; }
    `);

    expect(props).toEqual([]);
    expect(diagnostics.all()).toEqual([
      expect.objectContaining({
        status: 'warning',
        code: 'unresolved-props-type',
        filePath: 'src/Button.tsx',
      }),
    ]);
  });

  it('returns nothing for a component without props', () => {
    const { props, diagnostics } = extract('export function Spinner() { return <div />; }');

    expect(props).toEqual([]);
    expect(diagnostics.size).toBe(0);
  });

  it.each([
    'React.ComponentProps<"button">',
    'Omit<ButtonProps, "size">',
    'VariantProps<typeof buttonVariants>',
  ])('reports %s as computed rather than missing', (type) => {
    const { props, diagnostics } = extract(`
      export function Button(props: ${type}) { return <button />; }
    `);

    expect(props).toEqual([]);
    expect(diagnostics.all()).toEqual([
      expect.objectContaining({ status: 'warning', code: 'computed-props-type' }),
    ]);
  });

  it('reports a component by the name it is exported under', () => {
    const { props } = extract(`
      interface PanelProps { title: string }
      const PanelWithTheme = (props: PanelProps) => <div />;
      export { PanelWithTheme as Panel };
    `);

    expect(props.map((prop) => prop.name)).toEqual(['title']);
  });

  it('reads a quoted prop name without its quotes', () => {
    const { props } = extract(`
      interface ButtonProps {
        'aria-label': string;
        "data-testid"?: string;
      }
      export function Button(props: ButtonProps) { return <button />; }
    `);

    expect(props.map((prop) => prop.name)).toEqual(['aria-label', 'data-testid']);
  });

  it('takes a default declared against a quoted prop name', () => {
    const { props } = extract(`
      interface ButtonProps { 'aria-label'?: string }
      export function Button({ 'aria-label': label = 'Close' }: ButtonProps) { return <button />; }
    `);

    expect(props[0]).toMatchObject({ name: 'aria-label', defaultValue: 'Close' });
  });

  it('stops at a props type that extends itself instead of recursing', () => {
    const { props, diagnostics } = extract(`
      interface A extends B { a: string }
      interface B extends A { b: string }
      export function Button(props: A) { return <button />; }
    `);

    expect(props).toEqual([]);
    expect(diagnostics.all()).toEqual([
      expect.objectContaining({ status: 'warning', code: 'circular-props-type' }),
    ]);
  });

  it('follows a long but finite extends chain', () => {
    const { props } = extract(`
      interface A { a: string }
      interface B extends A { b: string }
      interface C extends B { c: string }
      export function Button(props: C) { return <button />; }
    `);

    expect(props.map((prop) => prop.name)).toEqual(['c', 'b', 'a']);
  });
});
