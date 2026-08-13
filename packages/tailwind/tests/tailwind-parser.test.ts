import { describe, expect, it } from 'vitest';
import { parseTailwindClass, parseTailwindClasses } from '../src/index.js';

function parse(className: string) {
  const declaration = parseTailwindClass(className);
  return declaration
    ? {
        property: declaration.property,
        category: declaration.category,
        token: declaration.token,
        value: declaration.value,
      }
    : undefined;
}

describe('spacing utilities', () => {
  it.each([
    ['p-4', 'padding', 16],
    ['px-4', 'padding-left/right', 16],
    ['py-2', 'padding-top/bottom', 8],
    ['pt-1', 'padding-top', 4],
    ['pb-3', 'padding-bottom', 12],
    ['pl-6', 'padding-left', 24],
    ['pr-8', 'padding-right', 32],
    ['m-0', 'margin', 0],
    ['mx-auto', 'margin-left/right', 'auto'],
    ['my-5', 'margin-top/bottom', 20],
    ['mt-10', 'margin-top', 40],
    ['mb-12', 'margin-bottom', 48],
    ['ml-16', 'margin-left', 64],
    ['mr-2', 'margin-right', 8],
    ['gap-4', 'gap', 16],
    ['gap-x-2', 'column-gap', 8],
    ['gap-y-3', 'row-gap', 12],
    ['space-x-4', 'space-x', 16],
    ['space-y-1', 'space-y', 4],
  ])('reads %s', (className, property, value) => {
    expect(parse(className)).toMatchObject({ category: 'spacing', property, value });
  });

  it('reads fractional and pixel spacing tokens', () => {
    expect(parse('p-0.5')?.value).toBe(2);
    expect(parse('p-1.5')?.value).toBe(6);
    expect(parse('p-px')?.value).toBe(1);
  });

  it('reads negative spacing', () => {
    expect(parse('-mt-4')).toMatchObject({ property: 'margin-top', value: -16 });
  });
});

describe('colour utilities', () => {
  it.each([
    ['bg-blue-600', 'background-color', 'blue-600'],
    ['text-white', 'color', 'white'],
    ['border-gray-200', 'border-color', 'gray-200'],
    ['bg-brand-primary', 'background-color', 'brand-primary'],
  ])('reads %s', (className, property, value) => {
    expect(parse(className)).toMatchObject({ category: 'color', property, value });
  });

  it('records the colour token rather than inventing a hex value', () => {
    expect(parse('bg-blue-600')?.value).toBe('blue-600');
  });

  it('drops the opacity modifier so colours still group', () => {
    expect(parse('bg-blue-600/50')?.value).toBe('blue-600');
  });

  it('reads arbitrary colour values', () => {
    expect(parse('bg-[#2563EB]')).toMatchObject({ category: 'color', value: '#2563EB' });
  });

  it('does not mistake background behaviour for colour', () => {
    expect(parse('bg-cover')).toMatchObject({ category: 'layout' });
    expect(parse('bg-gradient-to-r')).toMatchObject({ category: 'layout' });
  });

  it('does not mistake border width or style for colour', () => {
    expect(parse('border')).toMatchObject({ category: 'layout', property: 'border-width' });
    expect(parse('border-2')).toMatchObject({ category: 'layout', property: 'border-width' });
    expect(parse('border-dashed')).toMatchObject({ category: 'layout' });
    expect(parse('border-t-2')).toMatchObject({ category: 'layout' });
  });
});

describe('radius utilities', () => {
  it.each([
    ['rounded', 'DEFAULT', 4],
    ['rounded-none', 'none', 0],
    ['rounded-sm', 'sm', 2],
    ['rounded-md', 'md', 6],
    ['rounded-lg', 'lg', 8],
    ['rounded-xl', 'xl', 12],
    ['rounded-2xl', '2xl', 16],
    ['rounded-3xl', '3xl', 24],
    ['rounded-full', 'full', 9999],
  ])('reads %s', (className, token, value) => {
    expect(parse(className)).toMatchObject({
      category: 'radius',
      property: 'border-radius',
      token,
      value,
    });
  });

  it('reads per-corner radius utilities', () => {
    expect(parse('rounded-t-lg')).toMatchObject({ property: 'border-top-radius', value: 8 });
    expect(parse('rounded-br-sm')).toMatchObject({
      property: 'border-bottom-right-radius',
      value: 2,
    });
  });

  it('keeps unknown radius tokens as written', () => {
    expect(parse('rounded-huge')).toMatchObject({ category: 'radius', value: 'huge' });
  });
});

