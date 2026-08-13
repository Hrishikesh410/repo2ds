import type { FrameworkId, ParsedSourceFile, StyleUsage } from '@repo2ds/core';
import type { ReactAdapterOptions } from '@repo2ds/react';
import { ReactAdapter, extractInlineStyles } from '@repo2ds/react';
import type { SourceFile } from 'ts-morph';
import { extractStyleSheetStyles, usesStyleSheet } from './styles/stylesheet.js';

/**
 * React Native support.
 *
 * React Native *is* React, so component discovery and prop extraction are
 * inherited unchanged; only styling differs. That inheritance is deliberate: a
 * second copy of the JSX heuristics would drift from the first.
 */
export class ReactNativeAdapter extends ReactAdapter {
  override readonly name: FrameworkId = 'react-native';

  constructor(options: ReactAdapterOptions) {
    super(options);
  }

  /**
   * Claims files that import from React Native or declare a style sheet. Both
   * signals are explicit; recognising primitives such as `<Text>` by name alone
   * would misclassify web components that happen to share those names.
   */
  override canHandle(file: ParsedSourceFile): boolean {
    return importsReactNativePackage(file.sourceFile) || usesStyleSheet(file.sourceFile);
  }

  /**
   * Inline styles, style sheets and — where NativeWind is in use — utility
   * classes. Imported CSS is not analysed: a React Native app has no cascade.
   */
  override extractStyles(file: ParsedSourceFile): StyleUsage[] {
    const context = {
      filePath: file.relativePath,
      diagnostics: this.options.diagnostics,
    };

    return [
      ...extractStyleSheetStyles(file.sourceFile, context),
      ...extractInlineStyles(file.sourceFile, context),
      ...this.extractUtilityClassStyles(file),
    ];
  }
}

/**
 * True for `react-native` itself and for its ecosystem packages, such as
 * `react-native-safe-area-context`. Broader than the React adapter's check of
 * the same name, which only needs to know whether to step aside.
 */
export function importsReactNativePackage(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue();
    return specifier === 'react-native' || specifier.startsWith('react-native-');
  });
}
