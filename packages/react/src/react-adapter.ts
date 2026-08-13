import type {
  ClassStyleAdapter,
  ComponentInfo,
  DiagnosticCollector,
  FrameworkAdapter,
  FrameworkId,
  ParsedSourceFile,
  PropsResult,
  ReadTextFile,
  StyleUsage,
} from '@repo2ds/core';
import { createCachedTextReader } from '@repo2ds/core';
import type { SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import type { JsxComponentCandidate } from './component-discovery/jsx-components.js';
import { discoverJsxComponents } from './component-discovery/jsx-components.js';
import { describePropsType, extractComponentProps } from './props/extract-props.js';
import { extractClassNames } from './styles/class-names.js';
import { reportCssInJs } from './styles/css-in-js.js';
import { extractCssImportStyles } from './styles/css-imports.js';
import { extractInlineStyles } from './styles/inline-styles.js';

export interface ReactAdapterOptions {
  /** Absolute path of the repository being scanned. */
  rootDir: string;
  diagnostics: DiagnosticCollector;
  /** Interprets `className` utilities. Supply the Tailwind adapter to enable it. */
  classStyleAdapter?: ClassStyleAdapter;
  /** Read imported stylesheets. Defaults to a cached file system reader. */
  readTextFile?: ReadTextFile;
  /** Set to false to ignore imported CSS files entirely. */
  analyseStylesheets?: boolean;
}

/**
 * React support: JSX components, their props, and the styles they declare.
 *
 * All React knowledge lives here. The pipeline only knows this object satisfies
 * {@link FrameworkAdapter}.
 */
export class ReactAdapter implements FrameworkAdapter {
  readonly name: FrameworkId = 'react';

  protected readonly options: ReactAdapterOptions;
  private readonly readTextFile: ReadTextFile;
  /**
   * Discovery walks the whole AST, and style extraction, component discovery and
   * prop extraction all need the result for the same file. Files are analysed one
   * at a time, so remembering the last one is enough.
   */
  private lastDiscovery?: { filePath: string; candidates: JsxComponentCandidate[] };

  constructor(options: ReactAdapterOptions) {
    this.options = options;
    this.readTextFile = options.readTextFile ?? createCachedTextReader();
  }

  /**
   * Handles any file containing JSX or importing React, except files importing
   * `react-native`: those belong to the React Native adapter, which is offered
   * files first.
   */
  canHandle(file: ParsedSourceFile): boolean {
    if (importsReactNative(file.sourceFile)) {
      return false;
    }
    return containsJsx(file.sourceFile) || importsReact(file.sourceFile);
  }

  discoverComponents(file: ParsedSourceFile): ComponentInfo[] {
    return this.candidatesIn(file).map((candidate) => {
      const propsType = describePropsType(candidate, file.sourceFile);

      return {
        name: candidate.name,
        filePath: file.relativePath,
        exportType: candidate.exportType,
        props: [],
        propsResolved: true,
        styles: [],
        framework: this.name,
        sourceLocation: candidate.sourceLocation,
        ...(propsType ? { propsType } : {}),
      } satisfies ComponentInfo;
    });
  }

  extractProps(component: ComponentInfo, file: ParsedSourceFile): PropsResult {
    const candidate = this.candidatesIn(file).find((found) => found.name === component.name);
    if (!candidate) {
      return { props: [], resolved: true };
    }
    return extractComponentProps(candidate, file.sourceFile, {
      filePath: file.relativePath,
      diagnostics: this.options.diagnostics,
    });
  }

  extractStyles(file: ParsedSourceFile): StyleUsage[] {
    const context = {
      filePath: file.relativePath,
      diagnostics: this.options.diagnostics,
    };

    const styles = [
      ...extractInlineStyles(file.sourceFile, context),
      ...this.extractUtilityClassStyles(file),
      ...this.extractStylesheetStyles(file),
    ];

    reportCssInJs(file.sourceFile, context);

    return this.attributeToExportedNames(styles, file);
  }

  /**
   * Styles found inside `CardBase` belong to `Card` when the file exports
   * `memo(CardBase)`. Without this they would be attributed to a name no
   * component carries, and the component would appear to have no styles.
   */
  private attributeToExportedNames(
    styles: readonly StyleUsage[],
    file: ParsedSourceFile,
  ): StyleUsage[] {
    const exportedNames = new Map<string, string>();
    for (const candidate of this.candidatesIn(file)) {
      if (candidate.implementationName) {
        exportedNames.set(candidate.implementationName, candidate.name);
      }
    }

    if (exportedNames.size === 0) {
      return [...styles];
    }

    return styles.map((style) => {
      const exported = style.componentName ? exportedNames.get(style.componentName) : undefined;
      return exported ? { ...style, componentName: exported } : style;
    });
  }

  protected extractUtilityClassStyles(file: ParsedSourceFile): StyleUsage[] {
    const classStyleAdapter = this.options.classStyleAdapter;
    if (!classStyleAdapter) {
      return [];
    }

    return extractClassNames(file.sourceFile).flatMap((usage) =>
      classStyleAdapter.parseClassNames(usage.classNames, {
        filePath: file.relativePath,
        location: usage.location,
        ...(usage.componentName ? { componentName: usage.componentName } : {}),
      }),
    );
  }

  /** Candidates for one file, discovered once and reused by the other passes. */
  protected candidatesIn(file: ParsedSourceFile): JsxComponentCandidate[] {
    if (this.lastDiscovery?.filePath !== file.relativePath) {
      this.lastDiscovery = {
        filePath: file.relativePath,
        candidates: discoverJsxComponents(file.sourceFile),
      };
    }
    return this.lastDiscovery.candidates;
  }

  private extractStylesheetStyles(file: ParsedSourceFile): StyleUsage[] {
    if (this.options.analyseStylesheets === false) {
      return [];
    }

    const mainComponent = this.candidatesIn(file)[0]?.name;

    return extractCssImportStyles(file.sourceFile, {
      filePath: file.relativePath,
      absolutePath: file.absolutePath,
      rootDir: this.options.rootDir,
      diagnostics: this.options.diagnostics,
      readTextFile: this.readTextFile,
      ...(mainComponent ? { componentName: mainComponent } : {}),
    });
  }
}

export function containsJsx(sourceFile: SourceFile): boolean {
  return (
    sourceFile.getFirstDescendant(
      (node) =>
        node.isKind(SyntaxKind.JsxElement) ||
        node.isKind(SyntaxKind.JsxSelfClosingElement) ||
        node.isKind(SyntaxKind.JsxFragment),
    ) !== undefined
  );
}

export function importsReact(sourceFile: SourceFile): boolean {
  return sourceFile
    .getImportDeclarations()
    .some((declaration) => ['react', 'react-dom'].includes(declaration.getModuleSpecifierValue()));
}

export function importsReactNative(sourceFile: SourceFile): boolean {
  return sourceFile
    .getImportDeclarations()
    .some((declaration) => declaration.getModuleSpecifierValue() === 'react-native');
}