describe('typography utilities', () => {
  it.each([
    ['text-xs', 12],
    ['text-sm', 14],
    ['text-base', 16],
    ['text-lg', 18],
    ['text-xl', 20],
    ['text-2xl', 24],
  ])('reads font size %s', (className, value) => {
    expect(parse(className)).toMatchObject({
      category: 'typography',
      property: 'font-size',
      value,
    });
  });

  it.each([
    ['font-normal', 400],
    ['font-medium', 500],
    ['font-semibold', 600],
    ['font-bold', 700],
  ])('reads font weight %s', (className, value) => {
    expect(parse(className)).toMatchObject({
      category: 'typography',
      property: 'font-weight',
      value,
    });
  });

  it('reads font families, line height and letter spacing', () => {
    expect(parse('font-sans')).toMatchObject({ property: 'font-family', value: 'sans' });
    expect(parse('leading-tight')).toMatchObject({ property: 'line-height', value: 1.25 });
    expect(parse('leading-6')).toMatchObject({ property: 'line-height', value: 24 });
    expect(parse('tracking-wide')).toMatchObject({ property: 'letter-spacing', value: 'wide' });
  });

  it('reads text alignment as layout, not typography', () => {
    expect(parse('text-center')).toMatchObject({ category: 'layout', property: 'text-align' });
  });
});

describe('layout utilities', () => {
  it.each([
    ['flex', 'display'],
    ['grid', 'display'],
    ['hidden', 'display'],
    ['items-center', 'align-items'],
    ['justify-between', 'justify-content'],
    ['w-full', 'width'],
    ['h-10', 'height'],
  ])('records %s', (className, property) => {
    expect(parse(className)).toMatchObject({ category: 'layout', property });
  });
});

describe('modifiers', () => {
  it('records variants separately from the utility', () => {
    expect(parseTailwindClass('md:hover:px-4')).toMatchObject({
      raw: 'md:hover:px-4',
      variants: ['md', 'hover'],
      property: 'padding-left/right',
      value: 16,
    });
  });

  it('ignores the important prefix', () => {
    expect(parse('!p-4')?.value).toBe(16);
  });

  it('reads arbitrary values', () => {
    expect(parse('p-[13px]')?.value).toBe(13);
    expect(parse('text-[14px]')).toMatchObject({ property: 'font-size', value: 14 });
    expect(parse('w-[200px]')).toMatchObject({ property: 'width', value: 200 });
  });

  it('reads underscores in arbitrary values as spaces', () => {
    expect(parse('bg-[rgba(0,_0,_0,_0.5)]')?.value).toBe('rgba(0, 0, 0, 0.5)');
  });
});

describe('parseTailwindClasses', () => {
  it('parses a full class attribute', () => {
    const declarations = parseTailwindClasses('px-4 py-2 rounded-lg bg-blue-600 text-white');

    expect(declarations.map((declaration) => [declaration.property, declaration.value])).toEqual([
      ['padding-left/right', 16],
      ['padding-top/bottom', 8],
      ['border-radius', 8],
      ['background-color', 'blue-600'],
      ['color', 'white'],
    ]);
  });

  it('ignores classes it does not understand', () => {
    expect(parseTailwindClasses('card btn-primary my-custom-thing')).toEqual([]);
  });

  it('does not mistake project class names for utilities', () => {
    expect(parseTailwindClasses('mx-wrapper content-wrapper w-shell flex-container')).toEqual([]);
  });

  it('tolerates irregular whitespace', () => {
    expect(parseTailwindClasses('  p-4\n  m-2  ')).toHaveLength(2);
  });

  it('returns nothing for an empty attribute', () => {
    expect(parseTailwindClasses('')).toEqual([]);
  });
});
