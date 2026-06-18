/**
 * Orchestrator (Layer II) — runs the *iterative* deduction loop and is the
 * single entry point the Interface layer calls.
 *
 *   screen → plan → [ gather → weigh(Bayesian) → check convergence → ask a
 *   discriminating follow-up ]·rounds → synthesize → calibrate → screen
 *
 * The planner decides depth: simple questions short-circuit to one round; deep
 * questions iterate, gathering targeted evidence until a hypothesis dominates or
 * the round budget is spent. Beliefs are updated with a Bayesian weigher; the
 * trace records every round so the reasoning is auditable. Ethics (VII) screens
 * in and out; every turn is audited.
 */
import type { Citation, Evidence, Query, Verdict, CouncilReport, ReviewFlag, InvestigationSummary } from '../types.js';
import type { ModelGateway, Council } from '../layer3-council/index.js';
import { InvestigativeCouncil } from '../layer3-council/index.js';
import type { EvidencePort } from '../layer4-evidence/index.js';
import { hostOf } from '../layer4-evidence/index.js';
import type { MemoryPort, MemoryItem, FeedbackStore, PatternLibrary, SelfReview } from '../layer5-memory/index.js';
import type { EthicsGate, AuditLog, GateDecision } from '../layer7-ethics/index.js';
import { auditEntry } from '../layer7-ethics/audit.js';
import { ArrayReasoningTracer } from './tracer.js';
import { BandConfidenceCalibrator } from './confidence.js';
import { LlmHypothesisEngine } from './hypothesis-engine.js';
import { BayesianEvidenceWeigher, dominance } from './bayes.js';
import { LlmSynthesizer } from './synthesizer.js';
import { InvestigationPlanner } from './planner.js';
import { DiscriminatingQuestioner } from './followup.js';
import type { Orchestrator } from './index.js';

export interface OrchestratorDeps {
  gateway: ModelGateway;
  ethics: EthicsGate;
  audit: AuditLog;
  /** Optional Evidence layer (IV). When absent, the loop reasons unaided. */
  evidence?: EvidencePort;
  /** Optional Memory layer (V). When present, prior notes/cases are recalled. */
  memory?: MemoryPort;
  /** Optional Multi-AI Council (III). When present, synthesis fans out to a panel. */
  council?: Council;
  /** Adaptive learning (V): user corrections honoured in later answers. */
  feedback?: FeedbackStore;
  /** Adaptive learning (V): reusable playbooks per case type. */
  patterns?: PatternLibrary;
  /** Adaptive learning (V): belief revision when evidence contradicts a prior. */
  selfReview?: SelfReview;
}

const evidenceKey = (e: Evidence): string => `${e.citation.source}|${e.claim}`;

export class DeductionOrchestrator implements Orchestrator {
  private readonly hypothesisEngine: LlmHypothesisEngine;
  private readonly weigher = new BayesianEvidenceWeigher();
  private readonly calibrator = new BandConfidenceCalibrator();
  private readonly synthesizer: LlmSynthesizer;
  private readonly planner = new InvestigationPlanner();
  private readonly questioner = new DiscriminatingQuestioner();
  private readonly investigativeCouncil: InvestigativeCouncil;

