import type {
  AdapterContext,
  AnalysisResult,
  ClassStyleAdapter,
  DiagnosticCollector,
  FrameworkAdapter,
  FrameworkId,
  Repo2DSConfig,
  StoryGenerator,
  StylingSystemId,
} from '@repo2ds/core';
import { AnalysisPipeline, createCachedTextReader } from '@repo2ds/core';
import { NativeWindStyleAdapter } from '@repo2ds/nativewind';
import { ReactAdapter, ReactStoryGenerator } from '@repo2ds/react';
import { ReactNativeAdapter, ReactNativeStoryGenerator } from '@repo2ds/react-native';
import { TailwindStyleAdapter } from '@repo2ds/tailwind';

interface AnalyseOptions {
  rootDir: string;
  config?: Repo2DSConfig;
  diagnostics: DiagnosticCollector;
}

/**
 * The composition root: the one place that knows which adapters exist.
 *
 * Core depends on none of these packages, which is what allows a new framework
 * or styling system to be supported by editing this function alone.
 */
function createAdapters(options: AnalyseOptions, context: AdapterContext): FrameworkAdapter[] {
  const readTextFile = createCachedTextReader();
  const classStyleAdapter = createClassStyleAdapter(context.styling.systems);
  const adapterOptions = {
    rootDir: options.rootDir,
    diagnostics: options.diagnostics,
    readTextFile,
    ...(classStyleAdapter ? { classStyleAdapter } : {}),
  };

  // React Native first: its files also contain JSX, so the more specific adapter
  // has to be offered each file before the React one.
  return [new ReactNativeAdapter(adapterOptions), new ReactAdapter(adapterOptions)];
}

interface StoryGeneratorOptions {
  /** Package the stories import CSF types from. Defaults per framework. */
  storybookPackage?: string;
}

/** Story generators, keyed by the framework whose components they can render. */
export function createStoryGenerators(
  options: StoryGeneratorOptions = {},
): Map<FrameworkId, StoryGenerator> {
  const shared = options.storybookPackage ? { storybookPackage: options.storybookPackage } : {};

  return new Map<FrameworkId, StoryGenerator>([
    ['react', new ReactStoryGenerator(shared)],
    ['react-native', new ReactNativeStoryGenerator(shared)],
  ]);
}

/**
 * Tailwind and NativeWind share one parser; only the reported source and the
 * supported utilities differ. NativeWind wins when both are present, because a
 * NativeWind project's classes are compiled for native.
 */
function createClassStyleAdapter(
  systems: readonly StylingSystemId[],
): ClassStyleAdapter | undefined {
  if (systems.includes('nativewind')) {
    return new NativeWindStyleAdapter();
  }
  if (systems.includes('tailwind')) {
    return new TailwindStyleAdapter();
  }
  return undefined;
}

export async function analyseRepository(options: AnalyseOptions): Promise<AnalysisResult> {
  return new AnalysisPipeline({
    rootDir: options.rootDir,
    ...(options.config ? { config: options.config } : {}),
    diagnostics: options.diagnostics,
    adapters: (context) => createAdapters(options, context),
  }).run();
}
