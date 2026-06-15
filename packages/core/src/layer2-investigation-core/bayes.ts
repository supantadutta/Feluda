/**
 * Bayesian Evidence Weigher (Layer II). Updates belief in each hypothesis from
 * the evidence — properly, not by normalising priors.
 *
 *   posterior(h) ∝ prior(h) · ∏ likelihood(evidence_i | h)
 *
 * For each (hypothesis, evidence) pair we estimate a likelihood from how well the
 * evidence matches the hypothesis (bag-of-words similarity), scaled by the
 * source's credibility and relevance, and flipped when the evidence contradicts
 * the hypothesis (negation/antonym). Computation is done in log-space and
 * normalised with a softmax, so it is numerically stable and order-independent.
 *
 * It also records WHICH evidence supports or undercuts each hypothesis, so the
 * reasoning trace and the UI can show the chain from clue to belief.
 */
import type { Evidence, Hypothesis } from '../types.js';
import { stance, distinctiveTerms } from '../util/text.js';
import { clamp01 } from '../util/json.js';
import type { EvidenceWeigher } from './index.js';

/** Max likelihood swing away from 0.5 (keeps likelihoods in (0.05, 0.95)). */
const MAX_SWING = 0.45;

export class BayesianEvidenceWeigher implements EvidenceWeigher {
  weigh(hypotheses: Hypothesis[], evidence: Evidence[]): Promise<Hypothesis[]> {
    return Promise.resolve(this.update(hypotheses, evidence));
  }

  update(hypotheses: Hypothesis[], evidence: Evidence[]): Hypothesis[] {
    if (hypotheses.length === 0) return [];

    // Priors: use the supplied belief, falling back to uniform.
    const priorMass = hypotheses.map((h) => (h.belief > 0 ? h.belief : 1));
    const priorSum = priorMass.reduce((s, v) => s + v, 0) || 1;
    const focus = distinctiveTerms(hypotheses.map((h) => h.statement));

    const scored = hypotheses.map((h, i) => {
      let logPost = Math.log(priorMass[i]! / priorSum);
      const supporting: string[] = [];
      const contradicting: string[] = [];

      for (const e of evidence) {
        const { direction, strength } = stance(e.claim, h.statement, focus[i]);
        // Neutral evidence has baseline likelihood 0.5 (NOT skipped) — otherwise
        // a hypothesis the evidence ignores would out-rank one it supports.
        let likelihood = 0.5;
        if (direction !== 0 && strength > 0) {
          const eff = clamp01(strength * e.credibility * (e.relevance || 1));
          likelihood = direction > 0 ? 0.5 + MAX_SWING * eff : 0.5 - MAX_SWING * eff;
          (direction > 0 ? supporting : contradicting).push(e.id);
        }
        logPost += Math.log(likelihood);
      }
      return { h, logPost, supporting, contradicting };
    });

    // Softmax over log-posteriors → normalised beliefs.
    const maxLog = Math.max(...scored.map((s) => s.logPost));
    const exps = scored.map((s) => Math.exp(s.logPost - maxLog));
    const sum = exps.reduce((s, v) => s + v, 0) || 1;

    return scored.map((s, i) => ({
      ...s.h,
      belief: exps[i]! / sum,
      supporting: s.supporting,
      contradicting: s.contradicting,
    }));
  }
}

/** Sort by belief and report the leading hypothesis and its separation. */
export function dominance(hypotheses: Hypothesis[]): {
  top?: Hypothesis;
  topBelief: number;
  separation: number;
} {
  if (hypotheses.length === 0) return { topBelief: 0, separation: 0 };
  const sorted = [...hypotheses].sort((a, b) => b.belief - a.belief);
  const top = sorted[0]!;
  const second = sorted[1]?.belief ?? 0;
  return { top, topBelief: top.belief, separation: top.belief - second };
}
