/**
 * Self-Review (Layer V) — belief revision. When new evidence arrives, revisit
 * prior verdicts it may contradict and flag them for re-review. Detection is a
 * conservative heuristic: a strong subject overlap with the prior case PLUS a
 * polarity flip (negation or an antonym pair) signals a contradiction.
 */
import type { MemoryPort, MemoryItem } from './index.js';
import type { ReviewFlag } from '../types.js';

const ANTONYMS: [string, string][] = [
  ['guilty', 'innocent'],
  ['true', 'false'],
  ['authentic', 'forged'],
  ['alive', 'dead'],
  ['safe', 'compromised'],
  ['increase', 'decrease'],
  ['present', 'absent'],
];

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

const NEGATIONS = new Set(['not', 'no', 'never', "n't", 'without', 'nor']);

function polarityFlip(a: Set<string>, b: Set<string>): boolean {
  const aNeg = [...a].some((t) => NEGATIONS.has(t));
  const bNeg = [...b].some((t) => NEGATIONS.has(t));
  if (aNeg !== bNeg) return true;
  for (const [x, y] of ANTONYMS) {
    if ((a.has(x) && b.has(y)) || (a.has(y) && b.has(x))) return true;
  }
  return false;
}

export class SelfReview {
  constructor(private readonly memory: MemoryPort) {}

  /** Find prior cases that the new claim appears to contradict. */
  async review(newClaim: string): Promise<ReviewFlag[]> {
    const priors: MemoryItem[] = await this.memory.recall(newClaim, 5);
    const claimTokens = tokens(newClaim);
    const flags: ReviewFlag[] = [];

    for (const prior of priors) {
      if (prior.metadata?.type !== 'case') continue;
      const priorTokens = tokens(prior.text);
      const overlap = [...claimTokens].filter((t) => priorTokens.has(t) && !NEGATIONS.has(t)).length;
      if (overlap >= 2 && polarityFlip(claimTokens, priorTokens)) {
        flags.push({
          priorSummary: prior.text.slice(0, 200),
          reason: 'New evidence appears to contradict this prior verdict (polarity flip).',
          priorQueryId: typeof prior.metadata?.queryId === 'string' ? prior.metadata.queryId : undefined,
        });
      }
    }
    return flags;
  }
}
