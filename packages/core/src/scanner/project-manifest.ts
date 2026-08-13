import fs from 'node:fs/promises';
import path from 'node:path';
import type { DiagnosticCollector } from '../utils/index.js';
import { describeError } from '../utils/index.js';

export interface ProjectManifest {
  /** Package name, falling back to the directory name when unavailable. */
  name: string;
  version?: string;
  /** `dependencies`, `devDependencies` and `peerDependencies` merged into one map. */
  dependencies: Record<string, string>;
}

/**
 * Reads the target repository's `package.json`. The file is parsed as data and
 * never executed; a missing or malformed manifest degrades to a warning because
 * a scan can still succeed without it.
 */
export async function readProjectManifest(
  rootDir: string,
  diagnostics: DiagnosticCollector,
): Promise<ProjectManifest> {
  const fallback: ProjectManifest = { name: path.basename(rootDir), dependencies: {} };
  const manifestPath = path.join(rootDir, 'package.json');

  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf8');
  } catch {
    diagnostics.warn('manifest-missing', 'No package.json found at the repository root.', {
      filePath: 'package.json',
    });
    return fallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    diagnostics.warn('manifest-invalid', 'package.json could not be parsed as JSON.', {
      filePath: 'package.json',
      detail: describeError(error),
    });
    return fallback;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    diagnostics.warn('manifest-invalid', 'package.json is not a JSON object.', {
      filePath: 'package.json',
    });
    return fallback;
  }

  const manifest = parsed as Record<string, unknown>;
  const name = typeof manifest.name === 'string' && manifest.name ? manifest.name : fallback.name;
  const version = typeof manifest.version === 'string' ? manifest.version : undefined;

  return {
    name,
    ...(version === undefined ? {} : { version }),
    dependencies: {
      ...readDependencyMap(manifest.dependencies),
      ...readDependencyMap(manifest.devDependencies),
      ...readDependencyMap(manifest.peerDependencies),
    },
  };
}

function readDependencyMap(value: unknown): Record<string, string> {
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
