import { describe, expect, it } from 'vitest';
import type { StyleUsage } from '../src/index.js';
import {
  TokenInferenceEngine,
  classifyProperty,
  extractTokenValues,
  isColorValue,
  normaliseColor,
  scoreConfidence,
  splitValueParts,
} from '../src/index.js';

function style(
  property: string,
  value: string | number,
  overrides: Partial<StyleUsage> = {},
): StyleUsage {
  return {
    property,
    value,
    source: 'inline',
    filePath: 'src/Button.tsx',
    location: { line: 1, column: 1 },
    componentName: 'Button',
    ...overrides,
  };
}

describe('classifyProperty', () => {
  it.each([
    ['padding', 'spacing'],
    ['paddingLeft', 'spacing'],
    ['margin-top', 'spacing'],
    ['gap', 'spacing'],
    ['rowGap', 'spacing'],
    ['--space-4', 'spacing'],
    ['color', 'color'],
    ['backgroundColor', 'color'],
    ['border-color', 'color'],
    ['--bg-surface', 'color'],
    ['tintColor', 'color'],
    ['borderRadius', 'radius'],
    ['border-top-left-radius', 'radius'],
    ['fontSize', 'typography'],
    ['fontWeight', 'typography'],
    ['line-height', 'typography'],
    ['letterSpacing', 'typography'],
    ['boxShadow', 'shadow'],
    ['elevation', 'shadow'],
    ['width', 'unknown'],
    ['display', 'unknown'],
    ['alignItems', 'unknown'],
  ])('classifies %s as %s', (property, category) => {
    expect(classifyProperty(property).category).toBe(category);
  });

  it('prefers colour over shadow for shadowColor', () => {
    expect(classifyProperty('shadowColor').category).toBe('color');
  });

  it('prefers shadow over typography for textShadow', () => {
    expect(classifyProperty('textShadow').category).toBe('shadow');
  });

  it('prefers typography over spacing for letterSpacing', () => {
    expect(classifyProperty('letterSpacing').category).toBe('typography');
  });
});

describe('colour detection', () => {
  it.each([
    '#FFFFFF',
    '#fff',
    '#ffffffcc',
    'rgb(1, 2, 3)',
    'rgba(0,0,0,0.5)',
    'hsl(1, 2%, 3%)',
    'hsla(1,2%,3%,0.4)',
    'white',
    'transparent',
  ])('detects %s', (value) => {
    expect(isColorValue(value)).toBe(true);
  });

  it.each(['16px', 'solid', '600', 'inherit'])('does not treat %s as a colour', (value) => {
    expect(isColorValue(value)).toBe(false);
  });

  it('groups equivalent notations of the same colour', () => {
    expect(normaliseColor('#fff')).toBe('#FFFFFF');
    expect(normaliseColor('#FfFfFf')).toBe('#FFFFFF');
    expect(normaliseColor('rgba(0, 0, 0, 0.5)')).toBe('rgba(0,0,0,0.5)');
  });

  it('does not convert between notations', () => {
    expect(normaliseColor('rgb(255,255,255)')).not.toBe('#FFFFFF');
  });
});

