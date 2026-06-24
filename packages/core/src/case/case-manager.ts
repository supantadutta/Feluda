/**
 * Case Manager (Layer II). Creates and stores investigation cases, attaches
 * evidence, applies investigation verdicts (updating hypotheses, confidence
 * history, timeline, and unresolved questions), and exposes the case for report
 * generation. Storage sits behind `CaseStore` so it can be swapped later.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Evidence, Verdict } from '../types.js';
import { newId } from '../util/ids.js';
import { extractEntities } from '../osint/index.js';
import { buildTimeline } from './timeline-builder.js';
import type { CaseRecord, CaseStore, NewCaseInput } from './types.js';

export class InMemoryCaseStore implements CaseStore {
  protected cases = new Map<string, CaseRecord>();
  put(record: CaseRecord): void {
    this.cases.set(record.id, record);
  }
  get(id: string): CaseRecord | undefined {
    return this.cases.get(id);
  }
  list(): CaseRecord[] {
    return [...this.cases.values()];
  }
}

/** JSON file-backed case store — cases survive restarts (swappable for a DB). */
export class FileCaseStore extends InMemoryCaseStore {
  constructor(private readonly path: string) {
    super();
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, 'utf8')) as CaseRecord[];
      for (const c of raw) this.cases.set(c.id, c);
    }
  }
  override put(record: CaseRecord): void {
    super.put(record);
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify([...this.cases.values()]), 'utf8');
  }
}

export class CaseManager {
  constructor(private readonly store: CaseStore = new InMemoryCaseStore()) {}

  create(input: NewCaseInput): CaseRecord {
    const now = new Date().toISOString();
    const record: CaseRecord = {
      id: newId('case'),
      title: input.title,
      objective: input.objective,
      scope: input.scope,
      boundaries: input.boundaries ?? [
        'Lawful, public-source information only',
        'Defensive security only; no offensive actions',
        'No doxxing or deanonymising private individuals',
      ],
      subjectEntities: [],
      evidence: [],
      hypotheses: [],
      confidenceHistory: [],
      timeline: [],
      unresolvedQuestions: [],
      riskFlags: [],
      ethicsFlags: [],
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    this.store.put(record);
    return record;
  }

  get(id: string): CaseRecord | undefined {
    return this.store.get(id);
  }
  list(): CaseRecord[] {
    return this.store.list();
  }

  /** Attach user-provided evidence; extract entities and timeline from it. */
  addEvidence(id: string, evidence: Evidence[]): CaseRecord | undefined {
    const c = this.store.get(id);
    if (!c) return undefined;
    c.evidence.push(...evidence);
    for (const e of evidence) {
      mergeEntities(c, extractEntities(e.claim));
      c.timeline.push(...buildTimeline(e.claim, e.citation.source));
    }
    this.touch(c);
    return c;
  }

  /** Apply an investigation verdict to the case (Layer II → case state). */
  applyVerdict(id: string, question: string, verdict: Verdict): CaseRecord | undefined {
    const c = this.store.get(id);
    if (!c) return undefined;
    c.status = 'investigating';
    c.hypotheses = verdict.hypotheses;
    if (verdict.evidence) {
      for (const e of verdict.evidence) if (!c.evidence.some((x) => x.id === e.id)) c.evidence.push(e);
    }
    c.confidenceHistory.push({
      at: new Date().toISOString(),
      band: verdict.confidence.band,
      score: verdict.confidence.score,
      note: `After investigating: "${question.slice(0, 80)}"`,
    });
    // Unresolved questions = the named confidence gaps, de-duplicated.
    c.unresolvedQuestions = [...new Set([...c.unresolvedQuestions, ...verdict.confidence.gaps])];
    if (verdict.reviewFlags?.length) {
      c.riskFlags = [...new Set([...c.riskFlags, ...verdict.reviewFlags.map((f) => f.reason)])];
    }
    if (verdict.refusal) c.ethicsFlags.push(`${verdict.refusal.boundary}: ${verdict.refusal.reason}`);
    mergeEntities(c, (verdict.evidence ?? []).flatMap((e) => extractEntities(e.claim)));
    this.touch(c);
    return c;
  }

  setReport(id: string, report: string): CaseRecord | undefined {
    const c = this.store.get(id);
    if (!c) return undefined;
    c.report = report;
    c.status = 'closed';
    this.touch(c);
    return c;
  }

  private touch(c: CaseRecord): void {
    c.updatedAt = new Date().toISOString();
    this.store.put(c);
  }
}

function mergeEntities(c: CaseRecord, entities: { id: string; type: string; value: string }[]): void {
  for (const e of entities) {
    if (!c.subjectEntities.some((s) => s.type === e.type && s.value === e.value)) {
      c.subjectEntities.push(e as CaseRecord['subjectEntities'][number]);
    }
  }
}
