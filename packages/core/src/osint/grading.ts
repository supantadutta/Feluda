/**
 * Source credibility grading (A–F) and freshness. Translates the numeric
 * credibility from the Source Verifier (Layer IV) into an explainable letter
 * grade, and tracks how stale a source is. Feluda never treats blogs, forums,
 * screenshots, social posts, or AI-generated claims as strong evidence unless
 * corroborated — reflected here and in the cross-checker.
 */
import type { SourceGrade } from './types.js';

/**
 *  A — Primary / authoritative   (credibility ≥ 0.85)
 *  B — Reliable specialist       (≥ 0.70)
 *  C — Useful but unverified      (≥ 0.50)
 *  D — Weak / biased / low-trust  (≥ 0.30)
 *  F — Unusable / contradicted    (< 0.30)
 */
export function gradeFromCredibility(credibility: number): SourceGrade {
  if (credibility >= 0.85) return 'A';
  if (credibility >= 0.7) return 'B';
  if (credibility >= 0.5) return 'C';
  if (credibility >= 0.3) return 'D';
  return 'F';
}

/** 0..1 freshness score — newer is better; unknown age is treated cautiously. */
export function freshnessScore(ageDays: number | undefined): number {
  if (ageDays === undefined) return 0.5;
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.85;
  if (ageDays <= 180) return 0.6;
  if (ageDays <= 365) return 0.4;
  return 0.2;
}

/** True when a source is too stale to support a current claim on its own. */
export function isStale(ageDays: number | undefined, maxDays = 365): boolean {
  return ageDays !== undefined && ageDays > maxDays;
}
