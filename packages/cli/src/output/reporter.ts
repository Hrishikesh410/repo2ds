import pc from 'picocolors';
import type { Writer } from './writer.js';

export interface ReporterOptions {
  writer: Writer;
  /** Colours are disabled by default so captured output stays comparable. */
  colors?: boolean;
}

/** A label and its value, printed as one aligned row by {@link Reporter.fields}. */
export type Field = readonly [label: string, value: string | number];

/** Renders Repo2DS CLI output. */
export class Reporter {
  private readonly colors: ReturnType<typeof pc.createColors>;
  private readonly writer: Writer;

  constructor(options: ReporterOptions) {
    this.writer = options.writer;
    this.colors = pc.createColors(options.colors ?? false);
  }

  title(text: string): void {
    this.writer.line(this.colors.bold(text));
  }

  blank(): void {
    this.writer.line();
  }

  /** Prints rows as two columns, aligned on the widest label in the group. */
  fields(fields: readonly Field[]): void {
    const width = Math.max(...fields.map(([label]) => label.length));

    for (const [label, value] of fields) {
      this.writer.line(`${this.colors.dim(label.padEnd(width))}  ${String(value)}`);
    }
  }

  note(text: string): void {
    this.writer.line(this.colors.dim(text));
  }

  bullet(text: string): void {
    this.writer.line(`  ${text}`);
  }

  warning(text: string): void {
    this.writer.line(this.colors.yellow(`⚠ ${text}`));
  }

  skipped(text: string): void {
    this.writer.line(this.colors.dim(`⊘ ${text}`));
  }

  failure(text: string): void {
    this.writer.line(this.colors.red(`✖ ${text}`));
  }

  raw(text: string): void {
    this.writer.line(text);
  }
}
