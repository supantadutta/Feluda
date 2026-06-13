import { describe, it, expect } from 'vitest';
import { createActionPort, ReportBuilder, DataAnalyzer, DefensiveSecurity } from '../src/layer6-action/index.js';
import type { Verdict } from '../src/types.js';

const verdict: Verdict = {
  queryId: 'q',
  answer: 'The ledger points to an insider.',
  trace: [{ stage: 'verdict', summary: 'done', at: '' }],
  confidence: { score: 0.5, band: 'medium', gaps: ['single source'] },
  citations: [{ source: 'https://nist.gov/x', title: 'NIST', retrievedAt: '' }],
  hypotheses: [{ id: 'h', statement: 'insider', belief: 0.6, supporting: [], contradicting: [] }],
};

describe('Report builder', () => {
  it('exports a Markdown case report with answer, trace and citations', () => {
    const r = new ReportBuilder().build(verdict, 'markdown');
    expect(r.mime).toBe('text/markdown');
    expect(r.content).toMatch(/# Feluda Case Report/);
    expect(r.content).toMatch(/insider/);
    expect(r.content).toMatch(/nist\.gov/);
  });
});

describe('Data analyzer', () => {
  it('computes stats and emits an SVG chart from a CSV', () => {
    const a = new DataAnalyzer().analyzeCsv('day,sales\n1,10\n2,20\n3,30');
    expect(a.rowCount).toBe(3);
    const sales = a.numericStats.find((s) => s.column === 'sales')!;
    expect(sales.mean).toBe(20);
    expect(a.chartSvg).toMatch(/^<svg/);
  });
});

describe('Defensive security (defensive scope only)', () => {
  it('triages logs and flags failed-auth bursts as critical', () => {
    const findings = new DefensiveSecurity().triageLogs([
      'Failed password for root',
      'Failed password for admin',
      'authentication failure',
      'invalid user bob',
      'Failed login for guest',
    ]);
    expect(findings.some((f) => f.severity === 'critical')).toBe(true);
  });

  it('drafts a Sigma-style detection rule', () => {
    const rule = new DefensiveSecurity().draftDetectionRule('Brute force', 'Failed password');
    expect(rule).toMatch(/title: Brute force/);
    expect(rule).toMatch(/detection:/);
  });
});

describe('Approval gate', () => {
  it('blocks a consequential action until confirmed', async () => {
    const action = createActionPort();
    const add = await action.perform({ kind: 'ops.task.add', payload: { title: 't' } });
    const id = (add.detail!.task as { id: string }).id;

    const blocked = await action.perform({ kind: 'ops.task.delete', payload: { id } });
    expect(blocked.ok).toBe(false);
    expect(blocked.awaitingApproval).toBe(true);

    const confirmed = await action.perform({ kind: 'ops.task.delete', payload: { id, confirmed: true } });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.detail!.deleted).toBe(true);
  });

  it('lets non-consequential actions run without confirmation', async () => {
    const action = createActionPort();
    const res = await action.perform({ kind: 'data.analyze', payload: { csv: 'a\n1' } });
    expect(res.ok).toBe(true);
  });
});
