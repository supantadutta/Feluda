/**
 * Hypothesis Engine (Layer II) — abductive reasoning. Asks the model for a set
 * of competing explanations and keeps them explicit, each with a prior belief.
 */
import type { Evidence, Hypothesis, Query } from '../types.js';
import type { ModelGateway } from '../layer3-council/index.js';
import { extractJson, clamp01 } from '../util/json.js';
import { newId } from '../util/ids.js';
import type { HypothesisEngine } from './index.js';

const SYSTEM = 'You are Feluda — a calm, rigorous investigator. Respond with ONLY valid JSON.';

interface RawHypothesis {
  statement: string;
  belief: number;
}

export class LlmHypothesisEngine implements HypothesisEngine {
  constructor(private readonly gateway: ModelGateway) {}

  async generate(query: Query, evidence: Evidence[], memory: string[] = []): Promise<Hypothesis[]> {
    const evidenceBlock =
      evidence.length > 0
        ? `Evidence gathered:\n${evidence.map((e, i) => `[${i + 1}] ${e.claim}`).join('\n')}`
        : 'No external evidence is available; reason over the question and general knowledge.';
    const memoryBlock =
      memory.length > 0 ? `Prior context from memory:\n${memory.join('\n---\n')}` : '';
    const prompt = [
      'TASK=HYPOTHESES',
      memoryBlock,
      evidenceBlock,
      'Do NOT invent sources or citations.',
      `Question: "${query.text}"`,
      'Return ONLY JSON: {"hypotheses":[{"statement":string,"belief":number}, ... 2 to 4 items]}.',
      'belief is your prior plausibility in 0..1; they need not sum to 1.',
    ].join('\n');

    const res = await this.gateway.complete({ system: SYSTEM, prompt, task: 'general' });
    const parsed = extractJson<{ hypotheses?: RawHypothesis[] }>(res.text);
    const raw = Array.isArray(parsed.hypotheses) ? parsed.hypotheses.slice(0, 4) : [];

    return raw
      .filter((h) => typeof h.statement === 'string' && h.statement.trim().length > 0)
      .map((h) => ({
        id: newId('hyp'),
        statement: h.statement.trim(),
        belief: clamp01(h.belief),
        supporting: [],
        contradicting: [],
      }));
  }
}
