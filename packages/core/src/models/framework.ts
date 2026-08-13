/**
 * Frameworks Repo2DS can analyse. New frameworks are added by shipping a
 * {@link import('../ports/framework-adapter.js').FrameworkAdapter}, never by
 * branching inside the core pipeline.
 */
export type FrameworkId = 'react' | 'react-native';

export const FRAMEWORK_IDS: readonly FrameworkId[] = ['react', 'react-native'];

/** Human readable label used in CLI output and reports. */
export function frameworkLabel(framework: FrameworkId): string {
  return framework === 'react' ? 'React' : 'React Native';
}
