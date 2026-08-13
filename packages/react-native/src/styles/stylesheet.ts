import type { StyleUsage } from '@repo2ds/core';
import type { StyleExtractionContext } from '@repo2ds/react';
import {
  collectObjectStyles,
  findEnclosingComponentName,
  findStyleAttributes,
} from '@repo2ds/react';
import type { ObjectLiteralExpression, SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

/** Style objects declared in one `StyleSheet.create` call, keyed by their name. */
export type StyleSheetEntries = Map<string, ObjectLiteralExpression>;

/** Every style sheet in a file, keyed by the variable it was assigned to. */
export type StyleSheets = Map<string, StyleSheetEntries>;

export interface StyleReference {
  sheet: string;
  key: string;
  componentName?: string;
}

/** Whether the file uses `StyleSheet.create`, the clearest React Native signal. */
export function usesStyleSheet(sourceFile: SourceFile): boolean {
  return findStyleSheets(sourceFile).size > 0;
}

/**
 * Finds `const styles = StyleSheet.create({ ... })` declarations.
 *
 * Only object literals are read. `StyleSheet.create(buildStyles(theme))` cannot
 * be resolved without running the code, which Repo2DS never does.
 */
export function findStyleSheets(sourceFile: SourceFile): StyleSheets {
  const sheets: StyleSheets = new Map();

  for (const declaration of sourceFile.getVariableDeclarations()) {
    const initializer = declaration.getInitializer();
    if (!initializer?.isKind(SyntaxKind.CallExpression)) {
      continue;
    }

    if (!/^(\w+\.)?StyleSheet\.create$/.test(initializer.getExpression().getText())) {
      continue;
    }

    const argument = initializer.getArguments()[0];
    if (!argument?.isKind(SyntaxKind.ObjectLiteralExpression)) {
      continue;
    }

    const entries: StyleSheetEntries = new Map();
    for (const property of argument.getProperties()) {
      if (!property.isKind(SyntaxKind.PropertyAssignment)) {
        continue;
      }
      const value = property.getInitializer();
      if (value?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        entries.set(property.getName().replace(/^['"]|['"]$/g, ''), value);
      }
    }

    sheets.set(declaration.getName(), entries);
  }

  return sheets;
}

/**
 * Finds where sheet styles are used, so `styles.container` can be attributed to
 * the component that renders it.
 *
 * Every property access inside a style attribute counts, which covers the plain
 * `style={styles.container}`, arrays, conditional selection
 * (`active ? styles.on : styles.off`) and `cond && styles.extra` without needing
 * a case for each shape.
 */
export function findStyleReferences(sourceFile: SourceFile): StyleReference[] {
  const references: StyleReference[] = [];

  for (const attribute of findStyleAttributes(sourceFile)) {
    const expression = attribute.getInitializer();
    if (!expression?.isKind(SyntaxKind.JsxExpression)) {
      continue;
    }

    const componentName = findEnclosingComponentName(attribute);

    for (const accessed of expression.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
      references.push({
        sheet: accessed.getExpression().getText(),
        key: accessed.getName(),
        ...(componentName ? { componentName } : {}),
      });
    }
  }

  return references;
}

/**
 * Extracts the design values held in `StyleSheet.create` declarations.
 *
 * Values are recorded once per declaration rather than once per render site. A
 * shared `styles.card` used by twelve screens describes one design decision, and
 * counting it twelve times would distort the token evidence.
 */
export function extractStyleSheetStyles(
  sourceFile: SourceFile,
  context: StyleExtractionContext,
): StyleUsage[] {
  const sheets = findStyleSheets(sourceFile);
  if (sheets.size === 0) {
    return [];
  }

  const references = findStyleReferences(sourceFile);
  const usages: StyleUsage[] = [];

  for (const [sheetName, entries] of sheets) {
    for (const [key, object] of entries) {
      const componentName = references.find(
        (reference) =>
          reference.sheet === sheetName && reference.key === key && reference.componentName,
      )?.componentName;

      collectObjectStyles(
        object,
        '',
        'stylesheet',
        componentName,
        context,
        usages,
        `${sheetName}.${key}`,
      );
    }
  }

  return usages;
}
