/**
 * Layer II — Investigation Core (boundary module)
 * ───────────────────────────────────────────────
 * The brain. Runs the deduction loop: gather → hypothesize → cross-examine →
 * weigh → verdict. Decides how deep to investigate (simple queries short-circuit).
 *
 * Sub-parts (SPEC.md): Orchestrator, Hypothesis Engine, Evidence Weigher,
 * Confidence Calibrator, Reasoning Tracer.
 *
 * Phase: implemented in Phase 1.
 */
import type {
  Confidence,
  Evidence,
  Hypothesis,
  Query,
  ReasoningTrace,
  Verdict,
} from '../types.js';
import { notImplemented } from '../util/not-implemented.js';

/** Generates competing explanations (abductive reasoning). */
export interface HypothesisEngine {
  generate(query: Query, evidence: Evidence[]): Promise<Hypothesis[]>;
}

/** Scores facts and updates belief in each hypothesis (Bayesian-style). */
export interface EvidenceWeigher {
  weigh(hypotheses: Hypothesis[], evidence: Evidence[]): Promise<Hypothesis[]>;
}

/** Produces honest confidence and names the gaps. Never inflates certainty. */
export interface ConfidenceCalibrator {
  calibrate(hypotheses: Hypothesis[], evidence: Evidence[]): Confidence;
}

/** Records the auditable chain from clue → verdict. */
export interface ReasoningTracer {
  start(query: Query): ReasoningTrace;
}

/** The orchestrator: plan → act → verify loop over the whole deduction loop. */
export interface Orchestrator {
  investigate(query: Query): Promise<Verdict>;
}

/** Phase 0 placeholder — wired up in Phase 1. */
export function createOrchestrator(): Orchestrator {
  return {
    investigate: () => notImplemented('Layer II Orchestrator.investigate'),
  };
}
