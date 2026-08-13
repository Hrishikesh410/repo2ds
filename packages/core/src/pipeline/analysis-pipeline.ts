import type { Repo2DSConfig, ResolvedConfig } from '../config/index.js';
import { resolveConfig } from '../config/index.js';
import type { FrameworkDetection, StylingDetection } from '../detection/index.js';
import { detectStylingSystems, resolveFrameworks } from '../detection/index.js';
import type {
  ComponentInfo,
  Diagnostic,
  FrameworkId,
  ScanReport,
  StyleUsage,
  TokenCandidate,
} from '../models/index.js';
import { FRAMEWORK_IDS } from '../models/index.js';
import { TokenInferenceEngine } from '../inference/index.js';
import type { FrameworkAdapter } from '../ports/index.js';
import { buildReport } from '../reporters/index.js';
import type { ParsedSourceFile, ProjectManifest } from '../scanner/index.js';
import { RepositoryScanner, readProjectManifest, readWorkspaceLayout } from '../scanner/index.js';
import { DiagnosticCollector } from '../utils/index.js';

export interface AdapterContext {
  rootDir: string;
  manifest: ProjectManifest;
  config: ResolvedConfig;
  /** Which styling systems the project declares, so class parsing can be enabled. */
  styling: StylingDetection;
}

export type AdapterFactory = (context: AdapterContext) => readonly FrameworkAdapter[];

export interface AnalysisPipelineOptions {
  /** Absolute path of the repository to analyse. */
  rootDir: string;
  config?: Repo2DSConfig;
  /**
   * Framework adapters, most specific first: each file is analysed by the first
   * adapter that claims it. The composition root supplies these, which is what
   * keeps framework packages out of core's dependencies.
   *
   * Pass a factory to choose adapters from what the project declares — for
   * example enabling Tailwind parsing only where Tailwind is a dependency.
   */
  adapters: readonly FrameworkAdapter[] | AdapterFactory;
  diagnostics?: DiagnosticCollector;
  /**
   * Overrides token inference. Defaults to {@link TokenInferenceEngine}
   * configured from `tokens` in the resolved configuration.
   */
  inferTokens?: (styles: readonly StyleUsage[]) => TokenCandidate[];
}

export interface AnalysisResult {
  rootDir: string;
  config: ResolvedConfig;
  manifest: ProjectManifest;
  detection: FrameworkDetection;
  styling: StylingDetection;
  components: ComponentInfo[];
  /** Every style usage found, including ones not attributable to a component. */
  styles: StyleUsage[];
  tokenCandidates: TokenCandidate[];
  report: ScanReport;
  diagnostics: readonly Diagnostic[];
  filesScanned: number;
  durationMs: number;
}

/**
 * The analysis pipeline:
 *
 * ```text
 * RepositoryScanner → FrameworkAdapter → StyleAdapters → TokenInference → Report
 * ```
 *
 * Each stage is replaceable and none of them knows about a specific framework.
 * Adding a framework means passing another adapter in.
 */
export class AnalysisPipeline {
  private readonly config: ResolvedConfig;
  private readonly diagnostics: DiagnosticCollector;

  constructor(private readonly options: AnalysisPipelineOptions) {
    this.config = resolveConfig(options.config);
    this.diagnostics = options.diagnostics ?? new DiagnosticCollector();
  }

  async run(): Promise<AnalysisResult> {
    const manifest = await readProjectManifest(this.options.rootDir, this.diagnostics);
    const workspace = await readWorkspaceLayout(this.options.rootDir);
    const styling = detectStylingSystems({ manifest, rootDir: this.options.rootDir, workspace });
    const adapters = this.selectAdapters(manifest, styling);
    const components: ComponentInfo[] = [];
    const styles: StyleUsage[] = [];

    const scanner = new RepositoryScanner({
      rootDir: this.options.rootDir,
      ...(this.options.config ? { config: this.options.config } : {}),
      diagnostics: this.diagnostics,
      manifest,
    });

    const scan = await scanner.scan((file) => {
      const adapter = adapters.find((candidate) => candidate.canHandle(file));
      if (!adapter) {
        return;
      }
      const fileStyles = adapter.extractStyles(file);
      styles.push(...fileStyles);
      components.push(...this.analyseComponents(adapter, file, fileStyles));
    });

    const tokenCandidates = this.inferTokens(styles);
    const detection = this.detectFrameworks(scan.manifest, components);

    return {
      rootDir: scan.rootDir,
      config: scan.config,
      manifest: scan.manifest,
      detection,
      styling,
      components,
      styles,
      tokenCandidates,
      report: buildReport({
        manifest: scan.manifest,
        frameworks: detection.frameworks,
        stylingSystems: styling.systems,
        components,
        tokenCandidates,
        filesScanned: scan.filesParsed,
        diagnostics: this.diagnostics.all(),
      }),
      diagnostics: this.diagnostics.all(),
      filesScanned: scan.filesParsed,
      durationMs: scan.durationMs,
    };
  }

  private inferTokens(styles: readonly StyleUsage[]): TokenCandidate[] {
    if (this.options.inferTokens) {
      return this.options.inferTokens(styles);
    }
    if (!this.config.tokens.enabled) {
      return [];
    }
    return new TokenInferenceEngine({
      minUsageCount: this.config.tokens.minUsageCount,
    }).infer(styles);
  }

  /** An explicit `framework` setting narrows the adapters that may run. */
  private selectAdapters(
    manifest: ProjectManifest,
    styling: StylingDetection,
  ): readonly FrameworkAdapter[] {
    const adapters =
      typeof this.options.adapters === 'function'
        ? this.options.adapters({
            rootDir: this.options.rootDir,
            manifest,
            config: this.config,
            styling,
          })
        : this.options.adapters;

    const setting = this.config.framework;
    if (setting === 'auto') {
      return adapters;
    }
    return adapters.filter((adapter) => adapter.name === setting);
  }

  private analyseComponents(
    adapter: FrameworkAdapter,
    file: ParsedSourceFile,
    fileStyles: readonly StyleUsage[],
  ): ComponentInfo[] {
    return adapter.discoverComponents(file).map((component) => {
      const { props, resolved } = adapter.extractProps(component, file);

      return {
        ...component,
        props,
        propsResolved: resolved,
        styles: fileStyles.filter((style) => style.componentName === component.name),
      };
    });
  }

  /**
   * Manifest dependencies are the primary signal; the components actually found
   * are the second. Source evidence matters for repositories whose manifest is
   * missing, minimal, or in a different workspace package.
   */
  private detectFrameworks(
    manifest: ProjectManifest,
    components: readonly ComponentInfo[],
  ): FrameworkDetection {
    const fromManifest = resolveFrameworks(this.config.framework, manifest);
    const fromSources = frameworksOf(components);

    const frameworks = FRAMEWORK_IDS.filter(
      (framework) => fromManifest.frameworks.includes(framework) || fromSources.has(framework),
    );

    const evidence = [...fromManifest.evidence];
    for (const framework of fromSources) {
      if (!fromManifest.frameworks.includes(framework)) {
        evidence.push(`${countFor(components, framework)} components found in source`);
      }
    }

    return { frameworks: [...frameworks], mixed: frameworks.length > 1, evidence };
  }
}

function frameworksOf(components: readonly ComponentInfo[]): Set<FrameworkId> {
  return new Set(components.map((component) => component.framework));
}

function countFor(components: readonly ComponentInfo[], framework: FrameworkId): number {
  return components.filter((component) => component.framework === framework).length;
}
