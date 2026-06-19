import { describe, it, expect } from 'vitest';
import { Evaluator, GOLDEN_CASES } from '../src/eval/index.js';

describe('Evaluation & calibration harness', () => {
  it('passes the golden suite and stays well-calibrated', async () => {
    const report = await new Evaluator().evaluate(GOLDEN_CASES);

    // Every golden expectation holds.
    const failed = report.results.filter((r) => !r.passed);
    expect(failed, JSON.stringify(failed)).toHaveLength(0);
    expect(report.passRate).toBe(1);

    // Never overconfident on an incorrect conclusion.
    expect(report.overconfidentIncorrect).toBe(0);

    // Calibrated: Brier score is low (predictions track outcomes).
    expect(report.brier).toBeDefined();
    expect(report.brier!).toBeLessThan(0.25);
  });
});
