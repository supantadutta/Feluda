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

describe('POST /api/actions', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildServer(config);
  });
  afterAll(async () => {
    await app.close();
  });

  it('analyzes a CSV and returns a chart', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/actions',
      payload: { kind: 'data.analyze', payload: { csv: 'x,y\n1,2\n3,4' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().detail.analysis.chartSvg).toMatch(/^<svg/);
  });

  it('asks for confirmation before a consequential action (202)', async () => {
    const add = await app.inject({
      method: 'POST',
      url: '/api/actions',
      payload: { kind: 'ops.task.add', payload: { title: 'follow up' } },
    });
    const id = add.json().detail.task.id;

    const res = await app.inject({
      method: 'POST',
      url: '/api/actions',
      payload: { kind: 'ops.task.delete', payload: { id } },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().awaitingApproval).toBe(true);
  });
});
