import type { TokenCandidate, TokenCategory } from '@repo2ds/core';
import { buildDesignTokens, plural, tokenCategoryLabel } from '@repo2ds/core';
import type { Reporter } from '../output/reporter.js';
import type { CommandEnvironment, CommonOptions } from './shared.js';
import { analyse, createReporter, printJson } from './shared.js';
import { printConfigNote } from './scan.js';

export interface TokensCommandOptions extends CommonOptions {
  category?: string;
  /** Hide candidates the scoring model is not confident about. */
  minConfidence?: number;
  /** Show where each value was found. Off by default; the lists get long. */
  locations?: boolean;
}

/** `repo2ds tokens [path]` — list repeated style values as token candidates. */
export async function runTokens(
  target: string | undefined,
  options: TokensCommandOptions,
  env: CommandEnvironment,
): Promise<void> {
  const analysed = await analyse(target, options, env);
  const candidates = selectCandidates(analysed.result.tokenCandidates, options);

  if (options.json) {
    printJson(env, buildDesignTokens(candidates));
    return;
  }

  const reporter = createReporter(env);

  reporter.title('Token candidates');
  reporter.blank();

  if (candidates.length === 0) {
    reporter.note(describeEmpty(options));
    return;
  }

  for (const [category, group] of groupByCategory(candidates)) {
    reporter.note(`${tokenCategoryLabel(category)}:`);
    for (const candidate of group) {
      reporter.raw(`  ${String(candidate.value)}  ${describeCandidate(candidate)}`);
      if (options.locations) {
        printLocations(reporter, candidate);
      }
    }
    reporter.blank();
  }

  printConfigNote(reporter, analysed);
  reporter.note(`${plural(candidates.length, 'candidate')}. Confidence is a hint, not a verdict.`);
}

function selectCandidates(
  candidates: readonly TokenCandidate[],
  options: TokensCommandOptions,
): TokenCandidate[] {
  const minConfidence = options.minConfidence ?? 0;
  const category = options.category?.toLowerCase();

  return candidates.filter(
    (candidate) =>
      candidate.confidence >= minConfidence &&
      (category === undefined || candidate.category === category),
  );
}

/** Candidates arrive sorted by category then usage, so grouping keeps that order. */
function groupByCategory(
  candidates: readonly TokenCandidate[],
): Map<TokenCategory, TokenCandidate[]> {
  const groups = new Map<TokenCategory, TokenCandidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.category) ?? [];
    group.push(candidate);
    groups.set(candidate.category, group);
  }
  return groups;
}

function describeCandidate(candidate: TokenCandidate): string {
  return `${plural(candidate.usageCount, 'use')} · confidence ${candidate.confidence.toFixed(2)}`;
}

function printLocations(reporter: Reporter, candidate: TokenCandidate): void {
  for (const location of candidate.locations) {
    reporter.bullet(`  ${location}`);
  }
}

function describeEmpty(options: TokensCommandOptions): string {
  if (options.category) {
    return `No ${options.category} candidates were found.`;
  }
  return 'No repeated style values were found. Try --min-usage 1 to see every value.';
}
