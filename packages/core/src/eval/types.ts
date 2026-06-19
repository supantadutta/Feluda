/**
 * Evaluation & calibration harness types. A golden case pins an expected outcome
 * (correct leading hypothesis, refusal, confidence bounds) for a deterministic
 * scenario, so "world-class" is measurable, not just asserted.
 */
import type { Query } from '../types.js';
import type { ModelGateway } from '../layer3-council/index.js';
import type { SearchProvider } from '../layer4-evidence/index.js';

export type Band = 'low' | 'medium' | 'high';

export interface GoldenCase {
  id: string;
  query: Query;
  /** Scripted gateway for a deterministic outcome (defaults to the offline stub). */
  gateway?: ModelGateway;
  /** Optional evidence provider for the case. */
  search?: SearchProvider;
  expect: {
    refused?: boolean;
    /** Substring the leading hypothesis should contain (correctness signal). */
    topIncludes?: string;
    /** Confidence must not exceed this band. */
    bandAtMost?: Band;
    /** Confidence must be at least this band. */
    minBand?: Band;
  };
}

export interface CaseResult {
  id: string;
  passed: boolean;
  failures: string[];
  band: Band;
  score: number;
  correct?: boolean;
  refused: boolean;
}

export interface EvalReport {
  results: CaseResult[];
  total: number;
  passRate: number;
  /** Brier score over cases with a correctness signal (lower = better calibrated). */
  brier?: number;
  /** Count of incorrect conclusions stated with "high" confidence (should be 0). */
  overconfidentIncorrect: number;
}
