/**
 * Live DNS provider via DNS-over-HTTPS (keyless, public, passive). Resolves
 * public DNS records for a domain — a read-only lookup, not a scan. Findings
 * cite the DoH endpoint queried.
 */
import { newId } from '../../util/ids.js';
import { gradeFromCredibility } from '../grading.js';
import type { OsintFinding, OsintTarget, OsintTargetType } from '../types.js';
import type { OsintProvider } from '../providers.js';

interface DohAnswer {
  name?: string;
  type?: number;
  data?: string;
}
interface DohResponse {
  Answer?: DohAnswer[];
}

const TYPES: { name: string; code: number }[] = [
  { name: 'A', code: 1 },
  { name: 'MX', code: 15 },
  { name: 'NS', code: 2 },
];

export interface DnsConfig {
  /** DoH resolver endpoint (default: Google). */
  resolverUrl?: string;
  fetchImpl?: typeof fetch;
}

export class DnsProvider implements OsintProvider {
  readonly name = 'dns-doh';
  readonly mode = 'live' as const;
  private readonly resolver: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: DnsConfig = {}) {
    this.resolver = config.resolverUrl ?? 'https://dns.google/resolve';
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  supports(type: OsintTargetType): boolean {
    return type === 'domain';
  }

  async investigate(target: OsintTarget): Promise<OsintFinding[]> {
    const findings: OsintFinding[] = [];
    for (const t of TYPES) {
      const url = `${this.resolver}?name=${encodeURIComponent(target.normalized)}&type=${t.name}`;
      const res = await this.fetchImpl(url);
      if (!res.ok) continue;
      const data = (await res.json()) as DohResponse;
      const records = (data.Answer ?? []).filter((a) => a.type === t.code).map((a) => a.data).filter(Boolean);
      if (records.length > 0) {
        const credibility = 0.85;
        findings.push({
          id: newId('dns'),
          claim: `${target.normalized} ${t.name} records: ${records.join(', ')}.`,
          citation: { source: url, title: `DNS ${t.name} (DoH)`, retrievedAt: new Date().toISOString() },
          credibility,
          relevance: 0.85,
          grade: gradeFromCredibility(credibility),
          category: 'fact',
          freshnessDays: 0,
        });
      }
    }
    return findings;
  }
}
