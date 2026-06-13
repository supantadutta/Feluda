/**
 * Evidence Weigher (Layer II). In Phase 1 there is no external evidence yet, so
 * this performs no Bayesian update — it simply normalises the priors so beliefs
 * are comparable. The real evidence-driven update arrives in Phase 2 when Layer
 * IV starts feeding facts in.
 */
import type { Evidence, Hypothesis } from '../types.js';
import type { EvidenceWeigher } from './index.js';

export class NormalizingEvidenceWeigher implements EvidenceWeigher {
  async weigh(hypotheses: Hypothesis[], _evidence: Evidence[]): Promise<Hypothesis[]> {
    const total = hypotheses.reduce((s, h) => s + h.belief, 0);
    if (total <= 0) return hypotheses;
    return hypotheses.map((h) => ({ ...h, belief: h.belief / total }));
  }
}
