/**
 * Verdict synthesis (Layer II). Given the weighed hypotheses, asks the model for
 * its reasoned answer, the reasoning steps it took, and a self-assessed
 * confidence. The Confidence Calibrator has the final say on the number; this
 * provides the model's own honest read plus the gaps it sees.
 */
import type { Hypothesis, Query } from '../types.js';
import type { ModelGateway } from '../layer3-council/index.js';
import { extractJson, clamp01 } from '../util/json.js';

const SYSTEM = 'You are Feluda — a calm, rigorous investigator. Respond with ONLY valid JSON.';

export interface SynthesisResult {
  answer: string;
  reasoning: string[];
  modelScore: number;
  gaps: string[];
}

export class LlmSynthesizer {
  constructor(private readonly gateway: ModelGateway) {}

  async synthesize(query: Query, hypotheses: Hypothesis[]): Promise<SynthesisResult> {
    const hypoSummary = hypotheses.map((h) => ({ statement: h.statement, belief: h.belief }));
    const prompt = [
      'TASK=SYNTHESIS',
      'Give your reasoned verdict. No external sources are available; rely on general knowledge',
      'and say so. Never fabricate citations. Be calibrated — if uncertain, say so and lower',
      'confidence.',
      `Question: "${query.text}"`,
      `Hypotheses: ${JSON.stringify(hypoSummary)}`,
      'Return ONLY JSON: {"answer":string,"reasoning":[string, ... 2 to 5 steps],',
      '"confidence":{"score":number,"band":"low"|"medium"|"high","gaps":[string, ...]}}.',
    ].join('\n');

    const res = await this.gateway.complete({ system: SYSTEM, prompt, task: 'general' });
    const parsed = extractJson<{
      answer?: string;
      reasoning?: string[];
      confidence?: { score?: number; gaps?: string[] };
    }>(res.text);

    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer.trim() : '',
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.filter(Boolean) : [],
      modelScore: clamp01(parsed.confidence?.score ?? 0),
      gaps: Array.isArray(parsed.confidence?.gaps) ? parsed.confidence!.gaps.filter(Boolean) : [],
    };
  }
}
