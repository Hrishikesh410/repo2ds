/** Sink for CLI output. Injected so commands can be tested without stdout. */
export interface Writer {
  line(text?: string): void;
}

export class ConsoleWriter implements Writer {
  constructor(private readonly target: (text: string) => void = console.log) {}

  line(text = ''): void {
    this.target(text);
  }
}

/** Captures output in memory for assertions and snapshots. */
export class MemoryWriter implements Writer {
  readonly lines: string[] = [];

  line(text = ''): void {
    this.lines.push(text);
  }

  text(): string {
    return this.lines.join('\n');
  }
}
