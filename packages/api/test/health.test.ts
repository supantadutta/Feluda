import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

/** Phase 0 smoke test: the API boots and the health check responds. */
describe('api /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({
      nodeEnv: 'test',
      apiPort: 0,
      webOrigin: 'http://localhost:5173',
      defaultModel: 'claude-opus-4-8',
      vectorStorePath: '',
      councilEnabled: false,
      councilModels: [],
      councilCostCapUsd: 0.5,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      service: 'feluda-api',
      phase: 7,
      modelMode: 'offline-stub',
      evidenceMode: 'offline-fixture',
      councilMode: 'disabled',
    });
  });
});
