/**
 * Confidence Calibrator (Layer II) — turns belief into an honest confidence
 * level and names the gaps. It NEVER inflates certainty: with no external
 * evidence (Phase 1) confidence is capped below "high", and a standing gap
 * about the missing evidence is always recorded.
 */
import type { Confidence, Evidence, Hypothesis } from '../types.js';
import { clamp01 } from '../util/json.js';
import type { ConfidenceCalibrator } from './index.js';

const NO_EVIDENCE_GAP =
  'No external evidence was gathered (reasoning over the question and general knowledge only).';

function bandFor(score: number): Confidence['band'] {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

const SINGLE_SOURCE_GAP =
  'Claims are not independently corroborated (fewer than two credible, independent sources).';
const CLOSE_HYPOTHESES_GAP =
  'Competing hypotheses remain close — the leading explanation does not clearly dominate.';

export interface CalibrateOptions {
  /** A confidence score the model proposed for its own answer. */
  modelScore?: number;
  /** Additional gaps surfaced by the synthesizer. */
  extraGaps?: string[];
  /** Whether ≥2 independent credible sources corroborate the evidence. */
  corroborated?: boolean;
  /** Belief gap between the leading hypothesis and the runner-up (0..1). */
  separation?: number;
}

export class BandConfidenceCalibrator implements ConfidenceCalibrator {
  calibrate(hypotheses: Hypothesis[], evidence: Evidence[], opts: CalibrateOptions = {}): Confidence {
    const topBelief = hypotheses.reduce((m, h) => Math.max(m, h.belief), 0);
    let score = clamp01(opts.modelScore ?? topBelief);

    const gaps = new Set<string>(opts.extraGaps?.filter(Boolean));
    if (evidence.length === 0) {
      // Calibrated honesty: thin evidence cannot yield high confidence.
      score = Math.min(score, 0.69);
      gaps.add(NO_EVIDENCE_GAP);
    } else if (opts.corroborated === false) {
      // Evidence exists but stands on a single source — still cap below "high".
      score = Math.min(score, 0.69);
      gaps.add(SINGLE_SOURCE_GAP);
    }

    // A near-tie between hypotheses is itself a reason for humility.
    if (hypotheses.length >= 2 && opts.separation !== undefined && opts.separation < 0.1) {
      score = Math.min(score, 0.6);
      gaps.add(CLOSE_HYPOTHESES_GAP);
    }

    return { score, band: bandFor(score), gaps: [...gaps] };
  }
}
