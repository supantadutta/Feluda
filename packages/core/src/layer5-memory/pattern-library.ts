/**
 * Pattern Library (Layer V). Reusable reasoning templates ("playbooks") per case
 * type. When a new question matches a saved playbook, its seed hypotheses and
 * checklist are injected so a repeat case type is investigated faster and more
 * consistently.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { newId } from '../util/ids.js';

export interface Playbook {
  id: string;
  caseType: string;
  /** Lowercase trigger keywords matched against the question. */
  triggers: string[];
  /** Seed hypotheses to consider for this case type. */
  seedHypotheses: string[];
  /** Optional investigative checklist. */
  checklist?: string[];
}

export class PatternLibrary {
  private playbooks: Playbook[] = [];

  /** Optional JSON file to persist playbooks across restarts. */
  constructor(private readonly path?: string) {
    if (path && existsSync(path)) {
      this.playbooks = JSON.parse(readFileSync(path, 'utf8')) as Playbook[];
    }
  }

  save(pb: Omit<Playbook, 'id'>): Playbook {
    const full: Playbook = { ...pb, id: newId('pb'), triggers: pb.triggers.map((t) => t.toLowerCase()) };
    this.playbooks.push(full);
    this.persist();
    return full;
  }

  /** The best-matching playbook for a question (most trigger hits), if any. */
  match(question: string): Playbook | undefined {
    const q = question.toLowerCase();
    let best: { pb: Playbook; hits: number } | undefined;
    for (const pb of this.playbooks) {
      const hits = pb.triggers.filter((t) => q.includes(t)).length;
      if (hits > 0 && (!best || hits > best.hits)) best = { pb, hits };
    }
    return best?.pb;
  }

  list(): Playbook[] {
    return this.playbooks;
  }

  private persist(): void {
    if (!this.path) return;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.playbooks), 'utf8');
  }
}
