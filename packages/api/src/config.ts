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
}

export function loadConfig(): Config {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    apiPort: Number(process.env.API_PORT ?? 3001),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    defaultModel: process.env.FELUDA_DEFAULT_MODEL ?? 'claude-opus-4-8',
  };
}
