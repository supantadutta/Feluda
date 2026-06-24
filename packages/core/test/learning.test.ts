import { describe, it, expect } from 'vitest';
import { SyntheticTrainer, PatternLearner, generateScenarios } from '../src/learning/index.js';

describe('Synthetic learning', () => {
  it('learns to classify synthetic cases well above the random baseline', () => {
    const report = new SyntheticTrainer().run({ rounds: 5, perClassPerRound: 1, testPerClass: 5 });
    expect(report.rounds).toHaveLength(5);
    // Final accuracy clearly beats guessing at random.
    expect(report.finalAccuracy).toBeGreaterThanOrEqual(0.8);
    expect(report.improvement).toBeGreaterThan(0.3);
  });

  it('is deterministic (same run → same curve)', () => {
    const a = new SyntheticTrainer().run({ rounds: 3 });
    const b = new SyntheticTrainer().run({ rounds: 3 });
    expect(a.rounds.map((r) => r.accuracy)).toEqual(b.rounds.map((r) => r.accuracy));
  });

  it('an untrained learner makes no prediction; a trained one routes correctly', () => {
    const learner = new PatternLearner();
    expect(learner.predict('anything')).toBeUndefined();
    for (const s of generateScenarios(3)) learner.observe(s.text, s.label);
    expect(learner.predict('repeated failed password attempts hammering the login')).toBe('brute_force');
  });
});
