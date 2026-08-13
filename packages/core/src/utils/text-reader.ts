import fs from 'node:fs';

/**
 * Reads a companion file (a stylesheet, for example) during analysis, returning
 * `undefined` when it cannot be read. Injected so adapters stay testable and so
 * file access always goes through one auditable place.
 */
export type ReadTextFile = (absolutePath: string) => string | undefined;

/**
 * Reads from disk, caching by path. Style sheets are commonly imported by many
 * components, and analysis is synchronous, so caching avoids re-reading the same
 * file dozens of times.
 */
export function createCachedTextReader(read: ReadTextFile = readFileSync): ReadTextFile {
  const cache = new Map<string, string | undefined>();
  return (absolutePath) => {
    if (cache.has(absolutePath)) {
      return cache.get(absolutePath);
    }
    const contents = read(absolutePath);
    cache.set(absolutePath, contents);
    return contents;
  };
}

function readFileSync(absolutePath: string): string | undefined {
  try {
    return fs.readFileSync(absolutePath, 'utf8');
  } catch {
    return undefined;
  }
}