describe('extractTokenValues', () => {
  it('reads numeric values', () => {
    expect(extractTokenValues('padding', 16)).toEqual([
      { category: 'spacing', value: 16, semantic: true },
    ]);
  });

  it('converts pixel strings to numbers so CSS and inline styles group together', () => {
    expect(extractTokenValues('padding', '16px')).toEqual([
      { category: 'spacing', value: 16, semantic: true },
    ]);
  });

  it('keeps relative units as written', () => {
    expect(extractTokenValues('font-size', '1.5rem')).toEqual([
      { category: 'typography', value: '1.5rem', semantic: true },
    ]);
  });

  it('splits shorthand spacing into separate values', () => {
    expect(extractTokenValues('padding', '16px 24px')).toEqual([
      { category: 'spacing', value: 16, semantic: true },
      { category: 'spacing', value: 24, semantic: true },
    ]);
  });

  it('finds the colour inside a border shorthand', () => {
    expect(extractTokenValues('border', '1px solid #E5E7EB')).toEqual([
      { category: 'color', value: '#E5E7EB', semantic: false },
    ]);
  });

  it('keeps a shadow whole and reports its colour separately', () => {
    expect(extractTokenValues('boxShadow', '0 1px 2px rgba(0, 0, 0, 0.1)')).toEqual([
      { category: 'shadow', value: '0 1px 2px rgba(0, 0, 0, 0.1)', semantic: true },
      { category: 'color', value: 'rgba(0,0,0,0.1)', semantic: false },
    ]);
  });

  it('keeps single-value shadow properties as numbers', () => {
    expect(extractTokenValues('elevation', 4)).toEqual([
      { category: 'shadow', value: 4, semantic: true },
    ]);
  });

  it('reads a colour from a custom property, by value rather than by name', () => {
    expect(extractTokenValues('--brand', '#2563EB')).toEqual([
      { category: 'color', value: '#2563EB', semantic: false },
    ]);
    expect(extractTokenValues('--brand-color', '#2563EB')).toEqual([
      { category: 'color', value: '#2563EB', semantic: true },
    ]);
  });

  it('reads font weights as numbers whether quoted or not', () => {
    expect(extractTokenValues('fontWeight', '600')).toEqual([
      { category: 'typography', value: 600, semantic: true },
    ]);
    expect(extractTokenValues('fontWeight', 600)).toEqual([
      { category: 'typography', value: 600, semantic: true },
    ]);
  });

  it('keeps font families and weight keywords', () => {
    expect(extractTokenValues('fontFamily', 'Inter')[0]?.value).toBe('Inter');
    expect(extractTokenValues('fontWeight', 'bold')[0]?.value).toBe('bold');
  });

  it('drops values that carry no design meaning', () => {
    expect(extractTokenValues('display', 'flex')).toEqual([]);
    expect(extractTokenValues('alignItems', 'center')).toEqual([]);
    expect(extractTokenValues('white-space', 'nowrap')).toEqual([]);
    expect(extractTokenValues('padding', 'auto')).toEqual([]);
    expect(extractTokenValues('color', 'inherit')).toEqual([]);
    expect(extractTokenValues('background', 'url(/logo.png)')).toEqual([]);
  });

  it('keeps named colours from utility classes and theme references', () => {
    expect(extractTokenValues('background-color', 'blue-600')).toEqual([
      { category: 'color', value: 'blue-600', semantic: true },
    ]);
    expect(extractTokenValues('color', 'colors.brand')).toEqual([
      { category: 'color', value: 'colors.brand', semantic: true },
    ]);
  });

  it('keeps colour functions intact when splitting', () => {
    expect(splitValueParts('0 1px 2px rgba(0, 0, 0, 0.1)')).toEqual([
      '0',
      '1px',
      '2px',
      'rgba(0, 0, 0, 0.1)',
    ]);
  });
});

