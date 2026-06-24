/**
 * OpenAI-compatible adapter. Talks to any endpoint that implements the
 * /chat/completions API — OpenAI, OpenRouter, Together, Groq, or a LOCAL model
 * via Ollama / LM Studio (set baseURL to e.g. http://localhost:11434/v1). This
 * is what lets a user plug in "any model" from the UI. The key is injected and
 * never logged.
 */
import type { ModelGateway, ModelRequest, ModelResponse } from '../index.js';

export interface OpenAICompatibleConfig {
  apiKey: string;
  model: string;
  /** API base, e.g. https://api.openai.com/v1 or http://localhost:11434/v1. */
  baseURL?: string;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAICompatibleGateway implements ModelGateway {
  private readonly model: string;
  private readonly baseURL: string;
  private readonly maxTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: OpenAICompatibleConfig) {
    this.model = config.model;
    this.baseURL = (config.baseURL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.maxTokens = config.maxTokens ?? 1024;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const model = req.model ?? this.model;
    const messages = [
      ...(req.system ? [{ role: 'system', content: req.system }] : []),
      { role: 'user', content: req.prompt },
    ];
    const res = await this.fetchImpl(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: this.maxTokens }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Model provider error (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }
    const data = (await res.json()) as ChatResponse;
    const text = data.choices?.[0]?.message?.content ?? '';
    return {
      text,
      model,
      usage: data.usage
        ? { inputTokens: data.usage.prompt_tokens ?? 0, outputTokens: data.usage.completion_tokens ?? 0 }
        : undefined,
    };
  }
}
