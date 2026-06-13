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
  ReasoningStep,
  ReasoningTrace,
  Verdict,
} from '../types.js';
import type { ModelGateway, Council } from '../layer3-council/index.js';
import type { EvidencePort } from '../layer4-evidence/index.js';
import type { MemoryPort, FeedbackStore, PatternLibrary, SelfReview } from '../layer5-memory/index.js';
import type { EthicsGate, AuditLog } from '../layer7-ethics/index.js';
import { createModelGateway } from '../layer3-council/index.js';
import { createEthicsGate, InMemoryAuditLog } from '../layer7-ethics/index.js';
import { DeductionOrchestrator } from './orchestrator.js';

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
  record(stage: ReasoningStep['stage'], summary: string, refs?: string[]): void;
  trace(): ReasoningTrace;
}

/** The orchestrator: plan → act → verify loop over the whole deduction loop. */
export interface Orchestrator {
  investigate(query: Query): Promise<Verdict>;
}

export { DeductionOrchestrator, type OrchestratorDeps } from './orchestrator.js';
export { ArrayReasoningTracer } from './tracer.js';
export { BandConfidenceCalibrator } from './confidence.js';
export { LlmHypothesisEngine } from './hypothesis-engine.js';
export { NormalizingEvidenceWeigher } from './weigher.js';
export { LlmSynthesizer } from './synthesizer.js';

export interface CreateOrchestratorConfig {
  gateway?: ModelGateway;
  ethics?: EthicsGate;
  audit?: AuditLog;
  /** Evidence layer (IV). Pass to enable the "gather evidence" step. */
  evidence?: EvidencePort;
  /** Memory layer (V). Pass to recall prior notes/cases and persist new ones. */
  memory?: MemoryPort;
  /** Multi-AI Council (III). Pass to cross-examine synthesis across a panel. */
  council?: Council;
  /** Adaptive learning (V): feedback store, pattern library, self-review. */
  feedback?: FeedbackStore;
  patterns?: PatternLibrary;
  selfReview?: SelfReview;
}

/**
 * Build the deduction-loop orchestrator. Defaults wire an offline-capable
 * gateway, the rule-based Ethics gate, and an in-memory audit log; the API
 * server overrides these with live providers and a file audit log.
 */
export function createOrchestrator(config: CreateOrchestratorConfig = {}): Orchestrator {
  return new DeductionOrchestrator({
    gateway: config.gateway ?? createModelGateway(),
    ethics: config.ethics ?? createEthicsGate(),
    audit: config.audit ?? new InMemoryAuditLog(),
    evidence: config.evidence,
    memory: config.memory,
    council: config.council,
    feedback: config.feedback,
    patterns: config.patterns,
    selfReview: config.selfReview,
  });
}
