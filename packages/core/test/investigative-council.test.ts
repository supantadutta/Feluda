import { describe, it, expect } from 'vitest';
import { InvestigativeCouncil } from '../src/layer3-council/index.js';
import { createOrchestrator } from '../src/layer2-investigation-core/index.js';
import { StubGateway } from '../src/layer3-council/index.js';
import type { Evidence, Hypothesis, Query } from '../src/types.js';

const council = new InvestigativeCouncil();

function hyp(statement: string, belief: number, supporting: string[] = [], contradicting: string[] = []): Hypothesis {
  return { id: 's_' + Math.random().toString(36).slice(2), statement, belief, supporting, contradicting };
}

describe('Investigative council (role-based review)', () => {
  it('challenges a near-tie and recommends gathering more', () => {
    const r = council.review({
      answer: 'It is probably the insider.',
      hypotheses: [hyp('insider', 0.52), hyp('outsider', 0.48)],
      evidence: [],
      confidence: { score: 0.5, band: 'medium', gaps: [] },
      citations: [],
    });
    expect(r.findings.some((f) => f.role === 'skeptic' && f.severity === 'concern')).toBe(true);
    expect(r.recommendation).toBe('gather_more');
    expect(r.missingEvidence.length).toBeGreaterThan(0);
  });

  it('flags overconfident language unsupported by belief', () => {
    const r = council.review({
      answer: 'This is definitely a confirmed compromise.',
      hypotheses: [hyp('compromise', 0.5)],
      evidence: [],
      confidence: { score: 0.5, band: 'medium', gaps: [] },
      citations: [],
    });
    expect(r.findings.some((f) => f.role === 'cyber' && f.severity === 'concern')).toBe(true);
  });

  it('proceeds when a hypothesis dominates with corroborated sources', () => {
    const ev = (source: string): Evidence => ({ id: source, claim: 'insider performed the access', citation: { source, retrievedAt: '' }, credibility: 0.9, relevance: 1 });
    const r = council.review({
      answer: 'The evidence indicates an insider.',
      hypotheses: [hyp('insider', 0.85, ['a', 'b']), hyp('outsider', 0.15)],
      evidence: [ev('https://nist.gov/a'), ev('https://who.int/b')],
      confidence: { score: 0.8, band: 'high', gaps: [] },
      citations: [{ source: 'https://nist.gov/a', retrievedAt: '' }, { source: 'https://who.int/b', retrievedAt: '' }],
    });
    expect(r.recommendation).toBe('proceed');
  });

  it('rides on the verdict from the orchestrator', async () => {
    const orch = createOrchestrator({ gateway: new StubGateway() });
    const query: Query = { id: 'q', text: 'why did the system fail?', receivedAt: '' };
    const verdict = await orch.investigate(query);
    expect(verdict.councilReview).toBeDefined();
    expect(verdict.councilReview!.findings.some((f) => f.role === 'judge')).toBe(true);
  });
});
