/**
 * Offline fixture search provider. Used when no WEB_SEARCH_API_KEY is set and in
 * tests, so the evidence pipeline runs without network. Results are clearly
 * marked as offline fixtures (flagged downstream) — Feluda never passes them off
 * as real authoritative findings.
 *
 * It returns two INDEPENDENT, credible-looking hosts so corroboration logic is
 * exercised end-to-end offline.
 */
import type { SearchProvider, SearchResult } from '../index.js';

export class FixtureSearchProvider implements SearchProvider {
  readonly name = 'offline-fixture';
  readonly offline = true;

  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim();
    return [
      {
        title: `Reference overview relevant to: ${q}`,
        url: 'https://en.wikipedia.org/wiki/Special:Search',
        snippet: `An encyclopaedic overview addressing "${q}" (offline fixture).`,
      },
      {
        title: `Government/primary-source material on: ${q}`,
        url: 'https://www.nist.gov/',
        snippet: `Primary-source style material related to "${q}" (offline fixture).`,
      },
    ];
  }
}
