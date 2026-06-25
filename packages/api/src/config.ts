import 'dotenv/config';

/**
 * Centralized config. Secrets are read here only — they must never be sent to
 * the frontend, embedded in prompts, or written to logs (CLAUDE.md, SPEC.md —
 * Secrets Vault). Phase 0 reads only non-secret runtime settings.
 */
export interface Config {
  nodeEnv: string;
  apiPort: number;
  webOrigin: string;
  /** Anthropic key — kept server-side only, never logged or sent to the client. */
  anthropicApiKey?: string;
  /** Default model id for the gateway. */
  defaultModel: string;
  /** Web search key (Layer IV). When absent, offline fixtures are used. */
  searchApiKey?: string;
  /** Path to the local vector store (Layer V). */
  vectorStorePath: string;
  /** Multi-AI Council (Layer III). */
  councilEnabled: boolean;
  councilModels: string[];
  councilCostCapUsd: number;
  /** Enable keyless live OSINT providers (RDAP, DNS-over-HTTPS). */
  osintLive: boolean;
  /** Optional key for the key-gated reputation/threat-intel provider. */
  reputationApiKey?: string;
  /** When set, every /api/* request must send this key (x-api-key / Bearer). */
  apiKey?: string;
  /** Max request body size in bytes. */
  maxBodyBytes: number;
  /** Max requests per minute per IP (rate limit). */
  rateLimitMax: number;
  /** File path to persist investigation cases (survives restart). */
  casesPath?: string;
  /** File paths to persist adaptive learning (feedback + playbooks). */
  feedbackPath?: string;
  playbooksPath?: string;
}

export function loadConfig(): Config {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    apiPort: Number(process.env.API_PORT ?? 3001),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    defaultModel: process.env.FELUDA_DEFAULT_MODEL ?? 'claude-opus-4-8',
    searchApiKey: process.env.WEB_SEARCH_API_KEY || undefined,
    vectorStorePath: process.env.VECTOR_STORE_PATH ?? './data/vector-store/store.json',
    councilEnabled: process.env.COUNCIL_ENABLED === 'true',
    councilModels: (process.env.FELUDA_COUNCIL_MODELS ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    councilCostCapUsd: Number(process.env.COUNCIL_COST_CAP_USD ?? 0.5),
    osintLive: process.env.FELUDA_OSINT_LIVE === 'true',
    reputationApiKey: process.env.FELUDA_REPUTATION_API_KEY || undefined,
    apiKey: process.env.FELUDA_API_KEY || undefined,
    maxBodyBytes: Number(process.env.FELUDA_MAX_BODY_BYTES ?? 1_000_000),
    rateLimitMax: Number(process.env.FELUDA_RATE_LIMIT_MAX ?? 240),
    casesPath: process.env.FELUDA_CASES_PATH || undefined,
    feedbackPath: process.env.FELUDA_FEEDBACK_PATH || undefined,
    playbooksPath: process.env.FELUDA_PLAYBOOKS_PATH || undefined,
  };
}
