import { describe, it, expect } from 'vitest';
import {
  Council,
  agreementOf,
  SpecialistRouter,
  type ModelGateway,
  type ModelResponse,
  type PanelMember,
} from '../src/layer3-council/index.js';
import type { Hypothesis, Query } from '../src/types.js';

/** A gateway that always answers with a scripted synthesis JSON. */
function scripted(answer: string, score = 0.6): ModelGateway {
  return {
    async complete(): Promise<ModelResponse> {
      return {
        text: JSON.stringify({ answer, reasoning: ['r'], confidence: { score, gaps: [] } }),
        model: 'scripted',
      };
    },
  };
}

const query: Query = { id: 'q', text: 'who did it?', receivedAt: '' };
const hyps: Hypothesis[] = [{ id: 'h', statement: 'the butler', belief: 0.6, supporting: [], contradicting: [] }];

describe('Disagreement detection', () => {
  it('scores unanimous answers high and divergent answers low', () => {
    expect(agreementOf(['the butler did it', 'the butler did it'])).toBeGreaterThan(0.9);
    expect(agreementOf(['the butler did it', 'a stranger broke in through the roof'])).toBeLessThan(0.6);
  });
});

describe('Council panel reasoning', () => {
  it('surfaces dissent when the panel diverges', async () => {
    const members: PanelMember[] = [
      { id: 'm1', gateway: scripted('The butler is responsible, given the ledger.', 0.7) },
      { id: 'm2', gateway: scripted('An outside intruder entered via the terrace window.', 0.5) },
    ];
    const council = new Council(members, members[0]!.gateway);
    const { synthesis, report } = await council.consult(query, hyps);

    expect(report.panel).toEqual(['m1', 'm2']);
    expect(report.fellBackToSingle).toBe(false);
    expect(report.agreement).toBeLessThan(0.6);
    expect(report.dissent.length).toBe(2);
    // Judge picks the highest-scoring member's answer.
    expect(synthesis.answer).toMatch(/butler/i);
    expect(synthesis.gaps.join(' ')).toMatch(/disagreement/i);
  });

  it('reports near-unanimous agreement with no dissent', async () => {
    const members: PanelMember[] = [
      { id: 'm1', gateway: scripted('The butler is responsible for the theft.', 0.6) },
      { id: 'm2', gateway: scripted('The butler is responsible for the theft.', 0.6) },
    ];
    const { report } = await new Council(members, members[0]!.gateway).consult(query, hyps);
    expect(report.agreement).toBeGreaterThan(0.9);
    expect(report.dissent).toEqual([]);
  });

  it('cost cap demonstrably falls back to a single model', async () => {
    const members: PanelMember[] = [
      { id: 'm1', gateway: scripted('answer one', 0.6), usdPer1k: 100 },
      { id: 'm2', gateway: scripted('answer two', 0.6), usdPer1k: 100 },
    ];
    const council = new Council(members, members[0]!.gateway, { costCapUsd: 0.0001 });
    const { report } = await council.consult(query, hyps);
    expect(report.fellBackToSingle).toBe(true);
    expect(report.panel).toEqual(['m1']);
  });
});

describe('Specialist routing', () => {
  it('routes by task type with a fallback', () => {
    const router = new SpecialistRouter({ code: 'code-model', math: 'math-model' }, 'general-model');
    expect(router.route('code')).toBe('code-model');
    expect(router.route('vision')).toBe('general-model');
    expect(router.route()).toBe('general-model');
  });
});
