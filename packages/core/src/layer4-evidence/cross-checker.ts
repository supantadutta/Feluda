/**
 * Cross-Checker (Layer IV) — significant claims want corroboration across ≥2
 * INDEPENDENT sources (distinct hosts). Single-sourced evidence is flagged so
 * the user (and the Confidence Calibrator) treat it with appropriate caution.
 */
import type { Evidence } from '../types.js';
import { hostOf } from './source-verifier.js';
import type { CrossChecker } from './index.js';

export interface CorroborationReport {
  /** Distinct independent hosts among credible evidence. */
  independentSources: number;
  /** True when ≥2 independent, reasonably-credible sources are present. */
  corroborated: boolean;
}

const MIN_CREDIBILITY = 0.5;

export class IndependentHostCrossChecker implements CrossChecker {
  async corroborate(evidence: Evidence[]): Promise<{ claim: string; corroborated: boolean }[]> {
    const corroborated = this.report(evidence).corroborated;
    return evidence.map((e) => ({ claim: e.claim, corroborated }));
  }

  /** Whole-set view used by the orchestrator and calibrator. */
  report(evidence: Evidence[]): CorroborationReport {
    const hosts = new Set(
      evidence.filter((e) => e.credibility >= MIN_CREDIBILITY).map((e) => hostOf(e.citation.source)),
    );
    return { independentSources: hosts.size, corroborated: hosts.size >= 2 };
  }

  /** Adds a 'single-source' flag to every item when corroboration is missing. */
  flag(evidence: Evidence[]): Evidence[] {
    if (this.report(evidence).corroborated) return evidence;
    return evidence.map((e) => ({
      ...e,
      flags: [...new Set([...(e.flags ?? []), 'single-source'])],
    }));
  }
}
