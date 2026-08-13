import type { DiagnosticCollector, PropInfo, PropsTypeRef } from '@repo2ds/core';
import type {
  InterfaceDeclaration,
  Node,
  PropertySignature,
  SourceFile,
  TypeLiteralNode,
  TypeNode,
} from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import type { JsxComponentCandidate } from '../component-discovery/jsx-components.js';
import { locationOf } from '../component-discovery/jsx-components.js';
import { extractPropTypes } from './prop-types.js';
import { mapTypeNode } from './type-mapping.js';

/** Guards against cycles in `interface A extends B` chains. */
const MAX_HERITAGE_DEPTH = 5;

export interface ExtractPropsContext {
  filePath: string;
  diagnostics: DiagnosticCollector;
}

/**
 * Reads the props of a component from the type it declares.
 *
 * Supported shapes: an interface or type alias referenced by the props
 * parameter, an inline object type, `React.FC<Props>` annotations, and
 * `React.Component<Props>` for class components. Types that are imported or
 * computed are reported as unresolved rather than guessed at.
 *
 * Where a component declares no type at all, `propTypes` is read instead, which
 * is how a JavaScript project describes the same thing.
 */
export interface ExtractedProps {
  props: PropInfo[];
  /** False when the props type exists but could not be read. */
  resolved: boolean;
}

export function extractComponentProps(
  candidate: JsxComponentCandidate,
  sourceFile: SourceFile,
  context: ExtractPropsContext,
): ExtractedProps {
  const propsType = findPropsTypeNode(candidate);
  if (!propsType) {
    const props = extractPropTypes(
      candidate.name,
      sourceFile,
      collectDestructuringDefaults(candidate),
    );
    return { props, resolved: true };
  }

  const members = resolveMembers(propsType, sourceFile, context, 0);
  if (!members) {
    return { props: [], resolved: false };
  }

  const defaults = collectDestructuringDefaults(candidate);

  return { props: members.map((member) => toPropInfo(member, defaults)), resolved: true };
}

/**
 * The name of the props type, for the rare consumer that wants to import it
 * rather than the props Repo2DS read out of it.
 *
 * Only a plain reference to a type declared in the same file qualifies. An
 * inline object type has nothing to import, and an intersection has no single
 * name that stands for the whole.
 */
export function describePropsType(
  candidate: JsxComponentCandidate,
  sourceFile: SourceFile,
): PropsTypeRef | undefined {
  const typeNode = findPropsTypeNode(candidate);
  if (!typeNode?.isKind(SyntaxKind.TypeReference)) {
    return undefined;
  }

  const name = typeNode.getTypeName().getText();
  const declaration = sourceFile.getInterface(name) ?? sourceFile.getTypeAlias(name);
  if (!declaration) {
    return undefined;
  }

  return { name, exported: declaration.isExported() };
}

function findPropsTypeNode(candidate: JsxComponentCandidate): TypeNode | undefined {
  if (candidate.kind === 'class') {
    return firstTypeArgumentOfBaseClass(candidate);
  }

  const annotated = typeArgumentOfComponentAnnotation(candidate.variableTypeNode);
  if (annotated) {
    return annotated;
  }

  const declaration = candidate.declaration;
  if (declaration.isKind(SyntaxKind.ClassDeclaration)) {
    return undefined;
  }

  // A `forwardRef<Ref, Props>` implementation has no annotation on its
  // parameter, because the type comes from the wrapper.
  return declaration.getParameters()[0]?.getTypeNode() ?? candidate.wrapperPropsTypeNode;
}

/** `class Modal extends React.Component<ModalProps>`. */
function firstTypeArgumentOfBaseClass(candidate: JsxComponentCandidate): TypeNode | undefined {
  const declaration = candidate.declaration;
  if (!declaration.isKind(SyntaxKind.ClassDeclaration)) {
    return undefined;
  }
  return declaration.getExtends()?.getTypeArguments()[0];
}

/** `const Button: React.FC<ButtonProps> = ...`, including `FC` and `FunctionComponent`. */
function typeArgumentOfComponentAnnotation(typeNode: Node | undefined): TypeNode | undefined {
  if (!typeNode?.isKind(SyntaxKind.TypeReference)) {
    return undefined;
  }
  const name = typeNode
    .getTypeName()
    .getText()
    .replace(/^React\./, '');
  if (!['FC', 'FunctionComponent', 'ComponentType', 'VoidFunctionComponent'].includes(name)) {
    return undefined;
  }
  return typeNode.getTypeArguments()[0];
}

/**
 * Collects the property signatures a props type is made of, following local
 * `extends` clauses and intersections. Returns `undefined` when the type cannot
 * be resolved within the file.
 */
