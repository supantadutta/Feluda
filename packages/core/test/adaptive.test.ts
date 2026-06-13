import { describe, it, expect } from 'vitest';
import {
  FeedbackStore,
  PatternLibrary,
  SelfReview,
  createMemoryPort,
} from '../src/layer5-memory/index.js';
import { createOrchestrator } from '../src/layer2-investigation-core/index.js';
import { StubGateway } from '../src/layer3-council/index.js';
import type { Query } from '../src/types.js';
import type { ModelGateway, ModelResponse } from '../src/layer3-council/index.js';

function query(text: string): Query {
  return { id: 'q_' + Math.random().toString(36).slice(2), text, receivedAt: '' };
}

describe('Feedback loop', () => {
  it('surfaces a stored correction into a later answer (as data, not retraining)', async () => {
    const feedback = new FeedbackStore();
    feedback.add('Always prefer primary government sources over news.');

    // Capture the prompt the model receives to prove the preference is applied.
    let seen = '';
    const spyGateway: ModelGateway = {
      async complete(req): Promise<ModelResponse> {
        seen += req.prompt;
        return new StubGateway().complete(req);
      },
    };
    const orch = createOrchestrator({ gateway: spyGateway, feedback });
    const verdict = await orch.investigate(query('Which sources should I trust on tax policy?'));

    expect(seen).toMatch(/prefer primary government sources/i);
    expect(verdict.trace.some((s) => /user preference/i.test(s.summary))).toBe(true);
  });
});

describe('Pattern library (playbooks)', () => {
  it('applies a matching playbook to a repeat case type', async () => {
    const patterns = new PatternLibrary();
    patterns.save({
      caseType: 'art forgery',
      triggers: ['forgery', 'forged', 'painting'],
      seedHypotheses: ['The work is authentic.', 'The work is a forgery.'],
    });
    const orch = createOrchestrator({ gateway: new StubGateway(), patterns });
    const verdict = await orch.investigate(query('Is the disputed painting a forgery?'));
    expect(verdict.trace.some((s) => /Applied playbook "art forgery"/.test(s.summary))).toBe(true);
  });
});

describe('Self-review (belief revision)', () => {
  it('flags a prior verdict when new evidence contradicts it', async () => {
    const memory = createMemoryPort();
    // A prior case concluded the butler was guilty.
    await memory.rememberCase(
      { id: 'q1', text: 'Who stole the diamond?' },
      {
        queryId: 'q1',
        answer: 'The butler is guilty of stealing the diamond.',
        trace: [],
        confidence: { score: 0.6, band: 'medium', gaps: [] },
        citations: [],
        hypotheses: [],
      },
    );

    const review = new SelfReview(memory);
    const flags = await review.review('New evidence shows the butler is innocent of the diamond theft.');
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0]!.reason).toMatch(/contradict/i);
  });

  it('does not flag unrelated claims', async () => {
    const memory = createMemoryPort();
    await memory.rememberCase(
      { id: 'q1', text: 'Who stole the diamond?' },
      {
        queryId: 'q1',
        answer: 'The butler is guilty of stealing the diamond.',
        trace: [],
        confidence: { score: 0.6, band: 'medium', gaps: [] },
        citations: [],
        hypotheses: [],
      },
    );
    const flags = await new SelfReview(memory).review('The weather in Kathmandu is pleasant in spring.');
    expect(flags).toEqual([]);
  });
});
