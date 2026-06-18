/**
 * Investigation Case System (Layer II) — a first-class case record that ties an
 * investigation together: scope, subject entities, evidence, hypotheses,
 * confidence history, timeline, unresolved questions, risk/ethics flags, and the
 * final report. Built on the core evidence vocabulary and the OSINT entity model.
 */
import type { Confidence, Evidence, Hypothesis } from '../types.js';
import type { EntityNode } from '../osint/types.js';

export type CaseStatus = 'open' | 'investigating' | 'closed';

/** A point in the confidence history — how belief moved and why. */
export interface ConfidencePoint {
  at: string;
  band: Confidence['band'];
  score: number;
  note: string;
}

/** One entry on the case timeline (handles missing/ambiguous dates). */
export interface TimelineEntry {
  /** ISO timestamp when known; omitted when the date is unknown. */
  at?: string;
  /** Original timezone/offset text, if present. */
  tz?: string;
  event: string;
  source?: string;
  confidence?: Confidence['band'];
  relatedEntity?: string;
  /** Set when the date/time was ambiguous or inferred. */
  uncertainty?: string;
}

export interface CaseRecord {
  id: string;
  title: string;
  objective?: string;
  scope?: string;
  boundaries: string[];
  subjectEntities: EntityNode[];
  evidence: Evidence[];
  hypotheses: Hypothesis[];
  confidenceHistory: ConfidencePoint[];
  timeline: TimelineEntry[];
  unresolvedQuestions: string[];
  riskFlags: string[];
  ethicsFlags: string[];
  report?: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NewCaseInput {
  title: string;
  objective?: string;
  scope?: string;
  boundaries?: string[];
}

/** Storage behind the CaseManager — swappable (in-memory by default). */
export interface CaseStore {
  put(record: CaseRecord): void;
  get(id: string): CaseRecord | undefined;
  list(): CaseRecord[];
}
