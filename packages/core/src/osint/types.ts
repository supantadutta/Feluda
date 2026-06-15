/**
 * OSINT domain types (cross-cutting; built on the core evidence vocabulary).
 *
 * Feluda's OSINT engine is LAWFUL and PASSIVE only: it reasons over public /
 * user-provided information. It never performs intrusive scanning, exploitation,
 * credential attacks, scraping of private accounts, doxxing, or deanonymisation
 * of private individuals (CLAUDE.md hard boundaries; enforced by Layer VII).
 */
import type { Evidence } from '../types.js';

export type OsintTargetType =
  | 'domain'
  | 'ip'
  | 'url'
  | 'email'
  | 'username'
  | 'organization'
  | 'person_public'
  | 'file_hash'
  | 'cve'
  | 'phone'
  | 'soc_alert'
  | 'unknown';

export interface OsintTarget {
  type: OsintTargetType;
  /** The raw value as supplied by the user. */
  value: string;
  /** Normalised value (lower-cased host, defanged refanged, etc.). */
  normalized: string;
}

/** Letter-grade source reliability (NATO-style admiralty scale, simplified). */
export type SourceGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Epistemic category — the final answer must never blur these. */
export type EpistemicCategory =
  | 'fact'
  | 'claim'
  | 'inference'
  | 'assumption'
  | 'speculation'
  | 'unknown';

/** An OSINT finding: evidence plus reliability grade and epistemic category. */
export interface OsintFinding extends Evidence {
  grade: SourceGrade;
  category: EpistemicCategory;
  /** Age of the source in days, when known (drives freshness). */
  freshnessDays?: number;
}

export type EntityType =
  | 'domain'
  | 'ip'
  | 'url'
  | 'email'
  | 'username'
  | 'organization'
  | 'file_hash'
  | 'cve'
  | 'port'
  | 'protocol'
  | 'mitre_technique'
  | 'hostname';

export interface EntityNode {
  id: string;
  type: EntityType;
  value: string;
}

export type RelationshipKind =
  | 'resolved_to'
  | 'owned_by'
  | 'hosted_on'
  | 'mentioned_with'
  | 'associated_with'
  | 'observed_in'
  | 'contradicted_by'
  | 'same_as'
  | 'likely_related_to';

export interface EntityRelationship {
  from: string;
  to: string;
  kind: RelationshipKind;
}

export interface InvestigationGraph {
  nodes: EntityNode[];
  edges: EntityRelationship[];
}

/** A passive OSINT investigation profile for a target type. */
export interface OsintProfile {
  targetType: OsintTargetType;
  allowedSources: string[];
  disallowedActions: string[];
  enrichment: string[];
}

export interface OsintResult {
  target: OsintTarget;
  findings: OsintFinding[];
  graph: InvestigationGraph;
  /** Whether the result came from offline fixtures (no live sources). */
  offline: boolean;
  /** Honest notes about scope and limitations. */
  notes: string[];
}
