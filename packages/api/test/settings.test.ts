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
};

describe('Provider settings API', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildServer(config);
  });
  afterAll(async () => {
    await app.close();
  });

  it('reports offline-stub by default and never returns a key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings/provider' });
    const body = res.json();
    expect(body.provider).toBe('stub');
    expect(body.hasKey).toBe(false);
    expect(body).not.toHaveProperty('apiKey');
  });

  it('switches to an OpenAI-compatible provider at runtime (key not echoed back)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/settings/provider',
      payload: { provider: 'openai', model: 'gpt-4o-mini', baseURL: 'https://api.openai.com/v1', apiKey: 'sk-secret' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.provider).toBe('openai');
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.hasKey).toBe(true);
    expect(JSON.stringify(body)).not.toContain('sk-secret');

    // Health reflects the runtime change.
    const health = (await app.inject({ method: 'GET', url: '/health' })).json();
    expect(health.provider).toBe('openai');
    expect(health.modelMode).toBe('live');
  });

  it('rejects an invalid provider', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/settings/provider', payload: { provider: 'bogus' } });
    expect(res.statusCode).toBe(400);
  });
});
