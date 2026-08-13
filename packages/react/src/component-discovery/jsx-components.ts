import type { ExportType, SourceLocation } from '@repo2ds/core';
import type {
  ArrowFunction,
  ClassDeclaration,
  FunctionDeclaration,
  FunctionExpression,
  Node,
  SourceFile,
  TypeNode,
  VariableDeclaration,
} from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

export type ComponentDeclaration =
  FunctionDeclaration | ArrowFunction | FunctionExpression | ClassDeclaration;

/**
 * A JSX component found in a source file, with the declaration that props can
 * later be read from.
 */
export interface JsxComponentCandidate {
  name: string;
  exportType: ExportType;
  sourceLocation: SourceLocation;
  kind: 'function' | 'class';
  declaration: ComponentDeclaration;
  /** Present for `const Button: React.FC<ButtonProps> = ...` style annotations. */
  variableTypeNode?: Node;
  /**
   * Props type taken from a wrapper's type arguments, as in
   * `forwardRef<HTMLButtonElement, ButtonProps>(...)`. The implementation's own
   * parameter carries no annotation in that form, so this is the only place the
   * props type is written.
   */
  wrapperPropsTypeNode?: TypeNode;
  /**
   * The name of the function a wrapper was handed, as in `memo(CardBase)`.
   * Styles written inside it belong to the component the file exports.
   */
  implementationName?: string;
}

/** Wrappers whose first argument is the real component implementation. */
const COMPONENT_WRAPPERS = new Set(['memo', 'forwardRef', 'React.memo', 'React.forwardRef']);

const REACT_BASE_CLASSES = new Set([
  'Component',
  'PureComponent',
  'React.Component',
  'React.PureComponent',
]);

/**
 * Finds JSX components using deliberately conservative heuristics: a
 * capitalised name plus JSX in the body, or a class extending `React.Component`.
 *
 * Only module-level declarations are considered. A helper defined inside a
 * component is part of that component's implementation, not a separate entry in
 * a design system, and this also prevents the same element being reported twice.
 */
