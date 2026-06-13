/**
 * Layer IV — Evidence & Sources (boundary module)
 * ───────────────────────────────────────────────
 * Pull only from credible, verifiable sources; trace everything. Web/news search
 * behind a provider-agnostic interface, a Source Verifier (credibility scoring),
 * a Cross-Checker (≥2 independent sources for significant claims), the Citation
 * Trail, and doc ingest.
 *
 * Anti-fabrication guarantee: citations come ONLY from what a provider actually
 * returned (or a user document). The model never invents a source — it reasons
 * over evidence the loop gathered.
 *
 * Phase: implemented in Phase 2.
 */
import type { Evidence, Query } from '../types.js';
import { newId } from '../util/ids.js';
import { HeuristicSourceVerifier } from './source-verifier.js';
import { IndependentHostCrossChecker, type CorroborationReport } from './cross-checker.js';
import { FixtureSearchProvider } from './providers/stub-search.js';
import { TavilySearchProvider } from './providers/tavily-search.js';

/** A raw search hit from any provider. */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

/** Provider-agnostic search backend (web/news). */
export interface SearchProvider {
  readonly name: string;
  /** True when this is an offline fixture provider (no live sources). */
  readonly offline: boolean;
  search(query: string, opts?: { maxResults?: number }): Promise<SearchResult[]>;
}

/** Scores how credible a source is; flags weak or single-source claims. */
export interface SourceVerifier {
  score(evidence: Evidence): Promise<number>;
}

/** Requires corroboration across ≥2 independent sources for significant claims. */
export interface CrossChecker {
  corroborate(evidence: Evidence[]): Promise<{ claim: string; corroborated: boolean }[]>;
}

/** What the Orchestrator gets back from a "gather evidence" step. */
export interface GatheredEvidence {
  evidence: Evidence[];
  corroboration: CorroborationReport;
  /** True if gathered from an offline fixture provider. */
  offline: boolean;
}

/** The boundary the Orchestrator calls to "gather evidence". */
export interface EvidencePort {
  gather(query: Query): Promise<GatheredEvidence>;
}

export { HeuristicSourceVerifier, hostOf } from './source-verifier.js';
export { IndependentHostCrossChecker, type CorroborationReport } from './cross-checker.js';
export { FixtureSearchProvider } from './providers/stub-search.js';
export { TavilySearchProvider, type TavilyConfig } from './providers/tavily-search.js';
export { DocIngestor, type IngestInput } from './ingest.js';

/** Default EvidencePort: search → verify credibility → cross-check → trail. */
export class SearchEvidencePort implements EvidencePort {
  private readonly verifier = new HeuristicSourceVerifier();
  private readonly crossChecker = new IndependentHostCrossChecker();

  constructor(private readonly provider: SearchProvider) {}

  async gather(query: Query): Promise<GatheredEvidence> {
    const retrievedAt = new Date().toISOString();
    const results = await this.provider.search(query.text, { maxResults: 5 });

    let evidence: Evidence[] = await Promise.all(
      results.map(async (r) => {
        const base: Evidence = {
          id: newId('ev'),
          claim: r.snippet || r.title,
          citation: { source: r.url, title: r.title, publishedAt: r.publishedAt, retrievedAt },
          credibility: 0,
          relevance: 0.6,
        };
        const credibility = await this.verifier.score(base);
        const flags = this.verifier.flagsFor(credibility);
        if (this.provider.offline) flags.push('offline-fixture');
        return { ...base, credibility, flags: flags.length ? flags : undefined };
      }),
    );

    evidence = this.crossChecker.flag(evidence);
    const corroboration = this.crossChecker.report(evidence);
    return { evidence, corroboration, offline: this.provider.offline };
  }
}

export interface EvidenceConfig {
  /** Web search API key (Tavily). When absent, the offline fixture is used. */
  searchApiKey?: string;
}

/** Build the default EvidencePort — live search when keyed, else offline fixture. */
export function createEvidencePort(config: EvidenceConfig = {}): EvidencePort {
  const provider: SearchProvider = config.searchApiKey
    ? new TavilySearchProvider({ apiKey: config.searchApiKey })
    : new FixtureSearchProvider();
  return new SearchEvidencePort(provider);
}
