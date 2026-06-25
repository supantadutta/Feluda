import { describe, it, expect } from 'vitest';
import { createOrchestrator } from '../src/layer2-investigation-core/index.js';
import { createModelGateway, type ProviderKind } from '../src/layer3-council/index.js';
import { SearchEvidencePort, FixtureSearchProvider } from '../src/layer4-evidence/index.js';

/**
 * Opt-in LIVE integration test. Runs a real investigation against a configured
 * model ONLY when test credentials are present in the environment; otherwise it
 * is skipped, so the offline suite stays deterministic and keyless.
 *
 *   FELUDA_TEST_API_KEY   — provider key (required to run)
 *   FELUDA_TEST_PROVIDER  — 'anthropic' | 'openai' (default 'anthropic')
 *   FELUDA_TEST_MODEL     — model id
 *   FELUDA_TEST_BASE_URL  — OpenAI-compatible base URL (for 'openai')
 */
const KEY = process.env.FELUDA_TEST_API_KEY;

describe('live model integration (opt-in)', () => {
  it.skipIf(!KEY)('produces a grounded, calibrated verdict from a real model', async () => {
    const gateway = createModelGateway({
      provider: (process.env.FELUDA_TEST_PROVIDER as ProviderKind) ?? 'anthropic',
      apiKey: KEY,
      model: process.env.FELUDA_TEST_MODEL,
      baseURL: process.env.FELUDA_TEST_BASE_URL,
    });
    const orchestrator = createOrchestrator({ gateway, evidence: new SearchEvidencePort(new FixtureSearchProvider()) });
    const verdict = await orchestrator.investigate({
      id: 'live',
      text: 'What makes a source trustworthy in an investigation?',
      receivedAt: new Date().toISOString(),
    });

    expect(verdict.answer.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(verdict.confidence.band);
    expect(verdict.hypotheses.length).toBeGreaterThan(0);
    // Citations only ever come from the evidence pipeline — never fabricated.
    for (const c of verdict.citations) expect(typeof c.source).toBe('string');
  }, 60_000);
});
