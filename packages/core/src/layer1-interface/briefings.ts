/**
 * Briefings (Layer I) — scheduled digests on topics the user tracks. The
 * scheduler is deterministic and testable: `runDue(now)` runs every briefing
 * whose next run has arrived and returns a short digest built from the verdict.
 * The API can also drive it on a real interval.
 */
import type { Verdict } from '../types.js';
import { newId } from '../util/ids.js';

export interface Briefing {
  id: string;
  topic: string;
  intervalMs: number;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt: number;
}

export interface BriefingDigest {
  briefingId: string;
  topic: string;
  headline: string;
  confidence: Verdict['confidence']['band'];
  sources: number;
  at: string;
}

export type BriefingRunner = (topic: string) => Promise<Verdict>;

export class BriefingScheduler {
  private briefings = new Map<string, Briefing>();

  constructor(private readonly runner: BriefingRunner) {}

  schedule(topic: string, intervalMs: number, now = Date.now()): Briefing {
    const b: Briefing = {
      id: newId('brief'),
      topic,
      intervalMs,
      createdAt: new Date(now).toISOString(),
      nextRunAt: now + intervalMs,
    };
    this.briefings.set(b.id, b);
    return b;
  }

  list(): Briefing[] {
    return [...this.briefings.values()];
  }

  due(now = Date.now()): Briefing[] {
    return this.list().filter((b) => b.nextRunAt <= now);
  }

  /** Run every due briefing, advance its schedule, and return digests. */
  async runDue(now = Date.now()): Promise<BriefingDigest[]> {
    const digests: BriefingDigest[] = [];
    for (const b of this.due(now)) {
      digests.push(await this.runOne(b, now));
      b.lastRunAt = new Date(now).toISOString();
      b.nextRunAt = now + b.intervalMs;
    }
    return digests;
  }

  /** Run a single briefing now (e.g. a manual "run" button). */
  async run(id: string, now = Date.now()): Promise<BriefingDigest | undefined> {
    const b = this.briefings.get(id);
    if (!b) return undefined;
    const digest = await this.runOne(b, now);
    b.lastRunAt = new Date(now).toISOString();
    b.nextRunAt = now + b.intervalMs;
    return digest;
  }

  private async runOne(b: Briefing, now: number): Promise<BriefingDigest> {
    const verdict = await this.runner(b.topic);
    return {
      briefingId: b.id,
      topic: b.topic,
      headline: verdict.answer.split(/[.\n]/)[0]?.trim() ?? verdict.answer.slice(0, 120),
      confidence: verdict.confidence.band,
      sources: verdict.citations.length,
      at: new Date(now).toISOString(),
    };
  }
}
