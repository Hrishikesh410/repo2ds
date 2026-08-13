import type { AnalysisResult, ComponentInfo, FrameworkId, StyleSource } from '@repo2ds/core';
import { frameworkLabel, stylingSystemLabel, tokenCategoryLabel } from '@repo2ds/core';
import { printDiagnostics, summariseDiagnostics } from '../output/diagnostics-view.js';
import type { Field, Reporter } from '../output/reporter.js';
import type { Analysed, CommandEnvironment, CommonOptions } from './shared.js';
import { analyse, createReporter, printJson, relativeTo } from './shared.js';

export type ScanCommandOptions = CommonOptions;

/** `repo2ds scan [path]` — analyse a repository and summarise what was found. */
export async function runScan(
  target: string | undefined,
  options: ScanCommandOptions,
  env: CommandEnvironment,
): Promise<void> {
  const analysed = await analyse(target, options, env);
  const { result } = analysed;

  if (options.json) {
    printJson(env, result.report);
    return;
  }

  const reporter = createReporter(env);

  reporter.title('Repo2DS');
  reporter.blank();

  const summary: Field[] = [
    ['Project', result.manifest.name],
    ['Framework', describeFrameworks(result.detection.frameworks)],
    ['Files scanned', result.filesScanned],
    ['Components', result.components.length],
    ['Styled components', countStyled(result.components)],
  ];

  // A NativeWind project also depends on Tailwind, so only report the systems
  // that actually styled something.
  for (const system of result.styling.systems) {
    const used = countUsingSource(result.components, system);
    if (used > 0) {
      summary.push([`${stylingSystemLabel(system)} components`, used]);
    }
  }

  if (result.detection.mixed) {
    summary.push(['React components', countFramework(result.components, 'react')]);
    summary.push(['React Native components', countFramework(result.components, 'react-native')]);
  }

  reporter.fields(summary);
  reporter.blank();

  if (result.detection.mixed) {
    reporter.note('Mixed repository detected.');
    reporter.blank();
  }

  printTokenSummary(reporter, result);
  printConfigNote(reporter, analysed);

  if (result.detection.frameworks.length === 0) {
    reporter.warning('No supported framework detected from package.json.');
    reporter.bullet('Set `framework` in repo2ds.config.ts to scan anyway.');
    reporter.blank();
  }

  printDiagnostics(reporter, result.diagnostics);
  reporter.note(summariseDiagnostics(result.diagnostics));
}

/** The `Potential tokens` block: counts of distinct candidates per category. */
function printTokenSummary(reporter: Reporter, result: AnalysisResult): void {
  if (result.tokenCandidates.length === 0) {
    return;
  }

  const { statistics } = result.report;
  reporter.note('Potential tokens');
  reporter.fields([
    [tokenCategoryLabel('color'), statistics.colorValues],
    [tokenCategoryLabel('spacing'), statistics.spacingValues],
    [tokenCategoryLabel('typography'), statistics.typographyValues],
    [tokenCategoryLabel('radius'), statistics.radiusValues],
    [tokenCategoryLabel('shadow'), statistics.shadowValues],
  ]);
  reporter.blank();
}

export function printConfigNote(reporter: Reporter, analysed: Analysed): void {
  if (!analysed.configPath) {
    return;
  }
  reporter.note(`Using ${relativeTo(analysed.rootDir, analysed.configPath)}.`);
  reporter.blank();
}

function describeFrameworks(frameworks: readonly FrameworkId[]): string {
  return frameworks.length === 0 ? 'Unknown' : frameworks.map(frameworkLabel).join(' + ');
}

function countStyled(components: readonly ComponentInfo[]): number {
  return components.filter((component) => component.styles.length > 0).length;
}

function countFramework(components: readonly ComponentInfo[], framework: FrameworkId): number {
  return components.filter((component) => component.framework === framework).length;
}

function countUsingSource(components: readonly ComponentInfo[], source: StyleSource): number {
  return components.filter((component) => component.styles.some((style) => style.source === source))
    .length;
}