export function discoverJsxComponents(sourceFile: SourceFile): JsxComponentCandidate[] {
  const exports = collectExports(sourceFile);
  const candidates: JsxComponentCandidate[] = [];
  const wrapped = new Set<string>();

  for (const statement of sourceFile.getStatements()) {
    if (statement.isKind(SyntaxKind.FunctionDeclaration)) {
      const candidate = fromFunctionDeclaration(statement, exports);
      if (candidate) {
        candidates.push(candidate);
      }
      continue;
    }

    if (statement.isKind(SyntaxKind.VariableStatement)) {
      for (const declaration of statement.getDeclarations()) {
        const found = fromVariableDeclaration(declaration, exports, sourceFile);
        if (found) {
          candidates.push(found.candidate);
          if (found.referenced) {
            wrapped.add(found.referenced);
          }
        }
      }
      continue;
    }

    if (statement.isKind(SyntaxKind.ClassDeclaration)) {
      const candidate = fromClassDeclaration(statement, exports);
      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  // `const Card = memo(CardBase)` describes one component, and the name the rest
  // of the codebase imports is `Card`.
  return candidates
    .filter((candidate) => !wrapped.has(candidate.name))
    .map((candidate) => ({
      ...candidate,
      name: exports.named.get(candidate.name) ?? candidate.name,
    }));
}

interface FileExports {
  defaultExport: string | undefined;
  /** Declared name to the name it is exported under, which can differ. */
  named: Map<string, string>;
}

function collectExports(sourceFile: SourceFile): FileExports {
  const named = new Map<string, string>();
  let defaultExport: string | undefined;

  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    // `export { Button } from './button'` forwards another file's component,
    // and says nothing about what this one declares.
    if (exportDeclaration.getModuleSpecifier()) {
      continue;
    }

    for (const specifier of exportDeclaration.getNamedExports()) {
      const declared = specifier.getName();
      const alias = specifier.getAliasNode()?.getText();

      if (alias === 'default') {
        defaultExport = declared;
        continue;
      }

      named.set(declared, alias ?? declared);
    }
  }

  for (const assignment of sourceFile.getExportAssignments()) {
    if (assignment.isExportEquals()) {
      continue;
    }
    defaultExport = exportedName(assignment.getExpression()) ?? defaultExport;
  }

  return { defaultExport, named };
}

/**
 * The name behind `export default Button` and `export default memo(Button)`.
 * Wrapping a component on the way out is still exporting that component.
 */
function exportedName(expression: Node): string | undefined {
  if (expression.isKind(SyntaxKind.Identifier)) {
    return expression.getText();
  }

  if (
    expression.isKind(SyntaxKind.CallExpression) &&
    COMPONENT_WRAPPERS.has(expression.getExpression().getText())
  ) {
    const argument = expression.getArguments()[0];
    return argument ? exportedName(argument) : undefined;
  }

  return undefined;
}

function exportTypeOf(
  name: string,
  isExported: boolean,
  isDefault: boolean,
  exports: FileExports,
): ExportType {
  if (isDefault || exports.defaultExport === name) {
    return 'default';
  }
  if (isExported || exports.named.has(name)) {
    return 'named';
  }
  return 'unknown';
}

function fromFunctionDeclaration(
  declaration: FunctionDeclaration,
  exports: FileExports,
): JsxComponentCandidate | undefined {
  const name = declaration.getName();
  if (!name || !isComponentName(name) || !returnsJsx(declaration)) {
    return undefined;
  }

  return {
    name,
    exportType: exportTypeOf(
      name,
      declaration.isExported(),
      declaration.isDefaultExport(),
      exports,
    ),
    sourceLocation: locationOf(declaration.getNameNode() ?? declaration),
    kind: 'function',
    declaration,
  };
}

function fromVariableDeclaration(
  declaration: VariableDeclaration,
  exports: FileExports,
  sourceFile: SourceFile,
): { candidate: JsxComponentCandidate; referenced?: string } | undefined {
  const name = declaration.getName();
  if (!isComponentName(name)) {
    return undefined;
  }

  const unwrapped = unwrapImplementation(declaration.getInitializer(), sourceFile);
  if (!unwrapped || !returnsJsx(unwrapped.implementation)) {
    return undefined;
  }

  const statement = declaration.getVariableStatement();
  const typeNode = declaration.getTypeNode();

  return {
    candidate: {
      name,
      exportType: exportTypeOf(name, statement?.isExported() ?? false, false, exports),
      sourceLocation: locationOf(declaration.getNameNode()),
      kind: 'function',
      declaration: unwrapped.implementation,
      ...(typeNode ? { variableTypeNode: typeNode } : {}),
      ...(unwrapped.propsTypeNode ? { wrapperPropsTypeNode: unwrapped.propsTypeNode } : {}),
      ...(unwrapped.referenced ? { implementationName: unwrapped.referenced } : {}),
    },
    ...(unwrapped.referenced ? { referenced: unwrapped.referenced } : {}),
  };
}

function fromClassDeclaration(
  declaration: ClassDeclaration,
  exports: FileExports,
): JsxComponentCandidate | undefined {
  const name = declaration.getName();
  if (!name || !isComponentName(name) || !extendsReactComponent(declaration)) {
    return undefined;
  }

  return {
    name,
    exportType: exportTypeOf(
      name,
      declaration.isExported(),
      declaration.isDefaultExport(),
      exports,
    ),
    sourceLocation: locationOf(declaration.getNameNode() ?? declaration),
    kind: 'class',
    declaration,
  };
}

interface Unwrapped {
  implementation: ArrowFunction | FunctionExpression | FunctionDeclaration;
  /** From `forwardRef<Ref, Props>` or `memo<Props>`, when written that way. */
  propsTypeNode?: TypeNode;
  /**
   * The local function a wrapper was handed, as in `memo(CardBase)`. That
   * function is the component's implementation rather than a component of its
   * own, so it is dropped from the results in favour of the wrapper's name.
   */
  referenced?: string;
}

/**
 * Looks through `memo(...)` and `forwardRef(...)` to the function inside,
 * whether it is written in place or passed by name.
 */
function unwrapImplementation(
  node: Node | undefined,
  sourceFile: SourceFile,
): Unwrapped | undefined {
  if (!node) {
    return undefined;
  }

  if (node.isKind(SyntaxKind.ArrowFunction) || node.isKind(SyntaxKind.FunctionExpression)) {
    return { implementation: node };
  }

  if (node.isKind(SyntaxKind.Identifier)) {
    const referenced = node.getText();
    const implementation = localFunction(referenced, sourceFile);
    return implementation ? { implementation, referenced } : undefined;
  }

  if (!node.isKind(SyntaxKind.CallExpression)) {
    return undefined;
  }

  const callee = node.getExpression().getText();
  if (!COMPONENT_WRAPPERS.has(callee)) {
    return undefined;
  }

  const inner = unwrapImplementation(node.getArguments()[0], sourceFile);
  if (!inner) {
    return undefined;
  }

  // `forwardRef<Ref, Props>` puts the ref type first; `memo<Props>` has only
  // the props type. An inner wrapper's type argument wins if the outer has none.
  const typeArguments = node.getTypeArguments();
  const propsTypeNode =
    (callee.endsWith('forwardRef') ? typeArguments[1] : typeArguments[0]) ?? inner.propsTypeNode;

  return { ...inner, ...(propsTypeNode ? { propsTypeNode } : {}) };
}

/** The function declaration or function-valued constant a name refers to. */
function localFunction(
  name: string,
  sourceFile: SourceFile,
): ArrowFunction | FunctionExpression | FunctionDeclaration | undefined {
  const declaration = sourceFile.getFunction(name);
  if (declaration) {
    return declaration;
  }

  const initializer = sourceFile.getVariableDeclaration(name)?.getInitializer();
  if (
    initializer?.isKind(SyntaxKind.ArrowFunction) ||
    initializer?.isKind(SyntaxKind.FunctionExpression)
  ) {
    return initializer;
  }

  return undefined;
}

function extendsReactComponent(declaration: ClassDeclaration): boolean {
  const base = declaration.getExtends();
  if (!base) {
    return false;
  }
  return REACT_BASE_CLASSES.has(base.getExpression().getText());
}

/** `NAV_ITEMS`, `DEFAULT_SIZE`: a naming convention reserved for constants. */
const SCREAMING_SNAKE_CASE = /^[A-Z0-9]+(_[A-Z0-9]+)+$/;

/**
 * A component name starts with an upper case letter and is not written in the
 * conventional constant style. Short names such as `C` and acronyms such as
 * `CTA` are accepted: the requirement that the declaration be a function
 * returning JSX already excludes constants that merely contain elements.
 */
export function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name) && !SCREAMING_SNAKE_CASE.test(name);
}

/**
 * True when JSX appears anywhere inside the function body. Checking return
 * statements alone would miss early returns, conditional rendering and helpers
 * that build elements before returning them.
 */
export function returnsJsx(node: Node): boolean {
  return (
    node.getFirstDescendant(
      (descendant) =>
        descendant.isKind(SyntaxKind.JsxElement) ||
        descendant.isKind(SyntaxKind.JsxSelfClosingElement) ||
        descendant.isKind(SyntaxKind.JsxFragment),
    ) !== undefined
  );
}

export function locationOf(node: Node): SourceLocation {
  const { line, column } = node.getSourceFile().getLineAndColumnAtPos(node.getStart());
  return { line, column };
}
