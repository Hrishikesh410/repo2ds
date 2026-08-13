import type {
  ComponentInfo,
  Diagnostic,
  FrameworkId,
  ScanReport,
  StylingSystemId,
  TokenCandidate,
  TokenCategory,
} from '../models/index.js';
import { REPORT_SCHEMA_VERSION } from '../models/index.js';
import type { ProjectManifest } from '../scanner/index.js';

export interface BuildReportInput {
  manifest: ProjectManifest;
  frameworks: readonly FrameworkId[];
  stylingSystems: readonly StylingSystemId[];
  components: readonly ComponentInfo[];
  tokenCandidates: readonly TokenCandidate[];
  filesScanned: number;
  diagnostics: readonly Diagnostic[];
}

/**
 * Assembles the report. Components are sorted by path and name so the JSON is
 * stable across runs and diffable in version control.
 */
export function buildReport(input: BuildReportInput): ScanReport {
  const components = [...input.components].sort(byFileThenName);

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    project: {
      name: input.manifest.name,
      frameworks: [...input.frameworks],
      stylingSystems: [...input.stylingSystems],
    },
    components,
    tokenCandidates: [...input.tokenCandidates],
    statistics: {
      components: components.length,
      filesScanned: input.filesScanned,
      colorValues: countCategory(input.tokenCandidates, 'color'),
      spacingValues: countCategory(input.tokenCandidates, 'spacing'),
      typographyValues: countCategory(input.tokenCandidates, 'typography'),
      radiusValues: countCategory(input.tokenCandidates, 'radius'),
      shadowValues: countCategory(input.tokenCandidates, 'shadow'),
    },
    diagnostics: [...input.diagnostics],
  };
}

function countCategory(candidates: readonly TokenCandidate[], category: TokenCategory): number {
  return candidates.filter((candidate) => candidate.category === category).length;
}

function byFileThenName(a: ComponentInfo, b: ComponentInfo): number {
  if (a.filePath !== b.filePath) {
    return a.filePath < b.filePath ? -1 : 1;
  }
  if (a.name === b.name) {
    return 0;
  }
  return a.name < b.name ? -1 : 1;
}
