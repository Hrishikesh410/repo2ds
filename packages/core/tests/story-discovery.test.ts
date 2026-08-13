import { afterEach, describe, expect, it } from 'vitest';
import { findExistingStories } from '../src/index.js';
import { createTempRepo, removeTempRepos } from './helpers/temp-repo.js';

afterEach(removeTempRepos);

describe('findExistingStories', () => {
  it('finds nothing in a repository that has never written one', async () => {
    const rootDir = await createTempRepo({
      'src/Button.tsx': 'export const Button = () => null;\n',
    });

    await expect(findExistingStories(rootDir)).resolves.toEqual({ files: [], found: false });
  });

  it('finds stories whatever extension they use', async () => {
    const rootDir = await createTempRepo({
      'src/Button.stories.tsx': '',
      'src/legacy/Card.stories.js': '',
      'src/Button.tsx': '',
    });

    const existing = await findExistingStories(rootDir);

    expect(existing.found).toBe(true);
    expect(existing.files).toEqual(['src/Button.stories.tsx', 'src/legacy/Card.stories.js']);
  });

  it('ignores stories that belong to a dependency', async () => {
    const rootDir = await createTempRepo({
      'node_modules/some-kit/Button.stories.tsx': '',
      'dist/Button.stories.js': '',
    });

    await expect(findExistingStories(rootDir)).resolves.toEqual({ files: [], found: false });
  });

  it('stops listing once it has enough to answer the question', async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < 12; index += 1) {
      files[`src/Component${index}.stories.tsx`] = '';
    }
    const rootDir = await createTempRepo(files);

    const existing = await findExistingStories(rootDir, { limit: 3 });

    expect(existing.found).toBe(true);
    expect(existing.files).toHaveLength(3);
  });

  it('disregards the directories it is told to ignore', async () => {
    const rootDir = await createTempRepo({
      'repo2ds/components/Button/Button.stories.tsx': '',
    });

    await expect(findExistingStories(rootDir, { ignore: ['repo2ds/components'] })).resolves.toEqual(
      { files: [], found: false },
    );
  });
});
