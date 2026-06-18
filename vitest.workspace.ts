import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace: each package runs under the environment it needs.
 * - web uses jsdom (its own vite.config.ts test block)
 * - core + api run in node
 */
export default defineWorkspace([
  './packages/web/vite.config.ts',
  {
    test: {
      name: 'node',
      globals: true,
      environment: 'node',
      include: ['packages/{core,api,cli}/**/*.{test,spec}.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  },
]);
