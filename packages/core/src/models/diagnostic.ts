import type { SourceLocation } from './source-location.js';

/**
 * `warning` — analysed, but something was imprecise or ignored.
 * `error`   — a file could not be analysed at all; the scan continues.
 * `skipped` — deliberately not analysed (too large, unsupported, dynamic).
 */
export type DiagnosticStatus = 'warning' | 'error' | 'skipped';

export interface Diagnostic {
  status: DiagnosticStatus;
  /** Stable kebab-case identifier so consumers can filter without parsing messages. */
  code: string;
  message: string;
  /** Repository-relative path, when the diagnostic relates to a file. */
  filePath?: string;
  location?: SourceLocation;
  /** Optional extra context, e.g. the skipped expression source text. */
  detail?: string;
}

export interface DiagnosticCounts {
  warning: number;
  error: number;
  skipped: number;
}

export function countDiagnostics(diagnostics: readonly Diagnostic[]): DiagnosticCounts {
  const counts: DiagnosticCounts = { warning: 0, error: 0, skipped: 0 };
  for (const diagnostic of diagnostics) {
    counts[diagnostic.status] += 1;
  }
  return counts;
}