  constructor(private readonly deps: OrchestratorDeps) {
    this.hypothesisEngine = new LlmHypothesisEngine(deps.gateway);
    this.synthesizer = new LlmSynthesizer(deps.gateway);
    this.investigativeCouncil = new InvestigativeCouncil(deps.ethics);
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

    // ── Plan investigation depth ──
    const plan = this.planner.plan(query);

    // ── Recall prior notes & cases (Layer V) ──
    let recalled: MemoryItem[] = [];
    if (this.deps.memory) {
      recalled = await this.deps.memory.recall(query.text, 4);
      if (recalled.length > 0) tracer.record('gather', `Recalled ${recalled.length} relevant item(s) from memory.`);
    }
    const memoryContext = recalled.map((m) => m.text);

    // ── Adaptive learning (Layer V): honour corrections, apply playbooks ──
    const preferences = this.deps.feedback?.relevant(query.text, 3).map((p) => p.text) ?? [];
    if (preferences.length > 0) tracer.record('gather', `Honouring ${preferences.length} user preference(s).`);
    const playbook = this.deps.patterns?.match(query.text);
    if (playbook) tracer.record('hypothesize', `Applied playbook "${playbook.caseType}".`);

    // ── Round 1: gather, hypothesise, weigh ──
    let evidence: Evidence[] = [];
    let offline = false;
    if (this.deps.evidence) {
      const g = await this.deps.evidence.gather(query);
      offline = g.offline;
      evidence = g.evidence;
      const c = this.corroboration(evidence);
      tracer.record(
        'gather',
        `Round 1: gathered ${evidence.length} source(s)${offline ? ' (offline fixtures)' : ''}; ` +
          `${c.independentSources} independent host(s).`,
      );
    } else {
      tracer.record('gather', 'No evidence layer wired: reasoning over the question and general knowledge.');
    }

    const hypotheses = await this.hypothesisEngine.generate(query, evidence, memoryContext, {
      seedHypotheses: playbook?.seedHypotheses,
    });
    tracer.record(
      'hypothesize',
      `Formed ${hypotheses.length} competing hypotheses. Plan: ${plan.mode} (≤${plan.maxRounds} round(s)).`,
      hypotheses.map((h) => h.id),
    );

    let weighed = await this.weigher.weigh(hypotheses, evidence);
    let dom = dominance(weighed);
    tracer.record('weigh', `Round 1 beliefs: ${this.beliefSummary(weighed)} (separation ${dom.separation.toFixed(2)}).`);

    // ── Iterative rounds: targeted follow-ups until convergence or budget ──
    let round = 1;
    let stopReason = !this.deps.evidence
      ? 'no evidence layer wired'
      : dom.topBelief >= plan.confidenceTarget && dom.separation >= plan.separationTarget
        ? 'a hypothesis dominates'
        : 'single round (shallow plan)';

    while (
      this.deps.evidence &&
      round < plan.maxRounds &&
      !(dom.topBelief >= plan.confidenceTarget && dom.separation >= plan.separationTarget)
    ) {
      round++;
      const followup = this.questioner.next(query, weighed);
      tracer.record('cross-examine', `Round ${round}: follow-up — ${followup}`);
      const g = await this.deps.evidence.gather({ ...query, id: `${query.id}#r${round}`, text: followup });

      const seen = new Set(evidence.map(evidenceKey));
      const fresh = g.evidence.filter((e) => !seen.has(evidenceKey(e)));
      if (fresh.length === 0) {
        stopReason = 'no new evidence';
        tracer.record('weigh', `Round ${round}: no new evidence; stopping.`);
        break;
      }
      evidence = [...evidence, ...fresh];
      weighed = await this.weigher.weigh(hypotheses, evidence);
      dom = dominance(weighed);
      tracer.record('weigh', `Round ${round} beliefs: ${this.beliefSummary(weighed)} (separation ${dom.separation.toFixed(2)}).`);
      if (dom.topBelief >= plan.confidenceTarget && dom.separation >= plan.separationTarget) {
        stopReason = 'a hypothesis dominates';
      } else if (round >= plan.maxRounds) {
        stopReason = 'reached round budget';
      }
    }
    const converged = dom.topBelief >= plan.confidenceTarget && dom.separation >= plan.separationTarget;

    // ── Self-Review (Layer V): does the evidence contradict a prior verdict? ──
    const reviewFlags: ReviewFlag[] = [];
    if (this.deps.selfReview && evidence.length > 0) {
      const seen = new Set<string>();
      for (const e of evidence) {
        for (const flag of await this.deps.selfReview.review(e.claim)) {
          if (!seen.has(flag.priorSummary)) {
            seen.add(flag.priorSummary);
            reviewFlags.push(flag);
          }
        }
      }
      if (reviewFlags.length > 0) {
        tracer.record('weigh', `Flagged ${reviewFlags.length} prior verdict(s) for re-review (belief revision).`);
      }
    }

    // ── Synthesise the verdict (optionally cross-examined by the Council) ──
    let synth;
    let councilReport: CouncilReport | undefined;
    if (this.deps.council) {
      const outcome = await this.deps.council.consult(query, weighed, evidence, memoryContext, preferences);
      synth = outcome.synthesis;
      councilReport = outcome.report;
      tracer.record(
        'cross-examine',
        councilReport.fellBackToSingle
          ? `Council fell back to a single model (${councilReport.panel.join(', ')}).`
          : `Consulted a panel of ${councilReport.panel.length} ` +
              `(${(councilReport.agreement * 100).toFixed(0)}% agreement)` +
              `${councilReport.dissent.length > 0 ? '; dissent recorded' : ''}.`,
      );
    } else {
      synth = await this.synthesizer.synthesize(query, weighed, evidence, memoryContext, preferences);
    }
    for (const step of synth.reasoning) tracer.record('weigh', step);

    const corr = this.corroboration(evidence);
    const confidence = this.calibrator.calibrate(weighed, evidence, {
      modelScore: synth.modelScore,
      extraGaps: synth.gaps,
      corroborated: this.deps.evidence ? corr.corroborated : undefined,
      separation: weighed.length >= 2 ? dom.separation : undefined,
    });
    tracer.record('verdict', synth.answer || '(no answer produced)');

    // Citation trail: ONLY from gathered evidence — never invented by the model.
    const citations: Citation[] = dedupeCitations(evidence.map((e) => e.citation));

    // ── Investigative council review (role-based scrutiny, deterministic) ──
    const councilReview = this.investigativeCouncil.review({
      answer: synth.answer,
      hypotheses: weighed,
      evidence,
      confidence,
      citations,
    });
    tracer.record(
      'cross-examine',
      `Council review: ${councilReview.recommendation.replace(/_/g, ' ')}` +
        `${councilReview.findings.filter((f) => f.severity !== 'info').length > 0 ? '; concerns raised' : ''}.`,
    );

    // ── Screen the outbound answer (Layer VII) ──
    const outbound = ethics.screenResponse(synth.answer);
    if (!outbound.allowed) {
      audit.record(auditEntry('response.refused', { queryId: query.id, boundary: outbound.boundary }));
      return this.refusal(query, outbound, tracer);
    }

    const investigation: InvestigationSummary = { mode: plan.mode, rounds: round, converged, stopReason };
    audit.record(
      auditEntry('verdict.produced', {
        queryId: query.id,
        confidence: confidence.band,
        score: confidence.score,
        hypotheses: weighed.length,
        sources: citations.length,
        rounds: round,
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
      council: councilReport,
      reviewFlags: reviewFlags.length > 0 ? reviewFlags : undefined,
      investigation,
      councilReview,
    };

    if (this.deps.memory?.rememberCase) await this.deps.memory.rememberCase(query, verdict);
    return verdict;
  }

  /** Distinct credible hosts → corroboration over the accumulated evidence. */
  private corroboration(evidence: Evidence[]): { independentSources: number; corroborated: boolean } {
    const hosts = new Set(evidence.filter((e) => e.credibility >= 0.5).map((e) => hostOf(e.citation.source)));
    return { independentSources: hosts.size, corroborated: hosts.size >= 2 };
  }

  private beliefSummary(hypotheses: { statement: string; belief: number }[]): string {
    const top = [...hypotheses].sort((a, b) => b.belief - a.belief)[0];
    return top ? `“${top.statement.slice(0, 48)}” ${(top.belief * 100).toFixed(0)}%` : '(none)';
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
