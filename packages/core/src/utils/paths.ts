import path from 'node:path';

/** Extensions Repo2DS is able to parse. */
export const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;

/** Normalises Windows separators so reports and snapshots are platform independent. */
export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

/** Repository-relative, POSIX separated path used everywhere in the public models. */
export function toRelativePosixPath(rootDir: string, absolutePath: string): string {
  return toPosixPath(path.relative(rootDir, absolutePath));
}

export function hasSupportedExtension(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Suffixes Metro and React Native for Web resolve by platform, so that
 * `import './Button'` picks up `Button.ios.tsx` on iOS.
 */
const PLATFORM_SUFFIXES = new Set(['ios', 'android', 'native', 'web', 'windows', 'macos']);

/** `src/Button.ios.tsx` is written for iOS; `src/Button.tsx` is for every platform. */
export function platformOf(filePath: string): string | undefined {
  const parts = path.posix.basename(toPosixPath(filePath)).split('.');
  if (parts.length < 3) {
    return undefined;
  }

  const suffix = parts[parts.length - 2];
  return suffix !== undefined && PLATFORM_SUFFIXES.has(suffix) ? suffix : undefined;
}

/**
 * `src/Button.ios.tsx` becomes `src/Button.tsx`.
 *
 * Importing the platform-neutral path is the only correct way to reference a
 * component that has platform variants: naming one of the variants would pin
 * every platform to it.
 */
export function withoutPlatformSuffix(filePath: string): string {
  const posixPath = toPosixPath(filePath);
  if (!platformOf(posixPath)) {
    return posixPath;
  }

  const directory = path.posix.dirname(posixPath);
  const parts = path.posix.basename(posixPath).split('.');
  parts.splice(parts.length - 2, 1);
  const base = parts.join('.');

  return directory === '.' ? base : path.posix.join(directory, base);
}
