import type { SourceLocation } from '@repo2ds/core';
import type { Node, SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import { locationOf } from '../component-discovery/jsx-components.js';
import { findEnclosingComponentName } from './enclosing-component.js';

export interface ClassNameUsage {
  classNames: string;
  location: SourceLocation;
  componentName?: string;
}

/**
 * Collects `className` values.
 *
 * Class names are frequently assembled (`clsx('px-4', active && 'bg-blue-600')`
 * or template literals). Rather than trying to evaluate those expressions,
 * every static string literal inside the attribute is collected: dynamic
 * segments simply contribute nothing.
 */
export function extractClassNames(sourceFile: SourceFile): ClassNameUsage[] {
  const usages: ClassNameUsage[] = [];

  for (const attribute of sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute)) {
    if (attribute.getNameNode().getText() !== 'className') {
      continue;
    }

    const initializer = attribute.getInitializer();
    if (!initializer) {
      continue;
    }

    const location = locationOf(attribute);
    const componentName = findEnclosingComponentName(attribute);
    const literals: string[] = [];

    if (initializer.isKind(SyntaxKind.StringLiteral)) {
      literals.push(initializer.getLiteralValue());
    } else if (initializer.isKind(SyntaxKind.JsxExpression)) {
      const expression = initializer.getExpression();
      if (expression) {
        literals.push(...staticStringsIn(expression));
      }
    }

    const classNames = literals.join(' ').trim();
    if (classNames.length === 0) {
      continue;
    }

    usages.push({
      classNames,
      location,
      ...(componentName ? { componentName } : {}),
    });
  }

  return usages;
}

function staticStringsIn(node: Node): string[] {
  const strings: string[] = [];

  if (
    node.isKind(SyntaxKind.StringLiteral) ||
    node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
  ) {
    return [node.getLiteralValue()];
  }

  for (const descendant of node.getDescendants()) {
    if (
      descendant.isKind(SyntaxKind.StringLiteral) ||
      descendant.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
    ) {
      strings.push(descendant.getLiteralValue());
      continue;
    }
    if (
      descendant.isKind(SyntaxKind.TemplateHead) ||
      descendant.isKind(SyntaxKind.TemplateMiddle) ||
      descendant.isKind(SyntaxKind.TemplateTail)
    ) {
      strings.push(descendant.getLiteralText());
    }
  }

  return strings;
}
