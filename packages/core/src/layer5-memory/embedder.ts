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

/** Cosine similarity of two equal-length, L2-normalised vectors. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}
