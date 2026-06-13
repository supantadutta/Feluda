/**
 * Verdict synthesis (Layer II). Given the weighed hypotheses, asks the model for
 * its reasoned answer, the reasoning steps it took, and a self-assessed
 * confidence. The Confidence Calibrator has the final say on the number; this
 * provides the model's own honest read plus the gaps it sees.
 *
 * The prompt builder and parser are exported so the Multi-AI Council (Layer III)
 * can fan the identical task out to a panel of models.
 */
import type { Evidence, Hypothesis, Query } from '../types.js';
import type { ModelGateway } from '../layer3-council/index.js';
import { extractJson, clamp01 } from '../util/json.js';

export const SYNTH_SYSTEM =
  'You are Feluda — a calm, rigorous investigator. Respond with ONLY valid JSON.';

export interface SynthesisResult {
  answer: string;
  reasoning: string[];
  modelScore: number;
  gaps: string[];
}

export function buildSynthesisPrompt(
  query: Query,
  hypotheses: Hypothesis[],
  evidence: Evidence[] = [],
  memory: string[] = [],
): string {
  const hypoSummary = hypotheses.map((h) => ({ statement: h.statement, belief: h.belief }));
  const evidenceBlock =
    evidence.length > 0
      ? `Evidence (cite by [n], do not invent others):\n${evidence
          .map((e, i) => `[${i + 1}] ${e.claim} — ${e.citation.source}`)
          .join('\n')}`
      : 'No external sources are available; rely on general knowledge and say so.';
  const memoryBlock =
    memory.length > 0 ? `Prior context from memory (use if relevant):\n${memory.join('\n---\n')}` : '';
  return [
    'TASK=SYNTHESIS',
    'Give your reasoned verdict. Ground claims in the evidence below where possible.',
    'Never fabricate citations or URLs. Be calibrated — if uncertain, say so and lower confidence.',
    memoryBlock,
    evidenceBlock,
    `Question: "${query.text}"`,
    `Hypotheses: ${JSON.stringify(hypoSummary)}`,
    'Return ONLY JSON: {"answer":string,"reasoning":[string, ... 2 to 5 steps],',
    '"confidence":{"score":number,"band":"low"|"medium"|"high","gaps":[string, ...]}}.',
  ].join('\n');
}

export function parseSynthesis(text: string): SynthesisResult {
  const parsed = extractJson<{
    answer?: string;
    reasoning?: string[];
    confidence?: { score?: number; gaps?: string[] };
  }>(text);
  return {
    answer: typeof parsed.answer === 'string' ? parsed.answer.trim() : '',
    reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.filter(Boolean) : [],
    modelScore: clamp01(parsed.confidence?.score ?? 0),
    gaps: Array.isArray(parsed.confidence?.gaps) ? parsed.confidence!.gaps.filter(Boolean) : [],
  };
}

export class LlmSynthesizer {
  constructor(private readonly gateway: ModelGateway) {}

  async synthesize(
    query: Query,
    hypotheses: Hypothesis[],
    evidence: Evidence[] = [],
    memory: string[] = [],
  ): Promise<SynthesisResult> {
    const prompt = buildSynthesisPrompt(query, hypotheses, evidence, memory);
    const res = await this.gateway.complete({ system: SYNTH_SYSTEM, prompt, task: 'general' });
    return parseSynthesis(res.text);
  }
}
