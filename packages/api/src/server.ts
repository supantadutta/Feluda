import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {
  FELUDA_CORE_VERSION,
  InterfaceLayer,
  InvestigationCore,
  Council,
  Evidence,
  Memory,
  Action,
  Ethics,
  Osint,
  Cases,
  Soc,
  Learning,
  type Verdict,
} from '@feluda/core';
// `Council` namespace exposes both the gateway factory and createCouncil.
import { loadConfig, type Config } from './config.js';

const PHASE = 7;

interface InvestigateBody {
  question?: unknown;
  caseId?: unknown;
}

/**
 * Builds the Fastify app (Layer I — API surface). Kept separate from `index.ts`
 * so tests can drive it with `app.inject(...)` without binding a port.
 *
 * Phase 1: a /api/investigate route that runs the deduction loop.
 */
export async function buildServer(config: Config = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({
    // Cap request bodies to blunt abuse / accidental huge payloads.
    bodyLimit: config.maxBodyBytes,
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
      // Redaction guard: never log Authorization headers or api keys.
      redact: ['req.headers.authorization', 'req.headers["x-api-key"]', '*.apiKey', '*.anthropicApiKey', '*.ANTHROPIC_API_KEY'],
    },
  });

  // Security headers + CORS + rate limiting.
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: config.webOrigin });
  await app.register(rateLimit, { max: config.rateLimitMax, timeWindow: '1 minute' });

  // Optional API-key gate: when FELUDA_API_KEY is set, every /api/* call must
  // present it (x-api-key header or `Authorization: Bearer`). /health stays open.
  if (config.apiKey) {
    app.addHook('onRequest', async (req, reply) => {
      if (!req.url.startsWith('/api/')) return;
      const provided = req.headers['x-api-key'] ?? (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      if (provided !== config.apiKey) {
        return reply.code(401).send({ error: 'Unauthorized: a valid API key is required.' });
      }
    });
  }

  const evidence = Evidence.createEvidencePort({ searchApiKey: config.searchApiKey });
  const memory = Memory.createMemoryPort({ storePath: config.vectorStorePath });
  const audit = new Ethics.FileAuditLog();
  const feedback = new Memory.FeedbackStore();
  const patterns = new Memory.PatternLibrary();
  const selfReview = new Memory.SelfReview(memory);

  // ── Runtime-configurable AI provider (set from the UI) ──
  // The gateway/council/orchestrator are rebuilt when the provider changes;
  // closures below read the current `orchestrator`, so reassignment is picked up.
  const providerSettings: { provider: Council.ProviderKind; model: string; baseURL?: string } = {
    provider: config.anthropicApiKey ? 'anthropic' : 'stub',
    model: config.defaultModel,
    baseURL: undefined,
  };
  let currentApiKey: string | undefined = config.anthropicApiKey;
  let gateway = Council.createModelGateway({ provider: providerSettings.provider, apiKey: currentApiKey, model: providerSettings.model, baseURL: providerSettings.baseURL });

  const buildCouncil = (): ReturnType<typeof Council.createCouncil> | undefined =>
    config.councilEnabled
      ? Council.createCouncil({
          gateway,
          models: config.councilModels.length >= 2 ? config.councilModels : [providerSettings.model, providerSettings.model],
          costCapUsd: config.councilCostCapUsd,
        })
      : undefined;
  const buildOrchestrator = () =>
    InvestigationCore.createOrchestrator({ gateway, evidence, memory, council, feedback, patterns, selfReview, audit });

  let council = buildCouncil();
  let orchestrator = buildOrchestrator();

  const modelMode = (): string => (providerSettings.provider === 'stub' || !currentApiKey ? 'offline-stub' : 'live');

  function applyProvider(next: { provider: Council.ProviderKind; model: string; baseURL?: string; apiKey?: string }): void {
    providerSettings.provider = next.provider;
    providerSettings.model = next.model;
    providerSettings.baseURL = next.baseURL;
    if (next.apiKey !== undefined) currentApiKey = next.apiKey || undefined;
    gateway = Council.createModelGateway({ provider: next.provider, apiKey: currentApiKey, model: next.model, baseURL: next.baseURL });
    council = buildCouncil();
    orchestrator = buildOrchestrator();
    audit.record(Ethics.auditEntry('provider.changed', { provider: next.provider, model: next.model, hasKey: Boolean(currentApiKey) }));
  }

  // Action layer (VI). Consequential actions are blocked until confirmed.
  const action = Action.createActionPort();

  // OSINT engine — lawful, passive, public-source. Offline fixtures by default;
  // keyless live providers (RDAP, DNS-over-HTTPS) when FELUDA_OSINT_LIVE=true.
  const osint = Osint.createOsintEngine({ live: config.osintLive, reputationApiKey: config.reputationApiKey });
  const ethics = Ethics.createEthicsGate();

  // Investigation cases (file-backed when FELUDA_CASES_PATH is set), SOC
  // analyzer, and the professional report generator.
  const cases = new Cases.CaseManager(config.casesPath ? new Cases.FileCaseStore(config.casesPath) : undefined);
  const socAnalyzer = new Soc.SocAnalyzer();
  const caseReports = new Cases.CaseReportBuilder();

  // Briefings (Layer I): scheduled digests. Runs an investigation per topic.
  const recentDigests: InterfaceLayer.BriefingDigest[] = [];
  const briefings = new InterfaceLayer.BriefingScheduler((topic) =>
    orchestrator.investigate({ id: `b_${Date.now().toString(36)}`, text: topic, receivedAt: new Date().toISOString() }),
  );
  if (config.nodeEnv !== 'test') {
    setInterval(() => {
      briefings
        .runDue()
        .then((ds) => recentDigests.push(...ds))
        .catch((err) => app.log.error(err));
    }, 60_000).unref();
  }

  app.get('/health', async () => ({
    status: 'ok',
    service: 'feluda-api',
    coreVersion: FELUDA_CORE_VERSION,
    phase: PHASE,
    /** Tells the client whether real reasoning is available. */
    modelMode: modelMode(),
    provider: providerSettings.provider,
    model: providerSettings.model,
    evidenceMode: config.searchApiKey ? 'live' : 'offline-fixture',
    councilMode: council ? 'enabled' : 'disabled',
  }));

  // ── AI provider settings (configure any model from the UI) ──
  app.get('/api/settings/provider', async () => ({
    provider: providerSettings.provider,
    model: providerSettings.model,
    baseURL: providerSettings.baseURL ?? null,
    hasKey: Boolean(currentApiKey), // never returns the key itself
    modelMode: modelMode(),
  }));

  app.post<{ Body: { provider?: unknown; model?: unknown; baseURL?: unknown; apiKey?: unknown } }>(
    '/api/settings/provider',
    async (req, reply) => {
      const b = req.body ?? {};
      const provider = b.provider;
      if (provider !== 'anthropic' && provider !== 'openai' && provider !== 'stub') {
        return reply.code(400).send({ error: 'provider must be "anthropic", "openai", or "stub".' });
      }
      if (provider !== 'stub' && typeof b.model !== 'string') {
        return reply.code(400).send({ error: 'A "model" string is required for live providers.' });
      }
      applyProvider({
        provider,
        model: typeof b.model === 'string' && b.model.trim() ? b.model.trim() : providerSettings.model,
        baseURL: typeof b.baseURL === 'string' && b.baseURL.trim() ? b.baseURL.trim() : undefined,
        apiKey: typeof b.apiKey === 'string' ? b.apiKey : undefined,
      });
      return { provider: providerSettings.provider, model: providerSettings.model, baseURL: providerSettings.baseURL ?? null, hasKey: Boolean(currentApiKey), modelMode: modelMode() };
    },
  );

  // Test the current provider with a tiny round-trip (no secrets returned).
  app.post('/api/settings/provider/test', async (_req, reply) => {
    try {
      const res = await gateway.complete({ system: 'Reply briefly.', prompt: 'Reply with: ok', task: 'general' });
      return { ok: true, model: res.model, sample: res.text.slice(0, 200) };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Provider test failed' });
    }
  });

  app.post<{ Body: InvestigateBody }>('/api/investigate', async (req, reply) => {
    const { question, caseId } = req.body ?? {};
    if (typeof question !== 'string' || question.trim().length === 0) {
      return reply.code(400).send({ error: 'A non-empty "question" string is required.' });
    }
    if (question.length > 4000) {
      return reply.code(400).send({ error: 'Question is too long (max 4000 characters).' });
    }

    const verdict: Verdict = await orchestrator.investigate({
      id: `q_${Date.now().toString(36)}`,
      text: question.trim(),
      caseId: typeof caseId === 'string' ? caseId : undefined,
      receivedAt: new Date().toISOString(),
    });

    return verdict;
  });

  // Knowledge Vault (Layer V): add a free-text note that future investigations
  // can recall. Returns the stored item.
  app.post<{ Body: { text?: unknown; caseId?: unknown } }>('/api/notes', async (req, reply) => {
    const { text, caseId } = req.body ?? {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      return reply.code(400).send({ error: 'A non-empty "text" string is required.' });
    }
    const item = await memory.addNote(text.trim(), typeof caseId === 'string' ? caseId : undefined);
    return { item };
  });

  // Recall what memory holds for a query (notes + prior cases).
  app.get<{ Querystring: { q?: string } }>('/api/memory/recall', async (req, reply) => {
    const q = req.query.q;
    if (!q) return reply.code(400).send({ error: 'Query param "q" is required.' });
    return { items: await memory.recall(q, 5) };
  });

  // ── Investigation Case System (Layer II) ──
  app.post<{ Body: { title?: unknown; objective?: unknown; scope?: unknown } }>('/api/cases', async (req, reply) => {
    const { title, objective, scope } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length === 0) {
      return reply.code(400).send({ error: 'A non-empty "title" string is required.' });
    }
    return {
      case: cases.create({
        title: title.trim(),
        objective: typeof objective === 'string' ? objective : undefined,
        scope: typeof scope === 'string' ? scope : undefined,
      }),
    };
  });

  app.get('/api/cases', async () => ({ cases: cases.list() }));

  app.get<{ Params: { id: string } }>('/api/cases/:id', async (req, reply) => {
    const c = cases.get(req.params.id);
    return c ? { case: c } : reply.code(404).send({ error: 'No such case.' });
  });

  app.post<{ Params: { id: string }; Body: { evidence?: { claim?: unknown; source?: unknown }[] } }>(
    '/api/cases/:id/evidence',
    async (req, reply) => {
      const items = Array.isArray(req.body?.evidence) ? req.body!.evidence : [];
      const evidence = items
        .filter((e) => typeof e?.claim === 'string' && typeof e?.source === 'string')
        .map((e) => ({
          id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          claim: String(e.claim),
          citation: { source: String(e.source), retrievedAt: new Date().toISOString() },
          credibility: 0.6,
          relevance: 0.6,
          flags: ['user-document'],
        }));
      const c = cases.addEvidence(req.params.id, evidence);
      return c ? { case: c } : reply.code(404).send({ error: 'No such case.' });
    },
  );

  app.post<{ Params: { id: string }; Body: { question?: unknown } }>(
    '/api/cases/:id/investigate',
    async (req, reply) => {
      const c = cases.get(req.params.id);
      if (!c) return reply.code(404).send({ error: 'No such case.' });
      const question = req.body?.question;
      if (typeof question !== 'string' || question.trim().length === 0) {
        return reply.code(400).send({ error: 'A non-empty "question" string is required.' });
      }
      const verdict = await orchestrator.investigate({
        id: `q_${Date.now().toString(36)}`,
        text: question.trim(),
        caseId: c.id,
        receivedAt: new Date().toISOString(),
      });
      const updated = cases.applyVerdict(c.id, question.trim(), verdict);
      return { case: updated, verdict };
    },
  );

  app.get<{ Params: { id: string } }>('/api/cases/:id/timeline', async (req, reply) => {
    const c = cases.get(req.params.id);
    return c ? { timeline: c.timeline } : reply.code(404).send({ error: 'No such case.' });
  });

  app.get<{ Params: { id: string }; Querystring: { type?: string } }>(
    '/api/cases/:id/report',
    async (req, reply) => {
      const c = cases.get(req.params.id);
      if (!c) return reply.code(404).send({ error: 'No such case.' });
      const type = (req.query.type ?? 'osint_case') as Cases.CaseReportType;
      const report = caseReports.build(c, type);
      cases.setReport(c.id, report.content);
      return { report };
    },
  );

  // ── Investigative council review (Layer III): scrutinise a draft conclusion ──
  const investigativeCouncil = new Council.InvestigativeCouncil(ethics);
  app.post<{ Body: { answer?: unknown; hypotheses?: unknown; evidence?: unknown; confidence?: unknown } }>(
    '/api/council/review',
    async (req, reply) => {
      const b = req.body ?? {};
      if (typeof b.answer !== 'string') return reply.code(400).send({ error: 'An "answer" string is required.' });
      const review = investigativeCouncil.review({
        answer: b.answer,
        hypotheses: Array.isArray(b.hypotheses) ? (b.hypotheses as never[]) : [],
        evidence: Array.isArray(b.evidence) ? (b.evidence as never[]) : [],
        confidence: (b.confidence as { score: number; band: 'low' | 'medium' | 'high'; gaps: string[] }) ?? {
          score: 0,
          band: 'low',
          gaps: [],
        },
        citations: [],
      });
      return { review };
    },
  );

  // Reports (Layer VI): export a verdict as a .docx (base64-encoded).
  app.post<{ Body: { verdict?: unknown; title?: unknown } }>('/api/reports/docx', async (req, reply) => {
    const { verdict, title } = req.body ?? {};
    if (!verdict || typeof verdict !== 'object') return reply.code(400).send({ error: 'A "verdict" object is required.' });
    const buf = await Action.verdictToDocx(verdict as Verdict, typeof title === 'string' ? title : undefined);
    return { filename: 'feluda-report.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', base64: buf.toString('base64') };
  });

  // ── Synthetic learning (Layer V): train on synthetic cases, measure lift ──
  app.post<{ Body: { rounds?: unknown; perClassPerRound?: unknown } }>('/api/learning/run', async (req, reply) => {
    const b = req.body ?? {};
    const rounds = typeof b.rounds === 'number' && b.rounds > 0 && b.rounds <= 20 ? b.rounds : 5;
    const perClassPerRound = typeof b.perClassPerRound === 'number' && b.perClassPerRound > 0 && b.perClassPerRound <= 5 ? b.perClassPerRound : 1;
    const report = new Learning.SyntheticTrainer().run({ rounds, perClassPerRound });
    audit.record(Ethics.auditEntry('learning.run', { rounds, finalAccuracy: report.finalAccuracy }));
    return reply.send({ report });
  });

  // ── Defensive SOC investigation (Layer VI) ──
  app.post<{ Body: Record<string, unknown> }>('/api/soc/investigate', async (req, reply) => {
    const body = req.body ?? {};
    if (typeof body.type !== 'string') return reply.code(400).send({ error: 'A SOC alert "type" is required.' });
    const assessment = socAnalyzer.analyze({
      type: body.type as Soc.SocAlertType,
      title: typeof body.title === 'string' ? body.title : undefined,
      context: typeof body.context === 'string' ? body.context : undefined,
      artifacts: Array.isArray(body.artifacts) ? body.artifacts.map(String) : undefined,
      logs: Array.isArray(body.logs) ? body.logs.map(String) : undefined,
    });
    audit.record(Ethics.auditEntry('soc.assessed', { type: body.type, verdict: assessment.verdict, escalate: assessment.escalate }));
    return { assessment, report: Cases.socReport(assessment) };
  });

  // OSINT (Layer IV): passive, public-source investigation of an indicator.
  app.post<{ Body: { target?: unknown; type?: unknown } }>('/api/osint/investigate', async (req, reply) => {
    const { target, type } = req.body ?? {};
    if (typeof target !== 'string' || target.trim().length === 0) {
      return reply.code(400).send({ error: 'A non-empty "target" string is required.' });
    }
    // Screen the request — block doxxing/deanonymisation/intrusive misuse.
    const screen = ethics.screenRequest(target);
    audit.record(Ethics.auditEntry('osint.screened', { allowed: screen.allowed, boundary: screen.boundary }));
    if (!screen.allowed) {
      return reply.code(403).send({ refusal: { boundary: screen.boundary, reason: screen.reason, lawfulAlternative: screen.lawfulAlternative } });
    }
    const result = await osint.investigate(target.trim(), typeof type === 'string' ? (type as Osint.OsintTargetType) : undefined);
    return result;
  });

  // Entity extraction (Layer IV): pull technical indicators from text.
  app.post<{ Body: { text?: unknown } }>('/api/osint/extract-entities', async (req, reply) => {
    const { text } = req.body ?? {};
    if (typeof text !== 'string') return reply.code(400).send({ error: 'A "text" string is required.' });
    return { entities: Osint.extractEntities(text) };
  });

  // Briefings (Layer I): schedule, list, and run digests.
  app.post<{ Body: { topic?: unknown; intervalMs?: unknown } }>('/api/briefings', async (req, reply) => {
    const { topic, intervalMs } = req.body ?? {};
    if (typeof topic !== 'string' || topic.trim().length === 0) {
      return reply.code(400).send({ error: 'A non-empty "topic" string is required.' });
    }
    const every = typeof intervalMs === 'number' && intervalMs > 0 ? intervalMs : 3_600_000;
    return { briefing: briefings.schedule(topic.trim(), every) };
  });

  app.get('/api/briefings', async () => ({ briefings: briefings.list(), recent: recentDigests.slice(-10) }));

  app.post<{ Params: { id: string } }>('/api/briefings/:id/run', async (req, reply) => {
    const digest = await briefings.run(req.params.id);
    if (!digest) return reply.code(404).send({ error: 'No such briefing.' });
    recentDigests.push(digest);
    return { digest };
  });

  // Feedback Loop (Layer V): record a correction/preference to honour later.
  app.post<{ Body: { text?: unknown } }>('/api/feedback', async (req, reply) => {
    const { text } = req.body ?? {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      return reply.code(400).send({ error: 'A non-empty "text" string is required.' });
    }
    return { preference: feedback.add(text.trim()) };
  });

  // Pattern Library (Layer V): save a reusable playbook for a case type.
  app.post<{ Body: { caseType?: unknown; triggers?: unknown; seedHypotheses?: unknown } }>(
    '/api/playbooks',
    async (req, reply) => {
      const { caseType, triggers, seedHypotheses } = req.body ?? {};
      if (typeof caseType !== 'string' || !Array.isArray(triggers) || !Array.isArray(seedHypotheses)) {
        return reply.code(400).send({ error: 'caseType, triggers[] and seedHypotheses[] are required.' });
      }
      return {
        playbook: patterns.save({
          caseType,
          triggers: triggers.map(String),
          seedHypotheses: seedHypotheses.map(String),
        }),
      };
    },
  );

  // Self-Review (Layer V): check whether a new claim contradicts a prior verdict.
  app.post<{ Body: { claim?: unknown } }>('/api/self-review', async (req, reply) => {
    const { claim } = req.body ?? {};
    if (typeof claim !== 'string' || claim.trim().length === 0) {
      return reply.code(400).send({ error: 'A non-empty "claim" string is required.' });
    }
    return { flags: await selfReview.review(claim.trim()) };
  });

  // Action layer (VI): perform a deliverable/admin action. Consequential kinds
  // are gated — the response sets awaitingApproval until payload.confirmed=true.
  app.post<{ Body: { kind?: unknown; payload?: unknown } }>('/api/actions', async (req, reply) => {
    const { kind, payload } = req.body ?? {};
    if (typeof kind !== 'string') {
      return reply.code(400).send({ error: 'A "kind" string is required.' });
    }
    const result = await action.perform({
      kind,
      payload: (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>,
    });
    audit.record(
      Ethics.auditEntry('action.performed', { kind, ok: result.ok, awaitingApproval: result.awaitingApproval ?? false }),
    );
    return reply.code(result.ok ? 200 : result.awaitingApproval ? 202 : 400).send(result);
  });

  // Doc & Data Ingest (Layer IV stretch): parse a user document into evidence
  // chunks, each carrying provenance back to the file. Text/markdown in Phase 2.
  app.post<{ Body: { name?: unknown; mime?: unknown; content?: unknown } }>(
    '/api/ingest',
    async (req, reply) => {
      const { name, mime, content } = req.body ?? {};
      if (typeof name !== 'string' || typeof mime !== 'string' || typeof content !== 'string') {
        return reply.code(400).send({ error: 'name, mime and content strings are required.' });
      }
      try {
        const evidence = new Evidence.DocIngestor().ingest({ name, mime, content });
        return { evidence };
      } catch (err) {
        return reply.code(415).send({ error: err instanceof Error ? err.message : 'Unsupported.' });
      }
    },
  );

  return app;
}
