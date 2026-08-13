import type { PropInfo } from '../models/index.js';

/** A literal value, or a code expression to emit verbatim (`() => {}`). */
export type ArgValue =
  { kind: 'literal'; value: string | number | boolean } | { kind: 'expression'; code: string };

export interface StoryArgType {
  name: string;
  control: 'select' | 'boolean' | 'text' | 'number';
  options?: string[];
}

export interface StoryArg {
  name: string;
  value: ArgValue;
}

export interface StoryVariant {
  /** Story export name, e.g. `Primary`. */
  name: string;
  args: StoryArg[];
}

/**
 * Derives Storybook controls from extracted props.
 *
 * Only props whose type is known well enough to control are included. A prop
 * typed `ReactNode` or an imported type gets no control, because a wrong control
 * is worse than none: it produces a story that misrepresents the component.
 */
export function deriveArgTypes(props: readonly PropInfo[]): StoryArgType[] {
  const argTypes: StoryArgType[] = [];

  for (const prop of props) {
    switch (prop.type) {
      case 'enum':
        if (prop.enumValues && prop.enumValues.length > 0) {
          argTypes.push({ name: prop.name, control: 'select', options: [...prop.enumValues] });
        }
        break;
      case 'boolean':
        argTypes.push({ name: prop.name, control: 'boolean' });
        break;
      case 'string':
        argTypes.push({ name: prop.name, control: 'text' });
        break;
      case 'number':
        argTypes.push({ name: prop.name, control: 'number' });
        break;
      default:
        break;
    }
  }

  return argTypes;
}

/**
 * Derives default args for a story.
 *
 * A declared default is always preferred. Otherwise a value is only invented
 * where it is certainly safe: the first option of an enum, `false`, `0`, the
 * prop name as text, or a no-op function. Objects, arrays and unknown types are
 * omitted, since a made-up shape would throw inside the component.
 */
export function deriveArgs(props: readonly PropInfo[]): StoryArg[] {
  const args: StoryArg[] = [];

  for (const prop of props) {
    if (prop.defaultValue !== undefined) {
      args.push({ name: prop.name, value: { kind: 'literal', value: prop.defaultValue } });
      continue;
    }

    if (!prop.required) {
      continue;
    }

    const value = defaultForRequiredProp(prop);
    if (value) {
      args.push({ name: prop.name, value });
    }
  }

  return args;
}

function defaultForRequiredProp(prop: PropInfo): ArgValue | undefined {
  switch (prop.type) {
    case 'enum': {
      const first = prop.enumValues?.[0];
      return first === undefined ? undefined : { kind: 'literal', value: first };
    }
    case 'boolean':
      return { kind: 'literal', value: false };
    case 'number':
      return { kind: 'literal', value: 0 };
    case 'string':
      return { kind: 'literal', value: humanise(prop.name) };
    case 'function':
      return { kind: 'expression', code: '() => {}' };
    default:
      return undefined;
  }
}

/**
 * One story per value of the first enum prop, which is nearly always the
 * variant axis a design system reviewer wants to see side by side.
 */
export function deriveVariants(props: readonly PropInfo[]): StoryVariant[] {
  const enumProp = props.find((prop) => prop.type === 'enum' && (prop.enumValues?.length ?? 0) > 1);

  if (!enumProp?.enumValues) {
    return [];
  }

  return enumProp.enumValues.map((value) => ({
    name: toPascalCase(value),
    args: [{ name: enumProp.name, value: { kind: 'literal', value } }],
  }));
}

/** `label` becomes `Label`, `firstName` becomes `First Name`. */
export function humanise(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
