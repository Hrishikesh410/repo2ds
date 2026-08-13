export type TokenCategory = 'color' | 'spacing' | 'typography' | 'radius' | 'shadow' | 'unknown';

const TOKEN_CATEGORY_LABELS: Record<TokenCategory, string> = {
  color: 'Colors',
  spacing: 'Spacing',
  typography: 'Typography',
  radius: 'Radius',
  shadow: 'Shadows',
  unknown: 'Other',
};

/** One vocabulary for category headings, so every command names them the same. */
export function tokenCategoryLabel(category: TokenCategory): string {
  return TOKEN_CATEGORY_LABELS[category];
}

/**
 * A repeated style value that *may* represent a design token.
 *
 * Repo2DS never claims a value is a design token: it reports candidates with a
 * deterministic confidence score and the evidence behind it, so a human makes
 * the final call.
 */
export interface TokenCandidate {
  category: TokenCategory;
  value: string | number;
  usageCount: number;
  /** `file:line:col` strings, sorted, so output is stable across runs. */
  locations: string[];
  /** 0..1, produced by the documented deterministic scoring model. */
  confidence: number;
  /** Human readable reasons behind the score, e.g. `Used by 21 components`. */
  evidence: string[];
}
