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

describe('Case + SOC API', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildServer(config);
  });
  afterAll(async () => {
    await app.close();
  });

  it('creates a case, adds evidence, investigates, and generates a report', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/cases',
      payload: { title: 'Suspicious login', objective: 'Assess account X' },
    });
    expect(created.statusCode).toBe(200);
    const id = created.json().case.id;

    await app.inject({
      method: 'POST',
      url: `/api/cases/${id}/evidence`,
      payload: {
        evidence: [{ claim: '2026-06-11T10:00:00Z login from 203.0.113.9', source: 'siem' }],
      },
    });

    const inv = await app.inject({
      method: 'POST',
      url: `/api/cases/${id}/investigate`,
      payload: { question: 'Is account X compromised?' },
    });
    expect(inv.statusCode).toBe(200);
    expect(inv.json().case.status).toBe('investigating');

    const tl = await app.inject({ method: 'GET', url: `/api/cases/${id}/timeline` });
    expect(tl.json().timeline.length).toBeGreaterThan(0);

    const report = await app.inject({
      method: 'GET',
      url: `/api/cases/${id}/report?type=osint_case`,
    });
    expect(report.json().report.content).toMatch(/OSINT Case Report/);
  });

  it('runs a defensive SOC investigation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/soc/investigate',
      payload: {
        type: 'brute_force',
        logs: [
          'Failed password for admin',
          'Failed password for admin',
          'authentication failure',
          'invalid user x',
          'Failed login',
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assessment.verdict).toBe('needs_escalation');
    expect(res.json().report.content).toMatch(/SOC Investigation Report/);
  });
});
