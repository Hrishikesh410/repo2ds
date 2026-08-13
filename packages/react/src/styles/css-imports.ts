import path from 'node:path';
import type { DiagnosticCollector, ReadTextFile, StyleUsage } from '@repo2ds/core';
import { toPosixPath } from '@repo2ds/core';
import type { SourceFile } from 'ts-morph';
import { locationOf } from '../component-discovery/jsx-components.js';
import {
  collectCustomProperties,
  parseCssDeclarations,
  resolveCssValue,
} from './css-declarations.js';

const STYLESHEET_EXTENSIONS = ['.css', '.scss', '.sass', '.less'];

export interface CssImportContext {
  /** Repository-relative path of the importing file. */
  filePath: string;
  /** Absolute path of the importing file, used to resolve relative imports. */
  absolutePath: string;
  rootDir: string;
  diagnostics: DiagnosticCollector;
  readTextFile: ReadTextFile;
  /** Component the stylesheet is attributed to, usually the file's main component. */
  componentName?: string;
}

/**
 * Records the design values held in stylesheets a component imports, covering
 * both CSS modules (`import styles from './Button.module.css'`) and plain
 * imports (`import './Button.css'`).
 *
 * Only relative imports are followed: a stylesheet from `node_modules` belongs
 * to somebody else's design system.
 */
export function extractCssImportStyles(
  sourceFile: SourceFile,
  context: CssImportContext,
): StyleUsage[] {
  const usages: StyleUsage[] = [];

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const specifier = importDeclaration.getModuleSpecifierValue();
    if (!isStylesheet(specifier)) {
      continue;
    }

    if (!specifier.startsWith('.')) {
      if (isProjectAlias(specifier)) {
        context.diagnostics.warn(
          'stylesheet-alias-unresolved',
          `Imported stylesheet "${specifier}" uses a path alias, which Repo2DS does not resolve; its values were not read.`,
          { filePath: context.filePath, location: locationOf(importDeclaration) },
        );
      }
      continue;
    }

    const absolutePath = path.resolve(path.dirname(context.absolutePath), specifier);
    const relativePath = toPosixPath(path.relative(context.rootDir, absolutePath));
    const contents = context.readTextFile(absolutePath);

    if (contents === undefined) {
      context.diagnostics.warn(
        'stylesheet-unreadable',
        `Imported stylesheet "${specifier}" could not be read.`,
        { filePath: context.filePath, location: locationOf(importDeclaration) },
      );
      continue;
    }

    const declarations = parseCssDeclarations(contents);
    const variables = collectCustomProperties(declarations);

    for (const declaration of declarations) {
      // A custom property declaration is not a style being applied. Its value is
      // already recorded wherever `var()` uses it, and counting the declaration
      // too would count one design decision twice.
      if (declaration.property.startsWith('--')) {
        continue;
      }

      const resolved = resolveCssValue(declaration.value, variables);

      usages.push({
        property: declaration.property,
        value: resolved.value,
        source: 'stylesheet',
        filePath: relativePath,
        location: declaration.location,
        origin: `${relativePath} ${declaration.selector}`.trim(),
        ...(resolved.dynamic ? { dynamic: true } : {}),
        ...(context.componentName ? { componentName: context.componentName } : {}),
      });
    }
  }

  return usages;
}

export function isStylesheet(specifier: string): boolean {
  const lower = specifier.toLowerCase();
  return STYLESHEET_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Distinguishes `@/styles/theme.css`, a stylesheet of the project's own written
 * through a bundler alias, from `bootstrap/dist/bootstrap.css`, which belongs to
 * a dependency and is deliberately ignored.
 *
 * Only the two unambiguous forms count: `@/` is the conventional alias prefix
 * and `#` is a Node subpath import. A bare `styles/theme.css` may be either, and
 * warning about a dependency's stylesheet would be noise.
 */
function isProjectAlias(specifier: string): boolean {
  return specifier.startsWith('@/') || specifier.startsWith('#');
}
