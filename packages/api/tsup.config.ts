import { defineConfig } from 'tsup';

// Bundle the API into a self-contained dist so `node dist/index.js` runs in
// production. The workspace package @feluda/core is inlined; real npm deps stay
// external (resolved from node_modules at runtime).
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  noExternal: ['@feluda/core'],
  // Heavy/CJS runtime deps stay external (resolved from node_modules at runtime).
  external: ['@anthropic-ai/sdk', 'docx', 'fastify', '@fastify/cors', 'dotenv'],
  clean: true,
  sourcemap: true,
});
