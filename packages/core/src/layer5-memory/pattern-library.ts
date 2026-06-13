/**
 * Pattern Library (Layer V). Reusable reasoning templates ("playbooks") per case
 * type. When a new question matches a saved playbook, its seed hypotheses and
 * checklist are injected so a repeat case type is investigated faster and more
 * consistently.
 */
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

  save(pb: Omit<Playbook, 'id'>): Playbook {
    const full: Playbook = { ...pb, id: newId('pb'), triggers: pb.triggers.map((t) => t.toLowerCase()) };
    this.playbooks.push(full);
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
}
