/**
 * Anthropic adapter — the default provider (CLAUDE.md). Implements the
 * provider-agnostic ModelGateway so other providers can slot in behind the same
 * interface in Phase 4. The API key is injected (never read from globals here)
 * and never logged.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ModelGateway, ModelRequest, ModelResponse } from '../index.js';

export interface AnthropicGatewayConfig {
  apiKey: string;
  /** Default model id; can be overridden per request. */
  model: string;
  maxTokens?: number;
}

export class AnthropicGateway implements ModelGateway {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: AnthropicGatewayConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 1024;
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const model = req.model ?? this.model;
    const message = await this.client.messages.create({
      model,
      max_tokens: this.maxTokens,
      system: req.system,
      messages: [{ role: 'user', content: req.prompt }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return {
      text,
      model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }
}