describe('scoreConfidence', () => {
  it('scores a value used once in one component low', () => {
    const score = scoreConfidence({
      usageCount: 1,
      componentCount: 1,
      fileCount: 1,
      semanticRatio: 1,
    });

    expect(score).toBeLessThan(0.5);
  });

  it('scores a widely repeated value high', () => {
    const score = scoreConfidence({
      usageCount: 87,
      componentCount: 31,
      fileCount: 18,
      semanticRatio: 1,
    });

    expect(score).toBeGreaterThan(0.95);
  });

  it('increases monotonically with usage', () => {
    const base = { componentCount: 3, fileCount: 3, semanticRatio: 1 };
    const scores = [2, 5, 10, 20, 40].map((usageCount) => scoreConfidence({ ...base, usageCount }));

    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it('penalises values recognised only by their shape', () => {
    const input = { usageCount: 10, componentCount: 4, fileCount: 4 };

    expect(scoreConfidence({ ...input, semanticRatio: 0 })).toBeLessThan(
      scoreConfidence({ ...input, semanticRatio: 1 }),
    );
  });

  it('is deterministic', () => {
    const input = { usageCount: 7, componentCount: 2, fileCount: 2, semanticRatio: 0.5 };

    expect(scoreConfidence(input)).toBe(scoreConfidence(input));
  });
});

describe('TokenInferenceEngine', () => {
  it('groups repeated values and counts usage', () => {
    const engine = new TokenInferenceEngine();

    const candidates = engine.infer([
      style('padding', 8),
      style('padding', 16),
      style('padding', 24),
      style('padding', 16, { componentName: 'Card', filePath: 'src/Card.tsx' }),
      style('paddingTop', 16, { componentName: 'Input', filePath: 'src/Input.tsx' }),
    ]);

    const spacing16 = candidates.find(
      (candidate) => candidate.category === 'spacing' && candidate.value === 16,
    );

    expect(spacing16?.usageCount).toBe(3);
    expect(spacing16?.evidence).toEqual([
      'Used 3 times',
      'Used by 3 components',
      'Used for padding in 2 locations',
      'Repeated across 3 files',
    ]);
  });

  it('counts a stylesheet declaration once however many components import it', () => {
    const declaration: StyleUsage = {
      property: 'padding',
      value: '16px',
      source: 'stylesheet',
      filePath: 'src/theme.css',
      location: { line: 8, column: 3 },
      origin: 'src/theme.css .card',
    };

    const candidates = new TokenInferenceEngine({ minUsageCount: 1 }).infer([
      { ...declaration, componentName: 'Card' },
      { ...declaration, componentName: 'Panel' },
      { ...declaration, componentName: 'Sheet' },
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({ category: 'spacing', value: 16, usageCount: 1 }),
    ]);
  });

  it('counts two declarations that happen to share a value', () => {
    const inTheme = {
      property: 'padding',
      value: '16px',
      source: 'stylesheet',
      filePath: 'src/theme.css',
    } satisfies Partial<StyleUsage> as StyleUsage;

    const candidates = new TokenInferenceEngine().infer([
      { ...inTheme, location: { line: 8, column: 3 } },
      { ...inTheme, location: { line: 14, column: 3 } },
    ]);

    expect(candidates[0]?.usageCount).toBe(2);
  });

  it('counts a utility class at every place it is written', () => {
    const shared = {
      property: 'padding',
      value: 16,
      source: 'tailwind',
      filePath: 'src/Button.tsx',
      location: { line: 4, column: 7 },
      origin: 'p-4',
      componentName: 'Button',
    } satisfies StyleUsage;

    const candidates = new TokenInferenceEngine().infer([shared, shared]);

    expect(candidates[0]?.usageCount).toBe(2);
  });

  it('ignores values that appear only once by default', () => {
    const candidates = new TokenInferenceEngine().infer([style('padding', 8), style('margin', 12)]);

    expect(candidates).toEqual([]);
  });

  it('honours a configured minimum usage count', () => {
    const candidates = new TokenInferenceEngine({ minUsageCount: 1 }).infer([style('padding', 8)]);

    expect(candidates.map((candidate) => candidate.value)).toEqual([8]);
  });

  it('never infers tokens from dynamic values', () => {
    const candidates = new TokenInferenceEngine({ minUsageCount: 1 }).infer([
      style('padding', 'getSpacing(size)', { dynamic: true }),
      style('padding', 'spacing[size]', { dynamic: true }),
    ]);

    expect(candidates).toEqual([]);
  });

  it('keeps categories separate even for equal values', () => {
    const candidates = new TokenInferenceEngine({ minUsageCount: 1 }).infer([
      style('padding', 16),
      style('borderRadius', 16),
      style('fontSize', 16),
    ]);

    expect(candidates.map((candidate) => [candidate.category, candidate.value])).toEqual([
      ['spacing', 16],
      ['typography', 16],
      ['radius', 16],
    ]);
  });

  it('reports colours grouped by normalised value', () => {
    const candidates = new TokenInferenceEngine().infer([
      style('color', '#fff'),
      style('backgroundColor', '#FFFFFF', { componentName: 'Card' }),
      style('borderColor', '#ffffff', { componentName: 'Input' }),
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({ category: 'color', value: '#FFFFFF', usageCount: 3 }),
    ]);
  });

  it('records locations and caps how many it keeps', () => {
    const styles = Array.from({ length: 30 }, (_, index) =>
      style('padding', 16, { location: { line: index + 1, column: 3 } }),
    );

    const candidate = new TokenInferenceEngine().infer(styles)[0];

    expect(candidate?.usageCount).toBe(30);
    expect(candidate?.locations).toHaveLength(20);
    expect(candidate?.locations[0]).toMatch(/^src\/Button\.tsx:\d+:3$/);
  });

  it('records one location per place, however often it was used there', () => {
    const location = { line: 8, column: 5 };
    const candidate = new TokenInferenceEngine().infer([
      style('padding', 16, { location }),
      style('padding', 16, { location }),
    ])[0];

    expect(candidate?.usageCount).toBe(2);
    expect(candidate?.locations).toEqual(['src/Button.tsx:8:5']);
  });

  it('sorts candidates by category then usage so output is stable', () => {
    const candidates = new TokenInferenceEngine().infer([
      style('padding', 4),
      style('padding', 4),
      style('padding', 8),
      style('padding', 8),
      style('padding', 8),
      style('color', '#000000'),
      style('color', '#000000'),
    ]);

    expect(candidates.map((candidate) => [candidate.category, candidate.value])).toEqual([
      ['color', '#000000'],
      ['spacing', 8],
      ['spacing', 4],
    ]);
  });

  it('gives a value used everywhere higher confidence than a value used twice', () => {
    const rare = new TokenInferenceEngine().infer([style('padding', 3), style('padding', 3)])[0];

    const common = new TokenInferenceEngine().infer(
      Array.from({ length: 40 }, (_, index) =>
        style('padding', 16, {
          componentName: `Component${index % 15}`,
          filePath: `src/File${index % 12}.tsx`,
        }),
      ),
    )[0];

    expect(rare?.confidence).toBeLessThan(0.5);
    expect(common?.confidence).toBeGreaterThan(0.95);
  });
});
