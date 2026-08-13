import type { ComponentInfo, FrameworkId, PropInfo, StyleUsage } from '../models/index.js';
import type { ParsedSourceFile } from '../scanner/index.js';

/**
 * The props of one component, and whether they are all of them.
 *
 * An adapter that cannot read a props type reports no props; saying so lets a
 * consumer tell that apart from a component that genuinely takes none.
 */
export interface PropsResult {
  props: PropInfo[];
  resolved: boolean;
}

/**
 * The single extension point for framework support.
 *
 * Everything a framework needs to know — which JSX elements exist, how styles
 * are declared, how props are typed — lives behind this interface. The core
 * pipeline must never branch on `framework === 'react-native'`; adding Vue or
 * Svelte later should mean adding an adapter, not editing core.
 */
export interface FrameworkAdapter {
  readonly name: FrameworkId;

  /**
   * Cheap per-file check: does this adapter recognise the file as belonging to
   * its framework? Used both to route files and to gather evidence for
   * automatic framework detection.
   */
  canHandle(file: ParsedSourceFile): boolean;

  discoverComponents(file: ParsedSourceFile): ComponentInfo[];

  extractProps(component: ComponentInfo, file: ParsedSourceFile): PropsResult;

  extractStyles(file: ParsedSourceFile): StyleUsage[];
}
