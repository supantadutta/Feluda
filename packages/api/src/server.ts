import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { FELUDA_CORE_VERSION } from '@feluda/core';
import { loadConfig, type Config } from './config.js';

/**
 * Builds the Fastify app (Layer I — API surface). Kept separate from `index.ts`
 * so tests can drive it with `app.inject(...)` without binding a port.
 *
 * Phase 0: only a health check. Investigation routes land in Phase 1.
 */
export async function buildServer(config: Config = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
      // Redaction guard: never log Authorization headers or api keys.
      redact: ['req.headers.authorization', '*.apiKey', '*.ANTHROPIC_API_KEY'],
    },
  });

  await app.register(cors, { origin: config.webOrigin });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'feluda-api',
    coreVersion: FELUDA_CORE_VERSION,
    phase: 0,
  }));

  return app;
}
