import type { DiagnosticCollector } from '@repo2ds/core';
import type { SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import { locationOf } from '../component-discovery/jsx-components.js';

/** Libraries that hold style values in tagged template literals. */
const CSS_IN_JS_PACKAGES = [
  'styled-components',
  '@emotion/styled',
  '@emotion/react',
  '@emotion/css',
  'goober',
  '@linaria/core',
  '@linaria/react',
];

interface CssInJsContext {
  filePath: string;
  diagnostics: DiagnosticCollector;
}

/**
 * Reports styles written with a CSS-in-JS library.
 *
 * Repo2DS does not read inside these template literals, so a file full of them
 * would otherwise be reported as having no styles at all — output that looks
 * healthy and is wrong. Saying so is more useful than a silent gap.
 */
export function reportCssInJs(sourceFile: SourceFile, context: CssInJsContext): void {
  const library = cssInJsImport(sourceFile);
  if (!library) {
    return;
  }

  const templates = sourceFile.getDescendantsOfKind(SyntaxKind.TaggedTemplateExpression);
  if (templates.length === 0) {
    return;
  }

  context.diagnostics.warn(
    'css-in-js-unsupported',
    `Styles written with ${library} were not read; Repo2DS does not parse CSS-in-JS template literals.`,
    { filePath: context.filePath, location: locationOf(templates[0]!) },
  );
}

function cssInJsImport(sourceFile: SourceFile): string | undefined {
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const specifier = importDeclaration.getModuleSpecifierValue();
    if (CSS_IN_JS_PACKAGES.includes(specifier)) {
      return specifier;
    }
  }

  return undefined;
}
