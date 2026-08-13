import { glob } from 'tinyglobby';
import { toRelativePosixPath } from '../utils/index.js';

const STORY_PATTERN = '**/*.stories.{ts,tsx,js,jsx,mjs,mts}';

/**
 * Directories that hold stories nobody wrote for this project: a dependency's
 * own stories say nothing about whether this repository uses Storybook.
 */
const IGNORED = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/storybook-static/**',
  '**/.git/**',
];

export interface ExistingStories {
  /** Repository-relative, POSIX separated, sorted. Capped for a cheap check. */
  files: string[];
  found: boolean;
}

export interface FindStoriesOptions {
  /**
   * Extra directories to disregard, repository-relative. Repo2DS's own output
   * belongs here: a story it generated last run is not evidence that the
   * project writes stories, and treating it as such would make the second run
   * choose a different layout from the first.
   */
  ignore?: readonly string[];
  limit?: number;
}

/**
 * Looks for stories the project already has.
 *
 * Story files are excluded from the scan itself, so this is a separate pass. It
 * stops at the first handful of matches: the question is only whether the
 * project writes stories, and a repository with a thousand of them answers that
 * as well as one with five.
 */
export async function findExistingStories(
  rootDir: string,
  options: FindStoriesOptions = {},
): Promise<ExistingStories> {
  const { ignore = [], limit = 5 } = options;

  const matches = await glob({
    patterns: [STORY_PATTERN],
    ignore: [...IGNORED, ...ignore.map((directory) => `${trimSlashes(directory)}/**`)],
    cwd: rootDir,
    absolute: true,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    expandDirectories: false,
  });

  const files = matches
    .map((absolutePath) => toRelativePosixPath(rootDir, absolutePath))
    .sort()
    .slice(0, limit);

  return { files, found: matches.length > 0 };
}

function trimSlashes(directory: string): string {
  return directory
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+|\/+$/g, '');
}
