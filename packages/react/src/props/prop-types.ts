import type { PropInfo, PropType } from '@repo2ds/core';
import type {
  ClassDeclaration,
  Expression,
  Node,
  ObjectLiteralExpression,
  SourceFile,
} from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

/** `PropTypes.string` and friends, mapped onto the prop types Repo2DS reports. */
const VALIDATORS: Record<string, PropType> = {
  string: 'string',
  number: 'number',
  bool: 'boolean',
  func: 'function',
  array: 'array',
  arrayOf: 'array',
  object: 'object',
  objectOf: 'object',
  shape: 'object',
  exact: 'object',
};

type Defaults = Map<string, string | number | boolean>;

/**
 * Reads props from `Button.propTypes`, or from a class's static `propTypes`.
 *
 * JavaScript projects have no type annotations to read, and PropTypes is the
 * convention that still describes a component's interface in them. Only the
 * literal forms are understood: a validator assembled at runtime becomes
 * `unknown`, the same as an unresolvable TypeScript type.
 */
export function extractPropTypes(
  componentName: string,
  sourceFile: SourceFile,
  destructuringDefaults: Defaults = new Map(),
): PropInfo[] {
  const declaration = sourceFile.getClass(componentName);
  const propTypes = declaration
    ? staticObject(declaration, 'propTypes')
    : assignedObject(componentName, 'propTypes', sourceFile);

  if (!propTypes) {
    return [];
  }

  const declared = declaration
    ? staticObject(declaration, 'defaultProps')
    : assignedObject(componentName, 'defaultProps', sourceFile);

  // `defaultProps` is the explicit statement of intent, so it wins over a
  // default written into the destructuring pattern.
  const defaults = new Map([...destructuringDefaults, ...readDefaults(declared)]);

  return propsOf(propTypes, defaults);
}

function propsOf(propTypes: ObjectLiteralExpression, defaults: Defaults): PropInfo[] {
  return propTypes.getProperties().flatMap((property) => {
    if (!property.isKind(SyntaxKind.PropertyAssignment)) {
      return [];
    }

    const name = propertyName(property.getName());
    const initializer = property.getInitializer();
    if (!name || !initializer) {
      return [];
    }

    const validator = readValidator(initializer);
    const defaultValue = defaults.get(name);

    return [
      {
        name,
        type: validator.type,
        required: validator.required,
        ...(validator.enumValues ? { enumValues: validator.enumValues } : {}),
        rawType: initializer.getText(),
        ...(defaultValue === undefined ? {} : { defaultValue }),
      } satisfies PropInfo,
    ];
  });
}

/** `Button.defaultProps = { variant: 'primary' }`, the PropTypes-era default. */
function readDefaults(defaultProps: ObjectLiteralExpression | undefined): Defaults {
  const defaults: Defaults = new Map();

  for (const property of defaultProps?.getProperties() ?? []) {
    if (!property.isKind(SyntaxKind.PropertyAssignment)) {
      continue;
    }
    const name = propertyName(property.getName());
    const value = literalValue(property.getInitializer());
    if (name && value !== undefined) {
      defaults.set(name, value);
    }
  }

  return defaults;
}

interface Validator {
  type: PropType;
  required: boolean;
  enumValues?: string[];
}

function readValidator(node: Expression): Validator {
  // `PropTypes.string.isRequired` wraps the validator in one more access.
  if (node.isKind(SyntaxKind.PropertyAccessExpression) && node.getName() === 'isRequired') {
    return { ...readValidator(node.getExpression()), required: true };
  }

  if (node.isKind(SyntaxKind.CallExpression)) {
    const callee = node.getExpression();
    const name = callee.isKind(SyntaxKind.PropertyAccessExpression)
      ? callee.getName()
      : callee.getText();

    if (name === 'oneOf') {
      const values = stringMembers(node.getArguments()[0]);
      return values.length > 0
        ? { type: 'enum', required: false, enumValues: values }
        : { type: 'unknown', required: false };
    }

    return { type: VALIDATORS[name] ?? 'unknown', required: false };
  }

  if (node.isKind(SyntaxKind.PropertyAccessExpression)) {
    return { type: VALIDATORS[node.getName()] ?? 'unknown', required: false };
  }

  return { type: 'unknown', required: false };
}

/** `PropTypes.oneOf(['primary', 'secondary'])`, when every member is a string. */
function stringMembers(node: Node | undefined): string[] {
  if (!node?.isKind(SyntaxKind.ArrayLiteralExpression)) {
    return [];
  }

  const values: string[] = [];
  for (const element of node.getElements()) {
    if (!element.isKind(SyntaxKind.StringLiteral)) {
      return [];
    }
    values.push(element.getLiteralValue());
  }

  return values;
}

/** The object literal assigned to `Component.<member>` at the top level. */
function assignedObject(
  componentName: string,
  member: string,
  sourceFile: SourceFile,
): ObjectLiteralExpression | undefined {
  for (const statement of sourceFile.getStatements()) {
    if (!statement.isKind(SyntaxKind.ExpressionStatement)) {
      continue;
    }

    const expression = statement.getExpression();
    if (
      !expression.isKind(SyntaxKind.BinaryExpression) ||
      expression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken
    ) {
      continue;
    }

    const left = expression.getLeft();
    if (
      !left.isKind(SyntaxKind.PropertyAccessExpression) ||
      left.getExpression().getText() !== componentName ||
      left.getName() !== member
    ) {
      continue;
    }

    const right = expression.getRight();
    if (right.isKind(SyntaxKind.ObjectLiteralExpression)) {
      return right;
    }
  }

  return undefined;
}

/** `static propTypes = { ... }` in a class body. */
function staticObject(
  declaration: ClassDeclaration,
  member: string,
): ObjectLiteralExpression | undefined {
  const property = declaration.getStaticProperty(member);
  if (!property?.isKind(SyntaxKind.PropertyDeclaration)) {
    return undefined;
  }

  const initializer = property.getInitializer();
  return initializer?.isKind(SyntaxKind.ObjectLiteralExpression) ? initializer : undefined;
}

/** Quoted keys such as `'aria-label'` are stored without their quotes. */
function propertyName(raw: string): string | undefined {
  const unquoted = raw.replace(/^['"`]|['"`]$/g, '');
  return unquoted.length > 0 ? unquoted : undefined;
}

function literalValue(node: Expression | undefined): string | number | boolean | undefined {
  if (node?.isKind(SyntaxKind.StringLiteral) || node?.isKind(SyntaxKind.NumericLiteral)) {
    return node.getLiteralValue();
  }
  if (node?.isKind(SyntaxKind.TrueKeyword)) {
    return true;
  }
  if (node?.isKind(SyntaxKind.FalseKeyword)) {
    return false;
  }
  return undefined;
}
