/**
 * Prop types Repo2DS reports. Anything Repo2DS cannot resolve statically with
 * confidence is reported as `unknown` rather than guessed.
 */
export type PropType =
  'string' | 'number' | 'boolean' | 'enum' | 'function' | 'object' | 'array' | 'unknown';

export interface PropInfo {
  name: string;
  type: PropType;
  required: boolean;
  /** Present for `type: 'enum'`, holding the literal members in declaration order. */
  enumValues?: string[];
  /** The type text as written in the source, kept for reporting and debugging. */
  rawType?: string;
  /** Default value literal when one is statically visible. */
  defaultValue?: string | number | boolean;
}
