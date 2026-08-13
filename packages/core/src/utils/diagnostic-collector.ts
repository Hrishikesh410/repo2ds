import type { Diagnostic, DiagnosticCounts, SourceLocation } from '../models/index.js';
import { countDiagnostics } from '../models/index.js';

export interface DiagnosticContext {
  filePath?: string;
  location?: SourceLocation;
  detail?: string;
}

/**
 * Collects non-fatal problems found while scanning. Every stage of the pipeline
 * shares one collector, so a single unanalysable file never aborts a scan.
 *
 * Diagnostics keep insertion order; because files are processed in sorted order
 * the resulting list is stable between runs on the same input.
 */
export class DiagnosticCollector {
  private readonly diagnostics: Diagnostic[] = [];

  add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  warn(code: string, message: string, context: DiagnosticContext = {}): void {
    this.add({ status: 'warning', code, message, ...context });
  }

  error(code: string, message: string, context: DiagnosticContext = {}): void {
    this.add({ status: 'error', code, message, ...context });
  }

  skip(code: string, message: string, context: DiagnosticContext = {}): void {
    this.add({ status: 'skipped', code, message, ...context });
  }

  all(): readonly Diagnostic[] {
    return this.diagnostics;
  }

  counts(): DiagnosticCounts {
    return countDiagnostics(this.diagnostics);
  }

  get size(): number {
    return this.diagnostics.length;
  }
}
