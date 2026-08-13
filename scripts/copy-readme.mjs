/**
 * The root README is the documentation, and it is also what npm shows on the
 * `repo2ds` page, so the CLI package keeps a copy. Run with `--check` to fail
 * when the copy has drifted instead of updating it.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = new URL('README.md', root);
const target = new URL('packages/cli/README.md', root);

const readme = await readFile(source, 'utf8');
const checkOnly = process.argv.includes('--check');

if (!checkOnly) {
  await writeFile(target, readme);
  process.exit(0);
}

const copy = await readFile(target, 'utf8').catch(() => undefined);

if (copy !== readme) {
  console.error(
    `${fileURLToPath(target)} is out of date. Run \`npm run sync:readme\` and commit the result.`,
  );
  process.exit(1);
}
