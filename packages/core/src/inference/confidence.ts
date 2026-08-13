export interface ConfidenceInput {
  usageCount: number;
  componentCount: number;
  fileCount: number;
  /** Share of usages whose category came from the property name (0..1). */
  semanticRatio: number;
}

/**
 * Weights of the four confidence signals. They sum to 1, so a candidate that
 * saturates every signal scores 1.0.
 */
export const CONFIDENCE_WEIGHTS = {
  usage: 0.4,
  components: 0.25,
  files: 0.2,
  semantic: 0.15,
} as const;

/**
 * Usage counts at which a signal is considered fully convincing. Beyond these
 * points more usage cannot increase confidence further.
 */
export const CONFIDENCE_SATURATION = {
  usage: 40,
  components: 12,
  files: 10,
} as const;

/**
 * Scores how likely a repeated value is to be a real design token.
 *
 * ```text
 * confidence = 0.40 × usage      (saturating at 40 usages)
 *            + 0.25 × components (saturating at 12 components)
 *            + 0.20 × files      (saturating at 10 files)
 *            + 0.15 × semantic   (share of usages recognised by property name)
 * ```
 *
 * Each count is scaled logarithmically, because the difference between 1 and 5
 * usages says far more than the difference between 60 and 100. The result is
 * deterministic: the same inputs always produce the same score, and no model or
 * heuristic tuning happens at runtime.
 */
export function scoreConfidence(input: ConfidenceInput): number {
  const usage = saturate(input.usageCount, CONFIDENCE_SATURATION.usage);
  const components = saturate(input.componentCount, CONFIDENCE_SATURATION.components);
  const files = saturate(input.fileCount, CONFIDENCE_SATURATION.files);
  const semantic = clamp(input.semanticRatio);

  const score =
    CONFIDENCE_WEIGHTS.usage * usage +
    CONFIDENCE_WEIGHTS.components * components +
    CONFIDENCE_WEIGHTS.files * files +
    CONFIDENCE_WEIGHTS.semantic * semantic;

  return round(score);
}

function saturate(count: number, saturationPoint: number): number {
  if (count <= 0) {
    return 0;
  }
  return clamp(Math.log1p(count) / Math.log1p(saturationPoint));
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Two decimal places: enough to rank candidates, stable to compare in tests. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
