import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
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
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
      // Redaction guard: never log Authorization headers or api keys.
      redact: ['req.headers.authorization', '*.apiKey', '*.anthropicApiKey', '*.ANTHROPIC_API_KEY'],
    },
  });

  await app.register(cors, { origin: config.webOrigin });

  // ── Wire the deduction loop ──
  // Anthropic when a key is configured, otherwise the offline stub. The audit
  // log is file-backed so every turn is persisted (Layer VII).
  const gateway = Council.createModelGateway({
    apiKey: config.anthropicApiKey,
    model: config.defaultModel,
  });
  const evidence = Evidence.createEvidencePort({ searchApiKey: config.searchApiKey });
  const memory = Memory.createMemoryPort({ storePath: config.vectorStorePath });
  const audit = new Ethics.FileAuditLog();

  // Multi-AI Council (Layer III) — opt-in. Seats one model id per panel member;
  // defaults to two seats on the default model so the mechanism is demonstrable.
  const council = config.councilEnabled
    ? Council.createCouncil({
        gateway,
        models:
          config.councilModels.length >= 2
            ? config.councilModels
            : [config.defaultModel, config.defaultModel],
        costCapUsd: config.councilCostCapUsd,
      })
    : undefined;

  // Adaptive learning (Layer V): feedback, playbooks, and belief-revision.
  const feedback = new Memory.FeedbackStore();
  const patterns = new Memory.PatternLibrary();
  const selfReview = new Memory.SelfReview(memory);

  const orchestrator = InvestigationCore.createOrchestrator({
    gateway,
    evidence,
    memory,
    council,
    feedback,
    patterns,
    selfReview,
    audit,
  });

  // Action layer (VI). Consequential actions are blocked until confirmed.
  const action = Action.createActionPort();

  // OSINT engine — lawful, passive, public-source (offline fixtures by default).
  const osint = new Osint.OsintEngine();
  const ethics = Ethics.createEthicsGate();

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
    modelMode: config.anthropicApiKey ? 'live' : 'offline-stub',
    evidenceMode: config.searchApiKey ? 'live' : 'offline-fixture',
    councilMode: council ? 'enabled' : 'disabled',
  }));

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
