import { describe, it, expect } from 'vitest';
import { verdictToDocx } from '../src/layer6-action/index.js';
import { ReputationProvider } from '../src/osint/index.js';
import { classifyTarget } from '../src/osint/index.js';
import type { Verdict } from '../src/types.js';

const verdict: Verdict = {
  queryId: 'q',
  answer: 'The evidence points to an insider.',
  trace: [{ stage: 'verdict', summary: 'done', at: '' }],
  confidence: { score: 0.6, band: 'medium', gaps: ['single source'] },
  citations: [{ source: 'https://nist.gov/a', title: 'NIST', retrievedAt: '' }],
  hypotheses: [{ id: 'h', statement: 'insider', belief: 0.7, supporting: [], contradicting: [] }],
};

describe('DOCX export', () => {
  it('produces a real .docx (Office Open XML / ZIP) buffer', async () => {
    const buf = await verdictToDocx(verdict);
    expect(buf.length).toBeGreaterThan(0);
    // .docx is a ZIP container — first two bytes are "PK".
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK');
  });
});

describe('Reputation provider (key-gated, live, mocked)', () => {
  it('returns a graded reputation finding and never leaks the key in the citation', async () => {
    let authHeader = '';
    const fetchImpl = (async (_url: string, init?: { headers?: Record<string, string> }) => {
      authHeader = init?.headers?.Authorization ?? '';
      return { ok: true, status: 200, json: async () => ({ verdict: 'malicious', categories: ['phishing'] }) } as Response;
    }) as unknown as typeof fetch;

    const provider = new ReputationProvider({ apiKey: 'secret-key', fetchImpl });
    const findings = await provider.investigate(classifyTarget('evil.example'));

    expect(findings[0]!.claim).toMatch(/malicious/);
    expect(findings[0]!.claim).toMatch(/phishing/);
    expect(authHeader).toContain('secret-key'); // key sent in header...
    expect(findings[0]!.citation.source).not.toContain('secret-key'); // ...never in the citation
  });
});
