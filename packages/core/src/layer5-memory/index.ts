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
import { notImplemented } from '../util/not-implemented.js';

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
  /** Self-Review hook: revisit a past verdict when new evidence arrives. */
  reviewOnNewEvidence?(verdict: Verdict): Promise<void>;
}

/** Phase 0 placeholder — backed by a local vector store in Phase 3. */
export function createMemoryPort(): MemoryPort {
  return {
    recall: () => notImplemented('Layer V MemoryPort.recall'),
    remember: () => notImplemented('Layer V MemoryPort.remember'),
  };
}
