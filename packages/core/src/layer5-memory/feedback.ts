/**
 * Feedback Loop (Layer V). User corrections and preferences are stored as DATA
 * (not model retraining, per the non-goals) and surfaced into later
 * investigations so behaviour measurably changes over time. Relevance uses the
 * same offline embedder as the vault.
 */
import { newId } from '../util/ids.js';
import { cosine, LocalEmbedder, type Embedder } from './embedder.js';

export interface Preference {
  id: string;
  text: string;
  createdAt: string;
}

export class FeedbackStore {
  private items: { pref: Preference; vector: number[] }[] = [];

  constructor(private readonly embedder: Embedder = new LocalEmbedder()) {}

  /** Record a correction/preference, e.g. "always cite primary sources first". */
  add(text: string): Preference {
    const pref: Preference = { id: newId('pref'), text, createdAt: new Date().toISOString() };
    this.items.push({ pref, vector: this.embedder.embed(text) });
    return pref;
  }

  /** Preferences relevant to a query, most-relevant first. */
  relevant(query: string, k = 3): Preference[] {
    const q = this.embedder.embed(query);
    return this.items
      .map((i) => ({ pref: i.pref, score: cosine(q, i.vector) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((r) => r.pref);
  }

  get size(): number {
    return this.items.length;
  }
}
