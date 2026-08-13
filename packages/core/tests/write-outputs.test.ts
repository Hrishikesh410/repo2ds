import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { TokenCandidate } from '../src/index.js';
import { buildDesignTokens, writeJsonFile } from '../src/index.js';
import { createTempRepo, removeTempRepos } from './helpers/temp-repo.js';

afterEach(removeTempRepos);

function candidate(overrides: Partial<TokenCandidate> = {}): TokenCandidate {
  return {
    category: 'spacing',
    value: 16,
    usageCount: 12,
    locations: ['src/Button.tsx:3:5'],
    confidence: 0.62,
    evidence: ['Used 12 times'],
    ...overrides,
  };
}

describe('buildDesignTokens', () => {
  it('groups candidates by category', () => {
    const file = buildDesignTokens([
      candidate(),
      candidate({ value: 8, usageCount: 5, confidence: 0.44 }),
      candidate({ category: 'color', value: '#FFFFFF', usageCount: 20, confidence: 0.7 }),
    ]);

    expect(file).toEqual({
      schemaVersion: 1,
      tokens: {
        spacing: [
          { value: 16, usageCount: 12, confidence: 0.62 },
          { value: 8, usageCount: 5, confidence: 0.44 },
        ],
        color: [{ value: '#FFFFFF', usageCount: 20, confidence: 0.7 }],
      },
    });
  });

  it('can filter out low confidence candidates', () => {
    const file = buildDesignTokens(
      [candidate({ confidence: 0.3 }), candidate({ value: 24, confidence: 0.8 })],
      { minConfidence: 0.5 },
    );

    expect(file.tokens.spacing).toEqual([{ value: 24, usageCount: 12, confidence: 0.8 }]);
  });

  it('does not invent token names', () => {
    const serialised = JSON.stringify(buildDesignTokens([candidate()]));

    expect(serialised).not.toContain('spacing-16');
    expect(serialised).not.toContain('name');
  });

  it('produces no groups for no candidates', () => {
    expect(buildDesignTokens([])).toEqual({ schemaVersion: 1, tokens: {} });
  });
});

describe('writeJsonFile', () => {
  it('writes formatted JSON with a trailing newline', async () => {
    const rootDir = await createTempRepo({});
    const target = path.join(rootDir, 'repo2ds-report.json');

    await writeJsonFile(target, { schemaVersion: 1 });

    expect(await fs.readFile(target, 'utf8')).toBe('{\n  "schemaVersion": 1\n}\n');
  });

  it('creates missing directories', async () => {
    const rootDir = await createTempRepo({});
    const target = path.join(rootDir, 'nested', 'deeper', 'tokens.json');

    await writeJsonFile(target, { tokens: {} });

    expect(JSON.parse(await fs.readFile(target, 'utf8'))).toEqual({ tokens: {} });
  });
});
