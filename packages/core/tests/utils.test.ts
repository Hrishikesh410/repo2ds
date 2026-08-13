import { describe, expect, it } from 'vitest';
import {
  DiagnosticCollector,
  describeError,
  formatLocation,
  mapWithConcurrency,
  toPosixPath,
} from '../src/index.js';

describe('DiagnosticCollector', () => {
  it('counts diagnostics by status and keeps insertion order', () => {
    const collector = new DiagnosticCollector();

    collector.warn('a', 'first', { filePath: 'src/a.ts' });
    collector.error('b', 'second');
    collector.skip('c', 'third');

    expect(collector.counts()).toEqual({ warning: 1, error: 1, skipped: 1 });
    expect(collector.all().map((diagnostic) => diagnostic.code)).toEqual(['a', 'b', 'c']);
    expect(collector.all()[0]).toEqual({
      status: 'warning',
      code: 'a',
      message: 'first',
      filePath: 'src/a.ts',
    });
  });
});

describe('mapWithConcurrency', () => {
  it('preserves input order', async () => {
    const results = await mapWithConcurrency([3, 1, 2], 2, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, value));
      return value * 10;
    });

    expect(results).toEqual([30, 10, 20]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, index) => index),
      4,
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
      },
    );

    expect(peak).toBeLessThanOrEqual(4);
  });

  it('handles an empty input', async () => {
    await expect(mapWithConcurrency([], 4, () => Promise.resolve(1))).resolves.toEqual([]);
  });
});

describe('describeError', () => {
  it('uses the message of an error', () => {
    expect(describeError(new Error('could not read file'))).toBe('could not read file');
  });

  it('falls back to the name when an error carries no message', () => {
    expect(describeError(new RangeError())).toBe('RangeError');
  });

  it('describes values that are not errors', () => {
    expect(describeError('thrown string')).toBe('thrown string');
    expect(describeError({ code: 'EACCES' })).toBe('{"code":"EACCES"}');
    expect(describeError(undefined)).toBe('undefined');
  });

  it('survives a value that cannot be serialised', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(describeError(circular)).toBe('[object Object]');
    expect(describeError(1n)).toBe('1');
  });
});

describe('paths', () => {
  it('formats locations for terminal output', () => {
    expect(formatLocation('src/Button.tsx', { line: 42, column: 7 })).toBe('src/Button.tsx:42:7');
    expect(formatLocation('src/Button.tsx')).toBe('src/Button.tsx');
  });

  it('normalises separators', () => {
    expect(toPosixPath('src/components/Button.tsx')).toBe('src/components/Button.tsx');
  });
});
