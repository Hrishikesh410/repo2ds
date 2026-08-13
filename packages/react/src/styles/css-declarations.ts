import type { SourceLocation } from '@repo2ds/core';

export interface CssDeclaration {
  selector: string;
  property: string;
  value: string;
  /** True when the value depends on a variable Repo2DS will not resolve. */
  dynamic: boolean;
  /** Where the declaration was written in the stylesheet, one based. */
  location: SourceLocation;
}

const COMMENTS = /\/\*[\s\S]*?\*\//g;
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const PROPERTY = /^-{0,2}[a-zA-Z][a-zA-Z0-9-]*$/;
const DYNAMIC_VALUE = /var\(|\$[a-zA-Z]|@[a-zA-Z]|#\{/;

/**
 * Extracts plain declarations from a stylesheet.
 *
 * This is deliberately not a CSS parser: Repo2DS only needs `property: value`
 * pairs to spot repeated design values. Nested blocks (media queries, Sass) fall
 * out naturally because inner rules match before their wrapper, and anything
 * referencing a variable is marked dynamic instead of being resolved.
 */
export function parseCssDeclarations(css: string): CssDeclaration[] {
  const blanked = blankComments(css);
  const lineStarts = findLineStarts(blanked);
  const declarations: CssDeclaration[] = [];

  for (const match of blanked.matchAll(RULE)) {
    const selector = normaliseSelector(match[1] ?? '');
    const body = match[2] ?? '';
    const bodyStart = (match.index ?? 0) + (match[1] ?? '').length + 1;

    let offset = 0;
    for (const chunk of body.split(';')) {
      const chunkStart = bodyStart + offset;
      offset += chunk.length + 1;

      const separator = chunk.indexOf(':');
      if (separator === -1) {
        continue;
      }

      const property = chunk.slice(0, separator).trim();
      const value = chunk.slice(separator + 1).trim();
      if (!PROPERTY.test(property) || value.length === 0) {
        continue;
      }

      declarations.push({
        selector,
        property,
        value,
        dynamic: DYNAMIC_VALUE.test(value),
        location: locationAt(lineStarts, chunkStart + chunk.indexOf(property)),
      });
    }
  }

  return declarations;
}

/**
 * Replaces comments with spaces rather than removing them, so every remaining
 * character keeps the line and column it has in the original file.
 */
function blankComments(css: string): string {
  return css.replace(COMMENTS, (comment) => comment.replace(/[^\n]/g, ' '));
}

function findLineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return starts;
}

/** Binary search, so a large stylesheet stays linear overall rather than quadratic. */
function locationAt(lineStarts: readonly number[], offset: number): SourceLocation {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((lineStarts[middle] ?? 0) <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return { line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 };
}

function normaliseSelector(selector: string): string {
  return selector.replace(/\s+/g, ' ').trim();
}

const VAR_REFERENCE = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/;
const MAX_VARIABLE_DEPTH = 5;

/** Index of the custom properties a stylesheet declares, by name. */
export function collectCustomProperties(
  declarations: readonly CssDeclaration[],
): Map<string, string> {
  const variables = new Map<string, string>();
  for (const declaration of declarations) {
    if (declaration.property.startsWith('--')) {
      variables.set(declaration.property, declaration.value);
    }
  }
  return variables;
}

/**
 * Resolves `var(--surface)` to the value declared in the same stylesheet.
 *
 * A project using custom properties has already chosen its tokens, and without
 * this every reference would count as a dynamic value while each definition
 * counted only once — hiding the palette that is actually in use. Only
 * definitions from the same file are used, and a declared fallback is taken when
 * the variable is defined elsewhere.
 */
export function resolveCssValue(
  value: string,
  variables: ReadonlyMap<string, string>,
  depth = 0,
): { value: string; dynamic: boolean } {
  const match = VAR_REFERENCE.exec(value.trim());
  if (!match) {
    return { value, dynamic: DYNAMIC_VALUE.test(value) };
  }

  if (depth >= MAX_VARIABLE_DEPTH) {
    return { value, dynamic: true };
  }

  const name = match[1] ?? '';
  const fallback = match[2]?.trim();
  const declared = variables.get(name) ?? fallback;

  if (declared === undefined) {
    return { value, dynamic: true };
  }

  return resolveCssValue(declared, variables, depth + 1);
}
