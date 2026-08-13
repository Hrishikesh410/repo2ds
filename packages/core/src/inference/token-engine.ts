import type { StyleUsage, TokenCandidate, TokenCategory } from '../models/index.js';
import { formatLocation } from '../models/index.js';
import { plural } from '../utils/index.js';
import { scoreConfidence } from './confidence.js';
import { extractTokenValues } from './token-values.js';

/** Categories are reported in this order, roughly by how often they are useful. */
const CATEGORY_ORDER: TokenCategory[] = ['color', 'spacing', 'typography', 'radius', 'shadow'];

/**
 * Cap on recorded locations per candidate. A colour used 400 times does not need
 * 400 locations in the report to be believable, and the count stays exact.
 */
export const MAX_RECORDED_LOCATIONS = 20;

export interface TokenInferenceOptions {
  /** Minimum usages before a value is reported. Defaults to 2. */
  minUsageCount?: number;
}

interface Aggregate {
  category: TokenCategory;
  value: string | number;
  usageCount: number;
  semanticCount: number;
  components: Set<string>;
  files: Set<string>;
  properties: Map<string, number>;
  /** A set, because two branches of a conditional share one source location. */
  locations: Set<string>;
}

/**
 * Groups style values and reports the repeated ones as token candidates.
 *
 * The engine is deliberately dumb and deterministic: it counts, it groups, it
 * scores with a published formula. It never names a token and never claims a
 * candidate *is* a design token — that judgement stays with the reader.
 */
export class TokenInferenceEngine {
  private readonly minUsageCount: number;

  constructor(options: TokenInferenceOptions = {}) {
    this.minUsageCount = Math.max(1, options.minUsageCount ?? 2);
  }

  infer(styles: readonly StyleUsage[]): TokenCandidate[] {
    const aggregates = new Map<string, Aggregate>();
    const countedDeclarations = new Set<string>();

    for (const style of styles) {
      if (style.dynamic || isAlreadyCounted(style, countedDeclarations)) {
        continue;
      }

      for (const tokenValue of extractTokenValues(style.property, style.value)) {
        const key = `${tokenValue.category}|${typeof tokenValue.value}|${String(tokenValue.value)}`;
        const aggregate = aggregates.get(key) ?? {
          category: tokenValue.category,
          value: tokenValue.value,
          usageCount: 0,
          semanticCount: 0,
          components: new Set<string>(),
          files: new Set<string>(),
          properties: new Map<string, number>(),
          locations: new Set<string>(),
        };

        aggregate.usageCount += 1;
        if (tokenValue.semantic) {
          aggregate.semanticCount += 1;
        }
        if (style.componentName) {
          aggregate.components.add(style.componentName);
        }
        if (style.filePath) {
          aggregate.files.add(style.filePath);
          if (aggregate.locations.size < MAX_RECORDED_LOCATIONS) {
            aggregate.locations.add(formatLocation(style.filePath, style.location));
          }
        }
        aggregate.properties.set(
          style.property,
          (aggregate.properties.get(style.property) ?? 0) + 1,
        );

        aggregates.set(key, aggregate);
      }
    }

    return [...aggregates.values()]
      .filter((aggregate) => aggregate.usageCount >= this.minUsageCount)
      .map((aggregate) => toCandidate(aggregate))
      .sort(byCategoryThenUsage);
  }
}

/**
 * A stylesheet declaration is one design decision however many components use
 * it. Adapters report it once per component so the inventory stays accurate,
 * which means a `theme.css` imported by fifty components arrives here fifty
 * times; counting all of them would rank one global rule above a value that is
 * genuinely repeated. Inline styles and utility classes are left alone: those
 * are written out at each place they appear.
 */
function isAlreadyCounted(style: StyleUsage, counted: Set<string>): boolean {
  if (style.source !== 'stylesheet' || !style.filePath || !style.location) {
    return false;
  }

  const key = [
    style.filePath,
    style.location.line,
    style.location.column,
    style.property,
    String(style.value),
  ].join('|');

  if (counted.has(key)) {
    return true;
  }

  counted.add(key);
  return false;
}

function toCandidate(aggregate: Aggregate): TokenCandidate {
  return {
    category: aggregate.category,
    value: aggregate.value,
    usageCount: aggregate.usageCount,
    locations: [...aggregate.locations].sort(),
    confidence: scoreConfidence({
      usageCount: aggregate.usageCount,
      componentCount: aggregate.components.size,
      fileCount: aggregate.files.size,
      semanticRatio: aggregate.semanticCount / aggregate.usageCount,
    }),
    evidence: buildEvidence(aggregate),
  };
}

function buildEvidence(aggregate: Aggregate): string[] {
  const evidence = [`Used ${plural(aggregate.usageCount, 'time')}`];

  if (aggregate.components.size > 0) {
    evidence.push(`Used by ${plural(aggregate.components.size, 'component')}`);
  }

  const topProperty = [...aggregate.properties.entries()].sort(byCountThenName)[0];
  if (topProperty) {
    evidence.push(`Used for ${topProperty[0]} in ${plural(topProperty[1], 'location')}`);
  }

  if (aggregate.files.size > 1) {
    evidence.push(`Repeated across ${plural(aggregate.files.size, 'file')}`);
  } else if (aggregate.files.size === 1) {
    evidence.push('Found in a single file');
  }

  return evidence;
}

function byCountThenName(a: [string, number], b: [string, number]): number {
  if (a[1] !== b[1]) {
    return b[1] - a[1];
  }
  return a[0] < b[0] ? -1 : 1;
}

function byCategoryThenUsage(a: TokenCandidate, b: TokenCandidate): number {
  const categoryDelta = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (categoryDelta !== 0) {
    return categoryDelta;
  }
  if (a.usageCount !== b.usageCount) {
    return b.usageCount - a.usageCount;
  }
  return String(a.value) < String(b.value) ? -1 : 1;
}
