import { describe, it, expect } from 'vitest';
import { CaseManager, buildTimeline, CaseReportBuilder } from '../src/case/index.js';
import type { Evidence, Verdict } from '../src/types.js';

function ev(claim: string, source: string): Evidence {
  return { id: 'e_' + Math.random().toString(36).slice(2), claim, citation: { source, retrievedAt: '' }, credibility: 0.9, relevance: 0.8 };
}

describe('Timeline builder', () => {
  it('extracts and sorts ISO-dated events, flagging ambiguous dates', () => {
    const t = buildTimeline(
      ['2026-06-10T09:00:00Z user login from 10.0.0.5', 'yesterday the account was locked'].join('\n'),
      'siem',
    );
    expect(t[0]!.at).toBe('2026-06-10T09:00:00Z');
    expect(t.find((e) => e.uncertainty)).toBeDefined();
  });
});

describe('Case manager', () => {
  it('creates a case with default lawful boundaries', () => {
    const c = new CaseManager().create({ title: 'Suspicious login investigation', objective: 'Determine if account X is compromised' });
    expect(c.status).toBe('open');
    expect(c.boundaries.join(' ')).toMatch(/lawful|defensive/i);
  });

  it('attaches evidence and extracts entities + timeline', () => {
    const m = new CaseManager();
    const c = m.create({ title: 'Case' });
    m.addEvidence(c.id, [ev('2026-06-11T10:00:00Z login from 203.0.113.9 to vpn.example.com', 'siem')]);
    const got = m.get(c.id)!;
    expect(got.evidence).toHaveLength(1);
    expect(got.subjectEntities.some((e) => e.type === 'ip')).toBe(true);
    expect(got.timeline.length).toBeGreaterThan(0);
  });

  it('applies a verdict — updating hypotheses and confidence history', () => {
    const m = new CaseManager();
    const c = m.create({ title: 'Case' });
    const verdict: Verdict = {
      queryId: 'q',
      answer: 'Likely an insider.',
      trace: [],
      confidence: { score: 0.5, band: 'medium', gaps: ['single source'] },
      citations: [],
      hypotheses: [{ id: 'h', statement: 'insider', belief: 0.7, supporting: [], contradicting: [] }],
    };
    m.applyVerdict(c.id, 'who did it?', verdict);
    const got = m.get(c.id)!;
    expect(got.status).toBe('investigating');
    expect(got.hypotheses).toHaveLength(1);
    expect(got.confidenceHistory).toHaveLength(1);
    expect(got.unresolvedQuestions).toContain('single source');
  });
});

describe('Case report builder', () => {
  it('produces an OSINT case report with scope, hypotheses, and citations', () => {
    const m = new CaseManager();
    const c = m.create({ title: 'Domain investigation', objective: 'Assess reputation' });
    m.addEvidence(c.id, [ev('example.com has no adverse reputation', 'https://reputation.example/feed')]);
    const report = new CaseReportBuilder().build(m.get(c.id)!, 'osint_case');
    expect(report.content).toMatch(/# OSINT Case Report/);
    expect(report.content).toMatch(/## Scope/);
    expect(report.content).toMatch(/reputation\.example/);
  });
});
