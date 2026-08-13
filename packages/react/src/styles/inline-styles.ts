import type { DiagnosticCollector, StyleSource, StyleUsage } from '@repo2ds/core';
import type { JsxAttribute, ObjectLiteralExpression, SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import { locationOf } from '../component-discovery/jsx-components.js';
import { findEnclosingComponentName } from './enclosing-component.js';
import { readStyleValue } from './style-values.js';

export interface StyleExtractionContext {
  /** Repository-relative path of the file being analysed. */
  filePath: string;
  diagnostics: DiagnosticCollector;
}

/**
 * Style attributes in the file.
 *
 * `style` plus any `*Style` prop, because React Native and most component
 * libraries expose additional style props (`contentContainerStyle`,
 * `labelStyle`) that hold exactly the same kind of design values.
 */
export function findStyleAttributes(sourceFile: SourceFile): JsxAttribute[] {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.JsxAttribute)
    .filter((attribute) => /^style$|Style$/.test(attribute.getNameNode().getText()));
}

/**
 * Extracts `style={{ padding: 16 }}` declarations.
 *
 * Array syntax (`style={[styles.base, { padding: 4 }]}`) is understood too:
 * object literals inside the array are read here, while references such as
 * `styles.base` are resolved by the React Native adapter.
 */
export function extractInlineStyles(
  sourceFile: SourceFile,
  context: StyleExtractionContext,
): StyleUsage[] {
  const usages: StyleUsage[] = [];

  for (const attribute of findStyleAttributes(sourceFile)) {
    const expression = attribute.getInitializer();
    if (!expression?.isKind(SyntaxKind.JsxExpression)) {
      continue;
    }

    const inner = expression.getExpression();
    if (!inner) {
      continue;
    }

    const componentName = findEnclosingComponentName(attribute);

    if (inner.isKind(SyntaxKind.ObjectLiteralExpression)) {
      collectObjectStyles(inner, '', 'inline', componentName, context, usages);
      continue;
    }

    if (inner.isKind(SyntaxKind.ArrayLiteralExpression)) {
      for (const element of inner.getElements()) {
        if (element.isKind(SyntaxKind.ObjectLiteralExpression)) {
          collectObjectStyles(element, '', 'inline', componentName, context, usages);
        }
      }
    }
  }

  return usages;
}

/**
 * Reads the declarations of a style object. Nested objects (React Native's
 * `shadowOffset`, for example) are flattened with dot notation.
 */
export function collectObjectStyles(
  objectLiteral: ObjectLiteralExpression,
  prefix: string,
  source: StyleSource,
  componentName: string | undefined,
  context: StyleExtractionContext,
  usages: StyleUsage[],
  origin?: string,
): void {
  for (const property of objectLiteral.getProperties()) {
    if (property.isKind(SyntaxKind.SpreadAssignment)) {
      context.diagnostics.skip(
        'dynamic-style',
        'Spread in a style object cannot be resolved statically.',
        {
          filePath: context.filePath,
          location: locationOf(property),
          detail: property.getText(),
        },
      );
      continue;
    }

    if (property.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
      context.diagnostics.warn('dynamic-style', 'Style value is not a literal.', {
        filePath: context.filePath,
        location: locationOf(property),
        detail: property.getText(),
      });
      continue;
    }

    if (!property.isKind(SyntaxKind.PropertyAssignment)) {
      continue;
    }

    const name = `${prefix}${property.getName().replace(/^['"]|['"]$/g, '')}`;
    const initializer = property.getInitializer();
    if (!initializer) {
      continue;
    }

    if (initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
      collectObjectStyles(initializer, `${name}.`, source, componentName, context, usages, origin);
      continue;
    }

    const location = locationOf(property);
    const result = readStyleValue(initializer);

    if (result.kind === 'dynamic') {
      context.diagnostics.warn(
        'dynamic-style',
        `Unable to statically resolve style value for "${name}".`,
        { filePath: context.filePath, location, detail: `${name}: ${result.text}` },
      );
      usages.push({
        property: name,
        value: result.text,
        source,
        dynamic: true,
        filePath: context.filePath,
        location,
        ...(componentName ? { componentName } : {}),
        ...(origin ? { origin } : {}),
      });
      continue;
    }

    for (const value of result.values) {
      usages.push({
        property: name,
        value,
        source,
        filePath: context.filePath,
        location,
        ...(componentName ? { componentName } : {}),
        ...(origin ? { origin } : {}),
      });
    }
  }
}
