import { describe, it, expect } from 'vitest';
import { BriefingScheduler } from '../src/layer1-interface/index.js';
import type { Verdict } from '../src/types.js';

function fakeVerdict(topic: string): Verdict {
  return {
    queryId: 'q',
    answer: `Latest on ${topic}: nothing alarming. Details follow.`,
    trace: [],
    confidence: { score: 0.5, band: 'medium', gaps: [] },
    citations: [{ source: 'https://nist.gov/x', retrievedAt: '' }],
    hypotheses: [],
  };
}

describe('Briefing scheduler', () => {
  it('fires a briefing once its interval elapses', async () => {
    let runs = 0;
    const scheduler = new BriefingScheduler(async (topic) => {
      runs++;
      return fakeVerdict(topic);
    });

    const t0 = 1_000_000;
    scheduler.schedule('supply-chain risk', 60_000, t0);

    // Not due yet.
    expect(await scheduler.runDue(t0 + 30_000)).toEqual([]);
    expect(runs).toBe(0);

    // Due after the interval — it fires and produces a digest.
    const digests = await scheduler.runDue(t0 + 60_000);
    expect(digests).toHaveLength(1);
    expect(digests[0]!.topic).toBe('supply-chain risk');
    expect(digests[0]!.headline).toMatch(/Latest on supply-chain risk/);
    expect(digests[0]!.sources).toBe(1);
    expect(runs).toBe(1);
  });

  it('reschedules after firing', async () => {
    const scheduler = new BriefingScheduler(async (t) => fakeVerdict(t));
    const t0 = 0;
    const b = scheduler.schedule('topic', 100, t0);
    await scheduler.runDue(t0 + 100);
    expect(scheduler.list().find((x) => x.id === b.id)!.nextRunAt).toBe(t0 + 200);
  });
});
