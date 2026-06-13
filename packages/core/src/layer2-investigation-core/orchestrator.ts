/**
 * Orchestrator (Layer II) — runs the deduction loop and is the single entry
 * point the Interface layer calls.
 *
 *   screen → gather → hypothesize → weigh → synthesize → calibrate → screen
 *
 * Phase 1 has no Evidence (IV) or Memory (V) layers, so "gather" is a noted
 * short-circuit. Every turn is screened by Ethics (VII) on the way in and out,
 * and recorded to the audit log.
 */
import type { Query, Verdict } from '../types.js';
import type { ModelGateway } from '../layer3-council/index.js';
import type { EthicsGate, AuditLog, GateDecision } from '../layer7-ethics/index.js';
import { auditEntry } from '../layer7-ethics/audit.js';
import { ArrayReasoningTracer } from './tracer.js';
import { BandConfidenceCalibrator } from './confidence.js';
import { LlmHypothesisEngine } from './hypothesis-engine.js';
import { NormalizingEvidenceWeigher } from './weigher.js';
import { LlmSynthesizer } from './synthesizer.js';
import type { Orchestrator } from './index.js';

export interface OrchestratorDeps {
  gateway: ModelGateway;
  ethics: EthicsGate;
  audit: AuditLog;
}

export class DeductionOrchestrator implements Orchestrator {
  private readonly hypotheses: LlmHypothesisEngine;
  private readonly weigher = new NormalizingEvidenceWeigher();
  private readonly calibrator = new BandConfidenceCalibrator();
  private readonly synthesizer: LlmSynthesizer;

  constructor(private readonly deps: OrchestratorDeps) {
    this.hypotheses = new LlmHypothesisEngine(deps.gateway);
    this.synthesizer = new LlmSynthesizer(deps.gateway);
  }

  async investigate(query: Query): Promise<Verdict> {
    const { ethics, audit } = this.deps;
    const tracer = new ArrayReasoningTracer();
    tracer.start(query);
    audit.record(auditEntry('query.received', { queryId: query.id, length: query.text.length }));

    // ── Screen the inbound request (Layer VII) ──
    const inbound = ethics.screenRequest(query.text);
    audit.record(
      auditEntry('request.screened', { queryId: query.id, allowed: inbound.allowed, boundary: inbound.boundary }),
    );
    if (!inbound.allowed) {
      audit.record(auditEntry('request.refused', { queryId: query.id, boundary: inbound.boundary }));
      return this.refusal(query, inbound, tracer);
    }

    // ── Gather (short-circuited in Phase 1) ──
    tracer.record(
      'gather',
      'No evidence layer yet (Phase 1): reasoning over the question and general knowledge; no external citations.',
    );

    // ── Hypothesise → weigh ──
    const hypotheses = await this.hypotheses.generate(query, []);
    tracer.record(
      'hypothesize',
      `Formed ${hypotheses.length} competing hypotheses.`,
      hypotheses.map((h) => h.id),
    );
    const weighed = await this.weigher.weigh(hypotheses, []);
    tracer.record(
      'weigh',
      'Normalised hypothesis priors (no external evidence to update on yet).',
      weighed.map((h) => h.id),
    );

    // ── Synthesise the verdict ──
    const synth = await this.synthesizer.synthesize(query, weighed);
    for (const step of synth.reasoning) tracer.record('weigh', step);

    const confidence = this.calibrator.calibrate(weighed, [], {
      modelScore: synth.modelScore,
      extraGaps: synth.gaps,
    });
    tracer.record('verdict', synth.answer || '(no answer produced)');

    // ── Screen the outbound answer (Layer VII) ──
    const outbound = ethics.screenResponse(synth.answer);
    if (!outbound.allowed) {
      audit.record(auditEntry('response.refused', { queryId: query.id, boundary: outbound.boundary }));
      return this.refusal(query, outbound, tracer);
    }

    audit.record(
      auditEntry('verdict.produced', {
        queryId: query.id,
        confidence: confidence.band,
        score: confidence.score,
        hypotheses: weighed.length,
      }),
    );

    return {
      queryId: query.id,
      answer: synth.answer,
      trace: tracer.trace(),
      confidence,
      citations: [],
      hypotheses: weighed,
    };
  }

  /** Build a transparent refusal verdict carrying the lawful alternative. */
  private refusal(query: Query, decision: GateDecision, tracer: ArrayReasoningTracer): Verdict {
    const boundary = decision.boundary ?? 'lawful-use';
    const alt = decision.lawfulAlternative ?? '';
    tracer.record('verdict', `Refused on the ${boundary} boundary.`);
    return {
      queryId: query.id,
      answer: `${decision.reason ?? 'This request crosses a hard boundary.'}\n\n${alt}`,
      trace: tracer.trace(),
      confidence: { score: 1, band: 'high', gaps: [] },
      citations: [],
      hypotheses: [],
      refusal: { boundary, reason: decision.reason ?? '', lawfulAlternative: alt },
    };
  }
}
