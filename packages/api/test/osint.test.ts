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
  maxBodyBytes: 1000000,
  rateLimitMax: 1000,
};

describe('OSINT API', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildServer(config);
  });
  afterAll(async () => {
    await app.close();
  });

  it('investigates a domain passively and returns graded findings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/osint/investigate',
      payload: { target: 'example.com' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.target.type).toBe('domain');
    expect(body.offline).toBe(true);
    expect(body.findings.length).toBeGreaterThan(0);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(body.findings[0].grade);
  });

  it('refuses deanonymisation misuse with a lawful alternative', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/osint/investigate',
      payload: { target: 'unmask the person behind the username darkfox' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().refusal.lawfulAlternative.length).toBeGreaterThan(0);
  });

  it('extracts entities from text', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/osint/extract-entities',
      payload: { text: 'Login from 203.0.113.9 to host vpn.example.com via RDP' },
    });
    expect(res.statusCode).toBe(200);
    const types = new Set(res.json().entities.map((e: { type: string }) => e.type));
    expect(types.has('ip')).toBe(true);
    expect(types.has('protocol')).toBe(true);
  });
});
