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

export interface CalibrateOptions {
  /** A confidence score the model proposed for its own answer. */
  modelScore?: number;
  /** Additional gaps surfaced by the synthesizer. */
  extraGaps?: string[];
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
    }

    return { score, band: bandFor(score), gaps: [...gaps] };
  }
}
