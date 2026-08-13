import type { Diagnostic } from '@repo2ds/core';
import { countDiagnostics, formatLocation, plural } from '@repo2ds/core';
import type { Reporter } from './reporter.js';

const DEFAULT_LIMIT = 10;

/** Prints the first `limit` diagnostics, then how many were withheld. */
export function printDiagnostics(
  reporter: Reporter,
  diagnostics: readonly Diagnostic[],
  limit = DEFAULT_LIMIT,
): void {
  if (diagnostics.length === 0) {
    return;
  }

  for (const diagnostic of diagnostics.slice(0, limit)) {
    const where = diagnostic.filePath
      ? ` ${formatLocation(diagnostic.filePath, diagnostic.location)}`
      : '';
    const line = `${diagnostic.code}${where} — ${diagnostic.message}`;
    if (diagnostic.status === 'error') {
      reporter.failure(line);
    } else if (diagnostic.status === 'skipped') {
      reporter.skipped(line);
    } else {
      reporter.warning(line);
    }
    if (diagnostic.detail) {
      reporter.bullet(diagnostic.detail);
    }
  }

  const withheld = diagnostics.length - limit;
  if (withheld > 0) {
    reporter.note(`…and ${withheld} more (see the JSON report for the full list)`);
  }
  reporter.blank();
}

/** `Scan completed with 2 warnings and 1 error.` */
export function summariseDiagnostics(diagnostics: readonly Diagnostic[]): string {
  const counts = countDiagnostics(diagnostics);
  const parts: string[] = [];
  if (counts.error > 0) {
    parts.push(plural(counts.error, 'error'));
  }
  if (counts.warning > 0) {
    parts.push(plural(counts.warning, 'warning'));
  }
  if (counts.skipped > 0) {
    parts.push(`${counts.skipped} skipped ${counts.skipped === 1 ? 'file' : 'files'}`);
  }
  if (parts.length === 0) {
    return 'Scan completed with no warnings.';
  }
  return `Scan completed with ${joinWithAnd(parts)}.`;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length === 1) {
    return parts[0] as string;
  }
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] as string}`;
}
