/**
 * Layer IV — Evidence & Sources (boundary module)
 * ───────────────────────────────────────────────
 * Pull only from credible, verifiable sources; trace everything. Web & news
 * search, authoritative feeds, a Source Verifier (credibility scoring), a
 * Cross-Checker (≥2 independent sources for significant claims), the Citation
 * Trail, and doc/data ingest.
 *
 * Phase: implemented in Phase 2.
 */
import type { Evidence, Query } from '../types.js';
import { notImplemented } from '../util/not-implemented.js';

/** Scores how credible a source is; flags weak or single-source claims. */
export interface SourceVerifier {
  score(evidence: Evidence): Promise<number>;
}

/** Requires corroboration across ≥2 independent sources for significant claims. */
export interface CrossChecker {
  corroborate(evidence: Evidence[]): Promise<{ claim: string; corroborated: boolean }[]>;
}

/** The boundary the Orchestrator calls to "gather evidence". */
export interface EvidencePort {
  /** Gather candidate evidence for a query from authentic sources. */
  gather(query: Query): Promise<Evidence[]>;
}

/** Phase 0 placeholder — live search + verification land in Phase 2. */
export function createEvidencePort(): EvidencePort {
  return {
    gather: () => notImplemented('Layer IV EvidencePort.gather'),
  };
}
