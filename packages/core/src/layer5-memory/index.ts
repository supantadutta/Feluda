/**
 * Layer V — Memory & Adaptive Learning (boundary module)
 * ──────────────────────────────────────────────────────
 * Knowledge Vault (RAG store of notes/findings/cases), Case Memory, Feedback
 * Loop (preference learning as *data*, not retraining), Pattern Library
 * (playbooks), and Self-Review (belief revision on new evidence).
 *
 * The vector store sits behind this interface so it can be swapped later.
 *
 * Phase: Knowledge Vault + Case Memory in Phase 3; adaptive learning in Phase 6.
 */
import type { Verdict } from '../types.js';
import { LocalEmbedder, type Embedder } from './embedder.js';
import { InMemoryVectorStore, FileVectorStore } from './vector-store.js';
import { KnowledgeVault } from './knowledge-vault.js';

/** A retrievable memory item (note, prior finding, case summary). */
export interface MemoryItem {
  id: string;
  text: string;
  /** Free-form tags / case linkage. */
  metadata?: Record<string, unknown>;
}

/** Swappable vector store behind the memory layer. */
export interface VectorStore {
  upsert(items: MemoryItem[]): Promise<void>;
  query(text: string, k: number): Promise<MemoryItem[]>;
}

/** The boundary the Orchestrator uses to read/write memory. */
export interface MemoryPort {
  recall(text: string, k: number): Promise<MemoryItem[]>;
  remember(items: MemoryItem[]): Promise<void>;
  /** Summarise a finished investigation into Case Memory for later recall. */
  rememberCase?(query: { id: string; text: string; caseId?: string }, verdict: Verdict): Promise<void>;
  /** Self-Review hook: revisit a past verdict when new evidence arrives. */
  reviewOnNewEvidence?(verdict: Verdict): Promise<void>;
}

export { LocalEmbedder, cosine, type Embedder } from './embedder.js';
export { InMemoryVectorStore, FileVectorStore } from './vector-store.js';
export { KnowledgeVault } from './knowledge-vault.js';

export interface MemoryConfig {
  /** File path to persist the vector store. When absent, memory is in-process. */
  storePath?: string;
  /** Swap the embedder (defaults to the offline LocalEmbedder). */
  embedder?: Embedder;
}

/** Build the default MemoryPort — a Knowledge Vault over a local vector store. */
export function createMemoryPort(config: MemoryConfig = {}): KnowledgeVault {
  const embedder = config.embedder ?? new LocalEmbedder();
  const store = config.storePath
    ? new FileVectorStore(embedder, config.storePath)
    : new InMemoryVectorStore(embedder);
  return new KnowledgeVault(store);
}
