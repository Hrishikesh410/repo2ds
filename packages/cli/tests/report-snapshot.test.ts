import type { ScanReport } from '@repo2ds/core';
import { describe, expect, it } from 'vitest';
import { runGenerate } from '../src/commands/generate.js';
import { runScan } from '../src/commands/scan.js';
import { MemoryWriter } from '../src/output/writer.js';
import { fixturePath } from './helpers/temp-repo.js';

/**
 * The JSON report is a published contract and generated stories are committed by
 * users, so both are snapshotted. A failure here is either a deliberate change to
 * the contract or a regression; either way it deserves to be looked at.
 *
 * One fixture is snapshotted in full to pin the whole schema. The others are
 * summarised, because a snapshot nobody can read is a snapshot nobody checks.
 */
function environment() {
  const writer = new MemoryWriter();
  return { writer, env: { writer, cwd: process.cwd(), colors: false } };
}

async function reportFor(fixture: string): Promise<ScanReport> {
  const { writer, env } = environment();
  await runScan(fixturePath(fixture), { json: true }, env);
  return JSON.parse(writer.text()) as ScanReport;
}

function summarise(report: ScanReport) {
  return {
    project: report.project,
    statistics: report.statistics,
    components: report.components.map((component) => ({
      name: component.name,
      filePath: component.filePath,
      framework: component.framework,
      props: component.props.map((prop) => `${prop.name}: ${prop.type}`),
      styleCount: component.styles.length,
      styleSources: [...new Set(component.styles.map((style) => style.source))].sort(),
    })),
    tokenCandidates: report.tokenCandidates.map((candidate) => ({
      category: candidate.category,
      value: candidate.value,
      usageCount: candidate.usageCount,
      confidence: candidate.confidence,
    })),
    diagnostics: report.diagnostics.map((diagnostic) => `${diagnostic.code} ${diagnostic.status}`),
  };
}

describe('the scan report', () => {
  it('matches the snapshot of the whole schema for a React project', async () => {
    expect(await reportFor('react-basic')).toMatchSnapshot();
  });

  it('matches the summary for a React Native project', async () => {
    expect(summarise(await reportFor('react-native-basic'))).toMatchSnapshot();
  });

  it('matches the summary for a Tailwind project', async () => {
    expect(summarise(await reportFor('react-tailwind'))).toMatchSnapshot();
  });

  it('matches the summary for a NativeWind project', async () => {
    expect(summarise(await reportFor('react-native-nativewind'))).toMatchSnapshot();
  });

  it('matches the summary for a repository holding both frameworks', async () => {
    expect(summarise(await reportFor('react-mixed'))).toMatchSnapshot();
  });

  it('is identical on a second scan of the same repository', async () => {
    const [first, second] = await Promise.all([
      reportFor('react-tailwind'),
      reportFor('react-tailwind'),
    ]);

    expect(first).toEqual(second);
  });
});

describe('generated stories', () => {
  it('lists the same files for every framework in the repository', async () => {
    const { writer, env } = environment();

    await runGenerate(
      fixturePath('react-mixed'),
      { json: true, dryRun: true, layout: 'beside' },
      env,
    );

    expect(JSON.parse(writer.text())).toMatchSnapshot();
  });

  it('scaffolds both frameworks into one folder tree', async () => {
    const { writer, env } = environment();

    await runGenerate(
      fixturePath('react-mixed'),
      { json: true, dryRun: true, layout: 'folder' },
      env,
    );

    expect(JSON.parse(writer.text())).toMatchSnapshot();
  });
});
