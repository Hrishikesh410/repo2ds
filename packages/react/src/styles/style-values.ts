import type { Node } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

export type StyleValueResult =
  { kind: 'literal'; values: (string | number)[] } | { kind: 'dynamic'; text: string };

/**
 * Reads a style value without ever evaluating it.
 *
 * Literals are returned as-is. A conditional such as
 * `condition ? '#FFF' : '#000'` yields both branches, since both are values the
 * component can genuinely render. Everything else is dynamic: Repo2DS records
 * that a value exists but excludes it from token inference.
 */
export function readStyleValue(node: Node): StyleValueResult {
  const literal = readLiteral(node);
  if (literal !== undefined) {
    return { kind: 'literal', values: [literal] };
  }

  if (node.isKind(SyntaxKind.ConditionalExpression)) {
    const branches = [node.getWhenTrue(), node.getWhenFalse()];
    const values: (string | number)[] = [];
    for (const branch of branches) {
      const branchValue = readLiteral(branch);
      if (branchValue === undefined) {
        return { kind: 'dynamic', text: node.getText() };
      }
      values.push(branchValue);
    }
    return { kind: 'literal', values };
  }

  return { kind: 'dynamic', text: node.getText() };
}

function readLiteral(node: Node): string | number | undefined {
  if (node.isKind(SyntaxKind.StringLiteral)) {
    return node.getLiteralValue();
  }
  if (node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
    return node.getLiteralValue();
  }
  if (node.isKind(SyntaxKind.NumericLiteral)) {
    return node.getLiteralValue();
  }
  if (node.isKind(SyntaxKind.PrefixUnaryExpression)) {
    const operand = node.getOperand();
    if (
      node.getOperatorToken() === SyntaxKind.MinusToken &&
      operand.isKind(SyntaxKind.NumericLiteral)
    ) {
      return -operand.getLiteralValue();
    }
  }
  if (node.isKind(SyntaxKind.ParenthesizedExpression)) {
    return readLiteral(node.getExpression());
  }
  return undefined;
}
