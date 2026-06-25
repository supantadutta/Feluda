/**
 * Feedback Loop (Layer V). User corrections and preferences are stored as DATA
 * (not model retraining, per the non-goals) and surfaced into later
 * investigations so behaviour measurably changes over time. Relevance uses the
 * same offline embedder as the vault.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { newId } from '../util/ids.js';
import { cosine, LocalEmbedder, type Embedder } from './embedder.js';

export interface Preference {
  id: string;
  text: string;
  createdAt: string;
}

export class FeedbackStore {
  private items: { pref: Preference; vector: number[] }[] = [];

  constructor(
    private readonly embedder: Embedder = new LocalEmbedder(),
    /** Optional JSON file to persist preferences across restarts. */
    private readonly path?: string,
  ) {
    if (path && existsSync(path)) {
      const prefs = JSON.parse(readFileSync(path, 'utf8')) as Preference[];
      this.items = prefs.map((pref) => ({ pref, vector: this.embedder.embed(pref.text) }));
    }
  }

  /** Record a correction/preference, e.g. "always cite primary sources first". */
  add(text: string): Preference {
    const pref: Preference = { id: newId('pref'), text, createdAt: new Date().toISOString() };
    this.items.push({ pref, vector: this.embedder.embed(text) });
    this.persist();
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

  private persist(): void {
    if (!this.path) return;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.items.map((i) => i.pref)), 'utf8');
  }
}
