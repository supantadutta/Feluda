/**
 * Source Verifier (Layer IV) — scores how credible a source is and flags weak
 * ones. Heuristic and explainable: authoritative TLDs and known primary sources
 * rank highest; anonymous/user-generated content ranks lowest. This is a floor,
 * not a verdict on truth — it tells the loop how much to trust a source.
 */
import type { Evidence } from '../types.js';
import type { SourceVerifier } from './index.js';

const HIGH_TLDS = /\.(gov|mil|edu|int)(\b|\/|$)/i;
const STANDARDS = /(who\.int|nih\.gov|nasa\.gov|europa\.eu|un\.org|iso\.org|ietf\.org|nist\.gov)/i;
const REPUTABLE_NEWS =
  /(reuters\.com|apnews\.com|bbc\.co\.uk|bbc\.com|nature\.com|science\.org|economist\.com)/i;
const REFERENCE = /(wikipedia\.org|britannica\.com)/i;
const LOW_TRUST = /(blogspot\.|wordpress\.com|medium\.com|substack\.com|reddit\.com|quora\.com|x\.com|twitter\.com|facebook\.com)/i;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export class HeuristicSourceVerifier implements SourceVerifier {
  async score(evidence: Evidence): Promise<number> {
    const url = evidence.citation.source;
    if (STANDARDS.test(url)) return 0.95;
    if (HIGH_TLDS.test(url)) return 0.9;
    if (REPUTABLE_NEWS.test(url)) return 0.75;
    if (REFERENCE.test(url)) return 0.6;
    if (LOW_TRUST.test(url)) return 0.35;
    return 0.5;
  }

  /** Flags worth surfacing to the user about an individual source. */
  flagsFor(credibility: number): string[] {
    return credibility < 0.5 ? ['low-credibility'] : [];
  }
}
