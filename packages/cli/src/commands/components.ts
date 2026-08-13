import type { ComponentInfo, PropInfo } from '@repo2ds/core';
import { frameworkLabel, plural, quote } from '@repo2ds/core';
import type { Reporter } from '../output/reporter.js';
import type { CommandEnvironment, CommonOptions } from './shared.js';
import { analyse, createReporter, printJson } from './shared.js';
import { printConfigNote } from './scan.js';

export interface ComponentsCommandOptions extends CommonOptions {
  /** Substring match on the component name, case insensitive. */
  filter?: string;
  /** Print each component's props. Off by default to keep the list scannable. */
  props?: boolean;
}

/** `repo2ds components [path]` — list the components Repo2DS found. */
export async function runComponents(
  target: string | undefined,
  options: ComponentsCommandOptions,
  env: CommandEnvironment,
): Promise<void> {
  const analysed = await analyse(target, options, env);
  const components = filterComponents(analysed.result.components, options.filter);

  if (options.json) {
    printJson(env, components);
    return;
  }

  const reporter = createReporter(env);

  reporter.title('Components');
  reporter.blank();

  if (components.length === 0) {
    reporter.note(
      options.filter
        ? `No component matched "${options.filter}".`
        : 'No components were found in this repository.',
    );
    return;
  }

  for (const component of components) {
    reporter.raw(`${component.name}  ${describeCounts(component)}`);
    reporter.bullet(component.filePath);
    if (options.props) {
      printProps(reporter, component.props);
    }
    reporter.blank();
  }

  printConfigNote(reporter, analysed);
  reporter.note(summariseComponents(components));
}

function filterComponents(
  components: readonly ComponentInfo[],
  filter: string | undefined,
): ComponentInfo[] {
  if (!filter) {
    return [...components];
  }
  const needle = filter.toLowerCase();
  return components.filter((component) => component.name.toLowerCase().includes(needle));
}

function describeCounts(component: ComponentInfo): string {
  return [
    frameworkLabel(component.framework),
    plural(component.props.length, 'prop'),
    plural(component.styles.length, 'style'),
  ].join(' · ');
}

function describeProp(prop: PropInfo): string {
  const suffix = prop.required ? '' : '?';
  return `${prop.name}${suffix}: ${describeType(prop)}${describeDefault(prop)}`;
}

/** Enum members only ever come from a string literal union, so they read as written. */
function describeType(prop: PropInfo): string {
  if (prop.type !== 'enum' || !prop.enumValues) {
    return prop.type;
  }
  return prop.enumValues.map(quote).join(' | ');
}

/** Defaults are only ever literals, so a string default is quoted as one. */
function describeDefault(prop: PropInfo): string {
  if (prop.defaultValue === undefined) {
    return '';
  }
  const value =
    typeof prop.defaultValue === 'string' ? quote(prop.defaultValue) : String(prop.defaultValue);
  return ` = ${value}`;
}

function summariseComponents(components: readonly ComponentInfo[]): string {
  const styled = components.filter((component) => component.styles.length > 0).length;
  return `${plural(components.length, 'component')}, ${styled} styled.`;
}

function printProps(reporter: Reporter, props: readonly PropInfo[]): void {
  if (props.length === 0) {
    reporter.bullet('No props detected.');
    return;
  }
  for (const prop of props) {
    reporter.bullet(describeProp(prop));
  }
}
