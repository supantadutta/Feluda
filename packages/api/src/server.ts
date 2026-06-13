import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import {
  FELUDA_CORE_VERSION,
  InvestigationCore,
  Council,
  Ethics,
  type Verdict,
} from '@feluda/core';
import { loadConfig, type Config } from './config.js';

const PHASE = 1;

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
  const audit = new Ethics.FileAuditLog();
  const orchestrator = InvestigationCore.createOrchestrator({ gateway, audit });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'feluda-api',
    coreVersion: FELUDA_CORE_VERSION,
    phase: PHASE,
    /** Tells the client whether real reasoning is available. */
    modelMode: config.anthropicApiKey ? 'live' : 'offline-stub',
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

  return app;
}
