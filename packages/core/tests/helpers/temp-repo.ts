import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const createdRoots: string[] = [];

/**
 * Writes a throwaway repository to the OS temp directory.
 * Keys are POSIX relative paths; parent directories are created as needed.
 */
export async function createTempRepo(files: Record<string, string>): Promise<string> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo2ds-test-'));
  createdRoots.push(rootDir);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, ...relativePath.split('/'));
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, contents, 'utf8');
  }

  return rootDir;
}

export async function removeTempRepos(): Promise<void> {
  await Promise.all(
    createdRoots.splice(0).map((rootDir) => fs.rm(rootDir, { recursive: true, force: true })),
  );
}

/** Absolute path to a checked-in fixture repository. */
export function fixturePath(name: string): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  return path.resolve(here, '../../../../fixtures', name);
}
