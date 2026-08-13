import fs from 'node:fs/promises';
import path from 'node:path';
import type { TokenCandidate } from '../models/index.js';

export const DESIGN_TOKENS_SCHEMA_VERSION = 1;

export interface DesignToken {
  value: string | number;
  usageCount: number;
  confidence: number;
}

export interface DesignTokensFile {
  schemaVersion: number;
  /** Candidates grouped by category, in the order the report lists them. */
  tokens: Record<string, DesignToken[]>;
}

/**
 * Groups token candidates into a file that a token pipeline can consume.
 *
 * Values are reported without invented names. Naming a token is a design
 * decision, and a generated name such as `spacing-16` would be a guess
 * masquerading as a decision.
 */
export function buildDesignTokens(
  candidates: readonly TokenCandidate[],
  options: { minConfidence?: number } = {},
): DesignTokensFile {
  const minConfidence = options.minConfidence ?? 0;
  const tokens: Record<string, DesignToken[]> = {};

  for (const candidate of candidates) {
    if (candidate.confidence < minConfidence) {
      continue;
    }
    const group = (tokens[candidate.category] ??= []);
    group.push({
      value: candidate.value,
      usageCount: candidate.usageCount,
      confidence: candidate.confidence,
    });
  }

  return { schemaVersion: DESIGN_TOKENS_SCHEMA_VERSION, tokens };
}

/** Two spaces and a trailing newline: JSON that reads well in a diff. */
export async function writeJsonFile(absolutePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
