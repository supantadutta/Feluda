import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

const config = {
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

describe('Schema validation (zod)', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildServer(config);
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects a whitespace-only question with a clear 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/investigate', payload: { question: '   ' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/question/i);
  });

  it('rejects an invalid provider base URL', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/settings/provider', payload: { provider: 'openai', model: 'm', baseURL: 'not-a-url' } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects out-of-range learning rounds', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/learning/run', payload: { rounds: 999 } });
    expect(res.statusCode).toBe(400);
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/not found/i);
  });
});
