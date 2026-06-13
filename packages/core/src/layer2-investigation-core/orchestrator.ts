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
import type { Citation, Evidence, Query, Verdict } from '../types.js';
import type { ModelGateway } from '../layer3-council/index.js';
import type { EvidencePort, GatheredEvidence } from '../layer4-evidence/index.js';
import type { MemoryPort, MemoryItem } from '../layer5-memory/index.js';
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
  /** Optional Evidence layer (IV). When absent, the loop reasons unaided. */
  evidence?: EvidencePort;
  /** Optional Memory layer (V). When present, prior notes/cases are recalled. */
  memory?: MemoryPort;
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

    // ── Recall prior notes & cases (Layer V, when wired) ──
    let recalled: MemoryItem[] = [];
    if (this.deps.memory) {
      recalled = await this.deps.memory.recall(query.text, 4);
      if (recalled.length > 0) {
        tracer.record('gather', `Recalled ${recalled.length} relevant item(s) from memory.`);
      }
    }
    const memoryContext = recalled.map((m) => m.text);

    // ── Gather evidence (Layer IV, when wired) ──
    let gathered: GatheredEvidence | undefined;
    if (this.deps.evidence) {
      gathered = await this.deps.evidence.gather(query);
      const { evidence, corroboration, offline } = gathered;
      tracer.record(
        'gather',
        `Gathered ${evidence.length} source(s)${offline ? ' (offline fixtures)' : ''}; ` +
          `${corroboration.independentSources} independent host(s); ` +
          `${corroboration.corroborated ? 'corroborated' : 'NOT independently corroborated'}.`,
      );
    } else {
      tracer.record(
        'gather',
        'No evidence layer wired: reasoning over the question and general knowledge; no external citations.',
      );
    }
    const evidence: Evidence[] = gathered?.evidence ?? [];

    // ── Hypothesise → weigh ──
    const hypotheses = await this.hypotheses.generate(query, evidence, memoryContext);
    tracer.record(
      'hypothesize',
      `Formed ${hypotheses.length} competing hypotheses.`,
      hypotheses.map((h) => h.id),
    );
    const weighed = await this.weigher.weigh(hypotheses, evidence);
    tracer.record(
      'weigh',
      evidence.length > 0
        ? 'Weighed hypotheses against the gathered evidence.'
        : 'Normalised hypothesis priors (no external evidence to update on yet).',
      weighed.map((h) => h.id),
    );

    // ── Synthesise the verdict ──
    const synth = await this.synthesizer.synthesize(query, weighed, evidence, memoryContext);
    for (const step of synth.reasoning) tracer.record('weigh', step);

    const confidence = this.calibrator.calibrate(weighed, evidence, {
      modelScore: synth.modelScore,
      extraGaps: synth.gaps,
      corroborated: gathered?.corroboration.corroborated,
    });
    tracer.record('verdict', synth.answer || '(no answer produced)');

    // Citation trail: ONLY from gathered evidence — never invented by the model.
    const citations: Citation[] = dedupeCitations(evidence.map((e) => e.citation));

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
        sources: citations.length,
      }),
    );

    const verdict: Verdict = {
      queryId: query.id,
      answer: synth.answer,
      trace: tracer.trace(),
      confidence,
      citations,
      hypotheses: weighed,
      evidence: evidence.length > 0 ? evidence : undefined,
    };

    // ── Write the finished case back to Memory (Layer V) ──
    if (this.deps.memory?.rememberCase) {
      await this.deps.memory.rememberCase(query, verdict);
    }

    return verdict;
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

/** Collapse citations that point at the same source. */
function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const c of citations) if (!seen.has(c.source)) seen.set(c.source, c);
  return [...seen.values()];
}
