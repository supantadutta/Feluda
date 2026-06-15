/**
 * Investigation Planner (Layer II). Decides how deep to investigate before the
 * loop runs (the orchestrator's "decide depth based on the question"). Simple
 * factual questions short-circuit to a single round; complex, causal, or
 * multi-part questions get an iterative, multi-round investigation.
 */
import type { Query } from '../types.js';

export type InvestigationMode = 'shallow' | 'deep';

export interface InvestigationPlan {
  mode: InvestigationMode;
  /** Maximum evidence-gathering rounds. */
  maxRounds: number;
  /** Stop once the leading hypothesis reaches this belief… */
  confidenceTarget: number;
  /** …and leads the runner-up by at least this much. */
  separationTarget: number;
}

const DEEP_SIGNALS =
  /\b(why|how|cause|caused|reason|because|compare|versus|vs\.?|relationship|investigate|who\s+(did|stole|killed|is|was)|explain|motive|implicat|consequenc|impact|trade-?off)\b/i;

export class InvestigationPlanner {
  plan(query: Query): InvestigationPlan {
    const t = query.text.trim();
    const clauseSignals = (t.match(/,|;|\band\b|\bor\b/gi) ?? []).length;
    const deep = DEEP_SIGNALS.test(t) || clauseSignals >= 2 || t.length > 80;
    return deep
      ? { mode: 'deep', maxRounds: 3, confidenceTarget: 0.7, separationTarget: 0.2 }
      : { mode: 'shallow', maxRounds: 1, confidenceTarget: 0.7, separationTarget: 0.15 };
  }
}
