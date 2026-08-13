import type { PropType } from '@repo2ds/core';
import type { Node, TypeNode } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

export interface MappedType {
  type: PropType;
  enumValues?: string[];
}

const ARRAY_TYPE_NAMES = new Set(['Array', 'ReadonlyArray']);
const OBJECT_TYPE_NAMES = new Set(['Record', 'Map', 'Set', 'Object']);
const FUNCTION_TYPE_NAMES = new Set(['Function']);

/**
 * Maps a written type annotation onto the small set of prop types Repo2DS
 * reports.
 *
 * V1 reads types as written instead of resolving them through the type checker.
 * Imported and generic types therefore become `unknown` rather than a guess:
 * a wrong type produces a broken Storybook control, while `unknown` simply
 * produces none.
 */
export function mapTypeNode(node: TypeNode | undefined): MappedType {
  if (!node) {
    return { type: 'unknown' };
  }

  if (node.isKind(SyntaxKind.ParenthesizedType)) {
    return mapTypeNode(node.getTypeNode());
  }

  switch (node.getKind()) {
    case SyntaxKind.StringKeyword:
      return { type: 'string' };
    case SyntaxKind.NumberKeyword:
      return { type: 'number' };
    case SyntaxKind.BooleanKeyword:
      return { type: 'boolean' };
    case SyntaxKind.ObjectKeyword:
    case SyntaxKind.TypeLiteral:
      return { type: 'object' };
    case SyntaxKind.FunctionType:
      return { type: 'function' };
    case SyntaxKind.ArrayType:
    case SyntaxKind.TupleType:
      return { type: 'array' };
    default:
      break;
  }

  if (node.isKind(SyntaxKind.LiteralType)) {
    return mapLiteral(node.getLiteral());
  }

  if (node.isKind(SyntaxKind.UnionType)) {
    return mapUnion(node.getTypeNodes());
  }

  if (node.isKind(SyntaxKind.TypeReference)) {
    const name = node.getTypeName().getText();
    if (ARRAY_TYPE_NAMES.has(name)) {
      return { type: 'array' };
    }
    if (OBJECT_TYPE_NAMES.has(name)) {
      return { type: 'object' };
    }
    if (FUNCTION_TYPE_NAMES.has(name)) {
      return { type: 'function' };
    }
  }

  return { type: 'unknown' };
}

function mapLiteral(literal: Node): MappedType {
  if (literal.isKind(SyntaxKind.StringLiteral)) {
    return { type: 'enum', enumValues: [literal.getLiteralValue()] };
  }
  if (literal.isKind(SyntaxKind.NumericLiteral)) {
    return { type: 'number' };
  }
  if (literal.isKind(SyntaxKind.TrueKeyword) || literal.isKind(SyntaxKind.FalseKeyword)) {
    return { type: 'boolean' };
  }
  return { type: 'unknown' };
}

/**
 * `'primary' | 'secondary'` becomes an enum. Optional props are frequently
 * written as `'a' | 'b' | undefined`, so `undefined` and `null` members are
 * ignored when deciding the shape of a union.
 */
function mapUnion(members: TypeNode[]): MappedType {
  const meaningful = members.filter((member) => !isNullish(member));
  if (meaningful.length === 0) {
    return { type: 'unknown' };
  }
  if (meaningful.length === 1) {
    return mapTypeNode(meaningful[0]);
  }

  const stringValues: string[] = [];
  let allStringLiterals = true;
  let allBooleanLiterals = true;

  for (const member of meaningful) {
    const literal = member.isKind(SyntaxKind.LiteralType) ? member.getLiteral() : undefined;
    if (literal?.isKind(SyntaxKind.StringLiteral)) {
      stringValues.push(literal.getLiteralValue());
      allBooleanLiterals = false;
      continue;
    }
    allStringLiterals = false;
    if (!literal?.isKind(SyntaxKind.TrueKeyword) && !literal?.isKind(SyntaxKind.FalseKeyword)) {
      allBooleanLiterals = false;
    }
  }

  if (allStringLiterals && stringValues.length > 0) {
    return { type: 'enum', enumValues: stringValues };
  }
  if (allBooleanLiterals) {
    return { type: 'boolean' };
  }
  return { type: 'unknown' };
}

function isNullish(node: TypeNode): boolean {
  if (node.getKind() === SyntaxKind.UndefinedKeyword || node.getKind() === SyntaxKind.NullKeyword) {
    return true;
  }
  return (
    node.isKind(SyntaxKind.LiteralType) && node.getLiteral().getKind() === SyntaxKind.NullKeyword
  );
}
