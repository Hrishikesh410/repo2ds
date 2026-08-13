import type { FrameworkId } from '../models/index.js';

export type FrameworkSetting = FrameworkId | 'auto';

/**
 * Where generated stories go.
 *
 * `beside` writes `Button.stories.tsx` next to `Button.tsx`, which is what a
 * project that already writes stories expects. `folder` builds a directory of
 * component folders instead, leaving the application untouched. `auto` picks
 * `beside` when the repository already has stories and `folder` when it has
 * none, on the grounds that a project with no stories has no convention to
 * follow yet.
 */
export type StoryLayout = 'auto' | 'beside' | 'folder';

export const STORY_LAYOUTS: readonly StoryLayout[] = ['auto', 'beside', 'folder'];

/** Shape of a user provided `repo2ds.config.ts`. Every field is optional. */
export interface Repo2DSConfig {
  /** `auto` detects the framework(s) from the project manifest and its sources. */
  framework?: FrameworkSetting;
  include?: string[];
  exclude?: string[];
  /** Files larger than this are skipped with a `file-too-large` diagnostic. */
  maxFileSizeKb?: number;
  storybook?: {
    enabled?: boolean;
    layout?: StoryLayout;
    /** Repository-relative directory for the `folder` layout. */
    componentsDir?: string;
    /**
     * Package generated stories import `Meta` and `StoryObj` from. Storybook 9
     * projects import from the framework package, such as
     * `@storybook/react-vite` or `@storybook/nextjs`.
     */
    package?: string;
  };
  tokens?: {
    enabled?: boolean;
    /** How often a value must repeat before it is reported. Defaults to 2. */
    minUsageCount?: number;
  };
}

export interface ResolvedConfig {
  framework: FrameworkSetting;
  include: string[];
  exclude: string[];
  maxFileSizeKb: number;
  storybook: {
    enabled: boolean;
    layout: StoryLayout;
    componentsDir: string;
    /** Absent means each framework's own default package. */
    package?: string;
  };
  tokens: { enabled: boolean; minUsageCount: number };
}

export const DEFAULT_INCLUDE: readonly string[] = ['**/*.{ts,tsx,js,jsx}'];

/**
 * Directories and files that never contain hand written product source. Kept
 * conservative: excluding too much silently hides components, excluding too
 * little makes scans slow and noisy.
 */
export const DEFAULT_EXCLUDE: readonly string[] = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.git/**',
  '**/.next/**',
  '**/.expo/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/storybook-static/**',
  '**/ios/**',
  '**/android/**',
  '**/*.d.ts',
  '**/*.min.js',
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/*.stories.*',
  // Demonstrations of components rather than components, in the same way a
  // story is. Repo2DS writes these itself, and scanning its own output would
  // report `ButtonExample` as a component on the next run.
  '**/*.example.*',
];

export const DEFAULT_MAX_FILE_SIZE_KB = 512;

/**
 * Generated component folders live here. Not a dot directory: this is code the
 * project may decide to keep, so it should be as visible as the choice is.
 */
export const DEFAULT_COMPONENTS_DIR = 'repo2ds/components';

/** A value seen once is an occurrence; a value seen twice is a pattern. */
export const DEFAULT_MIN_TOKEN_USAGE = 2;

export const DEFAULT_CONFIG: ResolvedConfig = {
  framework: 'auto',
  include: [...DEFAULT_INCLUDE],
  exclude: [...DEFAULT_EXCLUDE],
  maxFileSizeKb: DEFAULT_MAX_FILE_SIZE_KB,
  storybook: { enabled: true, layout: 'auto', componentsDir: DEFAULT_COMPONENTS_DIR },
  tokens: { enabled: true, minUsageCount: DEFAULT_MIN_TOKEN_USAGE },
};

/**
 * Merges user configuration over the defaults. `include` and `exclude` replace
 * the defaults when provided rather than merging, so a project can opt out of
 * an unwanted default; {@link DEFAULT_EXCLUDE} is exported for re-use.
 */
export function resolveConfig(config: Repo2DSConfig = {}): ResolvedConfig {
  const exclude = normalisePatterns(config.exclude)?.map(expandDirectoryPattern);
  return {
    framework: config.framework ?? DEFAULT_CONFIG.framework,
    include: normalisePatterns(config.include) ?? [...DEFAULT_INCLUDE],
    exclude: exclude ?? [...DEFAULT_EXCLUDE],
    maxFileSizeKb: config.maxFileSizeKb ?? DEFAULT_MAX_FILE_SIZE_KB,
    storybook: {
      enabled: config.storybook?.enabled ?? true,
      layout: config.storybook?.layout ?? 'auto',
      componentsDir: normaliseDirectory(config.storybook?.componentsDir) ?? DEFAULT_COMPONENTS_DIR,
      ...(config.storybook?.package?.trim() ? { package: config.storybook.package.trim() } : {}),
    },
    tokens: {
      enabled: config.tokens?.enabled ?? true,
      minUsageCount: config.tokens?.minUsageCount ?? DEFAULT_MIN_TOKEN_USAGE,
    },
  };
}

/** Accepts `./design-system/` as readily as `design-system`. */
function normaliseDirectory(directory: string | undefined): string | undefined {
  const trimmed = directory?.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalisePatterns(patterns: string[] | undefined): string[] | undefined {
  if (!patterns) {
    return undefined;
  }
  const cleaned = patterns.map((pattern) => pattern.trim()).filter((pattern) => pattern.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Users habitually write `exclude: ['node_modules', 'dist']`. Bare names are
 * treated as "this directory, anywhere" so they behave as expected.
 */
export function expandDirectoryPattern(pattern: string): string {
  const trimmed = pattern.replace(/\/+$/, '');
  const looksLikeGlob = /[*?[\]{}]/.test(trimmed);
  const looksLikeFile = /\.[a-z0-9]+$/i.test(trimmed);
  if (looksLikeGlob || looksLikeFile || trimmed.length === 0) {
    return pattern;
  }
  return trimmed.includes('/') ? `${trimmed}/**` : `**/${trimmed}/**`;
}
