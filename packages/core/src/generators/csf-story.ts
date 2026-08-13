import type { ComponentInfo, PropInfo } from '../models/index.js';
import type { StoryArg } from './story-args.js';
import { deriveArgTypes, deriveArgs, deriveVariants } from './story-args.js';
import type { StoryResult } from './story-file.js';
import {
  importStatement,
  renderArgTypes,
  renderArgs,
  storyFilePath,
  storyTitle,
} from './story-file.js';

/**
 * The parts of a Component Story Format file that differ between platforms.
 *
 * React and React Native Storybook need different imports and different meta
 * entries — `autodocs` is web only, a device needs a `View` wrapper — but the
 * surrounding structure is the same, and two copies of it would drift.
 */
export interface StoryTemplate {
  /** Import lines placed above the component import, in the order written. */
  imports: readonly string[];
  /** Extra entries for the `meta` object, indented to sit inside it. */
  meta?: readonly string[];
}

/**
 * Builds the story for a component, or explains why it cannot have one.
 *
 * A component that is not exported cannot be imported by a story, and writing a
 * file that does not compile would be worse than writing none.
 */
export function buildStory(component: ComponentInfo, template: StoryTemplate): StoryResult {
  if (component.exportType === 'unknown') {
    return {
      status: 'skipped',
      component: component.name,
      reason: 'component is not exported, so a story cannot import it',
    };
  }

  return {
    status: 'generated',
    file: { filePath: storyFilePath(component), contents: renderStory(component, template) },
  };
}

export function renderStory(component: ComponentInfo, template: StoryTemplate): string {
  const argTypes = deriveArgTypes(component.props);
  const args = deriveArgs(component.props);
  const variants = deriveVariants(component.props);
  const localName = localComponentName(
    component.name,
    variants.map((variant) => variant.name),
  );

  // `satisfies Meta<typeof C>` makes Storybook check every arg against the real
  // props, which is what you want — but it also makes any required prop that has
  // no arg mandatory on each story. Where a value could not be inferred for one,
  // the annotated form keeps the file compiling.
  const missing = missingArgs(component.props, args);
  const complete = component.propsResolved && missing.length === 0;

  const lines = [
    ...template.imports,
    '',
    importStatement(component, localName),
    '',
    ...(complete
      ? ['const meta = {']
      : [
          component.propsResolved
            ? `// Repo2DS could not infer a value for: ${missing.join(', ')}.`
            : '// Repo2DS could not read this props type, so the args below may be incomplete.',
          `const meta: Meta<typeof ${localName}> = {`,
        ]),
    `  title: '${storyTitle(component)}',`,
    `  component: ${localName},`,
    ...(template.meta ?? []),
  ];

  if (argTypes.length > 0) {
    lines.push('  argTypes: {', ...renderArgTypes(argTypes, '    '), '  },');
  }

  if (args.length > 0) {
    lines.push('  args: {', ...renderArgs(args, '    '), '  },');
  }

  lines.push(
    complete ? `} satisfies Meta<typeof ${localName}>;` : '};',
    '',
    'export default meta;',
    '',
    complete
      ? 'type Story = StoryObj<typeof meta>;'
      : `type Story = StoryObj<typeof ${localName}>;`,
    '',
    'export const Default: Story = {};',
  );

  for (const variant of variants) {
    lines.push(
      '',
      `export const ${variant.name}: Story = {`,
      '  args: {',
      ...renderArgs(variant.args, '    '),
      '  },',
      '};',
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Required props the story has no value for. These are the props that would
 * make a story fail to typecheck under the strict `satisfies` form.
 */
export function missingArgs(props: readonly PropInfo[], args: readonly StoryArg[]): string[] {
  const provided = new Set(args.map((arg) => arg.name));
  return props.filter((prop) => prop.required && !provided.has(prop.name)).map((prop) => prop.name);
}

/** Identifiers every story file declares or imports from Storybook. */
const STORY_FILE_IDENTIFIERS = ['Meta', 'StoryObj', 'Story', 'Default'];

/**
 * A local name for the component that nothing else in the story file uses.
 *
 * `Meta`, `Story` and `Default` are all plausible component names and all
 * already taken in a CSF file, as is the name of any variant the props produce.
 */
function localComponentName(name: string, variantNames: readonly string[]): string {
  const taken = new Set([...STORY_FILE_IDENTIFIERS, ...variantNames]);

  let candidate = name;
  while (taken.has(candidate)) {
    candidate = `${candidate}Component`;
  }

  return candidate;
}
