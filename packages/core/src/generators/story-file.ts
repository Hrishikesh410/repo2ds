import type { ComponentInfo } from '../models/index.js';
import { withoutPlatformSuffix } from '../utils/index.js';
import type { ArgValue, StoryArg, StoryArgType } from './story-args.js';

export interface StoryFile {
  /** Repository-relative path the story should be written to. */
  filePath: string;
  contents: string;
}

export type StoryResult =
  | { status: 'generated'; file: StoryFile }
  | { status: 'skipped'; component: string; reason: string };

/** `src/components/Button.tsx` and `Button` give `src/components/Button.stories.tsx`. */
export function storyFilePath(component: ComponentInfo): string {
  const directory = component.filePath.includes('/')
    ? component.filePath.slice(0, component.filePath.lastIndexOf('/') + 1)
    : '';
  return `${directory}${component.name}.stories.tsx`;
}

/**
 * `./Button`, derived from the component file so the import always resolves.
 *
 * A platform suffix is dropped along with the extension: `Button.ios.tsx` is
 * imported as `./Button`, which is how the application imports it too.
 */
export function componentImportPath(component: ComponentInfo): string {
  const filePath = withoutPlatformSuffix(component.filePath);
  const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
  return `./${fileName.replace(/\.(tsx|ts|jsx|js)$/, '')}`;
}

/**
 * Imports the component, optionally under a different local name. A story file
 * declares identifiers of its own, and a component called `Meta` or `Default`
 * would otherwise be imported on top of one of them.
 */
export function importStatement(component: ComponentInfo, localName = component.name): string {
  const named =
    localName === component.name
      ? `{ ${component.name} }`
      : `{ ${component.name} as ${localName} }`;
  const specifier = component.exportType === 'default' ? localName : named;

  return `import ${specifier} from '${componentImportPath(component)}';`;
}

/** Storybook groups stories by title; `Components/Button` is the common default. */
export function storyTitle(component: ComponentInfo): string {
  return `Components/${component.name}`;
}

export function serialiseArgValue(value: ArgValue): string {
  if (value.kind === 'expression') {
    return value.code;
  }
  return typeof value.value === 'string' ? quote(value.value) : String(value.value);
}

const STRING_ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  "'": "\\'",
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
  '\v': '\\v',
  // Valid in a string but a line break to a JavaScript parser.
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

/**
 * Writes a value as a single-quoted JavaScript string literal.
 *
 * Every default value in a repository ends up here, so anything that could end
 * the literal early has to be escaped: a newline in a default would otherwise
 * produce a generated file that does not parse.
 */
export function quote(value: string): string {
  const escaped = value
    .replace(
      /[\\'\n\r\t\b\f\v\u2028\u2029]/g,
      (character) => STRING_ESCAPES[character] ?? character,
    )
    .replace(
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001f]/g,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );

  return `'${escaped}'`;
}

/** Only quote a key when it is not a valid identifier, matching normal style. */
export function propertyKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : quote(name);
}

export function renderArgTypes(argTypes: readonly StoryArgType[], indent: string): string[] {
  return argTypes.map((argType) => {
    const options = argType.options ? `, options: [${argType.options.map(quote).join(', ')}]` : '';
    return `${indent}${propertyKey(argType.name)}: { control: '${argType.control}'${options} },`;
  });
}

export function renderArgs(args: readonly StoryArg[], indent: string): string[] {
  return args.map((arg) => `${indent}${propertyKey(arg.name)}: ${serialiseArgValue(arg.value)},`);
}
