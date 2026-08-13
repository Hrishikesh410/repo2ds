import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AnalysisResult,
  ComponentInfo,
  FrameworkId,
  ScaffoldFolder,
  StoryGenerator,
  StoryLayout,
} from '@repo2ds/core';
import {
  buildDesignTokens,
  findExistingStories,
  findPlatformVariants,
  planScaffold,
  plural,
  renderScaffoldReadme,
  toPosixPath,
  writeJsonFile,
} from '@repo2ds/core';
import { createStoryGenerators } from '../analysis.js';
import type { Reporter } from '../output/reporter.js';
import { printDiagnostics, summariseDiagnostics } from '../output/diagnostics-view.js';
import type { CommandEnvironment, CommonOptions } from './shared.js';
import { analyse, createReporter, printJson } from './shared.js';

export interface GenerateCommandOptions extends CommonOptions {
  /** Directory for the JSON artifacts, relative to the repository. */
  out?: string;
  stories?: boolean;
  report?: boolean;
  tokens?: boolean;
  /** Report what would be written without touching the file system. */
  dryRun?: boolean;
  /** Overwrite generated files that already exist. */
  force?: boolean;
  /** Overrides `storybook.layout` for this run. */
  layout?: StoryLayout;
  /** Overrides `storybook.componentsDir` for this run. */
  componentsDir?: string;
  /** Overrides `storybook.package` for this run. */
  storybookPackage?: string;
}

export const DEFAULT_OUTPUT_DIR = '.repo2ds';
const REPORT_FILE_NAME = 'report.json';
const TOKENS_FILE_NAME = 'design-tokens.json';

export interface WrittenFile {
  /** Repository-relative path, so output is identical on every machine. */
  filePath: string;
  status: 'written' | 'exists' | 'skipped';
  reason?: string;
}

/** `repo2ds generate [path]` — write stories, the report, and token candidates. */
export async function runGenerate(
  target: string | undefined,
  options: GenerateCommandOptions,
  env: CommandEnvironment,
): Promise<void> {
  const analysed = await analyse(target, options, env);
  const { result, rootDir } = analysed;

  const layout = await chooseLayout(result, rootDir, options);
  const files = [
    ...(layout.name === 'folder'
      ? await generateComponentFolders(result, rootDir, options)
      : await generateStories(result, rootDir, options)),
    ...(await generateJsonArtifacts(result, rootDir, options)),
  ];

  if (options.json) {
    printJson(env, { dryRun: options.dryRun === true, layout: layout.name, files });
    return;
  }

  const reporter = createReporter(env);

  reporter.title(options.dryRun ? 'Generate (dry run)' : 'Generate');
  reporter.blank();

  if (layout.reason) {
    reporter.note(layout.reason);
    reporter.blank();
  }

  printFiles(reporter, files);
  printDiagnostics(reporter, result.diagnostics);
  reporter.note(summariseWrittenFiles(files, options));
  if (result.diagnostics.length > 0) {
    reporter.note(summariseDiagnostics(result.diagnostics));
  }
}

function componentsDirectory(result: AnalysisResult, options: GenerateCommandOptions): string {
  return options.componentsDir ?? result.config.storybook.componentsDir;
}

function storyGenerators(
  result: AnalysisResult,
  options: GenerateCommandOptions,
): Map<FrameworkId, StoryGenerator> {
  const storybookPackage = options.storybookPackage ?? result.config.storybook.package;
  return createStoryGenerators(storybookPackage ? { storybookPackage } : {});
}

interface ChosenLayout {
  name: 'beside' | 'folder';
  /** Explains an automatic choice; absent when the layout was asked for. */
  reason?: string;
}

/**
 * A project that already writes stories has a convention, and stories beside
 * the component follow it. A project with none has nothing to follow, so the
 * component folders are the friendlier default: they group what Repo2DS found
 * in one place the team can look at, and then keep or delete.
 */
async function chooseLayout(
  result: AnalysisResult,
  rootDir: string,
  options: GenerateCommandOptions,
): Promise<ChosenLayout> {
  const configured = options.layout ?? result.config.storybook.layout;

  if (configured !== 'auto') {
    return { name: configured };
  }

  const existing = await findExistingStories(rootDir, {
    ignore: [componentsDirectory(result, options), options.out ?? DEFAULT_OUTPUT_DIR],
  });

  return existing.found
    ? { name: 'beside', reason: `Found ${existing.files[0]}, so stories go beside each component.` }
    : { name: 'folder', reason: 'No stories found, so components are scaffolded into folders.' };
}

/**
 * Writes a folder per component, each re-exporting the original. The
 * application is not touched: no file it owns is written, moved or reimported.
 */