function resolveMembers(
  typeNode: TypeNode,
  sourceFile: SourceFile,
  context: ExtractPropsContext,
  depth: number,
  visited: Set<string> = new Set(),
): PropertySignature[] | undefined {
  if (depth > MAX_HERITAGE_DEPTH) {
    return [];
  }

  if (typeNode.isKind(SyntaxKind.ParenthesizedType)) {
    const inner = typeNode.getTypeNode();
    return inner ? resolveMembers(inner, sourceFile, context, depth, visited) : undefined;
  }

  if (typeNode.isKind(SyntaxKind.TypeLiteral)) {
    return propertiesOf(typeNode);
  }

  if (typeNode.isKind(SyntaxKind.IntersectionType)) {
    const members: PropertySignature[] = [];
    for (const part of typeNode.getTypeNodes()) {
      members.push(...(resolveMembers(part, sourceFile, context, depth + 1, visited) ?? []));
    }
    return members;
  }

  if (typeNode.isKind(SyntaxKind.TypeReference)) {
    const name = typeNode.getTypeName().getText();

    const interfaceDeclaration = sourceFile.getInterface(name);
    if (interfaceDeclaration) {
      return membersOfInterface(interfaceDeclaration, sourceFile, context, depth, visited);
    }

    const alias = sourceFile.getTypeAlias(name);
    const aliasType = alias?.getTypeNode();
    if (aliasType) {
      if (visited.has(name)) {
        return [];
      }
      visited.add(name);
      return resolveMembers(aliasType, sourceFile, context, depth + 1, visited);
    }

    // `React.ComponentProps<'button'>` and `Omit<ButtonProps, 'size'>` are not
    // missing types, they are types computed from others. Saying so separately
    // matters: on a real repository they are most of what goes unread, and the
    // reader can tell them from a props type that simply lives elsewhere.
    if (typeNode.getTypeArguments().length > 0) {
      context.diagnostics.warn(
        'computed-props-type',
        `Props type "${name}<…>" is computed from other types, which needs a type checker; its props were not extracted.`,
        { filePath: context.filePath, location: locationOf(typeNode) },
      );
      return undefined;
    }

    context.diagnostics.warn(
      'unresolved-props-type',
      `Props type "${name}" is not declared in this file; its props were not extracted.`,
      { filePath: context.filePath, location: locationOf(typeNode) },
    );
    return undefined;
  }

  return undefined;
}

/**
 * Collects an interface's own members and those it inherits.
 *
 * `interface A extends B` and `interface B extends A` parses but is not a type
 * TypeScript will resolve, and following it would recurse until the stack ran
 * out. A cycle returns `undefined` and propagates, so a circular type yields no
 * props rather than a set of props the compiler disagrees with.
 */
function membersOfInterface(
  declaration: InterfaceDeclaration,
  sourceFile: SourceFile,
  context: ExtractPropsContext,
  depth: number,
  visited: Set<string>,
): PropertySignature[] | undefined {
  const name = declaration.getName();
  if (visited.has(name)) {
    context.diagnostics.warn(
      'circular-props-type',
      `Props type "${name}" extends itself, so its props were not extracted.`,
      { filePath: context.filePath, location: locationOf(declaration.getNameNode()) },
    );
    return undefined;
  }

  if (depth > MAX_HERITAGE_DEPTH) {
    return [];
  }
  visited.add(name);

  const own = propertiesOf(declaration);
  const inherited: PropertySignature[] = [];

  for (const base of declaration.getExtends()) {
    const baseName = base.getExpression().getText();
    const baseInterface = sourceFile.getInterface(baseName);
    if (baseInterface) {
      const members = membersOfInterface(baseInterface, sourceFile, context, depth + 1, visited);
      if (!members) {
        return undefined;
      }
      inherited.push(...members);
      continue;
    }
    context.diagnostics.warn(
      'unresolved-props-type',
      `Base props type "${baseName}" is not declared in this file; its props were not extracted.`,
      { filePath: context.filePath, location: locationOf(base) },
    );
  }

  return dedupeByName([...own, ...inherited]);
}

function propertiesOf(declaration: InterfaceDeclaration | TypeLiteralNode): PropertySignature[] {
  return declaration.getProperties();
}

/** Own declarations win over inherited ones, matching TypeScript's behaviour. */
/** `'aria-label'?: string` is read by ts-morph with its quotes still attached. */
function propertyName(raw: string): string {
  return raw.replace(/^['"`]|['"`]$/g, '');
}

function dedupeByName(members: PropertySignature[]): PropertySignature[] {
  const seen = new Set<string>();
  const result: PropertySignature[] = [];
  for (const member of members) {
    const name = propertyName(member.getName());
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    result.push(member);
  }
  return result;
}

/** `function Button({ variant = 'primary' }: ButtonProps)`. */
function collectDestructuringDefaults(
  candidate: JsxComponentCandidate,
): Map<string, string | number | boolean> {
  const defaults = new Map<string, string | number | boolean>();
  const declaration = candidate.declaration;
  if (declaration.isKind(SyntaxKind.ClassDeclaration)) {
    return defaults;
  }

  const pattern = declaration.getParameters()[0]?.getNameNode();
  if (!pattern?.isKind(SyntaxKind.ObjectBindingPattern)) {
    return defaults;
  }

  for (const element of pattern.getElements()) {
    const initializer = element.getInitializer();
    if (!initializer) {
      continue;
    }
    const value = literalValueOf(initializer);
    if (value !== undefined) {
      defaults.set(
        propertyName(element.getPropertyNameNode()?.getText() ?? element.getName()),
        value,
      );
    }
  }

  return defaults;
}

function literalValueOf(node: Node): string | number | boolean | undefined {
  if (node.isKind(SyntaxKind.StringLiteral)) {
    return node.getLiteralValue();
  }
  if (node.isKind(SyntaxKind.NumericLiteral)) {
    return node.getLiteralValue();
  }
  if (node.isKind(SyntaxKind.TrueKeyword)) {
    return true;
  }
  if (node.isKind(SyntaxKind.FalseKeyword)) {
    return false;
  }
  return undefined;
}

function toPropInfo(
  member: PropertySignature,
  defaults: Map<string, string | number | boolean>,
): PropInfo {
  const typeNode = member.getTypeNode();
  const mapped = mapTypeNode(typeNode);
  const name = propertyName(member.getName());
  const defaultValue = defaults.get(name);

  return {
    name,
    type: mapped.type,
    required: !member.hasQuestionToken(),
    ...(mapped.enumValues ? { enumValues: mapped.enumValues } : {}),
    ...(typeNode ? { rawType: typeNode.getText() } : {}),
    ...(defaultValue === undefined ? {} : { defaultValue }),
  };
}
