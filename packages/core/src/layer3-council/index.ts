/**
 * Layer III — Multi-AI Council (boundary module)
 * ──────────────────────────────────────────────
 * Consult several AI models and synthesize a stronger answer. Provider-agnostic
 * Model Gateway with adapters behind it; panel reasoning, disagreement detection,
 * a synthesizer judge step, specialist routing, and a cost cap with single-model
 * fallback.
 *
 * Phase: implemented in Phase 4. The Model Gateway interface is defined now so
 * Phase 1 can depend on a single-provider implementation behind it.
 */
import { notImplemented } from '../util/not-implemented.js';

/** A normalized request to any model provider. */
export interface ModelRequest {
  /** System/persona prompt. */
  system?: string;
  /** The user/content prompt. */
  prompt: string;
  /** Hint for specialist routing: code, math, long-context, vision, general. */
  task?: 'code' | 'math' | 'long-context' | 'vision' | 'general';
  /** Optional model id override; otherwise the gateway routes. */
  model?: string;
}

/** A normalized response from any model provider. */
export interface ModelResponse {
  text: string;
  model: string;
  /** Token usage for cost control, when the provider reports it. */
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Provider-agnostic interface. Concrete providers (Anthropic, etc.) are adapters
 * that implement this. Phase 1 ships exactly one adapter.
 */
export interface ModelGateway {
  /** Send one request to a single model. */
  complete(req: ModelRequest): Promise<ModelResponse>;
  /** Fan the same request out to the panel (Phase 4). */
  panel?(req: ModelRequest): Promise<ModelResponse[]>;
}

/** Phase 0 placeholder — a real Anthropic adapter lands in Phase 1. */
export function createModelGateway(): ModelGateway {
  return {
    complete: () => notImplemented('Layer III ModelGateway.complete'),
  };
}
