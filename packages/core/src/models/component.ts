import type { FrameworkId } from './framework.js';
import type { PropInfo } from './prop.js';
import type { SourceLocation } from './source-location.js';
import type { StyleUsage } from './style.js';

export type ExportType = 'default' | 'named' | 'unknown';

/**
 * The named type a component declares its props with, when it has one.
 *
 * Only recorded for a type another file could import: an inline object type has
 * no name, and a type that is declared but not exported cannot be re-exported.
 */
export interface PropsTypeRef {
  name: string;
  exported: boolean;
}

export interface ComponentInfo {
  name: string;
  /** Repository-relative, POSIX separated path. */
  filePath: string;
  exportType: ExportType;
  props: PropInfo[];
  /**
   * Whether the props type was read in full.
   *
   * A props type imported from another file leaves `props` empty without the
   * component having none, and a consumer that treats the two the same will draw
   * the wrong conclusion.
   */
  propsResolved: boolean;
  styles: StyleUsage[];
  framework: FrameworkId;
  sourceLocation?: SourceLocation;
  propsType?: PropsTypeRef;
}
