import { defineConfig } from 'tsup';

// Self-contained CLI bundle with a node shebang so `feluda` runs directly.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  noExternal: ['@feluda/core'],
  external: ['@anthropic-ai/sdk', 'docx'],
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
  sourcemap: true,
});
