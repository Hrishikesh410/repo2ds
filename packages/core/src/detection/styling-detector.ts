import fs from 'node:fs';
import path from 'node:path';
import type { StylingSystemId } from '../models/index.js';
import type { ProjectManifest, WorkspaceLayout } from '../scanner/index.js';

export interface StylingDetection {
  systems: StylingSystemId[];
  evidence: string[];
}

const CONFIG_FILES = [
  'tailwind.config.js',
  'tailwind.config.ts',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
];

export interface DetectStylingOptions {
  manifest: ProjectManifest;
  rootDir: string;
  /** Injected for testing; defaults to checking the file system. */
  fileExists?: (absolutePath: string) => boolean;
  /**
   * Workspace packages below the root. In a monorepo the root manifest usually
   * says nothing about styling, and the package that uses Tailwind is the one
   * that depends on it.
   */
  workspace?: WorkspaceLayout;
}

/**
 * Detects the styling systems in use from declared dependencies and config
 * files.
 *
 * Utility class parsing is only enabled for projects that actually use it: in
 * any other project a `className` holds the project's own class names, and
 * reading them as Tailwind utilities would invent styles that do not exist.
 */
export function detectStylingSystems(options: DetectStylingOptions): StylingDetection {
  const exists = options.fileExists ?? defaultFileExists;
  const systems = new Set<StylingSystemId>();
  const evidence: string[] = [];

  const record = (dependencies: Record<string, string>, source: string): void => {
    if (dependencies['nativewind']) {
      systems.add('nativewind');
      evidence.push(`nativewind found in ${source}`);
    }
    if (dependencies['tailwindcss']) {
      systems.add('tailwind');
      evidence.push(`tailwindcss found in ${source}`);
    }
  };

  record(options.manifest.dependencies, 'package.json');

  const configFile = CONFIG_FILES.find((file) => exists(path.join(options.rootDir, file)));
  if (configFile) {
    systems.add('tailwind');
    evidence.push(`${configFile} found`);
  }

  for (const workspacePackage of options.workspace?.packages ?? []) {
    record(workspacePackage.dependencies, workspacePackage.filePath);
  }

  for (const config of options.workspace?.tailwindConfigs ?? []) {
    systems.add('tailwind');
    evidence.push(`${config} found`);
  }

  return { systems: [...systems].sort(), evidence };
}

function defaultFileExists(absolutePath: string): boolean {
  try {
    return fs.existsSync(absolutePath);
  } catch {
    return false;
  }
}
