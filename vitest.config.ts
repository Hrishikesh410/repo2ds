import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Tests run against package sources, so no build step is needed to run them. */
function packageSource(name: string): string {
  return fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      '@repo2ds/core': packageSource('core'),
      '@repo2ds/react-native': packageSource('react-native'),
      '@repo2ds/react': packageSource('react'),
      '@repo2ds/nativewind': packageSource('nativewind'),
      '@repo2ds/tailwind': packageSource('tailwind'),
    },
  },
  test: {
    include: ['packages/*/tests/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
