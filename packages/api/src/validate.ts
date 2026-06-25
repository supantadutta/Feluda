/**
 * Request schemas (zod) and the global error handler. Schema-driven validation
 * replaces ad-hoc `typeof` checks on the structured routes and yields consistent
 * 400s. A ZodError anywhere is mapped to a clean 400 by the error handler.
 */
import { z, ZodError } from 'zod';
import type { FastifyInstance } from 'fastify';

export const InvestigateSchema = z.object({
  question: z.string().trim().min(1, 'A non-empty "question" is required.').max(4000),
  caseId: z.string().optional(),
});

export const ProviderSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'stub']),
  model: z.string().trim().min(1).optional(),
  baseURL: z.string().trim().url().optional(),
  apiKey: z.string().optional(),
});

export const OsintSchema = z.object({
  target: z.string().trim().min(1, 'A non-empty "target" is required.'),
  type: z.string().optional(),
});

export const SocSchema = z.object({
  type: z.string().min(1),
  title: z.string().optional(),
  context: z.string().optional(),
  logs: z.array(z.string()).optional(),
  artifacts: z.array(z.string()).optional(),
});

export const LearningSchema = z.object({
  rounds: z.number().int().min(1).max(20).optional(),
  perClassPerRound: z.number().int().min(1).max(5).optional(),
});

export const NewCaseSchema = z.object({
  title: z.string().trim().min(1, 'A non-empty "title" is required.'),
  objective: z.string().optional(),
  scope: z.string().optional(),
});

/** Register a handler that turns validation errors into clean 400 responses. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: err.issues[0]?.message ?? 'Invalid request body.', issues: err.issues });
    }
    if ((err as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({ error: 'Rate limit exceeded. Try again shortly.' });
    }
    reply.send(err);
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: `Not found: ${req.method} ${req.url}` });
  });
}
