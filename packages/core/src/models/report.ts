import type { ComponentInfo } from './component.js';
import type { Diagnostic } from './diagnostic.js';
import type { FrameworkId } from './framework.js';
import type { StylingSystemId } from './styling.js';
import type { TokenCandidate } from './token.js';

/**
 * Bumped whenever the report shape changes in a backwards-incompatible way.
 * Downstream consumers (token pipelines, and eventually an MCP server) read the
 * report instead of re-analysing source code, so the shape is a public API.
 */
export const REPORT_SCHEMA_VERSION = 1;

export interface ReportProject {
  name: string;
  frameworks: FrameworkId[];
  /** Styling systems detected, e.g. `tailwind`. Empty when none was found. */
  stylingSystems: StylingSystemId[];
}

/** Counts of distinct token candidates per category, not of their usages. */
export interface ScanStatistics {
  components: number;
  filesScanned: number;
  colorValues: number;
  spacingValues: number;
  typographyValues: number;
  radiusValues: number;
  shadowValues: number;
}

export interface ScanReport {
  schemaVersion: number;
  project: ReportProject;
  components: ComponentInfo[];
  tokenCandidates: TokenCandidate[];
  statistics: ScanStatistics;
  /** Everything the scan could not fully analyse. Never machine-path dependent. */
  diagnostics: Diagnostic[];
}
