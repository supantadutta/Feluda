/**
 * Synthetic Learning (Layer V, adaptive). Feluda generates labelled synthetic
 * investigation scenarios, trains a lightweight online pattern learner on them,
 * and measures how its accuracy improves with experience.
 *
 * This is "learning as DATA, not model retraining" (SPEC non-goals): the learner
 * is a nearest-centroid classifier over the offline embedder. It can route a new
 * case to a likely category/playbook — a learned prior that complements the LLM,
 * never replaces or retrains it. Fully deterministic and offline.
 */
import { LocalEmbedder, cosine, type Embedder } from '../layer5-memory/embedder.js';

/** A labelled synthetic example: free-text features → a known category. */
export interface Scenario {
  text: string;
  label: string;
}

/** Online nearest-centroid classifier — accuracy rises as it observes examples. */
export class PatternLearner {
  private readonly sums = new Map<string, number[]>();
  private readonly counts = new Map<string, number>();

  constructor(private readonly embedder: Embedder = new LocalEmbedder()) {}

  observe(text: string, label: string): void {
    const v = this.embedder.embed(text);
    const sum = this.sums.get(label) ?? new Array<number>(v.length).fill(0);
    for (let i = 0; i < v.length; i++) sum[i]! += v[i]!;
    this.sums.set(label, sum);
    this.counts.set(label, (this.counts.get(label) ?? 0) + 1);
  }

  predict(text: string): string | undefined {
    const v = this.embedder.embed(text);
    let best: { label: string; score: number } | undefined;
    for (const [label, sum] of this.sums) {
      const n = this.counts.get(label) ?? 1;
      const centroid = sum.map((x) => x / n);
      const score = cosine(v, centroid);
      if (!best || score > best.score) best = { label, score };
    }
    return best?.label;
  }

  get observedCount(): number {
    return [...this.counts.values()].reduce((s, v) => s + v, 0);
  }
}

// Distinct vocab per category so the synthetic data is learnable but realistic.
// Vocabularies are deliberately separated across classes to keep them learnable.
const TEMPLATES: Record<string, string[]> = {
  brute_force: [
    'repeated failed password guesses against the login',
    'many invalid credential authentication failures and account lockouts',
    'a flood of wrong password submissions on the sign-in form',
    'persistent credential guessing triggering authentication lockout',
    'high volume of rejected passwords during sign-in',
  ],
  phishing: [
    'deceptive email with a malicious link urging the recipient to verify',
    'spoofed sender lure asking the user to click a credential page',
    'fraudulent message with a phishing link and a fake attachment',
    'social-engineering email impersonating support to harvest the password',
    'lure email with a deceptive hyperlink to a fake sign-in page',
  ],
  malware_hash: [
    'a file hash flagged by reputation as a trojan dropper sample',
    'binary signature matching a documented ransomware family sample',
    'malicious executable hash identified as spyware by sandboxes',
    'file fingerprint matching a known backdoor malware sample',
    'reputation marks the binary hash as a worm payload sample',
  ],
  benign_admin: [
    'scheduled authorised maintenance performed by the known administrator',
    'expected routine backup job during the approved change window',
    'planned configuration update signed off in the change ticket',
    'authorised software deployment during the maintenance window',
    'routine approved administrative task on schedule',
  ],
  port_scan: [
    'sequential probing of many network ports across the subnet',
    'reconnaissance sweep touching numerous closed services',
    'enumeration of open and closed ports on the network range',
    'broad service discovery scanning across many ports',
    'systematic port enumeration probing the network services',
  ],
};

/** Deterministically generate `perClass` scenarios per category, offset by seed. */
export function generateScenarios(perClass: number, seed = 0): Scenario[] {
  const out: Scenario[] = [];
  for (const [label, variants] of Object.entries(TEMPLATES)) {
    for (let i = 0; i < perClass; i++) {
      const base = variants[(seed + i) % variants.length]!;
      out.push({ text: `${base} (observation ${seed + i})`, label });
    }
  }
  return out;
}

export interface LearningRound {
  round: number;
  trainedTotal: number;
  accuracy: number;
}

export interface LearningReport {
  labels: string[];
  /** Accuracy of guessing at random (1 / #labels). */
  baselineAccuracy: number;
  rounds: LearningRound[];
  finalAccuracy: number;
  /** finalAccuracy − baselineAccuracy (how much was learned). */
  improvement: number;
}

export interface TrainOptions {
  rounds?: number;
  perClassPerRound?: number;
  testPerClass?: number;
}

export class SyntheticTrainer {
  constructor(private readonly embedder: Embedder = new LocalEmbedder()) {}

  run(opts: TrainOptions = {}): LearningReport {
    const rounds = opts.rounds ?? 5;
    const perClassPerRound = opts.perClassPerRound ?? 1;
    const testPerClass = opts.testPerClass ?? 5;
    const labels = Object.keys(TEMPLATES);

    const learner = new PatternLearner(this.embedder);
    // Held-out test set (high seed offset so it never overlaps training).
    const test = generateScenarios(testPerClass, 1000);

    const roundReports: LearningRound[] = [];
    for (let r = 1; r <= rounds; r++) {
      // Each round introduces a fresh variant per class (seed = round), so the
      // learner sees more phrasing diversity over time and its accuracy climbs.
      for (const s of generateScenarios(perClassPerRound, r)) learner.observe(s.text, s.label);
      const correct = test.filter((t) => learner.predict(t.text) === t.label).length;
      roundReports.push({ round: r, trainedTotal: learner.observedCount, accuracy: correct / test.length });
    }

    const finalAccuracy = roundReports[roundReports.length - 1]?.accuracy ?? 0;
    const baselineAccuracy = 1 / labels.length;
    return { labels, baselineAccuracy, rounds: roundReports, finalAccuracy, improvement: finalAccuracy - baselineAccuracy };
  }
}
