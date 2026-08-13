import type { Node } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import { isComponentName } from '../component-discovery/jsx-components.js';

/**
 * Walks up from a node to the component it belongs to, so a style value can be
 * attributed to `Button` rather than just to `Button.tsx`.
 */
export function findEnclosingComponentName(node: Node): string | undefined {
  let current: Node | undefined = node.getParent();

  while (current) {
    if (
      current.isKind(SyntaxKind.FunctionDeclaration) ||
      current.isKind(SyntaxKind.ClassDeclaration)
    ) {
      const name = current.getName();
      if (name && isComponentName(name)) {
        return name;
      }
    }

    if (current.isKind(SyntaxKind.VariableDeclaration)) {
      const name = current.getName();
      if (isComponentName(name)) {
        return name;
      }
    }

    current = current.getParent();
  }

  return undefined;
}
