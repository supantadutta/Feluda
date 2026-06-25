/**
 * Embedder (Layer V). Turns text into a vector for similarity search.
 *
 * `LocalEmbedder` is a deterministic, dependency-free hashing embedder: it needs
 * no network or API key, so memory works offline and in tests. It captures
 * lexical overlap well enough for note/case recall. It sits behind the `Embedder`
 * interface so a semantic embedding API can be swapped in later without touching
 * the vault or the loop.
 */
export interface Embedder {
  readonly dim: number;
  embed(text: string): number[];
}

/** Async embedder (e.g. a remote semantic embedding API). */
export interface AsyncEmbedder {
  readonly dim: number;
  embed(text: string): Promise<number[]>;
}

export type AnyEmbedder = Embedder | AsyncEmbedder;

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'for', 'on']);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

/** Stable string hash (FNV-1a). */
function hash(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class LocalEmbedder implements Embedder {
  constructor(readonly dim = 256) {}

  embed(text: string): number[] {
    const vec = new Array<number>(this.dim).fill(0);
    for (const token of tokenize(text)) vec[hash(token) % this.dim]! += 1;
    // L2 normalise so cosine similarity is a plain dot product.
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    return vec.map((x) => x / norm);
  }
}

/** Cosine similarity of two vectors (handles non-normalised inputs too). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

interface EmbeddingsResponse {
  data?: { embedding?: number[] }[];
}

export interface RemoteEmbedderConfig {
  apiKey: string;
  /** Embeddings model id (e.g. text-embedding-3-small, or an Ollama model). */
  model: string;
  /** OpenAI-compatible base URL (OpenAI default, or local Ollama/LM Studio). */
  baseURL?: string;
  /** Expected vector dimension (informational; cosine doesn't require it). */
  dim?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Remote semantic embedder over an OpenAI-compatible /embeddings endpoint. Turns
 * the Knowledge Vault from lexical (LocalEmbedder) into true semantic recall when
 * a key is configured. Falls back to the offline LocalEmbedder otherwise. The key
 * is injected and never logged.
 */
export class RemoteEmbedder implements AsyncEmbedder {
  readonly dim: number;
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: RemoteEmbedderConfig) {
    this.dim = config.dim ?? 1536;
    this.baseURL = (config.baseURL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.fetchImpl(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ model: this.config.model, input: text }),
    });
    if (!res.ok) throw new Error(`Embedding provider error (${res.status})`);
    const data = (await res.json()) as EmbeddingsResponse;
    const vec = data.data?.[0]?.embedding;
    if (!vec) throw new Error('Embedding provider returned no vector');
    return vec;
  }
}