async function generateComponentFolders(
  result: AnalysisResult,
  rootDir: string,
  options: GenerateCommandOptions,
): Promise<WrittenFile[]> {
  if (options.stories === false || !result.config.storybook.enabled) {
    return [];
  }

  const directory = componentsDirectory(result, options);
  const generators = storyGenerators(result, options);
  const files: WrittenFile[] = [];
  const folders: ScaffoldFolder[] = [];

  for (const planned of planScaffold(result.components, { directory })) {
    if (planned.status === 'skipped') {
      files.push({ filePath: planned.filePath, status: 'skipped', reason: planned.reason });
      continue;
    }

    const { folder } = planned;
    folders.push(folder);

    for (const file of folder.files) {
      files.push(await writeGenerated(rootDir, file.filePath, file.contents, options));
    }

    const generator = generators.get(folder.entry.framework);
    if (!generator) {
      files.push({
        filePath: folder.directory,
        status: 'skipped',
        reason: `No story generator for ${folder.entry.framework}.`,
      });
      continue;
    }

    files.push(await writeStory(generator, folder.entry, rootDir, options));
  }

  if (folders.length > 0) {
    const readme = path.posix.join(directory, 'README.md');
    files.push(await writeGenerated(rootDir, readme, renderScaffoldReadme(folders), options));
  }

  return files;
}

async function generateStories(
  result: AnalysisResult,
  rootDir: string,
  options: GenerateCommandOptions,
): Promise<WrittenFile[]> {
  if (options.stories === false || !result.config.storybook.enabled) {
    return [];
  }

  const generators = storyGenerators(result, options);
  const platformVariants = findPlatformVariants(result.components);
  const files: WrittenFile[] = [];

  for (const component of result.components) {
    const variant = platformVariants.get(component);
    if (variant) {
      files.push({ filePath: component.filePath, status: 'skipped', reason: variant });
      continue;
    }

    const generator = generators.get(component.framework);
    if (!generator) {
      files.push({
        filePath: component.filePath,
        status: 'skipped',
        reason: `No story generator for ${component.framework}.`,
      });
      continue;
    }
    files.push(await writeStory(generator, component, rootDir, options));
  }

  return files;
}

async function writeStory(
  generator: StoryGenerator,
  component: ComponentInfo,
  rootDir: string,
  options: GenerateCommandOptions,
): Promise<WrittenFile> {
  const story = generator.generate(component);

  if (story.status === 'skipped') {
    return { filePath: component.filePath, status: 'skipped', reason: story.reason };
  }

  return writeGenerated(rootDir, story.file.filePath, story.file.contents, options);
}

/**
 * Writes one generated file, leaving any existing one alone.
 *
 * Everything Repo2DS generates is a starting point meant to be edited: a story
 * that was tuned by hand, or a re-export replaced by a real implementation once
 * a team adopts the folder. Overwriting that would throw away the work, so an
 * existing file is reported instead and `--force` is the way to insist.
 */
async function writeGenerated(
  rootDir: string,
  relativePath: string,
  contents: string,
  options: GenerateCommandOptions,
): Promise<WrittenFile> {
  const absolutePath = path.join(rootDir, relativePath);

  if (options.force !== true && (await exists(absolutePath))) {
    return {
      filePath: relativePath,
      status: 'exists',
      reason: 'Already exists; pass --force to overwrite.',
    };
  }

  if (options.dryRun !== true) {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, contents, 'utf8');
  }

  return { filePath: relativePath, status: 'written' };
}

async function generateJsonArtifacts(
  result: AnalysisResult,
  rootDir: string,
  options: GenerateCommandOptions,
): Promise<WrittenFile[]> {
  const outputDir = options.out ?? DEFAULT_OUTPUT_DIR;
  const files: WrittenFile[] = [];

  if (options.report !== false) {
    files.push(
      await writeArtifact(rootDir, path.join(outputDir, REPORT_FILE_NAME), result.report, options),
    );
  }

  if (options.tokens !== false) {
    files.push(
      await writeArtifact(
        rootDir,
        path.join(outputDir, TOKENS_FILE_NAME),
        buildDesignTokens(result.tokenCandidates),
        options,
      ),
    );
  }

  return files;
}

/**
 * JSON artifacts are always rewritten: they describe the current scan, so a
 * stale file is worse than an overwritten one.
 */
async function writeArtifact(
  rootDir: string,
  relativePath: string,
  data: unknown,
  options: GenerateCommandOptions,
): Promise<WrittenFile> {
  if (options.dryRun !== true) {
    await writeJsonFile(path.join(rootDir, relativePath), data);
  }
  return { filePath: toPosixPath(relativePath), status: 'written' };
}

function printFiles(reporter: Reporter, files: readonly WrittenFile[]): void {
  for (const file of files) {
    if (file.status === 'written') {
      reporter.raw(`+ ${file.filePath}`);
    } else if (file.status === 'exists') {
      reporter.skipped(`${file.filePath} — ${file.reason ?? 'already exists'}`);
    } else {
      reporter.skipped(`${file.filePath} — ${file.reason ?? 'skipped'}`);
    }
  }
  reporter.blank();
}

function summariseWrittenFiles(
  files: readonly WrittenFile[],
  options: GenerateCommandOptions = {},
): string {
  const written = files.filter((file) => file.status === 'written').length;
  const skipped = files.length - written;
  const verb = options.dryRun === true ? 'Would write' : 'Wrote';
  const tail = skipped === 0 ? '' : `, skipped ${skipped}`;
  return `${verb} ${plural(written, 'file')}${tail}.`;
}

async function exists(absolutePath: string): Promise<boolean> {
  try {
    await fs.stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}
