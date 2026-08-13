import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'tinyglobby';
import { toRelativePosixPath } from '../utils/index.js';

/** How far below the root a workspace package is looked for. */
const MAX_DEPTH = 3;

const IGNORED = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'];

const TAILWIND_CONFIG = 'tailwind.config.{js,cjs,mjs,ts,mts,cts}';

export interface WorkspacePackage {
  /** Repository-relative path of the package.json. */
  filePath: string;
  /** `dependencies`, `devDependencies` and `peerDependencies` merged into one map. */
  dependencies: Record<string, string>;
}

export interface WorkspaceLayout {
  packages: WorkspacePackage[];
  /** Repository-relative paths of Tailwind configs below the root. */
  tailwindConfigs: string[];
}

/**
 * Finds the package manifests and Tailwind configs that belong to workspace
 * packages.
 *
 * A monorepo root usually declares nothing about styling: `tailwindcss` is a
 * dependency of the package that uses it. Reading only the root manifest means
 * a scan of the whole repository silently treats every utility class as a
 * project class name and reports no styles at all.
 *
 * The search is by directory rather than by workspace globs, so it works the
 * same for npm, Yarn, pnpm, Nx and Turborepo, none of which agree on where the
 * package list is written.
 */
export async function readWorkspaceLayout(rootDir: string): Promise<WorkspaceLayout> {
  const [manifestPaths, tailwindConfigs] = await Promise.all([
    find(rootDir, 'package.json'),
    find(rootDir, TAILWIND_CONFIG),
  ]);

  const packages = await Promise.all(
    manifestPaths.map(async (filePath) => readPackage(rootDir, filePath)),
  );

  return {
    packages: packages.filter((entry): entry is WorkspacePackage => entry !== undefined),
    tailwindConfigs,
  };
}

/** Matches a file name at every depth from one below the root down to {@link MAX_DEPTH}. */
async function find(rootDir: string, fileName: string): Promise<string[]> {
  const patterns = Array.from(
    { length: MAX_DEPTH },
    (_, depth) => `${'*/'.repeat(depth + 1)}${fileName}`,
  );

  const matches = await glob({
    patterns,
    ignore: IGNORED,
    cwd: rootDir,
    absolute: true,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    expandDirectories: false,
  });

  return matches.map((absolutePath) => toRelativePosixPath(rootDir, absolutePath)).sort();
}

/** A manifest that cannot be read is skipped: it is somebody else's problem. */
async function readPackage(
  rootDir: string,
  filePath: string,
): Promise<WorkspacePackage | undefined> {
  try {
    const raw = await fs.readFile(path.join(rootDir, filePath), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }

    const manifest = parsed as Record<string, unknown>;
    return {
      filePath,
      dependencies: {
        ...dependencyMap(manifest.dependencies),
        ...dependencyMap(manifest.devDependencies),
        ...dependencyMap(manifest.peerDependencies),
      },
    };
  } catch {
    return undefined;
  }
}

function dependencyMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [name, range] of Object.entries(value)) {
    if (typeof range === 'string') {
      result[name] = range;
    }
  }

  return result;
}
