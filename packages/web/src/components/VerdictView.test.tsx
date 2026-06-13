import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Verdict } from '@feluda/core';
import { VerdictView } from './VerdictView.js';

const sample: Verdict = {
  queryId: 'q1',
  answer: 'A trustworthy source is primary, independent, and verifiable.',
  trace: [
    { stage: 'gather', summary: 'No external evidence (Phase 1).', at: '' },
    { stage: 'hypothesize', summary: 'Formed 2 hypotheses.', at: '' },
    { stage: 'verdict', summary: 'Reached a verdict.', at: '' },
  ],
  confidence: { score: 0.5, band: 'medium', gaps: ['No external evidence gathered.'] },
  citations: [],
  hypotheses: [{ id: 'h1', statement: 'Primary sources are most reliable.', belief: 0.6, supporting: [], contradicting: [] }],
};

describe('VerdictView', () => {
  afterEach(cleanup);

  it('shows the answer, confidence and trace', () => {
    render(<VerdictView verdict={sample} />);
    expect(screen.getByText(/trustworthy source is primary/i)).toBeDefined();
    expect(screen.getByText(/Confidence: medium/i)).toBeDefined();
    expect(screen.getByText(/Reasoning trace \(3 steps\)/i)).toBeDefined();
  });

  it('renders a refusal distinctly', () => {
    const refused: Verdict = {
      ...sample,
      answer: "I can't help with that.\n\nHere is a lawful alternative.",
      refusal: { boundary: 'defensive-only', reason: 'blocked', lawfulAlternative: 'do this instead' },
    };
    render(<VerdictView verdict={refused} />);
    expect(screen.getByText(/Refused · defensive-only/i)).toBeDefined();
  });
});
