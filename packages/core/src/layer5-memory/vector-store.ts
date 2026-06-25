/**
 * Vector store (Layer V) — local and swappable. `InMemoryVectorStore` keeps
 * everything in process; `FileVectorStore` persists to a JSON file so memory
 * survives restarts. Both sit behind the `VectorStore` interface so a native
 * store (sqlite-vec, LanceDB) can replace them later without touching callers.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MemoryItem, VectorStore } from './index.js';
import { cosine, type AnyEmbedder } from './embedder.js';

interface StoredItem {
  item: MemoryItem;
  vector: number[];
}

export class InMemoryVectorStore implements VectorStore {
  protected items = new Map<string, StoredItem>();

  // Accepts a sync (LocalEmbedder) or async (RemoteEmbedder) embedder.
  constructor(protected readonly embedder: AnyEmbedder) {}

  async upsert(items: MemoryItem[]): Promise<void> {
    for (const item of items) {
      this.items.set(item.id, { item, vector: await this.embedder.embed(item.text) });
    }
    await this.persist();
  }

  async query(text: string, k: number): Promise<MemoryItem[]> {
    const q = await this.embedder.embed(text);
    return [...this.items.values()]
      .map((s) => ({ item: s.item, score: cosine(q, s.vector) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((r) => r.item);
  }

  get size(): number {
    return this.items.size;
  }

  /** No-op for the in-memory store; overridden by the file-backed store. */
  protected async persist(): Promise<void> {}
}

export class FileVectorStore extends InMemoryVectorStore {
  constructor(
    embedder: AnyEmbedder,
    private readonly path: string,
  ) {
    super(embedder);
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, 'utf8')) as StoredItem[];
      for (const s of raw) this.items.set(s.item.id, s);
    }
  }

  protected override async persist(): Promise<void> {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify([...this.items.values()]), 'utf8');
  }
}
