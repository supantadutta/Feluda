import { describe, it, expect } from 'vitest';
import { OpenAICompatibleGateway, createModelGateway, StubGateway } from '../src/layer3-council/index.js';

describe('OpenAI-compatible gateway', () => {
  it('posts chat/completions to the configured base URL and parses the reply', async () => {
    let seenUrl = '';
    let seenAuth = '';
    let seenBody: { model?: string } = {};
    const fetchImpl = (async (url: string, init?: { headers?: Record<string, string>; body?: string }) => {
      seenUrl = String(url);
      seenAuth = init?.headers?.Authorization ?? '';
      seenBody = JSON.parse(init?.body ?? '{}');
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'hello' } }], usage: { prompt_tokens: 3, completion_tokens: 1 } }) } as Response;
    }) as unknown as typeof fetch;

    const gw = new OpenAICompatibleGateway({ apiKey: 'k', model: 'llama3.1', baseURL: 'http://localhost:11434/v1', fetchImpl });
    const res = await gw.complete({ prompt: 'hi', system: 'be brief' });

    expect(res.text).toBe('hello');
    expect(seenUrl).toBe('http://localhost:11434/v1/chat/completions');
    expect(seenAuth).toBe('Bearer k');
    expect(seenBody.model).toBe('llama3.1');
  });

  it('factory selects provider by config', () => {
    expect(createModelGateway({})).toBeInstanceOf(StubGateway);
    expect(createModelGateway({ provider: 'openai', apiKey: 'k', baseURL: 'http://x/v1', model: 'm' })).toBeInstanceOf(OpenAICompatibleGateway);
  });
});
