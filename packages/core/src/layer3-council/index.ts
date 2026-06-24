/**
 * Layer III — Multi-AI Council (boundary module)
 * ──────────────────────────────────────────────
 * Consult several AI models and synthesize a stronger answer. Provider-agnostic
 * Model Gateway with adapters behind it; panel reasoning, disagreement detection,
 * a synthesizer judge step, specialist routing, and a cost cap with single-model
 * fallback.
 *
 * Phase: panel/synthesis land in Phase 4. The Model Gateway interface and a
 * single-provider implementation (Anthropic, with an offline stub fallback)
 * ship in Phase 1 so the Investigation Core has a brain to talk to.
 */
import { StubGateway } from './providers/stub.js';
import { AnthropicGateway } from './providers/anthropic.js';
import { OpenAICompatibleGateway } from './providers/openai.js';

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

export { StubGateway } from './providers/stub.js';
export { AnthropicGateway, type AnthropicGatewayConfig } from './providers/anthropic.js';
export { OpenAICompatibleGateway, type OpenAICompatibleConfig } from './providers/openai.js';

export type ProviderKind = 'anthropic' | 'openai' | 'stub';
export {
  Council,
  agreementOf,
  type PanelMember,
  type CouncilOptions,
  type CouncilOutcome,
} from './panel.js';
export { SpecialistRouter, type TaskType } from './routing.js';
export { InvestigativeCouncil, type CouncilReviewInput } from './investigative-council.js';

import { Council, type PanelMember } from './panel.js';

export interface CreateCouncilConfig {
  gateway: ModelGateway;
  /** Model ids that form the panel (≥2 to actually deliberate). */
  models: string[];
  costCapUsd?: number;
  usdPer1k?: number;
}

/** Build a Council that seats one model id per panel member over a gateway. */
export function createCouncil(config: CreateCouncilConfig): Council {
  const members: PanelMember[] = config.models.map((model, i) => ({
    id: `${model}#${i + 1}`,
    gateway: config.gateway,
    model,
    usdPer1k: config.usdPer1k,
  }));
  return new Council(members, config.gateway, { costCapUsd: config.costCapUsd });
}

export interface GatewayConfig {
  /** Provider to use. Defaults inferred from the other fields. */
  provider?: ProviderKind;
  /** API key. When absent (and provider isn't openai with a baseURL), the stub is used. */
  apiKey?: string;
  /** Model id. */
  model?: string;
  /** OpenAI-compatible base URL (OpenAI, OpenRouter, Ollama, LM Studio, …). */
  baseURL?: string;
}

/**
 * Build a gateway from config. Supports Anthropic, any OpenAI-compatible
 * endpoint, and an offline stub. Inference: explicit `provider` wins; else a
 * `baseURL` implies openai-compatible; else a key implies Anthropic; else stub.
 */
export function createModelGateway(config: GatewayConfig = {}): ModelGateway {
  const provider: ProviderKind =
    config.provider ?? (config.baseURL ? 'openai' : config.apiKey ? 'anthropic' : 'stub');

  if (provider === 'openai' && config.apiKey) {
    return new OpenAICompatibleGateway({
      apiKey: config.apiKey,
      model: config.model ?? 'gpt-4o-mini',
      baseURL: config.baseURL,
    });
  }
  if (provider === 'anthropic' && config.apiKey) {
    return new AnthropicGateway({ apiKey: config.apiKey, model: config.model ?? 'claude-opus-4-8' });
  }
  return new StubGateway();
}
