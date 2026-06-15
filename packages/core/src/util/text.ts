/**
 * Lightweight, dependency-free text utilities used by the deduction engine:
 * tokenisation, bag-of-words cosine similarity, and polarity-flip detection
 * (negation / antonym). Deterministic, so reasoning is reproducible offline.
 */
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'for', 'on', 'that', 'this',
  'it', 'as', 'at', 'by', 'be', 'was', 'were', 'with',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Bag-of-words cosine similarity of two strings, in [0, 1]. */
export function cosineSim(a: string, b: string): number {
  const fa = termFreq(tokenize(a));
  const fb = termFreq(tokenize(b));
  if (fa.size === 0 || fb.size === 0) return 0;
  let dot = 0;
  for (const [t, va] of fa) {
    const vb = fb.get(t);
    if (vb) dot += va * vb;
  }
  const mag = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0));
  return dot / (mag(fa) * mag(fb) || 1);
}

const NEGATIONS = new Set(['not', 'no', 'never', "n't", 'without', 'nor', 'cannot', 'false', 'denies', 'denied']);
const ANTONYM_PAIRS: [string, string][] = [
  ['guilty', 'innocent'],
  ['true', 'false'],
  ['authentic', 'forged'],
  ['authentic', 'fake'],
  ['alive', 'dead'],
  ['safe', 'compromised'],
  ['malicious', 'benign'],
  ['increase', 'decrease'],
  ['present', 'absent'],
  ['insider', 'outsider'],
  ['accidental', 'deliberate'],
];
const ANTONYM_MAP = new Map<string, string>();
for (const [a, b] of ANTONYM_PAIRS) {
  ANTONYM_MAP.set(a, b);
  ANTONYM_MAP.set(b, a);
}

/** Affirmed vs negated content terms in a sentence (1-token negation window). */
function polarityScan(text: string): { affirmed: Set<string>; negated: Set<string> } {
  const toks = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const affirmed = new Set<string>();
  const negated = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i]!;
    if (NEGATIONS.has(tk)) {
      for (let j = i + 1; j < toks.length; j++) {
        const nt = toks[j]!;
        if (nt.length < 2 || STOP.has(nt) || NEGATIONS.has(nt)) continue;
        negated.add(nt);
        break; // negate only the next content term
      }
    } else if (tk.length >= 2 && !STOP.has(tk)) {
      affirmed.add(tk);
    }
  }
  return { affirmed, negated };
}

export interface Stance {
  /** +1 supports the hypothesis, -1 contradicts it, 0 neutral. */
  direction: -1 | 0 | 1;
  /** 0..1 magnitude of the stance. */
  strength: number;
}

/**
 * Estimate whether a piece of evidence supports or contradicts a hypothesis.
 * Combines topical similarity with per-term affirmation/negation and antonym
 * pairs, so "the painting is forged, not authentic" supports "forged" and
 * contradicts "authentic" — not both.
 */
export function stance(evidence: string, hypothesis: string, focusTerms?: Set<string>): Stance {
  const rel = cosineSim(evidence, hypothesis);
  if (rel < 0.12) return { direction: 0, strength: 0 };

  const { affirmed, negated } = polarityScan(evidence);
  const allTerms = new Set(tokenize(hypothesis).filter((t) => !NEGATIONS.has(t)));
  // When focus terms are supplied, only the hypothesis's DISTINCTIVE terms count
  // toward stance — generic boilerplate shared across rival hypotheses does not
  // discriminate and so must not sway belief.
  const terms = focusTerms ?? allTerms;
  let support = 0;
  let contradict = 0;
  for (const t of terms) {
    if (affirmed.has(t)) support++;
    if (negated.has(t)) contradict++;
    const ant = ANTONYM_MAP.get(t);
    if (ant) {
      if (affirmed.has(ant)) contradict++;
      if (negated.has(ant)) support++;
    }
  }

  const net = support - contradict;
  if (support === 0 && contradict === 0) {
    // No distinctive signal. With focus terms, stay neutral; otherwise treat
    // topical relevance as mild support.
    return focusTerms ? { direction: 0, strength: 0 } : { direction: 1, strength: Math.min(1, 0.4 * rel) };
  }
  const direction: -1 | 0 | 1 = net > 0 ? 1 : net < 0 ? -1 : 0;
  const strength = Math.min(1, 0.4 * rel + 0.3 * Math.abs(net));
  return { direction, strength };
}

/** Distinctive terms per hypothesis: tokens that appear in only one hypothesis. */
export function distinctiveTerms(statements: string[]): Set<string>[] {
  const counts = new Map<string, number>();
  const perStatement = statements.map((s) => new Set(tokenize(s).filter((t) => !NEGATIONS.has(t))));
  for (const terms of perStatement) for (const t of terms) counts.set(t, (counts.get(t) ?? 0) + 1);
  return perStatement.map((terms) => {
    const distinctive = new Set([...terms].filter((t) => counts.get(t) === 1));
    // If everything is shared, fall back to the full term set so it still scores.
    return distinctive.size > 0 ? distinctive : terms;
  });
}

/** True when two statements differ in polarity (used for belief-revision flags). */
export function polarityFlip(a: string, b: string): boolean {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  const aNeg = [...ta].some((t) => NEGATIONS.has(t));
  const bNeg = [...tb].some((t) => NEGATIONS.has(t));
  if (aNeg !== bNeg) return true;
  for (const [x, y] of ANTONYM_PAIRS) {
    if ((ta.has(x) && tb.has(y)) || (ta.has(y) && tb.has(x))) return true;
  }
  return false;
}
