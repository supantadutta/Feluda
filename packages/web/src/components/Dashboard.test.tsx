import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Verdict } from '@feluda/core';
import { Dashboard } from './Dashboard.js';

const verdict: Verdict = {
  queryId: 'q',
  answer: 'Insider involvement is likely.',
  trace: [
    { stage: 'gather', summary: 'Gathered 2 sources.', at: '' },
    { stage: 'verdict', summary: 'Reached a verdict.', at: '' },
  ],
  confidence: { score: 0.5, band: 'medium', gaps: [] },
  citations: [{ source: 'https://nist.gov/x', title: 'NIST', retrievedAt: '' }],
  hypotheses: [{ id: 'h', statement: 'Insider', belief: 0.6, supporting: [], contradicting: [] }],
  evidence: [
    { id: 'e', claim: 'Ledger shows a transfer.', citation: { source: 'https://nist.gov/x', retrievedAt: '' }, credibility: 0.9, relevance: 0.8 },
  ],
};

describe('Dashboard', () => {
  afterEach(cleanup);

  it('shows the evidence board and timeline for the session', () => {
    render(<Dashboard verdicts={[verdict]} />);
    expect(screen.getByText(/Evidence board \(1\)/)).toBeDefined();
    expect(screen.getByText(/Timeline \(2 steps\)/)).toBeDefined();
    expect(screen.getByText(/Ledger shows a transfer/)).toBeDefined();
  });

  it('renders an empty state with no investigations', () => {
    render(<Dashboard verdicts={[]} />);
    expect(screen.getByText(/No investigations yet/)).toBeDefined();
  });
});
