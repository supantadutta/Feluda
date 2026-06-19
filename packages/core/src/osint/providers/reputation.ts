/**
 * Reputation / threat-intel provider (live, KEY-GATED). A generic adapter for a
 * passive reputation API (domain/IP/URL/file-hash) that returns a malicious/
 * suspicious/clean verdict for an indicator. The endpoint and key are injected;
 * nothing is hard-coded and the key is never logged. Disabled unless a key is
 * supplied. Findings cite the API endpoint queried (real provenance).
 *
 * This is a lookup, not a scan — fully passive and lawful.
 */
import { newId } from '../../util/ids.js';
import { gradeFromCredibility } from '../grading.js';
import type { OsintFinding, OsintTarget, OsintTargetType } from '../types.js';
import type { OsintProvider } from '../providers.js';

export interface ReputationConfig {
  apiKey: string;
  /** Endpoint template; `{value}` is replaced with the indicator. */
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

interface ReputationResponse {
  /** Normalised verdict from the provider. */
  verdict?: 'malicious' | 'suspicious' | 'clean' | 'unknown';
  score?: number;
  categories?: string[];
}

export class ReputationProvider implements OsintProvider {
  readonly name = 'reputation';
  readonly mode = 'live' as const;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: ReputationConfig) {
    this.endpoint = config.endpoint ?? 'https://reputation.example/api/v1/lookup?indicator={value}';
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  supports(type: OsintTargetType): boolean {
    return type === 'domain' || type === 'ip' || type === 'url' || type === 'file_hash';
  }

  async investigate(target: OsintTarget): Promise<OsintFinding[]> {
    const url = this.endpoint.replace('{value}', encodeURIComponent(target.normalized));
    const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${this.config.apiKey}` } });
    if (!res.ok) throw new Error(`Reputation lookup failed (${res.status})`);
    const data = (await res.json()) as ReputationResponse;
    const verdict = data.verdict ?? 'unknown';
    // Reputation is a useful secondary signal, not authoritative on its own.
    const credibility = verdict === 'unknown' ? 0.45 : 0.7;
    const cats = data.categories?.length ? ` (${data.categories.join(', ')})` : '';
    return [
      {
        id: newId('rep'),
        claim: `Reputation for ${target.normalized}: ${verdict}${cats}.`,
        // Citation references the lookup endpoint without the key (path only).
        citation: { source: url.split('?')[0]!, title: 'Reputation lookup', retrievedAt: new Date().toISOString() },
        credibility,
        relevance: 0.8,
        grade: gradeFromCredibility(credibility),
        category: 'claim',
        flags: verdict === 'unknown' ? ['unverified'] : undefined,
      },
    ];
  }
}
