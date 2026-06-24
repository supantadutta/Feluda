import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

const base = {
  nodeEnv: 'test',
  apiPort: 0,
  webOrigin: 'http://localhost:5173',
  defaultModel: 'claude-opus-4-8',
  vectorStorePath: '',
  councilEnabled: false,
  councilModels: [] as string[],
  councilCostCapUsd: 0.5,
  osintLive: false,
  maxBodyBytes: 1_000_000,
  rateLimitMax: 1000,
};

describe('API security', () => {
  it('sends security headers (helmet)', async () => {
    const app: FastifyInstance = await buildServer(base);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    await app.close();
  });

  describe('API-key gate', () => {
    let app: FastifyInstance;
    beforeAll(async () => {
      app = await buildServer({ ...base, apiKey: 'topsecret' });
    });
    afterAll(async () => {
      await app.close();
    });

    it('leaves /health open', async () => {
      expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    });

    it('rejects /api/* without the key', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/investigate', payload: { question: 'hi' } });
      expect(res.statusCode).toBe(401);
    });

    it('accepts /api/* with the key', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/investigate',
        headers: { 'x-api-key': 'topsecret' },
        payload: { question: 'What makes a source trustworthy?' },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
