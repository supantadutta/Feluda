/**
 * Knowledge Vault + Case Memory (Layer V). The default MemoryPort: a RAG store
 * of the user's notes and prior cases, retrieved into the loop and written back
 * after each verdict so follow-ups can build on earlier sessions.
 */
import type { Verdict } from '../types.js';
import { newId } from '../util/ids.js';
import type { MemoryItem, MemoryPort, VectorStore } from './index.js';

export class KnowledgeVault implements MemoryPort {
  constructor(private readonly store: VectorStore) {}

  recall(text: string, k: number): Promise<MemoryItem[]> {
    return this.store.query(text, k);
  }

  remember(items: MemoryItem[]): Promise<void> {
    return this.store.upsert(items);
  }

  /** Add a free-text user note to the vault. */
  addNote(text: string, caseId?: string): Promise<MemoryItem> {
    const item: MemoryItem = { id: newId('note'), text, metadata: { type: 'note', caseId } };
    return this.store.upsert([item]).then(() => item);
  }

  /** Summarise a finished investigation into Case Memory for later recall. */
  rememberCase(query: { id: string; text: string; caseId?: string }, verdict: Verdict): Promise<void> {
    const item: MemoryItem = {
      id: newId('case'),
      text: `Q: ${query.text}\nVerdict (${verdict.confidence.band}): ${verdict.answer}`,
      metadata: {
        type: 'case',
        caseId: query.caseId,
        queryId: query.id,
        confidence: verdict.confidence.band,
      },
    };
    return this.store.upsert([item]);
  }
}
