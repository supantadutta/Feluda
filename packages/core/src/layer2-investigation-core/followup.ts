/**
 * Discriminating-Question Generator (Layer II). Between rounds, a good
 * investigator asks the question whose answer best separates the leading
 * hypotheses. Deterministic and model-free: it targets the closest competing
 * pair so the next evidence-gathering round is pointed where it matters.
 */
import type { Hypothesis, Query } from '../types.js';

export class DiscriminatingQuestioner {
  next(query: Query, hypotheses: Hypothesis[]): string {
    const sorted = [...hypotheses].sort((a, b) => b.belief - a.belief);
    const a = sorted[0];
    const b = sorted[1];
    if (!a) return query.text;
    if (!b) {
      return `What additional evidence would confirm or rule out: ${a.statement}?`;
    }
    return `Regarding "${query.text}", what evidence would distinguish whether ${a.statement} versus ${b.statement}?`;
  }
}
