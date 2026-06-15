import { describe, it, expect } from 'vitest';
import {
  BayesianEvidenceWeigher,
  dominance,
  InvestigationPlanner,
  DiscriminatingQuestioner,
  createOrchestrator,
} from '../src/layer2-investigation-core/index.js';
import {
  SearchEvidencePort,
  type SearchProvider,
  type SearchResult,
} from '../src/layer4-evidence/index.js';
import type { Evidence, Hypothesis, Query } from '../src/types.js';
import type { ModelGateway, ModelResponse } from '../src/layer3-council/index.js';

function hyp(id: string, statement: string, belief: number): Hypothesis {
  return { id, statement, belief, supporting: [], contradicting: [] };
}
function ev(claim: string, source: string, credibility = 0.9): Evidence {
  return { id: claim, claim, citation: { source, retrievedAt: '' }, credibility, relevance: 1 };
}

describe('Bayesian evidence weigher', () => {
  it('raises belief in the hypothesis the evidence supports', async () => {
    const hyps = [hyp('h1', 'The butler stole the diamond', 0.5), hyp('h2', 'An outside intruder stole the diamond', 0.5)];
    const evidence = [
      ev('CCTV shows the butler taking the diamond from the safe', 'https://nist.gov/a'),
      ev('The ledger records the butler handling the diamond', 'https://who.int/b'),
    ];
    const out = await new BayesianEvidenceWeigher().weigh(hyps, evidence);
    const butler = out.find((h) => h.id === 'h1')!;
    const intruder = out.find((h) => h.id === 'h2')!;
    expect(butler.belief).toBeGreaterThan(intruder.belief);
    expect(butler.supporting.length).toBeGreaterThan(0);
  });

  it('lowers belief when evidence contradicts (polarity flip)', async () => {
    const hyps = [hyp('h1', 'The painting is authentic', 0.5), hyp('h2', 'The painting is forged', 0.5)];
    const evidence = [ev('Lab analysis concluded the painting is forged, not authentic', 'https://nist.gov/x')];
    const out = await new BayesianEvidenceWeigher().weigh(hyps, evidence);
    expect(out.find((h) => h.id === 'h2')!.belief).toBeGreaterThan(out.find((h) => h.id === 'h1')!.belief);
  });

  it('reports dominance and separation', () => {
    const d = dominance([hyp('a', 'x', 0.8), hyp('b', 'y', 0.2)]);
    expect(d.top?.id).toBe('a');
    expect(d.separation).toBeCloseTo(0.6);
  });
});

describe('Investigation planner', () => {
  it('plans a deep investigation for causal/complex questions', () => {
    const planner = new InvestigationPlanner();
    expect(planner.plan({ id: 'q', text: 'Why did the login fail and who was responsible?', receivedAt: '' }).mode).toBe('deep');
    expect(planner.plan({ id: 'q', text: 'capital of France', receivedAt: '' }).mode).toBe('shallow');
  });
});

describe('Discriminating questioner', () => {
  it('targets the two leading hypotheses', () => {
    const q = new DiscriminatingQuestioner().next({ id: 'q', text: 'who stole it?', receivedAt: '' }, [
      hyp('h1', 'the butler did it', 0.5),
      hyp('h2', 'an intruder did it', 0.4),
    ]);
    expect(q).toMatch(/butler/);
    expect(q).toMatch(/versus|distinguish/);
  });
});

/** A provider that returns ambiguous evidence first, decisive evidence on the follow-up. */
class TwoRoundProvider implements SearchProvider {
  readonly name = 'two-round';
  readonly offline = false;
  async search(query: string): Promise<SearchResult[]> {
    if (/versus|distinguish/i.test(query)) {
      return [
        { title: 'A', url: 'https://nist.gov/insider', snippet: 'Verified logs show an insider account performed the access.' },
        { title: 'B', url: 'https://who.int/insider', snippet: 'Audit confirms an insider account, not an outsider, performed the access.' },
      ];
    }
    return [
      { title: 'A', url: 'https://nist.gov/amb', snippet: 'An access event occurred at the weekend.' },
      { title: 'B', url: 'https://who.int/amb', snippet: 'An access event was recorded over the weekend.' },
    ];
  }
}

describe('Iterative agentic loop', () => {
  it('runs multiple rounds, gathering targeted evidence until a hypothesis dominates', async () => {
    // Scripted gateway: two competing hypotheses with equal priors.
    const gateway: ModelGateway = {
      async complete(req): Promise<ModelResponse> {
        if (req.prompt.includes('TASK=HYPOTHESES')) {
          return {
            text: JSON.stringify({
              hypotheses: [
                { statement: 'An insider account performed the access', belief: 0.5 },
                { statement: 'An outsider performed the access', belief: 0.5 },
              ],
            }),
            model: 'scripted',
          };
        }
        return { text: JSON.stringify({ answer: 'Assessed.', reasoning: [], confidence: { score: 0.6, gaps: [] } }), model: 'scripted' };
      },
    };
    const orch = createOrchestrator({ gateway, evidence: new SearchEvidencePort(new TwoRoundProvider()) });
    const query: Query = { id: 'q', text: 'Why did the access happen and who was responsible?', receivedAt: '' };
    const verdict = await orch.investigate(query);

    expect(verdict.investigation!.mode).toBe('deep');
    expect(verdict.investigation!.rounds).toBeGreaterThanOrEqual(2);
    expect(verdict.investigation!.converged).toBe(true);
    // The insider hypothesis should lead after decisive round-2 evidence.
    const top = [...verdict.hypotheses].sort((a, b) => b.belief - a.belief)[0]!;
    expect(top.statement).toMatch(/insider/i);
    // Citations only from the provider's URLs (no fabrication).
    for (const c of verdict.citations) expect(c.source).toMatch(/nist\.gov|who\.int/);
  });
});
