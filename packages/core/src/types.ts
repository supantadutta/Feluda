/**
 * Feluda shared domain vocabulary.
 *
 * These types are the contracts that flow *between* layers (see SPEC.md — the
 * deduction loop). They are intentionally implementation-free: Phase 0 only
 * fixes the shapes so each layer can be built against a stable boundary.
 */

/** A question entering the deduction loop. */
export interface Query {
  /** Stable id for tracing this query through the loop. */
  id: string;
  /** The raw user question. */
  text: string;
  /** Optional case this query belongs to (Layer V). */
  caseId?: string;
  /** When the query was received. */
  receivedAt: string;
}

/** A single piece of evidence gathered for a query (Layer IV). */
export interface Evidence {
  id: string;
  /** The factual claim this evidence supports. */
  claim: string;
  /** Where it came from — every fact carries provenance (Layer IV). */
  citation: Citation;
  /** 0..1 credibility score assigned by the Source Verifier. */
  credibility: number;
  /** 0..1 relevance to the query, assigned by the Evidence Weigher. */
  relevance: number;
  /** Quality flags, e.g. 'single-source', 'low-credibility', 'offline-fixture'. */
  flags?: string[];
}

/** The non-negotiable hard boundaries (CLAUDE.md / Layer VII). */
export type Boundary = 'lawful-use' | 'defensive-only' | 'weapon-cbrn';

/** Provenance for a fact — the Citation Trail (Layer IV). */
export interface Citation {
  /** Canonical URL or document reference. */
  source: string;
  /** Human-readable title of the source. */
  title?: string;
  /** When the source was published, if known. */
  publishedAt?: string;
  /** When Feluda retrieved it. */
  retrievedAt: string;
}

/** A rival explanation produced by the Hypothesis Engine (Layer II). */
export interface Hypothesis {
  id: string;
  statement: string;
  /** Current belief in this hypothesis, 0..1 (Bayesian-style). */
  belief: number;
  /** Evidence ids that support or undercut this hypothesis. */
  supporting: string[];
  contradicting: string[];
}

/** Calibrated confidence in a verdict (Layer II — Confidence Calibrator). */
export interface Confidence {
  /** 0..1 calibrated confidence. */
  score: number;
  /** A coarse band for display. */
  band: 'low' | 'medium' | 'high';
  /** Named gaps / what would raise confidence. Never inflate certainty. */
  gaps: string[];
}

/** One recorded step in the reasoning chain (Layer II — Reasoning Tracer). */
export interface ReasoningStep {
  stage: 'gather' | 'hypothesize' | 'cross-examine' | 'weigh' | 'verdict';
  summary: string;
  /** Ids of evidence / hypotheses referenced at this step. */
  refs?: string[];
  at: string;
}

/** The auditable chain from clue to verdict. */
export type ReasoningTrace = ReasoningStep[];

/** The final, transparent output of the deduction loop. */
export interface Verdict {
  queryId: string;
  /** The answer in plain language. */
  answer: string;
  trace: ReasoningTrace;
  confidence: Confidence;
  /** Every external claim links back to where it came from. */
  citations: Citation[];
  /** Hypotheses considered, with final belief, for transparency. */
  hypotheses: Hypothesis[];
  /** The evidence gathered for this query (Layer IV), with quality flags. */
  evidence?: Evidence[];
  /** Where models agreed/disagreed when the Council was consulted (Layer III). */
  council?: CouncilReport;
  /** Prior verdicts this investigation's evidence appears to contradict (Layer V). */
  reviewFlags?: ReviewFlag[];
  /** How the agentic deduction loop ran (rounds, convergence). */
  investigation?: InvestigationSummary;
  /**
   * Set when the request (or a generated answer) was blocked by the Ethics
   * layer. The answer then states the refusal and proposes a lawful path.
   */
  refusal?: {
    boundary: Boundary;
    reason: string;
    lawfulAlternative: string;
  };
}

/** A summary of how the iterative deduction loop ran (Layer II). */
export interface InvestigationSummary {
  mode: 'shallow' | 'deep';
  /** Evidence-gathering rounds actually run. */
  rounds: number;
  /** Whether a leading hypothesis dominated within the round budget. */
  converged: boolean;
  /** Why the loop stopped (e.g. "a hypothesis dominates", "reached round budget"). */
  stopReason: string;
}

/** A prior verdict flagged for re-review because new evidence contradicts it. */
export interface ReviewFlag {
  priorSummary: string;
  reason: string;
  priorQueryId?: string;
}

/** Summary of a Multi-AI Council consultation (Layer III). */
export interface CouncilReport {
  /** Models that took part. */
  panel: string[];
  /** 0..1 agreement across the panel (1 = unanimous). */
  agreement: number;
  /** Points where the panel diverged — divergence is signal, not noise. */
  dissent: string[];
  /** Whether the cost cap forced a single-model fallback. */
  fellBackToSingle: boolean;
}

/** A single structured audit-log entry (Layer VII — Audit & Approval). */
export interface AuditEntry {
  at: string;
  /** What happened, e.g. 'query.received', 'verdict.produced'. */
  event: string;
  /** Non-secret structured detail. Secrets must never appear here. */
  detail: Record<string, unknown>;
}
