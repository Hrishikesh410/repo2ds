import type { StyleUsage } from '@repo2ds/core';
import { DiagnosticCollector } from '@repo2ds/core';
import { describe, expect, it } from 'vitest';
import { ReactNativeAdapter, findStyleSheets } from '../src/index.js';
import { parseSource } from './helpers/parse.js';

function adapter(diagnostics = new DiagnosticCollector()) {
  return new ReactNativeAdapter({ rootDir: '/repo', diagnostics });
}

function extractStyles(source: string): StyleUsage[] {
  return adapter().extractStyles(parseSource('src/Button.tsx', source));
}

const BUTTON = `
  import { Pressable, StyleSheet, Text } from 'react-native';

  export function Button({ label }: { label: string }) {
    return (
      <Pressable style={styles.base}>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    );
  }

  const styles = StyleSheet.create({
    base: { paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#2563EB' },
    label: { fontSize: 14, color: '#FFFFFF' },
  });
`;

describe('ReactNativeAdapter.canHandle', () => {
  it('claims files importing react-native', () => {
    const file = parseSource(
      'a.tsx',
      "import { View } from 'react-native';\nexport const A = () => <View />;",
    );

    expect(adapter().canHandle(file)).toBe(true);
  });

  it('claims files importing react-native packages', () => {
    const file = parseSource(
      'a.tsx',
      "import { SafeAreaView } from 'react-native-safe-area-context';\nexport const A = () => <SafeAreaView />;",
    );

    expect(adapter().canHandle(file)).toBe(true);
  });

  it('claims files declaring a style sheet', () => {
    const file = parseSource('a.ts', 'const styles = StyleSheet.create({ a: { padding: 4 } });');

    expect(adapter().canHandle(file)).toBe(true);
  });

  it('declines plain React files', () => {
    const file = parseSource(
      'a.tsx',
      "import React from 'react';\nexport const A = () => <div />;",
    );

    expect(adapter().canHandle(file)).toBe(false);
  });
});

describe('React Native component discovery', () => {
  it('reuses the React heuristics and reports the native framework', () => {
    const components = adapter().discoverComponents(parseSource('src/Button.tsx', BUTTON));

    expect(components).toEqual([
      expect.objectContaining({ name: 'Button', framework: 'react-native', exportType: 'named' }),
    ]);
  });

  it('extracts props the same way as React', () => {
    const file = parseSource('src/Button.tsx', BUTTON);
    const native = adapter();
    const [component] = native.discoverComponents(file);

    expect(component && native.extractProps(component, file).props).toEqual([
      { name: 'label', type: 'string', required: true, rawType: 'string' },
    ]);
  });

  it('extracts props for a file it has not discovered components in yet', () => {
    const file = parseSource('src/Button.tsx', BUTTON);
    const component = {
      name: 'Button',
      filePath: 'src/Button.tsx',
      exportType: 'named' as const,
      props: [],
      propsResolved: true,
      styles: [],
      framework: 'react-native' as const,
    };

    expect(adapter().extractProps(component, file).props).toHaveLength(1);
  });
});

describe('StyleSheet.create extraction', () => {
  it('finds sheets and their entries', () => {
    const sheets = findStyleSheets(parseSource('src/Button.tsx', BUTTON).sourceFile);

    expect([...sheets.keys()]).toEqual(['styles']);
    expect([...(sheets.get('styles')?.keys() ?? [])]).toEqual(['base', 'label']);
  });

  it('extracts declarations with the sheet key as their origin', () => {
    const styles = extractStyles(BUTTON);

    expect(styles.map((style) => [style.origin, style.property, style.value])).toEqual([
      ['styles.base', 'paddingHorizontal', 16],
      ['styles.base', 'borderRadius', 8],
      ['styles.base', 'backgroundColor', '#2563EB'],
      ['styles.label', 'fontSize', 14],
      ['styles.label', 'color', '#FFFFFF'],
    ]);
    expect(styles.every((style) => style.source === 'stylesheet')).toBe(true);
  });

  it('attributes sheet styles to the component that renders them', () => {
    expect(extractStyles(BUTTON).every((style) => style.componentName === 'Button')).toBe(true);
  });

  it('counts a shared style once, not once per render site', () => {
    const styles = extractStyles(`
      import { StyleSheet, View } from 'react-native';

      export function Row() { return <View style={styles.gap} />; }
      export function Column() { return <View style={styles.gap} />; }

      const styles = StyleSheet.create({ gap: { margin: 12 } });
    `);

    expect(styles).toHaveLength(1);
    expect(styles[0]).toMatchObject({ property: 'margin', value: 12, componentName: 'Row' });
  });

  it('resolves style references inside arrays', () => {
    const styles = extractStyles(`
      import { StyleSheet, View } from 'react-native';

      export function Chip() { return <View style={[styles.base, styles.active]} />; }

      const styles = StyleSheet.create({
        base: { padding: 4 },
        active: { backgroundColor: '#2563EB' },
      });
    `);

    expect(styles.map((style) => [style.origin, style.componentName])).toEqual([
      ['styles.base', 'Chip'],
      ['styles.active', 'Chip'],
    ]);
  });

  it('reads inline styles alongside sheet styles', () => {
    const styles = extractStyles(`
      import { StyleSheet, View } from 'react-native';

      export function Card({ elevation }) {
        return <View style={[styles.card, { elevation, margin: 8 }]} />;
      }

      const styles = StyleSheet.create({ card: { padding: 16 } });
    `);

    expect(styles.map((style) => [style.property, style.value, style.source])).toEqual([
      ['padding', 16, 'stylesheet'],
      ['margin', 8, 'inline'],
    ]);
  });

  it('flattens nested values such as shadowOffset', () => {
    const styles = extractStyles(`
      import { StyleSheet } from 'react-native';
      const styles = StyleSheet.create({
        card: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 },
      });
    `);

    expect(styles.map((style) => [style.property, style.value])).toEqual([
      ['shadowOffset.width', 0],
      ['shadowOffset.height', 2],
      ['shadowOpacity', 0.1],
    ]);
  });

  it('reads styles from other style props such as contentContainerStyle', () => {
    const styles = extractStyles(`
      import { ScrollView } from 'react-native';
      export function Screen() {
        return <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} />;
      }
    `);

    expect(styles.map((style) => [style.property, style.value])).toEqual([
      ['padding', 16],
      ['gap', 8],
    ]);
  });

  it('does not attempt to resolve a computed style sheet', () => {
    const diagnostics = new DiagnosticCollector();
    const styles = new ReactNativeAdapter({ rootDir: '/repo', diagnostics }).extractStyles(
      parseSource(
        'src/Themed.tsx',
        "import { StyleSheet } from 'react-native';\nconst styles = StyleSheet.create(buildStyles(theme));",
      ),
    );

    expect(styles).toEqual([]);
    expect(diagnostics.size).toBe(0);
  });

  it('does not analyse imported stylesheets for native code', () => {
    const styles = extractStyles("import './global.css';\nexport const A = () => <View />;");

    expect(styles).toEqual([]);
  });
});
