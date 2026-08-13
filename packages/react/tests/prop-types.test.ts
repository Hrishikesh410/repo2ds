import type { PropInfo } from '@repo2ds/core';
import { DiagnosticCollector } from '@repo2ds/core';
import { describe, expect, it } from 'vitest';
import { ReactAdapter } from '../src/index.js';
import { parseSource } from './helpers/parse.js';

function extract(source: string, filePath = 'src/Button.jsx'): PropInfo[] {
  const adapter = new ReactAdapter({ rootDir: '/repo', diagnostics: new DiagnosticCollector() });
  const file = parseSource(filePath, source);
  const [component] = adapter.discoverComponents(file);

  return component ? adapter.extractProps(component, file).props : [];
}

describe('PropTypes extraction', () => {
  it('reads validators, required flags and enum members', () => {
    const props = extract(`
      export function Button({ label, variant, disabled }) {
        return <button>{label}</button>;
      }

      Button.propTypes = {
        label: PropTypes.string.isRequired,
        variant: PropTypes.oneOf(['primary', 'secondary']),
        disabled: PropTypes.bool,
        onPress: PropTypes.func,
        items: PropTypes.arrayOf(PropTypes.string),
        style: PropTypes.shape({ padding: PropTypes.number }),
      };
    `);

    expect(props.map(({ name, type, required }) => ({ name, type, required }))).toEqual([
      { name: 'label', type: 'string', required: true },
      { name: 'variant', type: 'enum', required: false },
      { name: 'disabled', type: 'boolean', required: false },
      { name: 'onPress', type: 'function', required: false },
      { name: 'items', type: 'array', required: false },
      { name: 'style', type: 'object', required: false },
    ]);
    expect(props[1]?.enumValues).toEqual(['primary', 'secondary']);
  });

  it('prefers defaultProps over a default written into the destructuring', () => {
    const props = extract(`
      export function Button({ variant = 'ghost', size }) {
        return <button />;
      }

      Button.propTypes = { variant: PropTypes.string, size: PropTypes.string };
      Button.defaultProps = { variant: 'primary' };
    `);

    expect(props[0]?.defaultValue).toBe('primary');
    expect(props[1]?.defaultValue).toBeUndefined();
  });

  it('keeps a destructuring default when defaultProps does not mention the prop', () => {
    const props = extract(`
      export function Badge({ tone = 'neutral' }) { return <span />; }
      Badge.propTypes = { tone: PropTypes.string };
    `);

    expect(props[0]?.defaultValue).toBe('neutral');
  });

  it('reads static propTypes from a class component', () => {
    const props = extract(`
      export class Modal extends React.Component {
        static propTypes = { open: PropTypes.bool.isRequired };
        static defaultProps = { open: false };
        render() { return <div />; }
      }
    `);

    expect(props).toEqual([
      {
        name: 'open',
        type: 'boolean',
        required: true,
        rawType: 'PropTypes.bool.isRequired',
        defaultValue: false,
      },
    ]);
  });

  it('reports a validator it cannot read as unknown rather than guessing', () => {
    const props = extract(`
      export function Chart({ series }) { return <svg />; }
      Chart.propTypes = { series: buildSeriesValidator() };
    `);

    expect(props).toEqual([
      { name: 'series', type: 'unknown', required: false, rawType: 'buildSeriesValidator()' },
    ]);
  });

  it('leaves the declared types of a TypeScript component alone', () => {
    const props = extract(
      `
      interface ButtonProps { label: string }
      export function Button({ label }: ButtonProps) { return <button />; }
      Button.propTypes = { label: PropTypes.number };
    `,
      'src/Button.tsx',
    );

    expect(props).toEqual([{ name: 'label', type: 'string', required: true, rawType: 'string' }]);
  });
});
