import type { FrameworkSetting } from '../config/index.js';
import type { FrameworkId } from '../models/index.js';
import { FRAMEWORK_IDS, frameworkLabel } from '../models/index.js';
import type { ProjectManifest } from '../scanner/index.js';

export interface FrameworkDetection {
  /** Detected frameworks in a stable order. Empty when nothing was recognised. */
  frameworks: FrameworkId[];
  /** True when a repository contains both React and React Native code. */
  mixed: boolean;
  /** Why each framework was selected, for CLI output and the report. */
  evidence: string[];
}

/** Dependencies that identify a React Native project. */
const REACT_NATIVE_PACKAGES = ['react-native', 'expo'];

/** Dependencies that identify a React (DOM) project. */
const REACT_PACKAGES = ['react-dom', 'next', 'react-scripts', 'gatsby', 'remix'];

/**
 * Detects frameworks from the project manifest.
 *
 * Manifest evidence alone is enough for the common cases: `react-native` and
 * `expo` mean React Native, `react-dom` and the web meta-frameworks mean React.
 * A bare `react` dependency is ambiguous — React Native depends on it too — so
 * it only counts as React when no React Native dependency is present.
 */
export function detectFrameworksFromManifest(manifest: ProjectManifest): FrameworkDetection {
  const evidence: string[] = [];
  const detected = new Set<FrameworkId>();

  for (const dependency of REACT_NATIVE_PACKAGES) {
    if (dependency in manifest.dependencies) {
      detected.add('react-native');
      evidence.push(`package.json depends on ${dependency}`);
    }
  }

  for (const dependency of REACT_PACKAGES) {
    if (dependency in manifest.dependencies) {
      detected.add('react');
      evidence.push(`package.json depends on ${dependency}`);
    }
  }

  if (!detected.has('react') && !detected.has('react-native') && 'react' in manifest.dependencies) {
    detected.add('react');
    evidence.push('package.json depends on react');
  }

  return toDetection(detected, evidence);
}

/**
 * Applies the `framework` configuration setting. An explicit setting always
 * wins over detection so users can force a single adapter; `auto` defers to
 * {@link detectFrameworksFromManifest}.
 */
export function resolveFrameworks(
  setting: FrameworkSetting,
  manifest: ProjectManifest,
): FrameworkDetection {
  if (setting === 'auto') {
    return detectFrameworksFromManifest(manifest);
  }
  return {
    frameworks: [setting],
    mixed: false,
    evidence: [`framework set to "${frameworkLabel(setting)}" in configuration`],
  };
}

function toDetection(detected: ReadonlySet<FrameworkId>, evidence: string[]): FrameworkDetection {
  const frameworks = FRAMEWORK_IDS.filter((framework) => detected.has(framework));
  return { frameworks: [...frameworks], mixed: frameworks.length > 1, evidence };
}
