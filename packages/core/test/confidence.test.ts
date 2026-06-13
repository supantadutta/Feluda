import { describe, it, expect } from 'vitest';
import { BandConfidenceCalibrator } from '../src/layer2-investigation-core/index.js';
import type { Hypothesis } from '../src/types.js';

const calibrator = new BandConfidenceCalibrator();

function hyp(belief: number): Hypothesis {
  return { id: 'h', statement: 's', belief, supporting: [], contradicting: [] };
}

describe('Confidence calibrator', () => {
  it('never reports high confidence without external evidence', () => {
    const c = calibrator.calibrate([hyp(0.95)], [], { modelScore: 0.95 });
    expect(c.band).not.toBe('high');
    expect(c.score).toBeLessThanOrEqual(0.69);
    expect(c.gaps.some((g) => /no external evidence/i.test(g))).toBe(true);
  });

  it('maps scores to bands', () => {
    expect(calibrator.calibrate([hyp(0.1)], []).band).toBe('low');
    expect(calibrator.calibrate([hyp(0.5)], []).band).toBe('medium');
  });

  it('merges extra gaps from the synthesizer', () => {
    const c = calibrator.calibrate([hyp(0.4)], [], { extraGaps: ['single perspective only'] });
    expect(c.gaps).toContain('single perspective only');
  });
});
